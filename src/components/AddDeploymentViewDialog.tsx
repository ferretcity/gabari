import { useState } from 'react'
import Modal from './Modal'
import { sanitizeId } from '../likec4/dslGen'

export interface AddDeploymentViewValues {
  id: string
  title: string
}

/**
 * Separate from `AddViewDialog` on purpose (see the deployment-support
 * plan's "keep the layers apart" rule) - there's only one kind of
 * deployment view (no dynamic/scoped equivalent), so no `Type` picker at
 * all, just title/id.
 */
export default function AddDeploymentViewDialog({
  existingIds,
  onSubmit,
  onClose,
}: {
  existingIds: string[]
  onSubmit: (values: AddDeploymentViewValues) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [idTouched, setIdTouched] = useState(false)

  const effectiveId = idTouched ? id : title ? sanitizeId(title) : ''
  const isDuplicate = !!effectiveId.trim() && existingIds.includes(sanitizeId(effectiveId))

  return (
    <Modal title="Add deployment view" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!effectiveId.trim() || isDuplicate) return
          onSubmit({ id: sanitizeId(effectiveId), title: title.trim() })
        }}
      >
        <label>
          Title
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Production Topology" />
          <span className="field-hint">
            Tip: use "/" to file this view into a folder, e.g. "Domain/Checkout".
          </span>
        </label>

        <label>
          Identifier
          <input
            value={effectiveId}
            onChange={e => {
              setIdTouched(true)
              setId(e.target.value)
            }}
            placeholder="e.g. productionTopology"
            required
          />
          {isDuplicate && (
            <span className="field-hint field-hint-danger">"{sanitizeId(effectiveId)}" already exists</span>
          )}
        </label>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!effectiveId.trim() || isDuplicate}>
            Add view
          </button>
        </div>
      </form>
    </Modal>
  )
}
