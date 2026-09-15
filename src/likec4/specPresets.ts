import type { ElementKindSpec, RelationshipKindSpec, TagSpec } from './engine'

/**
 * A named, reusable bundle of specification entries (element kinds,
 * relationship kinds, tags - with their colors/shapes/lines) - built once
 * for a domain you work in (e.g. "AWS", "Kubernetes"), saved locally, and
 * importable into any project later. This is entirely a client-side,
 * localStorage-backed convenience this app provides, independent of any
 * one project - distinct from the real multi-file support (see
 * `fileKeys.ts`/`mutate.ts`), where every file within a project already
 * sees every other file's declarations with no import needed.
 */
export interface SpecPreset {
  name: string
  elementKinds: ElementKindSpec[]
  relationshipKinds: RelationshipKindSpec[]
  tags: TagSpec[]
}

const STORAGE_KEY = 'gabari:spec-presets'
/** Pre-rebrand key (same shape, old "likec4-editor" name) - read as a
 * fallback so a rebrand doesn't orphan anyone's saved presets. */
const PRE_REBRAND_STORAGE_KEY = 'likec4-editor:spec-presets'

export function loadSpecPresets(): SpecPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PRE_REBRAND_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SpecPreset[]) : []
  } catch {
    return []
  }
}

export function saveSpecPresets(presets: SpecPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // ignore (private browsing, quota, etc.)
  }
}
