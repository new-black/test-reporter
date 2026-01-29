import {
  TestCaseResult,
  TestGroupResult,
  TestSuiteResult,
  TestRunResult,
  TestRunResultWithUrl
} from '../src/test-results'

describe('TestCaseResult', () => {
  it('stores test case properties', () => {
    const tc = new TestCaseResult('id-1', 'test name', 'success', 100)
    expect(tc.id).toBe('id-1')
    expect(tc.name).toBe('test name')
    expect(tc.result).toBe('success')
    expect(tc.time).toBe(100)
    expect(tc.error).toBeUndefined()
  })

  it('stores error information', () => {
    const error = {path: 'file.ts', line: 10, message: 'Error', details: 'Stack trace'}
    const tc = new TestCaseResult('id-1', 'failing test', 'failed', 50, error)
    expect(tc.error).toEqual(error)
  })
})

describe('TestGroupResult', () => {
  const passingTest = new TestCaseResult('1', 'pass', 'success', 10)
  const failingTest = new TestCaseResult('2', 'fail', 'failed', 20)
  const skippedTest = new TestCaseResult('3', 'skip', 'skipped', 0)

  it('counts passed tests', () => {
    const group = new TestGroupResult('group', [passingTest, failingTest, skippedTest])
    expect(group.passed).toBe(1)
  })

  it('counts failed tests', () => {
    const group = new TestGroupResult('group', [passingTest, failingTest, skippedTest])
    expect(group.failed).toBe(1)
  })

  it('counts skipped tests', () => {
    const group = new TestGroupResult('group', [passingTest, failingTest, skippedTest])
    expect(group.skipped).toBe(1)
  })

  it('calculates total time', () => {
    const group = new TestGroupResult('group', [passingTest, failingTest])
    expect(group.time).toBe(30)
  })

  it('returns failed result when any test fails', () => {
    const group = new TestGroupResult('group', [passingTest, failingTest])
    expect(group.result).toBe('failed')
  })

  it('returns success result when no tests fail', () => {
    const group = new TestGroupResult('group', [passingTest, skippedTest])
    expect(group.result).toBe('success')
  })

  it('returns failed tests', () => {
    const group = new TestGroupResult('group', [passingTest, failingTest])
    expect(group.failedTests).toEqual([failingTest])
  })

  it('sorts tests by name', () => {
    const z = new TestCaseResult('1', 'z-test', 'success', 10)
    const a = new TestCaseResult('2', 'a-test', 'success', 10)
    const group = new TestGroupResult('group', [z, a])
    group.sort()
    expect(group.tests[0].name).toBe('a-test')
    expect(group.tests[1].name).toBe('z-test')
  })
})

describe('TestSuiteResult', () => {
  const group1 = new TestGroupResult('group1', [
    new TestCaseResult('1', 'test1', 'success', 10),
    new TestCaseResult('2', 'test2', 'failed', 20)
  ])
  const group2 = new TestGroupResult('group2', [new TestCaseResult('3', 'test3', 'skipped', 0)])

  it('counts total tests', () => {
    const suite = new TestSuiteResult('suite', [group1, group2])
    expect(suite.tests).toBe(3)
  })

  it('aggregates passed/failed/skipped counts', () => {
    const suite = new TestSuiteResult('suite', [group1, group2])
    expect(suite.passed).toBe(1)
    expect(suite.failed).toBe(1)
    expect(suite.skipped).toBe(1)
  })

  it('calculates time from groups', () => {
    const suite = new TestSuiteResult('suite', [group1, group2])
    expect(suite.time).toBe(30)
  })

  it('uses totalTime when provided', () => {
    const suite = new TestSuiteResult('suite', [group1], 100)
    expect(suite.time).toBe(100)
  })

  it('returns failed result when any group fails', () => {
    const suite = new TestSuiteResult('suite', [group1, group2])
    expect(suite.result).toBe('failed')
  })

  it('returns failed groups', () => {
    const suite = new TestSuiteResult('suite', [group1, group2])
    expect(suite.failedGroups).toEqual([group1])
  })

  it('deduplicates tests with same id', () => {
    const dup1 = new TestCaseResult('same-id', 'test', 'success', 10)
    const dup2 = new TestCaseResult('same-id', 'test', 'success', 10)
    const groupWithDups = new TestGroupResult('group', [dup1, dup2])
    const suite = new TestSuiteResult('suite', [groupWithDups])
    expect(suite.tests).toBe(1)
  })
})

describe('TestRunResult', () => {
  const suite1 = new TestSuiteResult('suite1', [
    new TestGroupResult('g1', [new TestCaseResult('1', 't1', 'success', 50)])
  ])
  const suite2 = new TestSuiteResult('suite2', [
    new TestGroupResult('g2', [new TestCaseResult('2', 't2', 'failed', 100)])
  ])

  it('stores path', () => {
    const run = new TestRunResult('/path/to/results.trx', [suite1])
    expect(run.path).toBe('/path/to/results.trx')
  })

  it('aggregates test counts', () => {
    const run = new TestRunResult('/path', [suite1, suite2])
    expect(run.tests).toBe(2)
    expect(run.passed).toBe(1)
    expect(run.failed).toBe(1)
  })

  it('calculates time from suites', () => {
    const run = new TestRunResult('/path', [suite1, suite2])
    expect(run.time).toBe(150)
  })

  it('uses totalTime when provided', () => {
    const run = new TestRunResult('/path', [suite1], 500)
    expect(run.time).toBe(500)
  })

  it('returns failed when any suite fails', () => {
    const run = new TestRunResult('/path', [suite1, suite2])
    expect(run.isFailed).toBe(true)
    expect(run.result).toBe('failed')
  })

  it('returns success when no suites fail', () => {
    const run = new TestRunResult('/path', [suite1])
    expect(run.isFailed).toBe(false)
    expect(run.result).toBe('success')
  })

  it('returns failed suites', () => {
    const run = new TestRunResult('/path', [suite1, suite2])
    expect(run.failedSuites).toEqual([suite2])
  })

  it('serializes to JSON', () => {
    const run = new TestRunResult('/path', [suite1])
    const json = run.toJSON()
    expect(json.path).toBe('/path')
    expect(json.passed).toBe(1)
    expect(json.failed).toBe(0)
    expect(json.skipped).toBe(0)
  })
})

describe('TestRunResultWithUrl', () => {
  const suite = new TestSuiteResult('suite', [new TestGroupResult('g', [new TestCaseResult('1', 't', 'failed', 10)])])
  const run = new TestRunResult('/path', [suite])

  it('tracks check URL', () => {
    const result = new TestRunResultWithUrl([run], 'https://github.com/check/123')
    expect(result.checkUrl).toBe('https://github.com/check/123')
    expect(result.hasCheck).toBe(true)
  })

  it('detects missing check URL', () => {
    const result = new TestRunResultWithUrl([run], null)
    expect(result.hasCheck).toBe(false)
  })

  it('shouldFail when no check and tests failed', () => {
    const result = new TestRunResultWithUrl([run], null)
    expect(result.shouldFail).toBe(true)
  })

  it('should not fail when has check URL', () => {
    const result = new TestRunResultWithUrl([run], 'https://check')
    expect(result.shouldFail).toBe(false)
  })

  it('aggregates counts from all results', () => {
    const run2 = new TestRunResult('/path2', [
      new TestSuiteResult('s2', [new TestGroupResult('g2', [new TestCaseResult('2', 't2', 'success', 20)])])
    ])
    const result = new TestRunResultWithUrl([run, run2], null)
    expect(result.passed).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.time).toBe(30)
  })
})
