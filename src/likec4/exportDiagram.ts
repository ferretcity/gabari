import { toPng, toSvg } from 'html-to-image'

/** html-to-image clones the DOM and re-serializes it to a standalone SVG,
 * then rasterizes *that* via a fresh `<img>` - a different rendering
 * context than the live page. Two edge-specific details don't survive
 * the trip, ground-truthed live by comparing a capture against the real
 * canvas:
 *
 * 1. `.react-flow__edge-path`'s stroke color/width/dash come from a CSS
 *    class rule, not an inline style or attribute - html-to-image's own
 *    style-inlining pass drops them for these nodes entirely (worse: it
 *    clears whatever *was* on the node first, so even writing a plain
 *    `style` property ourselves beforehand gets wiped along with it -
 *    ground-truthed by capturing straight to SVG text and diffing: an
 *    inlined `style` attribute survives on the page's *first* edge
 *    (inherited from an ancestor `<g>` html-to-image happens to style
 *    correctly) but every edge after it comes out with no color
 *    information whatsoever), so the line disappears entirely.
 * 2. LikeC4's arrowhead `<marker>` paints itself via `fill="context-
 *    stroke"` (SVG2's "inherit the referencing element's stroke" paint) -
 *    a live-rendering-only feature that an `<img>`-loaded SVG resource
 *    doesn't support, so the arrowhead paints with no fill at all.
 *
 * Fix: right before capture, write each edge path's *computed* stroke as
 * plain XML presentation attributes (`stroke`/`stroke-width`/etc, not
 * `style`) - `cloneNode` copies attributes verbatim regardless of
 * whatever html-to-image's own (broken) style pass does to `style`, so
 * this survives even on edges its inliner mangles - and resolve each
 * marker's `context-stroke` to its owning edge's literal stroke color,
 * findable because LikeC4 renders each edge's line and its `<marker>`
 * def as siblings under one `.likec4-edge__markersCtx` group. Reverted
 * immediately after capture so this never leaves a visible trace on the
 * live, on-screen diagram. */
function inlineEdgeVisualsForCapture(root: Element): () => void {
  const ATTRS = ['stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'fill'] as const
  const original = new Map<Element, Map<string, string | null>>()
  const setAttr = (el: Element, name: string, value: string) => {
    let saved = original.get(el)
    if (!saved) {
      saved = new Map()
      original.set(el, saved)
    }
    if (!saved.has(name)) saved.set(name, el.getAttribute(name))
    el.setAttribute(name, value)
  }
  // getComputedStyle may report an unresolved `calc(...)` wrapper for an
  // otherwise-constant length (seen on the edges' wide, near-invisible
  // hit-area path) - presentation attributes want a plain length.
  const stripCalc = (v: string) => v.replace(/^calc\(([^)]+)\)$/, '$1')

  root.querySelectorAll<SVGPathElement>('.react-flow__edge-path').forEach(path => {
    const cs = getComputedStyle(path)
    setAttr(path, 'stroke', cs.stroke)
    setAttr(path, 'stroke-width', stripCalc(cs.strokeWidth))
    setAttr(path, 'stroke-opacity', cs.strokeOpacity)
    setAttr(path, 'stroke-dasharray', cs.strokeDasharray)
  })

  root.querySelectorAll<SVGGElement>('.likec4-edge__markersCtx').forEach(group => {
    const edgePath = group.querySelector<SVGPathElement>('path[marker-end], path[marker-start]')
    if (!edgePath) return
    const edgeColor = getComputedStyle(edgePath).stroke
    group.querySelectorAll<SVGPathElement>('marker path').forEach(markerPath => {
      if (markerPath.getAttribute('fill') === 'context-stroke') setAttr(markerPath, 'fill', edgeColor)
      if (markerPath.getAttribute('stroke') === 'context-fill') setAttr(markerPath, 'stroke', edgeColor)
    })
  })

  return () => {
    for (const [el, attrs] of original) {
      for (const name of ATTRS) {
        const prev = attrs.get(name)
        if (prev === undefined) continue
        if (prev === null) el.removeAttribute(name)
        else el.setAttribute(name, prev)
      }
    }
  }
}

