import './sourcemap-register.cjs';/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

var __createBinding = (undefined && undefined.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (undefined && undefined.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (undefined && undefined.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (undefined && undefined.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const local_file_provider_js_1 = require("./input-providers/local-file-provider.js");
const get_annotations_js_1 = require("./report/get-annotations.js");
const get_report_js_1 = require("./report/get-report.js");
const dart_json_parser_js_1 = require("./parsers/dart-json/dart-json-parser.js");
const dotnet_trx_parser_js_1 = require("./parsers/dotnet-trx/dotnet-trx-parser.js");
const java_junit_parser_js_1 = require("./parsers/java-junit/java-junit-parser.js");
const jest_junit_parser_js_1 = require("./parsers/jest-junit/jest-junit-parser.js");
const mocha_json_parser_js_1 = require("./parsers/mocha-json/mocha-json-parser.js");
const path_utils_js_1 = require("./utils/path-utils.js");
const github_utils_js_1 = require("./utils/github-utils.js");
const markdown_utils_js_1 = require("./utils/markdown-utils.js");
const webhook_1 = require("@slack/webhook");
const fs_1 = __importDefault(require("fs"));
//import fetch from 'node-fetch'
const bent_1 = __importDefault(require("bent"));
const process_1 = require("process");
async function main() {
    try {
        const testReporter = new TestReporter();
        await testReporter.run();
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
class TestReporter {
    constructor() {
        this.artifact = core.getInput('artifact', { required: false });
        this.name = core.getInput('name', { required: true });
        this.path = core.getInput('path', { required: true });
        this.pathReplaceBackslashes = core.getInput('path-replace-backslashes', { required: false }) === 'true';
        this.reporter = core.getInput('reporter', { required: true });
        this.listSuites = core.getInput('list-suites', { required: true });
        this.listTests = core.getInput('list-tests', { required: true });
        this.maxAnnotations = parseInt(core.getInput('max-annotations', { required: true }));
        this.failOnError = core.getInput('fail-on-error', { required: true }) === 'true';
        this.workDirInput = core.getInput('working-directory', { required: false });
        this.onlySummary = core.getInput('only-summary', { required: false }) === 'true';
        this.token = core.getInput('token', { required: true });
        this.slackWebhook = core.getInput('slack-url', { required: false });
        this.resultsEndpoint = core.getInput('test-results-endpoint', { required: true });
        this.resultsEndpointSecret = core.getInput('test-results-endpoint-secret', { required: true });
        this.context = (0, github_utils_js_1.getCheckRunContext)();
        this.octokit = github.getOctokit(this.token);
        if (this.listSuites !== 'all' && this.listSuites !== 'failed') {
            core.setFailed(`Input parameter 'list-suites' has invalid value`);
            return;
        }
        if (this.listTests !== 'all' && this.listTests !== 'failed' && this.listTests !== 'none') {
            core.setFailed(`Input parameter 'list-tests' has invalid value`);
            return;
        }
        if (isNaN(this.maxAnnotations) || this.maxAnnotations < 0 || this.maxAnnotations > 50) {
            core.setFailed(`Input parameter 'max-annotations' has invalid value`);
            return;
        }
    }
    async run() {
        if (this.workDirInput) {
            core.info(`Changing directory to '${this.workDirInput}'`);
            process.chdir(this.workDirInput);
        }
        core.info(`Check runs will be created with SHA=${this.context.sha}`);
        // Split path pattern by ',' and optionally convert all backslashes to forward slashes
        // fast-glob (micromatch) always interprets backslashes as escape characters instead of directory separators
        const pathsList = this.path.split(',');
        const pattern = this.pathReplaceBackslashes ? pathsList.map(path_utils_js_1.normalizeFilePath) : pathsList;
        const inputProvider = new local_file_provider_js_1.LocalFileProvider(this.name, pattern);
        const parseErrors = this.maxAnnotations > 0;
        const trackedFiles = await inputProvider.listTrackedFiles();
        const workDir = this.artifact ? undefined : (0, path_utils_js_1.normalizeDirPath)(process.cwd(), true);
        core.info(`Found ${trackedFiles.length} files tracked by GitHub`);
        const options = {
            workDir,
            trackedFiles,
            parseErrors
        };
        core.info(`Using test report parser '${this.reporter}'`);
        const parser = this.getParser(this.reporter, options);
        const results = [];
        const input = await inputProvider.load();
        try {
            const readStream = input.trxZip.toBuffer();
            const version = fs_1.default.existsSync('src/EVA.TestSuite.Core/bin/Release/version.txt')
                ? fs_1.default.readFileSync('src/EVA.TestSuite.Core/bin/Release/version.txt').toString()
                : null;
            const commitID = fs_1.default.existsSync('src/EVA.TestSuite.Core/bin/Release/commit.txt')
                ? fs_1.default.readFileSync('src/EVA.TestSuite.Core/bin/Release/commit.txt').toString()
                : null;
            core.info(`Using EVA version ${version}, commit ${commitID}, current directory: ${(0, process_1.cwd)()}`);
            const post = (0, bent_1.default)(this.resultsEndpoint, 'POST', {}, 200);
            await post(`TestResults?Secret=${this.resultsEndpointSecret}${version ? '&EVAVersion=' + version : ''}${commitID ? '&EVACommitID=' + commitID : ''}`, readStream);
            core.info(`Uploaded TRX files`);
        }
        catch (ex) {
            core.warning(`Could not upload TRX ZIP file: ${ex}`);
        }
        for (const [reportName, files] of Object.entries(input.reports)) {
            try {
                core.startGroup(`Creating test report ${reportName}`);
                const tr = await this.createReport(parser, reportName, files);
                results.push(...tr);
            }
            finally {
                core.endGroup();
            }
        }
        const isFailed = results.some(tr => tr.result === 'failed');
        const conclusion = isFailed ? 'failure' : 'success';
        const passed = results.reduce((sum, tr) => sum + tr.passed, 0);
        const failed = results.reduce((sum, tr) => sum + tr.failed, 0);
        const skipped = results.reduce((sum, tr) => sum + tr.skipped, 0);
        const time = results.reduce((sum, tr) => sum + tr.time, 0);
        core.setOutput('conclusion', conclusion);
        core.setOutput('passed', passed);
        core.setOutput('failed', failed);
        core.setOutput('skipped', skipped);
        core.setOutput('time', time);
        if (this.failOnError && isFailed) {
            core.setFailed(`Failed test were found and 'fail-on-error' option is set to ${this.failOnError}`);
            return;
        }
        if (results.length === 0) {
            core.setFailed(`No test report files were found`);
            return;
        }
    }
    async createReport(parser, name, files) {
        if (files.length === 0) {
            core.warning(`No file matches path ${this.path}`);
            return [];
        }
        const results = [];
        for (const { file, content } of files) {
            core.info(`Processing test results from ${file}`);
            const tr = await parser.parse(file, content);
            results.push(tr);
        }
        core.info(`Creating check run ${name}`);
        const createResp = await this.octokit.rest.checks.create({
            head_sha: this.context.sha,
            name,
            status: 'in_progress',
            output: {
                title: name,
                summary: ''
            },
            ...github.context.repo
        });
        core.info('Creating report summary');
        const { listSuites, listTests, onlySummary } = this;
        const baseUrl = createResp.data.html_url || '';
        const summary = (0, get_report_js_1.getReport)(results, { listSuites, listTests, baseUrl, onlySummary });
        core.info('Creating annotations');
        const annotations = (0, get_annotations_js_1.getAnnotations)(results, this.maxAnnotations);
        const isFailed = results.some(tr => tr.result === 'failed');
        const conclusion = isFailed ? 'failure' : 'success';
        const icon = isFailed ? markdown_utils_js_1.Icon.fail : markdown_utils_js_1.Icon.success;
        core.info(`Updating check run conclusion (${conclusion}) and output`);
        const resp = await this.octokit.rest.checks.update({
            check_run_id: createResp.data.id,
            conclusion,
            status: 'completed',
            output: {
                title: `${name} ${icon}`,
                summary,
                annotations
            },
            ...github.context.repo
        });
        core.info(`Check run create response: ${resp.status}`);
        core.info(`Check run URL: ${resp.data.url}`);
        core.info(`Check run HTML: ${resp.data.html_url}`);
        core.info(`Check run details: ${resp.data.details_url}`);
        if (this.slackWebhook && this.context.branch === 'master') {
            const webhook = new webhook_1.IncomingWebhook(this.slackWebhook);
            const passed = results.reduce((sum, tr) => sum + tr.passed, 0);
            const skipped = results.reduce((sum, tr) => sum + tr.skipped, 0);
            const failed = results.reduce((sum, tr) => sum + tr.failed, 0);
            const req = {
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `:large_green_circle: ${passed} :large_orange_circle: ${skipped} :red_circle: ${failed} <${resp.data.html_url}|(view)>`
                        }
                    }
                ]
            };
            results.map((tr, runIndex) => {
                if (tr.failed === 0)
                    return;
                const runName = tr.path.slice(0, tr.path.indexOf('/TestResults/'));
                req.blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `:red_circle: ${tr.failed} in <${resp.data.html_url}#r${runIndex}|${runName}>`
                    }
                });
            });
            await webhook.send(req);
        }
        return results;
    }
    getParser(reporter, options) {
        switch (reporter) {
            case 'dart-json':
                return new dart_json_parser_js_1.DartJsonParser(options, 'dart');
            case 'dotnet-trx':
                return new dotnet_trx_parser_js_1.DotnetTrxParser(options);
            case 'flutter-json':
                return new dart_json_parser_js_1.DartJsonParser(options, 'flutter');
            case 'java-junit':
                return new java_junit_parser_js_1.JavaJunitParser(options);
            case 'jest-junit':
                return new jest_junit_parser_js_1.JestJunitParser(options);
            case 'mocha-json':
                return new mocha_json_parser_js_1.MochaJsonParser(options);
            default:
                throw new Error(`Input variable 'reporter' is set to invalid value '${reporter}'`);
        }
    }
}
main();


//# sourceMappingURL=index.js.map