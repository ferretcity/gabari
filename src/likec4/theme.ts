import { defaultTheme } from '@likec4/core/styles'

/**
 * The exact element fill/stroke/text colors `LikeC4Diagram` itself renders
 * for a given theme color name - ground-truthed against `@likec4/core`'s
 * own `defaultTheme` (not an approximated guess), so anywhere this app
 * previews a kind's color (the Library palette, the Specification
 * editor's swatches) matches what the real diagram actually renders.
 */
export function elementColorValues(color: string | null | undefined): {
  fill: string
  stroke: string
  hiContrast: string
} {
  const colors = defaultTheme.colors as Record<string, { elements: { fill: string; stroke: string; hiContrast: string } }>
  const entry = (color && colors[color]) || colors.primary
  return entry.elements
}
