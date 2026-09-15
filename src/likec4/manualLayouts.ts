import type { LayoutedView } from '@likec4/core/types'

const STORAGE_KEY = 'gabari:manual-layouts'
/** Pre-rebrand key (same shape, old "likec4-editor" name) - read as a
 * fallback so a rebrand doesn't orphan anyone's saved layouts. */
const PRE_REBRAND_STORAGE_KEY = 'likec4-editor:manual-layouts'

export type ManualLayouts = Record<string, LayoutedView>

export function loadManualLayouts(): ManualLayouts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PRE_REBRAND_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ManualLayouts) : {}
  } catch {
    return {}
  }
}

export function saveManualLayouts(data: ManualLayouts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore (private browsing, quota, etc.)
  }
}
