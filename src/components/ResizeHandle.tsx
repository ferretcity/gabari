import { useState } from 'react'

/** A draggable divider between two panels - drag horizontally to resize
 * `width` between `min`/`max`, standard IDE-style panel resizing. Reports
 * every intermediate value live via `onChange` (for the panel to track
 * during the drag) and the final value once via `onCommit` (for
 * persisting to localStorage without writing on every pixel of movement). */
export default function ResizeHandle({
  width,
  min = 200,
  max = 480,
  onChange,
  onCommit,
}: {
  width: number
  min?: number
  max?: number
  onChange: (width: number) => void
  onCommit: (width: number) => void
}) {
  const [active, setActive] = useState(false)

  return (
    <div
      className={'resize-handle' + (active ? ' active' : '')}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onDoubleClick={() => {
        onChange(280)
        onCommit(280)
      }}
      onMouseDown={e => {
        e.preventDefault()
        setActive(true)
        const startX = e.clientX
        const startWidth = width
        let last = width
        const onMove = (moveEvent: MouseEvent) => {
          last = Math.min(max, Math.max(min, startWidth + (moveEvent.clientX - startX)))
          onChange(last)
        }
        const onUp = () => {
          setActive(false)
          onCommit(last)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }}
    />
  )
}
