import * as core from '@actions/core'
import {ellipsis} from './markdown-utils'

const MAX_RETRY_AFTER_SECONDS = 60

interface HttpErrorLike {
  status?: number
  message?: string
  response?: {headers?: Record<string, string | number | undefined>}
}

export interface RetryOptions {
  retries?: number
  isRetryable?: (error: unknown) => boolean
  sleep?: (ms: number) => Promise<void>
  warn?: (message: string) => void
}

function asHttpError(error: unknown): HttpErrorLike {
  return typeof error === 'object' && error !== null ? error : {}
}

export function describeError(error: unknown): string {
  const {status, message} = asHttpError(error)
  const text = ellipsis(message ?? String(error), 300)
  return status === undefined ? text : `HTTP ${status}: ${text}`
}

// Octokit reports network failures and aborted requests as status 500, so those are covered as well
export function isTransientError(error: unknown): boolean {
  const {status, message} = asHttpError(error)
  if (status === undefined) {
    return false
  }
  return status >= 500 || status === 429 || (status === 403 && /rate limit/i.test(message ?? ''))
}

// A check run that was just created can briefly 404 on update because GitHub has not caught up yet
export function isTransientOrNotFoundError(error: unknown): boolean {
  return asHttpError(error).status === 404 || isTransientError(error)
}

function retryDelayMs(error: unknown, attempt: number): number {
  const retryAfter = Number(asHttpError(error).response?.headers?.['retry-after'])
  if (retryAfter > 0) {
    return Math.min(retryAfter, MAX_RETRY_AFTER_SECONDS) * 1000
  }
  return 1000 * 2 ** attempt
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {retries = 3, isRetryable = isTransientError, sleep: wait = sleep, warn = core.warning} = options
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) {
        throw error
      }
      const delay = retryDelayMs(error, attempt)
      warn(
        `Request failed (${describeError(error)}), retrying in ${delay / 1000}s (attempt ${attempt + 2} of ${retries + 1})`
      )
      await wait(delay)
    }
  }
}
