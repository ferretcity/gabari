import { useState } from 'react'
import type { Files } from '../likec4/fileKeys'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import { FolderIcon } from './icons'

interface TreeFolder {
  type: 'folder'
  /** this folder's own name (not the full path) */
  name: string
  /** full path from the project root, e.g. "shared/aws" */
  path: string
  children: TreeNode[]
}

interface TreeFile {
  type: 'file'
  /** this file's own basename (not the full path) */
  name: string
  /** the actual `files` record key */
  path: string
}

type TreeNode = TreeFolder | TreeFile

/** Build a real folder tree out of `files`' flat keys (which may contain
 * `/` - a project isn't required to be organized this way, but nothing
 * stops it either) - folders before files, alphabetical within each
 * group, the standard explorer ordering. */
function buildTree(fileNames: string[]): TreeNode[] {
  const root: TreeFolder = { type: 'folder', name: '', path: '', children: [] }
  for (const fullPath of fileNames) {
    const parts = fullPath.split('/')
    let cursor = root
    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        cursor.children.push({ type: 'file', name: parts[i], path: fullPath })
        continue
      }
      const folderPath = parts.slice(0, i + 1).join('/')
      let folder = cursor.children.find((c): c is TreeFolder => c.type === 'folder' && c.name === parts[i])
      if (!folder) {
        folder = { type: 'folder', name: parts[i], path: folderPath, children: [] }
        cursor.children.push(folder)
      }
      cursor = folder
    }
  }
  const sortChildren = (node: TreeFolder) => {
    node.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
    for (const child of node.children) if (child.type === 'folder') sortChildren(child)
  }
  sortChildren(root)
  return root.children
}

/**
 * The project's file tree - a standard collapsible "Explorer" section in
 * the sidebar (same visual language as the Views/Elements/Relationships
 * sections below it), rather than being buried alongside the raw DSL
 * text. A `files` key containing `/` (e.g. "shared/aws.c4") renders as a
 * real, collapsible folder - not a flat row showing the whole path as
 * text. Selecting a file row sets the active file the DSL panel (and
 * every "add new X" action) targets; right-click (or double-click) a file
 * to rename or delete it - renaming edits just that file's own name, the
 * folder it's in is kept.
 */
export default function FileTree({
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onRenameFile,
  onDeleteFile,
  busy,
}: {
  files: Files
  activeFile: string
  onSelectFile: (file: string) => void
  onAddFile: () => void
  onRenameFile: (oldName: string, newName: string) => void
  onDeleteFile: (file: string) => void
  busy: boolean
}) {
  const fileCount = Object.keys(files).length
  const tree = buildTree(Object.keys(files))
  const [renaming, setRenaming] = useState<{ file: string; value: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ file: string; x: number; y: number } | null>(null)

  const commitRename = () => {
    if (!renaming) return
    const trimmed = renaming.value.trim()
    setRenaming(null)
    if (!trimmed || trimmed === renaming.file.split('/').pop()) return
    // Rebuild the full key from the file's existing folder + the new
    // basename - renaming a leaf shouldn't require retyping its path.
    const folder = renaming.file.includes('/') ? renaming.file.slice(0, renaming.file.lastIndexOf('/') + 1) : ''
    onRenameFile(renaming.file, folder + trimmed)
  }

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? [
        {
          label: 'Rename…',
          onSelect: () => setRenaming({ file: contextMenu.file, value: contextMenu.file.split('/').pop() ?? '' }),
        },
        { label: 'Delete', danger: true, onSelect: () => onDeleteFile(contextMenu.file) },
      ]
    : []

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    if (node.type === 'folder') {
      return (
        <details key={node.path} className="file-tree-folder" open>
          <summary className="entity-row file-tree-folder-row" style={{ paddingLeft: depth * 14 }}>
            <span className="chevron" aria-hidden="true">
              ▸
            </span>
            <FolderIcon />
            <span className="entity-title">{node.name}</span>
          </summary>
          {node.children.map(child => renderNode(child, depth + 1))}
        </details>
      )
    }

    const file = node.path
    return (
      <div
        key={file}
        className={'entity-row' + (file === activeFile ? ' pending-source' : '')}
        style={{ paddingLeft: depth * 14 + 14 }}
        onClick={() => onSelectFile(file)}
        onContextMenu={e => {
          e.preventDefault()
          setContextMenu({ file, x: e.clientX, y: e.clientY })
        }}
        onDoubleClick={() => setRenaming({ file, value: node.name })}
      >
        {renaming?.file === file ? (
          <input
            autoFocus
            className="file-rename-input"
            value={renaming.value}
            onClick={e => e.stopPropagation()}
            onChange={e => setRenaming({ file, value: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(null)
            }}
            onBlur={commitRename}
          />
        ) : (
          <span className="entity-title" title={file}>
            {node.name}
          </span>
        )}
        <button
          className="icon-btn"
          aria-label={`Delete ${file}`}
          title="Delete file"
          onClick={e => {
            e.stopPropagation()
            onDeleteFile(file)
          }}
          disabled={busy || fileCount <= 1}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="sidebar-panel-section">
      <div className="sidebar-section-header">
        <h3>Files</h3>
        <button className="btn btn-primary btn-sm" onClick={onAddFile} disabled={busy}>
          + File
        </button>
      </div>
      <div className="entity-list file-tree">{tree.map(node => renderNode(node, 0))}</div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
