import type { Files } from './fileKeys'

/**
 * Decisions - ADRs, requirements, governance changes, and compliance
 * items, each a plain markdown file (frontmatter + body) under
 * `decisions/`. Deliberately *not* an issue tracker integration (GitLab/
 * Jira) - every other piece of Gabari's state is a file you (or an
 * agent) can read and hand-edit, and this is no different. "Annotating"
 * one onto a specific element/view/relationship isn't a bespoke side-
 * table Gabari has to invent and keep in sync either - it's LikeC4's own
 * native `link <path> ['label']` mechanism (see `mutate.ts`'s
 * `addLink`/`removeLink`), so the cross-reference is real DSL, not
 * something only Gabari understands.
 *
 * The frontmatter here is intentionally *not* real YAML - just flat
 * `key: value` pairs, which is all four kinds ever need (`id`, `kind`,
 * `title`, `status`). A hand-written parse/serialize pair keeps this
 * dependency-free, matching every other file format in this app.
 */

export type DecisionKind = 'adr' | 'requirement' | 'governance' | 'compliance'
export type DecisionStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded'

export const DECISIONS_FOLDER = 'decisions'

export const DECISION_STATUSES: DecisionStatus[] = ['proposed', 'accepted', 'deprecated', 'superseded']

/** Per-kind display label, id prefix (`ADR-0001`), and starter body
 * template - the four flavors named for the feature: solution
 * architecture's ADRs and functional/non-functional requirements,
 * enterprise architecture's governance changes, security architecture's
 * compliance items. */
export const DECISION_KIND_INFO: Record<DecisionKind, { label: string; prefix: string; template: string }> = {
  adr: {
    label: 'Decision (ADR)',
    prefix: 'ADR',
    template: `## Context

What's the situation that calls for a decision?

## Decision

What did we decide?

## Consequences

What becomes easier or harder as a result?
`,
  },
  requirement: {
    label: 'Requirement',
    prefix: 'REQ',
    template: `WHEN <trigger> THE <system> SHALL <response>.

Add acceptance criteria, constraints, or rationale here.
`,
  },
  governance: {
    label: 'Governance',
    prefix: 'GOV',
    template: `## Policy / standard changed

What changed?

## Effective date

When does this take effect?

## Rationale

Why is this changing?

## Applies to

Which parts of the architecture does this govern?
`,
  },
  compliance: {
    label: 'Compliance',
    prefix: 'COMP',
    template: `## Control

Control id/name.

## Framework / standard

e.g. SOC 2, ISO 27001, GDPR.

## Requirement

What must be true?

## Evidence

How is this satisfied or verified?
`,
  },
}

export interface DecisionRecord {
  /** the file's own key in `files` - stable for the record's lifetime
   * once created, even if the title changes later, since existing
   * `link` statements elsewhere in the DSL point at this exact path. */
  path: string
  id: string
  kind: DecisionKind
  title: string
  status: DecisionStatus
  body: string
}

export function isDecisionFile(path: string): boolean {
  return path.startsWith(`${DECISIONS_FOLDER}/`) && path.endsWith('.md')
}

function unquoteYaml(raw: string): string {
  const t = raw.trim()
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1)
  return t
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function parseFrontmatter(text: string): { data: Record<string, string>; body: string } | null {
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') return null
  const data: Record<string, string> = {}
  let i = 1
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      i++
      break
    }
    const m = lines[i].match(/^([A-Za-z_][\w-]*):[ \t]?(.*)$/)
    if (m) data[m[1]] = unquoteYaml(m[2])
  }
  return { data, body: lines.slice(i).join('\n').replace(/^\n+/, '') }
}

function isDecisionKind(v: string): v is DecisionKind {
  return v === 'adr' || v === 'requirement' || v === 'governance' || v === 'compliance'
}

function isDecisionStatus(v: string): v is DecisionStatus {
  return (DECISION_STATUSES as string[]).includes(v)
}

/** Every decision record currently in the project. A malformed/
 * unrecognized file is skipped rather than crashing the whole panel
 * (same defensiveness as `disseminate.ts`'s `listDisseminateDocuments`). */
export function listDecisions(files: Files): DecisionRecord[] {
  const records: DecisionRecord[] = []
  for (const [path, text] of Object.entries(files)) {
    if (!isDecisionFile(path)) continue
    const record = parseDecisionFile(path, text)
    if (record) records.push(record)
  }
  return records.sort((a, b) => a.id.localeCompare(b.id))
}

