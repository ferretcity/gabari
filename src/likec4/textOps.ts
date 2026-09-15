/**
 * Minimal text surgery over LikeC4 DSL source.
 *
 * We deliberately do NOT re-serialize the whole model on every edit — the
 * user's source text (and their formatting/comments) stays the source of
 * truth. Visual "add element" / "add relationship" / "delete" actions
 * compute a small, targeted text insertion or removal instead, the same way
 * a human would type it.
 *
 * Finding *where* to operate leans on the real LikeC4 parser's `locate()`
 * (see mutate.ts), which knows exactly which line an element/relation is
 * declared on — we only need small local scanning from that point (does
 * this declaration have a `{ }` body? where does it end?).
 */

export interface BlockRange {
  /** index of the opening `{` */
  open: number
  /** index of the matching closing `}` */
  close: number
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Given the index of an opening `{`, find the index of its matching `}`,
 * skipping over `'...'` / "..." string literals and `//` line comments.
 * Returns -1 if unmatched (malformed source).
 */
export function findMatchingBrace(text: string, openIndex: number): number {
  if (text[openIndex] !== '{') {
    throw new Error(`findMatchingBrace: character at ${openIndex} is not '{'`)
  }
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Find a top-level keyword block, e.g. `model { ... }` or `views { ... }`.
 * Only matches occurrences at the start of a line (ignoring leading
 * whitespace), so it won't match a nested element that happens to share a
 * name with the keyword.
 */
export function findTopLevelBlock(text: string, keyword: string): BlockRange | null {
  const re = new RegExp(`(^|\\n)[ \\t]*${escapeRegExp(keyword)}\\s*\\{`)
  const m = re.exec(text)
  if (!m) return null
  const openIndex = m.index + m[0].length - 1
  const close = findMatchingBrace(text, openIndex)
  if (close === -1) return null
  return { open: openIndex, close }
}

/** Convert a 0-based {line, character} position to a plain string offset. */
export function offsetOf(text: string, pos: { line: number; character: number }): number {
  let offset = 0
  let line = 0
  let i = 0
  while (line < pos.line) {
    const nl = text.indexOf('\n', i)
    if (nl === -1) {
      // position points past the end of the text - clamp
      return text.length
    }
    i = nl + 1
    line++
  }
  offset = i + pos.character
  return Math.min(offset, text.length)
}

/**
 * From the end of an element/relation's id token, scan forward past any
 * optional quoted strings (title/description/technology). Returns the
 * index of the following `{` if a body is present, the index right after
 * the last optional string otherwise (a safe place to append one), and the
 * exact range of the first string (the title) if one is present.
 */
export function scanDeclarationTail(
  text: string,
  from: number,
): { headerEnd: number; blockOpen: number | null; titleRange: { start: number; end: number } | null } {
  let i = from
  let titleRange: { start: number; end: number } | null = null
  const skipWs = () => {
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++
  }
  skipWs()
  let stringIndex = 0
  while (i < text.length && (text[i] === "'" || text[i] === '"')) {
    const start = i
    const quote = text[i]
    i++
    while (i < text.length && text[i] !== quote) {
      if (text[i] === '\\') i++
      i++
    }
    i++ // closing quote
    if (stringIndex === 0) titleRange = { start, end: i }
    stringIndex++
    skipWs()
  }
  if (text[i] === '{') {
    return { headerEnd: i, blockOpen: i, titleRange }
  }
  return { headerEnd: i, blockOpen: null, titleRange }
}

/**
 * Find a single-line `key 'value'` property statement (e.g. `description
 * '...'`) directly inside [bodyStart, bodyEnd) - not inside any nested
 * `{ }` block within it (so a same-named property on a deeper, nested
 * element isn't mistaken for this element's own). Returns the statement's
 * full span (from the property key to the end of its line), or null.
 */
export function findTopLevelProperty(
  text: string,
  key: string,
  bodyStart: number,
  bodyEnd: number,
): { start: number; end: number } | null {
  let i = bodyStart
  let depth = 0
  let atLineStart = true
  while (i < bodyEnd) {
    const ch = text[i]
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 || nl > bodyEnd ? bodyEnd : nl
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      while (i < bodyEnd && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      i++
      atLineStart = false
      continue
    }
    if (ch === '{') {
      depth++
      i++
      atLineStart = false
      continue
    }
    if (ch === '}') {
      depth--
      i++
      atLineStart = false
      continue
    }
    if (ch === '\n') {
      i++
      atLineStart = true
      continue
    }
    if (atLineStart && depth === 0 && (ch === ' ' || ch === '\t')) {
      i++
      continue
    }
    if (atLineStart && depth === 0) {
      if (text.startsWith(key, i) && !/[\w-]/.test(text[i + key.length] ?? '')) {
        let end = i + key.length
        while (end < bodyEnd && text[end] !== '\n') {
          if (text[end] === "'" || text[end] === '"') {
            const quote = text[end]
            end++
            while (end < bodyEnd && text[end] !== quote) {
              if (text[end] === '\\') end++
              end++
            }
            end++
            continue
          }
          end++
        }
        return { start: i, end }
      }
      atLineStart = false
      i++
      continue
    }
    atLineStart = false
    i++
  }
  return null
}

/**
 * Find a nested `keyword { ... }` block (e.g. `style { }`) directly inside
 * [bodyStart, bodyEnd) - not inside any deeper block within it. Depth-aware
 * the same way {@link findTopLevelProperty} is, so a same-named block on a
 * nested child isn't mistaken for this body's own.
 */
export function findTopLevelSubBlock(
  text: string,
  keyword: string,
  bodyStart: number,
  bodyEnd: number,
): BlockRange | null {
  let i = bodyStart
  let depth = 0
  let atLineStart = true
  while (i < bodyEnd) {
    const ch = text[i]
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 || nl > bodyEnd ? bodyEnd : nl
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      while (i < bodyEnd && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      i++
      atLineStart = false
      continue
    }
    if (atLineStart && depth === 0 && (ch === ' ' || ch === '\t')) {
      i++
      continue
    }
    if (atLineStart && depth === 0 && text.startsWith(keyword, i) && !/[\w-]/.test(text[i + keyword.length] ?? '')) {
      let j = i + keyword.length
      while (j < bodyEnd && (text[j] === ' ' || text[j] === '\t')) j++
      if (text[j] === '{') {
        const close = findMatchingBrace(text, j)
        if (close !== -1 && close < bodyEnd) return { open: j, close }
      }
    }
    if (ch === '{') {
      depth++
      i++
      atLineStart = false
      continue
    }
    if (ch === '}') {
      depth--
      i++
      atLineStart = false
      continue
    }
    if (ch === '\n') {
      i++
      atLineStart = true
      continue
    }
    atLineStart = false
    i++
  }
  return null
}

/**
 * Find a `keyword name` declaration (e.g. `element system`, `tag important`,
 * `relationship async`) within [rangeStart, rangeEnd) - used for
 * specification-block entries, which (unlike model elements) have no
 * `locate()` support of their own. Unlike model elements, spec entry
 * headers have no optional title strings before the body, just whitespace.
 */
export function findKeywordDeclaration(
  text: string,
  keyword: string,
  name: string,
  rangeStart: number,
  rangeEnd: number,
): { matchStart: number; headerEnd: number; blockOpen: number | null } | null {
  const re = new RegExp(`\\b${escapeRegExp(keyword)}\\s+${escapeRegExp(name)}\\b`, 'g')
  re.lastIndex = rangeStart
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index >= rangeEnd) return null
    let i = m.index + m[0].length
    while (i < rangeEnd && (text[i] === ' ' || text[i] === '\t')) i++
    if (text[i] === '{') {
      return { matchStart: m.index, headerEnd: i, blockOpen: i }
    }
    return { matchStart: m.index, headerEnd: i, blockOpen: null }
  }
  return null
}

