/**
 * Builders for small, valid LikeC4 DSL snippets. Grammar reference:
 * https://github.com/likec4/likec4/blob/main/packages/language-server/src/like-c4.langium
 *
 *   Element: kind id ['title' ['summary' ['technology']]] ['{' tags props* nested* '}']
 *   Relation: source (-> | -[kind]->) target ['title' ['description' ['technology']]] tags?
 *   Tags in a body must come FIRST, before any other property.
 */

import { DEFAULT_FILE } from './fileKeys'

const ID_START = /^([a-zA-Z]|_+[a-zA-Z0-9])/

/** Ground-truthed against the LikeC4 lexer's own token list (ElementStyleProperty). */
export const THEME_COLORS = [
  'primary',
  'secondary',
  'muted',
  'slate',
  'blue',
  'indigo',
  'sky',
  'red',
  'gray',
  'green',
  'amber',
] as const

/** Ground-truthed against the LikeC4 lexer's own token list (ElementStyleProperty shape). */
export const ELEMENT_SHAPES = [
  'rectangle',
  'component',
  'person',
  'browser',
  'mobile',
  'cylinder',
  'storage',
  'queue',
  'bucket',
  'document',
] as const

/** LineOptions grammar rule. */
export const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const

/** Ground-truthed against `@likec4/core`'s `BorderStyles`. */
export const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'none'] as const

/** Ground-truthed against `@likec4/core`'s `Sizes`. */
export const ELEMENT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const

/** Ground-truthed against `@likec4/core`'s `RelationshipArrowTypes`. */
export const RELATIONSHIP_ARROWS = [
  'none',
  'normal',
  'onormal',
  'dot',
  'odot',
  'diamond',
  'odiamond',
  'crow',
  'open',
  'vee',
] as const

/** Make `raw` a valid LikeC4 identifier (IdTerminal: starts with a letter, then word chars/dashes). */
export function sanitizeId(raw: string, fallback = 'el'): string {
  let id = raw.trim().replace(/\s+/g, '-').replace(/[^-\w]/g, '')
  if (!id) id = fallback
  if (!ID_START.test(id)) id = 'el-' + id
  return id
}

