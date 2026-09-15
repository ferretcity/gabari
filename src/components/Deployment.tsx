import type {
  DeploymentInstanceSummary,
  DeploymentNodeKindSpec,
  DeploymentNodeSummary,
  DeploymentRelationSummary,
  ElementSummary,
} from '../likec4/engine'

type TreeEntry =
  | { type: 'node'; data: DeploymentNodeSummary }
  | { type: 'instance'; data: DeploymentInstanceSummary }

/**
 * The deployment tree, built from the flat `deploymentNodes`/
 * `deploymentInstances` arrays via their own `parent` pointers (not path
 * strings, unlike `FileTree.tsx` - a deployment fqn's dots are real
 * nesting, but the parent id is the more direct signal already computed
 * by the model). Root nodes (`parent === null`) come first; everything
 * else nests under whichever node owns it.
 */
function buildTree(
  nodes: DeploymentNodeSummary[],
  instances: DeploymentInstanceSummary[],
): { roots: TreeEntry[]; childrenOf: Map<string, TreeEntry[]> } {
  const childrenOf = new Map<string, TreeEntry[]>()
  const roots: TreeEntry[] = []
  const push = (parent: string | null, entry: TreeEntry) => {
    if (parent == null) {
      roots.push(entry)
      return
    }
    const list = childrenOf.get(parent) ?? []
    list.push(entry)
    childrenOf.set(parent, list)
  }
  for (const n of nodes) push(n.parent, { type: 'node', data: n })
  for (const i of instances) push(i.parent, { type: 'instance', data: i })
  return { roots, childrenOf }
}

export default function Deployment({
  nodeKinds,
  nodes,
  instances,
  relations,
  elements,
  onAddNode,
  onAddInstance,
  onAddRelation,
  onEditNode,
  onEditInstance,
  onDeleteNode,
  onDeleteInstance,
  onDeleteRelation,
  busy,
}: {
  nodeKinds: DeploymentNodeKindSpec[]
  nodes: DeploymentNodeSummary[]
  instances: DeploymentInstanceSummary[]
  relations: DeploymentRelationSummary[]
  /** looked up to show a deployed instance's underlying element title/kind */
  elements: ElementSummary[]
  /** `parentFqn` preselected in the dialog when adding under a specific
   * node (via its own "+" button), `null` for the panel's top-level "+ Node" */
  onAddNode: (parentFqn: string | null) => void
  onAddInstance: (parentNodeFqn: string) => void
  onAddRelation: () => void
  onEditNode: (fqn: string) => void
  onEditInstance: (fqn: string) => void
  onDeleteNode: (fqn: string) => void
  onDeleteInstance: (fqn: string) => void
  onDeleteRelation: (id: string) => void
  busy: boolean
}) {
  const { roots, childrenOf } = buildTree(nodes, instances)
  const titleOf = (fqn: string) => nodes.find(n => n.id === fqn)?.title ?? instances.find(i => i.id === fqn)?.title ?? fqn

  const renderEntry = (entry: TreeEntry, depth: number): React.ReactNode => {
    if (entry.type === 'instance') {
      const inst = entry.data
      const el = elements.find(e => e.id === inst.elementFqn)
      return (
        <li key={inst.id} className="entity-row" style={{ paddingLeft: depth * 14 }}>
          {el && <span className="entity-kind">{el.kind}</span>}
          <span className="entity-title" title={inst.id}>
            {inst.title || inst.id} <span className="deployment-instance-of">→ {inst.elementFqn}</span>
          </span>
          <button
            className="icon-btn edit-btn"
            aria-label={`Edit ${inst.id}`}
            title="Edit title"
            onClick={() => onEditInstance(inst.id)}
            disabled={busy}
          >
            ✎
          </button>
          <button
            className="icon-btn"
            aria-label={`Delete ${inst.id}`}
            onClick={() => onDeleteInstance(inst.id)}
            disabled={busy}
          >
            ✕
          </button>
        </li>
      )
    }
    const node = entry.data
    const children = childrenOf.get(node.id) ?? []
    return (
      <li key={node.id}>
        <div className="entity-row" style={{ paddingLeft: depth * 14 }}>
          <span className="entity-kind">{node.kind}</span>
          <span className="entity-title" title={node.id}>
            {node.title || node.id}
          </span>
          <button
            className="icon-btn nest-btn"
            aria-label={`Add node inside ${node.id}`}
            title="Add a deployment node nested inside this one"
            onClick={() => onAddNode(node.id)}
            disabled={busy}
          >
            ⊕
          </button>
          <button
            className="icon-btn"
            aria-label={`Deploy an element inside ${node.id}`}
            title="Deploy an existing element inside this node"
            onClick={() => onAddInstance(node.id)}
            disabled={busy || elements.length === 0}
          >
            ⇥
          </button>
          <button
            className="icon-btn edit-btn"
            aria-label={`Edit ${node.id}`}
            title="Edit title"
            onClick={() => onEditNode(node.id)}
            disabled={busy}
          >
            ✎
          </button>
          <button
            className="icon-btn"
            aria-label={`Delete ${node.id}`}
            onClick={() => onDeleteNode(node.id)}
            disabled={busy}
          >
            ✕
          </button>
        </div>
        {children.length > 0 && <ul className="entity-list">{children.map(c => renderEntry(c, depth + 1))}</ul>}
      </li>
    )
  }

  return (
    <div className="sidebar-panel-section">
      <div className="sidebar-section-header">
        <h3>Deployment nodes</h3>
        <button className="btn btn-primary btn-sm" onClick={() => onAddNode(null)} disabled={busy || nodeKinds.length === 0}>
          + Node
        </button>
      </div>
      {nodeKinds.length === 0 ? (
        <p className="empty-hint">
          No deployment node kinds declared yet - add one from the Specification editor's "Deployment
          model" section first.
        </p>
      ) : roots.length === 0 ? (
        <p className="empty-hint">No deployment nodes yet - click "+ Node" above to add the first one.</p>
      ) : (
        <ul className="entity-list">{roots.map(r => renderEntry(r, 0))}</ul>
      )}

      <div className="sidebar-section-header" style={{ marginTop: 18 }}>
        <h3>Deployment relationships</h3>
        <button className="btn btn-primary btn-sm" onClick={onAddRelation} disabled={busy || nodes.length + instances.length < 2}>
          + Relationship
        </button>
      </div>
      <ul className="entity-list">
        {relations.length === 0 && <li className="empty-hint">No deployment relationships yet</li>}
        {relations.map(r => (
          <li key={r.id} className="entity-row">
            <span className="entity-title">
              {titleOf(r.source)} → {titleOf(r.target)}
              {r.title ? ` : ${r.title}` : ''}
            </span>
            <button
              className="icon-btn"
              aria-label="Delete deployment relationship"
              onClick={() => onDeleteRelation(r.id)}
              disabled={busy}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