/**
 * Find every `keyword <name> { ... }` block directly inside
 * [rangeStart, rangeEnd) (e.g. every `view id { ... }` inside a `views { }`
 * block). Blocks with no body (bodyless) are skipped since there's nowhere
 * to insert into. Does not descend into nested blocks.
 */
export function findAllKeywordBlocks(
  text: string,
  keyword: string,
  rangeStart: number,
  rangeEnd: number,
): BlockRange[] {
  const re = new RegExp(`(^|\\n)[ \\t]*${escapeRegExp(keyword)}\\s+[A-Za-z_][\\w-]*\\b`, 'g')
  re.lastIndex = rangeStart
  const blocks: BlockRange[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const matchStart = m.index + m[1].length
    if (matchStart >= rangeEnd) break
    let i = m.index + m[0].length
    while (i < rangeEnd && (text[i] === ' ' || text[i] === '\t' || (text[i] === "'" || text[i] === '"'))) {
      if (text[i] === "'" || text[i] === '"') {
        const quote = text[i]
        i++
        while (i < rangeEnd && text[i] !== quote) {
          if (text[i] === '\\') i++
          i++
        }
        i++
      } else {
        i++
      }
    }
    if (text[i] === '{') {
      const close = findMatchingBrace(text, i)
      if (close !== -1 && close < rangeEnd) {
        blocks.push({ open: i, close })
        re.lastIndex = close + 1
        continue
      }
    }
    re.lastIndex = i
  }
  return blocks
}

