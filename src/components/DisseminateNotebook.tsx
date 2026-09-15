import { useState } from 'react'
import type { LikeC4Model } from '@likec4/core/model'
import type { LayoutedView } from '@likec4/core/types'
import { newSectionId, type DisseminateDocument, type DisseminateSection } from '../likec4/disseminate'
import type { ViewSummary } from '../likec4/engine'
import type { ViewLayoutDirection } from '../likec4/mutate'
import DiagramSnapshot from './DiagramSnapshot'

const DIRECTIONS: { value: ViewLayoutDirection; label: string }[] = [
  { value: 'TopBottom', label: 'Top to bottom' },
  { value: 'LeftRight', label: 'Left to right' },
  { value: 'BottomTop', label: 'Bottom to top' },
  { value: 'RightLeft', label: 'Right to left' },
]

export type LayoutOverride = { direction: ViewLayoutDirection; rankSep?: number; nodeSep?: number }

/**
 * The Disseminate main-canvas content - one continuously-scrollable
 * notebook, every cell editable in place (literate-programming style:
 * prose and diagrams interleaved, edited where they're read, not
 * assembled from a side-panel form). Replaces the old Edit/Preview mode
 * split entirely - this is always both at once.
 */
export default function DisseminateNotebook({
  doc,
  model,
  diagramsById,
  views,
  onUpdateDocument,
  activeLayoutSectionId,
  onToggleLayoutSection,
  layoutOverride,
  onChangeLayoutOverride,
  onApplyLayout,
  sandboxModel,
  sandboxView,
  onExport,
  busy,
}: {
  doc: DisseminateDocument
  model: LikeC4Model.Layouted | null
  diagramsById: Map<string, LayoutedView>
  views: ViewSummary[]
  onUpdateDocument: (doc: DisseminateDocument) => void
  /** which view cell's "Layout…" disclosure is expanded, if any - drives
   * App.tsx's sandboxed-clone-and-reparse effect the same way the old
   * sidebar's "selected section" used to. */
  activeLayoutSectionId: string | null
  onToggleLayoutSection: (id: string | null) => void
  layoutOverride: LayoutOverride | null
  onChangeLayoutOverride: (override: LayoutOverride | null) => void
  onApplyLayout: () => void
  /** the live sandboxed re-parse for `activeLayoutSectionId`'s view, if a
   * `layoutOverride` is set - `null` otherwise, in which case the cell
   * just renders from `model`/`diagramsById` like any other. */
  sandboxModel: LikeC4Model.Layouted | null
  sandboxView: LayoutedView | null
  onExport: () => void
  busy: boolean
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(doc.title)

  const updateSections = (sections: DisseminateSection[]) => onUpdateDocument({ ...doc, sections })
  const updateSection = (id: string, patch: Partial<DisseminateSection>) =>
    updateSections(doc.sections.map(s => (s.id === id ? { ...s, ...patch } : s)))
  const moveSection = (index: number, dir: -1 | 1) => {
    const next = [...doc.sections]
    const swapWith = index + dir
    if (swapWith < 0 || swapWith >= next.length) return
    ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
    updateSections(next)
  }
  const deleteSection = (id: string) => {
    if (id === activeLayoutSectionId) onToggleLayoutSection(null)
    updateSections(doc.sections.filter(s => s.id !== id))
  }
  const insertSection = (index: number, section: DisseminateSection) => {
    const next = [...doc.sections]
    next.splice(index, 0, section)
    updateSections(next)
  }

  const commitTitle = () => {
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== doc.title) onUpdateDocument({ ...doc, title: trimmed })
    else setTitleDraft(doc.title)
  }

  const insertTextAt = (index: number) => insertSection(index, { id: newSectionId(), type: 'text', text: '' })
  const insertViewAt = (index: number) => insertSection(index, { id: newSectionId(), type: 'view' })

  return (
    <div className="disseminate-notebook">
      <div className="disseminate-notebook-toolbar">
        {editingTitle ? (
          <input
            autoFocus
            className="disseminate-title-input"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') {
                setTitleDraft(doc.title)
                setEditingTitle(false)
              }
            }}
          />
        ) : (
          <h2 className="disseminate-title" onClick={() => setEditingTitle(true)} title="Click to rename">
            {doc.title}
          </h2>
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={onExport} disabled={busy || doc.sections.length === 0}>
          Export as HTML…
        </button>
      </div>

      <Inserter onInsertText={() => insertTextAt(0)} onInsertView={() => insertViewAt(0)} />
      {doc.sections.map((section, i) => (
        <div key={section.id}>
          <div className="disseminate-cell" data-section-id={section.id}>
            <div className="disseminate-cell-gutter">
              <button className="icon-btn" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => moveSection(i, -1)}>
                ↑
              </button>
              <button
                className="icon-btn"
                aria-label="Move down"
                title="Move down"
                disabled={i === doc.sections.length - 1}
                onClick={() => moveSection(i, 1)}
              >
                ↓
              </button>
              <button className="icon-btn" aria-label="Delete cell" title="Delete cell" onClick={() => deleteSection(section.id)}>
                ✕
              </button>
            </div>
            <div className="disseminate-cell-body">
              {section.type === 'text' ? (
                <TextCell section={section} onChange={text => updateSection(section.id, { text })} />
              ) : (
                <ViewCell
                  section={section}
                  views={views}
                  model={model}
                  diagramsById={diagramsById}
                  isLayoutOpen={activeLayoutSectionId === section.id}
                  onToggleLayout={() => onToggleLayoutSection(activeLayoutSectionId === section.id ? null : section.id)}
                  layoutOverride={activeLayoutSectionId === section.id ? layoutOverride : null}
                  onChangeLayoutOverride={onChangeLayoutOverride}
                  onApplyLayout={onApplyLayout}
                  sandboxModel={activeLayoutSectionId === section.id ? sandboxModel : null}
                  sandboxView={activeLayoutSectionId === section.id ? sandboxView : null}
                  busy={busy}
                  onPickView={viewId => updateSection(section.id, { viewId })}
                  onChangeCaption={caption => updateSection(section.id, { caption })}
                />
              )}
            </div>
          </div>
          <Inserter onInsertText={() => insertTextAt(i + 1)} onInsertView={() => insertViewAt(i + 1)} />
        </div>
      ))}
      {doc.sections.length === 0 && (
        <p className="empty-hint" style={{ textAlign: 'center' }}>
          Add a text or view cell to start building this document.
        </p>
      )}
    </div>
  )
}

