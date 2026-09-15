import { useState } from 'react'
import Modal from './Modal'
import type { ElementSummary } from '../likec4/engine'

export interface AddDeployedInstanceValues {
  elementFqn: string
  title: string
}

export default function AddDeployedInstanceDialog({
  parentNodeFqn,
  elements,
  onSubmit,
  onClose,
}: {
  /** the deployment node this instance will be nested inside - fixed, not
   * picked here (opened via that node's own "deploy element" button) */
  parentNodeFqn: string
  elements: ElementSummary[]
  onSubmit: (values: AddDeployedInstanceValues) => void
  onClose: () => void
}) {
  const [elementFqn, setElementFqn] = useState(elements[0]?.id ?? '')
  const [title, setTitle] = useState('')

  return (
    <Modal title={`Deploy into "${parentNodeFqn}"`} onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!elementFqn) return
          onSubmit({ elementFqn, title: title.trim() })
        }}
      >
        <label>
          Element
          <select value={elementFqn} onChange={e => setElementFqn(e.target.value)} required>
            {elements.length === 0 && <option value="">(no elements in this project)</option>}
            {elements.map(el => (
              <option key={el.id} value={el.id}>
                {el.title || el.id}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Same element, deployed here - <code>instanceOf {elementFqn || '…'}</code> inside{' '}
            <code>{parentNodeFqn}</code>.
          </span>
        </label>

        <label>
          Title (optional)
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="defaults to the element's own title" />
        </label>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!elementFqn}>
            Deploy
          </button>
        </div>
      </form>
    </Modal>
  )
}
