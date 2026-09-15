import { fromSources as rawFromSources } from '@likec4/language-services/browser'
import {
  buildDeployedInstanceSnippet,
  buildDeploymentNodeKindSnippet,
  buildDeploymentNodeSnippet,
  buildDeploymentRelationSnippet,
  buildDeploymentViewSnippet,
  buildElementKindSnippet,
  buildElementSnippet,
  buildRelationSnippet,
  buildRelationshipKindSnippet,
  buildTagSnippet,
  buildViewSnippet,
  quote,
  type ElementStyleInput,
  type NewDeployedInstanceInput,
  type NewDeploymentNodeInput,
  type NewDeploymentNodeKindInput,
  type NewDeploymentRelationInput,
  type NewDeploymentViewInput,
  type NewElementInput,
  type NewElementKindInput,
  type NewRelationInput,
  type NewRelationshipKindInput,
  type NewTagInput,
  type NewViewInput,
  type RelationshipStyleInput,
} from './dslGen'
import {
  findAllKeywordBlocks,
  findKeywordDeclaration,
  findMatchingBrace,
  findTopLevelBlock,
  findTopLevelProperty,
  findTopLevelSubBlock,
  insertIntoBlock,
  lineStartOf,
  offsetOf,
  openBodylessBlock,
  removeSpan,
  scanDeclarationTail,
  type BlockRange,
} from './textOps'
import { parseFiles, type ElementKindSpec, type ElementSummary, type RelationshipKindSpec, type TagSpec } from './engine'
import { fileKeyFromLocationUri, type Files } from './fileKeys'
import { currentProjectId } from './projectConfig'
import { isDisseminateDocFile } from './disseminate'

/** Every mutation below locates/edits things via `fromSources(files)` -
 * shadowing the raw import so none of those ~20 call sites need to
 * remember, individually, that `disseminate/*.c4doc.json` files (see
 * disseminate.ts) aren't LikeC4 source and would otherwise fail to parse
 * as DSL (same reasoning as `engine.ts`'s `parseFiles`). `files` itself
 * (what every function here still reads/writes) is untouched - only what
 * gets handed to the language service for parsing is filtered. */
function fromSources(files: Files) {
  const withoutDisseminateDocs = Object.fromEntries(
    Object.entries(files).filter(([key]) => !isDisseminateDocFile(key)),
  )
  return rawFromSources(withoutDisseminateDocs)
}

/**
 * Locate an existing element's `{ }` body - wherever in the project it's
 * declared - converting a bodyless declaration into an (empty) block in
 * place if needed. Returns the possibly-updated `files`, which file the
 * block lives in, and the block's range within that file's text. Throws if
 * the element can't be found.
 */
async function ensureElementBlock(
  files: Files,
  fqn: string,
): Promise<{ file: string; files: Files; block: BlockRange }> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ element: fqn, projectId } as never)
  if (!loc) {
    throw new Error(`Element "${fqn}" not found in source`)
  }
  const file = fileKeyFromLocationUri(loc.uri)
  const source = files[file] ?? ''
  const nameEnd = offsetOf(source, loc.range.end)
  const { headerEnd, blockOpen } = scanDeclarationTail(source, nameEnd)
  if (blockOpen != null) {
    const close = findMatchingBrace(source, blockOpen)
    if (close === -1) throw new Error(`Malformed block for element "${fqn}"`)
    return { file, files, block: { open: blockOpen, close } }
  }
  // Convert `kind id 'Title'` -> `kind id 'Title' {\n}`
  const { text, block } = openBodylessBlock(source, headerEnd)
  return { file, files: { ...files, [file]: text }, block }
}

/**
 * Find (or create) a top-level `keyword { }` block somewhere in the
 * project, used whenever a new top-level entity needs a home and there's
 * no existing declaration to anchor on (unlike {@link ensureElementBlock}
 * etc., which locate a specific, already-existing entity).
 *
 * Prefers `preferredFile` (typically whichever file is open in the UI) if
 * it already has one. If not, and `crossFileFallback` is set, uses the
 * first file anywhere that does - this is only appropriate for
 * `specification`, where consolidating into one existing spec block is
 * usually what you want. For `model`/`views` it must be left off: those
 * are exactly the blocks a file's own content lives in, so falling back to
 * a *different* file (e.g. because a brand-new, still-empty file has no
 * `model { }` yet) would silently write new content somewhere other than
 * the file the user is actively looking at. Either way, a block is
 * created at the end of `preferredFile` as the last resort.
 */
function findTopLevelBlockAcrossFiles(
  files: Files,
  keyword: 'model' | 'views' | 'specification' | 'deployment',
  preferredFile: string,
  crossFileFallback = false,
): { file: string; files: Files; block: BlockRange } {
  const inPreferred = findTopLevelBlock(files[preferredFile] ?? '', keyword)
  if (inPreferred) return { file: preferredFile, files, block: inPreferred }
  if (crossFileFallback) {
    for (const [file, text] of Object.entries(files)) {
      const block = findTopLevelBlock(text, keyword)
      if (block) return { file, files, block }
    }
  }
  const base = (files[preferredFile] ?? '').trimEnd()
  const text = (base ? base + '\n\n' : '') + `${keyword} {\n}\n`
  const block = findTopLevelBlock(text, keyword)
  if (!block) throw new Error(`internal: could not create "${keyword} { }" block`)
  return { file: preferredFile, files: { ...files, [preferredFile]: text }, block }
}

export async function addElement(
  files: Files,
  input: NewElementInput & { parentFqn?: string | null },
  targetFile: string,
): Promise<Files> {
  const fqn = input.parentFqn ? `${input.parentFqn}.${input.id}` : input.id
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  if (likec4.languageServices.locate({ element: fqn, projectId } as never)) {
    throw new Error(`Element "${fqn}" already exists`)
  }
  const snippet = buildElementSnippet(input)
  if (input.parentFqn) {
    const ensured = await ensureElementBlock(files, input.parentFqn)
    const inserted = insertIntoBlock(ensured.files[ensured.file], ensured.block, snippet)
    const withElement = { ...ensured.files, [ensured.file]: inserted }
    // LikeC4 views only auto-include top-level elements matching `*` - a
    // nested child needs its container explicitly opened up with
    // `include <ancestor>.**`, or it's silently invisible in every view.
    // Make nesting "just work" by ensuring that for the top-level ancestor.
    const topAncestor = input.parentFqn.split('.')[0]
    return ensureDeepInclude(withElement, topAncestor)
  }
  const target = findTopLevelBlockAcrossFiles(files, 'model', targetFile)
  const inserted = insertIntoBlock(target.files[target.file], target.block, snippet)
  return { ...target.files, [target.file]: inserted }
}

/**
 * Ensure every `view { }` block (in every file's `views { }` section)
 * includes `<ancestorFqn>.**` (all descendants of that element, at any
 * depth), so nesting something under it doesn't silently vanish from the
 * diagram. A no-op where that's already present. Pure text operation - no
 * need to involve the parser.
 */
export function ensureDeepInclude(files: Files, ancestorFqn: string): Files {
  let next = files
  for (const [file, text] of Object.entries(files)) {
    const updated = ensureDeepIncludeInFile(text, ancestorFqn)
    if (updated !== text) next = { ...next, [file]: updated }
  }
  return next
}

function ensureDeepIncludeInFile(source: string, ancestorFqn: string): string {
  const viewsBlock = findTopLevelBlock(source, 'views')
  if (!viewsBlock) return source
  const viewBlocks = findAllKeywordBlocks(source, 'view', viewsBlock.open + 1, viewsBlock.close)
  if (!viewBlocks.length) return source
  const escaped = ancestorFqn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const alreadyIncluded = new RegExp(`include\\b[^\\n]*\\b${escaped}\\.\\*\\*`)
  let text = source
  // Insert into the last block first, so earlier blocks' offsets stay valid.
  for (let i = viewBlocks.length - 1; i >= 0; i--) {
    const block = viewBlocks[i]
    const body = text.slice(block.open + 1, block.close)
    if (alreadyIncluded.test(body)) continue
    text = insertIntoBlock(text, block, `include ${ancestorFqn}.**`)
  }
  return text
}

