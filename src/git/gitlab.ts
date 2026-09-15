/**
 * Minimal GitLab REST (v4) client for reading/writing a folder of LikeC4
 * files. Authenticates with an access token obtained via client-side-only
 * OAuth2 PKCE (see `gitlabAuth.ts`) - unlike GitHub, GitLab genuinely
 * supports this with no server anywhere. Needs an `api`-scoped token (not
 * `read_repository`/`write_repository`, which are Git-over-HTTP-only and
 * not usable against this REST API).
 */

import type { Files } from '../likec4/fileKeys'
import { isProjectFile, normalizeFolder, decodeBase64Utf8 } from './projectFiles'
import type { FileDiff } from './diffFiles'
import { normalizeServerUrl } from './serverUrl'

export interface GitLabRepoRef {
  /** "namespace/project" path, or a numeric project id - either works */
  projectPath: string
  branch: string
  token: string
  /** '' for the public gitlab.com; otherwise a self-managed GitLab host
   * (e.g. "gitlab.mycompany.com" or a full URL) - see `apiBase`. */
  serverUrl: string
}

/** Unlike GitHub, GitLab's API path convention (`/api/v4`) is identical
 * between gitlab.com and a self-managed instance - just swap the host. */
function apiBase(ref: Pick<GitLabRepoRef, 'serverUrl'>): string {
  const server = normalizeServerUrl(ref.serverUrl)
  if (!server) return 'https://gitlab.com/api/v4'
  return /\/api\/v4$/.test(server) ? server : `${server}/api/v4`
}

/** GitLab's API addresses a project by path or id in one URL segment -
 * a "namespace/project" path must be percent-encoded as a whole (its own
 * `/` included), while a numeric id passes straight through. */
function projectSegment(projectPath: string): string {
  return /^\d+$/.test(projectPath) ? projectPath : encodeURIComponent(projectPath)
}

class GitLabApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function glFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (init?.body) headers['Content-Type'] = 'application/json'
  Object.assign(headers, init?.headers as Record<string, string> | undefined)
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      if (body?.message) detail = `: ${typeof body.message === 'string' ? body.message : JSON.stringify(body.message)}`
      else if (body?.error_description) detail = `: ${body.error_description}`
    } catch {
      // response wasn't JSON - no extra detail available
    }
    throw new GitLabApiError(res.status, `GitLab API error ${res.status}${detail}`)
  }
  return res
}

/** List every LikeC4-relevant file path (repo-root-relative) under
 * `folder` on `ref.branch`. Unlike GitHub, GitLab's tree endpoint filters
 * to a given `path` server-side, and paginates via response headers. */
export async function listFiles(ref: GitLabRepoRef, folder: string): Promise<string[]> {
  const { projectPath, branch, token } = ref
  const prefix = normalizeFolder(folder)
  const paths: string[] = []
  let page = 1
  for (;;) {
    const url = new URL(`${apiBase(ref)}/projects/${projectSegment(projectPath)}/repository/tree`)
    url.searchParams.set('recursive', 'true')
    url.searchParams.set('ref', branch)
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    if (prefix) url.searchParams.set('path', prefix.replace(/\/$/, ''))
    const res = await glFetch(url.toString(), token)
    const json = (await res.json()) as Array<{ path: string; type: string }>
    for (const entry of json) {
      if (entry.type === 'blob' && isProjectFile(entry.path)) paths.push(entry.path)
    }
    const nextPage = res.headers.get('x-next-page')
    if (!nextPage) break
    page = Number(nextPage)
  }
  return paths
}

/** Read one file's text content (repo-root-relative `path`) via the
 * Repository Files API. */