/** Indent every non-blank line of `body` by `indent`. */
function indentBlock(body: string, indent: string): string {
  return body
    .split('\n')
    .map(line => (line.trim().length ? indent + line : line))
    .join('\n')
}

/**
 * Insert `snippet` (one or more statement lines) just before the closing
 * brace of `block`, matching the indentation of sibling content.
 */
export function insertIntoBlock(text: string, block: BlockRange, snippet: string): string {
  const lineStart = text.lastIndexOf('\n', block.close) + 1
  const closingLineIndent = text.slice(lineStart, block.close).match(/^[ \t]*/)?.[0] ?? ''
  const childIndent = closingLineIndent + '  '
  const body = indentBlock(snippet.trimEnd(), childIndent)
  // Cut `before` at the start of the closing line, not at the brace itself -
  // otherwise that line's own leading whitespace (already captured above as
  // `closingLineIndent`, and about to be re-added on the new closing line
  // below) stays behind and gets doubled up against the new content's own
  // indent. Invisible for a top-level block (no leading whitespace to
  // double), which is why this only shows up once something is nested.
  const before = text.slice(0, lineStart)
  const after = text.slice(block.close)
  const needsLeadingNewline = !/\n[ \t]*$/.test(before)
  const insertion = (needsLeadingNewline ? '\n' : '') + body + '\n' + closingLineIndent
  return before + insertion + after
}

/**
 * Find the start of the line containing `index` (i.e. index of the first
 * character after the preceding newline).
 */
export function lineStartOf(text: string, index: number): number {
  return text.lastIndexOf('\n', index - 1) + 1
}

/**
 * Convert a bodyless declaration (`kind id 'Title'`, a relation statement,
 * or a spec entry's `keyword name`) into an (empty) block in place, right
 * after `headerEnd`. The closing brace is indented to match the header
 * line's own indentation - not column 0 - so a later `insertIntoBlock`
 * computes a `childIndent` reflecting this declaration's real nesting
 * depth, whatever it is, rather than resetting it to top-level.
 */
export function openBodylessBlock(text: string, headerEnd: number): { text: string; block: BlockRange } {
  const headerLineIndent = text.slice(lineStartOf(text, headerEnd), headerEnd).match(/^[ \t]*/)?.[0] ?? ''
  const next = text.slice(0, headerEnd) + ` {\n${headerLineIndent}}` + text.slice(headerEnd)
  const open = headerEnd + 1
  const close = findMatchingBrace(next, open)
  return { text: next, block: { open, close } }
}

/**
 * Remove the statement spanning [start, end) (end exclusive, e.g. the
 * index of a block's closing `}` + 1, or end-of-line for a bodyless
 * statement), consuming the line's leading indentation and one trailing
 * newline so no blank line is left behind.
 */
export function removeSpan(text: string, start: number, end: number): string {
  const lineStart = lineStartOf(text, start)
  const from = /^[ \t]*$/.test(text.slice(lineStart, start)) ? lineStart : start
  const to = text[end] === '\n' ? end + 1 : end
  return text.slice(0, from) + text.slice(to)
}