/** Quote a string as a LikeC4 single-quoted string literal. */
export function quote(value: string): string {
  return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

export interface NewElementInput {
  id: string
  kind: string
  title?: string
  description?: string
  tags?: string[]
}

/** Build a `kind id 'Title' { ... }` element declaration, always with a body
 * (even if empty) so the element can later accept nested children. */
export function buildElementSnippet(input: NewElementInput): string {
  const header = [input.kind, input.id, input.title ? quote(input.title) : null]
    .filter(Boolean)
    .join(' ')
  const bodyLines: string[] = []
  if (input.tags?.length) {
    bodyLines.push(input.tags.map(t => '#' + sanitizeId(t, 'tag')).join(' '))
  }
  if (input.description) {
    bodyLines.push(`description ${quote(input.description)}`)
  }
  return `${header} {\n${bodyLines.join('\n')}\n}`
}

export interface NewRelationInput {
  sourceFqn: string
  targetFqn: string
  title?: string | null
  kind?: string | null
}

/** Build a `source -> target 'title'` (or `-[kind]->`) relationship statement. */
export function buildRelationSnippet(input: NewRelationInput): string {
  const arrow = input.kind ? `-[${sanitizeId(input.kind, 'rel')}]->` : '->'
  const parts = [input.sourceFqn, arrow, input.targetFqn, input.title ? quote(input.title) : null]
  return parts.filter(Boolean).join(' ')
}

export interface NewElementKindInput {
  name: string
  color?: string | null
  shape?: string | null
}

/** Build an `element kind { style { ... } }` specification entry. */
export function buildElementKindSnippet(input: NewElementKindInput): string {
  const styleLines: string[] = []
  if (input.color) styleLines.push(`color ${input.color}`)
  if (input.shape) styleLines.push(`shape ${input.shape}`)
  if (!styleLines.length) return `element ${input.name}`
  return `element ${input.name} {\n  style {\n${styleLines.map(l => '    ' + l).join('\n')}\n  }\n}`
}

export interface NewDeploymentNodeKindInput {
  name: string
  color?: string | null
  shape?: string | null
}

/** Build a `deploymentNode kind { style { ... } }` specification entry -
 * its own keyword/namespace, separate from `element` kinds, but the same
 * `style { color, shape }` shape (ground-truthed live: the compiled
 * spec's `deployments` entry is structurally identical to an `elements`
 * entry). */
export function buildDeploymentNodeKindSnippet(input: NewDeploymentNodeKindInput): string {
  const styleLines: string[] = []
  if (input.color) styleLines.push(`color ${input.color}`)
  if (input.shape) styleLines.push(`shape ${input.shape}`)
  if (!styleLines.length) return `deploymentNode ${input.name}`
  return `deploymentNode ${input.name} {\n  style {\n${styleLines.map(l => '    ' + l).join('\n')}\n  }\n}`
}

export interface NewRelationshipKindInput {
  name: string
  color?: string | null
  line?: string | null
}

/** Build a `relationship kind { color ... line ... }` specification entry
 * (style properties are flat in a relationship kind's body, unlike an
 * element kind's, which nests them under `style { }`). */
export function buildRelationshipKindSnippet(input: NewRelationshipKindInput): string {
  const lines: string[] = []
  if (input.color) lines.push(`color ${input.color}`)
  if (input.line) lines.push(`line ${input.line}`)
  if (!lines.length) return `relationship ${input.name}`
  return `relationship ${input.name} {\n${lines.map(l => '  ' + l).join('\n')}\n}`
}

export interface NewTagInput {
  name: string
  color?: string | null
}

/** Build a `tag name { color ... }` specification entry. */
export function buildTagSnippet(input: NewTagInput): string {
  if (!input.color) return `tag ${input.name}`
  return `tag ${input.name} {\n  color ${input.color}\n}`
}

/** Per-instance element style override. `null` on a field clears that
 * property (falling back to the element kind's default); `undefined`
 * leaves it untouched. Nested under `style { }` in the element's body. */
export interface ElementStyleInput {
  color?: string | null
  shape?: string | null
  border?: string | null
  /** 0-100; rendered as `opacity N%`. */
  opacity?: number | null
  size?: string | null
  /**
   * `tech:react`, `aws:lambda`, `azure:*`, `gcp:*`, `bootstrap:*` (any of
   * `@likec4/icons`' bundled sets - see `src/likec4/icons.tsx`), a bare
   * `scheme://...` URL, or `none`. Ground-truthed against the real parser:
   * unlike every other style property, this one is **never quoted** - it's
   * its own lexer token (`LIB_ICON` / `URI_WITH_SCHEMA` / ... ), and
   * wrapping it in `'...'` is a parse error.
   */
  icon?: string | null
}

/** Per-instance relationship style override, nested under `style { }` in
 * the relationship's body (unlike a `relationship` spec entry's, whose
 * `color`/`line` are flat - see {@link buildRelationshipKindSnippet}). */
export interface RelationshipStyleInput {
  color?: string | null
  line?: string | null
  head?: string | null
  tail?: string | null
}

export interface NewViewInput {
  id: string
  title?: string
  dynamic?: boolean
  /** fqn of the element to scope this view to (`view id of <fqn> { ... }`) -
   * mutually exclusive with `dynamic` (LikeC4's grammar has no `of` on a
   * dynamic view). Renders that element "zoomed into": its own children
   * plus whatever else directly relates to it. */
  viewOf?: string
  /** explicit `order N` body property - LikeC4's manual view-ordering
   * mechanism (see `viewOrganization.ts`). Omit to leave the view in plain
   * declaration order among its unordered siblings. */
  order?: number
}

/** Build a `view id { title '...' include * }` (or `dynamic view id { title '...' }`,
 * or `view id of <fqn> { title '...' include * }` for a view scoped to one
 * element) declaration. A plain or scoped view defaults to showing every
 * (in-scope) element (`include *`); a dynamic view starts empty - steps
 * are added afterward. */
export function buildViewSnippet(input: NewViewInput): string {
  const header = [input.dynamic ? 'dynamic view' : 'view', input.id]
  if (!input.dynamic && input.viewOf) header.push('of', input.viewOf)
  const bodyLines: string[] = []
  if (input.title) bodyLines.push(`title ${quote(input.title)}`)
  if (input.order !== undefined) bodyLines.push(`order ${input.order}`)
  if (!input.dynamic) bodyLines.push('include *')
  return `${header.join(' ')} {\n${bodyLines.join('\n')}\n}`
}

export interface NewDeploymentNodeInput {
  id: string
  kind: string
  title?: string
}

/** Build a `kind id 'Title' { ... }` deployment node declaration - same
 * shape as {@link buildElementSnippet}, always with a body (even if
 * empty) so it can later accept nested children (instances/other nodes). */
export function buildDeploymentNodeSnippet(input: NewDeploymentNodeInput): string {
  const header = [input.kind, input.id, input.title ? quote(input.title) : null].filter(Boolean).join(' ')
  return `${header} {\n}`
}

export interface NewDeployedInstanceInput {
  /** omit to let LikeC4 derive the instance's own id from the target
   * element's bare name (ground-truthed live: `instanceOf s` inside node
   * `a.b` becomes `a.b.s`, not a generated id) */
  id?: string
  elementFqn: string
  title?: string
}

/** Build a `[id =] instanceOf <elementFqn> ['title']` deployment instance
 * statement - only valid nested inside a `DeploymentNode`'s own body (the
 * grammar has no top-level form). */
export function buildDeployedInstanceSnippet(input: NewDeployedInstanceInput): string {
  const parts = [input.id ? `${input.id} =` : null, 'instanceOf', input.elementFqn, input.title ? quote(input.title) : null]
  return parts.filter(Boolean).join(' ')
}

export interface NewDeploymentRelationInput {
  /** omit when writing directly inside the source node/instance's own
   * body - the grammar's implicit-source form (`-> target`) */
  sourceFqn?: string
  targetFqn: string
  title?: string | null
  kind?: string | null
}

/** Build a `[source] (-> | -[kind]->) target ['title']` deployment
 * relation statement - same shape as {@link buildRelationSnippet}, but
 * `source` is optional (see `NewDeploymentRelationInput.sourceFqn`). */
export function buildDeploymentRelationSnippet(input: NewDeploymentRelationInput): string {
  const arrow = input.kind ? `-[${sanitizeId(input.kind, 'rel')}]->` : '->'
  const parts = [input.sourceFqn ?? null, arrow, input.targetFqn, input.title ? quote(input.title) : null]
  return parts.filter(Boolean).join(' ')
}

export interface NewDeploymentViewInput {
  id: string
  title?: string
}

/** Build a `deployment view id { title '...' include * }` declaration -
 * its own builder, deliberately separate from {@link buildViewSnippet}
 * (deployment views have no dynamic/scoped variants to share a `Type`
 * picker with). */
export function buildDeploymentViewSnippet(input: NewDeploymentViewInput): string {
  const bodyLines: string[] = []
  if (input.title) bodyLines.push(`title ${quote(input.title)}`)
  bodyLines.push('include *')
  return `deployment view ${input.id} {\n${bodyLines.join('\n')}\n}`
}

/** A minimal, valid starter document. */
export const STARTER_SOURCE = `specification {
  element person
  element system
  element container
  element component
}

model {

}

views {
  view index {
    title 'Overview'
    include *
  }
}
`

/** A minimal, valid starter multi-file project - a brand-new project (or
 * "New") starts as a single file, same content as {@link STARTER_SOURCE}. */
export const STARTER_FILES: Record<string, string> = { [DEFAULT_FILE]: STARTER_SOURCE }
