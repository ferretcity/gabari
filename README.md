<img src="branding/gabari/mark-512.png" width="64" height="64" alt="" align="left" style="margin-right: 12px" />

# Gabari

*Draft your architecture.*

Gabari is a browser-based visual editor for [LikeC4](https://likec4.dev)
diagrams — add elements and relationships through forms and a
live-rendered diagram, instead of hand-writing the DSL by hand. Where a
tool like Sparx EA treats architecture as a rigid, vertically-siloed
document, Gabari treats it as a living draft: a horizontal connector that
spans business capabilities, data models, and infrastructure instead of
burying them in separate folders, and lets a team sketch, iterate, and
reshape a diagram as continuously as the system it describes actually
changes.

(The name comes from the French *gabarit* - dropping the silent "t" -
which means both a heavy engineering master template and a rough draft or
layout outline. That double meaning is the point: rigorous enough to be a
real spec, light enough to redraw on the fly.)

It's built directly on LikeC4's own packages, pinned to **LikeC4 1.59.3**
(`@likec4/language-services`, `@likec4/diagram`, `@likec4/core` — see
[package.json](package.json); the icon set, `@likec4/icons`, trails at
1.46.4, the newest release published for it), not a re-implementation of
the LikeC4 language itself:

- **`@likec4/language-services` 1.59.3** parses your `.c4` source in the
  browser (WASM Graphviz for layout, no server) and is the single source of
  truth for validity.
- **`@likec4/diagram` 1.59.3** renders the real LikeC4 view — the same
  component LikeC4's own tooling uses — so what you see is what that exact
  LikeC4 version would generate.
- Your DSL **source text stays the source of truth**. "Add element" / "add
  relationship" actions compute a small, targeted text insertion (the same
  way you'd type it by hand) rather than regenerating the whole file, so your
  formatting and comments survive. You can also hand-edit the DSL panel
  directly at any time — it re-parses and re-renders live.

## Running it

Uses [pnpm](https://pnpm.io) (a plain `npm install` won't produce the same
`node_modules` layout - see the note below).

```bash
pnpm install
pnpm dev
```

Then open the printed `http://localhost:5173` URL.

`pnpm build` produces a portable `dist/` folder using relative asset
paths — upload or serve it as-is on any static host (Netlify, Vercel, S3,
nginx, GitHub Pages, a subfolder, etc.), no server-side config needed.

**Self-hosting without building it yourself**: every
[release](https://github.com/ferretcity/gabari/releases) has a
`gabari-vX.Y.Z.tar.gz` attached — that's the same `dist/` output above,
pre-built. Download it, extract it, and point any static file server at
the extracted folder (`index.html` and `assets/` sit right at its top
level) — no Node.js or build step involved at all. See
[RELEASING.md](RELEASING.md) for how these are cut.

**Why pnpm specifically**: `@likec4/icons` (the bundled tech/cloud icon set
`src/likec4/icons.tsx` lazily loads from) is only a *transitive* dependency
of `@likec4/language-services`, not a direct one of this app - it's listed
explicitly in `package.json` anyway so pnpm's non-flat `node_modules`
actually exposes it at `node_modules/@likec4/icons` (needed for the
`import.meta.glob` in `icons.tsx` to find it; npm's flat `node_modules`
happens to expose it either way, but pnpm doesn't). Separately, `vite.config.ts`
sets `resolve.dedupe: ['react', 'react-dom']` - without it, pnpm's per-package
peer-dependency resolution can give `@likec4/diagram`/`@likec4/icons` a
*physically separate* copy of React from this app's own even when versions
match, which breaks React's hooks ("Invalid hook call") since its dispatcher
is a per-module-instance singleton. `pnpm-workspace.yaml`'s
`onlyBuiltDependencies: [esbuild]` just approves esbuild's install script
(pnpm blocks postinstall scripts by default) - not required for anything to
function (Vite uses esbuild as a library, not its CLI binary), just keeps
`pnpm install` from nagging about it.

**Every version in `package.json` is exact** (no `^`/`~` ranges) and
`.npmrc` sets `save-exact=true` so a future `pnpm add` keeps it that way -
combined with `pnpm-lock.yaml` (which pins the full transitive tree too),
`pnpm install --frozen-lockfile` reproduces the exact same `node_modules`
every time. Bumping a version is a deliberate, one-line edit to
`package.json` followed by `pnpm install` to update the lockfile to match -
not something that happens implicitly on a routine install.

## What it does

- **Library, drag-and-drop**: the sidebar lists every element kind declared
  in your `specification` block as a draggable card. Drag one onto empty
  canvas to add a top-level element of that kind, or **drop it directly onto
  an existing box to nest inside it** — either way opens Add Element
  pre-filled; just name it.
- **Connect, visually**: click the "⇥" button on any element in the sidebar
  to start a connection, then click another element — either its sidebar row
  or its box in the real rendered diagram — to finish. Add Relationship opens
  pre-filled with both ends; just add a label. Escape cancels.
- **Nesting**: three ways to build hierarchy —
  1. drag a Library kind onto an existing box in the diagram to nest a new
     element inside it;
  2. click the "⊕" button on a sidebar element to add a new element nested
     inside it (same as picking it as the parent in Add Element);
  3. **drag an existing element's sidebar row onto another row** to move it
     there (its fqn changes since nesting defines it — every relationship
     and view `include` that referenced it is rewritten to match); drop onto
     the list's empty background to move it back to the top level.

  A container's contents only render once something makes them visible to a
  view — LikeC4 shows one clean top-level box per abstraction level by
  default, the same as plain LikeC4. Nesting through this app handles that
  for you: it adds `include <container>.**` to every view automatically the
  first time something is nested inside that container.
- **Drag nodes to reposition them, meant to stick across reloads**: drag any
  box (there's a lock/unlock toggle in the diagram's own top-right corner —
  a safety switch built into LikeC4's diagram component, not something this
  app controls — that must be in the "unlocked" state, which is its
  default). Relationship lines redraw dynamically as you drag rather than
  staying frozen at their pre-computed position. Dropping a node is
  *supposed* to emit a `save-view-snapshot` change (via
  `LikeC4EditorProvider`) that gets written to `localStorage`, and on every
  render `DiagramPanel`'s `activeView` merges each saved node's `x`/`y` back
  into the freshly-computed view *before* handing it to `LikeC4Diagram`, so
  a saved position survives edits and page reloads.

  Confirmed working end-to-end, both halves: dragging a node with the
  diagram unlocked emits a `save-view-snapshot` change, which is written to
  `localStorage` immediately (no reload needed to see the save happen); and
  reloading (or seeding `gabari:manual-layouts` by hand) correctly
  repositions the matching node from the very first paint. Earlier testing
  in this project that seemed to show the save side not firing turned out
  to be testing with the diagram still in its locked (read-only) state -
  the lock toggle in the diagram's own top-right corner must show the
  "unlocked" icon before a drag will save.

  A relationship's label position is a separate frozen coordinate from its
  line, and LikeC4's own renderer only re-centers a label while you're
  dragging that *edge's own control-point handle* - never in response to a
  node moving. So a label whose connected node just moved is kept glued to
  the line by shifting its saved `labelBBox` by the same delta the edge's
  midpoint moved (the same offset-preserving trick `@likec4/diagram` uses
  internally for control-point drags) - see the `activeView` `edges.map`
  in `DiagramPanel`.

  Every edge is also given a (trivial) `controlPoints` array, which
  switches LikeC4's edge renderer onto a path computed live from actual
  rendered node positions instead of a frozen pre-computed one — this part
  is confirmed working (edges track a drag live, in-session, regardless of
  the save question above). `LikeC4Diagram` renders from the `view` prop
  directly, not from `likec4model.findView(id).$layouted` — confirmed the
  diagram never calls back into `fetchView` to ask what to render — so
  patching `view` directly (both the node-position merge and the
  `controlPoints` trick) is the only mechanism actually in effect.
  (`@likec4/core`'s `LikeC4Model` separately supports a `manualLayouts`
  field that its `$layouted`/`$manual` getters would merge in, but nothing
  here renders through that path, so it isn't used.) There's no in-app
  "reset to auto-layout" control yet — clear the
  `gabari:manual-layouts` key in `localStorage` (devtools, or "Clear
  site data") to drop all saved positions for every view.
- **Edit, directly on the diagram**: right-click any element or relationship
  in the *real rendered diagram* for a context menu — Edit (title +
  description), Connect from here, Add nested element, Delete on a node;
  Edit label / Delete on a relationship. The same "✎" edit action is also on
  every sidebar row, if you'd rather not right-click the canvas.
- **Styling, per element and per relationship**: the same Edit dialogs also
  carry a style section — color, shape, border, opacity, and size for an
  element; color, line style, and arrow head/tail for a relationship. Each
  field defaults to "(default)", meaning inherit whatever the element/
  relationship kind's own spec entry sets; picking a value writes an
  explicit override (a nested `style { }` block) onto that one instance,
  same as hand-writing it, without touching the kind itself. This is
  distinct from the Specification editor's color/shape, which set the
  *kind*'s default for every element of that kind.
- **Tech/cloud icons, searchable**: the element Edit dialog's Icon field
  autocompletes against all ~5,200 bundled icon names (`tech:*`, `aws:*`,
  `azure:*`, `gcp:*`, `bootstrap:*` - the same set LikeC4's own tooling
  ships, via `@likec4/icons`) as you type - e.g. "react" surfaces
  `tech:react`, `tech:react-router`, `tech:react-query`, .... Matches whose
  part after the `:` starts with what you typed rank first. It's still a
  free-text field underneath, so a plain image URL works too (arrow keys +
  Enter to pick a suggestion, or just type/paste anything and ignore the
  dropdown); either way there's a live preview next to the field.
  `@likec4/diagram` renders a URL/data-uri icon natively, but not the
  bundled sets - it only calls back into a `renderIcon` prop for those, so
  this app supplies one (`src/likec4/icons.tsx`) that lazily resolves and
  loads just the icons actually used, rather than bundling the whole set.
  An icon from the `tech:` set also auto-populates a "technology" subtitle
  on the node (e.g. `tech:react` → "React") - that's LikeC4's own behavior,
  not something this app adds.
- **Dynamic views**: the Views section in the sidebar lists every view and
  lets you add one of either kind — a regular element view (`include *`,
  same as the default view) or a dynamic view, LikeC4's ordered
  request/response-flow diagram. A dynamic view starts empty; select its
  tab (or its sidebar row) and a "+ Step" button appears next to the tab
  bar to append the next step (source, target, label) - LikeC4 numbers and
  lays them out left-to-right automatically, no extra work needed on this
  app's end since `@likec4/diagram` renders dynamic views natively. Switch
  tabs or click a view's sidebar row to change which view is active; the
  "✕" on a view row deletes it (disabled when it's the only view left).

  A brand-new dynamic view has no steps, and LikeC4's own sequence layouter
  throws on an empty one (`actors array must not be empty`) - so it's
  tracked separately from "views that laid out successfully" the same way
  the sidebar and tab bar list it (from `ParseResult.views`, every declared
  view) rather than from `diagrams` (only the ones that rendered), and
  shows a "no steps yet, click + Step" placeholder in the canvas instead of
  the generic empty state. Without that, a freshly added dynamic view had
  no tab and no way to select it at all - the "+ Step" button existed only
  on a tab you could never reach.
- **Add element / Add relationship** (toolbar buttons): the same actions via
  plain forms, if you'd rather not drag or click nodes — pick a kind, title,
  optional parent to nest inside, optional description; or pick source,
  target, label and (if declared) a relationship kind.
- **Specification editor**: manage the `specification` block itself — every
  element kind, relationship kind, and tag is listed with its color/shape
  (or line, for relationship kinds) as live dropdowns you can change right
  there, applied immediately - no separate Edit action, and no need to
  delete and re-add just to change a kind's default color. That distinction
  matters here specifically because deleting a kind or tag cascades (see
  "Delete" below): every element of that kind, or every relationship
  tagged with it, would go with it. Add a new one, or delete one you're
  sure isn't needed, from the same screen.
- **Spec presets**: at the top of the Specification editor, save the
  current element kinds / relationship kinds / tags as a named bundle
  (e.g. "AWS", "Kubernetes") - a personal library of reusable specs for
  domains you work in often, kept in `localStorage` independent of any
  one diagram. Import a saved preset into the diagram you're on to add its
  entries; anything whose name already exists anywhere in the current
  project is left untouched rather than overwritten, so importing can't
  clobber a kind you've already customized - a toast reports how many were
  added vs. skipped. This is a `localStorage`-based convenience this app
  provides, independent of any one project - distinct from the real
  multi-file support described below, where every file *within* a project
  already sees every other file's declarations with no import statement of
  any kind needed.

  You can also **drag and drop a `.c4` file** onto the dashed box below the
  presets list to import its specification directly, without saving it as
  a named preset first - handy for a one-off domain file (a colleague's
  `aws-icons.c4`, say) you don't necessarily want to keep in your local
  library. The file is parsed for real (same parser as everything else in
  this app) and only its `specification { }` entries are used - it doesn't
  need a `model { }` or `views { }` at all (LikeC4 is fine with a
  spec-only file), and if it has them anyway, they're read but ignored.
  Same skip-on-name-collision merge and toast as importing a saved preset;
  a file that fails to parse shows the parser's own error instead.
- **Delete**: removing an element also removes its nested children and any
  relationships that referenced it; removing a kind/tag from the
  specification cascades the same way. The app re-parses after deletion and
  strips whatever the real parser still flags as broken, so you can't be
  left with a dangling reference.
- **Source panel**: a file tree plus the active file's live DSL, editable
  directly. Two-way synced with the element/relationship list and the
  diagram - see "Multi-file projects & connecting a repo" below.
- **Import / Export**: load an existing `.c4` file (into the active file) or
  a whole local folder (`Import Folder`, populating every file at once), or
  download/copy the active file.

Everything you build is kept in `localStorage` between sessions (an
existing single-file project from before multi-file support is migrated in
automatically the first time you open the updated app).

## Multi-file projects & connecting a repo

A project is a set of named files (not just one `model.c4`) - LikeC4's own
`fromSources()` merges every file's `specification`/`model`/`views` into
one project, so an element declared in one file can be referenced,
nested-into, or included in a view declared in another. Add/rename/delete
files from the file tree in the source panel; every mutation (add/move/
delete/style-edit/etc.) figures out on its own which file to read from or
write into - a new top-level element, relationship, view, or spec entry
goes into whichever file is currently open.

You can also connect the project to a folder inside a GitHub or GitLab
repository, so your team's LikeC4 source lives in its own repo instead of
being trapped in one browser's `localStorage`:

- **GitHub**: connect with a pasted Personal Access Token (repo contents
  read/write). Real OAuth isn't possible here without a server - GitHub's
  token-exchange endpoint requires a `client_secret` unconditionally and has
  no CORS support, confirmed directly from GitHub's own OAuth Apps docs, so
  a PAT is the only credential this app can use without adding a backend.
- **GitLab**: "Log in with GitLab" via a genuine client-side-only OAuth2
  PKCE flow - no server, ever. This needs a GitLab OAuth Application
  registered as **public** (the "Confidential" checkbox unchecked, so it
  never uses a client secret), with this page's exact URL as a redirect URI
  and the `api` scope; paste that Application's Client ID into the connect
  dialog. (The PKCE `code_verifier`/`state` pair briefly lives in
  `sessionStorage` to survive the redirect to gitlab.com and back, deleted
  immediately after the token exchange - it's a single-use nonce, not a
  credential.)

Either way: **the token is never persisted** - it's held in memory for that
session only, and you'll reconnect (re-paste a PAT, or log in again) next
time you open the app. Only one repo is connected at a time. `Push` diffs
the live project against the repo snapshot as of the last fetch/push and
sends a single new commit (GitHub via the Git Data API's blob/tree/commit/
ref dance; GitLab via one atomic Commits API call); `Disconnect` drops the
connection (and the token) without touching your local files.

`src/git/github.ts`/`gitlab.ts` are small, dependency-free REST clients for
this (list/read/commit); `gitlabAuth.ts` implements the PKCE login;
`diffFiles.ts` computes the created/updated/deleted sets a push needs.

## Project layout

- `src/likec4/dslGen.ts` — builds small DSL snippets (element/relationship/
  specification-entry/view declarations) with correct quoting/escaping, plus
  the ground-truthed color/shape/border/size/line-style/arrow-type palettes
  and the `ElementStyleInput`/`RelationshipStyleInput` shapes a style edit
  submits.
- `src/likec4/textOps.ts` — brace-aware text utilities (find a block's
  matching `}`, insert into a block, remove a statement span, find a
  `keyword name` specification entry, find a nested `keyword { }` sub-block
  like `style { }`).
- `src/likec4/mutate.ts` — ties the above together with the real parser's
  `locate()` API (which knows exactly where an element/relation/view lives
  - including *which file*, via `fileKeys.ts` - since the whole project is
  multi-file) to implement add/move/update/delete for elements,
  relationships, specification entries, and views, each operating on a
  `Record<string, string>` (`files`) rather than one string. `moveElement`
  relocates an element's exact source text verbatim (so any hand-added
  content survives), *across files if needed*, and rewrites every other
  reference to its fqn (and its descendants') to match its new nested path
  - across every file in the project, since a reference can live anywhere.
  A new top-level entity (`addElement` with no parent, `addRelation`,
  `addView`, `addElementKind`, `addRelationshipKind`, `addTag`,
  `importSpecPreset`) takes a `targetFile` and uses the shared
  `findTopLevelBlockAcrossFiles` helper to find (or create) a home for it -
  preferring that file, falling back to any file that already has the
  right kind of block, only creating a new one as a last resort.
  `updateElement`/`updateRelation` edit a title/description/label in place;
  `updateElementStyle`/`updateRelationStyle` do the same for a per-instance
  `style { }` block, setting/clearing one property at a time and removing
  the block entirely once it's emptied out; `updateElementKind`/
  `updateRelationshipKind`/`updateTag` are the equivalent for a
  specification entry's own default color/shape/line (an element kind
  nests them under `style { }`, same as an instance; a relationship kind
  or tag has them flat in its own body - see `buildRelationshipKindSnippet`'s
  comment for why) - found by scanning every file's `specification { }`
  block, since spec entries have no `locate()` support of their own.
  `importSpecPreset` bulk-adds a whole preset's worth of entries (see
  `specPresets.ts`) into `targetFile` in one edit, skipping any entry whose
  name already exists *anywhere in the project* rather than overwriting it
  - shared by both the saved-preset import and the drag-a-`.c4`-file import
  (the latter parses the dropped file in isolation via `engine.ts`'s
  `parseSingleSource`, unrelated to the project's own files, to get the
  same `{elementKinds, relationshipKinds, tags}` shape from arbitrary
  text). `ensureDeepInclude` is the "nesting just works" piece — it adds
  `include <container>.**` to every view *in every file* the first time
  something nests under that container. `addView`/`deleteView`/`addStep`
  manage views and dynamic-view steps; unlike elements and relations,
  `locate({view})`'s range isn't safe to scan forward from with
  `scanDeclarationTail` (see `locateViewBlock`'s comment) - it just finds
  the next `{` after the location instead, which is always a view's own
  body (views are never bodyless). `repairUntilValid` (used after any
  delete) re-parses the whole project and strips whichever single line the
  real parser currently flags - in whichever file it's flagged in - until
  it's valid or a round limit is hit.
- `src/likec4/fileKeys.ts` — tiny, dependency-free helpers that decode a
  `locate()` result's `Location.uri` (`virtual:/workspace/<key>`, percent-
  encoded) or a `getErrors()` result's `sourceFsPath` (`/workspace/<key>`,
  already percent-decoded) back into the matching key of the `files`
  record - deliberately not pulling in `langium`'s own `URI` class for
  this, the same "depend on what you use" lesson as `@likec4/icons` below.

  Note on ids: `computedModel().relationships()[].id` (stable per source
  text, what `locate({relation})` expects) is a *different* id from a
  rendered diagram edge's own `.id` (which can aggregate several relations)
  — the real one to edit/delete is in the edge's `.relations` array. Mixing
  these up looks like nothing happens when you click a diagram edge's
  context menu action.
- `src/likec4/domHitTest.ts` — walks the rendered diagram's DOM to find which
  node (by its React Flow `data-id`) is under a drop point, so dropping a
  Library card onto an existing box can nest into it.
- `src/likec4/manualLayouts.ts` — localStorage read/write helpers for
  per-view saved node positions (meant to be written when dragging a node
  on the canvas). See the "Drag nodes" note above for how these get applied
  on read — `DiagramPanel` merges them into the `view` object it hands to
  `LikeC4Diagram` on every render, verified working when the storage key is
  populated — and for the caveat on whether dragging itself reliably
  populates it.
- `src/likec4/specPresets.ts` — localStorage read/write helpers for named
  spec presets (`SpecPreset = {name, elementKinds, relationshipKinds,
  tags}`) - independent of `manualLayouts.ts`/the DSL source itself, since
  a preset is meant to outlive any one diagram. `mutate.ts`'s
  `importSpecPreset` does the actual merge into the current source, one
  text edit for the whole preset, skipping any entry whose name collides
  with one already declared.
- `src/likec4/engine.ts` — wraps `fromSources()` (the real multi-file API -
  every file in `files` is merged into one project, no import statement
  needed) and extracts the elements/relationships/kinds/specification
  detail/views/diagrams the UI needs, including each element's and
  relationship's *effective* style (kind defaults merged with any
  per-instance override - what an Edit dialog pre-fills) and each view's
  `isDynamic` flag. Each `ParseError` carries a `file` alongside its
  `line`. `parseSingleSource` is a thin wrapper for parsing one standalone
  piece of text in isolation (the drag-a-`.c4`-file-onto-Presets path),
  unrelated to the project's own `files`.
- `src/likec4/icons.tsx` — resolves a bundled icon value (`tech:react`, ...)
  to a lazily-`import()`ed `@likec4/icons` SVG component (one `import.meta.glob`
  covering all five sets, cached by icon value so `lazy()` never remounts
  the same icon), and exports `techIconRenderer`, the `renderIcon` this app
  hands to `LikeC4Diagram`. Also exports `ALL_ICON_NAMES` - every bundled
  icon's DSL value, read straight off that same glob's keys (so there's no
  separate icon-list file to keep in sync) - which
  `EditElementDialog`'s `IconAutocompleteInput` filters as you type.
- `src/git/` — GitHub/GitLab repo integration, each provider a small,
  dependency-free REST client sharing `projectFiles.ts` (which paths count
  as part of a connected folder, and folder-prefix normalization) and
  `diffFiles.ts` (`created`/`updated`/`deleted` between a repo snapshot and
  the live project - split three ways, not just "added", because GitLab's
  commit API needs to know `create` vs `update` per file). `github.ts`
  authenticates with a pasted PAT and writes via the full Git Data API
  dance (blobs → tree → commit → ref update - no atomic multi-file commit
  shortcut exists there); `gitlab.ts` authenticates with an OAuth token and
  writes via one atomic Commits API call. `gitlabAuth.ts` implements the
  client-side-only OAuth2 PKCE login (see "Multi-file projects & connecting
  a repo" above for why GitHub can't do the same).
- `src/components/` — the React UI: `Sidebar` (draggable/droppable element
  rows for reparenting) + `Library` (drag source for kinds), `DiagramPanel`
  (drop target + click-to-connect + right-click context menus, wraps
  `ReactLikeC4`), `SourcePanel` (file tree + active file's DSL textarea,
  reusing `Sidebar`'s list styling and the shared `ContextMenu` for
  rename/delete), `SpecificationEditor`, `ContextMenu`, `ConnectRepoDialog`
  + `PushDialog` (connect/push UI for the git integration), the Add/Edit
  Element and Add/Edit Relationship dialogs.

## Known limitations

- One connected repo at a time (GitHub or GitLab, not both simultaneously);
  github.com/gitlab.com only (no GitHub Enterprise Server or self-managed
  GitLab instance support - no configurable API base URL yet).
- Deleting a whole file doesn't auto-repair now-dangling references
  elsewhere the way deleting a single element/relation/view does - a
  whole-file delete is a much bigger, less-targeted action, so the app just
  re-parses and surfaces the resulting errors (with a `file:line` you can
  click to jump straight to them) for you to fix by hand.
- **No drag-to-connect** (dragging a line from one node to another to create
  a relationship). This isn't a gap in this app specifically — LikeC4's
  `ViewChange` protocol (what the diagram component can report back through
  the editor port) only covers style/position/property changes, not
  creating new relationships; there's no `Handle`-based connection UI in
  the rendered nodes to drag from in the first place. Use click-to-connect
  instead (the "⇥" button, or right-click a node → "Connect from here",
  then click the target).
- Element icons are set per-instance (the Edit dialog's Icon field), not
  per-kind through the Specification editor yet — hand-edit the source
  panel's `element <kind> { style { icon ... } }` for a kind-level default.
- **Dynamic view steps can only be appended, not edited/reordered/deleted**
  through the UI yet - each step is its own AST node (not a model
  relationship), and `locate()`'s dedicated per-step lookup (by view +
  astPath) isn't wired up here. Hand-edit the source panel to fix a step's
  label or reorder/remove one; the diagram re-renders live either way.

## License

[MIT](./LICENSE). Third-party package acknowledgements are in
[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) (regenerate with
`pnpm licenses list --long --json`).
