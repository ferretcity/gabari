/**
 * Renders `tech:*` / `aws:*` / `azure:*` / `gcp:*` / `bootstrap:*` element
 * icons using `@likec4/icons` - the same bundled SVG set LikeC4's own
 * tooling ships, but not wired up by `@likec4/diagram` itself: without a
 * `renderIcon` provider it silently renders nothing for these (only a
 * plain URL or `data:` icon renders natively - see `IconRenderer.tsx`
 * upstream). A URL/data-uri icon needs no help from this file at all.
 */
import { Suspense, createElement, lazy, type ComponentType, type SVGProps } from 'react'
import type { ElementIconRenderer } from '@likec4/diagram'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>
type IconModule = { default: IconComponent }

/** Ground-truthed against `@likec4/core`'s `BuiltInIcon` type. */
export const ICON_SET_PREFIXES = ['aws', 'azure', 'gcp', 'tech', 'bootstrap'] as const

// Vite-glob every SVG icon `@likec4/icons` ships, as a *lazy* loader - so
// only the handful actually used in a diagram get bundled/downloaded, not
// all ~2500 of them (the package is ~26MB of individual SVG files on
// disk). Keys are on-disk paths; findLoader() below maps a DSL icon value
// like "tech:react" straight onto one.
// Excludes each set's own `index.js` (a barrel re-exporting every icon in
// that folder, no `default` export of its own) - the bare `*.js` glob
// would otherwise pick it up as if it were itself a real icon named
// "index", producing a bogus `<set>:index` entry that's syntactically
// valid DSL but fails LikeC4's own icon-registry validation ("Could not
// resolve reference to LibIcon") the moment it's actually picked.
const iconLoaders = import.meta.glob<IconModule>([
  '../../node_modules/@likec4/icons/{aws,azure,gcp,tech,bootstrap}/*.js',
  '!../../node_modules/@likec4/icons/{aws,azure,gcp,tech,bootstrap}/index.js',
])

function findLoader(set: string, name: string) {
  return iconLoaders[`../../node_modules/@likec4/icons/${set}/${name}.js`]
}

/** Every bundled icon's DSL value (e.g. "tech:react"), for autocomplete -
 * derived from the same glob above (its keys are populated statically by
 * Vite at build time, so this needs no separate icon-list file to keep in
 * sync, and costs nothing extra: reading `Object.keys` doesn't invoke any
 * of the lazy loaders). ~2,500 entries; the Icon field filters this list
 * client-side rather than shipping a dropdown widget sized for it. */
export const ALL_ICON_NAMES: readonly string[] = Object.keys(iconLoaders)
  .map(path => path.match(/@likec4\/icons\/(\w+)\/(.+)\.js$/))
  .filter((m): m is RegExpMatchArray => m !== null)
  .map(([, set, name]) => `${set}:${name}`)
  .sort()

// Cache resolved `lazy()` components by icon value - `lazy()` must return
// the *same* component reference across renders for a given icon, or
// React remounts (and re-suspends) it every time.
const lazyCache = new Map<string, IconComponent>()

/** Resolve a DSL icon value (e.g. "tech:react") to a lazily-loaded SVG
 * component, or null if it's not one of the bundled `@likec4/icons` sets/
 * names - a custom URL or unrecognized value, which either renders
 * natively already or just shows nothing. */
export function resolveBundledIcon(icon: string): IconComponent | null {
  const cached = lazyCache.get(icon)
  if (cached) return cached
  const colon = icon.indexOf(':')
  if (colon === -1) return null
  const set = icon.slice(0, colon)
  const name = icon.slice(colon + 1)
  if (!(ICON_SET_PREFIXES as readonly string[]).includes(set)) return null
  const loader = findLoader(set, name)
  if (!loader) return null
  const Comp = lazy(loader as () => Promise<IconModule>)
  lazyCache.set(icon, Comp)
  return Comp
}

export const techIconRenderer: ElementIconRenderer = ({ node, className }) => {
  if (!node.icon) return null
  // createElement rather than a `<Icon />` JSX tag - see the identical
  // note in EditElementDialog's IconPreview.
  const icon = resolveBundledIcon(node.icon)
  if (!icon) return null
  return <Suspense fallback={null}>{createElement(icon, { className })}</Suspense>
}
