import { useState } from 'react'
import Modal from './Modal'
import { sanitizeId } from '../likec4/dslGen'
import type { ElementSummary } from '../likec4/engine'

export interface AddViewValues {
  id: string
  title: string
  dynamic: boolean
  /** fqn of the element to scope this view to, if the "Scoped view" type was chosen */
  viewOf?: string
}

type ViewType = 'element' | 'dynamic' | 'scoped'

export default function AddViewDialog({
  existingIds,
  elements,
  onSubmit,
  onClose,
}: {
  existingIds: string[]
  /** offered by the "Scoped view" type's element picker */
  elements: ElementSummary[]
  onSubmit: (values: AddViewValues) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [viewType, setViewType] = useState<ViewType>('element')
  const [scopeFqn, setScopeFqn] = useState(elements[0]?.id ?? '')

  // See AddElementDialog's identical comment: derive the id from the title
  // live, but leave it genuinely empty (not a real pre-filled word) until
  // there's a title to derive it from.
  const effectiveId = idTouched ? id : title ? sanitizeId(title) : ''
  // Proactive check - mutate.ts's own addView rejects this too (the
  // authoritative guard), this just catches it before submit instead of
  // after, as an error toast.
  const isDuplicate = !!effectiveId.trim() && existingIds.includes(sanitizeId(effectiveId))
  const isScoped = viewType === 'scoped'
  const canSubmit = !!effectiveId.trim() && !isDuplicate && (!isScoped || !!scopeFqn)

  return (
    <Modal title="Add view" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!canSubmit) return
          onSubmit({
            id: sanitizeId(effectiveId),
            title: title.trim(),
            dynamic: viewType === 'dynamic',
            viewOf: isScoped ? scopeFqn : undefined,
          })
        }}
      >
        <label>
          Title
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Checkout Flow" />
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
            placeholder="e.g. checkoutFlow"
            required
          />
          {isDuplicate && (
            <span className="field-hint field-hint-danger">"{sanitizeId(effectiveId)}" already exists</span>
          )}
        </label>

        <label>
          Type
          <select value={viewType} onChange={e => setViewType(e.target.value as ViewType)}>
            <option value="element">Element view — shows every top-level element</option>
            <option value="dynamic">Dynamic view — an ordered sequence of steps you add yourself</option>
            <option value="scoped" disabled={elements.length === 0}>
              Scoped view — zoomed into one element (its children + neighbors)
            </option>
          </select>
        </label>

        {isScoped && (
          <label>
            Scoped to
            <select value={scopeFqn} onChange={e => setScopeFqn(e.target.value)}>
              {elements.map(el => (
                <option key={el.id} value={el.id}>
                  {el.title || el.id}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Same as writing <code>view {effectiveId || '…'} of {scopeFqn || '…'}</code> — LikeC4 expands{' '}
              <code>include *</code> to this element's children plus whatever else relates to it directly.
            </span>
          </label>
        )}

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            Add view
          </button>
        </div>
      </form>
    </Modal>
  )
}
