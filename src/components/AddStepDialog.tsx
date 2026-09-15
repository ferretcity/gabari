import { useState } from 'react'
import Modal from './Modal'
import type { ElementSummary } from '../likec4/engine'

export interface AddStepValues {
  sourceFqn: string
  targetFqn: string
  title: string
}

export default function AddStepDialog({
  viewTitle,
  elements,
  onSubmit,
  onClose,
}: {
  viewTitle: string
  elements: ElementSummary[]
  onSubmit: (values: AddStepValues) => void
  onClose: () => void
}) {
  const [sourceFqn, setSourceFqn] = useState(elements[0]?.id ?? '')
  const [targetFqn, setTargetFqn] = useState(elements[1]?.id ?? elements[0]?.id ?? '')
  const [title, setTitle] = useState('')

  return (
    <Modal title={`Add step to "${viewTitle}"`} onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!sourceFqn || !targetFqn) return
          onSubmit({ sourceFqn, targetFqn, title: title.trim() })
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
          Step label
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. submits payment" />
        </label>

        <p className="empty-hint">Added as the next step, after any this view already has.</p>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!sourceFqn || !targetFqn}>
            Add step
          </button>
        </div>
      </form>
    </Modal>
  )
}
