import {TestRunResult} from './test-results'

export interface ParseOptions {
  parseErrors: boolean
}

export interface TestParser {
  parse(path: string, content: string): Promise<TestRunResult>
}
