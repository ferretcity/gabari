import { useState } from 'react'
import Modal from './Modal'
import type { ElementSummary, ViewSummary } from '../likec4/engine'

export default function EditViewDialog({
  view,
  elements,
  onSubmit,
  onClose,
}: {
  view: ViewSummary
  /** offered by the scope picker - a dynamic view has no `of` clause at all
   * (LikeC4's grammar doesn't allow one), so that field is hidden for it */
  elements: ElementSummary[]
  onSubmit: (changes: { title: string; viewOf: string | null; order: number | null }) => void
  onClose: () => void
}) {
  // Seeded from `titlePath` (folder prefix included), not the display-only
  // `title` (leaf-only) - saving back `title` unchanged would otherwise
  // silently drop the view out of its folder.
  const [title, setTitle] = useState(view.titlePath)
  const [scopeFqn, setScopeFqn] = useState(view.viewOf ?? '')
  const [order, setOrder] = useState(view.order === null ? '' : String(view.order))

  return (
    <Modal title={`Edit "${view.id}"`} onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          const trimmedOrder = order.trim()
          onSubmit({
            title: title.trim(),
            viewOf: view.isDynamic ? null : scopeFqn || null,
            order: trimmedOrder ? Number(trimmedOrder) : null,
          })
        }}
      >
        <label>
          Title
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} />
          <span className="field-hint">
            Tip: use "/" to file this view into a folder, e.g. "Domain/Checkout".
          </span>
        </label>

        <label>
          Order
          <input
            type="number"
            min={0}
            step={1}
            value={order}
            onChange={e => setOrder(e.target.value)}
            placeholder="(unset — keeps declaration order)"
          />
          <span className="field-hint">Lower numbers sort first among views in the same folder.</span>
        </label>

        {!view.isDynamic && (
          <label>
            Scoped to
            <select value={scopeFqn} onChange={e => setScopeFqn(e.target.value)}>
              <option value="">(none — plain top-level view)</option>
              {elements.map(el => (
                <option key={el.id} value={el.id}>
                  {el.title || el.id}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Scoping this view "zooms into" that element - LikeC4 expands <code>include *</code> to its
              children plus whatever else relates to it directly.
            </span>
          </label>
        )}

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
