import {XMLParser} from 'fast-xml-parser'

import {ErrorInfo, Outcome, TrxReport, UnitTest, UnitTestResult} from './dotnet-trx-types'
import {ParseOptions, TestParser} from '../../test-parser'

import {getBasePath, normalizeFilePath} from '../../utils/path-utils'
import {parseIsoDate, parseNetDuration} from '../../utils/parse-utils'

import {
  TestExecutionResult,
  TestRunResult,
  TestSuiteResult,
  TestGroupResult,
  TestCaseResult,
  TestCaseError
} from '../../test-results'

// Elements that should always be parsed as arrays
const arrayElements = [
  'Times',
  'Results',
  'TestDefinitions',
  'UnitTest',
  'UnitTestResult',
  'TestMethod',
  'Output',
  'ErrorInfo',
  'Message',
  'StackTrace'
]

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: '$',
  isArray: (name: string) => arrayElements.includes(name),
  trimValues: true
})

class TestClass {
  constructor(readonly name: string) {}
  readonly tests: Test[] = []
}

class Test {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly outcome: Outcome,
    readonly duration: number,
    readonly error?: ErrorInfo
  ) {}

  get result(): TestExecutionResult {
    switch (this.outcome) {
      case 'Passed':
        return 'success'
      case 'NotExecuted':
        return 'skipped'
      case 'Failed':
        return 'failed'
    }
  }
}

export class DotnetTrxParser implements TestParser {
  assumedWorkDir: string | undefined

  constructor(readonly options: ParseOptions) {}

  async parse(path: string, content: string): Promise<TestRunResult> {
    const trx = this.getTrxReport(path, content)
    const tc = this.getTestClasses(trx)
    const tr = this.getTestRunResult(path, trx, tc)
    tr.sort(true)
    return tr
  }

  private getTrxReport(path: string, content: string): TrxReport {
    try {
      return xmlParser.parse(content) as TrxReport
    } catch (e) {
      throw new Error(`Invalid XML at ${path}\n\n${e}`)
    }
  }

  private getTestClasses(trx: TrxReport): TestClass[] {
    if (trx.TestRun.TestDefinitions === undefined || trx.TestRun.Results === undefined) {
      return []
    }

    const unitTests: {[id: string]: UnitTest} = {}
    for (const td of trx.TestRun.TestDefinitions) {
      for (const ut of td.UnitTest) {
        unitTests[ut.$.id] = ut
      }
    }

    const unitTestsResults = trx.TestRun.Results.flatMap(r => r.UnitTestResult).flatMap(result => ({
      result,
      test: unitTests[result.$.testId]
    }))

    const testClasses: {[name: string]: TestClass} = {}
    for (const r of unitTestsResults) {
      const className = r.test.TestMethod[0].$.className
      let tc = testClasses[className]
      if (tc === undefined) {
        tc = new TestClass(className)
        testClasses[tc.name] = tc
      }

      if (r.result.$.outcome === 'NotExecuted') {
        if (r.result.Output?.length > 0) {
          if (r.result.Output[0].ErrorInfo?.length > 0) {
            const msg = this.getTextContent(r.result.Output[0].ErrorInfo[0].Message)
            if (msg?.trim().match(/it does not belong to this partition/)) {
              continue
            }
          }
        }
      }

      const error = this.getErrorInfo(r.result)
      const durationAttr = r.result.$.duration
      const duration = durationAttr ? parseNetDuration(durationAttr) : 0

      const resultTestName = r.result.$.testName
      const testName =
        resultTestName.startsWith(className) && resultTestName[className.length] === '.'
          ? resultTestName.slice(className.length + 1)
          : resultTestName

      const test = new Test(r.test.$.id, testName, r.result.$.outcome, duration, error)
      tc.tests.push(test)
    }

    const result = Object.values(testClasses)
    return result
  }

  private getTestRunResult(path: string, trx: TrxReport, testClasses: TestClass[]): TestRunResult {
    const times = trx.TestRun.Times[0].$
    const totalTime = parseIsoDate(times.finish).getTime() - parseIsoDate(times.start).getTime()

    const suites = testClasses.map(testClass => {
      const tests = testClass.tests
        .map(test => {
          const error = this.getError(test)

          if (error?.message?.trim().match(/it does not belong to this partition/)) {
            return null
          }

          return new TestCaseResult(test.id, test.name, test.result, test.duration, error)
        })
        .filter(t => t != null)
      const group = new TestGroupResult(null, tests)
      return new TestSuiteResult(testClass.name, [group])
    })

    return new TestRunResult(path, suites, totalTime)
  }

  private getErrorInfo(testResult: UnitTestResult): ErrorInfo | undefined {
    if (testResult.$.outcome !== 'Failed') {
      return undefined
    }

    const output = testResult.Output
    const error = output?.length > 0 && output[0].ErrorInfo?.length > 0 ? output[0].ErrorInfo[0] : undefined
    return error
  }

  // Helper to extract text content - fast-xml-parser may return string directly or in #text
  private getTextContent(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value
    }
    if (Array.isArray(value) && value.length > 0) {
      return this.getTextContent(value[0])
    }
    if (value && typeof value === 'object' && '#text' in value) {
      return (value as {'#text': string})['#text']
    }
    return undefined
  }

  private getError(test: Test): TestCaseError | undefined {
    if (!this.options.parseErrors || !test.error) {
      return undefined
    }

    const error = test.error
    const message = this.getTextContent(error.Message)
    const stackTrace = this.getTextContent(error.StackTrace)

    if (!message || !stackTrace) {
      return undefined
    }

    let path
    let line

    const src = this.exceptionThrowSource(stackTrace)
    if (src) {
      path = src.path
      line = src.line
    }

    return {
      path,
      line,
      message,
      details: `${message}\n${stackTrace}`
    }
  }

  private exceptionThrowSource(stackTrace: string): {path: string; line: number} | undefined {
    const lines = stackTrace.split(/\r*\n/)
    const re = / in (.+):line (\d+)$/
    const {trackedFiles} = this.options

    for (const str of lines) {
      const match = str.match(re)
      if (match !== null) {
        const [_, fileStr, lineStr] = match
        const filePath = normalizeFilePath(fileStr)
        const workDir = this.getWorkDir(filePath)
        if (workDir) {
          const file = filePath.slice(workDir.length)
          if (trackedFiles.includes(file)) {
            const line = parseInt(lineStr)
            return {path: file, line}
          }
        }
      }
    }
  }

  private getWorkDir(path: string): string | undefined {
    return (
      this.options.workDir ??
      this.assumedWorkDir ??
      (this.assumedWorkDir = getBasePath(path, this.options.trackedFiles))
    )
  }
}
