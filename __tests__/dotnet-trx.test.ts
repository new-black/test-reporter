import * as fs from 'fs'
import {DotnetTrxParser} from '../src/parsers/dotnet-trx/dotnet-trx-parser'
import {ParseOptions} from '../src/test-parser'
import {LocalFileProvider} from '../src/input-providers/local-file-provider'
import {TestRunResult} from '../src/test-results'
import {groupByDirectory} from '../src/utils/merge-utils'

it('matches report snapshot', async () => {
  const inputProvider = new LocalFileProvider('TestResults', ['./__tests__/fixtures/mssql-suite-test-results/**/*.trx'])
  const opts: ParseOptions = {
    parseErrors: true,
    trackedFiles: []
  }

  const parser = new DotnetTrxParser(opts)
  const input = await inputProvider.load()

  let results: TestRunResult[] = []
  for (const file of input.files) {
    const content = await fs.promises.readFile(file, {encoding: 'utf8'})
    const tr = await parser.parse(file, content)
    results.push(tr)
  }

  results = groupByDirectory(results)
  results.sort((a, b) => a.path.localeCompare(b.path, 'en'))

  expect(results).toMatchSnapshot()
})
