import { useRef, useState } from 'react'
import ContextMenu, { type ContextMenuEntry } from './ContextMenu'
import { connectedRepoLabel, connectedRepoProviderName, type ConnectedRepo } from '../git/connectedRepo'
import { fileDiffCount, type FileDiff } from '../git/diffFiles'

/**
 * The header's one and only menu button - file operations (new/import/
 * export) and the repo connection (connect/push/disconnect) used to be
 * two separate buttons; merged here since they're both "what do I do with
 * this project" actions, and a project only has one repo connection at a
 * time anyway. The dot before "File" is a glanceable sign-in indicator -
 * filled/green once a repo is connected this session, dim/gray
 * otherwise - so you don't have to open the menu to know; the dropdown's
 * own status row spells out which repo, for when you do.
 */
export default function FileMenu({
  onNew,
  onImportFile,
  onOpenProject,
  onImportElements,
  onCopyDsl,
  onExport,
  connectedRepo,
  pendingPush,
  busy,
  onConnectRepo,
  onPullLatest,
  onPush,
  onDisconnectRepo,
}: {
  onNew: () => void
  onImportFile: () => void
  onOpenProject: () => void
  onImportElements: () => void
  onCopyDsl: () => void
  onExport: () => void
  connectedRepo: ConnectedRepo | null
  pendingPush: FileDiff | null
  busy: boolean
  onConnectRepo: () => void
  onPullLatest: () => void
  onPush: () => void
  onDisconnectRepo: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const repoItems: ContextMenuEntry[] = connectedRepo
    ? (() => {
        const changeCount = pendingPush ? fileDiffCount(pendingPush) : 0
        return [
          {
            label: `Signed in — ${connectedRepoLabel(connectedRepo)} @ ${connectedRepo.ref.branch} (${connectedRepoProviderName(connectedRepo)})`,
            onSelect: () => {},
            disabled: true,
          },
          { label: 'Pull latest', onSelect: onPullLatest, disabled: busy },
          { label: changeCount ? `Push (${changeCount} changed)` : 'Push (no changes)', onSelect: onPush, disabled: busy || changeCount === 0 },
          { label: 'Disconnect', onSelect: onDisconnectRepo, danger: true },
        ]
      })()
    : [
        { label: 'Not signed in', onSelect: () => {}, disabled: true },
        { label: 'Connect Repo…', onSelect: onConnectRepo },
      ]

  const items: ContextMenuEntry[] = [
    { label: 'New', onSelect: onNew },
    'separator',
    { label: 'Open Project…', onSelect: onOpenProject },
    { label: 'Import .c4…', onSelect: onImportFile },
    { label: 'Import Elements…', onSelect: onImportElements },
    'separator',
    { label: 'Copy DSL', onSelect: onCopyDsl },
    { label: 'Export .c4', onSelect: onExport },
    'separator',
    ...repoItems,
  ]

  const statusTitle = connectedRepo
    ? `Signed in to ${connectedRepoProviderName(connectedRepo)} — ${connectedRepoLabel(connectedRepo)} (${connectedRepo.ref.branch})`
    : 'Not signed in to a repo this session'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={menuPos !== null}
        title={statusTitle}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect()
          if (rect) setMenuPos({ x: rect.left, y: rect.bottom + 4 })
        }}
      >
        <span className={'repo-status-dot' + (connectedRepo ? ' connected' : '')} aria-hidden="true" />
        File <span className="menu-caret">▾</span>
      </button>
      {menuPos && <ContextMenu x={menuPos.x} y={menuPos.y} items={items} onClose={() => setMenuPos(null)} />}
    </>
  )
}
