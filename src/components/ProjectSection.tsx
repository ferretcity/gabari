import type { ProjectConfig } from '../likec4/projectConfig'

/**
 * This workspace's own project identity - name/title/contact person, from
 * its root `likec4.config.json` (see `projectConfig.ts`). Lives at the top
 * of the "Project" panel (files below it) rather than buried in the File
 * menu, since naming/renaming the project is a project-level action, not
 * a file operation.
 */
export default function ProjectSection({
  config,
  onEditSettings,
}: {
  config: ProjectConfig | null
  onEditSettings: () => void
}) {
  return (
    <div className="sidebar-panel-section">
      <div className="sidebar-section-header">
        <h3>Project</h3>
        <button className="btn btn-sm" onClick={onEditSettings}>
          {config ? 'Edit…' : 'Name this project…'}
        </button>
      </div>
      {config ? (
        <div className="entity-row project-summary">
          <span className="entity-title" title={config.name}>
            {config.title || config.name}
          </span>
          {config.title && (
            <span className="entity-file" title={config.name}>
              {config.name}
            </span>
          )}
        </div>
      ) : (
        <p className="empty-hint">
          This workspace has no <code>likec4.config.json</code> yet - unnamed projects work fine, this
          is only for giving it an id/title (used by tooling and cross-project imports).
        </p>
      )}
    </div>
  )
}