/** Replace whole-identifier occurrences of `oldFqn` with `newFqn` (e.g. in
 * relationship statements or view `include` lines) - including as a
 * *prefix* of a deeper path (`old.grandchild` -> `new.grandchild`), since
 * moving a container moves its descendants' fqns too. Won't match a
 * same-named substring embedded in a longer identifier. */
function replaceWholeFqn(text: string, oldFqn: string, newFqn: string): string {
  const escaped = oldFqn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![\\w.-])${escaped}(?![\\w-])`, 'g')
  return text.replace(re, newFqn)
}

/**
 * Move an existing element (with its full `{ }` subtree, verbatim - so any
 * hand-added content survives) to nest under `newParentFqn` (or to the
 * top level, if null). Moving changes the element's fqn (nesting is what
 * defines it), so every other textual reference to its old fqn - or to any
 * of its descendants' fqns - is rewritten to match, *across every file in
 * the project* (a reference can live anywhere), and the destination view
 * visibility is ensured the same way {@link addElement} does. Moving to
 * the top level keeps the element in whichever file it's already declared
 * in, rather than relocating it to wherever the UI happens to be pointed.
 */
export async function moveElement(files: Files, fqn: string, newParentFqn: string | null): Promise<Files> {
  const currentParent = fqn.includes('.') ? fqn.slice(0, fqn.lastIndexOf('.')) : null
  if ((newParentFqn ?? null) === currentParent) return files
  if (newParentFqn && (newParentFqn === fqn || newParentFqn.startsWith(fqn + '.'))) {
    throw new Error(`Can't nest "${fqn}" inside itself or one of its own children`)
  }

  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ element: fqn, projectId } as never)
  if (!loc) throw new Error(`Element "${fqn}" not found in source`)
  const sourceFile = fileKeyFromLocationUri(loc.uri)
  const sourceText = files[sourceFile] ?? ''

  const anchor = offsetOf(sourceText, loc.range.end)
  const stmtStart = lineStartOf(sourceText, offsetOf(sourceText, loc.range.start))
  const { blockOpen } = scanDeclarationTail(sourceText, anchor)
  let stmtEnd: number
  if (blockOpen != null) {
    const close = findMatchingBrace(sourceText, blockOpen)
    if (close === -1) throw new Error(`Malformed block for element "${fqn}"`)
    stmtEnd = close + 1
  } else {
    const nl = sourceText.indexOf('\n', anchor)
    stmtEnd = nl === -1 ? sourceText.length : nl
  }
  const rawStatement = sourceText.slice(stmtStart, stmtEnd).trim()

  let nextFiles: Files = { ...files, [sourceFile]: removeSpan(sourceText, stmtStart, stmtEnd) }

  // Rewrite every remaining external reference (relationships, view
  // `include` lines, styles) from the old fqn to the new one, across every
  // file, *before* reinserting the declaration - otherwise, for a top-level
  // element being nested (whose old fqn is textually identical to its own
  // bare local id), the rewrite would also corrupt the freshly-inserted
  // declaration's id and title.
  const localId = fqn.slice(fqn.lastIndexOf('.') + 1)
  const newFqn = newParentFqn ? `${newParentFqn}.${localId}` : localId
  if (newFqn !== fqn) {
    nextFiles = Object.fromEntries(
      Object.entries(nextFiles).map(([file, text]) => [file, replaceWholeFqn(text, fqn, newFqn)]),
    )
  }

  if (newParentFqn) {
    const ensured = await ensureElementBlock(nextFiles, newParentFqn)
    const inserted = insertIntoBlock(ensured.files[ensured.file], ensured.block, rawStatement)
    nextFiles = { ...ensured.files, [ensured.file]: inserted }
    nextFiles = ensureDeepInclude(nextFiles, newParentFqn.split('.')[0])
  } else {
    const target = findTopLevelBlockAcrossFiles(nextFiles, 'model', sourceFile)
    const inserted = insertIntoBlock(target.files[target.file], target.block, rawStatement)
    nextFiles = { ...target.files, [target.file]: inserted }
  }
  return nextFiles
}

/**
 * Update an existing element's title and/or description in place - editing
 * the header's title string (inserting one if it didn't have one) and a
 * `description '...'` property inside its body (creating the body if
 * needed, or removing the property if the new description is empty).
 */
export async function updateElement(
  files: Files,
  fqn: string,
  changes: { title?: string; description?: string },
): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ element: fqn, projectId } as never)
  if (!loc) throw new Error(`Element "${fqn}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const source = files[file] ?? ''
  const nameEnd = offsetOf(source, loc.range.end)

  let text = source
  let { blockOpen, titleRange } = scanDeclarationTail(text, nameEnd)
  let blockClose = blockOpen != null ? findMatchingBrace(text, blockOpen) : null

  if (changes.title !== undefined) {
    const trimmed = changes.title.trim()
    if (titleRange) {
      const replacement = trimmed ? quote(trimmed) : ''
      const before = text.slice(0, titleRange.start)
      const after = text.slice(titleRange.end)
      const delta = replacement.length - (titleRange.end - titleRange.start)
      text = before + replacement + after
      if (blockOpen != null) blockOpen += delta
      if (blockClose != null) blockClose += delta
    } else if (trimmed) {
      const insertion = ' ' + quote(trimmed)
      text = text.slice(0, nameEnd) + insertion + text.slice(nameEnd)
      const delta = insertion.length
      if (blockOpen != null) blockOpen += delta
      if (blockClose != null) blockClose += delta
    }
  }

  if (changes.description !== undefined) {
    const trimmed = changes.description.trim()
    if (blockOpen == null) {
      if (!trimmed) return files // nothing to add, nothing to remove
      const tail = scanDeclarationTail(text, nameEnd)
      const opened = openBodylessBlock(text, tail.headerEnd)
      text = opened.text
      blockOpen = opened.block.open
      blockClose = opened.block.close
    }
    const existing = findTopLevelProperty(text, 'description', blockOpen + 1, blockClose!)
    if (existing) {
      text = trimmed
        ? text.slice(0, existing.start) + `description ${quote(trimmed)}` + text.slice(existing.end)
        : removeSpan(text, lineStartOf(text, existing.start), existing.end)
    } else if (trimmed) {
      text = insertIntoBlock(text, { open: blockOpen, close: blockClose! }, `description ${quote(trimmed)}`)
    }
  }

  return { ...files, [file]: text }
}

export async function addRelation(files: Files, input: NewRelationInput, targetFile: string): Promise<Files> {
  const snippet = buildRelationSnippet(input)
  const target = findTopLevelBlockAcrossFiles(files, 'model', targetFile)
  const inserted = insertIntoBlock(target.files[target.file], target.block, snippet)
  return { ...target.files, [target.file]: inserted }
}

/**
 * `locate({relation})` only gives the (zero-width) position of a
 * relationship's connector, before the target - so we find the statement's
 * line, then the target fqn's last occurrence on it, to get a reliable
 * anchor past which an optional title string (and then an optional `{ }`
 * body) would follow. Shared by {@link updateRelation} and
 * {@link ensureRelationBlock}.
 */
async function locateRelationAfterTarget(files: Files, relationId: string): Promise<{ file: string; offset: number }> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ relation: relationId, projectId } as never)
  if (!loc) throw new Error(`Relation "${relationId}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const text = files[file] ?? ''
  const computed = await likec4.computedModel(projectId)
  const rel = [...computed.relationships()].find(r => r.id === relationId)
  if (!rel) throw new Error(`Relation "${relationId}" not found in model`)

  const lineStart = lineStartOf(text, offsetOf(text, loc.range.start))
  const nl = text.indexOf('\n', lineStart)
  const lineEnd = nl === -1 ? text.length : nl
  const line = text.slice(lineStart, lineEnd)
  const targetIdx = line.lastIndexOf(rel.target.id)
  if (targetIdx === -1) throw new Error('Could not locate relationship target on its source line')
  return { file, offset: lineStart + targetIdx + rel.target.id.length }
}

