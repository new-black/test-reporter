import {hasAnsiCodes, stripAnsiCodes, ansiToGithubLatex, ansiToMarkdown} from '../../src/utils/ansi-utils'

describe('hasAnsiCodes', () => {
  it('returns false for plain text', () => {
    expect(hasAnsiCodes('Hello world')).toBe(false)
  })

  it('returns true for text with ANSI color codes', () => {
    expect(hasAnsiCodes('\x1b[31mRed text\x1b[0m')).toBe(true)
  })

  it('returns true for text with complex ANSI sequences', () => {
    expect(hasAnsiCodes('\x1b[1m\x1b[33mBold yellow\x1b[0m')).toBe(true)
  })

  it('returns true for literal escaped \\u001b sequences', () => {
    // This is the literal string "\u001b" (6 chars), not the ESC character
    expect(hasAnsiCodes('\\u001b[33mYellow\\u001b[0m')).toBe(true)
  })

  it('returns true for literal escaped \\x1b sequences', () => {
    expect(hasAnsiCodes('\\x1b[31mRed\\x1b[0m')).toBe(true)
  })
})

describe('stripAnsiCodes', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsiCodes('Hello world')).toBe('Hello world')
  })

  it('removes ANSI color codes', () => {
    expect(stripAnsiCodes('\x1b[31mRed text\x1b[0m')).toBe('Red text')
  })

  it('removes multiple ANSI sequences', () => {
    expect(stripAnsiCodes('\x1b[1m\x1b[33mBold yellow\x1b[0m normal \x1b[34mblue\x1b[0m')).toBe(
      'Bold yellow normal blue'
    )
  })

  it('removes literal escaped \\u001b sequences', () => {
    expect(stripAnsiCodes('\\u001b[33mYellow\\u001b[0m')).toBe('Yellow')
  })

  it('removes literal escaped \\x1b sequences', () => {
    expect(stripAnsiCodes('\\x1b[31mRed\\x1b[0m')).toBe('Red')
  })
})

describe('ansiToGithubLatex', () => {
  it('returns plain text unchanged', () => {
    expect(ansiToGithubLatex('Hello world')).toBe('Hello world')
  })

  it('converts red text to LaTeX color', () => {
    const input = '\x1b[31mError\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\color{red}')
    expect(output).toContain('Error')
  })

  it('converts green text to LaTeX color', () => {
    const input = '\x1b[32mSuccess\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\color{green}')
    expect(output).toContain('Success')
  })

  it('converts yellow text to LaTeX color', () => {
    const input = '\x1b[33mWarning\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\color{yellow}')
    expect(output).toContain('Warning')
  })

  it('converts blue text to LaTeX color', () => {
    const input = '\x1b[34mInfo\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\color{blue}')
    expect(output).toContain('Info')
  })

  it('converts bright magenta text to LaTeX color', () => {
    const input = '\x1b[95mMagenta\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\color{magenta}')
    expect(output).toContain('Magenta')
  })

  it('handles multiple colors in one line', () => {
    const input = '\x1b[31mRed\x1b[0m and \x1b[32mGreen\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\color{red}')
    expect(output).toContain('\\color{green}')
  })

  it('handles multiline input', () => {
    const input = '\x1b[31mLine 1\x1b[0m\nLine 2\n\x1b[32mLine 3\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\color{red}')
    expect(output).toContain('Line 2')
    expect(output).toContain('\\color{green}')
  })

  it('escapes LaTeX special characters', () => {
    const input = '\x1b[31mTest_value\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('\\_')
  })

  it('handles complex ANSI sequences from example', () => {
    // Example from the user's bug report
    const input = '\x1b[3m\x1b[33morderResponse\x1b[0m\x1b[97m.\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('$$')
    expect(output).toContain('\\color{yellow}')
    expect(output).toContain('orderResponse')
  })

  it('handles literal escaped \\u001b sequences', () => {
    const input = '\\u001b[33morderResponse\\u001b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('$$')
    expect(output).toContain('\\color{yellow}')
    expect(output).toContain('orderResponse')
  })

  it('handles literal escaped \\x1b sequences', () => {
    const input = '\\x1b[31mError\\x1b[0m'
    const output = ansiToGithubLatex(input)
    expect(output).toContain('$$')
    expect(output).toContain('\\color{red}')
    expect(output).toContain('Error')
  })
})

describe('ansiToMarkdown', () => {
  it('escapes markdown special characters in plain text', () => {
    expect(ansiToMarkdown('Hello *world*')).toBe('Hello \\*world\\*')
  })

  it('converts ANSI colors to LaTeX and wraps in $$', () => {
    const input = '\x1b[31mError\x1b[0m'
    const output = ansiToMarkdown(input)
    expect(output.startsWith('$$')).toBe(true)
    expect(output.endsWith('$$')).toBe(true)
    expect(output).toContain('\\color{red}')
  })
})
