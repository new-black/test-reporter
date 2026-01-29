import * as core from '@actions/core'
import {DEFAULT_LOCALE} from '../utils/node-utils'
import {TestExecutionResult, TestRunResult, TestSuiteResult} from '../test-results'
import {Align, formatTime, Icon, link, table} from '../utils/markdown-utils'
import {getFirstNonEmptyLine} from '../utils/parse-utils'
import {slug} from '../utils/slugger'
import path from 'path'

const MAX_REPORT_LENGTH = 65535

export interface ReportOptions {
  listSuites: 'all' | 'failed'
  listTests: 'all' | 'failed' | 'none'
  baseUrl: string
  onlySummary: boolean
}

const defaultOptions: ReportOptions = {
  listSuites: 'all',
  listTests: 'all',
  baseUrl: '',
  onlySummary: false
}

export function getReport(results: TestRunResult[], options: ReportOptions = defaultOptions): string {
  core.info('Generating check run summary')

  applySort(results)

  const opts = {...options}
  let lines = renderReport(results, opts)
  let report = lines.join('\n')

  if (getByteLength(report) <= MAX_REPORT_LENGTH) {
    return report
  }

  if (opts.listTests === 'all') {
    core.info("Test report summary is too big - setting 'listTests' to 'failed'")
    opts.listTests = 'failed'
    lines = renderReport(results, opts)
    report = lines.join('\n')
    if (getByteLength(report) <= MAX_REPORT_LENGTH) {
      return report
    }
  }

  if (opts.listSuites === 'all') {
    core.info("Test report summary is too big - setting 'listSuites' to 'failed'")
    opts.listSuites = 'failed'
    lines = renderReport(results, opts)
    report = lines.join('\n')
    if (getByteLength(report) <= MAX_REPORT_LENGTH) {
      return report
    }
  }

  core.warning(`Test report summary exceeded limit of ${MAX_REPORT_LENGTH} bytes and will be trimmed`)
  return trimReport(lines)
}

function trimReport(lines: string[]): string {
  const closingBlock = '```'
  const errorMsg = `**Report exceeded GitHub limit of ${MAX_REPORT_LENGTH} bytes and has been trimmed**`
  const maxErrorMsgLength = closingBlock.length + errorMsg.length + 2
  const maxReportLength = MAX_REPORT_LENGTH - maxErrorMsgLength

  let reportLength = 0
  let codeBlock = false
  let endLineIndex = 0
  for (endLineIndex = 0; endLineIndex < lines.length; endLineIndex++) {
    const line = lines[endLineIndex]
    const lineLength = getByteLength(line)

    reportLength += lineLength + 1
    if (reportLength > maxReportLength) {
      break
    }

    if (line === '```') {
      codeBlock = !codeBlock
    }
  }

  const reportLines = lines.slice(0, endLineIndex)
  if (codeBlock) {
    reportLines.push('```')
  }
  reportLines.push(errorMsg)
  return reportLines.join('\n')
}

function applySort(results: TestRunResult[]): void {
  results.sort((a, b) => a.path.localeCompare(b.path, DEFAULT_LOCALE))
  for (const res of results) {
    res.suites.sort((a, b) => a.name.localeCompare(b.name, DEFAULT_LOCALE))
  }
}

function getByteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}

function renderReport(results: TestRunResult[], options: ReportOptions): string[] {
  const sections: string[] = []
  const badge = getReportBadge(results)
  sections.push(badge)

  // Separate failed and passed runs
  const failedRuns = results.filter(tr => tr.result === 'failed')
  const passedRuns = results.filter(tr => tr.result !== 'failed')
  const hasFailures = failedRuns.length > 0

  if (hasFailures) {
    // Show failed runs first (expanded)
    const failedReport = getTestRunsReport(failedRuns, results, options)
    sections.push(...failedReport)

    // Show passed runs in collapsible section
    if (passedRuns.length > 0) {
      const passedCount = passedRuns.reduce((sum, tr) => sum + tr.passed, 0)
      const passedSuiteCount = passedRuns.reduce((sum, tr) => sum + tr.suites.length, 0)
      sections.push('')
      sections.push(`<details>`)
      sections.push(`<summary>✅ Passed Tests (${passedCount} tests in ${passedSuiteCount} suites)</summary>`)
      sections.push('')
      const passedReport = getTestRunsReport(passedRuns, results, options)
      sections.push(...passedReport)
      sections.push('')
      sections.push(`</details>`)
    }
  } else {
    // No failures - show all runs normally
    const runs = getTestRunsReport(results, results, options)
    sections.push(...runs)
  }

  return sections
}

