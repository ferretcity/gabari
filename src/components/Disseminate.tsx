import { useState } from 'react'
import type { DisseminateDocument } from '../likec4/disseminate'

/**
 * The Disseminate sidebar panel - document management only (list/create/
 * delete). Everything else (sections, layout sandbox, export) used to
 * live here as a form, but a notebook is edited where it's read, not from
 * a side panel - see `DisseminateNotebook.tsx`, which is what the main
 * canvas shows once a document is selected (including the title, edited
 * in place there via the same click-to-edit pattern its text cells use,
 * rather than a rename control here).
 */
export default function Disseminate({
  documents,
  activeDocId,
  onSelectDocument,
  onCreateDocument,
  onDeleteDocument,
}: {
  documents: DisseminateDocument[]
  activeDocId: string | null
  onSelectDocument: (id: string | null) => void
  onCreateDocument: (title: string) => void
  onDeleteDocument: (id: string) => void
}) {
  const [newTitle, setNewTitle] = useState('')
  const doc = documents.find(d => d.id === activeDocId) ?? null

  if (!doc) {
    return (
      <div className="sidebar-panel-section">
        <div className="sidebar-section-header">
          <h3>Documents</h3>
        </div>
        {documents.length === 0 ? (
          <p className="empty-hint">
            No documents yet - a document is a scrollable, publishable page assembled from views and notes (a
            roadmap, a walkthrough of one part of the architecture, etc).
          </p>
        ) : (
          <ul className="entity-list">
            {documents.map(d => (
              <li key={d.id} className="entity-row" onClick={() => onSelectDocument(d.id)}>
                <span className="entity-title">{d.title}</span>
                <span className="entity-file">
                  {d.sections.length} section{d.sections.length === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="form"
          onSubmit={e => {
            e.preventDefault()
            if (!newTitle.trim()) return
            onCreateDocument(newTitle.trim())
            setNewTitle('')
          }}
        >
          <label>
            New document
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Q3 Roadmap" />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!newTitle.trim()}>
            + Document
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="sidebar-panel-section">
      <div className="sidebar-section-header">
        <button className="btn btn-sm" onClick={() => onSelectDocument(null)}>
          ← Documents
        </button>
        <button
          className="icon-btn"
          aria-label="Delete document"
          title="Delete document"
          onClick={() => onDeleteDocument(doc.id)}
        >
          ✕
        </button>
      </div>
      <h3 style={{ margin: '0 0 4px' }}>{doc.title}</h3>
      <p className="empty-hint">
        {doc.sections.length} section{doc.sections.length === 1 ? '' : 's'} - edit them directly in the notebook.
      </p>
    </div>
  )
}
