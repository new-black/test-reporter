import {resolveChecksToken} from '../../src/utils/github-utils'

describe('resolveChecksToken', () => {
  it('uses the checks token when provided', () => {
    expect(resolveChecksToken('app-token', 'github-token')).toBe('app-token')
  })

  it('falls back to the default token when the checks token is empty', () => {
    expect(resolveChecksToken('', 'github-token')).toBe('github-token')
  })
})
