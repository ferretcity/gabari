import { useState } from 'react'
import Modal from './Modal'
import type { DeploymentNodeSummary } from '../likec4/engine'

export default function EditDeploymentNodeDialog({
  node,
  onSubmit,
  onClose,
}: {
  node: DeploymentNodeSummary
  onSubmit: (changes: { title: string }) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(node.title)

  return (
    <Modal title={`Edit "${node.id}"`} onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          onSubmit({ title: title.trim() })
        }}
      >
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
