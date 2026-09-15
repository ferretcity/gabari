import { useState } from 'react'
import Modal from './Modal'
import type { ElementSummary } from '../likec4/engine'

export interface AddRelationValues {
  sourceFqn: string
  targetFqn: string
  title: string
  kind: string | null
}

export default function AddRelationDialog({
  elements,
  relationshipKinds,
  defaultSource,
  defaultTarget,
  onSubmit,
  onClose,
}: {
  elements: ElementSummary[]
  relationshipKinds: string[]
  defaultSource?: string
  defaultTarget?: string
  onSubmit: (values: AddRelationValues) => void
  onClose: () => void
}) {
  const [sourceFqn, setSourceFqn] = useState(defaultSource ?? elements[0]?.id ?? '')
  const [targetFqn, setTargetFqn] = useState(defaultTarget ?? elements[1]?.id ?? elements[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('')

  return (
    <Modal title="Add relationship" onClose={onClose}>
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
            {elements.map(el => (
              <option key={el.id} value={el.id}>
                {el.title || el.id}
              </option>
            ))}
          </select>
        </label>

        <label>
          To
          <select value={targetFqn} onChange={e => setTargetFqn(e.target.value)} required>
            {elements.map(el => (
              <option key={el.id} value={el.id}>
                {el.title || el.id}
              </option>
            ))}
          </select>
        </label>

        <label>
          Label
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. uses" />
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
