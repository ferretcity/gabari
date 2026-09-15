import { fromSources } from '@likec4/language-services/browser'
import type { LikeC4Model } from '@likec4/core/model'
import type { LayoutedView } from '@likec4/core/types'
import { DEFAULT_FILE, fileKeyFromFsPath, fileKeyFromLocationUri, type Files } from './fileKeys'
import { PROJECT_CONFIG_FILE, currentProjectId, readProjectConfig, type ProjectConfig } from './projectConfig'
import { isDisseminateDocFile } from './disseminate'

export interface ElementStyleSummary {
  color: string | null
  shape: string | null
  border: string | null
  /** 0-100 */
  opacity: number | null
  size: string | null
  /** e.g. "tech:react", "aws:lambda", a bare URL, or null if unset */
  icon: string | null
}

export interface ElementSummary {
  /** fully-qualified id, e.g. "webApp.ui" */
  id: string
  kind: string
  title: string
  description: string
  parent: string | null
  /** which `files` record key declares this element - a project spans
   * every file, so this is the only way to tell where to go edit it by
   * hand */
  file: string
  /** effective style (kind defaults merged with any per-instance override) */
  style: ElementStyleSummary
}

/** Pull the plain text out of a LikeC4 MarkdownOrString-shaped value. */
function plainText(value: unknown): string {
  const source = (value as { $source?: { txt?: string } } | null | undefined)?.$source
  return source?.txt ?? ''
}

export interface RelationSummary {
  id: string
  source: string
  target: string
  title: string | null
  /** which `files` record key declares this relationship */
  file: string
  /** effective style (relationship-kind defaults merged with any override) */
  color: string | null
  line: string | null
  head: string | null
  tail: string | null
}

export interface ViewSummary {
  id: string
  /** Display title - just the leaf segment, folder prefix stripped (LikeC4
   * derives folder placement from title text and exposes the two
   * separately; see `folder` below). This is what tabs/dialog headings
   * should show - `titlePath` is the one to seed an editable title field
   * with, since it's what actually needs writing back verbatim. */
  title: string
  /** The full title text as it should be written back to source -
   * includes the folder prefix (e.g. "Domain/Checkout"), unlike `title`.
   * Editing dialogs must seed their Title field from this, not `title`,
   * or saving would silently drop the view out of its folder. */
  titlePath: string
  isDynamic: boolean
  /** `deployment view id { ... }` - a view of the deployment tree, not
   * the logical model. Kept structurally separate everywhere in the UI
   * (own tab strip, own dialogs) even though it's tracked as one flag
   * here for simplicity. */
  isDeployment: boolean
  /** fqn of the element this view is scoped to (`view id of <fqn> { ... }`),
   * or null for a regular top-level view. A scoped view's `include *`
   * expands to that element's children plus its directly-related
   * neighbors - LikeC4's own "drill down into this element" view, and
   * what `LikeC4Diagram`'s `onNavigateTo` jumps to when a node has one. */
  viewOf: string | null
  /** explicit `order N` body property, if set - lower sorts first (see
   * `viewOrganization.ts`'s `buildViewTree`). `null` when unset, in which
   * case the view just keeps declaration order among its unordered
   * siblings. */
  order: number | null
  /** folder path derived from `/` in the view's title (or a `views 'x' {
   * }'` block's shared prefix), e.g. "Domain/Checkout" - LikeC4's own
   * view-organization convention (https://likec4.dev/dsl/views/organize/),
   * not anything Gabari invents. `null` for a top-level (unfoldered) view. */
  folder: string | null
  /** which `files` record key declares this view */
  file: string
}

export interface ParseError {
  message: string
  line: number
  /** which `files` record key this error came from */
  file: string
}

export interface ElementKindSpec {
  name: string
  color: string | null
  shape: string | null
}

export interface RelationshipKindSpec {
  name: string
  color: string | null
  line: string | null
}

export interface TagSpec {
  name: string
  color: string | null
}

/** A `deploymentNode <name> { style { ... } }` specification entry - the
 * deployment layer's own kind namespace, separate from `element` kinds. */
export interface DeploymentNodeKindSpec {
  name: string
  color: string | null
  shape: string | null
}

/** A deployment node - an infrastructure node in the `deployment { }`
 * tree (`kind name { ... }`), distinct from a model `ElementSummary`: this
 * is *where* things run, not *what* they are. */
