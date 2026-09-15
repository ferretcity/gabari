import Modal from './Modal'
import type { ElementSummary } from '../likec4/engine'

/**
 * "What's shown in this view" - deliberately separate from the Model
 * panel's "+ Element" (which creates a new element in the project, full
 * stop). An element existing in the model and an element rendering in any
 * *particular* view are two different questions - most views just say
 * `include *` so the two normally look the same, until a view has a
 * narrower rule set or is scoped to one element (`view id of <fqn>`,
 * where `*` only reaches that element's own neighborhood). This is the
 * one place to reconcile the two: every element that exists, with a
 * checkbox for whether *this* view currently renders it.
 */
export default function ViewContentsDialog({
  viewTitle,
  elements,
  includedIds,
  onToggle,
  onClose,
}: {
  viewTitle: string
  /** every element in the project (not just this view's) */
  elements: ElementSummary[]
  /** ids of elements this view currently renders, per its live layout */
  includedIds: Set<string>
  onToggle: (fqn: string, included: boolean) => void
  onClose: () => void
}) {
  return (
    <Modal title={`Elements in "${viewTitle}"`} onClose={onClose}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Checked elements render in this view; unchecking one doesn't delete it from the project, just hides
        it here.
      </p>
      {elements.length === 0 ? (
        <p className="empty-hint">No elements in this project yet.</p>
      ) : (
        <ul className="entity-list">
          {elements.map(el => {
            const checked = includedIds.has(el.id)
            return (
              <li key={el.id} className="entity-row" style={{ paddingLeft: (el.id.split('.').length - 1) * 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: 0 }}>
                  <input type="checkbox" checked={checked} onChange={e => onToggle(el.id, e.target.checked)} />
                  <span className="entity-kind">{el.kind}</span>
                  <span className="entity-title" title={el.id}>
                    {el.title || el.id}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
