import {ellipsis, formatTime, table, link, fixEol, tableEscape, Align} from '../../src/utils/markdown-utils'

describe('ellipsis', () => {
  it('returns text unchanged when shorter than maxLength', () => {
    expect(ellipsis('hello', 10)).toBe('hello')
  })

  it('returns text unchanged when equal to maxLength', () => {
    expect(ellipsis('hello', 5)).toBe('hello')
  })

  it('truncates text and adds ellipsis when longer than maxLength', () => {
    expect(ellipsis('hello world', 8)).toBe('hello...')
  })

  it('handles edge case where maxLength is very small', () => {
    expect(ellipsis('hello', 4)).toBe('h...')
  })
})

describe('formatTime', () => {
  it('formats milliseconds when under 1 second', () => {
    expect(formatTime(500)).toBe('500ms')
  })

  it('formats seconds when 1 second or more', () => {
    expect(formatTime(1500)).toBe('2s')
  })

  it('rounds milliseconds', () => {
    expect(formatTime(1.5)).toBe('2ms')
  })

  it('handles exactly 1 second as milliseconds', () => {
    // Note: code uses > 1000, so 1000 exactly is ms
    expect(formatTime(1000)).toBe('1000ms')
  })

  it('handles exactly 1001ms as seconds', () => {
    expect(formatTime(1001)).toBe('1s')
  })

  it('formats large durations', () => {
    expect(formatTime(65000)).toBe('65s')
  })
})

describe('link', () => {
  it('creates markdown link', () => {
    expect(link('Title', 'https://example.com')).toBe('[Title](https://example.com)')
  })

  it('handles empty title', () => {
    expect(link('', 'https://example.com')).toBe('[](https://example.com)')
  })
})

describe('tableEscape', () => {
  it('escapes first pipe character', () => {
    // Note: current implementation only replaces first occurrence
    expect(tableEscape('value|with|pipes')).toBe('value\\|with|pipes')
  })

  it('converts numbers to string', () => {
    expect(tableEscape(42)).toBe('42')
  })

  it('converts booleans to string', () => {
    expect(tableEscape(true)).toBe('true')
  })
})

describe('fixEol', () => {
  it('removes carriage returns', () => {
    expect(fixEol('line1\r\nline2\r\n')).toBe('line1\nline2\n')
  })

  it('handles undefined', () => {
    expect(fixEol(undefined)).toBe('')
  })

  it('leaves text without CR unchanged', () => {
    expect(fixEol('line1\nline2')).toBe('line1\nline2')
  })
})

describe('table', () => {
  it('creates markdown table', () => {
    const result = table(['Col1', 'Col2'], [Align.Left, Align.Right], ['a', 'b'], ['c', 'd'])
    expect(result).toBe('|Col1|Col2|\n|:---|---:|\n|a|b|\n|c|d|')
  })

  it('handles single row', () => {
    const result = table(['Header'], [Align.None], ['value'])
    expect(result).toBe('|Header|\n|---|\n|value|')
  })

  it('escapes pipe characters in cells', () => {
    const result = table(['Col'], [Align.None], ['val|ue'])
    expect(result).toBe('|Col|\n|---|\n|val\\|ue|')
  })
})

describe('Align enum', () => {
  it('has correct values', () => {
    expect(Align.Left).toBe(':---')
    expect(Align.Center).toBe(':---:')
    expect(Align.Right).toBe('---:')
    expect(Align.None).toBe('---')
  })
})
