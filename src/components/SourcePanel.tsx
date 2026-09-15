import type { Files } from '../likec4/fileKeys'

/**
 * The raw DSL source, docked at the bottom and collapsed by default - like
 * an IDE's integrated terminal/output panel - so the diagram canvas gets
 * the full modeling view by default. Click the summary bar to expand it
 * when you want to hand-edit a file directly; the file tree itself lives
 * in the sidebar (see `FileTree.tsx`), not here.
 */
export default function SourcePanel({
  files,
  activeFile,
  onChangeFileText,
  parsing,
}: {
  files: Files
  activeFile: string
  onChangeFileText: (file: string, text: string) => void
  parsing: boolean
}) {
  return (
    <details className="source-panel">
      <summary>
        DSL source <span className="active-file-hint">— {activeFile}</span>
        {parsing && <span className="parsing-hint">(parsing…)</span>}
      </summary>
      <textarea
        className="source-textarea"
        value={files[activeFile] ?? ''}
        spellCheck={false}
        onChange={e => onChangeFileText(activeFile, e.target.value)}
      />
    </details>
  )
}
