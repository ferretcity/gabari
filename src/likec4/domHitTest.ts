/**
 * `@likec4/diagram` renders each view inside a shadow root (for style
 * isolation), so a plain `document.elementFromPoint` can't see into it.
 * This walks shadow boundaries to find the deepest (most specific)
 * rendered element node under a client-coordinate point, returning its
 * fqn - so dropping a Library card directly onto an existing box can nest
 * the new element inside it.
 */
export function findNodeFqnAtPoint(clientX: number, clientY: number): string | null {
  const roots: (Document | ShadowRoot)[] = [document]
  const collectShadowRoots = (root: ParentNode) => {
    const all = root.querySelectorAll('*')
    for (const el of all) {
      if (el.shadowRoot) {
        roots.push(el.shadowRoot)
        collectShadowRoots(el.shadowRoot)
      }
    }
  }
  collectShadowRoots(document.body)

  let best: { fqn: string; area: number } | null = null
  for (const root of roots) {
    const nodes = root.querySelectorAll<HTMLElement>('.react-flow__node[data-id]')
    for (const node of nodes) {
      const fqn = node.dataset.id
      if (!fqn) continue
      const rect = node.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue
      const area = rect.width * rect.height
      if (!best || area < best.area) best = { fqn, area }
    }
  }
  return best?.fqn ?? null
}
