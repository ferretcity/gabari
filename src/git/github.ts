/**
 * Minimal GitHub REST client for reading/writing a folder of LikeC4 files.
 * Authenticates with a pasted Personal Access Token (never persisted - see
 * `App.tsx`'s `connectedRepo` state) since real client-side-only OAuth is
 * not possible for GitHub: its token-exchange endpoint requires
 * `client_secret` unconditionally and has no CORS support, confirmed
 * directly from GitHub's own OAuth Apps docs - a server-side relay would be
 * required, which this app deliberately doesn't have. The data-plane REST
 * API used here (Contents API, Git Data API) has open CORS, so all of this
 * runs straight from the browser.
 */

import type { Files } from '../likec4/fileKeys'
import { isProjectFile, normalizeFolder, decodeBase64Utf8 } from './projectFiles'
import type { FileDiff } from './diffFiles'
import { normalizeServerUrl } from './serverUrl'

export interface GitHubRepoRef {
  owner: string
  repo: string
  branch: string
  token: string
  /** '' for the public github.com; otherwise a GitHub Enterprise Server
   * host (e.g. "github.mycompany.com" or a full URL) - see `apiBase`. */
  serverUrl: string
}

class GitHubApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** GitHub Enterprise Server's API lives under `/api/v3` on the same host
 * as the web UI (unlike github.com, whose API is a wholly separate host,
 * api.github.com) - the one GitHub-specific wrinkle `serverUrl.ts` can't
 * know about. Guards against double-suffixing if the user pasted the
 * exact API URL themselves. */
function apiBase(ref: Pick<GitHubRepoRef, 'serverUrl'>): string {
  const server = normalizeServerUrl(ref.serverUrl)
  if (!server) return 'https://api.github.com'
  return /\/api\/v3$/.test(server) ? server : `${server}/api/v3`
}

async function ghFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (init?.body) headers['Content-Type'] = 'application/json'
  Object.assign(headers, init?.headers as Record<string, string> | undefined)
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      if (body?.message) detail = `: ${body.message}`
    } catch {
      // response wasn't JSON - no extra detail available
    }
    throw new GitHubApiError(res.status, `GitHub API error ${res.status}${detail}`)
  }
  return res
}

/** List every LikeC4-relevant file path (repo-root-relative) under
 * `folder` on `ref.branch` - resolves branch -> commit -> tree, since
 * GitHub has no simple recursive-listing-by-path endpoint. */
export async function listFiles(ref: GitHubRepoRef, folder: string): Promise<string[]> {
  const { owner, repo, branch, token } = ref
  const base = apiBase(ref)
  const refRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token)
  const refJson = await refRes.json()
  const commitRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/commits/${refJson.object.sha}`, token)
  const commitJson = await commitRes.json()
  const treeRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/trees/${commitJson.tree.sha}?recursive=1`, token)
  const treeJson = await treeRes.json()
  if (treeJson.truncated) {
    throw new Error(
      `"${owner}/${repo}" has too many files for GitHub to list in one request. Try connecting a narrower folder.`,
    )
  }
  const prefix = normalizeFolder(folder)
  return (treeJson.tree as Array<{ path: string; type: string }>)
    .filter(entry => entry.type === 'blob' && entry.path.startsWith(prefix) && isProjectFile(entry.path))
    .map(entry => entry.path)
}

/** Read one file's text content (repo-root-relative `path`) via the
 * Contents API. */