/** Update an existing relationship's label. */
export async function updateRelation(files: Files, relationId: string, changes: { title?: string }): Promise<Files> {
  if (changes.title === undefined) return files
  const { file, offset } = await locateRelationAfterTarget(files, relationId)
  const text = files[file] ?? ''
  const { titleRange } = scanDeclarationTail(text, offset)
  const trimmed = changes.title.trim()
  if (titleRange) {
    const replacement = trimmed ? quote(trimmed) : ''
    const next = text.slice(0, titleRange.start) + replacement + text.slice(titleRange.end)
    return { ...files, [file]: next }
  }
  if (!trimmed) return files
  const next = text.slice(0, offset) + ' ' + quote(trimmed) + text.slice(offset)
  return { ...files, [file]: next }
}

/** Analogous to {@link ensureElementBlock}, but for a relationship
 * statement (which is bodyless by default). */
async function ensureRelationBlock(
  files: Files,
  relationId: string,
): Promise<{ file: string; files: Files; block: BlockRange }> {
  const { file, offset } = await locateRelationAfterTarget(files, relationId)
  const text = files[file] ?? ''
  const { headerEnd, blockOpen } = scanDeclarationTail(text, offset)
  if (blockOpen != null) {
    const close = findMatchingBrace(text, blockOpen)
    if (close === -1) throw new Error(`Malformed block for relation "${relationId}"`)
    return { file, files, block: { open: blockOpen, close } }
  }
  const { text: next, block } = openBodylessBlock(text, headerEnd)
  return { file, files: { ...files, [file]: next }, block }
}

/** Find (or create, inserting an empty one) a nested `keyword { }` block
 * directly inside `owner` - e.g. the `style { }` inside an element's or
 * relationship's own body. Returns `owner`'s own range too, since creating
 * the sub-block shifts `owner.close` outward. Operates on a single file's
 * text (the caller has already resolved which file). */
function ensureSubBlock(
  source: string,
  keyword: string,
  owner: BlockRange,
): { text: string; owner: BlockRange; block: BlockRange } {
  const existing = findTopLevelSubBlock(source, keyword, owner.open + 1, owner.close)
  if (existing) return { text: source, owner, block: existing }
  const text = insertIntoBlock(source, owner, `${keyword} {\n}`)
  const delta = text.length - source.length
  const newOwner = { open: owner.open, close: owner.close + delta }
  const block = findTopLevelSubBlock(text, keyword, newOwner.open + 1, newOwner.close)
  if (!block) throw new Error(`internal: could not find just-inserted "${keyword}" block`)
  return { text, owner: newOwner, block }
}

/** Set (or, if `value` is null, remove) a single-line `key value` property
 * directly inside `block` - e.g. `color red` inside a `style { }` block.
 * Returns `block`'s own updated range, since inserting/removing shifts its
 * `close`. Operates on a single file's text. */
function setBlockProperty(
  source: string,
  block: BlockRange,
  key: string,
  value: string | null,
): { text: string; block: BlockRange } {
  const existing = findTopLevelProperty(source, key, block.open + 1, block.close)
  if (existing) {
    if (value !== null) {
      const replacement = `${key} ${value}`
      const text = source.slice(0, existing.start) + replacement + source.slice(existing.end)
      const delta = replacement.length - (existing.end - existing.start)
      return { text, block: { open: block.open, close: block.close + delta } }
    }
    const text = removeSpan(source, lineStartOf(source, existing.start), existing.end)
    return { text, block: { open: block.open, close: block.close + (text.length - source.length) } }
  }
  if (value === null) return { text: source, block }
  const text = insertIntoBlock(source, block, `${key} ${value}`)
  return { text, block: { open: block.open, close: block.close + (text.length - source.length) } }
}

/** Remove `block` (e.g. an emptied-out `style { }`) entirely if its body is
 * blank - keeps a style edit that clears every property from leaving a
 * dangling `style {\n}` behind. Operates on a single file's text. */
function removeBlockIfEmpty(source: string, block: BlockRange): string {
  if (source.slice(block.open + 1, block.close).trim().length > 0) return source
  return removeSpan(source, lineStartOf(source, block.open), block.close + 1)
}

/** Update an element's per-instance style override (nested `style { }` in
 * its body) - a field set to `null` clears that property back to the
 * element kind's default; `undefined` leaves it untouched. */
export async function updateElementStyle(files: Files, fqn: string, style: ElementStyleInput): Promise<Files> {
  const ensured = await ensureElementBlock(files, fqn)
  const withStyle = ensureSubBlock(ensured.files[ensured.file], 'style', ensured.block)
  let text = withStyle.text
  let styleBlock = withStyle.block

  const apply = (key: string, value: string | null | undefined) => {
    if (value === undefined) return
    const updated = setBlockProperty(text, styleBlock, key, value)
    text = updated.text
    styleBlock = updated.block
  }
  apply('color', style.color)
  apply('shape', style.shape)
  apply('border', style.border)
  apply('opacity', style.opacity === undefined ? undefined : style.opacity === null ? null : `${style.opacity}%`)
  apply('size', style.size)
  apply('icon', style.icon === undefined ? undefined : style.icon === null ? null : style.icon.trim() || null)

  text = removeBlockIfEmpty(text, styleBlock)
  return { ...ensured.files, [ensured.file]: text }
}

/** Update a relationship's per-instance style override (nested `style { }`
 * in its body - unlike a `relationship` spec entry's flat properties). */
export async function updateRelationStyle(
  files: Files,
  relationId: string,
  style: RelationshipStyleInput,
): Promise<Files> {
  const ensured = await ensureRelationBlock(files, relationId)
  const withStyle = ensureSubBlock(ensured.files[ensured.file], 'style', ensured.block)
  let text = withStyle.text
  let styleBlock = withStyle.block

  const apply = (key: string, value: string | null | undefined) => {
    if (value === undefined) return
    const updated = setBlockProperty(text, styleBlock, key, value)
    text = updated.text
    styleBlock = updated.block
  }
  apply('color', style.color)
  apply('line', style.line)
  apply('head', style.head)
  apply('tail', style.tail)

  text = removeBlockIfEmpty(text, styleBlock)
  return { ...ensured.files, [ensured.file]: text }
}

/**
 * Best-effort removal of whatever statement `source` locates at `pos`
 * (either an element's name token, or a relation connector) — including
 * its `{ }` body if it has one. Operates on a single file's text.
 */
function removeDeclarationAt(
  source: string,
  statementPos: { line: number; character: number },
  scanFromPos: { line: number; character: number },
): string {
  const stmtStart = lineStartOf(source, offsetOf(source, statementPos))
  const scanFrom = offsetOf(source, scanFromPos)
  const { headerEnd, blockOpen } = scanDeclarationTail(source, scanFrom)
  let end = headerEnd
  if (blockOpen != null) {
    const close = findMatchingBrace(source, blockOpen)
    if (close !== -1) end = close + 1
  } else {
    const nl = source.indexOf('\n', scanFrom)
    end = nl === -1 ? source.length : nl
  }
  return removeSpan(source, stmtStart, end)
}

/**
 * Remove an element (and its nested children, via its `{ }` body) or a
 * relationship, then iteratively strip any now-dangling statements (e.g.
 * relationships that referenced the deleted element) by asking the real
 * parser what's still broken. Bounded so a stubborn error can't loop
 * forever - in that case the partially-repaired `files` is returned as-is.
 */
export async function deleteElement(files: Files, fqn: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ element: fqn, projectId } as never)
  if (!loc) throw new Error(`Element "${fqn}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const text = removeDeclarationAt(files[file] ?? '', loc.range.start, loc.range.end)
  return repairUntilValid({ ...files, [file]: text })
}

export async function deleteRelation(files: Files, relationId: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ relation: relationId, projectId } as never)
  if (!loc) throw new Error(`Relation "${relationId}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const text = removeDeclarationAt(files[file] ?? '', loc.range.start, loc.range.end)
  return repairUntilValid({ ...files, [file]: text })
}

