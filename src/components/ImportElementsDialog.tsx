import { useRef, useState } from 'react'
import Modal from './Modal'

/**
 * Paste (or pick a file containing) a *complete, self-contained* LikeC4
 * document to merge its elements into this project - see
 * `mutate.ts`'s `importElements` for what actually happens on submit
 * (kind auto-declared if missing, elements filed into
 * `imported-elements.likec4`, ids auto-renamed on collision). This dialog
 * itself does no parsing - `onSubmit` hands the raw text to `App.tsx`,
 * which parses it through the same `runMutation`/toast error path every
 * other mutation uses.
 */
export default function ImportElementsDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Modal title="Import elements" onClose={onClose} wide>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          if (!text.trim()) return
          onSubmit(text)
        }}
      >
        <p className="field-hint" style={{ marginTop: 0 }}>
          Paste a complete LikeC4 document - it needs its own <code>specification {'{ }'}</code>{' '}
          declaring whatever kinds it uses and a <code>model {'{ }'}</code> wrapping the elements, the
          same as any file you'd export from a LikeC4 project. A bare snippet of just element lines
          won't parse on its own.
        </p>

        <label>
          LikeC4 source
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            rows={14}
            placeholder={"specification {\n  element system\n}\n\nmodel {\n  system paymentsApi 'Payments API'\n}\n"}
            style={{ fontFamily: 'var(--mono-font, monospace)' }}
          />
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept=".c4,.likec4,.txt,text/plain"
          hidden
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => setText(String(reader.result ?? ''))
            reader.readAsText(file)
          }}
        />

        <div className="form-actions">
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            Choose file…
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
            Import
          </button>
        </div>
      </form>
    </Modal>
  )
}