export async function readFile(ref: GitHubRepoRef, path: string): Promise<string> {
  const { owner, repo, branch, token } = ref
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const res = await ghFetch(
    `${apiBase(ref)}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    token,
  )
  const json = await res.json()
  if (json.encoding !== 'base64' || typeof json.content !== 'string') {
    throw new Error(`Unexpected response reading "${path}" from GitHub`)
  }
  return decodeBase64Utf8(json.content)
}

/** Fetch every LikeC4 file under `folder`, keyed relative to it (matching
 * this app's in-memory `files` shape). */
export async function fetchProject(ref: GitHubRepoRef, folder: string): Promise<Files> {
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
 * Commit `changes` to `folder` on `ref.branch` in a single new commit, via
 * the full Git Data API dance (GitHub has no atomic multi-file commit
 * shortcut, unlike GitLab): blobs for each changed file -> a new tree
 * layered on the current one -> a new commit -> a fast-forward update of
 * the branch ref. Throws a clear conflict error if the branch moved since
 * the caller last fetched (rather than force-pushing over it).
 */
export async function commitChanges(
  ref: GitHubRepoRef,
  folder: string,
  changes: FileDiff,
  message: string,
): Promise<void> {
  const { owner, repo, branch, token } = ref
  const base = apiBase(ref)
  const prefix = normalizeFolder(folder)
  // GitHub's Git Data API doesn't distinguish create vs update (a blob
  // just replaces whatever's at that tree path, or adds it) - unlike
  // GitLab, so created/updated can be handled identically here.
  const addedEntries = [...Object.entries(changes.created), ...Object.entries(changes.updated)]
  if (!addedEntries.length && !changes.deleted.length) return

  const refRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token)
  const refJson = await refRes.json()
  const parentSha: string = refJson.object.sha

  const parentCommitRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/commits/${parentSha}`, token)
  const parentCommitJson = await parentCommitRes.json()
  const baseTreeSha: string = parentCommitJson.tree.sha

  const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = []
  for (const [key, text] of addedEntries) {
    const blobRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/blobs`, token, {
      method: 'POST',
      body: JSON.stringify({ content: text, encoding: 'utf-8' }),
    })
    const blobJson = await blobRes.json()
    treeEntries.push({ path: prefix + key, mode: '100644', type: 'blob', sha: blobJson.sha })
  }
  for (const key of changes.deleted) {
    treeEntries.push({ path: prefix + key, mode: '100644', type: 'blob', sha: null })
  }

  const treeRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  })
  const treeJson = await treeRes.json()

  const commitRes = await ghFetch(`${base}/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeJson.sha, parents: [parentSha] }),
  })
  const commitJson = await commitRes.json()

  try {
    await ghFetch(`${base}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitJson.sha, force: false }),
    })
  } catch (err) {
    if (err instanceof GitHubApiError && (err.status === 422 || err.status === 409)) {
      throw new Error(
        `"${branch}" has moved since you last fetched — someone else pushed in the meantime. Pull latest from the File menu before pushing again.`,
      )
    }
    throw err
  }
}

/** The repo's actual default branch (`GET /repos/{owner}/{repo}` →
 * `.default_branch`) - used when the connect form's Branch field is left
 * blank, instead of asking the user to know or guess it (a repo using
 * "master", or any other non-"main" default, is a common source of a
 * silently-wrong connect otherwise). */
export async function getDefaultBranch(ref: Pick<GitHubRepoRef, 'owner' | 'repo' | 'token' | 'serverUrl'>): Promise<string> {
  const { owner, repo, token } = ref
  const res = await ghFetch(`${apiBase(ref)}/repos/${owner}/${repo}`, token)
  const json = await res.json()
  if (typeof json.default_branch !== 'string') {
    throw new Error(`Could not determine "${owner}/${repo}"'s default branch - enter one explicitly.`)
  }
  return json.default_branch
}

/** Parses either a bare `owner/repo` or a full repo URL (any host, GitHub
 * Enterprise Server included; a trailing `.git`/`/` is tolerated) pasted
 * into the Repository field - so pasting the browser's own address bar
 * contents "just works" instead of failing form validation silently.
 * `server` is `''` when the host is github.com (or no host was present
 * at all, i.e. a bare `owner/repo`), signaling "use the public API". */
export function parseGitHubRepoInput(input: string): { server: string; owner: string; repo: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const urlMatch = trimmed.match(/^(?:https?:\/\/)?([^/\s]+)\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/)
  if (urlMatch) {
    const [, host, owner, repo] = urlMatch
    return { server: /^(www\.)?github\.com$/i.test(host) ? '' : host, owner, repo }
  }

  const bareMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/)
  if (bareMatch) {
    const [, owner, repo] = bareMatch
    return { server: '', owner, repo }
  }

  return null
}
