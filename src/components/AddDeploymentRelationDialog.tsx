import { useState } from 'react'
import Modal from './Modal'
import type { DeploymentInstanceSummary, DeploymentNodeSummary } from '../likec4/engine'

export interface AddDeploymentRelationValues {
  sourceFqn: string
  targetFqn: string
  title: string
  kind: string | null
}

export default function AddDeploymentRelationDialog({
  nodes,
  instances,
  /** deployment relations share the same `relationship` kind namespace as
   * model relations - no separate spec category needed */
  relationshipKinds,
  defaultSource,
  defaultTarget,
  onSubmit,
  onClose,
}: {
  nodes: DeploymentNodeSummary[]
  instances: DeploymentInstanceSummary[]
  relationshipKinds: string[]
  /** pre-filled from connect-mode (clicking a node, then another, on a
   * deployment view's canvas) - same flow as `AddRelationDialog`'s */
  defaultSource?: string
  defaultTarget?: string
  onSubmit: (values: AddDeploymentRelationValues) => void
  onClose: () => void
}) {
  const options: { id: string; label: string }[] = [
    ...nodes.map(n => ({ id: n.id, label: n.title || n.id })),
    ...instances.map(i => ({ id: i.id, label: `${i.title || i.id} (${i.elementFqn})` })),
  ]
  const [sourceFqn, setSourceFqn] = useState(defaultSource ?? options[0]?.id ?? '')
  const [targetFqn, setTargetFqn] = useState(defaultTarget ?? options[1]?.id ?? options[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('')

  return (
    <Modal title="Add deployment relationship" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!sourceFqn || !targetFqn) return
          onSubmit({ sourceFqn, targetFqn, title: title.trim(), kind: kind || null })
        }}
      >
        <label>
          From
          <select value={sourceFqn} onChange={e => setSourceFqn(e.target.value)} required>
            {options.map(o => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          To
          <select value={targetFqn} onChange={e => setTargetFqn(e.target.value)} required>
            {options.map(o => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Label
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. connects to" />
        </label>

        {relationshipKinds.length > 0 && (
          <label>
            Kind
            <select value={kind} onChange={e => setKind(e.target.value)}>
              <option value="">(none)</option>
              {relationshipKinds.map(k => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!sourceFqn || !targetFqn}>
            Add relationship
          </button>
        </div>
      </form>
    </Modal>
  )
}
