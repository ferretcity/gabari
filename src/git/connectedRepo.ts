import type { Files } from '../likec4/fileKeys'
import type { GitHubRepoRef } from './github'
import type { GitLabRepoRef } from './gitlab'

/** The one repo the app is connected to, if any (only one at a time - see
 * the multi-file/git plan's confirmed scope). `baseFiles` is the project
 * as of the last successful fetch or push, diffed against the live
 * `files` state to compute what a push needs to send. The token lives
 * only here, in memory - never persisted, matching every other credential
 * in this app. */
export type ConnectedRepo =
  | { provider: 'github'; ref: GitHubRepoRef; folder: string; baseFiles: Files }
  | { provider: 'gitlab'; ref: GitLabRepoRef; folder: string; baseFiles: Files }

/** Human-readable "owner/repo"-shaped label for the connected repo, used
 * in the header's repo menu and its tooltip. */
export function connectedRepoLabel(repo: ConnectedRepo): string {
  return repo.provider === 'github' ? `${repo.ref.owner}/${repo.ref.repo}` : repo.ref.projectPath
}

export function connectedRepoProviderName(repo: ConnectedRepo): 'GitHub' | 'GitLab' {
  return repo.provider === 'github' ? 'GitHub' : 'GitLab'
}
