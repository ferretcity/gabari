import { useState } from 'react'
import Modal from './Modal'
import { ELEMENT_SHAPES, LINE_STYLES, THEME_COLORS, sanitizeId } from '../likec4/dslGen'
import type { DeploymentNodeKindSpec, ElementKindSpec, RelationshipKindSpec, TagSpec } from '../likec4/engine'
import type { SpecPreset } from '../likec4/specPresets'
import { elementColorValues } from '../likec4/theme'

/** Ground-truthed against `@likec4/core`'s own theme (see `theme.ts`) -
 * not an approximated guess - so this preview matches the color the real
 * diagram renders for that name. */
function Swatch({ color }: { color: string | null }) {
  if (!color) return null
  return <span className="swatch" style={{ background: elementColorValues(color).fill }} title={color} />
}

export default function SpecificationEditor({
  elementKinds,
  relationshipKinds,
  tags,
  deploymentNodeKinds,
  builtinPresets,
  presets,
  onSavePreset,
  onImportPreset,
  onImportSpecFile,
  onDeletePreset,
  onAddElementKind,
  onUpdateElementKind,
  onDeleteElementKind,
  onAddRelationshipKind,
  onUpdateRelationshipKind,
  onDeleteRelationshipKind,
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  onAddDeploymentNodeKind,
  onUpdateDeploymentNodeKind,
  onDeleteDeploymentNodeKind,
  onClose,
  busy,
}: {
  elementKinds: ElementKindSpec[]
  relationshipKinds: RelationshipKindSpec[]
  tags: TagSpec[]
  /** the deployment layer's own kind namespace - kept in its own visually
   * separated "Deployment model" group below, never mixed into the
   * logical model's kind lists. */
  deploymentNodeKinds: DeploymentNodeKindSpec[]
  /** Ready-made notation presets (ArchiMate, C4 Model, ...) shipped with
   * the app - see `builtinPresets.ts`. Imported the same way as a saved
   * preset, just never deletable. */
  builtinPresets: SpecPreset[]
  presets: SpecPreset[]
  onSavePreset: (name: string) => void
  onImportPreset: (preset: SpecPreset) => void
  /** Drag-and-drop a `.c4` file: import just its specification entries
   * (any model/views it also has are read but ignored), same skip-on-
   * collision merge as importing a saved preset. */
  onImportSpecFile: (text: string, fileName: string) => void
  onDeletePreset: (name: string) => void
  onAddElementKind: (input: { name: string; color: string | null; shape: string | null }) => void
  onUpdateElementKind: (name: string, changes: { color?: string | null; shape?: string | null }) => void
  onDeleteElementKind: (name: string) => void
  onAddRelationshipKind: (input: { name: string; color: string | null; line: string | null }) => void
  onUpdateRelationshipKind: (name: string, changes: { color?: string | null; line?: string | null }) => void
  onDeleteRelationshipKind: (name: string) => void
  onAddTag: (input: { name: string; color: string | null }) => void
  onUpdateTag: (name: string, changes: { color?: string | null }) => void
  onDeleteTag: (name: string) => void
  onAddDeploymentNodeKind: (input: { name: string; color: string | null; shape: string | null }) => void
  onUpdateDeploymentNodeKind: (name: string, changes: { color?: string | null; shape?: string | null }) => void
  onDeleteDeploymentNodeKind: (name: string) => void
  onClose: () => void
  busy: boolean
}) {
  const [ekName, setEkName] = useState('')
  const [ekColor, setEkColor] = useState('')
  const [ekShape, setEkShape] = useState('')
  const [rkName, setRkName] = useState('')
  const [rkColor, setRkColor] = useState('')
  const [rkLine, setRkLine] = useState('')
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('')
  const [dnkName, setDnkName] = useState('')
  const [dnkColor, setDnkColor] = useState('')
  const [dnkShape, setDnkShape] = useState('')
  const [presetName, setPresetName] = useState('')
  const [fileDragOver, setFileDragOver] = useState(false)

  const acceptFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')

  // Proactive duplicate checks - sanitized the same way each submit handler
  // sanitizes its name, so what's flagged here matches what would actually
  // be written. Catches the collision before submit instead of surfacing
  // it as an error toast after mutate.ts's own (authoritative) guard rejects it.
  const ekDuplicate = !!ekName.trim() && elementKinds.some(k => k.name === sanitizeId(ekName, 'kind'))
  const rkDuplicate = !!rkName.trim() && relationshipKinds.some(k => k.name === sanitizeId(rkName, 'rel'))
  const tagDuplicate = !!tagName.trim() && tags.some(t => t.name === sanitizeId(tagName, 'tag'))
  const dnkDuplicate = !!dnkName.trim() && deploymentNodeKinds.some(k => k.name === sanitizeId(dnkName, 'kind'))

  return (
    <Modal title="Specification" onClose={onClose} wide>
      <div className="spec-editor">
        <section>
          <h3>Built-in notations</h3>
          <p className="empty-hint" style={{ padding: 0, marginBottom: 6 }}>
            Ready-made presets shipped with the app - import one to add its kinds to this project.
            Same skip-on-collision merge as a saved preset below.
          </p>
          <ul className="spec-list">
            {builtinPresets.map(p => (
              <li key={p.name} className="entity-row">
                <span className="entity-title">{p.name}</span>
                <span className="entity-kind">
                  {p.elementKinds.length} kind{p.elementKinds.length === 1 ? '' : 's'},{' '}
                  {p.relationshipKinds.length} rel{p.relationshipKinds.length === 1 ? '' : 's'}
                </span>
                <button className="btn btn-sm" disabled={busy} onClick={() => onImportPreset(p)}>
                  Import
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Presets</h3>
          <p className="empty-hint" style={{ padding: 0, marginBottom: 6 }}>
            Save the kinds/tags below as a named, reusable bundle for a domain you work in (e.g.
            "AWS", "Kubernetes") - import it into any diagram later. Importing never overwrites an
            existing kind/tag of the same name.
          </p>
          <ul className="spec-list">
            {presets.length === 0 && <li className="empty-hint">No saved presets yet</li>}
            {presets.map(p => (
              <li key={p.name} className="entity-row">
                <span className="entity-title">{p.name}</span>
                <span className="entity-kind">
                  {p.elementKinds.length} kind{p.elementKinds.length === 1 ? '' : 's'},{' '}
                  {p.relationshipKinds.length} rel{p.relationshipKinds.length === 1 ? '' : 's'},{' '}
                  {p.tags.length} tag{p.tags.length === 1 ? '' : 's'}
                </span>
                <button className="btn btn-sm" disabled={busy} onClick={() => onImportPreset(p)}>
                  Import
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Delete preset ${p.name}`}
                  disabled={busy}
                  onClick={() => onDeletePreset(p.name)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div
            className={'spec-file-drop' + (fileDragOver ? ' drag-over' : '')}
            onDragOver={e => {
              if (!acceptFileDrag(e)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
              setFileDragOver(true)
            }}
            onDragLeave={() => setFileDragOver(false)}
            onDrop={e => {
              if (!acceptFileDrag(e)) return
              e.preventDefault()
              setFileDragOver(false)
              const file = e.dataTransfer.files[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => onImportSpecFile(String(reader.result ?? ''), file.name)
              reader.readAsText(file)
            }}
          >
            Drag a <code>.c4</code> file here to import its specification — anything else in the
            file (a model, views) is ignored, only kinds/tags are pulled in.
          </div>
          <form
            className="spec-add-form"
            onSubmit={e => {
              e.preventDefault()
              if (!presetName.trim()) return
              onSavePreset(presetName.trim())
              setPresetName('')
            }}
          >
            <input
              placeholder="preset name, e.g. AWS"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !presetName.trim()}>
              Save current spec as preset
            </button>
          </form>
        </section>

        <h2 className="spec-group-heading">Logical model</h2>

        <section>
          <h3>Element kinds</h3>
          <ul className="spec-list">
            {elementKinds.map(k => (
              <li key={k.name} className="entity-row">
                <Swatch color={k.color} />
                <span className="entity-title">{k.name}</span>
                <select
                  className="spec-inline-select"
                  aria-label={`${k.name} color`}
                  value={k.color ?? ''}
                  disabled={busy}
                  onChange={e => onUpdateElementKind(k.name, { color: e.target.value || null })}
                >
                  <option value="">(default color)</option>
                  {THEME_COLORS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className="spec-inline-select"
                  aria-label={`${k.name} shape`}
                  value={k.shape ?? ''}
                  disabled={busy}
                  onChange={e => onUpdateElementKind(k.name, { shape: e.target.value || null })}
                >
                  <option value="">(default shape)</option>
                  {ELEMENT_SHAPES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  aria-label={`Delete kind ${k.name}`}
                  disabled={busy}
                  onClick={() => onDeleteElementKind(k.name)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form
            className="spec-add-form"
            onSubmit={e => {
              e.preventDefault()
              if (!ekName.trim() || ekDuplicate) return
              onAddElementKind({ name: sanitizeId(ekName, 'kind'), color: ekColor || null, shape: ekShape || null })
              setEkName('')
              setEkColor('')
              setEkShape('')
            }}
          >
            <input placeholder="new kind name" value={ekName} onChange={e => setEkName(e.target.value)} />
            <select value={ekColor} onChange={e => setEkColor(e.target.value)}>
              <option value="">(default color)</option>
              {THEME_COLORS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={ekShape} onChange={e => setEkShape(e.target.value)}>
              <option value="">(default shape)</option>
              {ELEMENT_SHAPES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !ekName.trim() || ekDuplicate}>
              Add
            </button>
            {ekDuplicate && <span className="field-hint field-hint-danger">"{sanitizeId(ekName, 'kind')}" already exists</span>}
          </form>
        </section>

        <section>
          <h3>Relationship kinds</h3>
          <ul className="spec-list">
            {relationshipKinds.map(k => (
              <li key={k.name} className="entity-row">
                <Swatch color={k.color} />
                <span className="entity-title">{k.name}</span>
                <select
                  className="spec-inline-select"
                  aria-label={`${k.name} color`}
                  value={k.color ?? ''}
                  disabled={busy}
                  onChange={e => onUpdateRelationshipKind(k.name, { color: e.target.value || null })}
                >
                  <option value="">(default color)</option>
                  {THEME_COLORS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className="spec-inline-select"
                  aria-label={`${k.name} line`}
                  value={k.line ?? ''}
                  disabled={busy}
                  onChange={e => onUpdateRelationshipKind(k.name, { line: e.target.value || null })}
                >
                  <option value="">(default line)</option>
                  {LINE_STYLES.map(l => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  aria-label={`Delete relationship kind ${k.name}`}
                  disabled={busy}
                  onClick={() => onDeleteRelationshipKind(k.name)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form
            className="spec-add-form"
            onSubmit={e => {
              e.preventDefault()
              if (!rkName.trim() || rkDuplicate) return
              onAddRelationshipKind({ name: sanitizeId(rkName, 'rel'), color: rkColor || null, line: rkLine || null })
              setRkName('')
              setRkColor('')
              setRkLine('')
            }}
          >
            <input placeholder="new relationship kind" value={rkName} onChange={e => setRkName(e.target.value)} />
            <select value={rkColor} onChange={e => setRkColor(e.target.value)}>
              <option value="">(default color)</option>
              {THEME_COLORS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={rkLine} onChange={e => setRkLine(e.target.value)}>
              <option value="">(default line)</option>
              {LINE_STYLES.map(l => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !rkName.trim() || rkDuplicate}>
              Add
            </button>
            {rkDuplicate && <span className="field-hint field-hint-danger">"{sanitizeId(rkName, 'rel')}" already exists</span>}
          </form>
        </section>

        <section>
          <h3>Tags</h3>
          <ul className="spec-list">
            {tags.map(t => (
              <li key={t.name} className="entity-row">
                <Swatch color={t.color} />
                <span className="entity-title">#{t.name}</span>
                <select
                  className="spec-inline-select"
                  aria-label={`${t.name} color`}
                  value={t.color ?? ''}
                  disabled={busy}
                  onChange={e => onUpdateTag(t.name, { color: e.target.value || null })}
                >
                  <option value="">(auto color)</option>
                  {THEME_COLORS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  aria-label={`Delete tag ${t.name}`}
                  disabled={busy}
                  onClick={() => onDeleteTag(t.name)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form
            className="spec-add-form"
            onSubmit={e => {
              e.preventDefault()
              if (!tagName.trim() || tagDuplicate) return
              onAddTag({ name: sanitizeId(tagName, 'tag'), color: tagColor || null })
              setTagName('')
              setTagColor('')
            }}
          >
            <input placeholder="new tag name" value={tagName} onChange={e => setTagName(e.target.value)} />
            <select value={tagColor} onChange={e => setTagColor(e.target.value)}>
              <option value="">(auto color)</option>
              {THEME_COLORS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !tagName.trim() || tagDuplicate}>
              Add
            </button>
            {tagDuplicate && <span className="field-hint field-hint-danger">"{sanitizeId(tagName, 'tag')}" already exists</span>}
          </form>
        </section>

        <h2 className="spec-group-heading spec-group-heading-deployment">Deployment model</h2>
        <p className="empty-hint" style={{ padding: 0, marginTop: -8, marginBottom: 8 }}>
          Kinds for the deployment tree (infrastructure nodes like zones, VMs, clusters) - a separate
          layer from the elements above, showing *where* they run rather than what they are. Build the
          tree itself from the Deployment panel in the sidebar.
        </p>

        <section>
          <h3>Deployment node kinds</h3>
          <ul className="spec-list">
            {deploymentNodeKinds.map(k => (
              <li key={k.name} className="entity-row">
                <Swatch color={k.color} />
                <span className="entity-title">{k.name}</span>
                <select
                  className="spec-inline-select"
                  aria-label={`${k.name} color`}
                  value={k.color ?? ''}
                  disabled={busy}
                  onChange={e => onUpdateDeploymentNodeKind(k.name, { color: e.target.value || null })}
                >
                  <option value="">(default color)</option>
                  {THEME_COLORS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className="spec-inline-select"
                  aria-label={`${k.name} shape`}
                  value={k.shape ?? ''}
                  disabled={busy}
                  onChange={e => onUpdateDeploymentNodeKind(k.name, { shape: e.target.value || null })}
                >
                  <option value="">(default shape)</option>
                  {ELEMENT_SHAPES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  aria-label={`Delete deployment node kind ${k.name}`}
                  disabled={busy}
                  onClick={() => onDeleteDeploymentNodeKind(k.name)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form
            className="spec-add-form"
            onSubmit={e => {
              e.preventDefault()
              if (!dnkName.trim() || dnkDuplicate) return
              onAddDeploymentNodeKind({ name: sanitizeId(dnkName, 'kind'), color: dnkColor || null, shape: dnkShape || null })
              setDnkName('')
              setDnkColor('')
              setDnkShape('')
            }}
          >
            <input placeholder="new deployment node kind" value={dnkName} onChange={e => setDnkName(e.target.value)} />
            <select value={dnkColor} onChange={e => setDnkColor(e.target.value)}>
              <option value="">(default color)</option>
              {THEME_COLORS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={dnkShape} onChange={e => setDnkShape(e.target.value)}>
              <option value="">(default shape)</option>
              {ELEMENT_SHAPES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !dnkName.trim() || dnkDuplicate}>
              Add
            </button>
            {dnkDuplicate && (
              <span className="field-hint field-hint-danger">"{sanitizeId(dnkName, 'kind')}" already exists</span>
            )}
          </form>
        </section>
      </div>
    </Modal>
  )
}