/**
 * Repeatedly re-parse `files` and strip whichever single line the parser
 * currently flags (in whichever file it's flagged in), until it's valid
 * (or we give up after a few rounds). Used after a deletion to clean up
 * now-dangling references without having to hunt down every possible
 * reference to the deleted id ourselves - the real parser is the oracle
 * for "still broken".
 */
async function repairUntilValid(files: Files, maxRounds = 15): Promise<Files> {
  for (let round = 0; round < maxRounds; round++) {
    const result = await parseFiles(files)
    if (result.ok || !result.errors.length) return files
    const err = result.errors[0]
    const lines = (files[err.file] ?? '').split('\n')
    if (err.line < 0 || err.line >= lines.length) return files
    lines.splice(err.line, 1)
    files = { ...files, [err.file]: lines.join('\n') }
  }
  return files
}

// ---------------------------------------------------------------------
// Specification block (element kinds, relationship kinds, tags)
//
// Spec entries have no `locate()` support (unlike elements/relations/
// views), so every lookup here scans every file's `specification { }`
// block (almost always just one, but nothing stops a project from having
// more than one, since they simply merge).
// ---------------------------------------------------------------------

/** Remove a `keyword name { ... }` (or bodyless `keyword name`) entry from
 * whichever file's specification block declares it, then repair any
 * now-dangling references (e.g. elements of a deleted kind, or `#tag` refs
 * to a deleted tag). */
async function deleteSpecEntry(files: Files, keyword: string, name: string): Promise<Files> {
  for (const [file, text] of Object.entries(files)) {
    const block = findTopLevelBlock(text, 'specification')
    if (!block) continue
    const decl = findKeywordDeclaration(text, keyword, name, block.open + 1, block.close)
    if (!decl) continue
    const end = decl.blockOpen != null ? findMatchingBrace(text, decl.blockOpen) + 1 : decl.headerEnd
    const stmtStart = lineStartOf(text, decl.matchStart)
    const next = removeSpan(text, stmtStart, end)
    return repairUntilValid({ ...files, [file]: next })
  }
  throw new Error(`"${keyword} ${name}" not found in specification`)
}

/** Analogous to {@link ensureElementBlock}, but for a `keyword name { }`
 * specification entry (which, like a relationship, is bodyless by
 * default) - found by scanning every file's specification block. */
async function ensureSpecEntryBlock(
  files: Files,
  keyword: string,
  name: string,
): Promise<{ file: string; files: Files; block: BlockRange }> {
  for (const [file, text] of Object.entries(files)) {
    const block = findTopLevelBlock(text, 'specification')
    if (!block) continue
    const decl = findKeywordDeclaration(text, keyword, name, block.open + 1, block.close)
    if (!decl) continue
    if (decl.blockOpen != null) {
      const close = findMatchingBrace(text, decl.blockOpen)
      if (close === -1) throw new Error(`Malformed block for "${keyword} ${name}"`)
      return { file, files, block: { open: decl.blockOpen, close } }
    }
    const opened = openBodylessBlock(text, decl.headerEnd)
    return { file, files: { ...files, [file]: opened.text }, block: opened.block }
  }
  throw new Error(`"${keyword} ${name}" not found in specification`)
}

/** Whether a `keyword name` specification entry already exists anywhere
 * in the project - element kinds, relationship kinds, and tags all share
 * one namespace-per-keyword regardless of which file declares them, so
 * every `add*` below (and `importSpecPreset`'s dedup) checks the whole
 * project, not just `targetFile`. */
function specEntryExistsAnywhere(files: Files, keyword: string, name: string): boolean {
  return Object.values(files).some(text => {
    const block = findTopLevelBlock(text, 'specification')
    return block ? !!findKeywordDeclaration(text, keyword, name, block.open + 1, block.close) : false
  })
}

function insertElementKind(files: Files, input: NewElementKindInput, targetFile: string): Files {
  const target = findTopLevelBlockAcrossFiles(files, 'specification', targetFile, true)
  const inserted = insertIntoBlock(target.files[target.file], target.block, buildElementKindSnippet(input))
  return { ...target.files, [target.file]: inserted }
}

export async function addElementKind(files: Files, input: NewElementKindInput, targetFile: string): Promise<Files> {
  if (specEntryExistsAnywhere(files, 'element', input.name)) {
    throw new Error(`Element kind "${input.name}" already exists`)
  }
  return insertElementKind(files, input, targetFile)
}

/**
 * Make sure `input.name` is declared as an element kind *somewhere* in the
 * project - inserting it (into `targetFile`, falling back to any file
 * that already has a `specification { }`) only if it's missing, silently
 * doing nothing if it's already there. Unlike `addElementKind`, this
 * never throws on a collision - it's not a user-driven "add a kind"
 * action, it's a dependency guarantee: whenever an element naming this
 * kind is about to be written somewhere new (e.g. content copied in from
 * elsewhere, whose kind this project may never have declared), this
 * ensures the kind it depends on exists first - packaging the
 * specification dependency alongside the element itself, rather than
 * leaving a `Could not resolve reference to ElementKind` error to surface
 * later.
 */
export async function ensureElementKindDeclared(
  files: Files,
  input: NewElementKindInput,
  targetFile: string,
): Promise<Files> {
  if (specEntryExistsAnywhere(files, 'element', input.name)) return files
  return insertElementKind(files, input, targetFile)
}

/** Update an element kind's default color/shape in place - nested under
 * `style { }` in the kind's own body, same as a per-instance element
 * style override (see {@link updateElementStyle}). A field set to `null`
 * clears it; `undefined` leaves it untouched. */
export async function updateElementKind(
  files: Files,
  name: string,
  changes: { color?: string | null; shape?: string | null },
): Promise<Files> {
  const ensured = await ensureSpecEntryBlock(files, 'element', name)
  const withStyle = ensureSubBlock(ensured.files[ensured.file], 'style', ensured.block)
  let text = withStyle.text
  let styleBlock = withStyle.block
  const apply = (key: string, value: string | null | undefined) => {
    if (value === undefined) return
    const updated = setBlockProperty(text, styleBlock, key, value)
    text = updated.text
    styleBlock = updated.block
  }
  apply('color', changes.color)
  apply('shape', changes.shape)
  text = removeBlockIfEmpty(text, styleBlock)
  return { ...ensured.files, [ensured.file]: text }
}

export async function deleteElementKind(files: Files, name: string): Promise<Files> {
  return deleteSpecEntry(files, 'element', name)
}

// ---------------------------------------------------------------------
// Deployment node kinds - the deployment layer's own kind namespace
// (`deploymentNode <name> { style { ... } }`), kept deliberately separate
// from element kinds throughout the app (own Specification section, own
// sidebar panel, own dialogs) even though the underlying text mechanics
// here are identical to `addElementKind`/`updateElementKind`/
// `deleteElementKind` above, just parameterized by the `deploymentNode`
// keyword instead of `element`.
// ---------------------------------------------------------------------

export async function addDeploymentNodeKind(
  files: Files,
  input: NewDeploymentNodeKindInput,
  targetFile: string,
): Promise<Files> {
  if (specEntryExistsAnywhere(files, 'deploymentNode', input.name)) {
    throw new Error(`Deployment node kind "${input.name}" already exists`)
  }
  const target = findTopLevelBlockAcrossFiles(files, 'specification', targetFile, true)
  const inserted = insertIntoBlock(target.files[target.file], target.block, buildDeploymentNodeKindSnippet(input))
  return { ...target.files, [target.file]: inserted }
}

/** Update a deployment node kind's default color/shape in place - same
 * `style { }`-nesting mechanics as {@link updateElementKind}. */
