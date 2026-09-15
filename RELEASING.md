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
