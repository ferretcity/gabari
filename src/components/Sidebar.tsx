import { useState } from 'react'
import type {
  DeploymentInstanceSummary,
  DeploymentNodeKindSpec,
  DeploymentNodeSummary,
  DeploymentRelationSummary,
  ElementKindSpec,
  ElementSummary,
  RelationSummary,
} from '../likec4/engine'
import type { Files } from '../likec4/fileKeys'
import type { ProjectConfig } from '../likec4/projectConfig'
import type { DisseminateDocument } from '../likec4/disseminate'
import Library from './Library'
import ProjectSection from './ProjectSection'
import FileTree from './FileTree'
import Deployment from './Deployment'
import Disseminate from './Disseminate'
import ActivityBar, { type SidebarPanel } from './ActivityBar'

const ELEMENT_DND_TYPE = 'application/x-likec4-element-fqn'

export default function Sidebar({
  width,
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onRenameFile,
  onDeleteFile,
  projectConfig,
  onEditProjectSettings,
  elements,
  relationships,
  elementKinds,
  onAddElement,
  onAddRelation,
  onDeleteElement,
  onDeleteRelation,
  onEditSpec,
  onNestInto,
  onMoveElement,
  onEditElement,
  onEditRelation,
  deploymentNodeKinds,
  deploymentNodes,
  deploymentInstances,
  deploymentRelations,
  onAddDeploymentNode,
  onAddDeployedInstance,
  onAddDeploymentRelation,
  onEditDeploymentNode,
  onEditDeployedInstance,
  onDeleteDeploymentNode,
  onDeleteDeployedInstance,
  onDeleteDeploymentRelation,
  busy,
  connectPendingSource,
  onStartConnect,
  onPickConnectTarget,
  panel,
  onSetPanel,
  disseminateDocuments,
  disseminateActiveDocId,
  onSelectDisseminateDocument,
  onCreateDisseminateDocument,
  onDeleteDisseminateDocument,
}: {
  width: number
  files: Files
  activeFile: string
  onSelectFile: (file: string) => void
  onAddFile: () => void
  onRenameFile: (oldName: string, newName: string) => void
  onDeleteFile: (file: string) => void
  projectConfig: ProjectConfig | null
  onEditProjectSettings: () => void
  elements: ElementSummary[]
  relationships: RelationSummary[]
  elementKinds: ElementKindSpec[]
  onAddElement: () => void
  onAddRelation: () => void
  onDeleteElement: (fqn: string) => void
  onDeleteRelation: (id: string) => void
  onEditSpec: () => void
  onNestInto: (parentFqn: string) => void
  onMoveElement: (fqn: string, newParentFqn: string | null) => void
  onEditElement: (fqn: string) => void
  onEditRelation: (id: string) => void
  deploymentNodeKinds: DeploymentNodeKindSpec[]
  deploymentNodes: DeploymentNodeSummary[]
  deploymentInstances: DeploymentInstanceSummary[]
  deploymentRelations: DeploymentRelationSummary[]
  onAddDeploymentNode: (parentFqn: string | null) => void
  onAddDeployedInstance: (parentNodeFqn: string) => void
  onAddDeploymentRelation: () => void
  onEditDeploymentNode: (fqn: string) => void
  onEditDeployedInstance: (fqn: string) => void
  onDeleteDeploymentNode: (fqn: string) => void
  onDeleteDeployedInstance: (fqn: string) => void
  onDeleteDeploymentRelation: (id: string) => void
  busy: boolean
  connectPendingSource: string | null
  onStartConnect: (fqn: string) => void
  onPickConnectTarget: (fqn: string) => void
  panel: SidebarPanel
  onSetPanel: (panel: SidebarPanel) => void
  disseminateDocuments: DisseminateDocument[]
  disseminateActiveDocId: string | null
  onSelectDisseminateDocument: (id: string | null) => void
  onCreateDisseminateDocument: (title: string) => void
  onDeleteDisseminateDocument: (id: string) => void
}) {
  const titleOf = (fqn: string) => elements.find(e => e.id === fqn)?.title || fqn
  // A project is almost always one file - only show "which file is this
  // in" badges once there's actually more than one, so a single-file
  // project doesn't get the same filename repeated on every row for no
  // reason.
  const showFileBadges = Object.keys(files).length > 1
  const [dragOverFqn, setDragOverFqn] = useState<string | null | 'TOP'>(null)

  const acceptElementDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(ELEMENT_DND_TYPE)

  return (
    <div className="sidebar">
      <ActivityBar active={panel} onSelect={onSetPanel} />
      <aside className="sidebar-panel" style={{ width }}>
      {panel === 'files' && (
        <>
          <ProjectSection config={projectConfig} onEditSettings={onEditProjectSettings} />
          <FileTree
            files={files}
            activeFile={activeFile}
            onSelectFile={onSelectFile}
            onAddFile={onAddFile}
            onRenameFile={onRenameFile}
            onDeleteFile={onDeleteFile}
            busy={busy}
          />
        </>
      )}

      {panel === 'library' && <Library elementKinds={elementKinds} onEditSpec={onEditSpec} />}

      {panel === 'deployment' && (
        <Deployment
          nodeKinds={deploymentNodeKinds}
          nodes={deploymentNodes}
          instances={deploymentInstances}
          relations={deploymentRelations}
          elements={elements}
          onAddNode={onAddDeploymentNode}
          onAddInstance={onAddDeployedInstance}
          onAddRelation={onAddDeploymentRelation}
          onEditNode={onEditDeploymentNode}
          onEditInstance={onEditDeployedInstance}
          onDeleteNode={onDeleteDeploymentNode}
          onDeleteInstance={onDeleteDeployedInstance}
          onDeleteRelation={onDeleteDeploymentRelation}
          busy={busy}
        />
      )}

      {panel === 'disseminate' && (
        <Disseminate
          documents={disseminateDocuments}
          activeDocId={disseminateActiveDocId}
          onSelectDocument={onSelectDisseminateDocument}
          onCreateDocument={onCreateDisseminateDocument}
          onDeleteDocument={onDeleteDisseminateDocument}
        />
      )}

      {panel === 'model' && (
      <>
      <details className="sidebar-section" open>
        <summary className="sidebar-section-header">
          <span className="section-title">
            <span className="chevron" aria-hidden="true">
              ▸
            </span>
            <h3>Elements</h3>
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={e => {
              e.stopPropagation()
              onAddElement()
            }}
            disabled={busy}
          >
            + Element
          </button>
        </summary>
        <ul
          className={'entity-list' + (dragOverFqn === 'TOP' ? ' drop-target' : '')}
          onDragOver={e => {
            if (!acceptElementDrag(e)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDragOverFqn('TOP')
          }}
          onDragLeave={() => setDragOverFqn(prev => (prev === 'TOP' ? null : prev))}
          onDrop={e => {
            if (!acceptElementDrag(e)) return
            e.preventDefault()
            setDragOverFqn(null)
            const fqn = e.dataTransfer.getData(ELEMENT_DND_TYPE)
            if (fqn) onMoveElement(fqn, null)
          }}
        >
          {elements.length === 0 && <li className="empty-hint">No elements yet</li>}
          {elements.map(el => {
            const isPending = connectPendingSource === el.id
            return (
              <li
                key={el.id}
                draggable
                className={
                  'entity-row' +
                  (isPending ? ' pending-source' : '') +
                  (dragOverFqn === el.id ? ' drop-target' : '')
                }
                style={{ paddingLeft: (el.id.split('.').length - 1) * 14 }}
                onClick={() => connectPendingSource && !isPending && onPickConnectTarget(el.id)}
                onDragStart={e => {
                  e.dataTransfer.setData(ELEMENT_DND_TYPE, el.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={e => {
                  if (!acceptElementDrag(e)) return
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverFqn(el.id)
                }}
                onDragLeave={e => {
                  e.stopPropagation()
                  setDragOverFqn(prev => (prev === el.id ? null : prev))
                }}
                onDrop={e => {
                  if (!acceptElementDrag(e)) return
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOverFqn(null)
                  const draggedFqn = e.dataTransfer.getData(ELEMENT_DND_TYPE)
                  if (draggedFqn && draggedFqn !== el.id) onMoveElement(draggedFqn, el.id)
                }}
                title="Drag onto another element to nest it there, or onto the list background for top level"
              >
                <span className="entity-kind">{el.kind}</span>
                <span className="entity-title" title={el.id}>
                  {el.title || el.id}
                </span>
                {showFileBadges && (
                  <span className="entity-file" title={`Defined in ${el.file}`}>
                    {el.file}
                  </span>
                )}
                <button
                  className="icon-btn edit-btn"
                  aria-label={`Edit ${el.id}`}
                  title="Edit title / description"
                  onClick={e => {
                    e.stopPropagation()
                    onEditElement(el.id)
                  }}
                  disabled={busy}
                >
                  ✎
                </button>
                <button
                  className="icon-btn nest-btn"
                  aria-label={`Add element nested inside ${el.id}`}
                  title="Add a new element nested inside this one"
                  onClick={e => {
                    e.stopPropagation()
                    onNestInto(el.id)
                  }}
                  disabled={busy}
                >
                  ⊕
                </button>
                <button
                  className="icon-btn connect-btn"
                  aria-label={`Connect from ${el.id}`}
                  title="Start a connection from here"
                  onClick={e => {
                    e.stopPropagation()
                    onStartConnect(el.id)
                  }}
                  disabled={busy}
                >
                  ⇥
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Delete ${el.id}`}
                  onClick={e => {
                    e.stopPropagation()
                    onDeleteElement(el.id)
                  }}
                  disabled={busy}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      </details>

      <details className="sidebar-section" open>
        <summary className="sidebar-section-header">
          <span className="section-title">
            <span className="chevron" aria-hidden="true">
              ▸
            </span>
            <h3>Relationships</h3>
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={e => {
              e.stopPropagation()
              onAddRelation()
            }}
            disabled={busy || elements.length < 1}
          >
            + Relationship
          </button>
        </summary>
        <ul className="entity-list">
          {relationships.length === 0 && <li className="empty-hint">No relationships yet</li>}
          {relationships.map(rel => (
            <li key={rel.id} className="entity-row">
              <span className="entity-title">
                {titleOf(rel.source)} → {titleOf(rel.target)}
                {rel.title ? ` : ${rel.title}` : ''}
              </span>
              {showFileBadges && (
                <span className="entity-file" title={`Defined in ${rel.file}`}>
                  {rel.file}
                </span>
              )}
              <button
                className="icon-btn edit-btn"
                aria-label="Edit relationship"
                title="Edit label"
                onClick={() => onEditRelation(rel.id)}
                disabled={busy}
              >
                ✎
              </button>
              <button
                className="icon-btn"
                aria-label="Delete relationship"
                onClick={() => onDeleteRelation(rel.id)}
                disabled={busy}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </details>
      </>
      )}
      </aside>
    </div>
  )
}