function parseDecisionFile(path: string, text: string): DecisionRecord | null {
  const parsed = parseFrontmatter(text)
  if (!parsed) return null
  const { data, body } = parsed
  if (!data.id || !data.kind || !data.title || !isDecisionKind(data.kind) || !isDecisionStatus(data.status ?? '')) return null
  return { path, id: data.id, kind: data.kind, title: data.title, status: data.status as DecisionStatus, body }
}

export function readDecision(files: Files, path: string): DecisionRecord | null {
  const text = files[path]
  return text === undefined ? null : parseDecisionFile(path, text)
}

function serialize(record: DecisionRecord): string {
  const body = record.body.replace(/\s+$/, '')
  return `---\nid: ${record.id}\nkind: ${record.kind}\ntitle: ${quoteYaml(record.title)}\nstatus: ${record.status}\n---\n${body}\n`
}

export function writeDecision(files: Files, record: DecisionRecord): Files {
  return { ...files, [record.path]: serialize(record) }
}

export function deleteDecision(files: Files, path: string): Files {
  const next = { ...files }
  delete next[path]
  return next
}

function slugify(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
}

/** Next sequential id for `kind` (`ADR-0001`, `ADR-0002`, ...) - same
 * numbering spirit as the well-known `adr-tools` convention. */
export function newDecisionId(kind: DecisionKind, existing: DecisionRecord[]): string {
  const prefix = DECISION_KIND_INFO[kind].prefix
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  let max = 0
  for (const d of existing) {
    const m = re.exec(d.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

/** The file path a brand-new record gets - stable from then on (see
 * `DecisionRecord.path`'s own note); only ever computed once, at
 * creation. */
export function newDecisionPath(id: string, title: string): string {
  return `${DECISIONS_FOLDER}/${id.toLowerCase()}-${slugify(title)}.md`
}

export interface DecisionUsage {
  type: 'element' | 'relation' | 'view'
  id: string
  label: string
}

/** Every element/relationship/view currently linking to the decision at
 * `decisionPath` - reads straight off `ElementSummary`/`RelationSummary`/
 * `ViewSummary`'s own `decisionLinks` (computed once per parse in
 * `engine.ts`), so this is just a filter, not a fresh model walk.
 * Duck-typed rather than importing `engine.ts`'s summary types by name,
 * to avoid a needless import cycle (`engine.ts` already imports
 * `isDecisionFile` from this module). */
export function decisionUsages(
  decisionPath: string,
  elements: ReadonlyArray<{ id: string; title: string; decisionLinks: DecisionLinkRef[] }>,
  relations: ReadonlyArray<{ id: string; source: string; target: string; title: string | null; decisionLinks: DecisionLinkRef[] }>,
  views: ReadonlyArray<{ id: string; title: string; decisionLinks: DecisionLinkRef[] }>,
): DecisionUsage[] {
  const usages: DecisionUsage[] = []
  const linksTo = (links: DecisionLinkRef[]) => links.some(l => l.path === decisionPath)
  for (const e of elements) if (linksTo(e.decisionLinks)) usages.push({ type: 'element', id: e.id, label: e.title || e.id })
  for (const r of relations) {
    if (linksTo(r.decisionLinks)) usages.push({ type: 'relation', id: r.id, label: r.title || `${r.source} → ${r.target}` })
  }
  for (const v of views) if (linksTo(v.decisionLinks)) usages.push({ type: 'view', id: v.id, label: v.title || v.id })
  return usages
}

interface DecisionLinkRef {
  path: string
}

/**
 * Every Decision record that applies to a rendered view - "applies to"
 * meaning either the view itself links to it, or any element rendered
 * as a node within it does (see `DisseminateNotebook.tsx`'s `ViewCell`
 * and `App.tsx`'s HTML export, both of which surface this as a
 * "Related decisions" list under the diagram - the "annotate to
 * elements/views... on report" half of the feature). `nodeElementIds`
 * is the rendered `LayoutedView`'s own node `modelRef`s - the fqns
 * actually on screen in that view, not just any element that happens to
 * exist in the project.
 */
export function relatedDecisionRecords(
  viewId: string,
  nodeElementIds: ReadonlyArray<string | undefined>,
  elements: ReadonlyArray<{ id: string; decisionLinks: DecisionLinkRef[] }>,
  views: ReadonlyArray<{ id: string; decisionLinks: DecisionLinkRef[] }>,
  records: DecisionRecord[],
): DecisionRecord[] {
  const paths = new Set<string>()
  const view = views.find(v => v.id === viewId)
  if (view) for (const l of view.decisionLinks) paths.add(l.path)
  for (const fqn of nodeElementIds) {
    if (!fqn) continue
    const el = elements.find(e => e.id === fqn)
    if (el) for (const l of el.decisionLinks) paths.add(l.path)
  }
  return records.filter(r => paths.has(r.path))
}
