import { useState } from 'react'
import Modal from './Modal'
import type { ElementSummary } from '../likec4/engine'
import { sanitizeId } from '../likec4/dslGen'

export interface AddElementValues {
  id: string
  kind: string
  title: string
  description: string
  parentFqn: string | null
}

export default function AddElementDialog({
  kinds,
  elements,
  presetKind,
  presetParentFqn,
  onSubmit,
  onClose,
}: {
  kinds: string[]
  elements: ElementSummary[]
  presetKind?: string
  presetParentFqn?: string | null
  onSubmit: (values: AddElementValues) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [kind, setKind] = useState(presetKind ?? kinds[0] ?? '')
  const [description, setDescription] = useState('')
  const [parentFqn, setParentFqn] = useState(presetParentFqn ?? '')

  // Auto-derive the id from the title as it's typed, live - but leave the
  // field genuinely empty (not a real value the user then has to notice
  // and clear) until there's a title to derive it from; falling back to a
  // hardcoded word here would mean clicking into an empty-looking field
  // and typing just appends onto that word instead of replacing it.
  const effectiveId = idTouched ? id : title ? sanitizeId(title) : ''
  const sanitizedId = sanitizeId(effectiveId)
  const fqn = parentFqn ? `${parentFqn}.${sanitizedId}` : sanitizedId
  // Proactive check - mutate.ts's own addElement rejects this too (the
  // authoritative guard), this just catches it before submit instead of
  // after, as an error toast.
  const isDuplicate = !!effectiveId.trim() && elements.some(el => el.id === fqn)

  return (
    <Modal title="Add element" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!kind || !effectiveId.trim() || isDuplicate) return
          onSubmit({
            id: sanitizeId(effectiveId),
            kind,
            title: title.trim(),
            description: description.trim(),
            parentFqn: parentFqn || null,
          })
        }}
      >
        <label>
          Kind
          <select value={kind} onChange={e => setKind(e.target.value)} required>
            {kinds.length === 0 && <option value="">(no kinds declared)</option>}
            {kinds.map(k => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Billing Service"
          />
        </label>

        <label>
          Identifier
          <input
            value={effectiveId}
            onChange={e => {
              setIdTouched(true)
              setId(e.target.value)
            }}
            placeholder="e.g. billingService"
            required
          />
          {isDuplicate && <span className="field-hint field-hint-danger">"{fqn}" already exists</span>}
        </label>

        <label>
          Parent (nest inside)
          <select value={parentFqn} onChange={e => setParentFqn(e.target.value)}>
            <option value="">— top level —</option>
            {elements.map(el => (
              <option key={el.id} value={el.id}>
                {'—'.repeat(el.id.split('.').length - 1)} {el.title || el.id}
              </option>
            ))}
          </select>
        </label>

        <label>
          Description
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </label>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!kind || isDuplicate}>
            Add element
          </button>
        </div>
      </form>
    </Modal>
  )
}