function Inserter({ onInsertText, onInsertView }: { onInsertText: () => void; onInsertView: () => void }) {
  return (
    <div className="disseminate-inserter">
      <button type="button" className="btn btn-sm" onClick={onInsertText}>
        + Text
      </button>
      <button type="button" className="btn btn-sm" onClick={onInsertView}>
        + View
      </button>
    </div>
  )
}

function TextCell({ section, onChange }: { section: DisseminateSection; onChange: (text: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.text ?? '')

  if (editing) {
    return (
      <textarea
        autoFocus
        className="disseminate-text-editor"
        rows={4}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onChange(draft)
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            setDraft(section.text ?? '')
            setEditing(false)
          }
        }}
      />
    )
  }
  const text = section.text ?? ''
  return (
    <div
      className="disseminate-preview-text disseminate-text-clickable"
      onClick={() => {
        setDraft(text)
        setEditing(true)
      }}
    >
      {text ? text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <p className="empty-hint">Click to write…</p>}
    </div>
  )
}

function ViewCell({
  section,
  views,
  model,
  diagramsById,
  isLayoutOpen,
  onToggleLayout,
  layoutOverride,
  onChangeLayoutOverride,
  onApplyLayout,
  sandboxModel,
  sandboxView,
  busy,
  onPickView,
  onChangeCaption,
}: {
  section: DisseminateSection
  views: ViewSummary[]
  model: LikeC4Model.Layouted | null
  diagramsById: Map<string, LayoutedView>
  isLayoutOpen: boolean
  onToggleLayout: () => void
  layoutOverride: LayoutOverride | null
  onChangeLayoutOverride: (override: LayoutOverride | null) => void
  onApplyLayout: () => void
  sandboxModel: LikeC4Model.Layouted | null
  sandboxView: LayoutedView | null
  busy: boolean
  onPickView: (viewId: string) => void
  onChangeCaption: (caption: string) => void
}) {
  if (!section.viewId) {
    return (
      <div className="disseminate-view-picker">
        <select value="" onChange={e => e.target.value && onPickView(e.target.value)}>
          <option value="">Pick a view…</option>
          {views.map(v => (
            <option key={v.id} value={v.id}>
              {v.title || v.id}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const effectiveModel = sandboxModel ?? model
  const effectiveView = sandboxView ?? diagramsById.get(section.viewId as never)

  return (
    <div>
      {!effectiveModel || !effectiveView ? (
        <p className="empty-hint">View "{section.viewId}" not found.</p>
      ) : (
        <div className="disseminate-view-cell-canvas">
          <DiagramSnapshot model={effectiveModel} view={effectiveView} interactive />
        </div>
      )}
      <input
        className="disseminate-caption-input"
        value={section.caption ?? ''}
        onChange={e => onChangeCaption(e.target.value)}
        placeholder="Caption, shown under the exported image (optional)"
      />
      <button type="button" className="btn btn-sm" onClick={onToggleLayout}>
        {isLayoutOpen ? 'Hide layout' : 'Layout…'}
      </button>
      {isLayoutOpen && (
        <div className="disseminate-layout-sandbox">
          <label>
            Direction
            <select
              value={layoutOverride?.direction ?? ''}
              onChange={e => {
                const value = e.target.value as ViewLayoutDirection | ''
                onChangeLayoutOverride(value ? { direction: value } : null)
              }}
            >
              <option value="">Default (as currently defined)</option>
              {DIRECTIONS.map(d => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="field-hint">A live, sandboxed preview - nothing is saved until "Apply to view".</span>
          </label>
          {layoutOverride && (
            <>
              <label>
                Rank spacing
                <input
                  type="number"
                  min={0}
                  value={layoutOverride.rankSep ?? ''}
                  onChange={e =>
                    onChangeLayoutOverride({ ...layoutOverride, rankSep: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </label>
              <label>
                Node spacing
                <input
                  type="number"
                  min={0}
                  value={layoutOverride.nodeSep ?? ''}
                  onChange={e =>
                    onChangeLayoutOverride({ ...layoutOverride, nodeSep: e.target.value ? Number(e.target.value) : undefined })
                  }
                  disabled={layoutOverride.rankSep === undefined}
                />
              </label>
            </>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={onApplyLayout} disabled={busy}>
            Apply to view
          </button>
        </div>
      )}
    </div>
  )
}
