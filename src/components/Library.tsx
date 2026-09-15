import type { ElementKindSpec } from '../likec4/engine'
import { elementColorValues } from '../likec4/theme'
import { ShapeGlyph } from './icons'

export const KIND_DND_TYPE = 'application/x-likec4-kind'

/**
 * The specification's declared element kinds, one shape/color-swatched
 * card per kind (previewing its actual default color/shape - ground-truthed
 * against `@likec4/core`'s real theme via `theme.ts` - the way a shape
 * library in draw.io or Lucidchart shows a little icon per shape rather
 * than a bare text label), draggable onto the canvas to add a fresh
 * element of that kind.
 */
export default function Library({
  elementKinds,
  onEditSpec,
}: {
  elementKinds: ElementKindSpec[]
  onEditSpec: () => void
}) {
  return (
    <div className="sidebar-panel-section">
      <div className="sidebar-section-header">
        <h3>Element kinds</h3>
        <button className="btn btn-sm" onClick={onEditSpec}>
          Edit Specification…
        </button>
      </div>
      {elementKinds.length === 0 ? (
        <p className="empty-hint">No element kinds declared yet — click "Edit Specification…" above to add one.</p>
      ) : (
        <div className="library-grid">
          {elementKinds.map(kind => {
            const { fill, stroke, hiContrast } = elementColorValues(kind.color)
            return (
              <div
                key={kind.name}
                className="library-card"
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData(KIND_DND_TYPE, kind.name)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                title={`Drag onto the diagram to add a "${kind.name}"`}
              >
                <span
                  className="library-card-swatch"
                  style={{ background: fill, borderColor: stroke, color: hiContrast }}
                >
                  <ShapeGlyph shape={kind.shape ?? 'rectangle'} />
                </span>
                <span className="library-card-label">{kind.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
