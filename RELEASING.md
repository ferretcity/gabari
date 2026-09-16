# Releasing

Gabari follows [Semantic Versioning](https://semver.org/), currently
**pre-1.0.0**:

- `0.MINOR.0` - anything goes, including breaking changes. A pre-1.0
  minor bump is semver's own explicit "no stability guarantee yet"
  signal, so this is where a DSL-facing or data-format change lands.
- `0.x.PATCH` - fixes only, no new features, no breaking changes.
- `1.0.0` - the first release that commits to semver's normal stability
  guarantees (breaking changes only in a major bump from then on).

## Cutting a release

1. Bump `"version"` in [package.json](package.json) to the new
   `X.Y.Z` (no leading `v`).
2. Commit that change.
3. Tag it, matching exactly, with a leading `v`: `git tag vX.Y.Z`.
4. `git push && git push --tags`.

Pushing the tag is what triggers everything else -
[.github/workflows/release.yml](.github/workflows/release.yml) builds
the app, packages `dist/` into `gabari-vX.Y.Z.tar.gz` (extracts flat -
`index.html` and `assets/` at the top level, ready to point a static
file server straight at), and publishes a GitHub Release with that
archive attached and notes auto-generated from the commits/PRs since the
previous tag - no hand-maintained `CHANGELOG.md` to keep in sync.

## Versioning the file formats a project's `files` contain

A project someone saved with an old Gabari has to keep opening correctly
in a newer one - there's no server to run a migration for them, and no
"project schema version" file anywhere (LikeC4's own
`likec4.config.json` doesn't carry one either - it's just a `$schema`
pointer, and the tool itself stays lenient about unknown/missing keys
rather than versioning the file). Gabari's own formats
(`disseminate/*.c4doc.json`, `decisions/*.md`'s frontmatter) follow the
same approach, on purpose:

- **New fields are additive and optional, and their absence must mean
  "old behavior", not "invalid file".** Every field added this way so
  far (`DisseminateSection.slideText`, `ElementSummary.decisionLinks`,
  LikeC4's own `link`/`metadata`) works precisely because the reader
  falls back to the pre-existing behavior when the field is missing -
  no migration code needed, and an old project opens unchanged in a
  newer Gabari. Keep new fields in this shape by default.
- **Unrecognized fields/files are skipped, never fatal.** `listDecisions`
  and `listDisseminateDocuments` already drop a record that doesn't
  parse rather than throwing - what lets a *newer* project's files
  degrade gracefully if ever opened by an older Gabari, and what makes
  hand-editing one of these files forgiving of typos.
- **A genuinely breaking change (a rename, a removed field, a reshaped
  array) is the rare case, not the default one - don't pre-emptively add
  a `formatVersion` field "just in case".** If one is ever truly
  unavoidable: add an explicit `formatVersion` (starting at `2`, since
  every existing file is implicitly `1`) to that one format only, write
  a small migration keyed on it at the read boundary
  (`listDisseminateDocuments`/`readDecision`), applied once at load and
  persisted lazily on the next save (not rewritten eagerly just from
  opening the project) - and bump `0.MINOR.0` per the policy above,
  since this is exactly the "data-format change" that bump exists for.

## Versioning the LikeC4 dependency

`@likec4/core`, `@likec4/diagram`, and `@likec4/language-services` are
pinned to the exact same version (no `^`) in
[package.json](package.json) - they're released together from one
monorepo and must stay in lockstep. `@likec4/icons` is pinned exact too
(a transitive-dependency mismatch under pnpm broke the build once - see
the README's pnpm section). `html-to-image`, the one non-LikeC4 runtime
dependency, is the only one left to float (`^`). Bump the `@likec4/*`
trio together, deliberately, checking
[likec4's CHANGELOG](https://github.com/likec4/likec4/blob/main/CHANGELOG.md)
for grammar or `LikeC4Model` API changes before bumping - never let
one drift ahead of the others.
