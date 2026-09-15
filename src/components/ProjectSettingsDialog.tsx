import { useState } from 'react'
import Modal from './Modal'
import type { ProjectConfig } from '../likec4/projectConfig'

/**
 * Edits this workspace's one `likec4.config.json` - `name` is the
 * project's real id (used in tooling, and in cross-project `import ...
 * from "name"` statements), `title`/`contactPerson` are display-only
 * extras. Any other fields already in an existing config (`metadata`,
 * `extends`, `styles`, ...) are read in from `config` and passed back out
 * untouched in `onSubmit`'s result - this dialog only ever edits its own
 * three fields.
 */
export default function ProjectSettingsDialog({
  config,
  onSubmit,
  onClose,
}: {
  /** `null` when this workspace has no `likec4.config.json` yet - the form
   * starts blank and submitting creates one for the first time. */
  config: ProjectConfig | null
  onSubmit: (config: ProjectConfig) => void
  onClose: () => void
}) {
  const [name, setName] = useState(config?.name ?? '')
  const [title, setTitle] = useState(config?.title ?? '')
  const [contactPerson, setContactPerson] = useState(config?.contactPerson ?? '')

  return (
    <Modal title="Project Settings" onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          const trimmed = name.trim()
          if (!trimmed) return
          onSubmit({ ...config, name: trimmed, title: title.trim() || undefined, contactPerson: contactPerson.trim() || undefined })
        }}
      >
        {!config && (
          <p className="field-hint" style={{ marginTop: 0 }}>
            This workspace has no <code>likec4.config.json</code> yet - naming it here creates one.
          </p>
        )}
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. my-project"
            required
          />
          <span className="field-hint">The project's real id - used by tooling and by other projects' `import ... from` statements.</span>
        </label>

        <label>
          Title
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My Project" />
        </label>

        <label>
          Contact person
          <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="optional" />
        </label>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
