import type { SpecPreset } from './specPresets'

/**
 * Ready-made notation presets shipped with the app - available to every
 * user with zero setup, unlike the user-saved presets in `specPresets.ts`
 * (which live in one browser's `localStorage` and have to be built up by
 * hand first). Imported the same way a saved preset is - same
 * skip-on-name-collision merge via `mutate.ts`'s `importSpecPreset` - just
 * a different source list, rendered as its own section in the Library
 * editor and never deletable (see `SpecificationEditor.tsx`).
 *
 * Colors are mapped onto this app's fixed `THEME_COLORS` token set (see
 * `dslGen.ts`) - the closest available approximation of each notation's
 * real palette, not a pixel-exact reproduction. Shapes are mapped onto
 * `ELEMENT_SHAPES`, LikeC4's own fixed shape set - several ArchiMate
 * concepts share a shape here since LikeC4 has far fewer shapes than
 * ArchiMate has element types.
 */
export const BUILTIN_SPEC_PRESETS: SpecPreset[] = [
  {
    name: 'ArchiMate',
    elementKinds: [
      // Business layer - ArchiMate's official color is yellow; "amber" is
      // this app's closest theme token.
      { name: 'businessActor', color: 'amber', shape: 'person' },
      { name: 'businessRole', color: 'amber', shape: 'person' },
      { name: 'businessProcess', color: 'amber', shape: 'component' },
      { name: 'businessService', color: 'amber', shape: 'rectangle' },
      { name: 'businessObject', color: 'amber', shape: 'document' },
      // Application layer - ArchiMate's official color is cyan/light blue;
      // "sky" is the closest theme token.
      { name: 'applicationComponent', color: 'sky', shape: 'component' },
      { name: 'applicationService', color: 'sky', shape: 'rectangle' },
      { name: 'applicationFunction', color: 'sky', shape: 'component' },
      { name: 'dataObject', color: 'sky', shape: 'document' },
      // Technology layer - ArchiMate's official color is green.
      { name: 'node', color: 'green', shape: 'storage' },
      { name: 'device', color: 'green', shape: 'storage' },
      { name: 'systemSoftware', color: 'green', shape: 'component' },
      { name: 'technologyService', color: 'green', shape: 'rectangle' },
      { name: 'artifact', color: 'green', shape: 'document' },
    ],
    relationshipKinds: [
      // A best-effort mapping of ArchiMate's standard relationship types -
      // LikeC4 relationship kinds only carry color/line (no distinct
      // arrowhead per kind), so this distinguishes them by color and line
      // style rather than reproducing ArchiMate's own arrow glyphs.
      { name: 'serving', color: 'primary', line: 'solid' },
      { name: 'realization', color: 'slate', line: 'dashed' },
      { name: 'assignment', color: 'gray', line: 'solid' },
      { name: 'triggering', color: 'red', line: 'solid' },
      { name: 'flow', color: 'amber', line: 'dotted' },
      { name: 'access', color: 'sky', line: 'dotted' },
      { name: 'composition', color: 'indigo', line: 'solid' },
      { name: 'aggregation', color: 'indigo', line: 'solid' },
    ],
    tags: [],
  },
  {
    name: 'C4 Model',
    elementKinds: [
      // Simon Brown's official C4 palette is a blue gradient (darkest at
      // Person, lightest at Component) - approximated here with the
      // closest distinct theme tokens, since C4's actual hex values aren't
      // in this app's fixed palette.
      { name: 'person', color: 'slate', shape: 'person' },
      { name: 'softwareSystem', color: 'primary', shape: 'rectangle' },
      { name: 'container', color: 'sky', shape: 'rectangle' },
      { name: 'component', color: 'indigo', shape: 'component' },
    ],
    relationshipKinds: [{ name: 'uses', color: 'gray', line: 'solid' }],
    tags: [],
  },
]