export async function updateDeploymentNodeKind(
  files: Files,
  name: string,
  changes: { color?: string | null; shape?: string | null },
): Promise<Files> {
  const ensured = await ensureSpecEntryBlock(files, 'deploymentNode', name)
  const withStyle = ensureSubBlock(ensured.files[ensured.file], 'style', ensured.block)
  let text = withStyle.text
  let styleBlock = withStyle.block
  const apply = (key: string, value: string | null | undefined) => {
    if (value === undefined) return
    const updated = setBlockProperty(text, styleBlock, key, value)
    text = updated.text
    styleBlock = updated.block
  }
  apply('color', changes.color)
  apply('shape', changes.shape)
  text = removeBlockIfEmpty(text, styleBlock)
  return { ...ensured.files, [ensured.file]: text }
}

export async function deleteDeploymentNodeKind(files: Files, name: string): Promise<Files> {
  return deleteSpecEntry(files, 'deploymentNode', name)
}

export async function addRelationshipKind(
  files: Files,
  input: NewRelationshipKindInput,
  targetFile: string,
): Promise<Files> {
  if (specEntryExistsAnywhere(files, 'relationship', input.name)) {
    throw new Error(`Relationship kind "${input.name}" already exists`)
  }
  const target = findTopLevelBlockAcrossFiles(files, 'specification', targetFile, true)
  const inserted = insertIntoBlock(target.files[target.file], target.block, buildRelationshipKindSnippet(input))
  return { ...target.files, [target.file]: inserted }
}

/** Update a relationship kind's default color/line in place - *flat* in
 * the kind's own body (unlike an element kind's, which nests them under
 * `style { }` - see {@link buildRelationshipKindSnippet}). */
export async function updateRelationshipKind(
  files: Files,
  name: string,
  changes: { color?: string | null; line?: string | null },
): Promise<Files> {
  const ensured = await ensureSpecEntryBlock(files, 'relationship', name)
  let text = ensured.files[ensured.file]
  let block = ensured.block
  const apply = (key: string, value: string | null | undefined) => {
    if (value === undefined) return
    const updated = setBlockProperty(text, block, key, value)
    text = updated.text
    block = updated.block
  }
  apply('color', changes.color)
  apply('line', changes.line)
  text = removeBlockIfEmpty(text, block)
  return { ...ensured.files, [ensured.file]: text }
}

export async function deleteRelationshipKind(files: Files, name: string): Promise<Files> {
  return deleteSpecEntry(files, 'relationship', name)
}

export async function addTag(files: Files, input: NewTagInput, targetFile: string): Promise<Files> {
  if (specEntryExistsAnywhere(files, 'tag', input.name)) {
    throw new Error(`Tag "${input.name}" already exists`)
  }
  const target = findTopLevelBlockAcrossFiles(files, 'specification', targetFile, true)
  const inserted = insertIntoBlock(target.files[target.file], target.block, buildTagSnippet(input))
  return { ...target.files, [target.file]: inserted }
}

/** Update a tag's color in place - flat in the tag's own body. */
export async function updateTag(files: Files, name: string, changes: { color?: string | null }): Promise<Files> {
  if (changes.color === undefined) return files
  const ensured = await ensureSpecEntryBlock(files, 'tag', name)
  const updated = setBlockProperty(ensured.files[ensured.file], ensured.block, 'color', changes.color)
  const text = removeBlockIfEmpty(updated.text, updated.block)
  return { ...ensured.files, [ensured.file]: text }
}

export async function deleteTag(files: Files, name: string): Promise<Files> {
  return deleteSpecEntry(files, 'tag', name)
}

/**
 * Bulk-add every entry from a saved spec preset (see `specPresets.ts`) in
 * one text edit into `targetFile` - entries whose name already exists
 * *anywhere in the project* are left untouched rather than overwritten, so
 * importing a preset can never clobber a customization already made to a
 * same-named kind/tag declared in some other file. Returns how many of
 * each happened, for a summary toast.
 */
export async function importSpecPreset(
  files: Files,
  preset: { elementKinds: ElementKindSpec[]; relationshipKinds: RelationshipKindSpec[]; tags: TagSpec[] },
  targetFile: string,
): Promise<{ files: Files; added: number; skipped: number }> {
  let target = findTopLevelBlockAcrossFiles(files, 'specification', targetFile, true)
  let added = 0
  let skipped = 0

  const insertOne = (keyword: string, name: string, snippet: string) => {
    if (specEntryExistsAnywhere(target.files, keyword, name)) {
      skipped++
      return
    }
    const before = target.files[target.file]
    const text = insertIntoBlock(before, target.block, snippet)
    target = {
      file: target.file,
      files: { ...target.files, [target.file]: text },
      block: { open: target.block.open, close: target.block.close + (text.length - before.length) },
    }
    added++
  }

  for (const ek of preset.elementKinds) insertOne('element', ek.name, buildElementKindSnippet(ek))
  for (const rk of preset.relationshipKinds) insertOne('relationship', rk.name, buildRelationshipKindSnippet(rk))
  for (const t of preset.tags) insertOne('tag', t.name, buildTagSnippet(t))

  return { files: target.files, added, skipped }
}

/** Where `importElements` files everything it brings in - kept separate
 * from any hand-authored file so imported provenance stays obvious at a
 * glance in the file tree; the `.likec4` extension (rather than this
 * project's usual `.c4`) is a deliberate visual marker that this file is
 * machine-managed. Accumulates across repeated imports rather than one
 * file per import. */
export const IMPORTED_ELEMENTS_FILE = 'imported-elements.likec4'

/**
 * Merge element declarations parsed from another LikeC4 document (see
 * `engine.ts`'s `parseSingleSource`) into this project, additively -
 * unlike `importSpecPreset`'s skip-on-collision (fine for shared
 * vocabulary), a same-named *element* is auto-renamed instead of skipped,
 * since silently dropping instance content would lose data. Two things
 * this absorbs from the removed Reusable Elements feature: (1) any kind
 * an imported element depends on that this project hasn't declared yet
 * gets added via `ensureElementKindDeclared`, so nothing is left
 * referencing an undeclared kind; (2) everything lands in
 * `IMPORTED_ELEMENTS_FILE`, never merged into a file you wrote by hand.
 *
 * Elements only - no relationships, tags, or per-instance style overrides
 * (see the "Import Elements" plan's Context for why this pass stops
 * there).
 */
export async function importElements(
  files: Files,
  source: { elements: ElementSummary[]; elementKinds: ElementKindSpec[] },
  existingIds: ReadonlySet<string>,
): Promise<{ files: Files; added: number; kindsAdded: number; file: string }> {
  let current = files
  let added = 0
  let kindsAdded = 0
  const usedIds = new Set(existingIds)
  // source fqn -> the (possibly renamed) fqn it actually landed at here,
  // so a child can nest under its parent's *real* target location.
  const fqnMap = new Map<string, string>()

  // Parents before children, so `fqnMap` always has an entry for a
  // child's parent by the time we get to it.
  const sorted = [...source.elements].sort((a, b) => a.id.split('.').length - b.id.split('.').length)

  for (const el of sorted) {
    const kindSpec = source.elementKinds.find(k => k.name === el.kind)
    const beforeKind = current
    current = await ensureElementKindDeclared(
      current,
      { name: el.kind, color: kindSpec?.color ?? null, shape: kindSpec?.shape ?? null },
      IMPORTED_ELEMENTS_FILE,
    )
    if (current !== beforeKind) kindsAdded++

    const targetParentFqn = el.parent ? fqnMap.get(el.parent) ?? null : null
    const fqnFor = (id: string) => (targetParentFqn ? `${targetParentFqn}.${id}` : id)
    const bareId = el.id.split('.').pop()!
    let candidate = bareId
    for (let n = 2; usedIds.has(fqnFor(candidate)); n++) candidate = `${bareId}-${n}`
    const targetFqn = fqnFor(candidate)
    usedIds.add(targetFqn)
    fqnMap.set(el.id, targetFqn)

    current = await addElement(
      current,
      {
        id: candidate,
        kind: el.kind,
        title: el.title || undefined,
        description: el.description || undefined,
        parentFqn: targetParentFqn,
      },
      IMPORTED_ELEMENTS_FILE,
    )
    added++
  }

  return { files: current, added, kindsAdded, file: IMPORTED_ELEMENTS_FILE }
}

