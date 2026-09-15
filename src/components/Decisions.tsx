import { useState } from 'react'
import { DECISION_KIND_INFO, type DecisionKind, type DecisionRecord } from '../likec4/decisions'

const KINDS = Object.keys(DECISION_KIND_INFO) as DecisionKind[]

/**
 * The Decisions sidebar panel - list/create/delete only, same trimmed
 * shape as `Disseminate.tsx`: the record itself is edited in the main
 * canvas (see `DecisionEditor.tsx`), not from a side-panel form.
 */
export default function Decisions({
  records,
  activeId,
  onSelectRecord,
  onCreateRecord,
  onDeleteRecord,
}: {
  records: DecisionRecord[]
  activeId: string | null
  onSelectRecord: (path: string | null) => void
  onCreateRecord: (kind: DecisionKind, title: string) => void
  onDeleteRecord: (path: string) => void
}) {
  const [newKind, setNewKind] = useState<DecisionKind>('adr')
  const [newTitle, setNewTitle] = useState('')
  const active = records.find(r => r.path === activeId) ?? null

  if (active) {
    return (
      <div className="sidebar-panel-section">
        <div className="sidebar-section-header">
          <button className="btn btn-sm" onClick={() => onSelectRecord(null)}>
            ← Decisions
          </button>
          <button
            className="icon-btn"
            aria-label="Delete decision"
            title="Delete decision"
            onClick={() => onDeleteRecord(active.path)}
          >
            ✕
          </button>
        </div>
        <h3 style={{ margin: '0 0 4px' }}>{active.id}</h3>
        <p className="empty-hint">{active.title} - edit it directly in the main panel.</p>
      </div>
    )
  }

  return (
    <div className="sidebar-panel-section">
      <div className="sidebar-section-header">
        <h3>Decisions</h3>
      </div>
      {KINDS.map(kind => {
        const inKind = records.filter(r => r.kind === kind)
        return (
          <details key={kind} className="sidebar-section" open>
            <summary className="sidebar-section-header">
              <span className="section-title">
                <span className="chevron" aria-hidden="true">
                  ▸
                </span>
                <h3>{DECISION_KIND_INFO[kind].label}</h3>
              </span>
            </summary>
            <ul className="entity-list">
              {inKind.length === 0 && <li className="empty-hint">None yet</li>}
              {inKind.map(r => (
                <li key={r.path} className="entity-row" onClick={() => onSelectRecord(r.path)}>
                  <span className="entity-kind">{r.id}</span>
                  <span className="entity-title">{r.title}</span>
                  <span className={'decision-status decision-status-' + r.status}>{r.status}</span>
                </li>
              ))}
            </ul>
          </details>
        )
      })}
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!newTitle.trim()) return
          onCreateRecord(newKind, newTitle.trim())
          setNewTitle('')
        }}
      >
        <label>
          New decision
          <select value={newKind} onChange={e => setNewKind(e.target.value as DecisionKind)}>
            {KINDS.map(kind => (
              <option key={kind} value={kind}>
                {DECISION_KIND_INFO[kind].label}
              </option>
            ))}
          </select>
        </label>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Use PostgreSQL for the primary datastore" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!newTitle.trim()}>
          + New
        </button>
      </form>
    </div>
  )
}
