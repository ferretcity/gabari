import Modal from './Modal'
import type { DeploymentInstanceSummary, DeploymentNodeSummary } from '../likec4/engine'

/**
 * "What's shown in this deployment view" - the deployment-layer twin of
 * `ViewContentsDialog`, kept as its own component (not a generalized/
 * shared one) since the two operate over entirely different id spaces
 * (deployment fqns here, model element fqns there) even though the
 * checklist shape is identical.
 */
export default function DeploymentContentsDialog({
  viewTitle,
  nodes,
  instances,
  includedIds,
  onToggle,
  onClose,
}: {
  viewTitle: string
  nodes: DeploymentNodeSummary[]
  instances: DeploymentInstanceSummary[]
  /** ids of deployment elements this view currently renders, per its live layout */
  includedIds: Set<string>
  onToggle: (fqn: string, included: boolean) => void
  onClose: () => void
}) {
  const rows = [
    ...nodes.map(n => ({ id: n.id, label: n.title || n.id, kind: n.kind, depth: n.id.split('.').length - 1 })),
    ...instances.map(i => ({
      id: i.id,
      label: i.title || i.id,
      kind: `→ ${i.elementFqn}`,
      depth: i.id.split('.').length - 1,
    })),
  ]

  return (
    <Modal title={`Elements in "${viewTitle}"`} onClose={onClose}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Checked deployment nodes/instances render in this view; unchecking one doesn't delete it from
        the tree, just hides it here.
      </p>
      {rows.length === 0 ? (
        <p className="empty-hint">No deployment nodes yet - build the tree from the Deployment panel first.</p>
      ) : (
        <ul className="entity-list">
          {rows.map(row => {
            const checked = includedIds.has(row.id)
            return (
              <li key={row.id} className="entity-row" style={{ paddingLeft: row.depth * 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: 0 }}>
                  <input type="checkbox" checked={checked} onChange={e => onToggle(row.id, e.target.checked)} />
                  <span className="entity-kind">{row.kind}</span>
                  <span className="entity-title" title={row.id}>
                    {row.label}
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
