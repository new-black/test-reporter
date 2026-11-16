import {describeError, isTransientError, withRetry} from '../../src/utils/retry-utils'

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly response?: {headers: Record<string, string>}
  ) {
    super(message)
  }
}

function recorder(): {
  delays: number[]
  warnings: string[]
  options: {sleep: (ms: number) => Promise<void>; warn: (message: string) => void}
} {
  const delays: number[] = []
  const warnings: string[] = []
  return {
    delays,
    warnings,
    options: {
      sleep: async (ms: number): Promise<void> => {
        delays.push(ms)
      },
      warn: (message: string): void => {
        warnings.push(message)
      }
    }
  }
}

function failingThen(errors: Error[]): {fn: () => Promise<string>; calls: () => number} {
  let calls = 0
  return {
    fn: async (): Promise<string> => {
      const error = errors[calls++]
      if (error) {
        throw error
      }
      return 'ok'
    },
    calls: (): number => calls
  }
}

describe('withRetry', () => {
  it('returns the result of a call that succeeds', async () => {
    const {options, delays, warnings} = recorder()
    const {fn, calls} = failingThen([])
    await expect(withRetry(fn, options)).resolves.toBe('ok')
    expect(calls()).toBe(1)
    expect(delays).toEqual([])
    expect(warnings).toEqual([])
  })

  it('retries transient failures with exponential backoff until the call succeeds', async () => {
    const {options, delays, warnings} = recorder()
    const {fn, calls} = failingThen([new HttpError(502, 'Bad Gateway'), new HttpError(503, 'Unavailable')])
    await expect(withRetry(fn, options)).resolves.toBe('ok')
    expect(calls()).toBe(3)
    expect(delays).toEqual([1000, 2000])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain('HTTP 502: Bad Gateway')
    expect(warnings[0]).toContain('attempt 2 of 4')
  })

  it('gives up after the configured number of retries and throws the last error', async () => {
    const {options, delays} = recorder()
    const errors = [1, 2, 3, 4].map(i => new HttpError(500, `failure ${i}`))
    const {fn, calls} = failingThen(errors)
    await expect(withRetry(fn, options)).rejects.toBe(errors[3])
    expect(calls()).toBe(4)
    expect(delays).toEqual([1000, 2000, 4000])
  })

  it('does not retry when retries is 0', async () => {
    const {options, delays} = recorder()
    const error = new HttpError(500, 'failure')
    const {fn, calls} = failingThen([error])
    await expect(withRetry(fn, {...options, retries: 0})).rejects.toBe(error)
    expect(calls()).toBe(1)
    expect(delays).toEqual([])
  })

  it.each([400, 401, 404, 422])('does not retry HTTP %i', async status => {
    const {options, delays} = recorder()
    const error = new HttpError(status, 'rejected')
    const {fn, calls} = failingThen([error])
    await expect(withRetry(fn, options)).rejects.toBe(error)
    expect(calls()).toBe(1)
    expect(delays).toEqual([])
  })

  it('does not retry a 403 that is not a rate limit', async () => {
    const {options} = recorder()
    const error = new HttpError(403, 'Resource not accessible by integration')
    const {fn, calls} = failingThen([error])
    await expect(withRetry(fn, options)).rejects.toBe(error)
    expect(calls()).toBe(1)
  })

  it('does not retry errors that carry no HTTP status', async () => {
    const {options} = recorder()
    const error = new Error('not an HTTP failure')
    const {fn, calls} = failingThen([error])
    await expect(withRetry(fn, options)).rejects.toBe(error)
    expect(calls()).toBe(1)
  })

  it('retries 429 and secondary rate limits', async () => {
    const {options} = recorder()
    const {fn, calls} = failingThen([
      new HttpError(429, 'Too Many Requests'),
      new HttpError(403, 'You have exceeded a secondary rate limit')
    ])
    await expect(withRetry(fn, options)).resolves.toBe('ok')
    expect(calls()).toBe(3)
  })

  it('waits as long as retry-after asks, but not longer than 60 seconds', async () => {
    const {options, delays} = recorder()
    const {fn} = failingThen([
      new HttpError(403, 'You have exceeded a secondary rate limit', {headers: {'retry-after': '5'}}),
      new HttpError(429, 'Too Many Requests', {headers: {'retry-after': '600'}})
    ])
    await expect(withRetry(fn, options)).resolves.toBe('ok')
    expect(delays).toEqual([5000, 60000])
  })
})

describe('isTransientError', () => {
  it.each([500, 502, 503, 504, 429])('treats HTTP %i as transient', status => {
    expect(isTransientError(new HttpError(status, 'failure'))).toBe(true)
  })

  it.each([400, 401, 404, 409, 422])('treats HTTP %i as permanent', status => {
    expect(isTransientError(new HttpError(status, 'failure'))).toBe(false)
  })

  it('only treats a 403 as transient when it is a rate limit', () => {
    expect(isTransientError(new HttpError(403, 'API rate limit exceeded for installation'))).toBe(true)
    expect(isTransientError(new HttpError(403, 'Resource not accessible by integration'))).toBe(false)
  })

  it('treats values without an HTTP status as permanent', () => {
    expect(isTransientError(new Error('boom'))).toBe(false)
    expect(isTransientError('boom')).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
  })
})

describe('describeError', () => {
  it('includes the HTTP status', () => {
    expect(describeError(new HttpError(502, 'Bad Gateway'))).toBe('HTTP 502: Bad Gateway')
  })

  it('uses the message of errors without a status', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
  })

  it('converts values that are not errors', () => {
    expect(describeError('boom')).toBe('boom')
    expect(describeError(undefined)).toBe('undefined')
  })

  it('shortens very long messages', () => {
    const text = describeError(new HttpError(500, 'x'.repeat(1000)))
    expect(text.startsWith('HTTP 500: xxx')).toBe(true)
    expect(text.endsWith('...')).toBe(true)
    expect(text.length).toBeLessThan(320)
  })
})