export interface DeploymentNodeSummary {
  /** deployment fqn, e.g. "euZone.web1" - its own id space, separate from
   * model element fqns */
  id: string
  kind: string
  title: string
  parent: string | null
  file: string
}

/** A deployed instance - one model element (`elementFqn`) running inside
 * a deployment node (`instanceOf <elementFqn>`, only ever nested). */
export interface DeploymentInstanceSummary {
  id: string
  /** the model element this instance wraps */
  elementFqn: string
  title: string
  parent: string
  file: string
}

/** A relationship between two deployment elements (nodes and/or
 * instances) - the deployment layer's own relations, separate from model
 * `RelationSummary`s even though the shape is identical. */
export interface DeploymentRelationSummary {
  id: string
  source: string
  target: string
  title: string | null
  file: string
}

export interface ParseResult {
  ok: boolean
  errors: ParseError[]
  elements: ElementSummary[]
  relationships: RelationSummary[]
  /** element kinds declared in the specification block */
  kinds: string[]
  relationshipKinds: string[]
  elementKindSpecs: ElementKindSpec[]
  relationshipKindSpecs: RelationshipKindSpec[]
  tagSpecs: TagSpec[]
  /** deployment node kinds declared in the specification block (the
   * deployment layer's own kind namespace - see `DeploymentNodeKindSpec`) */
  deploymentNodeKinds: DeploymentNodeKindSpec[]
  /** the deployment tree - infrastructure nodes, deployed instances, and
   * relations between them, all separate from the model/`elements` above */
  deploymentNodes: DeploymentNodeSummary[]
  deploymentInstances: DeploymentInstanceSummary[]
  deploymentRelations: DeploymentRelationSummary[]
  views: ViewSummary[]
  diagrams: LayoutedView[]
  /** ready to hand to <LikeC4ModelProvider likec4model={...}> */
  layoutedModel: LikeC4Model.Layouted | null
  /** this workspace's own `likec4.config.json`, if it has one - `null`
   * means an unnamed/default project (today's behavior, unchanged) */
  projectConfig: ProjectConfig | null
}

const EMPTY: Omit<ParseResult, 'ok' | 'errors'> = {
  elements: [],
  relationships: [],
  kinds: [],
  relationshipKinds: [],
  elementKindSpecs: [],
  relationshipKindSpecs: [],
  tagSpecs: [],
  deploymentNodeKinds: [],
  deploymentNodes: [],
  deploymentInstances: [],
  deploymentRelations: [],
  views: [],
  diagrams: [],
  layoutedModel: null,
  projectConfig: null,
}

interface RawSpec {
  elements?: Record<string, { style?: { color?: string; shape?: string } }>
  relationships?: Record<string, { style?: { color?: string; line?: string } }>
  tags?: Record<string, { color?: string }>
  /** deployment node kinds - ground-truthed live: structurally identical
   * to `elements`, just a separate top-level key. */
  deployments?: Record<string, { style?: { color?: string; shape?: string } }>
}

