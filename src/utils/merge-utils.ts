import {TestCaseResult, TestGroupResult, TestRunResult, TestSuiteResult} from '../test-results'
import * as core from '@actions/core'
import path from 'path'

function mergeTestRunResults(results: TestRunResult[]): TestRunResult {
  if (results.length === 0) {
    throw new Error('Cannot merge empty array of TestRunResults')
  }
  if (results.length === 1) {
    return results[0]
  }

  // Create a map to group suites by name
  const suitesMap = new Map<string, TestSuiteResult[]>()

  // Collect all suites from all results
  for (const result of results) {
    for (const suite of result.suites) {
      const existingSuites = suitesMap.get(suite.name) || []
      suitesMap.set(suite.name, [...existingSuites, suite])
    }
  }

  // Merge suites with the same name
  const mergedSuites = Array.from(suitesMap.values()).map(suites => {
    if (suites.length === 1) {
      return suites[0]
    }

    // Create a map to group groups by name
    const groupsMap = new Map<string, TestGroupResult[]>()

    // Collect all groups from all suites
    for (const suite of suites) {
      for (const group of suite.groups) {
        const existingGroups = groupsMap.get(group.name ?? '') || []
        groupsMap.set(group.name ?? '', [...existingGroups, group])
      }
    }

    // Merge groups with the same name
    const mergedGroups = Array.from(groupsMap.values()).map(groups => {
      if (groups.length === 1) {
        return groups[0]
      }

      // Create a map to group tests by id
      const testsMap = new Map<string, TestCaseResult[]>()

      // Collect all tests from all groups
      for (const group of groups) {
        for (const test of group.tests) {
          const existingTests = testsMap.get(test.id) || []
          testsMap.set(test.id, [...existingTests, test])
        }
      }

      // Take the first test for each id (assuming they are identical)
      const mergedTests = Array.from(testsMap.values()).map(tests => tests[0])

      // Create new merged group
      return new TestGroupResult(groups[0].name, mergedTests)
    })

    // Create new merged suite
    return new TestSuiteResult(suites[0].name, mergedGroups)
  })

  // Calculate total time from all results
  const totalTime = results.reduce((sum, result) => sum + result.time, 0)

  // Create new merged result
  return new TestRunResult(results[0].path, mergedSuites, totalTime)
}

export function groupByDirectory(results: TestRunResult[]): TestRunResult[] {
  const pathMap = new Map<string, TestRunResult[]>()

  for (const result of results) {
    var dir = path.dirname(result.path)
    core.info(`Grouping test results from ${dir}`)
    const existing = pathMap.get(dir) || []
    pathMap.set(dir, [...existing, result])
  }

  const groupedResults: TestRunResult[] = []

  pathMap.forEach(results => {
    const mergedResult = mergeTestRunResults(results)
    mergedResult.sort(true)
    groupedResults.push(mergedResult)
  })

  return groupedResults
}
