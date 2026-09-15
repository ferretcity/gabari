import { useMemo } from 'react'
import { LikeC4Diagram, LikeC4ModelProvider, DefaultMantineProvider } from '@likec4/diagram'
import type { LikeC4Model } from '@likec4/core/model'
import type { LayoutedView } from '@likec4/core/types'
import { techIconRenderer } from '../likec4/icons'

/**
 * Renders one view, used by the Disseminate activity in two modes:
 *
 * - `interactive` (editing a section's layout): fills its container,
 *   pan/zoom on, so you can inspect a sandboxed `autoLayout` override
 *   before applying it for real.
 * - static/snapshot (default - the "Preview document" mode, and what
 *   `exportDiagram.ts`'s `captureSection` captures for the HTML export):
 *   no pan/zoom, sized to the view's own natural (Graphviz-computed)
 *   pixel bounds, `fitView` so it renders exactly once, at full size -
 *   "narrower" is a layout-direction decision made *before* this renders,
 *   not something this component solves by shrinking. What you see in
 *   Preview *is* what gets exported, not an approximation of it.
 *
 * No top-left controls panel and no dotted-grid background in either
 * mode - this is meant to read as a published document, not as a
 * React-Flow canvas (that chrome is reserved for the main Design/
 * Deployment canvas in `DiagramPanel.tsx`, which is untouched). React
 * Flow's own attribution link is hidden separately via CSS (`index.css`,
 * `.diagram-snapshot .react-flow__attribution`) since `LikeC4Diagram`
 * doesn't expose a prop for it.
 *
 * Forces light mode regardless of the editor's own theme - a published
 * document is read standalone, not inside Gabari's own dark/light
 * toggle.
 */
export default function DiagramSnapshot({
  model,
  view,
  interactive = false,
}: {
  model: LikeC4Model.Layouted
  view: LayoutedView
  interactive?: boolean
}) {
  // Same fix as DiagramPanel.tsx's main canvas, for the same reason:
  // LikeC4's edge renderer only recomputes an edge's path live when a
  // *control point* is present - without one it falls back to a frozen,
  // pre-computed path (see useRelationshipEdgePath.ts upstream). That
  // frozen path is what actually breaks here - ground-truthed live: a
  // view rendered at a fixed pixel size + `fitView` (this component's
  // static/snapshot mode) measures/settles its layout in a different
  // pass than the interactive canvas does, and a frozen edge path can
  // end up visibly detached from its now-repositioned nodes. Same patch,
  // same one-line cause, even though nothing here drags nodes.
  const patchedView = useMemo(
    () => ({ ...view, edges: view.edges.map(e => ({ ...e, controlPoints: e.controlPoints ?? [] })) }),
    [view],
  )
  return (
    <div
      className={'diagram-snapshot' + (interactive ? ' diagram-snapshot-interactive' : '')}
      style={interactive ? undefined : { width: view.bounds.width, height: view.bounds.height }}
    >
      <DefaultMantineProvider forceColorScheme="light">
        <LikeC4ModelProvider likec4model={model}>
          <LikeC4Diagram
            view={patchedView as never}
            pannable={interactive}
            zoomable={interactive}
            controls={false}
            fitView
            background="transparent"
            renderIcon={techIconRenderer}
          />
        </LikeC4ModelProvider>
      </DefaultMantineProvider>
    </div>
  )
}
