import * as core from '@actions/core'
import * as github from '@actions/github'

export function resolveChecksToken(checksToken: string, token: string): string {
  return checksToken.length > 0 ? checksToken : token
}

export function getCheckRunContext(): {sha: string; branch: string} {
  let branch = github.context.ref
  if (branch.startsWith('refs/heads')) branch = branch.slice(11)
  core.info('Branch: ' + branch)

  if (github.context.payload.pull_request) {
    core.info(`Action was triggered by ${github.context.eventName}: using SHA from head of source branch`)
    const pr = github.context.payload.pull_request
    return {sha: pr.head.sha, branch}
  }

  return {sha: github.context.sha, branch}
}
