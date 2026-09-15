import type { ViewSummary } from './engine'

export type ViewTreeNode =
  | { type: 'folder'; path: string; title: string; children: ViewTreeNode[] }
  | { type: 'view'; view: ViewSummary }

interface ViewLeaf {
  view: ViewSummary
  /** position in the original (mode-filtered) array - the tiebreaker for
   * two views with the same (or no) explicit `order`. */
  index: number
}

interface FolderBuilder {
  path: string
  title: string
  subfolders: Map<string, FolderBuilder>
  leaves: ViewLeaf[]
}

function makeFolder(path: string): FolderBuilder {
  const segments = path.split('/')
  return { path, title: segments[segments.length - 1] ?? path, subfolders: new Map(), leaves: [] }
}

/** Finds (creating as needed) every ancestor folder along `path`, so a
 * deeply-nested view also produces its intermediate folder nodes. */
function folderFor(root: FolderBuilder, path: string): FolderBuilder {
  if (!path) return root
  let current = root
  let built = ''
  for (const segment of path.split('/')) {
    built = built ? `${built}/${segment}` : segment
    let next = current.subfolders.get(built)
    if (!next) {
      next = makeFolder(built)
      current.subfolders.set(built, next)
    }
    current = next
  }
  return current
}

/** Folders first (alphabetical by title), then views (by `order` ascending,
 * unset last, original position as the final tiebreaker) - the same
 * ordering `LikeC4ViewsFolder.children` uses upstream. */
function sortFolder(folder: FolderBuilder): ViewTreeNode[] {
  const folderNodes: ViewTreeNode[] = [...folder.subfolders.values()]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(sub => ({ type: 'folder', path: sub.path, title: sub.title, children: sortFolder(sub) }))
  const viewNodes: ViewTreeNode[] = [...folder.leaves]
    .sort((a, b) => {
      if (a.view.order !== null && b.view.order !== null) return a.view.order - b.view.order || a.index - b.index
      if (a.view.order !== null) return -1
      if (b.view.order !== null) return 1
      return a.index - b.index
    })
    .map(leaf => ({ type: 'view', view: leaf.view }))
  return [...folderNodes, ...viewNodes]
}

/**
 * Groups a flat, already-mode-filtered view list (Logical or Deployment,
 * never mixed - see `DiagramPanel.tsx`) into a folder tree, mirroring
 * LikeC4's own view-organization convention
 * (https://likec4.dev/dsl/views/organize/): folders derived from `/` in a
 * view's title (`ViewSummary.folder`), sorted folders-first then views at
 * each level - the same order `LikeC4ViewsFolder.children` uses upstream.
 */
export function buildViewTree(views: ViewSummary[]): ViewTreeNode[] {
  const root = makeFolder('')
  views.forEach((view, index) => {
    folderFor(root, view.folder ?? '').leaves.push({ view, index })
  })
  return sortFolder(root)
}
