/**
 * A LikeC4 "project" is just a folder with a `likec4.config.json` at its
 * root - its `name` field is the project's id, the same one used in
 * tooling and cross-project `import ... from "name"` statements
 * (ground-truthed against `@likec4/config`'s `LikeC4ProjectJsonConfigSchema`).
 *
 * Gabari always treats its whole loaded `files` as exactly one project -
 * never several loaded/switchable at once (see the "project support" plan
 * for why: a switcher would fragment one workspace into several, which
 * isn't the goal). This file's only job is reading/writing that one
 * project's own `likec4.config.json`, and resolving its id so
 * engine.ts/mutate.ts can pass it explicitly to the language service
 * instead of relying on ambiguous default-project resolution.
 */

import type { Files } from './fileKeys'

export const PROJECT_CONFIG_FILE = 'likec4.config.json'

/** The three fields Gabari's own UI edits; anything else already present
 * in the file (`metadata`, `extends`, `styles`, ...) is preserved
 * untouched by {@link writeProjectConfig} - read-modify-write over the
 * whole object, not just these fields. */
export interface ProjectConfig {
  name: string
  title?: string
  contactPerson?: string
  [key: string]: unknown
}

/** `null` if there's no config file, it's not valid JSON, or it has no
 * (string) `name` - a project's one required field. */
export function readProjectConfig(files: Files): ProjectConfig | null {
  const raw = files[PROJECT_CONFIG_FILE]
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && typeof (parsed as { name?: unknown }).name === 'string') {
      return parsed as ProjectConfig
    }
  } catch {
    // ignore - invalid JSON reads as "no project config"
  }
  return null
}

export function writeProjectConfig(files: Files, config: ProjectConfig): Files {
  return { ...files, [PROJECT_CONFIG_FILE]: JSON.stringify(config, null, 2) + '\n' }
}

/**
 * The one project id this workspace resolves to, or `undefined` if it
 * doesn't declare one - which is exactly today's (single, unambiguous
 * default project) behavior. `engine.ts` and every `mutate.ts` function
 * that talks to the language service compute this locally from `files`
 * and pass it straight through to `computedModel(projectId)`/
 * `diagrams(projectId)`/`locate({..., projectId})` - no new parameters
 * needed anywhere, since it's fully derivable from `files` alone.
 */
export function currentProjectId(files: Files): string | undefined {
  return readProjectConfig(files)?.name
}
