/**
 * Multi-file projects are represented as a `Record<string, string>` keyed by
 * a relative file path (e.g. `"model.c4"`, `"shared/aws.c4"`). `fromSources`
 * mounts each key under a virtual workspace root, so both `locate()`'s
 * `Location.uri` and `getErrors()`'s `sourceFsPath` need decoding back into
 * that same key - these two helpers do that.
 *
 * Deliberately dependency-free (no `vscode-uri`/`langium` import) - see the
 * README's pnpm section for why an implicit transitive dependency
 * (`@likec4/icons`) once broke under pnpm's non-flat node_modules; the fix
 * there was "always depend on what you use", and the fix here is simpler
 * still: don't use it in the first place when a two-line regex suffices.
 */

/** A multi-file LikeC4 project: relative file path -> DSL source text. */
export type Files = Record<string, string>

/** The file every brand-new project starts with, and the fallback used
 * whenever a `files` record is otherwise empty. */
export const DEFAULT_FILE = 'model.c4'

/**
 * Decode a `locate()`-style `Location.uri` (e.g.
 * `"virtual:/workspace/shared/aws.c4"`, percent-encoded) back into its
 * `files` record key (`"shared/aws.c4"`).
 */
export function fileKeyFromLocationUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^virtual:\/workspace\//, ''))
}

/**
 * Decode a `getErrors()`-style `sourceFsPath` (e.g. `"/workspace/shared/aws.c4"`,
 * already percent-decoded by the underlying `vscode-uri`) back into its
 * `files` record key.
 */
export function fileKeyFromFsPath(fsPath: string): string {
  return fsPath.replace(/^[\\/]workspace[\\/]/, '')
}
