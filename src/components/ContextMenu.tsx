export interface ContextMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** `'separator'` renders a thin divider between groups of items - e.g.
 * separating "New" from the import actions, or import from export, in a
 * toolbar dropdown built on this same component. */
export type ContextMenuEntry = ContextMenuItem | 'separator'

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}) {
  return (
    <div className="context-menu-overlay" onMouseDown={onClose} onContextMenu={e => e.preventDefault()}>
      <ul
        className="context-menu"
        style={{ left: x, top: y }}
        onMouseDown={e => e.stopPropagation()}
      >
        {items.map((item, i) =>
          item === 'separator' ? (
            <li key={i} className="context-menu-separator" role="separator" />
          ) : (
            <li key={i}>
              <button
                className={'context-menu-item' + (item.danger ? ' danger' : '')}
                disabled={item.disabled}
                onClick={() => {
                  onClose()
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