// ---------------------------------------------------------------------
// Views (element views and dynamic views)
// ---------------------------------------------------------------------

/** Add a `view id { ... }` (or `dynamic view id { ... }`) declaration into
 * `targetFile`, creating the `views { }` block itself if that file (or the
 * rest of the project) doesn't have one yet. */
export async function addView(files: Files, input: NewViewInput, targetFile: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  if (likec4.languageServices.locate({ view: input.id, projectId } as never)) {
    throw new Error(`View "${input.id}" already exists`)
  }
  const snippet = buildViewSnippet(input)
  const target = findTopLevelBlockAcrossFiles(files, 'views', targetFile)
  const inserted = insertIntoBlock(target.files[target.file], target.block, snippet)
  return { ...target.files, [target.file]: inserted }
}

/** Add a `deployment view id { ... }` declaration - a near-copy of
 * {@link addView}, kept as its own function (not a flag on `addView`)
 * since deployment views are a deliberately separate flow throughout the
 * app (own dialog, own tab strip). Views share one id namespace
 * regardless of kind, so the same duplicate-id guard applies. */
export async function addDeploymentView(files: Files, input: NewDeploymentViewInput, targetFile: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  if (likec4.languageServices.locate({ view: input.id, projectId } as never)) {
    throw new Error(`View "${input.id}" already exists`)
  }
  const snippet = buildDeploymentViewSnippet(input)
  const target = findTopLevelBlockAcrossFiles(files, 'views', targetFile)
  const inserted = insertIntoBlock(target.files[target.file], target.block, snippet)
  return { ...target.files, [target.file]: inserted }
}

/**
 * Locate a view's own `{ ... }` body. Unlike `locate({element})`/
 * `locate({relation})` (which point at just the id token, safe to scan
 * forward from with {@link scanDeclarationTail}), `locate({view})`'s range
 * shape isn't the same - so instead we just scan forward from its `start`
 * for the next `{`, which is always this view's own opening brace (a view
 * is never bodyless, and nothing before it in its own header - `[dynamic]
 * view id` - can contain one).
 */
async function locateViewBlock(files: Files, id: string): Promise<{ file: string; block: BlockRange }> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ view: id, projectId } as never)
  if (!loc) throw new Error(`View "${id}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const text = files[file] ?? ''
  const startOffset = offsetOf(text, loc.range.start)
  const open = text.indexOf('{', startOffset)
  if (open === -1) throw new Error(`View "${id}" has no body`)
  const close = findMatchingBrace(text, open)
  if (close === -1) throw new Error(`Malformed block for view "${id}"`)
  return { file, block: { open, close } }
}

/**
 * Update an existing (non-dynamic) view's title and/or element-scope in
 * place - editing the `title '...'` property inside its body (creating or
 * removing it, same as {@link updateElement}'s description handling), and
 * the header's `of <fqn>` clause (inserting, replacing, or removing it to
 * un-scope the view back to a plain top-level one).
 */
export async function updateView(
  files: Files,
  id: string,
  changes: { title?: string; viewOf?: string | null; order?: number | null },
): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ view: id, projectId } as never)
  if (!loc) throw new Error(`View "${id}" not found in source`)
  const { file, block } = await locateViewBlock(files, id)
  let text = files[file] ?? ''
  let { open, close } = block

  if (changes.viewOf !== undefined) {
    // `locate({view})`'s range is zero-width, at the *start* of the id
    // token (see `locateViewBlock`'s comment) - not its end, so the header
    // to replace starts right after the id itself, `idStart + id.length`.
    const idEnd = offsetOf(text, loc.range.start) + id.length
    const header = text.slice(idEnd, open)
    if (/\bextends\b/.test(header)) {
      throw new Error(`View "${id}" extends another view and can't also be scoped with "of"`)
    }
    const replacement = changes.viewOf ? ` of ${changes.viewOf} ` : ' '
    const delta = replacement.length - header.length
    text = text.slice(0, idEnd) + replacement + text.slice(open)
    open += delta
    close += delta
  }

  if (changes.title !== undefined) {
    const trimmed = changes.title.trim()
    const existing = findTopLevelProperty(text, 'title', open + 1, close)
    const before = text.length
    if (existing) {
      text = trimmed
        ? text.slice(0, existing.start) + `title ${quote(trimmed)}` + text.slice(existing.end)
        : removeSpan(text, lineStartOf(text, existing.start), existing.end)
    } else if (trimmed) {
      text = insertIntoBlock(text, { open, close }, `title ${quote(trimmed)}`)
    }
    close += text.length - before
  }

  if (changes.order !== undefined) {
    const existing = findTopLevelProperty(text, 'order', open + 1, close)
    const before = text.length
    if (existing) {
      text =
        changes.order !== null
          ? text.slice(0, existing.start) + `order ${changes.order}` + text.slice(existing.end)
          : removeSpan(text, lineStartOf(text, existing.start), existing.end)
    } else if (changes.order !== null) {
      text = insertIntoBlock(text, { open, close }, `order ${changes.order}`)
    }
    close += text.length - before
  }

  return repairUntilValid({ ...files, [file]: text })
}

/**
 * Show or hide one existing model element within one specific view - the
 * "what's *displayed* here" half of the model, distinct from the "does it
 * *exist*" half that `addElement`/`deleteElement` control. An element
 * declared in `model { }` doesn't automatically show up in every view;
 * whether it renders in a given one is entirely up to that view's own
 * `include`/`exclude` rules (most views just say `include *`, so this is
 * easy to miss until a view has a narrower rule set, or is scoped with
 * `of` - see `addView`'s "Scoped view" option - where a newly-added
 * sibling element may not be a neighbor of the scope element at all).
 *
 * Implemented as a plain standalone `include <fqn>` / `exclude <fqn>` line
 * appended to the view's body: LikeC4 evaluates a view's rules in written
 * order, so a freshly-appended rule always wins over whatever previously
 * decided this element's visibility (a wildcard `include *`, an ancestor's
 * `include <fqn>.**`, or an earlier toggle). Before appending, any
 * existing standalone single-fqn `include`/`exclude` line for this exact
 * fqn - what this same function itself writes - is removed first, so
 * toggling back and forth doesn't pile up dead lines. A hand-written
 * compound rule (`include a, b`, a tag predicate, `element.**`, etc.) is
 * never touched - the regex requires the whole line to be just this one
 * bare fqn.
 */
export async function setViewElementIncluded(
  files: Files,
  viewId: string,
  fqn: string,
  included: boolean,
): Promise<Files> {
  const { file, block } = await locateViewBlock(files, viewId)
  let text = files[file] ?? ''
  let { open, close } = block
  const escaped = fqn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lineRe = new RegExp(`^[ \\t]*(?:include|exclude)[ \\t]+${escaped}[ \\t]*(?:\\r?\\n|$)`, 'gm')
  lineRe.lastIndex = open + 1
  let m: RegExpExecArray | null
  while ((m = lineRe.exec(text)) && m.index < close) {
    text = text.slice(0, m.index) + text.slice(m.index + m[0].length)
    close -= m[0].length
    lineRe.lastIndex = m.index
  }
  text = insertIntoBlock(text, { open, close }, `${included ? 'include' : 'exclude'} ${fqn}`)
  return repairUntilValid({ ...files, [file]: text })
}

/** The four directions LikeC4's `autoLayout` rule accepts (ground-truthed
 * from the grammar: `ViewLayoutDirection`). */
export type ViewLayoutDirection = 'TopBottom' | 'LeftRight' | 'BottomTop' | 'RightLeft'

