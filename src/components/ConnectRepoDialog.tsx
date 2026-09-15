import { useEffect, useState } from 'react'
import Modal from './Modal'
import { GitHubIcon, GitLabIcon } from './icons'
import { parseGitHubRepoInput } from '../git/github'
import { parseGitLabProjectInput } from '../git/gitlab'

export interface ConnectGitHubValues {
  owner: string
  repo: string
  branch: string
  folder: string
  token: string
  /** '' for the public github.com; see `git/github.ts`'s `GitHubRepoRef`. */
  server: string
}

export interface LoginGitLabValues {
  clientId: string
  project: string
  branch: string
  folder: string
  /** '' for the public gitlab.com; see `git/gitlabAuth.ts`'s `GitLabConnectIntent`. */
  server: string
}

type PendingConnect =
  | { provider: 'github'; values: ConnectGitHubValues }
  | { provider: 'gitlab'; values: LoginGitLabValues }

function ProviderHeader({ provider }: { provider: 'github' | 'gitlab' }) {
  return (
    <div className="repo-provider-header">
      <span className={'repo-provider-badge ' + provider}>
        {provider === 'github' ? <GitHubIcon /> : <GitLabIcon />}
      </span>
      {provider === 'github' ? 'GitHub' : 'GitLab'}
    </div>
  )
}

/**
 * "Connect Repo" flow: pick a provider, fill in that provider's form,
 * confirm (this always *replaces* the current project's files - see
 * `App.tsx`'s `handleConnectGitHub`/`handleLoginGitLab`, so this step
 * exists specifically to warn before that happens), then a lightweight
 * in-flight step while the parent does the real work. GitHub authenticates
 * with a pasted Personal Access Token (real client-side-only OAuth isn't
 * possible for GitHub - see `git/github.ts`); GitLab authenticates via a
 * client-side OAuth2 PKCE login (no token paste needed, but the connect
 * details are collected here first since they need to survive the
 * redirect to gitlab.com and back - see `git/gitlabAuth.ts`).
 *
 * This whole wizard is one dialog instance across all five steps rather
 * than closing/reopening separate ones - `confirm`/`connecting` need the
 * values already typed into the provider form, and a failed attempt sends
 * the user straight back to that same, still-filled-in form (see the
 * effect below) instead of a blank "Connect Repo…" from scratch.
 */