function getReportBadge(results: TestRunResult[]): string {
  const passed = results.reduce((sum, tr) => sum + tr.passed, 0)
  const skipped = results.reduce((sum, tr) => sum + tr.skipped, 0)
  const failed = results.reduce((sum, tr) => sum + tr.failed, 0)
  return getBadge(passed, failed, skipped)
}

function getBadge(passed: number, failed: number, skipped: number): string {
  const text = []
  if (passed > 0) {
    text.push(`${passed} passed`)
  }
  if (failed > 0) {
    text.push(`${failed} failed`)
  }
  if (skipped > 0) {
    text.push(`${skipped} skipped`)
  }
  const message = text.length > 0 ? text.join(', ') : 'none'

  let color = 'success'
  if (failed > 0) {
    color = 'critical'
  } else if (passed === 0 && failed === 0) {
    color = 'yellow'
  }
  const hint = failed > 0 ? 'Tests failed' : 'Tests passed successfully'
  const uri = encodeURIComponent(`tests-${message}-${color}`)
  return `![${hint}](https://img.shields.io/badge/${uri})`
}

function getTestRunsReport(testRuns: TestRunResult[], allRuns: TestRunResult[], options: ReportOptions): string[] {
  const sections: string[] = []

  // Create a map of test run to its original index in allRuns
  const runIndexMap = new Map<TestRunResult, number>()
  allRuns.forEach((tr, idx) => runIndexMap.set(tr, idx))

  if (testRuns.length > 1 || options.onlySummary) {
    const tableData = testRuns.map(tr => {
      const runIndex = runIndexMap.get(tr) ?? 0
      const time = formatTime(tr.time)
      const name = path.basename(path.dirname(path.dirname(tr.path)))
      const addr = options.baseUrl + makeRunSlug(runIndex).link
      const nameLink = link(name, addr)
      const passed = tr.passed > 0 ? `${tr.passed}${Icon.success}` : ''
      const failed = tr.failed > 0 ? `${tr.failed}${Icon.fail}` : ''
      const skipped = tr.skipped > 0 ? `${tr.skipped}${Icon.skip}` : ''
      return [nameLink, passed, failed, skipped, time]
    })

    const resultsTable = table(
      ['Report', 'Passed', 'Failed', 'Skipped', 'Time'],
      [Align.Left, Align.Right, Align.Right, Align.Right, Align.Right],
      ...tableData
    )
    sections.push(resultsTable)
  }

  if (options.onlySummary === false) {
    const suitesReports = testRuns
      .map(tr => {
        const runIndex = runIndexMap.get(tr) ?? 0
        return getSuitesReport(tr, runIndex, options)
      })
      .flat()
    sections.push(...suitesReports)
  }
  return sections
}

function getSuitesReport(tr: TestRunResult, runIndex: number, options: ReportOptions): string[] {
  const sections: string[] = []

  const trSlug = makeRunSlug(runIndex)
  const name = path.basename(path.dirname(path.dirname(tr.path)))
  const nameLink = `<a id="${trSlug.id}" href="${options.baseUrl + trSlug.link}">${name}</a>`
  const icon = getResultIcon(tr.result)
  sections.push(`## ${icon}\xa0${nameLink}`)

  core.info(`Generating report for ${tr.path}: ${name}`)

  const time = formatTime(tr.time)
  const headingLine2 =
    tr.tests > 0
      ? `**${tr.tests}** tests were completed in **${time}** with **${tr.passed}** passed, **${tr.failed}** failed and **${tr.skipped}** skipped.`
      : 'No tests found'
  sections.push(headingLine2)

  // Split suites into failed and passed
  const failedSuites = tr.suites.filter(s => s.result === 'failed')
  const passedSuites = tr.suites.filter(s => s.result !== 'failed')
  const hasFailedSuites = failedSuites.length > 0

  // Determine which suites to show based on options and failures
  const suitesToShow = options.listSuites === 'failed' ? failedSuites : hasFailedSuites ? failedSuites : tr.suites

  if (suitesToShow.length > 0) {
    sections.push(renderSuitesTable(suitesToShow, tr.suites, name, runIndex, options))
  }

  // Show detailed test results for failed suites
  if (options.listTests !== 'none') {
    const tests = suitesToShow
      .map(ts => {
        const originalIndex = tr.suites.indexOf(ts)
        return getTestsReport(ts, runIndex, originalIndex, options)
      })
      .flat()

    if (tests.length > 1) {
      sections.push(...tests)
    }
  }

  // Show passed suites in collapsed section (only if we have failures and listSuites is 'all')
  if (hasFailedSuites && passedSuites.length > 0 && options.listSuites === 'all') {
    const passedCount = passedSuites.reduce((sum, s) => sum + s.passed, 0)
    sections.push('')
    sections.push('<details>')
    sections.push(`<summary>${Icon.success} ${passedCount} passed tests in ${passedSuites.length} suites</summary>`)
    sections.push('')
    sections.push(renderSuitesTable(passedSuites, tr.suites, name, runIndex, options))
    sections.push('')
    sections.push('</details>')
  }

  return sections
}