/**
 * Set, replace, or remove a view's `autoLayout <direction> [rankSep N
 * [nodeSep N]]` line - LikeC4's own lever for a narrower (or wider)
 * rendered diagram, most useful for publishing into a fixed-width
 * document/webpage column rather than an infinite pannable canvas (see
 * the "Disseminate" activity, which uses this both for a real edit and,
 * called against a disposable `files` clone, for a live sandbox preview
 * that never touches the real project). Same "remove any existing line
 * of this kind, then insert the new one" shape as
 * `setViewElementIncluded` - a view has at most one `autoLayout` line, so
 * there's no fqn to match, just the keyword itself. `layout: null` clears
 * it (falls back to LikeC4's own default direction).
 */
export async function setViewAutoLayout(
  files: Files,
  viewId: string,
  layout: { direction: ViewLayoutDirection; rankSep?: number; nodeSep?: number } | null,
): Promise<Files> {
  const { file, block } = await locateViewBlock(files, viewId)
  let text = files[file] ?? ''
  let { open, close } = block
  const lineRe = /^[ \t]*autoLayout\b.*(?:\r?\n|$)/gm
  lineRe.lastIndex = open + 1
  let m: RegExpExecArray | null
  while ((m = lineRe.exec(text)) && m.index < close) {
    text = text.slice(0, m.index) + text.slice(m.index + m[0].length)
    close -= m[0].length
    lineRe.lastIndex = m.index
  }
  if (layout) {
    const parts = ['autoLayout', layout.direction]
    if (layout.rankSep !== undefined) {
      parts.push('rankSep', String(layout.rankSep))
      if (layout.nodeSep !== undefined) parts.push('nodeSep', String(layout.nodeSep))
    }
    text = insertIntoBlock(text, { open, close }, parts.join(' '))
  }
  return repairUntilValid({ ...files, [file]: text })
}

/** Remove a view (`view id { }` or `dynamic view id { }`) entirely,
 * including every step/include inside it. */
export async function deleteView(files: Files, id: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ view: id, projectId } as never)
  if (!loc) throw new Error(`View "${id}" not found in source`)
  const { file, block } = await locateViewBlock(files, id)
  const text = files[file] ?? ''
  const stmtStart = lineStartOf(text, offsetOf(text, loc.range.start))
  const next = removeSpan(text, stmtStart, block.close + 1)
  return repairUntilValid({ ...files, [file]: next })
}

/** Append a step (`Source -> Target 'label'`) to an existing dynamic
 * view's body, in order after whatever steps it already has. */
export async function addStep(files: Files, viewId: string, input: NewRelationInput): Promise<Files> {
  const { file, block } = await locateViewBlock(files, viewId)
  const text = files[file] ?? ''
  const inserted = insertIntoBlock(text, block, buildRelationSnippet(input))
  return { ...files, [file]: inserted }
}

// ---------------------------------------------------------------------
// Deployment tree - deployment nodes, deployed instances, and relations
// between them. A separate layer from the model above (see
// DeploymentNodeSummary/DeploymentInstanceSummary's doc comments in
// engine.ts) - `locate({deployment: fqn})` is a real, documented
// counterpart to `locate({element: fqn})`, ground-truthed live, so every
// helper below mirrors its element-model equivalent closely.
// ---------------------------------------------------------------------

/** Locate an existing deployment node's `{ }` body - mirrors
 * {@link ensureElementBlock} exactly (a deployment node's own `locate()`
 * range spans its name token directly, same shape as an element's). */
async function ensureDeploymentBlock(
  files: Files,
  fqn: string,
): Promise<{ file: string; files: Files; block: BlockRange }> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ deployment: fqn, projectId } as never)
  if (!loc) throw new Error(`Deployment node "${fqn}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const source = files[file] ?? ''
  const nameEnd = offsetOf(source, loc.range.end)
  const { headerEnd, blockOpen } = scanDeclarationTail(source, nameEnd)
  if (blockOpen != null) {
    const close = findMatchingBrace(source, blockOpen)
    if (close === -1) throw new Error(`Malformed block for deployment node "${fqn}"`)
    return { file, files, block: { open: blockOpen, close } }
  }
  const { text, block } = openBodylessBlock(source, headerEnd)
  return { file, files: { ...files, [file]: text }, block }
}

/**
 * Find (or create) an `extend <parentFqn> { }` block in `targetFile` -
 * LikeC4's own mechanism for adding to a deployment node declared in a
 * *different* file, used instead of splicing directly into the parent's
 * own body whenever the parent doesn't live in `targetFile` (splicing
 * across files would silently edit a file the user isn't looking at).
 *
 * Ground-truthed live: `extend <fqn> { }` is only valid **nested inside a
 * `deployment { }` block** - the grammar's own top-level file rule has no
 * alternative for a bare `extend` statement - so this creates/reuses that
 * file's `deployment { }` block first (via
 * {@link findTopLevelBlockAcrossFiles}) and inserts the `extend` block
 * inside it, not as a standalone top-level statement.
 */
function ensureExtendDeploymentBlock(
  files: Files,
  parentFqn: string,
  targetFile: string,
): { file: string; files: Files; block: BlockRange } {
  const deployment = findTopLevelBlockAcrossFiles(files, 'deployment', targetFile)
  const text = deployment.files[deployment.file] ?? ''
  const existing = findKeywordDeclaration(text, 'extend', parentFqn, deployment.block.open + 1, deployment.block.close)
  if (existing?.blockOpen != null) {
    const close = findMatchingBrace(text, existing.blockOpen)
    if (close === -1) throw new Error(`Malformed "extend ${parentFqn}" block`)
    return { file: deployment.file, files: deployment.files, block: { open: existing.blockOpen, close } }
  }
  const inserted = insertIntoBlock(text, deployment.block, `extend ${parentFqn} {\n}`)
  const nextFiles = { ...deployment.files, [deployment.file]: inserted }
  // Re-scan the updated text for the block we just inserted, rather than
  // hand-tracking how far `insertIntoBlock` shifted every offset.
  const newDeploymentBlock = findTopLevelBlock(inserted, 'deployment')
  if (!newDeploymentBlock) throw new Error('internal: lost the "deployment { }" block after inserting into it')
  const decl = findKeywordDeclaration(inserted, 'extend', parentFqn, newDeploymentBlock.open + 1, newDeploymentBlock.close)
  if (!decl?.blockOpen) throw new Error(`internal: could not create "extend ${parentFqn} { }" block`)
  const declClose = findMatchingBrace(inserted, decl.blockOpen)
  if (declClose === -1) throw new Error(`internal: malformed freshly-created "extend ${parentFqn}" block`)
  return { file: deployment.file, files: nextFiles, block: { open: decl.blockOpen, close: declClose } }
}

/** Insert `snippet` as a new child of `parentFqn` - directly into its own
 * body if that's declared in `targetFile` already, otherwise via an
 * `extend <parentFqn> { }` block anchored in `targetFile` (see
 * {@link ensureExtendDeploymentBlock}). Shared by {@link addDeploymentNode}
 * and {@link addDeployedInstance} (an instance is always nested). */
async function insertUnderDeploymentParent(files: Files, parentFqn: string, targetFile: string, snippet: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const parentLoc = likec4.languageServices.locate({ deployment: parentFqn, projectId } as never)
  if (!parentLoc) throw new Error(`Deployment node "${parentFqn}" not found`)
  const parentFile = fileKeyFromLocationUri(parentLoc.uri)
  if (parentFile === targetFile) {
    const ensured = await ensureDeploymentBlock(files, parentFqn)
    const inserted = insertIntoBlock(ensured.files[ensured.file], ensured.block, snippet)
    return { ...ensured.files, [ensured.file]: inserted }
  }
  const ext = ensureExtendDeploymentBlock(files, parentFqn, targetFile)
  const inserted = insertIntoBlock(ext.files[ext.file], ext.block, snippet)
  return { ...ext.files, [ext.file]: inserted }
}

/** Add a `kind id 'Title' { }` deployment node - at the top `deployment { }`
 * level if `parentFqn` is null, otherwise nested under it (see
 * {@link insertUnderDeploymentParent}). */
export async function addDeploymentNode(
  files: Files,
  input: NewDeploymentNodeInput,
  parentFqn: string | null,
  targetFile: string,
): Promise<Files> {
  const fqn = parentFqn ? `${parentFqn}.${input.id}` : input.id
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  if (likec4.languageServices.locate({ deployment: fqn, projectId } as never)) {
    throw new Error(`Deployment node "${fqn}" already exists`)
  }
  const snippet = buildDeploymentNodeSnippet(input)
  if (parentFqn) return insertUnderDeploymentParent(files, parentFqn, targetFile, snippet)
  const target = findTopLevelBlockAcrossFiles(files, 'deployment', targetFile)
  const inserted = insertIntoBlock(target.files[target.file], target.block, snippet)
  return { ...target.files, [target.file]: inserted }
}

/** Add a `[id =] instanceOf <elementFqn> ['title']` deployed instance -
 * always nested under `parentNodeFqn` (the grammar has no top-level
 * form). */
export async function addDeployedInstance(
  files: Files,
  input: NewDeployedInstanceInput,
  parentNodeFqn: string,
  targetFile: string,
): Promise<Files> {
  const snippet = buildDeployedInstanceSnippet(input)
  return insertUnderDeploymentParent(files, parentNodeFqn, targetFile, snippet)
}

/**
 * Add a deployment relation. The UI always supplies an explicit
 * `sourceFqn` (a source/target picker, not free text), so this only
 * decides *where* to write the statement: nested inside the two
 * endpoints' shared parent's own body for a compact result when they're
 * direct siblings (matches idiomatic hand-written LikeC4 - ground-truthed
 * live), otherwise at the top `deployment { }` level with an explicit
 * source (always valid there, per the grammar).
 */
export async function addDeploymentRelation(
  files: Files,
  input: NewDeploymentRelationInput,
  targetFile: string,
): Promise<Files> {
  if (!input.sourceFqn) throw new Error('A deployment relation needs an explicit source')
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  if (!likec4.languageServices.locate({ deployment: input.sourceFqn, projectId } as never)) {
    throw new Error(`Deployment element "${input.sourceFqn}" not found`)
  }
  if (!likec4.languageServices.locate({ deployment: input.targetFqn, projectId } as never)) {
    throw new Error(`Deployment element "${input.targetFqn}" not found`)
  }
  const parentOf = (fqn: string) => (fqn.includes('.') ? fqn.slice(0, fqn.lastIndexOf('.')) : null)
  const sourceParent = parentOf(input.sourceFqn)
  const snippet = buildDeploymentRelationSnippet(input)
  if (sourceParent && sourceParent === parentOf(input.targetFqn)) {
    const ensured = await ensureDeploymentBlock(files, sourceParent)
    const inserted = insertIntoBlock(ensured.files[ensured.file], ensured.block, snippet)
    return { ...ensured.files, [ensured.file]: inserted }
  }
  const target = findTopLevelBlockAcrossFiles(files, 'deployment', targetFile)
  const inserted = insertIntoBlock(target.files[target.file], target.block, snippet)
  return { ...target.files, [target.file]: inserted }
}

/** Update a deployment node's title in place - same header-splicing
 * mechanics as {@link updateElement}'s title handling. */
export async function updateDeploymentNode(files: Files, fqn: string, changes: { title?: string }): Promise<Files> {
  if (changes.title === undefined) return files
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ deployment: fqn, projectId } as never)
  if (!loc) throw new Error(`Deployment node "${fqn}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const source = files[file] ?? ''
  const nameEnd = offsetOf(source, loc.range.end)
  const { titleRange } = scanDeclarationTail(source, nameEnd)
  const trimmed = changes.title.trim()
  if (titleRange) {
    const replacement = trimmed ? quote(trimmed) : ''
    return { ...files, [file]: source.slice(0, titleRange.start) + replacement + source.slice(titleRange.end) }
  }
  if (!trimmed) return files
  return { ...files, [file]: source.slice(0, nameEnd) + ' ' + quote(trimmed) + source.slice(nameEnd) }
}

