import { useState } from 'react'
import Modal from './Modal'
import type { FileDiff } from '../git/diffFiles'

type DiffRow = { path: string; kind: 'created' | 'updated' | 'deleted' }

function diffRows(diff: FileDiff): DiffRow[] {
  return [
    ...Object.keys(diff.created)
      .sort()
      .map(path => ({ path, kind: 'created' as const })),
    ...Object.keys(diff.updated)
      .sort()
      .map(path => ({ path, kind: 'updated' as const })),
    ...[...diff.deleted].sort().map(path => ({ path, kind: 'deleted' as const })),
  ]
}

const MARKER = { created: '+', updated: '~', deleted: '−' }

/**
 * Commit-message prompt shown before pushing to a connected repo - stays
 * open for the whole push (like `ConnectRepoDialog`'s `'connecting'`
 * step) rather than closing the instant you submit, so a failure (e.g.
 * the branch moved - see `github.ts`'s conflict check) shows inline and
 * leaves the message exactly as typed, ready to retry.
 */
export default function PushDialog({
  defaultMessage,
  repoLabel,
  branch,
  diff,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  defaultMessage: string
  /** e.g. "owner/repo" or a GitLab project path */
  repoLabel: string
  branch: string
  diff: FileDiff
  /** true while the commit is actually in flight */
  busy: boolean
  /** last push attempt's failure, if any */
  error: string | null
  onSubmit: (message: string) => void
  onClose: () => void
}) {
  const [message, setMessage] = useState(defaultMessage)
  const rows = diffRows(diff)

  return (
    <Modal title="Push to repo" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!message.trim() || busy) return
          onSubmit(message.trim())
        }}
      >
        <p style={{ marginTop: 0 }}>
          Pushing to <strong>{repoLabel}</strong> @ <strong>{branch}</strong>
        </p>
        {error && <p className="field-hint field-hint-danger">{error}</p>}
        {rows.length > 0 && (
          <ul className="entity-list push-diff-list">
            {rows.map(row => (
              <li key={row.kind + ':' + row.path} className="entity-row">
                <span className={'push-diff-marker ' + row.kind} aria-hidden="true">
                  {MARKER[row.kind]}
                </span>
                <span className="entity-title" title={row.path}>
                  {row.path}
                </span>
              </li>
            ))}
          </ul>
        )}
        <label>
          Commit message
          <input autoFocus value={message} onChange={e => setMessage(e.target.value)} required disabled={busy} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !message.trim()}>
            {busy ? 'Pushing…' : 'Push'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
