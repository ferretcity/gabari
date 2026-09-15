import type { Files } from './fileKeys'
import type { ViewLayoutDirection } from './mutate'

/** Where every Disseminate document lives - a plain JSON file per
 * document, under its own folder with a distinctive extension so it's
 * never mistaken for a `.c4` source file in the file tree. Git-portable
 * like everything else in `files` (see `git/projectFiles.ts`'s
 * `isProjectFile`, which needs to recognize this same extension for it to
 * survive a folder-import or a repo fetch/push). */
export const DISSEMINATE_FOLDER = 'disseminate'
const DOC_SUFFIX = '.c4doc.json'

export interface DisseminateSection {
  id: string
  type: 'view' | 'text'
  /** `type === 'view'` only - which view this section renders */
  viewId?: string
  /** `type === 'view'` only - a sandboxed `autoLayout` override, applied
   * for real via `mutate.ts`'s `setViewAutoLayout` once "Apply to view"
   * is clicked; `null`/absent means "render the view exactly as its own
   * DSL already defines it". */
  layout?: { direction: ViewLayoutDirection; rankSep?: number; nodeSep?: number } | null
  /** `type === 'view'` only - optional caption shown under the rendered image */
  caption?: string
  /** `type === 'text'` only - plain text/simple paragraphs, no markdown
   * parser for v0 (see the plan's size-consciousness note) */
  text?: string
  /** An optional, condensed alternative to this section's normal
   * content, used only when exporting to slides (see
   * `exportDiagram.ts`'s `buildSlidesHtml`) - never in the scrolling
   * document export. A text section's full prose is rarely slide-sized,
   * and a view section's caption may want a shorter, presentation-style
   * summary. Blank/absent falls back to the section's normal
   * `text`/`caption`. */
  slideText?: string
}

export interface DisseminateDocument {
  id: string
  title: string
  sections: DisseminateSection[]
}

function docFileKey(id: string): string {
  return `${DISSEMINATE_FOLDER}/${id}${DOC_SUFFIX}`
}

export function isDisseminateDocFile(path: string): boolean {
  return path.startsWith(`${DISSEMINATE_FOLDER}/`) && path.endsWith(DOC_SUFFIX)
}

/** Every Disseminate document currently in the project, parsed from its
 * own file - a malformed/corrupted doc file is skipped rather than
 * crashing the whole panel (same defensiveness as `readProjectConfig`). */
export function listDisseminateDocuments(files: Files): DisseminateDocument[] {
  const docs: DisseminateDocument[] = []
  for (const [path, text] of Object.entries(files)) {
    if (!isDisseminateDocFile(path)) continue
    try {
      const parsed = JSON.parse(text) as Partial<DisseminateDocument>
      if (parsed && typeof parsed.id === 'string' && typeof parsed.title === 'string' && Array.isArray(parsed.sections)) {
        docs.push(parsed as DisseminateDocument)
      }
    } catch {
      // skip - not a valid document file
    }
  }
  return docs.sort((a, b) => a.title.localeCompare(b.title))
}

export function writeDisseminateDocument(files: Files, doc: DisseminateDocument): Files {
  return { ...files, [docFileKey(doc.id)]: JSON.stringify(doc, null, 2) + '\n' }
}

export function deleteDisseminateDocument(files: Files, id: string): Files {
  const next = { ...files }
  delete next[docFileKey(id)]
  return next
}

/** Derive a stable, unique file-safe id from a document title - same
 * "slugify, then dedupe with -2/-3/..." shape used for element/view ids
 * elsewhere in this app (see `dslGen.ts`'s `sanitizeId`). */
export function newDocumentId(title: string, existingIds: ReadonlySet<string>): string {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document'
  let id = base
  for (let n = 2; existingIds.has(id); n++) id = `${base}-${n}`
  return id
}

export function newSectionId(): string {
  return crypto.randomUUID()
}