export async function deleteDeploymentNode(files: Files, fqn: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ deployment: fqn, projectId } as never)
  if (!loc) throw new Error(`Deployment node "${fqn}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const text = removeDeclarationAt(files[file] ?? '', loc.range.start, loc.range.end)
  return repairUntilValid({ ...files, [file]: text })
}

/**
 * `locate({deployment: instanceFqn})` points at the *target reference*
 * token (`instanceOf <here>`) when the instance has no explicit `name =`
 * prefix, but at the instance's *own* name token when it does - two
 * different anchors depending on how it was written. Rather than branch
 * on that, always re-anchor past "instanceOf <target>" on the
 * declaration's own line (ground-truthed live against both forms) -
 * mirrors {@link locateRelationAfterTarget}'s identical trick for
 * relationships.
 */
async function locateDeployedInstanceAfterTarget(files: Files, instanceFqn: string): Promise<{ file: string; offset: number }> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ deployment: instanceFqn, projectId } as never)
  if (!loc) throw new Error(`Deployment instance "${instanceFqn}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const text = files[file] ?? ''
  const lineStart = lineStartOf(text, offsetOf(text, loc.range.start))
  const nl = text.indexOf('\n', lineStart)
  const lineEnd = nl === -1 ? text.length : nl
  const line = text.slice(lineStart, lineEnd)
  const kwIdx = line.indexOf('instanceOf')
  if (kwIdx === -1) throw new Error(`Could not locate "instanceOf" for deployment instance "${instanceFqn}"`)
  let i = kwIdx + 'instanceOf'.length
  while (i < line.length && /\s/.test(line[i])) i++
  while (i < line.length && /[\w.-]/.test(line[i])) i++
  return { file, offset: lineStart + i }
}

/** Update a deployed instance's title in place. */
export async function updateDeployedInstance(files: Files, fqn: string, changes: { title?: string }): Promise<Files> {
  if (changes.title === undefined) return files
  const { file, offset } = await locateDeployedInstanceAfterTarget(files, fqn)
  const text = files[file] ?? ''
  const { titleRange } = scanDeclarationTail(text, offset)
  const trimmed = changes.title.trim()
  if (titleRange) {
    const replacement = trimmed ? quote(trimmed) : ''
    return { ...files, [file]: text.slice(0, titleRange.start) + replacement + text.slice(titleRange.end) }
  }
  if (!trimmed) return files
  return { ...files, [file]: text.slice(0, offset) + ' ' + quote(trimmed) + text.slice(offset) }
}

export async function deleteDeployedInstance(files: Files, fqn: string): Promise<Files> {
  const { file, offset } = await locateDeployedInstanceAfterTarget(files, fqn)
  const text = files[file] ?? ''
  const stmtStart = lineStartOf(text, offset)
  const { blockOpen } = scanDeclarationTail(text, offset)
  let stmtEnd: number
  if (blockOpen != null) {
    const close = findMatchingBrace(text, blockOpen)
    if (close === -1) throw new Error(`Malformed block for deployment instance "${fqn}"`)
    stmtEnd = close + 1
  } else {
    const nl = text.indexOf('\n', offset)
    stmtEnd = nl === -1 ? text.length : nl
  }
  const next = removeSpan(text, stmtStart, stmtEnd)
  return repairUntilValid({ ...files, [file]: next })
}

/** Delete a deployment relation - `locate({relation: id})` resolves a
 * deployment relation's id the same way it resolves a model relation's
 * (same id space, ground-truthed live), so this mirrors
 * {@link deleteRelation} exactly. */
export async function deleteDeploymentRelation(files: Files, relationId: string): Promise<Files> {
  const likec4 = await fromSources(files)
  const projectId = currentProjectId(files)
  const loc = likec4.languageServices.locate({ relation: relationId, projectId } as never)
  if (!loc) throw new Error(`Deployment relation "${relationId}" not found in source`)
  const file = fileKeyFromLocationUri(loc.uri)
  const text = removeDeclarationAt(files[file] ?? '', loc.range.start, loc.range.end)
  return repairUntilValid({ ...files, [file]: text })
}
