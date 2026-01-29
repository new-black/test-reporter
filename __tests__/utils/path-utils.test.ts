import {normalizeFilePath, normalizeDirPath, getBasePath} from '../../src/utils/path-utils'

describe('normalizeFilePath', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeFilePath('')).toBe('')
  })

  it('returns undefined for undefined input', () => {
    expect(normalizeFilePath(undefined as unknown as string)).toBe(undefined)
  })

  it('replaces backslashes with forward slashes', () => {
    expect(normalizeFilePath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt')
  })

  it('trims whitespace', () => {
    expect(normalizeFilePath('  /path/to/file  ')).toBe('/path/to/file')
  })

  it('handles mixed slashes', () => {
    expect(normalizeFilePath('path\\to/file\\name.txt')).toBe('path/to/file/name.txt')
  })

  it('leaves forward slashes unchanged', () => {
    expect(normalizeFilePath('/path/to/file.txt')).toBe('/path/to/file.txt')
  })
})

describe('normalizeDirPath', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeDirPath('', true)).toBe('')
  })

  it('adds trailing slash when requested', () => {
    expect(normalizeDirPath('/path/to/dir', true)).toBe('/path/to/dir/')
  })

  it('does not add trailing slash when not requested', () => {
    expect(normalizeDirPath('/path/to/dir', false)).toBe('/path/to/dir')
  })

  it('does not duplicate trailing slash', () => {
    expect(normalizeDirPath('/path/to/dir/', true)).toBe('/path/to/dir/')
  })

  it('normalizes backslashes and adds trailing slash', () => {
    expect(normalizeDirPath('C:\\Users\\test', true)).toBe('C:/Users/test/')
  })
})

describe('getBasePath', () => {
  const trackedFiles = ['src/main.ts', 'src/utils/path-utils.ts', 'test/file.ts']

  it('returns empty string when path exactly matches tracked file', () => {
    expect(getBasePath('src/main.ts', trackedFiles)).toBe('')
  })

  it('returns base path when path ends with tracked file', () => {
    expect(getBasePath('/home/user/project/src/main.ts', trackedFiles)).toBe('/home/user/project/')
  })

  it('returns undefined when path does not match any tracked file', () => {
    expect(getBasePath('/some/random/path.ts', trackedFiles)).toBe(undefined)
  })

  it('returns longest matching base path', () => {
    const files = ['file.ts', 'utils/file.ts']
    expect(getBasePath('/project/src/utils/file.ts', files)).toBe('/project/src/')
  })

  it('returns undefined for empty tracked files', () => {
    expect(getBasePath('/path/to/file.ts', [])).toBe(undefined)
  })
})
