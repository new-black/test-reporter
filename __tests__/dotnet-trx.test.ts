import {DotnetTrxParser} from '../src/parsers/dotnet-trx/dotnet-trx-parser'
import {ParseOptions} from '../src/test-parser'
import {LocalFileProvider} from '../src/input-providers/local-file-provider'
import {TestRunResult, TestRunResultWithUrl} from '../src/test-results'
import {groupByDirectory} from '../src/utils/merge-utils'

it('matches report snapshot', async () => {
  const inputProvider = new LocalFileProvider('TestResults', ['./__tests__/fixtures/mssql-suite-test-results/**/*.trx'])
  const opts: ParseOptions = {
    parseErrors: true,
    trackedFiles: []
  }

  const parser = new DotnetTrxParser(opts)
  const input = await inputProvider.load()

  for (const [reportName, files] of Object.entries(input.reports)) {
    var results: TestRunResult[] = []
    const result: TestRunResultWithUrl = new TestRunResultWithUrl(results, null)
    for (const [reportName, files] of Object.entries(input.reports)) {
      for (const {file, content} of files) {
        const tr = await parser.parse(file, content)
        results.push(tr)
      }

      results = groupByDirectory(results)
      results.sort((a, b) => a.path.localeCompare(b.path, 'en'))
    }
    expect(results).toMatchSnapshot()
  }
})
