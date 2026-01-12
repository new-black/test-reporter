// ANSI foreground color codes to GitHub LaTeX color names
const ANSI_TO_COLOR: Record<number, string> = {
  // Standard colors (30-37)
  30: 'gray', // Black -> gray for visibility
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'lightgray',
  // Bright colors (90-97)
  90: 'gray',
  91: 'red',
  92: 'lightgreen',
  93: 'orange', // Bright yellow -> orange for better visibility
  94: 'lightblue',
  95: 'magenta',
  96: 'cyan',
  97: 'white'
}

// ESC character for ANSI sequences
const ESC = '\x1b'

interface AnsiSegment {
  text: string
  color?: string
}

/**
 * Create regex for matching ANSI escape sequences
 */
function createAnsiRegex(global: boolean): RegExp {
  // eslint-disable-next-line no-control-regex
  return global ? /\x1b\[([0-9;]*)m/g : /\x1b\[([0-9;]*)m/
}

/**
 * Parse ANSI escape sequences and extract text segments with their colors
 */
function parseAnsiSegments(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = []
  // Match ANSI escape sequences: ESC[ followed by semicolon-separated numbers and ending with 'm'
  const ansiRegex = createAnsiRegex(true)

  let lastIndex = 0
  let currentColor: string | undefined = undefined
  let match: RegExpExecArray | null

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index)
      if (textContent) {
        segments.push({text: textContent, color: currentColor})
      }
    }

    // Parse the escape sequence codes
    const codes = match[1]
      .split(';')
      .map(Number)
      .filter(n => !isNaN(n))

    for (const code of codes) {
      if (code === 0) {
        // Reset
        currentColor = undefined
      } else if (ANSI_TO_COLOR[code]) {
        // Foreground color
        currentColor = ANSI_TO_COLOR[code]
      }
      // Ignore background and style codes (we can't render them)
    }

    lastIndex = ansiRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex)
    if (textContent) {
      segments.push({text: textContent, color: currentColor})
    }
  }

  return segments
}

/**
 * Escape special characters for LaTeX math mode
 */
function escapeForLatex(text: string): string {
  // In LaTeX math mode, we need to escape certain characters
  // and use \text{} for regular text, but for simplicity we'll use \textsf{}
  // Special chars: _ ^ { } \ $ & % # ~
  return text
    .replace(/\\/g, '\\backslash ')
    .replace(/[_^{}$&%#~]/g, char => '\\' + char)
    .replace(/ /g, '\\space ')
    .replace(/\n/g, '\n') // Preserve newlines for later processing
}

/**
 * Convert a single line with ANSI codes to GitHub LaTeX colored markdown
 */
function convertLineToLatex(line: string): string {
  const segments = parseAnsiSegments(line)

  if (segments.length === 0) {
    return line
  }

  // Check if the entire line has no colors
  const hasColors = segments.some(s => s.color)
  if (!hasColors) {
    // Just strip ANSI codes and return plain text
    return segments.map(s => s.text).join('')
  }

  // Build the LaTeX expression
  const parts: string[] = []
  for (const segment of segments) {
    if (!segment.text) continue

    const escapedText = escapeForLatex(segment.text)
    if (segment.color) {
      parts.push(`{\\color{${segment.color}}${escapedText}}`)
    } else {
      parts.push(escapedText)
    }
  }

  // Wrap in $$ for GitHub LaTeX rendering
  return `$$${parts.join('')}$$`
}

/**
 * Check if text contains ANSI escape sequences
 */
export function hasAnsiCodes(text: string): boolean {
  return text.includes(ESC)
}

/**
 * Strip all ANSI escape sequences from text
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(createAnsiRegex(true), '')
}

/**
 * Convert ANSI-colored text to GitHub markdown with LaTeX colors.
 * Each line with colors is wrapped in $$ for LaTeX rendering.
 * Lines without colors are returned as plain text.
 */
export function ansiToGithubLatex(text: string): string {
  if (!hasAnsiCodes(text)) {
    return text
  }

  const lines = text.split('\n')
  const convertedLines = lines.map(line => {
    if (!hasAnsiCodes(line)) {
      return line
    }
    return convertLineToLatex(line)
  })

  return convertedLines.join('\n')
}

/**
 * Convert ANSI-colored text to GitHub markdown, preserving formatting
 * for use outside of code blocks. This escapes markdown special characters
 * in non-colored segments.
 */
export function ansiToMarkdown(text: string): string {
  if (!hasAnsiCodes(text)) {
    return escapeMarkdown(text)
  }

  const lines = text.split('\n')
  const convertedLines = lines.map(line => {
    if (!hasAnsiCodes(line)) {
      return escapeMarkdown(line)
    }

    const segments = parseAnsiSegments(line)
    const hasColors = segments.some(s => s.color)

    if (!hasColors) {
      return escapeMarkdown(segments.map(s => s.text).join(''))
    }

    // Build LaTeX expression for colored line
    const parts: string[] = []
    for (const segment of segments) {
      if (!segment.text) continue

      const escapedText = escapeForLatex(segment.text)
      if (segment.color) {
        parts.push(`{\\color{${segment.color}}${escapedText}}`)
      } else {
        parts.push(escapedText)
      }
    }

    return `$$${parts.join('')}$$`
  })

  return convertedLines.join('\n')
}

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  // Escape characters that have special meaning in markdown
  return text.replace(/([*_`[\]()#>+\-!|\\])/g, '\\$1')
}
