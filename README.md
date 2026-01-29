# Test Reporter

This [Github Action](https://github.com/features/actions) displays .NET test results from TRX files directly in GitHub.

- Parses test results in TRX format and creates a report as a Github Check Run
- Annotates code where it failed based on message and stack trace captured during test execution
- Provides final `conclusion` and counts of `passed`, `failed` and `skipped` tests as output parameters

**How it looks:**
|![](assets/fluent-validation-report.png)|![](assets/provider-error-summary.png)|![](assets/provider-error-details.png)|
|:--:|:--:|:--:|

**Supported frameworks:**
- [xUnit](https://xunit.net/)
- [NUnit](https://nunit.org/)
- [MSTest](https://github.com/Microsoft/testfx-docs)

## Example

```yaml
on:
  pull_request:
  push:
permissions:
  contents: read
  actions: read
  checks: write
jobs:
  build-test:
    name: Build & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --logger "trx;LogFileName=test-results.trx"

      - name: Test Report
        uses: dorny/test-reporter@v1
        if: success() || failure()
        with:
          name: .NET Tests
          path: '**/test-results.trx'
```

## Usage

```yaml
- uses: dorny/test-reporter@v1
  with:
    # Name of the Check Run which will be created
    name: ''

    # Comma-separated list of paths to test results
    # Supports wildcards via [fast-glob](https://github.com/mrmlnc/fast-glob)
    path: ''

    # The fast-glob library that is internally used interprets backslashes as escape characters.
    # If enabled, all backslashes in provided path will be replaced by forward slashes and act as directory separators.
    # It might be useful when path input variable is composed dynamically from existing directory paths on Windows.
    path-replace-backslashes: 'false'

    # Allows you to generate only the summary.
    # If enabled, the report will contain a table listing each test results file and the number of passed, failed, and skipped tests.
    # Detailed listing of test suites and test cases will be skipped.
    only-summary: 'false'

    # Limits which test suites are listed:
    #   all
    #   failed
    list-suites: 'all'

    # Limits which test cases are listed:
    #   all
    #   failed
    #   none
    list-tests: 'all'

    # Limits number of created annotations with error message and stack trace captured during test execution.
    # Must be less or equal to 50.
    max-annotations: '10'

    # Set action as failed if test report contains any failed test
    fail-on-error: 'true'

    # Set this action as failed if no test results were found
    fail-on-empty: 'true'

    # Relative path under $GITHUB_WORKSPACE where the repository was checked out.
    working-directory: ''

    # Personal access token used to interact with Github API
    # Default: ${{ github.token }}
    token: ''

    # Slack webhook URL for notifications (optional)
    slack-url: ''

    # Branch name to send Slack notifications for (default 'master')
    slack-branch: 'master'
```

## Generating TRX files

To get test results in TRX format you can execute your tests with CLI arguments:

```bash
dotnet test --logger "trx;LogFileName=test-results.trx"
```

Or you can configure TRX test output in `*.csproj` or `Directory.Build.props`:

```xml
<PropertyGroup>
  <VSTestLogger>trx%3bLogFileName=$(MSBuildProjectName).trx</VSTestLogger>
  <VSTestResultsDirectory>$(MSBuildThisFileDirectory)/TestResults/$(TargetFramework)</VSTestResultsDirectory>
</PropertyGroup>
```

For more information see [dotnet test](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-test#examples)

## Output parameters

| Name       | Description              |
| :--        | :--                      |
| conclusion | `success` or `failure`   |
| passed     | Count of passed tests    |
| failed     | Count of failed tests    |
| skipped    | Count of skipped tests   |
| time       | Test execution time [ms] |
| url        | Check run URL            |
| url_html   | Check run URL HTML       |

## GitHub limitations

Unfortunately, there are some known issues and limitations caused by GitHub API:

- Test report (i.e. Check Run summary) is markdown text. No custom styling or HTML is possible.
- Maximum report size is 65535 bytes. Input parameters `list-suites` and `list-tests` will be automatically adjusted if max size is exceeded.
- Test report can't reference any additional files (e.g. screenshots). You can use `actions/upload-artifact@v4` to upload them and inspect them manually.
- Check Runs are created for specific commit SHA. It's not possible to specify under which workflow test report should belong if more workflows are running for the same SHA.

## License

The scripts and documentation in this project are released under the [MIT License](https://github.com/dorny/test-reporter/blob/main/LICENSE)