export default function ConnectRepoDialog({
  busy,
  error,
  onConnectGitHub,
  onLoginGitLab,
  onClose,
}: {
  /** true while the parent is actually connecting (fetching the repo, or
   * exchanging the GitLab OAuth code) - reuses the app's existing global
   * busy flag, already true for the whole duration of that work. */
  busy: boolean
  /** the last connect attempt's failure message, if any - `null` once a
   * fresh attempt starts. Only ever relevant to the GitHub leg in
   * practice (GitLab's failure surfaces after the redirect back, on a
   * fresh page load with no dialog open at all). */
  error: string | null
  onConnectGitHub: (values: ConnectGitHubValues) => void
  onLoginGitLab: (values: LoginGitLabValues) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<'choose' | 'github' | 'gitlab' | 'confirm' | 'connecting'>('choose')
  const [pendingConnect, setPendingConnect] = useState<PendingConnect | null>(null)

  const [ownerRepo, setOwnerRepo] = useState('')
  const [ghBranch, setGhBranch] = useState('')
  const [ghFolder, setGhFolder] = useState('likec4/')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  const [clientId, setClientId] = useState('')
  const [project, setProject] = useState('')
  const [glBranch, setGlBranch] = useState('')
  const [glFolder, setGlFolder] = useState('likec4/')

  // Shared by both provider forms - "using a self-hosted instance?" is
  // closed by default so the common case (public github.com/gitlab.com)
  // looks exactly as short as it always has; opening it reveals the
  // Server URL field. A successful URL-paste parse (below) that carries
  // a non-default host opens it automatically.
  const [showServer, setShowServer] = useState(false)
  const [ghServer, setGhServer] = useState('')
  const [glServer, setGlServer] = useState('')

  // A failed attempt lands back on the same (still-filled-in) form step -
  // only fires while we're actually waiting on one, so it doesn't fight a
  // Back click that already happened. This really is "synchronize with an
  // external system" (the parent's async connect finishing) rather than a
  // value derivable from props during render - `step` is our own
  // persisted state, not a computation of `busy`/`error`.
  useEffect(() => {
    if (!busy && error && step === 'connecting' && pendingConnect) {
      // eslint-disable-next-line react/set-state-in-effect
      setStep(pendingConnect.provider)
    }
  }, [busy, error, step, pendingConnect])

  if (step === 'choose') {
    return (
      <Modal title="Connect repo" onClose={onClose}>
        <div className="form">
          <button type="button" className="repo-provider-card" onClick={() => setStep('github')}>
            <span className="repo-provider-badge github">
              <GitHubIcon />
            </span>
            <span>
              <div className="repo-provider-card-title">GitHub</div>
              <div className="repo-provider-card-desc">Connect with a Personal Access Token</div>
            </span>
          </button>
          <button type="button" className="repo-provider-card" onClick={() => setStep('gitlab')}>
            <span className="repo-provider-badge gitlab">
              <GitLabIcon />
            </span>
            <span>
              <div className="repo-provider-card-title">GitLab</div>
              <div className="repo-provider-card-desc">Log in with GitLab</div>
            </span>
          </button>
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  if (step === 'confirm' && pendingConnect) {
    const branchLabel = pendingConnect.values.branch || 'default branch'
    const label =
      pendingConnect.provider === 'github'
        ? `${pendingConnect.values.owner}/${pendingConnect.values.repo} (${branchLabel})`
        : `${pendingConnect.values.project} (${branchLabel})`
    return (
      <Modal title="Connect repo" onClose={onClose}>
        <div className="form">
          <ProviderHeader provider={pendingConnect.provider} />
          <p style={{ marginTop: 0 }}>
            {pendingConnect.provider === 'gitlab' && (
              <>You'll be sent to GitLab to log in. When you come back, this</>
            )}
            {pendingConnect.provider === 'github' && <>This</>} will replace your current project's files with{' '}
            <strong>"{label}"</strong>'s contents. Anything not pushed elsewhere will be lost.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setStep(pendingConnect.provider)}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (pendingConnect.provider === 'github') onConnectGitHub(pendingConnect.values)
                else onLoginGitLab(pendingConnect.values)
                setStep('connecting')
              }}
            >
              {pendingConnect.provider === 'github' ? 'Connect' : 'Continue to GitLab'}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  if (step === 'connecting' && pendingConnect) {
    return (
      <Modal title="Connect repo" onClose={onClose}>
        <div className="form" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="spinner" aria-hidden="true" />
          <p style={{ margin: 0 }}>
            {pendingConnect.provider === 'github' ? 'Connecting to GitHub…' : 'Redirecting to GitLab…'}
          </p>
        </div>
      </Modal>
    )
  }

  if (step === 'gitlab') {
    const valid = !!clientId.trim() && !!project.trim()
    const projectLooksMalformed = project.trim().length > 0 && !parseGitLabProjectInput(project)
    const onServer = showServer && glServer.trim().length > 0
    return (
      <Modal title="Connect GitLab repo" onClose={onClose}>
        <form
          className="form"
          onSubmit={e => {
            e.preventDefault()
            if (!valid) return
            setPendingConnect({
              provider: 'gitlab',
              values: {
                clientId: clientId.trim(),
                project: project.trim(),
                branch: glBranch.trim(),
                folder: glFolder.trim(),
                server: glServer.trim(),
              },
            })
            setStep('confirm')
          }}
        >
          <ProviderHeader provider="gitlab" />
          {error && (
            <p className="field-hint field-hint-danger" style={{ marginTop: 0 }}>
              {error}
            </p>
          )}
          <label>
            Application ID
            <input
              autoFocus
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="from your GitLab OAuth Application"
              required
            />
          </label>
          <label>
            Project
            <input
              value={project}
              onChange={e => setProject(e.target.value)}
              onBlur={() => {
                const parsed = parseGitLabProjectInput(project)
                if (!parsed) return
                setProject(parsed.project)
                if (parsed.server && !glServer.trim()) {
                  setGlServer(parsed.server)
                  setShowServer(true)
                }
              }}
              placeholder="namespace/project, a numeric id, or a pasted project URL"
              required
            />
            {projectLooksMalformed && (
              <span className="field-hint">Use namespace/project, like mygroup/myproject.</span>
            )}
          </label>
          <label>
            Branch
            <input value={glBranch} onChange={e => setGlBranch(e.target.value)} placeholder="leave blank to use the project's default branch" />
          </label>
          <label>
            Folder
            <input
              value={glFolder}
              onChange={e => setGlFolder(e.target.value)}
              placeholder="likec4/ (leave blank for repo root)"
            />
          </label>
          {showServer ? (
            <label>
              Server
              <input
                value={glServer}
                onChange={e => setGlServer(e.target.value)}
                placeholder="gitlab.mycompany.com (leave blank for gitlab.com)"
              />
              <span className="field-hint">Leave blank to use the public gitlab.com.</span>
            </label>
          ) : (
            <button type="button" className="link-btn" onClick={() => setShowServer(true)}>
              Using a self-hosted GitLab instance?
            </button>
          )}
          <p className="field-hint">
            Needs a GitLab OAuth Application registered as "public" (no client secret){onServer ? ' on that GitLab instance' : ''},
            with this page's exact URL as a redirect URI and the "api" scope. You'll be sent to GitLab to log in,
            then back here automatically.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setStep('choose')}>
              Back
            </button>
            <button type="submit" className="btn btn-primary" disabled={!valid}>
              Continue
            </button>
          </div>
        </form>
      </Modal>
    )
  }

  const parsedRepo = parseGitHubRepoInput(ownerRepo)
  const valid = !!parsedRepo && !!token.trim()
  const repoLooksMalformed = ownerRepo.trim().length > 0 && !parsedRepo

  return (
    <Modal title="Connect GitHub repo" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!valid || !parsedRepo) return
          setPendingConnect({
            provider: 'github',
            values: {
              owner: parsedRepo.owner,
              repo: parsedRepo.repo,
              branch: ghBranch.trim(),
              folder: ghFolder.trim(),
              token: token.trim(),
              server: (ghServer.trim() || parsedRepo.server).trim(),
            },
          })
          setStep('confirm')
        }}
      >
        <ProviderHeader provider="github" />
        {error && (
          <p className="field-hint field-hint-danger" style={{ marginTop: 0 }}>
            {error}
          </p>
        )}
        <label>
          Repository
          <input
            autoFocus
            value={ownerRepo}
            onChange={e => setOwnerRepo(e.target.value)}
            onBlur={() => {
              const parsed = parseGitHubRepoInput(ownerRepo)
              if (!parsed) return
              setOwnerRepo(`${parsed.owner}/${parsed.repo}`)
              if (parsed.server && !ghServer.trim()) {
                setGhServer(parsed.server)
                setShowServer(true)
              }
            }}
            placeholder="owner/repo, or a pasted repo URL"
            required
          />
          {repoLooksMalformed && <span className="field-hint">Use owner/repo, like facebook/react.</span>}
        </label>
        <label>
          Branch
          <input
            value={ghBranch}
            onChange={e => setGhBranch(e.target.value)}
            placeholder="leave blank to use the repo's default branch"
          />
        </label>
        <label>
          Folder
          <input
            value={ghFolder}
            onChange={e => setGhFolder(e.target.value)}
            placeholder="likec4/ (leave blank for repo root)"
          />
        </label>
        <label>
          Personal Access Token
          <div className="field-with-button">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_… (needs repo contents read/write)"
              required
            />
            <button
              type="button"
              className="btn icon-btn-standalone"
              aria-label={showToken ? 'Hide token' : 'Show token'}
              title={showToken ? 'Hide token' : 'Show token'}
              onClick={() => setShowToken(v => !v)}
            >
              {showToken ? '🙈' : '👁'}
            </button>
          </div>
        </label>
        <p className="field-hint">
          Never stored — held in memory for this session only. You'll re-enter it next time you open the app.
        </p>
        {showServer ? (
          <label>
            Server
            <input
              value={ghServer}
              onChange={e => setGhServer(e.target.value)}
              placeholder="github.mycompany.com (leave blank for github.com)"
            />
            <span className="field-hint">GitHub Enterprise Server - leave blank to use the public github.com.</span>
          </label>
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowServer(true)}>
            Using a self-hosted GitHub instance?
          </button>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => setStep('choose')}>
            Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Continue
          </button>
        </div>
      </form>
    </Modal>
  )
}