function renderSuitesTable(
  suites: TestSuiteResult[],
  allSuites: TestSuiteResult[],
  runName: string,
  runIndex: number,
  options: ReportOptions
): string {
  return table(
    ['Test suite', 'Passed', 'Failed', 'Skipped', 'Time'],
    [Align.Left, Align.Right, Align.Right, Align.Right, Align.Right],
    ...suites.map(s => {
      const suiteIndex = allSuites.indexOf(s)
      const tsTime = formatTime(s.time)
      const tsName = s.name.startsWith(runName) ? s.name.slice(runName.length + 1) : s.name
      const skipLink = options.listTests === 'none' || (options.listTests === 'failed' && s.result !== 'failed')
      s.link = options.baseUrl + makeSuiteSlug(runIndex, suiteIndex).link
      const tsNameLink = skipLink ? tsName : link(tsName, s.link)
      const passed = s.passed > 0 ? `${s.passed}${Icon.success}` : ''
      const failed = s.failed > 0 ? `${s.failed}${Icon.fail}` : ''
      const skipped = s.skipped > 0 ? `${s.skipped}${Icon.skip}` : ''
      return [tsNameLink, passed, failed, skipped, tsTime]
    })
  )
}

function getTestsReport(ts: TestSuiteResult, runIndex: number, suiteIndex: number, options: ReportOptions): string[] {
  if (options.listTests === 'failed' && ts.result !== 'failed') {
    return []
  }
  const groups = ts.groups
  if (groups.length === 0) {
    return []
  }

  const sections: string[] = []

  const tsName = ts.name
  const tsSlug = makeSuiteSlug(runIndex, suiteIndex)
  const tsNameLink = `<a id="${tsSlug.id}" href="${ts.link}">${tsName}</a>`
  const icon = getResultIcon(ts.result)
  sections.push(`### ${icon}\xa0${tsNameLink}`)

  sections.push('```')
  for (const grp of groups) {
    if (grp.name) {
      sections.push(grp.name)
    }
    const space = grp.name ? '  ' : ''
    for (const tc of grp.tests) {
      const result = getResultIcon(tc.result)
      sections.push(`${space}${result} ${tc.name}`)
      if (tc.error) {
        const lines = (tc.error.message ?? getFirstNonEmptyLine(tc.error.details)?.trim())
          ?.split(/\r?\n/g)
          .map(l => '\t' + l)
        if (lines) {
          sections.push(...lines)
        }
      }
    }
  }
  sections.push('```')

  return sections
}

function makeRunSlug(runIndex: number): {id: string; link: string} {
  // use prefix to avoid slug conflicts after escaping the paths
  return slug(`r${runIndex}`)
}

function makeSuiteSlug(runIndex: number, suiteIndex: number): {id: string; link: string} {
  // use prefix to avoid slug conflicts after escaping the paths
  return slug(`r${runIndex}s${suiteIndex}`)
}

function getResultIcon(result: TestExecutionResult): string {
  switch (result) {
    case 'success':
      return Icon.success
    case 'skipped':
      return Icon.skip
    case 'failed':
      return Icon.fail
    default:
      return ''
  }
}
