import type { Files } from '../likec4/fileKeys'

export interface FileDiff {
  /** folder-relative path -> new text, for files not present in the base snapshot */
  created: Record<string, string>
  /** folder-relative path -> new text, for files present in the base snapshot with different content */
  updated: Record<string, string>
  /** folder-relative paths of every file that was removed */
  deleted: string[]
}

/**
 * Compute the created/updated/deleted sets between a repo snapshot
 * (`base`, the project as of the last fetch/push) and the current
 * in-memory project (`next`) - used by both GitHub's and GitLab's push
 * flow to build their commit payload. Created and updated are kept
 * separate (rather than one combined "added" bucket) because GitLab's
 * Commits API needs to know which `action` to use per file (`create` vs
 * `update`) - GitHub's Git Data API doesn't care about the distinction,
 * but there's no harm in it having the same shape.
 */
export function diffFiles(base: Files, next: Files): FileDiff {
  const created: Record<string, string> = {}
  const updated: Record<string, string> = {}
  for (const [key, text] of Object.entries(next)) {
    if (!(key in base)) created[key] = text
    else if (base[key] !== text) updated[key] = text
  }
  const deleted = Object.keys(base).filter(key => !(key in next))
  return { created, updated, deleted }
}

/** Total number of files touched by a diff - used for UI counts (e.g. the
 * push confirmation dialog and the Push button's disabled state). */
export function fileDiffCount(diff: FileDiff): number {
  return Object.keys(diff.created).length + Object.keys(diff.updated).length + diff.deleted.length
}
