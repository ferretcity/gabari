/**
 * Shared helpers for deciding what belongs to a connected repo folder -
 * used by both the GitHub and GitLab clients so this logic (and any future
 * tweak to it) lives in exactly one place.
 */

/** Whether `path` (any repo-relative path) is one this app treats as part
 * of a LikeC4 project folder. */
export function isProjectFile(path: string): boolean {
  return (
    /\.(c4|likec4)$/i.test(path) ||
    /(^|\/)likec4\.config\.json$/i.test(path) ||
    /(^|\/)\.likec4\.config\.json$/i.test(path) ||
    /(^|\/)\.likec4rc$/i.test(path) ||
    // Disseminate document definitions (see likec4/disseminate.ts) - not
    // LikeC4 source, but a project-portable Gabari artifact that should
    // survive a folder-import or a repo fetch/push the same as everything
    // else in `files`.
    /\.c4doc\.json$/i.test(path)
  )
}

/** Strip leading/trailing slashes and add exactly one trailing slash (or
 * '' for the repo root), so path-prefix matching/stripping is consistent
 * everywhere it's used. */
export function normalizeFolder(folder: string): string {
  const trimmed = folder.replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed ? trimmed + '/' : ''
}

/** Decode a base64-encoded UTF-8 string (both providers' file-content APIs
 * return content this way). */
export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}
