import { useState } from 'react'
import Modal from './Modal'
import type { DeploymentInstanceSummary } from '../likec4/engine'

export default function EditDeployedInstanceDialog({
  instance,
  onSubmit,
  onClose,
}: {
  instance: DeploymentInstanceSummary
  onSubmit: (changes: { title: string }) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(instance.title)

  return (
    <Modal title={`Edit "${instance.id}"`} onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          onSubmit({ title: title.trim() })
        }}
      >
        <p className="field-hint" style={{ marginTop: 0 }}>
          Deployed instance of <code>{instance.elementFqn}</code>.
        </p>
        <label>
          Title
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
