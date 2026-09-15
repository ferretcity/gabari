import { useState } from 'react'
import Modal from './Modal'
import type { DeploymentNodeSummary } from '../likec4/engine'
import { sanitizeId } from '../likec4/dslGen'

export interface AddDeploymentNodeValues {
  id: string
  kind: string
  title: string
  parentFqn: string | null
}

export default function AddDeploymentNodeDialog({
  kinds,
  nodes,
  presetParentFqn,
  onSubmit,
  onClose,
}: {
  kinds: string[]
  nodes: DeploymentNodeSummary[]
  presetParentFqn?: string | null
  onSubmit: (values: AddDeploymentNodeValues) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [kind, setKind] = useState(kinds[0] ?? '')
  const [parentFqn, setParentFqn] = useState(presetParentFqn ?? '')

  const effectiveId = idTouched ? id : title ? sanitizeId(title) : ''
  const sanitizedId = sanitizeId(effectiveId)
  const fqn = parentFqn ? `${parentFqn}.${sanitizedId}` : sanitizedId
  // Proactive check - mutate.ts's own addDeploymentNode rejects this too
  // (the authoritative guard), this just catches it before submit instead
  // of after, as an error toast.
  const isDuplicate = !!effectiveId.trim() && nodes.some(n => n.id === fqn)

  return (
    <Modal title="Add deployment node" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!kind || !effectiveId.trim() || isDuplicate) return
          onSubmit({ id: sanitizeId(effectiveId), kind, title: title.trim(), parentFqn: parentFqn || null })
        }}
      >
        <label>
          Kind
          <select value={kind} onChange={e => setKind(e.target.value)} required>
            {kinds.length === 0 && <option value="">(no deployment node kinds declared)</option>}
            {kinds.map(k => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label>
          Title
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. EU Production" />
        </label>

        <label>
          Identifier
          <input
            value={effectiveId}
            onChange={e => {
              setIdTouched(true)
              setId(e.target.value)
            }}
            placeholder="e.g. euProd"
            required
          />
          {isDuplicate && <span className="field-hint field-hint-danger">"{fqn}" already exists</span>}
        </label>

        <label>
          Parent (nest inside)
          <select value={parentFqn} onChange={e => setParentFqn(e.target.value)}>
            <option value="">— top level —</option>
            {nodes.map(n => (
              <option key={n.id} value={n.id}>
                {'—'.repeat(n.id.split('.').length - 1)} {n.title || n.id}
              </option>
            ))}
          </select>
        </label>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!kind || isDuplicate}>
            Add node
          </button>
        </div>
      </form>
    </Modal>
  )
}
