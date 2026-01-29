import * as core from '@actions/core'
import * as github from '@actions/github'

export function getCheckRunContext(): {sha: string; runId: number; branch: string} {
  let branch = github.context.ref
  if (branch.startsWith('refs/heads')) branch = branch.slice(11)
  core.info('Branch: ' + branch)

  if (github.context.eventName === 'workflow_run') {
    core.info('Action was triggered by workflow_run: using SHA and RUN_ID from triggering workflow')
    const event = github.context.payload
    if (!event.workflow_run) {
      throw new Error("Event of type 'workflow_run' is missing 'workflow_run' field")
    }
    return {
      sha: event.workflow_run.head_commit.id,
      runId: event.workflow_run.id,
      branch
    }
  }

  const runId = github.context.runId
  if (github.context.payload.pull_request) {
    core.info(`Action was triggered by ${github.context.eventName}: using SHA from head of source branch`)
    const pr = github.context.payload.pull_request
    return {sha: pr.head.sha, runId, branch}
  }

  return {sha: github.context.sha, runId, branch}
}
