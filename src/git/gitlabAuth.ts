/**
 * Client-side-only OAuth2 PKCE login against GitLab - the one provider
 * where this is genuinely possible without a server: a "public" (non-
 * confidential) Application registration never uses a client secret, and
 * GitLab's token endpoint has open CORS (confirmed against GitLab's own
 * OAuth2 docs and Decap CMS's GitLab backend docs, which use the same
 * flow). GitHub cannot do this - see `github.ts`'s doc comment.
 *
 * The one place this touches storage at all: the PKCE `code_verifier`
 * (and a CSRF `state`) must survive the full-page redirect out to
 * gitlab.com and back, which clears all JS memory - so they're stashed in
 * `sessionStorage` for that round-trip and deleted immediately after the
 * exchange completes, one way or another. This is a short-lived, single-
 * use nonce, not a credential - the resulting access token itself is never
 * written to any storage, matching every other credential in this app.
 */

import { normalizeServerUrl } from './serverUrl'

const SESSION_KEY = 'gabari:gitlab-oauth-pending'

/** What the user was trying to connect to before being sent off to
 * gitlab.com (or a self-managed instance) - carried through the redirect
 * alongside the PKCE state so the connect can resume automatically once
 * the login completes. */
export interface GitLabConnectIntent {
  project: string
  branch: string
  folder: string
  /** '' for the public gitlab.com; otherwise a self-managed GitLab host -
   * both the OAuth authorize/token endpoints and the eventual API calls
   * (see `gitlab.ts`'s `apiBase`) live on this same host. */
  serverUrl: string
}

/** The OAuth root for a given intent's server - gitlab.com by default,
 * or the normalized self-managed host. Distinct from `gitlab.ts`'s
 * `apiBase` (which appends `/api/v4`): OAuth endpoints live at the plain
 * host root (`/oauth/authorize`, `/oauth/token`), not under the API. */
function oauthBase(serverUrl: string): string {
  return normalizeServerUrl(serverUrl) || 'https://gitlab.com'
}

interface PendingLogin extends GitLabConnectIntent {
  verifier: string
  state: string
  clientId: string
  redirectUri: string
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  let binary = ''
  for (const b of new Uint8Array(digest)) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Redirect the browser to GitLab's authorize endpoint to begin login,
 * stashing everything needed to resume the connect (and validate the
 * callback) once the user comes back. Never returns (navigates away). */
export async function beginLogin(
  clientId: string,
  redirectUri: string,
  intent: GitLabConnectIntent,
): Promise<void> {
  const verifier = randomHex(32) // 64 hex chars - within PKCE's required 43-128
  const state = randomHex(16)
  const challenge = await sha256Base64Url(verifier)

  const pending: PendingLogin = { ...intent, verifier, state, clientId, redirectUri }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending))

  const url = new URL(`${oauthBase(intent.serverUrl)}/oauth/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  url.searchParams.set('scope', 'api')
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  window.location.assign(url.toString())
}

/**
 * Called once on app mount: if the URL carries a GitLab OAuth callback
 * (`?code=...&state=...`) matching a login this tab began, exchange the
 * code for an access token and return it along with the original connect
 * intent. Returns `null` if there's no callback to complete (the common
 * case - a normal load). Always clears the pending sessionStorage entry
 * once it's been read, whether or not the exchange succeeds, since it's
 * single-use either way.
 */
export async function completeLogin(): Promise<(GitLabConnectIntent & { clientId: string; token: string }) | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return null

  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  sessionStorage.removeItem(SESSION_KEY)

  let pending: PendingLogin
  try {
    pending = JSON.parse(raw)
  } catch {
    throw new Error('GitLab login could not be completed (lost local state) - please try connecting again.')
  }
  if (pending.state !== state) {
    throw new Error('GitLab login state did not match - please try connecting again.')
  }

  const res = await fetch(`${oauthBase(pending.serverUrl)}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: pending.clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
    }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      if (body?.error_description) detail = `: ${body.error_description}`
    } catch {
      // response wasn't JSON - no extra detail available
    }
    throw new Error(`GitLab login failed (${res.status})${detail}`)
  }
  const json = await res.json()
  if (typeof json.access_token !== 'string') {
    throw new Error('GitLab login response was missing an access token')
  }
  return {
    project: pending.project,
    branch: pending.branch,
    folder: pending.folder,
    serverUrl: pending.serverUrl,
    clientId: pending.clientId,
    token: json.access_token,
  }
}
