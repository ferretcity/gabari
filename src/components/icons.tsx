/**
 * Small inline icon set for the activity bar - dependency-free (no icon
 * library), monochrome via `currentColor` so each one just inherits
 * whatever color its button is styled with (including the active/hover
 * states), and themes automatically with light/dark mode for free.
 */

const commonProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** The app's mark - a drafting set-square with a measurement tick, nodding
 * to "gabarit" (a technical drafting template/gauge - see the README's
 * name-origin note): rigorous enough to be a real spec, light enough to
 * redraw on the fly. Meant to sit in a small colored badge (see
 * `.logo-badge` in index.css), not used bare. */
export function LogoMark() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <path d="M4.5 19.5v-15l15 15h-15z" />
      <path d="M4.5 13.5h5M9.5 19.5v-5" />
    </svg>
  )
}

/** Small outline glyph for each of `dslGen.ts`'s `ELEMENT_SHAPES` - used
 * to preview a kind's shape in the Library palette and the Specification
 * editor, the same way a shape-library panel (draw.io, Lucidchart) shows
 * a little icon per shape rather than a bare color swatch. Deliberately
 * simplified silhouettes, not a pixel-accurate reproduction of how
 * `@likec4/diagram` draws each one. */
export function ShapeGlyph({ shape }: { shape: string }) {
  switch (shape) {
    case 'component':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="6.5" y="4" width="14" height="16" rx="1.3" />
          <rect x="3" y="7.5" width="4" height="3" rx="0.8" />
          <rect x="3" y="13.5" width="4" height="3" rx="0.8" />
        </svg>
      )
    case 'person':
      return (
        <svg {...commonProps} aria-hidden="true">
          <circle cx="12" cy="7" r="3.2" />
          <path d="M5.5 20c0-4 3-6.5 6.5-6.5S18.5 16 18.5 20" />
        </svg>
      )
    case 'browser':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="15" rx="1.3" />
          <path d="M3 9h18" />
        </svg>
      )
    case 'mobile':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="7.5" y="2.5" width="9" height="19" rx="2" />
          <path d="M11 18.5h2" />
        </svg>
      )
    case 'cylinder':
      return (
        <svg {...commonProps} aria-hidden="true">
          <ellipse cx="12" cy="5.8" rx="8" ry="2.6" />
          <path d="M4 5.8v12.4c0 1.4 3.5 2.6 8 2.6s8-1.2 8-2.6V5.8" />
        </svg>
      )
    case 'storage':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="1.3" />
          <path d="M3 10h18" />
        </svg>
      )
    case 'queue':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="3" y="7" width="18" height="10" rx="1.3" />
          <path d="M9 7v10M15 7v10" />
        </svg>
      )
    case 'bucket':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M5 6h14l-1.4 12.8a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 6z" />
          <path d="M3.5 6h17" />
        </svg>
      )
    case 'document':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M4 3.8h16v13.8c-2 0-2 2.4-4 2.4s-2-2.4-4-2.4-2 2.4-4 2.4-2-2.4-4-2.4V3.8z" />
        </svg>
      )
    case 'rectangle':
    default:
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="1.3" />
        </svg>
      )
  }
}

export function InfoIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5v.01" />
    </svg>
  )
}

export function FolderIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <path d="M3.5 5.5a1 1 0 0 1 1-1H9l2 2h8.5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-13z" />
    </svg>
  )
}

export function LibraryIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  )
}

export function ModelIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="6" rx="1.2" />
      <rect x="13.5" y="15" width="7.5" height="6" rx="1.2" />
      <path d="M10.5 6h4a2 2 0 0 1 2 2v7" />
    </svg>
  )
}

/** A small stack of server racks - the deployment layer's icon, visually
 * distinct from `ModelIcon`'s boxes-and-arrow (the logical model), since
 * the two are kept as separate a concept throughout the app as possible. */
export function DeploymentIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="5.5" rx="1.2" />
      <rect x="3.5" y="15" width="17" height="5.5" rx="1.2" />
      <path d="M7 6.25h.01M7 17.75h.01" />
    </svg>
  )
}

/** An upward arrow out of an open tray - the standard "export/publish"
 * glyph, for the Disseminate activity (turning a view into a document-
 * like artifact you send elsewhere, rather than something you keep
 * editing in the model itself). */
export function DisseminateIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <path d="M12 3v11" />
      <path d="M7.5 7.5 12 3l4.5 4.5" />
      <path d="M4 14v4.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  )
}

/** A checklist - ADRs, requirements, governance changes, and compliance
 * items are all, at heart, a record of something decided/required and
 * whether it's been satisfied. */
export function DecisionsIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 8h6M9 16h4" />
      <path d="m8.3 11.7 1.2 1.2 2.2-2.4" />
    </svg>
  )
}

export function SunIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
    </svg>
  )
}

export function SystemThemeIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M8.5 20h7M12 16.5V20" />
    </svg>
  )
}

/** GitHub's own mark - filled, not the house stroke style (see this
 * file's own doc comment) - a recognizable brand logo is exactly what
 * makes a "connect with GitHub" option scannable, the one deliberate
 * exception to the monochrome-outline convention used everywhere else. */
export function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .319.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

/** GitLab's tanuki mark - same filled-logo exception as `GitHubIcon`. */
export function GitLabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0539.8585.8585 0 0 0-.3362.4051L.4331 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.0292.0203 4.9908 3.7377 2.4706 1.8691 1.505 1.1375a1.0058 1.0058 0 0 0 1.2141 0l1.505-1.1375 2.4706-1.8691 5.0201-3.758.0113-.0087a6.0657 6.0657 0 0 0 2.0044-7.0105" />
    </svg>
  )
}