/** Rasterize one rendered `DiagramSnapshot` (found by its
 * `data-section-id` attribute, the same DOM-querying approach
 * `domHitTest.ts` already uses against the live canvas) to a data URL -
 * `png` for universal paste-into-anything compatibility, `svg` for
 * direct embedding in an HTML page (still text-based/crisp, though it
 * wraps the rendered HTML in a `<foreignObject>` rather than being pure
 * vector shapes - some non-browser tools handle that less well than a
 * PNG). Captured at the section's own natural size - "narrower" is a
 * layout-direction decision made before capture (`autoLayout
 * TopBottom`), not something this step tries to solve by shrinking. */
export async function captureSection(
  sectionId: string,
  format: 'png' | 'svg',
  scale: number,
): Promise<string | null> {
  const el = document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"] .diagram-snapshot`)
  if (!el) return null
  const restore = inlineEdgeVisualsForCapture(el)
  try {
    const opts = { pixelRatio: scale, backgroundColor: '#ffffff' }
    return format === 'png' ? await toPng(el, opts) : await toSvg(el, opts)
  } finally {
    restore()
  }
}

export interface ExportedSection {
  id: string
  type: 'view' | 'text'
  title?: string
  caption?: string
  text?: string
  /** data URL, `type === 'view'` only */
  image?: string
  imageWidth?: number
  imageHeight?: number
  /** `type === 'view'` only - every Decision record linked from this
   * view or an element rendered in it (see `decisions.ts`'s
   * `relatedDecisionRecords`), so the "annotate to elements/views... on
   * report" half of that feature survives the static export too, not
   * just the live notebook. */
  relatedDecisions?: Array<{ id: string; title: string; kind: string; status: string }>
}

/** Assemble every section's rendered content into one standalone,
 * scrollable HTML page - no app chrome, images inlined as data URIs so
 * the file is fully self-contained and viewable by just opening it (or
 * pasting its content into a wiki/CMS that accepts raw HTML). */
export function buildDocumentHtml(title: string, sections: ExportedSection[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = sections
    .map(section => {
      if (section.type === 'text') {
        const paragraphs = (section.text ?? '')
          .split(/\n{2,}/)
          .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
          .join('\n')
        return `<section class="text-section">${paragraphs}</section>`
      }
      const img = section.image
        ? `<img src="${section.image}" alt="${esc(section.title ?? '')}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`
        : ''
      const caption = section.caption ? `<figcaption>${esc(section.caption)}</figcaption>` : ''
      const related = section.relatedDecisions?.length
        ? `<ul class="related-decisions">${section.relatedDecisions
            .map(d => `<li><span class="decision-status">${esc(d.status)}</span>${esc(d.id)}: ${esc(d.title)}</li>`)
            .join('')}</ul>`
        : ''
      return `<section class="view-section"><figure>${img}${caption}</figure>${related}</section>`
    })
    .join('\n')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  body { max-width: 900px; margin: 0 auto; padding: 32px 24px 80px; font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1d21; background: #fff; }
  h1 { font-size: 24px; margin: 0 0 32px; }
  section { margin: 0 0 40px; }
  figure { margin: 0; text-align: center; }
  figcaption { margin-top: 8px; font-size: 13px; color: #6b7280; }
  .text-section p { margin: 0 0 12px; }
  .related-decisions { list-style: none; margin: 12px 0 0; padding: 0; font-size: 13px; color: #4b5563; text-align: left; }
  .related-decisions li { margin: 4px 0; }
  .decision-status { font-size: 10px; text-transform: uppercase; background: #f1f2f4; border-radius: 4px; padding: 1px 5px; margin-right: 6px; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
${body}
</body>
</html>
`
}

/** Trigger a browser download of the assembled document - same Blob +
 * synthetic `<a download>` pattern `App.tsx`'s `handleExport` already
 * uses for DSL export. Purely local; never written back into `files`
 * (per the "local download only" scoping decision). */
export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