export async function readFile(ref: GitLabRepoRef, path: string): Promise<string> {
  const { projectPath, branch, token } = ref
  const res = await glFetch(
    `${apiBase(ref)}/projects/${projectSegment(projectPath)}/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    token,
  )
  const json = await res.json()
  if (json.encoding !== 'base64' || typeof json.content !== 'string') {
    throw new Error(`Unexpected response reading "${path}" from GitLab`)
  }
  return decodeBase64Utf8(json.content)
}

/** Fetch every LikeC4 file under `folder`, keyed relative to it (matching
 * this app's in-memory `files` shape). */
export async function fetchProject(ref: GitLabRepoRef, folder: string): Promise<Files> {
  const paths = await listFiles(ref, folder)
  if (!paths.length) {
    throw new Error(`No LikeC4 files found under "${folder || '/'}" on branch "${ref.branch}"`)
  }
  const prefix = normalizeFolder(folder)
  const entries = await Promise.all(
    paths.map(async path => [path.slice(prefix.length), await readFile(ref, path)] as const),
  )
  return Object.fromEntries(entries)
}

/**
 * Commit `changes` to `folder` on `ref.branch` in a single atomic call -
 * GitLab's Commits API takes a list of file actions and applies them as
 * one commit server-side, no separate blob/tree/ref dance needed (unlike
 * GitHub). `create` and `update` are used precisely (not just "added"),
 * since GitLab's API errors if the wrong one is used for a given path.
 */
export async function commitChanges(ref: GitLabRepoRef, folder: string, changes: FileDiff, message: string): Promise<void> {
  const { projectPath, branch, token } = ref
  const prefix = normalizeFolder(folder)
  const actions: Array<{ action: string; file_path: string; content?: string }> = []
  for (const [key, text] of Object.entries(changes.created)) {
    actions.push({ action: 'create', file_path: prefix + key, content: text })
  }
  for (const [key, text] of Object.entries(changes.updated)) {
    actions.push({ action: 'update', file_path: prefix + key, content: text })
  }
  for (const key of changes.deleted) {
    actions.push({ action: 'delete', file_path: prefix + key })
  }
  if (!actions.length) return

  await glFetch(`${apiBase(ref)}/projects/${projectSegment(projectPath)}/repository/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ branch, commit_message: message, actions }),
  })
}

/** The project's actual default branch (`GET /projects/{id}` →
 * `.default_branch`) - used when the connect form's Branch field is left
 * blank, same reasoning as `github.ts`'s `getDefaultBranch`. */
export async function getDefaultBranch(ref: Pick<GitLabRepoRef, 'projectPath' | 'token' | 'serverUrl'>): Promise<string> {
  const { projectPath, token } = ref
  const res = await glFetch(`${apiBase(ref)}/projects/${projectSegment(projectPath)}`, token)
  const json = await res.json()
  if (typeof json.default_branch !== 'string') {
    throw new Error(`Could not determine "${projectPath}"'s default branch - enter one explicitly.`)
  }
  return json.default_branch
}

/** Parses a pasted GitLab project URL (any host, self-managed included)
 * into `{ server, project }` - handles nested subgroups
 * (`group/subgroup/project`), a trailing `.git`, and GitLab's own `/-/`
 * separator for tree/blob/branch page URLs (e.g.
 * ".../group/project/-/tree/main" -> "group/project"). A bare
 * "namespace/project" (or deeper "namespace/subgroup/project") path or a
 * numeric id passes through unchanged (`server: ''`), matching today's
 * behavior exactly - unlike GitHub's always-two-segments "owner/repo",
 * GitLab paths have unbounded depth, so "is this a URL?" can't be told
 * from segment count alone; it's a URL only with an explicit protocol or
 * a domain-shaped first segment (contains a "."). */
export function parseGitLabProjectInput(input: string): { server: string; project: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const hasProtocol = /^https?:\/\//i.test(trimmed)
  const firstSegment = trimmed.replace(/^https?:\/\//i, '').split('/')[0]
  if (!hasProtocol && !firstSegment.includes('.')) {
    // A typed project path (or numeric id), not a pasted URL - unchanged.
    return /\s/.test(trimmed) ? null : { server: '', project: trimmed.replace(/\/+$/, '') }
  }

  const match = trimmed.match(/^(?:https?:\/\/)?([^/\s]+)\/(.+)$/)
  if (!match) return null
  const [, host, rest] = match
  const project = rest
    .split('/-/')[0] // drop GitLab's tree/blob/branch page suffix
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
  if (!project) return null
  return { server: /^(www\.)?gitlab\.com$/i.test(host) ? '' : host, project }
}
