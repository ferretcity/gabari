import { useMemo, useState, type ReactNode } from 'react'
import type { LikeC4Model } from '@likec4/core/model'
import type { LayoutType, LayoutedView } from '@likec4/core/types'
import {
  DefaultMantineProvider,
  LikeC4Diagram,
  LikeC4EditorProvider,
  LikeC4ModelProvider,
  createLikeC4Editor,
} from '@likec4/diagram'
import '@likec4/diagram/styles.css'
import { KIND_DND_TYPE } from './Library'
import { InfoIcon } from './icons'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import { findNodeFqnAtPoint } from '../likec4/domHitTest'
import { techIconRenderer } from '../likec4/icons'
import type { ManualLayouts } from '../likec4/manualLayouts'
import type { ViewSummary } from '../likec4/engine'
import type { DecisionRecord } from '../likec4/decisions'
import { buildViewTree, type ViewTreeNode } from '../likec4/viewOrganization'

export default function DiagramPanel({
  model,
  diagrams,
  views,
  activeViewId,
  decisionRecords,
  onOpenDecision,
  revision,
  connectHint,
  manualLayouts,
  onSaveManualLayout,
  onResetManualLayout,
  onNodeClick,
  onNodeContextMenu,
  onEdgeContextMenu,
  onDropKind,
  onAddStep,
  onManageViewContents,
  onManageDeploymentViewContents,
  onSelectView,
  onAddView,
  onAddDeploymentView,
  onEditView,
  onDeleteView,
  onNavigateToView,
  viewMode,
  onSetViewMode,
  colorScheme,
  busy,
}: {
  model: LikeC4Model.Layouted | null
  diagrams: LayoutedView[]
  /** view metadata (title, element-vs-dynamic) - same set as `diagrams`;
   * also what the page-tab strip renders one tab per */
  views: ViewSummary[]
  /** which view is showing; `null` renders the empty state */
  activeViewId: string | null
  /** decisions linked to the active view itself, or to any element
   * rendered as a node within it - see `decisions.ts`'s
   * `relatedDecisionRecords` (same computation Disseminate reports
   * already use, just for whichever view is on screen right now) */
  decisionRecords: DecisionRecord[]
  /** jump to a decision in the sidebar - path is `DecisionRecord.path` */
  onOpenDecision: (path: string) => void
  /** bumped on every successful parse, used to force the canvas to re-fit */
  revision: number
  /** shown as a banner when connect-mode is active */
  connectHint: string | null
  /** per-view saved node positions, from dragging nodes on the canvas */
  manualLayouts: ManualLayouts
  onSaveManualLayout: (viewId: string, layout: LayoutedView) => void
  onResetManualLayout: (viewId: string) => void
  onNodeClick?: (id: string) => void
  onNodeContextMenu?: (id: string, x: number, y: number) => void
  onEdgeContextMenu?: (id: string, x: number, y: number) => void
  onDropKind: (kind: string, parentFqn: string | null) => void
  /** shown as a "+ Step" button in the canvas toolbar, only while a dynamic view is active */
  onAddStep: () => void
  /** canvas toolbar's "Elements in view…" button (hidden for a dynamic
   * view, which has no include/exclude rules) - opens the checklist that
   * toggles existing elements' visibility in just this view */
  onManageViewContents: () => void
  /** deployment mode's own "Contents in view…" button - opens the
   * deployment-layer twin of the dialog above (see
   * `DeploymentContentsDialog` - deliberately not shared with
   * `onManageViewContents`) */
  onManageDeploymentViewContents: () => void
  /** clicking a page tab - the sole way to switch views (Visio/draw.io-style
   * page tabs, one per view, rather than a separate sidebar list) */
  onSelectView: (id: string) => void
  /** the logical tab strip's trailing "+" button */
  onAddView: () => void
  /** the deployment tab strip's trailing "+" button - opens
   * `AddDeploymentViewDialog`, never `AddViewDialog` */
  onAddDeploymentView: () => void
  /** double-click a tab, or right-click -> Edit… - title/scope */
  onEditView: (id: string) => void
  /** right-click a tab -> Delete */
  onDeleteView: (id: string) => void
  /** LikeC4's own "drill down" affordance: a node whose element has a
   * scoped view (`view id of <fqn> { }`) renders navigable, and clicking
   * it fires this with that view's id - wired straight to the same
   * switcher as clicking a tab. */
  onNavigateToView: (viewId: string) => void
  /** "Logical" or "Deployment" - which page-tab strip is showing. Two
   * fully separate strips (never merged into one badged list), switched
   * by the toggle rendered just above them. */
  viewMode: 'logical' | 'deployment'
  onSetViewMode: (mode: 'logical' | 'deployment') => void
  /** The app's resolved light/dark choice, or `undefined` for "follow the
   * OS" - handed straight to `DefaultMantineProvider`'s `forceColorScheme`
   * below. Without this, `@likec4/diagram`'s own Mantine-based rendering
   * (which drives the canvas background/controls, not just dialogs) has
   * no provider at all in this app and silently defaults to light,
   * regardless of our own theme toggle - ground-truthed live: picking
   * "Dark" turned the chrome dark but left the canvas a stark white. */
  colorScheme: 'light' | 'dark' | undefined
  busy: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const [dragOverNode, setDragOverNode] = useState<string | null>(null)
  const [viewContextMenu, setViewContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [decisionsMenu, setDecisionsMenu] = useState<{ x: number; y: number } | null>(null)
  const activeIsDynamic = views.find(v => v.id === activeViewId)?.isDynamic ?? false
  // Two fully separate view lists, one per mode - never merged into a
  // single badged strip (see the deployment-support plan's "keep the
  // layers apart" rule).
  const currentModeViews = views.filter(v => (viewMode === 'deployment' ? v.isDeployment : !v.isDeployment))
  // Folders (from "/" in a view's title) + manual `order` - LikeC4's own
  // view-organization convention (https://likec4.dev/dsl/views/organize/),
  // computed fresh per mode so a folder never mixes Logical and Deployment
  // tabs together.
  const viewTree = useMemo(() => buildViewTree(currentModeViews), [currentModeViews])

  // LikeC4's edge renderer only recomputes an edge's path live from current
  // node positions while a *control point* is present (see
  // useRelationshipEdgePath.ts upstream: falls back to a frozen,
  // pre-computed path otherwise) - so a plain relationship's line doesn't
  // track a dragged node at all. Giving every edge a (currently trivial)
  // controlPoints array switches it onto that live-tracking path. This
  // needs the raw `view` object, not `viewId` - `ReactLikeC4` only exposes
  // the latter (it resolves the view from the model), so we use the
  // lower-level `LikeC4Diagram` directly and patch the view ourselves.
  //
  // Real cross-reload persistence works the same way: we merge each node's
  // saved x/y from `manualLayouts` (localStorage) straight into the `view`
  // object handed to `LikeC4Diagram` on every render, including the first
  // one after a reload. (An alternative exists - patching `manualLayouts`
  // into `LikeC4Model.create()`'s data, which `@likec4/core` does actually
  // consume via `LikeC4ViewModel`'s `$manual`/`$layouted` getters - but
  // `LikeC4Diagram` here renders from this `view` prop directly, not from
  // `model.findView(id).$layouted`, so that mechanism is never consulted;
  // patching `view` directly is both simpler and the only path that's
  // actually in effect.)
  const activeView = useMemo(() => {
    const view = diagrams.find(d => d.id === activeViewId)
    if (!view) return null
    const saved = activeViewId ? manualLayouts[activeViewId] : undefined
    const savedNodesById = saved ? new Map(saved.nodes.map(n => [n.id, n])) : null
    const newNodesById = new Map(
      view.nodes.map(n => {
        const s = savedNodesById?.get(n.id)
        return [n.id, s ? { ...n, x: s.x, y: s.y } : n] as const
      }),
    )

    // A relationship's label position (`labelBBox`) is a frozen, absolute
    // coordinate baked in at layout time - LikeC4's own edge renderer only
    // ever recomputes it while *dragging the edge's control point*
    // (RelationshipEdge.tsx's `labelPos`/`labelX`/`labelY`), never in
    // response to a node moving. So once a node's position is overridden
    // above, its edges' labels would otherwise stay pinned to where the
    // line used to be, floating off to the side of the now-moved line.
    // Fix: shift each edge's labelBBox by the same delta its midpoint
    // moved (using original vs. new node centers), the same
    // offset-preserving trick the library uses internally for
    // control-point drags.
    const center = (n: { x: number; y: number; width: number; height: number }) => ({
      x: n.x + n.width / 2,
      y: n.y + n.height / 2,
    })
    return {
      ...view,
      nodes: view.nodes.map(n => newNodesById.get(n.id)!),
      edges: view.edges.map(e => {
        const patched = { ...e, controlPoints: e.controlPoints ?? [] }
        const oldSource = view.nodes.find(n => n.id === e.source)
        const oldTarget = view.nodes.find(n => n.id === e.target)
        const newSource = newNodesById.get(e.source)
        const newTarget = newNodesById.get(e.target)
        if (!e.labelBBox || !oldSource || !oldTarget || !newSource || !newTarget) return patched
        const oldMid = { x: (center(oldSource).x + center(oldTarget).x) / 2, y: (center(oldSource).y + center(oldTarget).y) / 2 }
        const newMid = { x: (center(newSource).x + center(newTarget).x) / 2, y: (center(newSource).y + center(newTarget).y) / 2 }
        const dx = newMid.x - oldMid.x
        const dy = newMid.y - oldMid.y
        if (dx === 0 && dy === 0) return patched
        return { ...patched, labelBBox: { ...e.labelBBox, x: e.labelBBox.x + dx, y: e.labelBBox.y + dy } }
      }),
    }
  }, [diagrams, activeViewId, manualLayouts])

  // Providing this editor is what unlocks drag-to-reposition: LikeC4Diagram
  // only sets `nodesDraggable` when an editor context is present, and
  // dragging a node emits a `save-view-snapshot` change, which we persist
  // via `onSaveManualLayout` (-> localStorage). `fetchView` here is *not*
  // what feeds saved positions back into rendering, though - confirmed by
  // instrumentation that it's never called by anything on (re)mount. The
  // actual read side is the `activeView` merge above, which applies
  // `manualLayouts` directly to the `view` object we hand to
  // `LikeC4Diagram`. This `fetchView` implementation is kept only because
  // `createLikeC4Editor` requires one; it's unreachable dead code for now.
  const editor = useMemo(
    () =>
      createLikeC4Editor({
        fetchView: (fetchViewId: string, layoutType?: LayoutType) => {
          if (layoutType === 'manual' && manualLayouts[fetchViewId]) {
            return manualLayouts[fetchViewId]
          }
          const view = diagrams.find(d => d.id === fetchViewId)
          if (!view) throw new Error(`View "${fetchViewId}" not found`)
          return view
        },
        handleChange: (changeViewId: string, change) => {
          if (change.op === 'save-view-snapshot') {
            onSaveManualLayout(changeViewId, change.layout)
          } else if (change.op === 'reset-manual-layout') {
            onResetManualLayout(changeViewId)
          }
          return { waitForViewSync: false }
        },
      }),
    [diagrams, manualLayouts, onSaveManualLayout, onResetManualLayout],
  )

  const acceptLibraryDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(KIND_DND_TYPE)

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!acceptLibraryDrag(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
      setDragOverNode(findNodeFqnAtPoint(e.clientX, e.clientY))
    },
    onDragLeave: () => {
      setDragOver(false)
      setDragOverNode(null)
    },
    onDrop: (e: React.DragEvent) => {
      const kind = e.dataTransfer.getData(KIND_DND_TYPE)
      const parentFqn = findNodeFqnAtPoint(e.clientX, e.clientY)
      setDragOver(false)
      setDragOverNode(null)
      if (kind) {
        e.preventDefault()
        onDropKind(kind, parentFqn)
      }
    },
  }

  /** One tab button - unchanged from before folders existed, just pulled
   * out so it can be called from the recursive tree walk below. */
  const renderViewTab = (v: ViewSummary) => (
    <button
      key={v.id}
      type="button"
      className={'view-tab' + (v.id === activeViewId ? ' active' : '')}
      onClick={() => onSelectView(v.id)}
      onDoubleClick={() => onEditView(v.id)}
      onContextMenu={e => {
        e.preventDefault()
        setViewContextMenu({ id: v.id, x: e.clientX, y: e.clientY })
      }}
      title={v.viewOf ? `${v.id} — scoped to "${v.viewOf}"` : v.id}
    >
      {v.isDynamic && (
        <span className="view-tab-badge" title="Dynamic view">
          ⚡
        </span>
      )}
      {v.viewOf && (
        <span className="view-tab-badge" title={`Scoped to "${v.viewOf}"`}>
          ⊙
        </span>
      )}
      {v.title || v.id}
    </button>
  )

  /** Walks the folder tree (see `viewOrganization.ts`) into one flat row:
   * a non-interactive folder-label chip immediately before that folder's
   * own tabs (recursing into sub-folders the same way), so the strip stays
   * one horizontal row of tabs with lightweight group labels rather than a
   * full nested tree widget. Root-level (unfoldered) views render exactly
   * as before - no label. */
  const renderViewTabTree = (nodes: ViewTreeNode[]): ReactNode[] =>
    nodes.flatMap(node =>
      node.type === 'folder'
        ? [
            <span key={`folder:${node.path}`} className="view-tab-folder-label" title={node.path}>
              {node.title} ▸
            </span>,
            ...renderViewTabTree(node.children),
          ]
        : [renderViewTab(node.view)],
    )

  const viewContextMenuItems: ContextMenuItem[] = viewContextMenu
    ? [
        { label: 'Edit…', onSelect: () => onEditView(viewContextMenu.id) },
        {
          label: 'Delete',
          danger: true,
          disabled: currentModeViews.length <= 1,
          onSelect: () => onDeleteView(viewContextMenu.id),
        },
      ]
    : []

  return (
    <div className={'diagram-panel' + (dragOver ? ' drag-over' : '')} {...dragHandlers}>
      {connectHint && <div className="connect-banner">{connectHint}</div>}
      {dragOver && (
        <div className="drop-hint">{dragOverNode ? `Drop to nest inside "${dragOverNode}"` : 'Drop to add element'}</div>
      )}

      {/* Logical vs. Deployment: two fully separate page-tab strips, never
          merged into one badged list - switched by this toggle, matching
          the same layer split as the sidebar's activity bar and the
          Specification editor. */}
      <div className="view-mode-toggle">
        <button
          type="button"
          className={'view-mode-btn' + (viewMode === 'logical' ? ' active' : '')}
          onClick={() => onSetViewMode('logical')}
        >
          Logical
        </button>
        <button
          type="button"
          className={'view-mode-btn' + (viewMode === 'deployment' ? ' active' : '')}
          onClick={() => onSetViewMode('deployment')}
        >
          Deployment
        </button>
      </div>

      {/* Page tabs, one per view - the Visio/draw.io convention: switching
          views happens by clicking a tab here, not from a separate list
          elsewhere. Double-click (or right-click -> Edit…) to rename/rescope
          a tab, right-click -> Delete to remove it; "+" adds a new one -
          always shown, even with zero tabs in this mode yet, so there's
          always a way to add the first one. */}
      <div className="view-tabstrip">
        {renderViewTabTree(viewTree)}
          <button
            type="button"
            className="view-tab-add"
            aria-label={viewMode === 'logical' ? 'Add view' : 'Add deployment view'}
            title={viewMode === 'logical' ? 'Add view' : 'Add deployment view'}
            onClick={viewMode === 'logical' ? onAddView : onAddDeploymentView}
            disabled={busy}
          >
            +
          </button>
        </div>
      {viewContextMenu && (
        <ContextMenu
          x={viewContextMenu.x}
          y={viewContextMenu.y}
          items={viewContextMenuItems}
          onClose={() => setViewContextMenu(null)}
        />
      )}
      {decisionsMenu && (
        <ContextMenu
          x={decisionsMenu.x}
          y={decisionsMenu.y}
          items={decisionRecords.map(d => ({
            label: `${d.id}: ${d.title} (${d.status})`,
            onSelect: () => onOpenDecision(d.path),
          }))}
          onClose={() => setDecisionsMenu(null)}
        />
      )}

      {!model || !activeViewId || currentModeViews.length === 0 ? (
        <div className="diagram-empty">
          <p>
            {viewMode === 'deployment'
              ? 'No deployment view yet — click "+" above to add one, then build the tree from the Deployment panel.'
              : 'Nothing to render yet — add an element, or drag one in from the Specification panel.'}
          </p>
        </div>
      ) : (
        <>
          <div className="canvas-toolbar">
            {activeIsDynamic && (
              <button className="btn btn-sm" onClick={onAddStep}>
                + Step
              </button>
            )}
            {!activeIsDynamic && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={viewMode === 'deployment' ? onManageDeploymentViewContents : onManageViewContents}
                title="Choose which existing elements this view shows - separate from adding new ones to the project"
              >
                {viewMode === 'deployment' ? 'Contents in view…' : 'Elements in view…'}
              </button>
            )}
            {decisionRecords.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                title="Decisions linked to this view, or to an element rendered in it"
                onClick={e => setDecisionsMenu({ x: e.clientX, y: e.clientY })}
              >
                🔗 {decisionRecords.length} decision{decisionRecords.length === 1 ? '' : 's'}
              </button>
            )}
            <div className="canvas-toolbar-spacer" />
            <button
              type="button"
              className="drag-hint"
              title="Unlock the diagram (top-right corner of the canvas) to drag nodes. Positions save automatically per view and survive edits and reloads."
            >
              <InfoIcon />
              Reposition nodes
            </button>
          </div>
          {!activeView ? (
            <div className="diagram-empty">
              <p>
                {activeIsDynamic
                  ? 'This dynamic view has no steps yet — click "+ Step" above to add the first one.'
                  : viewMode === 'deployment'
                    ? 'Nothing to render yet — build the deployment tree from the Deployment panel in the sidebar.'
                    : 'Nothing to render yet — add an element, or drag one in from the Specification panel.'}
              </p>
            </div>
          ) : (
          <div className="diagram-canvas">
            <DefaultMantineProvider forceColorScheme={colorScheme}>
            <LikeC4EditorProvider editor={editor}>
              <LikeC4ModelProvider likec4model={model} key={activeViewId + ':' + revision}>
                <LikeC4Diagram
                  view={activeView as never}
                  pannable
                  zoomable
                  controls
                  // Not `showNavigationButtons` (its own back/forward): each
                  // view switch remounts `LikeC4ModelProvider` (the `key`
                  // below), which wipes the diagram's internal navigation
                  // history on every jump - the buttons would render but
                  // never actually go anywhere. The page-tab strip above is
                  // the real (working) way back.
                  showNavigationButtons={false}
                  background="dots"
                  renderIcon={techIconRenderer}
                  onNavigateTo={to => onNavigateToView(to)}
                  onNodeClick={onNodeClick ? node => onNodeClick(node.id) : undefined}
                  onNodeContextMenu={
                    onNodeContextMenu
                      ? (node, event) => {
                          event.preventDefault()
                          onNodeContextMenu(node.id, event.clientX, event.clientY)
                        }
                      : undefined
                  }
                  onEdgeContextMenu={
                    onEdgeContextMenu
                      ? (edge, event) => {
                          event.preventDefault()
                          // `edge.id` is the diagram edge's own id, not the
                          // underlying relationship's - a diagram edge can
                          // aggregate several relations, listed in `.relations`.
                          // We only ever render one relation per edge, so the
                          // first is the one to edit/delete.
                          const relationId = (edge as unknown as { relations?: string[] }).relations?.[0]
                          if (relationId) onEdgeContextMenu(relationId, event.clientX, event.clientY)
                        }
                      : undefined
                  }
                />
              </LikeC4ModelProvider>
            </LikeC4EditorProvider>
            </DefaultMantineProvider>
          </div>
          )}
        </>
      )}
    </div>
  )
}
