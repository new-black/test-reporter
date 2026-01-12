import * as core from '@actions/core'

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

// Literal escaped representations that may appear in source files
const ESCAPED_ESC_PATTERNS = [
  '\\u001b', // Unicode escape (lowercase)
  '\\u001B', // Unicode escape (uppercase)
  '\\x1b', // Hex escape (lowercase)
  '\\x1B', // Hex escape (uppercase)
  '\\e' // Some systems use \e
]

interface AnsiSegment {
  text: string
  color?: string
}

/**
 * Create regex for matching ANSI escape sequences (after normalization)
 */
function createAnsiRegex(global: boolean): RegExp {
  // eslint-disable-next-line no-control-regex
  return global ? /\x1b\[([0-9;]*)m/g : /\x1b\[([0-9;]*)m/
}

/**
 * Normalize escaped ANSI sequences to actual escape characters.
 * Converts literal strings like "\u001b" to the actual ESC character.
 */
function normalizeEscapeSequences(text: string): string {
  let result = text
  for (const pattern of ESCAPED_ESC_PATTERNS) {
    result = result.split(pattern).join(ESC)
  }
  return result
}

/**
 * Check if text contains ANSI escape sequences (either real or escaped literal form)
 */
export function hasAnsiCodes(text: string): boolean {
  // Check for actual ESC character
  if (text.includes(ESC)) {
    return true
  }
  // Check for literal escaped representations
  for (const pattern of ESCAPED_ESC_PATTERNS) {
    if (text.includes(pattern)) {
      return true
    }
  }
  return false
}

/**
 * Parse ANSI escape sequences and extract text segments with their colors
 */
function parseAnsiSegments(text: string): AnsiSegment[] {
  // First normalize any escaped sequences to actual ESC characters
  const normalizedText = normalizeEscapeSequences(text)

  const segments: AnsiSegment[] = []
  // Match ANSI escape sequences: ESC[ followed by semicolon-separated numbers and ending with 'm'
  const ansiRegex = createAnsiRegex(true)

  let lastIndex = 0
  let currentColor: string | undefined = undefined
  let match: RegExpExecArray | null

  while ((match = ansiRegex.exec(normalizedText)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const textContent = normalizedText.slice(lastIndex, match.index)
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
  if (lastIndex < normalizedText.length) {
    const textContent = normalizedText.slice(lastIndex)
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
 * Strip all ANSI escape sequences from text
 */
export function stripAnsiCodes(text: string): string {
  const normalized = normalizeEscapeSequences(text)
  return normalized.replace(createAnsiRegex(true), '')
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
  core.info('ansiToMarkdown: Processing text for ANSI color conversion')

  if (!hasAnsiCodes(text)) {
    core.info('ansiToMarkdown: No ANSI codes detected in text')
    return escapeMarkdown(text)
  }

  core.info('ansiToMarkdown: ANSI codes detected, converting to LaTeX colors')

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

  core.info(`ansiToMarkdown: Converted ${lines.length} lines`)
  return convertedLines.join('\n')
}

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  // Escape characters that have special meaning in markdown
  return text.replace(/([*_`[\]()#>+\-!|\\])/g, '\\$1')
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Convert ANSI-colored text to HTML with inline color styles.
 * Uses <span style="color:..."> for colored text.
 * Wraps output in <pre> to preserve whitespace and formatting.
 */
export function ansiToHtml(text: string): string {
  core.info('ansiToHtml: Processing text for ANSI color conversion')

  if (!hasAnsiCodes(text)) {
    core.info('ansiToHtml: No ANSI codes detected in text')
    return `<pre>${escapeHtml(text)}</pre>`
  }

  core.info('ansiToHtml: ANSI codes detected, converting to HTML colors')

  const segments = parseAnsiSegments(text)

  const parts: string[] = []
  for (const segment of segments) {
    if (!segment.text) continue

    const escapedText = escapeHtml(segment.text)
    if (segment.color) {
      parts.push(`<span style="color:${segment.color}">${escapedText}</span>`)
    } else {
      parts.push(escapedText)
    }
  }

  core.info(`ansiToHtml: Converted ${segments.length} segments`)
  return `<pre>${parts.join('')}</pre>`
}
