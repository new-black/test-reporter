# Test Reporter

This [Github Action](https://github.com/features/actions) displays .NET test results from TRX files directly in GitHub.

- Parses test results in TRX format and creates a report as a Github Check Run
- Annotates failed tests with the message and stack trace captured during test execution (attached to the test results file)
- Optionally notifies Slack about failures and uploads the TRX files to a test results service

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
      - uses: actions/checkout@v6
      - run: dotnet test --logger "trx;LogFileName=test-results.trx"

      - name: Test Report
        uses: new-black/test-reporter@main
        if: success() || failure()
        with:
          name: .NET Tests
          path: '**/test-results.trx'
```

## Usage

```yaml
- uses: new-black/test-reporter@main
  with:
    # Name of the Check Run which will be created
    name: ''

    # Comma-separated list of paths to test results
    # Supports wildcards via [fast-glob](https://github.com/mrmlnc/fast-glob)
    path: ''

    # Limits which test suites are listed:
    #   all
    #   failed
    list-suites: 'all'

    # Limits which test cases are listed:
    #   all
    #   failed
    list-tests: 'all'

    # Limits number of created annotations with error message and stack trace captured during test execution.
    # Must be less or equal to 50.
    max-annotations: '10'

    # Set action as failed if test report contains any failed test
    fail-on-error: 'true'

    # Set this action as failed if no test results were found
    fail-on-empty: 'true'

    # Personal access token used to interact with Github API
    # Default: ${{ github.token }}
    token: ''

    # Token used only for Checks API calls (creating and updating the check run).
    # Use a GitHub App installation token so the check run is attached to the app's own
    # check suite instead of a workflow's.
    # Default: same as `token`
    checks-token: ''

    # Slack webhook URL for notifications (optional)
    slack-url: ''

    # Branch name to send Slack notifications for (default 'master')
    slack-branch: 'master'

    # Endpoint to upload the matched TRX files to (optional, see "Uploading test results").
    # Must end with a slash, as `TestResults` is appended to it.
    test-results-endpoint: ''

    # Secret used to authenticate against the test results endpoint
    test-results-endpoint-secret: ''

    # Type of test run: integration, auditing, watchtower or watchtower-io
    test-results-type: 'integration'

    # Database type: mssql, yugabyte or postgres
    test-results-db-type: ''
```

## Uploading test results

When `test-results-endpoint` is set, the matched TRX files are zipped and sent with a `POST` to `<test-results-endpoint>TestResults`. The request carries:

- Query parameters `EVABranch`, `Type` (`test-results-type`) and `DbType` (`test-results-db-type`, when set), plus `EVAVersion` and `EVACommitID` when `./metadata/version.txt` and `./metadata/commit.txt` exist
- An `Authorization: Bearer <test-results-endpoint-secret>` header
- On pull requests also the headers `X-GitHub-Token` (the `token` input), `X-PR-Number`, `X-GitHub-Repo` and `X-GitHub-Run-URL`

A failed upload only produces a warning.

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

## GitHub limitations

Unfortunately, there are some known issues and limitations caused by GitHub API:

- Test report (i.e. Check Run summary) is markdown text. No custom styling or HTML is possible.
- Maximum report size is 65535 bytes. Input parameters `list-suites` and `list-tests` will be automatically adjusted if max size is exceeded.
- Test report can't reference any additional files (e.g. screenshots). You can use `actions/upload-artifact@v6` to upload them and inspect them manually.
- Check Runs are created for specific commit SHA. It's not possible to specify under which workflow test report should belong if more workflows are running for the same SHA. As a workaround, pass a GitHub App installation token as `checks-token`: check runs created by an app are attached to that app's own check suite, independent of any workflow.

## License

The scripts and documentation in this project are released under the [MIT License](https://github.com/dorny/test-reporter/blob/main/LICENSE)