export async function parseFiles(files: Files): Promise<ParseResult> {
  let likec4
  try {
    // Disseminate document files (`disseminate/*.c4doc.json` - see
    // disseminate.ts) are a Gabari-invented artifact, not LikeC4 source -
    // `fromSources` has no way to know that and would try (and fail) to
    // parse their JSON as DSL, same as it already special-cases
    // `likec4.config.json` by filename but can't know about ours. Only
    // filtered out of what gets *parsed*; `files` itself (passed to
    // `readProjectConfig`/git sync/the file tree/etc. below and
    // elsewhere) is untouched.
    const withoutDisseminateDocs = Object.fromEntries(
      Object.entries(files).filter(([key]) => !isDisseminateDocFile(key)),
    )
    const sources = Object.keys(withoutDisseminateDocs).length ? withoutDisseminateDocs : { [DEFAULT_FILE]: ' ' }
    likec4 = await fromSources(sources)
  } catch (err) {
    return { ok: false, errors: [{ message: String(err), line: 0, file: DEFAULT_FILE }], ...EMPTY }
  }

  const errors = likec4
    .getErrors()
    .map(e => ({ message: e.message, line: e.line, file: fileKeyFromFsPath(e.sourceFsPath) }))
  if (errors.length) {
    return { ok: false, errors, ...EMPTY }
  }

  const projectConfig = readProjectConfig(files)
  // The one project id this workspace resolves to (see `projectConfig.ts` -
  // Gabari never loads more than one at a time). `undefined` when there's
  // no `likec4.config.json`, which every language-service call below
  // already treats as "the single/default project" - today's behavior,
  // unchanged.
  const projectId = currentProjectId(files)

  // A stray `likec4.config.json` anywhere else in `files` (e.g. copied in
  // from an example/fixture folder) registers as its *own* project -
  // ground-truthed live: with no root config to prefer, the language
  // service refuses to guess and `computedModel()` throws. Gabari's one
  // workspace = one project rule means we don't build a switcher for this;
  // instead, surface it as a clear, actionable diagnostic - add a root
  // `likec4.config.json` (Project Settings…) naming the one you want.
  if (!projectId && likec4.projectsManager.hasMultipleProjects()) {
    const names = [...likec4.projectsManager.all].filter(id => id !== 'default').join(', ')
    return {
      ok: false,
      errors: [
        {
          message:
            `This workspace contains more than one LikeC4 project (${names}) and has no root ` +
            `${PROJECT_CONFIG_FILE} to pick one. Gabari works with a single project at a time - ` +
            `set one via "Project Settings…", or remove the extra project folder.`,
          line: 0,
          file: DEFAULT_FILE,
        },
      ],
      ...EMPTY,
    }
  }

  /** `locate()` is the same "which file is this actually declared in"
   * mechanism `mutate.ts` uses to know where to write an edit - here it's
   * just for display, so a lookup miss (shouldn't normally happen for a
   * real computed entity) falls back to an empty string rather than
   * throwing. */
  const fileOf = (
    loc: { element: string } | { relation: string } | { view: string } | { deployment: string },
  ): string => {
    const location = likec4.languageServices.locate({ ...loc, projectId } as never)
    return location ? fileKeyFromLocationUri(location.uri) : ''
  }

  let computed
  try {
    computed = await likec4.computedModel(projectId)
  } catch (err) {
    // Defensive: only reachable if `projectId` (read straight from this
    // same `files`' own config) somehow doesn't match a registered project
    // - a corrupted/stale config - since the ambiguous-with-no-root case
    // was already handled above.
    return { ok: false, errors: [{ message: String(err), line: 0, file: PROJECT_CONFIG_FILE }], ...EMPTY }
  }
  const elements: ElementSummary[] = [...computed.elements()].map(e => {
    const style = (e as unknown as { style?: ElementStyleSummary }).style
    return {
      id: e.id,
      kind: e.kind,
      title: e.title,
      description: plainText((e as unknown as { description?: unknown }).description),
      parent: e.parent ? e.parent.id : null,
      file: fileOf({ element: e.id }),
      style: {
        color: style?.color ?? null,
        shape: style?.shape ?? null,
        border: style?.border ?? null,
        opacity: style?.opacity ?? null,
        size: style?.size ?? null,
        icon: style?.icon ?? null,
      },
    }
  })
  const relationships: RelationSummary[] = [...computed.relationships()].map(r => {
    const rel = r as unknown as { color?: string; line?: string; head?: string; tail?: string }
    return {
      id: r.id,
      source: r.source.id,
      target: r.target.id,
      title: r.title,
      file: fileOf({ relation: r.id }),
      color: rel.color ?? null,
      line: rel.line ?? null,
      head: rel.head ?? null,
      tail: rel.tail ?? null,
    }
  })
  const views: ViewSummary[] = [...computed.views()].map(v => {
    const view = v as unknown as {
      id: string
      titleOrId: string
      isDynamicView: () => boolean
      isScopedElementView: () => boolean
      isDeploymentView: () => boolean
      viewOf: { id: string } | null
      order: number | undefined
      folder: { isRoot: boolean; path: string }
      viewPath: string
    }
    return {
      id: view.id,
      title: view.titleOrId,
      titlePath: view.viewPath,
      isDynamic: view.isDynamicView(),
      isDeployment: view.isDeploymentView(),
      viewOf: view.isScopedElementView() ? (view.viewOf?.id ?? null) : null,
      order: view.order ?? null,
      folder: view.folder.isRoot ? null : view.folder.path,
      file: fileOf({ view: view.id }),
    }
  })

  // --- Deployment model - infrastructure nodes, deployed instances, and
  // relations between them; a separate layer from `elements`/`relationships`
  // above (see DeploymentNodeSummary/DeploymentInstanceSummary's doc
  // comments). `computed.deployment` is `@likec4/core`'s
  // `LikeC4DeploymentModel`, ground-truthed live against the installed
  // package (ADR: see the deployment-support plan). ---
  const deploymentModel = (
    computed as unknown as {
      deployment: {
        elements: () => Iterable<{
          id: string
          title: string
          parent: { id: string } | null
          kind?: string
          element?: { id: string }
          isInstance: () => boolean
          isDeploymentNode: () => boolean
        }>
        relationships: () => Iterable<{ id: string; source: { id: string }; target: { id: string }; title: string | null }>
      }
    }
  ).deployment
  const deploymentNodes: DeploymentNodeSummary[] = []
  const deploymentInstances: DeploymentInstanceSummary[] = []
  for (const el of deploymentModel.elements()) {
    if (el.isInstance()) {
      deploymentInstances.push({
        id: el.id,
        elementFqn: el.element!.id,
        title: el.title,
        parent: el.parent!.id,
        file: fileOf({ deployment: el.id }),
      })
    } else {
      deploymentNodes.push({
        id: el.id,
        kind: el.kind ?? '',
        title: el.title,
        parent: el.parent ? el.parent.id : null,
        file: fileOf({ deployment: el.id }),
      })
    }
  }
  const deploymentRelations: DeploymentRelationSummary[] = [...deploymentModel.relationships()].map(r => ({
    id: r.id,
    source: r.source.id,
    target: r.target.id,
    title: r.title,
    file: fileOf({ relation: r.id }),
  }))
  const spec = (computed as unknown as { specification?: RawSpec }).specification
  const kinds = Object.keys(spec?.elements ?? {})
  const relationshipKinds = Object.keys(spec?.relationships ?? {})
  const elementKindSpecs: ElementKindSpec[] = Object.entries(spec?.elements ?? {}).map(([name, v]) => ({
    name,
    color: v.style?.color ?? null,
    shape: v.style?.shape ?? null,
  }))
  const relationshipKindSpecs: RelationshipKindSpec[] = Object.entries(spec?.relationships ?? {}).map(
    ([name, v]) => ({
      name,
      color: v.style?.color ?? null,
      line: v.style?.line ?? null,
    }),
  )
  const tagSpecs: TagSpec[] = Object.entries(spec?.tags ?? {}).map(([name, v]) => ({
    name,
    color: v.color ?? null,
  }))
  const deploymentNodeKinds: DeploymentNodeKindSpec[] = Object.entries(spec?.deployments ?? {}).map(
    ([name, v]) => ({
      name,
      color: v.style?.color ?? null,
      shape: v.style?.shape ?? null,
    }),
  )

  let layoutedModel: LikeC4Model.Layouted | null = null
  let diagrams: LayoutedView[] = []
  try {
    layoutedModel = await likec4.layoutedModel(projectId)
    diagrams = await likec4.diagrams(projectId)
  } catch (err) {
    // Parsed fine, but layout (graphviz-wasm) failed - still useful to the
    // user as a source of truth for the element/relationship lists.
    console.warn('LikeC4 layout failed', err)
  }

  return {
    ok: true,
    errors: [],
    elements,
    relationships,
    kinds,
    relationshipKinds,
    elementKindSpecs,
    relationshipKindSpecs,
    tagSpecs,
    deploymentNodeKinds,
    deploymentNodes,
    deploymentInstances,
    deploymentRelations,
    views,
    diagrams,
    layoutedModel,
    projectConfig,
  }
}

/**
 * Parse a single standalone piece of text in isolation, unrelated to the
 * project's own `files` - used only for the drag-and-drop "import a spec
 * preset from a dropped `.c4` file" path (see `App.tsx`'s
 * `handleImportSpecFile`), which needs to parse an arbitrary file on its
 * own rather than as a member of the current multi-file project.
 */
export function parseSingleSource(text: string): Promise<ParseResult> {
  return parseFiles({ 'preset.c4': text })
}
