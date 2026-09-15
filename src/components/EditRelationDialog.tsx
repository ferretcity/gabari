import { useState } from 'react'
import Modal from './Modal'
import { LINE_STYLES, RELATIONSHIP_ARROWS, THEME_COLORS } from '../likec4/dslGen'
import type { RelationSummary } from '../likec4/engine'
import type { RelationshipStyleInput } from '../likec4/dslGen'

export default function EditRelationDialog({
  relation,
  onSubmit,
  onClose,
}: {
  relation: RelationSummary
  onSubmit: (changes: { title: string; style: RelationshipStyleInput }) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(relation.title ?? '')
  const [color, setColor] = useState(relation.color ?? '')
  const [line, setLine] = useState(relation.line ?? '')
  const [head, setHead] = useState(relation.head ?? '')
  const [tail, setTail] = useState(relation.tail ?? '')

  return (
    <Modal title="Edit relationship" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          onSubmit({
            title: title.trim(),
            style: {
              color: color || null,
              line: line || null,
              head: head || null,
              tail: tail || null,
            },
          })
        }}
      >
        <label>
          Label
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. uses" />
        </label>

        <div className="style-grid">
          <label>
            Color
            <select value={color} onChange={e => setColor(e.target.value)}>
              <option value="">(default)</option>
              {THEME_COLORS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Line
            <select value={line} onChange={e => setLine(e.target.value)}>
              <option value="">(default)</option>
              {LINE_STYLES.map(l => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Arrow head
            <select value={head} onChange={e => setHead(e.target.value)}>
              <option value="">(default)</option>
              {RELATIONSHIP_ARROWS.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Arrow tail
            <select value={tail} onChange={e => setTail(e.target.value)}>
              <option value="">(default)</option>
              {RELATIONSHIP_ARROWS.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>

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
