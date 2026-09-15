import { Suspense, createElement, useMemo, useState } from 'react'
import Modal from './Modal'
import { BORDER_STYLES, ELEMENT_SHAPES, ELEMENT_SIZES, THEME_COLORS } from '../likec4/dslGen'
import { ALL_ICON_NAMES, ICON_SET_PREFIXES, resolveBundledIcon } from '../likec4/icons'
import type { ElementSummary } from '../likec4/engine'
import type { ElementStyleInput } from '../likec4/dslGen'

/** Up to 30 icon names matching `query` - names whose part after the `:`
 * starts with it rank first, then any other substring match. `query` is
 * already lowercased. */
function matchIconNames(query: string): string[] {
  if (!query) return []
  const starts: string[] = []
  const includes: string[] = []
  for (const name of ALL_ICON_NAMES) {
    const afterColon = name.slice(name.indexOf(':') + 1)
    if (afterColon.startsWith(query)) starts.push(name)
    else if (name.includes(query)) includes.push(name)
    if (starts.length >= 30) break
  }
  return [...starts, ...includes].slice(0, 30)
}

/** Text input for the Icon field with a filtered dropdown of matching
 * bundled icon names (~5,200 total - `matchIconNames` narrows that down as
 * you type, since a dropdown sized for the whole catalog isn't usable).
 * Still a free-text field underneath - a URL or an icon this app doesn't
 * know about is accepted the same as any suggestion. */
function IconAutocompleteInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const suggestions = useMemo(() => matchIconNames(value.trim().toLowerCase()), [value])

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="icon-autocomplete">
      <input
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => setOpen(true)}
        // A suggestion's onMouseDown (below) fires before this blur, but
        // still needs the list to survive it - the delay gives that click
        // a chance to land before the dropdown unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (!open || suggestions.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlighted(h => Math.min(h + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlighted(h => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(suggestions[highlighted])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder="e.g. tech:react, aws:lambda, or a URL"
      />
      {open && suggestions.length > 0 && (
        <ul className="icon-suggestions">
          {suggestions.map((name, i) => (
            <li
              key={name}
              className={'icon-suggestion' + (i === highlighted ? ' active' : '')}
              // onMouseDown (not onClick) + preventDefault: stops the input
              // from blurring at all on this click, so there's no race
              // with onBlur's dropdown-closing timeout.
              onMouseDown={e => {
                e.preventDefault()
                pick(name)
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Live preview of whatever's currently typed in the Icon field - handles
 * both a bundled `set:name` icon and a plain URL/data-uri (the latter
 * `@likec4/diagram` already renders natively; this preview just mirrors
 * that so the field behaves consistently either way). */
function IconPreview({ icon }: { icon: string }) {
  const trimmed = icon.trim()
  if (!trimmed || trimmed === 'none') return <span className="icon-preview icon-preview-empty" />
  if (/^(https?:|data:image)/.test(trimmed)) {
    return <img src={trimmed} alt="" className="icon-preview" />
  }
  // `resolveBundledIcon` caches by icon value and returns the same
  // component reference across renders (a real component, just resolved
  // dynamically) - using createElement instead of a `<Icon />` JSX tag
  // sidesteps a lint heuristic that (reasonably, in general) flags a
  // PascalCase local bound to a fresh value as "creating a component
  // during render", which isn't what's happening here.
  const resolved = resolveBundledIcon(trimmed)
  if (!resolved) return <span className="icon-preview icon-preview-missing" title="Not a recognized icon">?</span>
  return <Suspense fallback={<span className="icon-preview" />}>{createElement(resolved, { className: 'icon-preview' })}</Suspense>
}

export default function EditElementDialog({
  element,
  onSubmit,
  onClose,
}: {
  element: ElementSummary
  onSubmit: (changes: { title: string; description: string; style: ElementStyleInput }) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(element.title)
  const [description, setDescription] = useState(element.description)
  const [color, setColor] = useState(element.style.color ?? '')
  const [shape, setShape] = useState(element.style.shape ?? '')
  const [border, setBorder] = useState(element.style.border ?? '')
  const [opacity, setOpacity] = useState(element.style.opacity ?? 100)
  const [size, setSize] = useState(element.style.size ?? '')
  const [icon, setIcon] = useState(element.style.icon ?? '')

  return (
    <Modal title={`Edit "${element.id}"`} onClose={onClose}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          onSubmit({
            title: title.trim(),
            description: description.trim(),
            style: {
              color: color || null,
              shape: shape || null,
              border: border || null,
              // Unlike the other fields, opacity has no natural "(default)"
              // sentinel on a range input - always write it explicitly
              // (harmless if it happens to match the kind's own default;
              // treating a particular number like 100 as "clear" would be
              // wrong whenever the kind's actual default isn't 100).
              opacity,
              size: size || null,
              icon: icon.trim() || null,
            },
          })
        }}
      >
        <label>
          Title
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </label>

        <div className="style-grid">
          <label>
            Color
            <select value={color} onChange={e => setColor(e.target.value)}>
              <option value="">(default)</option>
              {THEME_COLORS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shape
            <select value={shape} onChange={e => setShape(e.target.value)}>
              <option value="">(default)</option>
              {ELEMENT_SHAPES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Border
            <select value={border} onChange={e => setBorder(e.target.value)}>
              <option value="">(default)</option>
              {BORDER_STYLES.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size
            <select value={size} onChange={e => setSize(e.target.value)}>
              <option value="">(default)</option>
              {ELEMENT_SIZES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="style-grid-wide">
            Opacity ({opacity}%)
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
            />
          </label>
          <label className="style-grid-wide">
            Icon
            <div className="icon-input-row">
              <IconPreview icon={icon} />
              <IconAutocompleteInput value={icon} onChange={setIcon} />
            </div>
            <span className="field-hint">Bundled sets: {ICON_SET_PREFIXES.join(':*, ')}:*</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
