import {DEFAULT_LOCALE} from './utils/node-utils'

export class TestRunResultWithUrl {
  constructor(
    public results: TestRunResult[],
    public checkUrl: string | null
  ) {}

  get hasCheck(): boolean {
    return !!this.checkUrl
  }

  get shouldFail(): boolean {
    return !this.hasCheck && this.results.some(r => r.isFailed)
  }

  get passed(): number {
    return this.results.reduce((sum, g) => sum + g.passed, 0)
  }
  get failed(): number {
    return this.results.reduce((sum, g) => sum + g.failed, 0)
  }
  get skipped(): number {
    return this.results.reduce((sum, g) => sum + g.skipped, 0)
  }
  get time(): number {
    return this.results.reduce((sum, g) => sum + g.time, 0)
  }
}

export class TestRunResult {
  constructor(
    readonly path: string,
    readonly suites: TestSuiteResult[],
    private totalTime?: number
  ) {}

  get tests(): number {
    return this.suites.reduce((sum, g) => sum + g.tests, 0)
  }

  get passed(): number {
    return this.suites.reduce((sum, g) => sum + g.passed, 0)
  }
  get failed(): number {
    return this.suites.reduce((sum, g) => sum + g.failed, 0)
  }
  get skipped(): number {
    return this.suites.reduce((sum, g) => sum + g.skipped, 0)
  }

  get time(): number {
    return this.totalTime ?? this.suites.reduce((sum, g) => sum + g.time, 0)
  }

  get isFailed(): boolean {
    return this.suites.some(t => t.result === 'failed')
  }

  get result(): TestExecutionResult {
    return this.isFailed ? 'failed' : 'success'
  }

  get failedSuites(): TestSuiteResult[] {
    return this.suites.filter(s => s.result === 'failed')
  }

  sort(deep: boolean): void {
    this.suites.sort((a, b) => a.name.localeCompare(b.name, DEFAULT_LOCALE))
    if (deep) {
      for (const suite of this.suites) {
        suite.sort(deep)
      }
    }
  }

  toJSON(): any {
    return {
      path: this.path,
      suites: this.suites,
      time: this.time,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped
    }
  }
}

export class TestSuiteResult {
  constructor(
    readonly name: string,
    readonly groups: TestGroupResult[],
    private totalTime?: number
  ) {
    for (const grp of groups) {
      var map = new Map<string, TestCaseResult[]>()
      for (const tc of grp.tests) {
        var key = tc.id
        var existing = map.get(key) || []
        existing.push(tc)
        map.set(key, existing)
      }

      grp.tests.length = 0

      for (const t of map.values()) {
        grp.tests.push(t[0])
      }
    }
  }

  link?: string

  get tests(): number {
    return this.groups.reduce((sum, g) => sum + g.tests.length, 0)
  }

  get passed(): number {
    return this.groups.reduce((sum, g) => sum + g.passed, 0)
  }
  get failed(): number {
    return this.groups.reduce((sum, g) => sum + g.failed, 0)
  }
  get skipped(): number {
    return this.groups.reduce((sum, g) => sum + g.skipped, 0)
  }
  get time(): number {
    return this.totalTime ?? this.groups.reduce((sum, g) => sum + g.time, 0)
  }

  get result(): TestExecutionResult {
    return this.groups.some(t => t.result === 'failed') ? 'failed' : 'success'
  }

  get failedGroups(): TestGroupResult[] {
    return this.groups.filter(grp => grp.result === 'failed')
  }

  sort(deep: boolean): void {
    this.groups.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', DEFAULT_LOCALE))
    if (deep) {
      for (const grp of this.groups) {
        grp.sort()
      }
    }
  }
}

export class TestGroupResult {
  constructor(
    readonly name: string | undefined | null,
    readonly tests: TestCaseResult[]
  ) {}

  get passed(): number {
    return this.tests.reduce((sum, t) => (t.result === 'success' ? sum + 1 : sum), 0)
  }
  get failed(): number {
    return this.tests.reduce((sum, t) => (t.result === 'failed' ? sum + 1 : sum), 0)
  }
  get skipped(): number {
    return this.tests.reduce((sum, t) => (t.result === 'skipped' ? sum + 1 : sum), 0)
  }
  get time(): number {
    return this.tests.reduce((sum, t) => sum + t.time, 0)
  }

  get result(): TestExecutionResult {
    return this.tests.some(t => t.result === 'failed') ? 'failed' : 'success'
  }

  get failedTests(): TestCaseResult[] {
    return this.tests.filter(tc => tc.result === 'failed')
  }

  sort(): void {
    this.tests.sort((a, b) => a.name.localeCompare(b.name, DEFAULT_LOCALE))
  }
}

export class TestCaseResult {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly result: TestExecutionResult,
    readonly time: number,
    readonly error?: TestCaseError
  ) {}
}

export type TestExecutionResult = 'success' | 'skipped' | 'failed' | undefined

export interface TestCaseError {
  path?: string
  line?: number
  message?: string
  details: string
}
