import { useCallback, useEffect, useRef, useState } from 'react'
import { parseFiles, parseSingleSource, type ParseResult } from './likec4/engine'
import {
  addDeployedInstance,
  addDeploymentNode,
  addDeploymentNodeKind,
  addDeploymentRelation,
  addDeploymentView,
  addElement,
  addElementKind,
  addRelation,
  addRelationshipKind,
  addStep,
  addTag,
  addView,
  deleteDeployedInstance,
  deleteDeploymentNode,
  deleteDeploymentNodeKind,
  deleteDeploymentRelation,
  deleteElement,
  deleteElementKind,
  deleteRelation,
  deleteRelationshipKind,
  deleteTag,
  deleteView,
  importElements,
  importSpecPreset,
  moveElement,
  updateDeployedInstance,
  updateDeploymentNode,
  updateDeploymentNodeKind,
  updateElement,
  updateElementKind,
  updateElementStyle,
  updateRelation,
  updateRelationshipKind,
  updateRelationStyle,
  updateTag,
  updateView,
  setViewElementIncluded,
  setViewAutoLayout,
  addLink,
  removeLink,
  type LinkTarget,
} from './likec4/mutate'
import { STARTER_FILES } from './likec4/dslGen'
import {
  listDisseminateDocuments,
  writeDisseminateDocument,
  deleteDisseminateDocument,
  newDocumentId,
  type DisseminateDocument,
} from './likec4/disseminate'
import {
  listDecisions,
  writeDecision,
  deleteDecision,
  newDecisionId,
  newDecisionPath,
  relatedDecisionRecords,
  DECISION_KIND_INFO,
  type DecisionKind,
  type DecisionRecord,
} from './likec4/decisions'
import { captureSection, buildDocumentHtml, buildSlidesHtml, downloadHtml, type ExportedSection } from './likec4/exportDiagram'
import { readProjectConfig, writeProjectConfig, type ProjectConfig } from './likec4/projectConfig'
import { DEFAULT_FILE, type Files } from './likec4/fileKeys'
import { loadManualLayouts, saveManualLayouts, type ManualLayouts } from './likec4/manualLayouts'
import { loadSpecPresets, saveSpecPresets, type SpecPreset } from './likec4/specPresets'
import { BUILTIN_SPEC_PRESETS } from './likec4/builtinPresets'
import type { LayoutedView } from '@likec4/core/types'
import {
  fetchProject as fetchGitHubProject,
  commitChanges as commitGitHubChanges,
  getDefaultBranch as getGitHubDefaultBranch,
  type GitHubRepoRef,
} from './git/github'
import {
  fetchProject as fetchGitLabProject,
  commitChanges as commitGitLabChanges,
  getDefaultBranch as getGitLabDefaultBranch,
  type GitLabRepoRef,
} from './git/gitlab'
import { beginLogin as beginGitLabLogin, completeLogin as completeGitLabLogin } from './git/gitlabAuth'
import { diffFiles, fileDiffCount } from './git/diffFiles'
import { connectedRepoLabel, connectedRepoProviderName, type ConnectedRepo } from './git/connectedRepo'
import { isProjectFile } from './git/projectFiles'
import Sidebar from './components/Sidebar'
import DiagramPanel from './components/DiagramPanel'
import SourcePanel from './components/SourcePanel'
import AddElementDialog, { type AddElementValues } from './components/AddElementDialog'
import AddRelationDialog, { type AddRelationValues } from './components/AddRelationDialog'
import AddViewDialog, { type AddViewValues } from './components/AddViewDialog'
import AddStepDialog, { type AddStepValues } from './components/AddStepDialog'
import EditElementDialog from './components/EditElementDialog'
import EditRelationDialog from './components/EditRelationDialog'
import EditViewDialog from './components/EditViewDialog'
import ViewContentsDialog from './components/ViewContentsDialog'
import AddDeploymentNodeDialog, { type AddDeploymentNodeValues } from './components/AddDeploymentNodeDialog'
import AddDeployedInstanceDialog, { type AddDeployedInstanceValues } from './components/AddDeployedInstanceDialog'
import AddDeploymentRelationDialog, { type AddDeploymentRelationValues } from './components/AddDeploymentRelationDialog'
import EditDeploymentNodeDialog from './components/EditDeploymentNodeDialog'
import EditDeployedInstanceDialog from './components/EditDeployedInstanceDialog'
import AddDeploymentViewDialog from './components/AddDeploymentViewDialog'
import ProjectSettingsDialog from './components/ProjectSettingsDialog'
import ImportElementsDialog from './components/ImportElementsDialog'
import DeploymentContentsDialog from './components/DeploymentContentsDialog'
import ConfirmDialog from './components/ConfirmDialog'
import SpecificationEditor from './components/SpecificationEditor'
import ContextMenu, { type ContextMenuEntry } from './components/ContextMenu'
import ConnectRepoDialog, { type ConnectGitHubValues, type LoginGitLabValues } from './components/ConnectRepoDialog'
import PushDialog from './components/PushDialog'
import ResizeHandle from './components/ResizeHandle'
import ThemeToggle, { type ThemeChoice } from './components/ThemeToggle'
import FileMenu from './components/FileMenu'
import DisseminateNotebook, { type LayoutOverride } from './components/DisseminateNotebook'
import DecisionEditor from './components/DecisionEditor'
import { type SidebarPanel } from './components/ActivityBar'
import { LogoMark } from './components/icons'

/** Where GitLab's OAuth redirect comes back to - this exact page, with no
 * path/query, so it works whatever base path the app is deployed under. */
function gitlabRedirectUri(): string {
  return window.location.origin + window.location.pathname
}

const FILES_STORAGE_KEY = 'gabari:files'
/** Pre-rebrand storage key (same multi-file shape, just under the app's
 * old "likec4-editor" name) - if present (and the current key isn't), its
 * content is migrated in on first load. */
const PRE_REBRAND_FILES_STORAGE_KEY = 'likec4-editor:files'
/** Pre-multi-file storage key (single source string, from before either
 * rebrand) - the oldest fallback, checked last. Every legacy key is left
 * in place afterward (untouched, harmless) rather than deleted. */
const LEGACY_STORAGE_KEY = 'likec4-editor:source'
const SIDEBAR_WIDTH_KEY = 'gabari:sidebar-width'
const THEME_KEY = 'gabari:theme'

function loadTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore (private browsing, etc.)
  }
  return 'system'
}

function loadInitialFiles(): Files {
  try {
    const raw = localStorage.getItem(FILES_STORAGE_KEY) ?? localStorage.getItem(PRE_REBRAND_FILES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Files
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) return { [DEFAULT_FILE]: legacy }
  } catch {
    // ignore (private browsing, quota, corrupted JSON, etc.)
  }
  return STARTER_FILES
}

const EMPTY_RESULT: ParseResult = {
  ok: true,
  errors: [],
  elements: [],
  relationships: [],
  kinds: [],
  relationshipKinds: [],
  elementKindSpecs: [],
  relationshipKindSpecs: [],
  tagSpecs: [],
  deploymentNodeKinds: [],
  deploymentNodes: [],
  deploymentInstances: [],
  deploymentRelations: [],
  views: [],
  diagrams: [],
  layoutedModel: null,
  projectConfig: null,
}

export default function App() {
  const [files, setFiles] = useState<Files>(loadInitialFiles)
  const [activeFile, setActiveFile] = useState<string>(() => {
    const f = loadInitialFiles()
    return DEFAULT_FILE in f ? DEFAULT_FILE : (Object.keys(f)[0] ?? DEFAULT_FILE)
  })
  const [result, setResult] = useState<ParseResult>(EMPTY_RESULT)
  const [revision, setRevision] = useState(0)
  const [parsing, setParsing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dialog, setDialog] = useState<
    | null
    | 'element'
    | 'relation'
    | 'spec'
    | 'editElement'
    | 'editRelation'
    | 'editView'
    | 'addView'
    | 'addStep'
    | 'viewContents'
    | 'connectRepo'
    | 'push'
    | 'addDeploymentNode'
    | 'addDeployedInstance'
    | 'addDeploymentRelation'
    | 'editDeploymentNode'
    | 'editDeployedInstance'
    | 'addDeploymentView'
    | 'deploymentViewContents'
    | 'projectSettings'
    | 'importElements'
  >(null)
  const [connectedRepo, setConnectedRepo] = useState<ConnectedRepo | null>(null)
  /** Last connect attempt's failure, if any - fed into `ConnectRepoDialog`
   * so a failed GitHub connect can show the error inline and send the
   * user back to their still-filled-in form, instead of the dialog just
   * closing and a toast being the only trace. Cleared at the start of
   * every fresh attempt and whenever the dialog is (re)opened. */
  const [connectError, setConnectError] = useState<string | null>(null)
  /** Same idea as `connectError`, for a failed push - shown inline in
   * `PushDialog`, which (like `ConnectRepoDialog`) stays open on failure
   * so the commit message isn't lost. Cleared whenever the dialog opens. */
  const [pushError, setPushError] = useState<string | null>(null)
  const [pendingElementPreset, setPendingElementPreset] = useState<{ kind?: string; parentFqn?: string | null }>({})
  const [pendingRelationPreset, setPendingRelationPreset] = useState<{ source?: string; target?: string }>({})
  const [pendingDeploymentRelationPreset, setPendingDeploymentRelationPreset] = useState<{
    source?: string
    target?: string
  }>({})
  const [connectPendingSource, setConnectPendingSource] = useState<string | null>(null)
  const [editingElementFqn, setEditingElementFqn] = useState<string | null>(null)
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null)
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [pendingDeploymentNodeParent, setPendingDeploymentNodeParent] = useState<string | null>(null)
  const [pendingInstanceParent, setPendingInstanceParent] = useState<string | null>(null)
  const [editingDeploymentNodeFqn, setEditingDeploymentNodeFqn] = useState<string | null>(null)
  const [editingDeployedInstanceFqn, setEditingDeployedInstanceFqn] = useState<string | null>(null)
  // Lifted out of Sidebar (was local state there) since the Disseminate
  // panel needs App.tsx to know when it's active, to decide what the main
  // canvas area shows.
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('files')
  const [disseminateActiveDocId, setDisseminateActiveDocId] = useState<string | null>(null)
  const [disseminateActiveSectionId, setDisseminateActiveSectionId] = useState<string | null>(null)
  /** A sandboxed `autoLayout` override for whichever view section is being
   * edited - never written to `files` until "Apply to view"; see the
   * debounced re-parse effect below that turns this into
   * `disseminateSandbox`. */
  const [disseminateLayoutOverride, setDisseminateLayoutOverride] = useState<LayoutOverride | null>(null)
  const [disseminateSandbox, setDisseminateSandbox] = useState<ParseResult | null>(null)
  const [decisionActiveId, setDecisionActiveId] = useState<string | null>(null)
  // Two fully separate "which view is showing" states, one per layer, plus
  // which one is currently on screen - kept apart so switching modes never
  // loses your place in the other one (see the deployment-support plan's
  // "keep the layers apart" rule; this is also why it's two states here,
  // not one `selectedViewId` the mode toggle reinterprets).
  const [viewMode, setViewMode] = useState<'logical' | 'deployment'>('logical')
  const [selectedLogicalViewId, setSelectedLogicalViewId] = useState<string | null>(null)
  const [selectedDeploymentViewId, setSelectedDeploymentViewId] = useState<string | null>(null)
  const logicalViews = result.views.filter(v => !v.isDeployment)
  const deploymentViews = result.views.filter(v => v.isDeployment)
  // Validate against `views` (every declared view), not `diagrams` (only
  // the ones that successfully laid out) - a brand-new dynamic view has no
  // steps yet, and LikeC4's sequence layouter throws on an empty dynamic
  // view ("actors array must not be empty"), so it's silently missing from
  // `diagrams` until it has at least one step. Falling back to `diagrams`
  // here would make such a view permanently unselectable - the exact
  // chicken-and-egg trap "+ Step" exists to get out of.
  const activeViewId =
    viewMode === 'deployment'
      ? ((selectedDeploymentViewId && deploymentViews.some(v => v.id === selectedDeploymentViewId)
          ? selectedDeploymentViewId
          : deploymentViews[0]?.id) ?? null)
      : ((selectedLogicalViewId && logicalViews.some(v => v.id === selectedLogicalViewId)
          ? selectedLogicalViewId
          : logicalViews[0]?.id) ?? null)
  const setActiveViewId = viewMode === 'deployment' ? setSelectedDeploymentViewId : setSelectedLogicalViewId

  // --- Disseminate: a document is a `disseminate/*.c4doc.json` file (see
  // likec4/disseminate.ts) - a Gabari-invented, project-portable artifact,
  // not LikeC4 source. Derived fresh from `files` on every render, same as
  // every other `result`-derived list in this component. ---
  const disseminateDocuments = listDisseminateDocuments(files)
  const disseminateDoc = disseminateDocuments.find(d => d.id === disseminateActiveDocId) ?? null
  const disseminateSection = disseminateDoc?.sections.find(s => s.id === disseminateActiveSectionId) ?? null
  const disseminateDiagramsById = new Map(result.diagrams.map(d => [d.id, d]))

  const handleSelectDisseminateDocument = (id: string | null) => {
    setDisseminateActiveDocId(id)
    setDisseminateActiveSectionId(null)
    setDisseminateLayoutOverride(null)
  }
  const handleCreateDisseminateDocument = (title: string) => {
    const id = newDocumentId(title, new Set(disseminateDocuments.map(d => d.id)))
    setFiles(prev => writeDisseminateDocument(prev, { id, title, sections: [] }))
    handleSelectDisseminateDocument(id)
  }
  const handleDeleteDisseminateDocument = (id: string) => {
    setFiles(prev => deleteDisseminateDocument(prev, id))
    if (disseminateActiveDocId === id) handleSelectDisseminateDocument(null)
  }
  const handleUpdateDisseminateDocument = (doc: DisseminateDocument) => {
    setFiles(prev => writeDisseminateDocument(prev, doc))
  }
  const handleSelectDisseminateSection = (id: string | null) => {
    setDisseminateActiveSectionId(id)
    setDisseminateLayoutOverride(null)
  }

  // A sandboxed preview of the active section's view with a temporary
  // `autoLayout` override applied - built by re-parsing a disposable
  // clone of `files` (same technique `parseSingleSource`/`importElements`
  // use for isolated, throwaway parses), never touching the real project.
  // Debounced so dragging the rankSep/nodeSep inputs doesn't re-parse on
  // every keystroke.
  useEffect(() => {
    if (!disseminateLayoutOverride || disseminateSection?.type !== 'view' || !disseminateSection.viewId) {
      setDisseminateSandbox(null)
      return
    }
    const viewId = disseminateSection.viewId
    const override = disseminateLayoutOverride
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const scratch = await setViewAutoLayout(files, viewId, override)
          const parsed = await parseFiles(scratch)
          if (!cancelled) setDisseminateSandbox(parsed)
        } catch {
          if (!cancelled) setDisseminateSandbox(null)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disseminateLayoutOverride, disseminateSection?.type, disseminateSection?.viewId, files])

  const handleApplyDisseminateLayout = () => {
    if (disseminateSection?.type !== 'view' || !disseminateSection.viewId) return
    const viewId = disseminateSection.viewId
    void runMutation(() => setViewAutoLayout(files, viewId, disseminateLayoutOverride)).then(() => {
      setDisseminateLayoutOverride(null)
    })
  }

  /** Shared by both Disseminate exports below - captures each view
   * section's image and looks up its related decisions exactly once
   * (the expensive part), regardless of which format is chosen.
   * `slideText` rides along unread by `buildDocumentHtml`, used only by
   * `buildSlidesHtml`. */
  const buildDisseminateExportSections = async (doc: DisseminateDocument): Promise<ExportedSection[]> => {
    const sections: ExportedSection[] = []
    for (const section of doc.sections) {
      if (section.type === 'text') {
        sections.push({ id: section.id, type: 'text', text: section.text ?? '', slideText: section.slideText })
        continue
      }
      const view = section.viewId ? disseminateDiagramsById.get(section.viewId as never) : undefined
      const image = await captureSection(section.id, 'png', 2)
      const related = section.viewId
        ? relatedDecisionRecords(section.viewId, view?.nodes.map(n => n.modelRef) ?? [], result.elements, result.views, decisionRecords)
        : []
      sections.push({
        id: section.id,
        type: 'view',
        title: view?.title ?? section.viewId,
        caption: section.caption,
        image: image ?? undefined,
        relatedDecisions: related.map(d => ({ id: d.id, title: d.title, kind: d.kind, status: d.status })),
        slideText: section.slideText,
      })
    }
    return sections
  }

  const handleExportDisseminateDocument = () => {
    if (!disseminateDoc) return
    void (async () => {
      const sections = await buildDisseminateExportSections(disseminateDoc)
      const html = buildDocumentHtml(disseminateDoc.title, sections)
      downloadHtml(html, `${disseminateDoc.id}.html`)
    })()
  }

  /** Experimental - see DisseminateNotebook.tsx's toolbar. Same shared
   * sections as the document export above; only the template differs. */
  const handleExportDisseminateSlides = () => {
    if (!disseminateDoc) return
    void (async () => {
      const sections = await buildDisseminateExportSections(disseminateDoc)
      const html = buildSlidesHtml(disseminateDoc.title, sections)
      downloadHtml(html, `${disseminateDoc.id}-slides.html`)
    })()
  }

  // --- Decisions: ADRs, requirements, governance changes, and
  // compliance items (see likec4/decisions.ts), each a
  // `decisions/*.md` file - a Gabari-invented, project-portable
  // artifact, not LikeC4 source (same treatment as Disseminate
  // documents above). Annotated onto elements/views/relationships via
  // LikeC4's own native `link` mechanism, not a bespoke side-table -
  // see mutate.ts's `addLink`/`removeLink`. ---
  const decisionRecords = listDecisions(files)
  const decisionRecord = decisionRecords.find(d => d.path === decisionActiveId) ?? null

  const handleSelectDecision = (path: string | null) => setDecisionActiveId(path)
  const handleCreateDecision = (kind: DecisionKind, title: string) => {
    const id = newDecisionId(kind, decisionRecords)
    const path = newDecisionPath(id, title)
    setFiles(prev =>
      writeDecision(prev, { path, id, kind, title, status: 'proposed', body: DECISION_KIND_INFO[kind].template }),
    )
    handleSelectDecision(path)
  }
  const handleDeleteDecision = (path: string) => {
    setFiles(prev => deleteDecision(prev, path))
    if (decisionActiveId === path) handleSelectDecision(null)
  }
  const handleUpdateDecision = (record: DecisionRecord) => {
    setFiles(prev => writeDecision(prev, record))
  }
  const handleAddDecisionLink = (target: LinkTarget) => {
    if (!decisionRecord) return
    const record = decisionRecord
    void runMutation(() => addLink(files, target, { path: record.path, title: `${record.id}: ${record.title}` }))
  }
  const handleRemoveDecisionLink = (target: LinkTarget) => {
    if (!decisionRecord) return
    void runMutation(() => removeLink(files, target, decisionRecord.path))
  }

  const [contextMenu, setContextMenu] = useState<{ kind: 'node' | 'edge'; id: string; x: number; y: number } | null>(
    null,
  )
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)
  const [manualLayouts, setManualLayouts] = useState<ManualLayouts>(() => loadManualLayouts())
  const [specPresets, setSpecPresets] = useState<SpecPreset[]>(() => loadSpecPresets())
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    return saved >= 200 && saved <= 480 ? saved : 280
  })
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  // Apply the theme choice to the document root - an explicit light/dark
  // stamps `data-theme` so it wins over the OS setting either way (see the
  // CSS's `[data-theme]` blocks); "system" removes the attribute entirely
  // and leaves it to `prefers-color-scheme`.
  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme
    } else {
      document.documentElement.dataset.theme = theme
    }
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore (private browsing, quota, etc.)
    }
  }, [theme])

  // Debounced re-parse whenever any file changes.
  useEffect(() => {
    let cancelled = false
    setParsing(true)
    const t = setTimeout(async () => {
      const r = await parseFiles(files)
      if (!cancelled) {
        setResult(r)
        setParsing(false)
        setRevision(v => v + 1)
      }
    }, 350)
    try {
      localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files))
    } catch {
      // ignore (private browsing, quota, etc.)
    }
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [files])

  const showError = useCallback((err: unknown) => {
    setToast(err instanceof Error ? err.message : String(err))
    setTimeout(() => setToast(null), 5000)
  }, [])

  const runMutation = useCallback(
    async (fn: () => Promise<Files>) => {
      setBusy(true)
      try {
        const next = await fn()
        setFiles(next)
      } catch (err) {
        showError(err)
      } finally {
        setBusy(false)
      }
    },
    [showError],
  )

  /** Same shape as `runMutation`, but for a repo connect/fetch/push action
   * instead of a text mutation - errors surface through the same
   * showError/toast machinery, no new error UI needed. */
  const runRepoAction = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true)
      try {
        await fn()
      } catch (err) {
        showError(err)
      } finally {
        setBusy(false)
      }
    },
    [showError],
  )

  /** Connecting always *replaces* the current project's files wholesale -
   * `ConnectRepoDialog`'s own "confirm" step already warned about that
   * before this ever runs. Unlike `runMutation`, this keeps the dialog
   * open (never `setDialog(null)` up front) and catches its own error
   * before re-throwing, so `ConnectRepoDialog` can show it inline and let
   * the user fix a typo'd token/repo without retyping the whole form -
   * `runRepoAction`'s own catch still runs too (same toast as ever). */
  const handleConnectGitHub = (values: ConnectGitHubValues) => {
    setConnectError(null)
    void runRepoAction(async () => {
      try {
        // An explicit branch wins; otherwise ask the host which one is
        // actually the default instead of asking the user to know or
        // guess it - a repo defaulting to "master" (or anything else)
        // typed as "main" would otherwise connect to the wrong branch
        // silently.
        const branch =
          values.branch ||
          (await getGitHubDefaultBranch({ owner: values.owner, repo: values.repo, token: values.token, serverUrl: values.server }))
        const ref: GitHubRepoRef = { owner: values.owner, repo: values.repo, branch, token: values.token, serverUrl: values.server }
        const project = await fetchGitHubProject(ref, values.folder)
        setFiles(project)
        setActiveFile(Object.keys(project)[0] ?? DEFAULT_FILE)
        setConnectedRepo({ provider: 'github', ref, folder: values.folder, baseFiles: project })
        setDialog(null)
        setToast(`Signed in to GitHub — ${values.owner}/${values.repo} (${branch})`)
        setTimeout(() => setToast(null), 4000)
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : String(err))
        throw err
      }
    })
  }

  /** Stashes the connect details and redirects to gitlab.com to log in -
   * see `git/gitlabAuth.ts`. The actual connect (fetching the project)
   * happens after the redirect back, in the mount effect below. This leg
   * rarely fails (no network call before the redirect itself), but is
   * still wrapped the same way as GitHub for consistency - a failure here
   * sends the dialog back to the GitLab form with the error shown, same
   * as GitHub. */
  const handleLoginGitLab = (values: LoginGitLabValues) => {
    setConnectError(null)
    void runRepoAction(async () => {
      try {
        await beginGitLabLogin(values.clientId, gitlabRedirectUri(), {
          project: values.project,
          branch: values.branch,
          folder: values.folder,
          serverUrl: values.server,
        })
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : String(err))
        throw err
      }
    })
  }

  // Complete a GitLab OAuth login on mount, if the URL is a callback from
  // one this tab began (see gitlabAuth.completeLogin). Runs once; strips
  // the callback's query string afterward either way, so a reload doesn't
  // try to re-complete it.
  useEffect(() => {
    void (async () => {
      let result: Awaited<ReturnType<typeof completeGitLabLogin>>
      try {
        result = await completeGitLabLogin()
      } catch (err) {
        showError(err)
        return
      } finally {
        if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
      }
      if (!result) return
      setToast('Signing in to GitLab…')
      await runRepoAction(async () => {
        // Same blank-branch -> ask-the-host resolution as GitHub's connect.
        const branch =
          result.branch ||
          (await getGitLabDefaultBranch({ projectPath: result.project, token: result.token, serverUrl: result.serverUrl }))
        const ref: GitLabRepoRef = { projectPath: result.project, branch, token: result.token, serverUrl: result.serverUrl }
        const project = await fetchGitLabProject(ref, result.folder)
        setFiles(project)
        setActiveFile(Object.keys(project)[0] ?? DEFAULT_FILE)
        setConnectedRepo({ provider: 'gitlab', ref, folder: result.folder, baseFiles: project })
        setToast(`Signed in to GitLab — ${result.project} (${branch})`)
        setTimeout(() => setToast(null), 4000)
      })
    })()
    // Intentionally runs once on mount only - it's checking the initial
    // URL for an OAuth callback, not reacting to any state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDisconnectRepo = () => {
    // Clears the connection (and the in-memory token with it) - local
    // `files` are left exactly as they are, as an ordinary local-only
    // project no longer tracked against any repo.
    setConnectedRepo(null)
  }

  const pendingPush = connectedRepo ? diffFiles(connectedRepo.baseFiles, files) : null

  /** Refetch the connected repo/branch/folder with the token already held
   * in memory - a real, one-click alternative to what today only exists
   * as "disconnect, then reconnect from scratch" (retype the PAT, or redo
   * the whole GitLab OAuth redirect). Warns first if it would blow away
   * local changes not yet pushed - reuses the same `confirmState`/
   * `ConfirmDialog` `handleDeleteElement` already uses, since this is a
   * one-off action with no form state worth preserving across a confirm
   * step (unlike the connect wizard). */
  const handlePullLatest = () => {
    if (!connectedRepo) return
    const label = connectedRepoLabel(connectedRepo)
    const doPull = () =>
      void runRepoAction(async () => {
        const project =
          connectedRepo.provider === 'github'
            ? await fetchGitHubProject(connectedRepo.ref, connectedRepo.folder)
            : await fetchGitLabProject(connectedRepo.ref, connectedRepo.folder)
        setFiles(project)
        // Unlike a fresh connect, keep the currently-open file selected
        // when it still exists after the pull - this is a sync, not a
        // brand-new load.
        setActiveFile(prev => (prev in project ? prev : (Object.keys(project)[0] ?? DEFAULT_FILE)))
        setConnectedRepo({ ...connectedRepo, baseFiles: project })
        setToast(`Pulled latest from ${connectedRepoProviderName(connectedRepo)} — ${label} (${connectedRepo.ref.branch})`)
        setTimeout(() => setToast(null), 4000)
      })
    if (pendingPush && fileDiffCount(pendingPush) > 0) {
      setConfirmState({
        title: 'Pull latest',
        message: `Pulling latest will overwrite your local changes with "${label}"'s contents. Anything not pushed will be lost.`,
        confirmLabel: 'Pull latest',
        onConfirm: doPull,
      })
    } else {
      doPull()
    }
  }

  /** Same retry-friendly shape as `handleConnectGitHub` - never closes the
   * dialog up front, so a failed commit (e.g. the branch moved - see
   * `github.ts`'s conflict check) leaves `PushDialog` open with the
   * commit message intact and the error shown inline, ready to retry. */
  const handlePushToRepo = (message: string) => {
    if (!connectedRepo || !pendingPush) return
    setPushError(null)
    void runRepoAction(async () => {
      try {
        if (connectedRepo.provider === 'github') {
          await commitGitHubChanges(connectedRepo.ref, connectedRepo.folder, pendingPush, message)
        } else {
          await commitGitLabChanges(connectedRepo.ref, connectedRepo.folder, pendingPush, message)
        }
        setConnectedRepo({ ...connectedRepo, baseFiles: files })
        setDialog(null)
        setToast(`Pushed to ${connectedRepoProviderName(connectedRepo)} — ${connectedRepoLabel(connectedRepo)} (${connectedRepo.ref.branch})`)
        setTimeout(() => setToast(null), 4000)
      } catch (err) {
        setPushError(err instanceof Error ? err.message : String(err))
        throw err
      }
    })
  }

  const handleAddElement = (values: AddElementValues) => {
    setDialog(null)
    void runMutation(() => addElement(files, values, activeFile))
  }

  const handleAddRelation = (values: AddRelationValues) => {
    setDialog(null)
    void runMutation(() => addRelation(files, values, activeFile))
  }

  const handleDeleteElement = (fqn: string) => {
    setConfirmState({
      title: 'Delete element',
      message: `Delete "${fqn}" and any relationships to/from it?`,
      confirmLabel: 'Delete',
      onConfirm: () => void runMutation(() => deleteElement(files, fqn)),
    })
  }

  const handleDeleteRelation = (id: string) => {
    void runMutation(() => deleteRelation(files, id))
  }

  const handleNestInto = (parentFqn: string) => {
    setPendingElementPreset({ parentFqn })
    setDialog('element')
  }

  const handleMoveElement = (fqn: string, newParentFqn: string | null) => {
    void runMutation(() => moveElement(files, fqn, newParentFqn))
  }

  const handleEditElement = (fqn: string) => {
    setEditingElementFqn(fqn)
    setDialog('editElement')
  }

  const handleSaveElement = (changes: { title: string; description: string; style: Parameters<typeof updateElementStyle>[2] }) => {
    setDialog(null)
    if (!editingElementFqn) return
    void runMutation(async () => {
      const next = await updateElement(files, editingElementFqn, changes)
      return updateElementStyle(next, editingElementFqn, changes.style)
    })
  }

  const handleEditRelation = (id: string) => {
    setEditingRelationId(id)
    setDialog('editRelation')
  }

  const handleSaveRelation = (changes: { title: string; style: Parameters<typeof updateRelationStyle>[2] }) => {
    setDialog(null)
    if (!editingRelationId) return
    void runMutation(async () => {
      const next = await updateRelation(files, editingRelationId, changes)
      return updateRelationStyle(next, editingRelationId, changes.style)
    })
  }

  const handleAddView = (values: AddViewValues) => {
    setDialog(null)
    void runMutation(() => addView(files, values, activeFile)).then(() => setSelectedLogicalViewId(values.id))
  }

  const handleAddDeploymentView = (values: { id: string; title: string }) => {
    setDialog(null)
    void runMutation(() => addDeploymentView(files, values, activeFile)).then(() => setSelectedDeploymentViewId(values.id))
  }

  /** LikeC4's own "drill down" node click - lands on the target view *and*
   * flips the mode toggle to match its kind, so navigating in from either
   * side always shows the right tab strip. */
  const handleNavigateToView = (id: string) => {
    const view = result.views.find(v => v.id === id)
    if (!view) return
    if (view.isDeployment) {
      setViewMode('deployment')
      setSelectedDeploymentViewId(id)
    } else {
      setViewMode('logical')
      setSelectedLogicalViewId(id)
    }
  }

  const handleDeleteView = (id: string) => {
    void runMutation(() => deleteView(files, id))
  }

  const handleEditView = (id: string) => {
    setEditingViewId(id)
    setDialog('editView')
  }

  const handleSaveView = (changes: { title: string; viewOf: string | null; order: number | null }) => {
    setDialog(null)
    if (!editingViewId) return
    void runMutation(() => updateView(files, editingViewId, changes))
  }

  const handleAddStep = (values: AddStepValues) => {
    setDialog(null)
    if (!activeViewId) return
    void runMutation(() => addStep(files, activeViewId, values))
  }

  /** "Elements in view…" checkbox toggle - the dialog stays open across
   * several toggles in a row (unlike every other mutation's dialog, which
   * closes on submit), since it's a live checklist, not a form. */
  const handleToggleViewElement = (fqn: string, included: boolean) => {
    if (!activeViewId) return
    void runMutation(() => setViewElementIncluded(files, activeViewId, fqn, included))
  }

  // --- Deployment tree - kept as its own set of handlers, deliberately
  // parallel to (never merged with) the element/relationship ones above. ---
  const handleAddDeploymentNode = (parentFqn: string | null) => {
    setPendingDeploymentNodeParent(parentFqn)
    setDialog('addDeploymentNode')
  }

  const handleSubmitDeploymentNode = (values: AddDeploymentNodeValues) => {
    setDialog(null)
    void runMutation(() => addDeploymentNode(files, values, values.parentFqn, activeFile))
  }

  const handleAddDeployedInstance = (parentNodeFqn: string) => {
    setPendingInstanceParent(parentNodeFqn)
    setDialog('addDeployedInstance')
  }

  const handleSubmitDeployedInstance = (values: AddDeployedInstanceValues) => {
    setDialog(null)
    if (!pendingInstanceParent) return
    void runMutation(() => addDeployedInstance(files, values, pendingInstanceParent, activeFile))
  }

  const handleSubmitDeploymentRelation = (values: AddDeploymentRelationValues) => {
    setDialog(null)
    void runMutation(() => addDeploymentRelation(files, values, activeFile))
  }

  const handleEditDeploymentNode = (fqn: string) => {
    setEditingDeploymentNodeFqn(fqn)
    setDialog('editDeploymentNode')
  }

  const handleSaveDeploymentNode = (changes: { title: string }) => {
    setDialog(null)
    if (!editingDeploymentNodeFqn) return
    void runMutation(() => updateDeploymentNode(files, editingDeploymentNodeFqn, changes))
  }

  const handleEditDeployedInstance = (fqn: string) => {
    setEditingDeployedInstanceFqn(fqn)
    setDialog('editDeployedInstance')
  }

  const handleSaveDeployedInstance = (changes: { title: string }) => {
    setDialog(null)
    if (!editingDeployedInstanceFqn) return
    void runMutation(() => updateDeployedInstance(files, editingDeployedInstanceFqn, changes))
  }

  const handleDeleteDeploymentNode = (fqn: string) => {
    setConfirmState({
      title: 'Delete deployment node',
      message: `Delete "${fqn}" and everything nested inside it (other nodes, deployed instances)?`,
      confirmLabel: 'Delete',
      onConfirm: () => void runMutation(() => deleteDeploymentNode(files, fqn)),
    })
  }

  const handleDeleteDeployedInstance = (fqn: string) => {
    void runMutation(() => deleteDeployedInstance(files, fqn))
  }

  const handleDeleteDeploymentRelation = (id: string) => {
    void runMutation(() => deleteDeploymentRelation(files, id))
  }

  const handleSaveManualLayout = (viewId: string, layout: LayoutedView) => {
    setManualLayouts(prev => {
      const next = { ...prev, [viewId]: layout }
      saveManualLayouts(next)
      return next
    })
  }

  const handleResetManualLayout = (viewId: string) => {
    setManualLayouts(prev => {
      if (!(viewId in prev)) return prev
      const next = { ...prev }
      delete next[viewId]
      saveManualLayouts(next)
      return next
    })
  }

  const handleNew = () => {
    setConfirmState({
      title: 'Start new diagram',
      message: 'Discard the current diagram and start a new one? This cannot be undone.',
      confirmLabel: 'Discard',
      onConfirm: () => {
        setFiles(STARTER_FILES)
        setActiveFile(DEFAULT_FILE)
      },
    })
  }

  // Import/Export/Copy act on the active file only - a single file is what
  // a human would drag in, save out, or copy at a time. Bulk import of a
  // whole local folder is handled separately below by handleImportFolder;
  // bulk export is deferred to pushing to a connected repo (see the
  // GitHub/GitLab work), rather than adding a zip dependency here.
  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setFiles(prev => ({ ...prev, [activeFile]: text }))
    }
    reader.readAsText(file)
  }

  const handleExport = () => {
    const blob = new Blob([files[activeFile] ?? ''], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeFile || DEFAULT_FILE
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(files[activeFile] ?? '')
      setToast('Copied DSL to clipboard')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      showError(err)
    }
  }

  /** Bulk-import every `.c4`/`.likec4` file (and any `likec4.config.json`)
   * found in a locally-picked folder, replacing the current project - the
   * common top-level folder name (if every picked file shares one, which
   * `webkitdirectory` always produces) is stripped so keys read as plain
   * paths relative to the folder itself. */
  const handleImportFolder = (fileList: FileList) => {
    const relevant = Array.from(fileList).filter(f => isProjectFile(f.name))
    if (!relevant.length) {
      showError(new Error('No .c4 files found in that folder'))
      return
    }
    Promise.all(
      relevant.map(
        f =>
          new Promise<[string, string]>((resolve, reject) => {
            const reader = new FileReader()
            const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
            reader.onload = () => resolve([path, String(reader.result ?? '')])
            reader.onerror = () => reject(reader.error)
            reader.readAsText(f)
          }),
      ),
    )
      .then(entries => {
        const paths = entries.map(([p]) => p)
        const firstSegment = paths[0]?.split('/')[0]
        const stripPrefix = !!firstSegment && paths.every(p => p.startsWith(firstSegment + '/'))
        const next: Files = {}
        for (const [path, text] of entries) {
          next[stripPrefix ? path.slice(firstSegment!.length + 1) : path] = text
        }
        setFiles(next)
        setActiveFile(Object.keys(next)[0] ?? DEFAULT_FILE)
        // A folder-import is conceptually a project-import - name it in the
        // toast when the folder brought its own `likec4.config.json`.
        const importedProjectName = readProjectConfig(next)?.name
        setToast(
          importedProjectName
            ? `Imported project "${importedProjectName}"`
            : `Imported ${entries.length} file${entries.length === 1 ? '' : 's'}`,
        )
        setTimeout(() => setToast(null), 3000)
      })
      .catch(showError)
  }

  const handleAddFile = () => {
    let name = 'untitled.c4'
    let n = 1
    while (name in files) {
      n++
      name = `untitled-${n}.c4`
    }
    setFiles(prev => ({ ...prev, [name]: '' }))
    setActiveFile(name)
  }

  const handleChangeFileText = (file: string, text: string) => {
    setFiles(prev => ({ ...prev, [file]: text }))
  }

  const handleSaveProjectConfig = (config: ProjectConfig) => {
    setDialog(null)
    setFiles(prev => writeProjectConfig(prev, config))
  }

  const handleRenameFile = (oldName: string, newName: string) => {
    if (newName === oldName || !newName.trim()) return
    if (newName in files) {
      showError(new Error(`A file named "${newName}" already exists`))
      return
    }
    // Elements are addressed by fqn, not file path, so a rename is a pure
    // key-rename - nothing else in the project's text needs rewriting.
    setFiles(prev => {
      const next: Files = {}
      for (const [key, text] of Object.entries(prev)) {
        next[key === oldName ? newName : key] = text
      }
      return next
    })
    if (activeFile === oldName) setActiveFile(newName)
  }

  const handleDeleteFile = (file: string) => {
    if (Object.keys(files).length <= 1) return
    setConfirmState({
      title: 'Delete file',
      message: `Delete "${file}"? Anything elsewhere that referenced content declared only in it will show up as an error you can fix by hand (nothing is auto-repaired for a whole-file delete).`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        const remaining = Object.keys(files).filter(f => f !== file)
        setFiles(prev => {
          if (Object.keys(prev).length <= 1) return prev
          const next = { ...prev }
          delete next[file]
          return next
        })
        if (activeFile === file) setActiveFile(remaining[0] ?? DEFAULT_FILE)
      },
    })
  }

  // --- Library drag-and-drop: dropping a kind onto the canvas opens the
  // Add Element dialog pre-filled with that kind - and, if dropped onto an
  // existing rendered box, pre-filled to nest inside it. ---
  const handleDropKind = (kind: string, parentFqn: string | null) => {
    setPendingElementPreset({ kind, parentFqn })
    setDialog('element')
  }


  // --- Connect mode: click a source element (sidebar "⇥" button, or a
  // node while a source is already pending), then a target (sidebar row or
  // another node) - opens Add Relationship pre-filled with both. ---
  const startConnect = (fqn: string) => {
    setConnectPendingSource(fqn)
    setToast(`Connecting from "${fqn}" — click another element to finish, or press Escape to cancel.`)
  }

  const pickConnectTarget = (fqn: string) => {
    if (!connectPendingSource || fqn === connectPendingSource) return
    if (viewMode === 'deployment') {
      setPendingDeploymentRelationPreset({ source: connectPendingSource, target: fqn })
      setConnectPendingSource(null)
      setToast(null)
      setDialog('addDeploymentRelation')
      return
    }
    setPendingRelationPreset({ source: connectPendingSource, target: fqn })
    setConnectPendingSource(null)
    setToast(null)
    setDialog('relation')
  }

  useEffect(() => {
    if (!connectPendingSource) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectPendingSource(null)
        setToast(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [connectPendingSource])

  const handleNodeClick = (id: string) => {
    if (connectPendingSource) {
      pickConnectTarget(id)
    } else {
      startConnect(id)
    }
  }

  const handleNodeContextMenu = (id: string, x: number, y: number) => {
    setContextMenu({ kind: 'node', id, x, y })
  }

  const handleEdgeContextMenu = (id: string, x: number, y: number) => {
    setContextMenu({ kind: 'edge', id, x, y })
  }

  const contextMenuItems: ContextMenuEntry[] = (() => {
    if (!contextMenu) return []
    if (contextMenu.kind === 'node') {
      const id = contextMenu.id
      // The deployment canvas renders deployment-tree nodes (deployed
      // instances and plain deployment nodes), never elements directly -
      // right-clicking one and calling the element handlers (as this
      // used to do unconditionally) edited/deleted the wrong thing.
      // Contextualize to what's actually under the cursor: a deployed
      // instance is presented as exactly that - an instance *of* a
      // logical element, not the element itself.
      if (viewMode === 'deployment') {
        const instance = result.deploymentInstances.find(i => i.id === id)
        if (instance) {
          return [
            { label: `Edit instance of "${instance.elementFqn}"…`, onSelect: () => handleEditDeployedInstance(id) },
            { label: 'Connect from here', onSelect: () => startConnect(id) },
            'separator',
            { label: 'Delete instance', danger: true, onSelect: () => handleDeleteDeployedInstance(id) },
          ]
        }
        const node = result.deploymentNodes.find(n => n.id === id)
        if (!node) return []
        return [
          { label: 'Edit…', onSelect: () => handleEditDeploymentNode(id) },
          { label: 'Connect from here', onSelect: () => startConnect(id) },
          { label: 'Add nested node…', onSelect: () => handleAddDeploymentNode(id) },
          { label: 'Add instance here…', onSelect: () => handleAddDeployedInstance(id) },
          'separator',
          { label: 'Delete', danger: true, onSelect: () => handleDeleteDeploymentNode(id) },
        ]
      }
      const fqn = id
      return [
        { label: 'Edit…', onSelect: () => handleEditElement(fqn) },
        { label: 'Connect from here', onSelect: () => startConnect(fqn) },
        { label: 'Add nested element…', onSelect: () => handleNestInto(fqn) },
        'separator',
        { label: 'Delete', danger: true, onSelect: () => handleDeleteElement(fqn) },
      ]
    }
    const id = contextMenu.id
    // Deployment relations have no label to edit (see mutate.ts - there's
    // no updateDeploymentRelation, matching Deployment.tsx's own sidebar
    // list, which only ever offers delete for these) - just delete, and
    // the right kind of it.
    if (viewMode === 'deployment') {
      return [{ label: 'Delete', danger: true, onSelect: () => handleDeleteDeploymentRelation(id) }]
    }
    return [
      { label: 'Edit label…', onSelect: () => handleEditRelation(id) },
      { label: 'Delete', danger: true, onSelect: () => handleDeleteRelation(id) },
    ]
  })()

  // --- Specification editor handlers ---
  const specHandlers = {
    onAddElementKind: (input: { name: string; color: string | null; shape: string | null }) =>
      void runMutation(() => addElementKind(files, input, activeFile)),
    onUpdateElementKind: (name: string, changes: { color?: string | null; shape?: string | null }) =>
      void runMutation(() => updateElementKind(files, name, changes)),
    onDeleteElementKind: (name: string) => void runMutation(() => deleteElementKind(files, name)),
    onAddRelationshipKind: (input: { name: string; color: string | null; line: string | null }) =>
      void runMutation(() => addRelationshipKind(files, input, activeFile)),
    onUpdateRelationshipKind: (name: string, changes: { color?: string | null; line?: string | null }) =>
      void runMutation(() => updateRelationshipKind(files, name, changes)),
    onDeleteRelationshipKind: (name: string) => void runMutation(() => deleteRelationshipKind(files, name)),
    onAddTag: (input: { name: string; color: string | null }) => void runMutation(() => addTag(files, input, activeFile)),
    onUpdateTag: (name: string, changes: { color?: string | null }) =>
      void runMutation(() => updateTag(files, name, changes)),
    onDeleteTag: (name: string) => void runMutation(() => deleteTag(files, name)),
    onAddDeploymentNodeKind: (input: { name: string; color: string | null; shape: string | null }) =>
      void runMutation(() => addDeploymentNodeKind(files, input, activeFile)),
    onUpdateDeploymentNodeKind: (name: string, changes: { color?: string | null; shape?: string | null }) =>
      void runMutation(() => updateDeploymentNodeKind(files, name, changes)),
    onDeleteDeploymentNodeKind: (name: string) => void runMutation(() => deleteDeploymentNodeKind(files, name)),
  }

  // --- Spec presets: named, reusable bundles of specification entries,
  // saved locally (not part of the DSL - see specPresets.ts) ---
  const handleSaveSpecPreset = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSpecPresets(prev => {
      const next = [
        ...prev.filter(p => p.name !== trimmed),
        {
          name: trimmed,
          elementKinds: result.elementKindSpecs,
          relationshipKinds: result.relationshipKindSpecs,
          tags: result.tagSpecs,
        },
      ]
      saveSpecPresets(next)
      return next
    })
    setToast(`Saved spec preset "${trimmed}"`)
    setTimeout(() => setToast(null), 2500)
  }

  const handleDeleteSpecPreset = (name: string) => {
    setSpecPresets(prev => {
      const next = prev.filter(p => p.name !== name)
      saveSpecPresets(next)
      return next
    })
  }

  /** Shared tail for both preset-import paths below: apply the merge
   * result (or surface why it failed) and report added/skipped counts. */
  const applySpecMergeResult = (
    label: string,
    mutation: Promise<{ files: Files; added: number; skipped: number }>,
  ) => {
    setBusy(true)
    void mutation
      .then(({ files: next, added, skipped }) => {
        setFiles(next)
        setToast(
          `Imported ${added} ${added === 1 ? 'entry' : 'entries'} from "${label}"` +
            (skipped ? `, skipped ${skipped} (already exists)` : ''),
        )
        setTimeout(() => setToast(null), 4000)
      })
      .catch(showError)
      .finally(() => setBusy(false))
  }

  const handleImportSpecPreset = (preset: SpecPreset) => {
    applySpecMergeResult(preset.name, importSpecPreset(files, preset, activeFile))
  }

  /** Drag-and-drop a `.c4` file onto the Presets drop zone: parse it (the
   * real parser, same as any other source text - it need not declare
   * `model { }`/`views { }` at all, LikeC4 is fine with a file containing
   * only `specification { }`) *in isolation* (via `parseSingleSource`,
   * unrelated to the project's own `files`) and merge just its
   * specification entries into the current diagram, same
   * skip-on-name-collision behavior as importing a saved preset. Anything
   * else in the file (a model, views) is read but ignored - only the spec
   * is used. */
  const handleImportSpecFile = (text: string, fileName: string) => {
    applySpecMergeResult(
      fileName,
      parseSingleSource(text).then(parsed => {
        if (!parsed.ok) {
          throw new Error(`"${fileName}" has parse errors: ${parsed.errors[0]?.message ?? 'invalid LikeC4 source'}`)
        }
        const preset = {
          elementKinds: parsed.elementKindSpecs,
          relationshipKinds: parsed.relationshipKindSpecs,
          tags: parsed.tagSpecs,
        }
        if (!preset.elementKinds.length && !preset.relationshipKinds.length && !preset.tags.length) {
          throw new Error(`"${fileName}" has no specification entries to import`)
        }
        return importSpecPreset(files, preset, activeFile)
      }),
    )
  }

  /** "Import Elements…" (File menu) - the replacement for the removed
   * Reusable Elements feature: parse a pasted/picked LikeC4 document *in
   * isolation* (same `parseSingleSource` as the spec-file-drop above) and
   * merge its elements into this project via `importElements` - which
   * auto-declares any kind they depend on that isn't already in this
   * project's specification, and files everything into
   * `IMPORTED_ELEMENTS_FILE` rather than the active file. Switches to
   * that file afterward so the result is immediately visible. */
  const handleImportElements = (text: string) => {
    setDialog(null)
    setBusy(true)
    void parseSingleSource(text)
      .then(parsed => {
        if (!parsed.ok) {
          throw new Error(`Parse error: ${parsed.errors[0]?.message ?? 'invalid LikeC4 source'}`)
        }
        if (!parsed.elements.length) {
          throw new Error('No elements found to import')
        }
        return importElements(
          files,
          { elements: parsed.elements, elementKinds: parsed.elementKindSpecs },
          new Set(result.elements.map(e => e.id)),
        )
      })
      .then(({ files: next, added, kindsAdded, file }) => {
        setFiles(next)
        setActiveFile(file)
        setToast(
          `Imported ${added} element${added === 1 ? '' : 's'} into "${file}"` +
            (kindsAdded ? ` (${kindsAdded} new element kind${kindsAdded === 1 ? '' : 's'} added)` : ''),
        )
        setTimeout(() => setToast(null), 4000)
      })
      .catch(showError)
      .finally(() => setBusy(false))
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="logo-badge">
            <LogoMark />
          </span>
          <h1>Gabari</h1>
          <span className="app-tagline">draft your architecture</span>
        </div>
        <div className="app-header-actions">
          <FileMenu
            onNew={handleNew}
            onImportFile={() => fileInputRef.current?.click()}
            onOpenProject={() => folderInputRef.current?.click()}
            onImportElements={() => setDialog('importElements')}
            onCopyDsl={handleCopy}
            onExport={handleExport}
            connectedRepo={connectedRepo}
            pendingPush={pendingPush}
            busy={busy}
            onConnectRepo={() => {
              setConnectError(null)
              setDialog('connectRepo')
            }}
            onPullLatest={handlePullLatest}
            onPush={() => {
              setPushError(null)
              setDialog('push')
            }}
            onDisconnectRepo={handleDisconnectRepo}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".c4,.txt,text/plain"
            hidden
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
              e.target.value = ''
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            hidden
            {...({ webkitdirectory: 'true', directory: 'true' } as unknown as Record<string, string>)}
            onChange={e => {
              const fileList = e.target.files
              if (fileList && fileList.length) handleImportFolder(fileList)
              e.target.value = ''
            }}
          />
          <span className="header-divider" aria-hidden="true" />
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          width={sidebarWidth}
          files={files}
          activeFile={activeFile}
          onSelectFile={setActiveFile}
          onAddFile={handleAddFile}
          onRenameFile={handleRenameFile}
          onDeleteFile={handleDeleteFile}
          projectConfig={result.projectConfig}
          onEditProjectSettings={() => setDialog('projectSettings')}
          elements={result.elements}
          relationships={result.relationships}
          elementKinds={result.elementKindSpecs}
          onAddElement={() => {
            setPendingElementPreset({})
            setDialog('element')
          }}
          onAddRelation={() => {
            setPendingRelationPreset({})
            setDialog('relation')
          }}
          onDeleteElement={handleDeleteElement}
          onDeleteRelation={handleDeleteRelation}
          onEditSpec={() => setDialog('spec')}
          onNestInto={handleNestInto}
          onMoveElement={handleMoveElement}
          onEditElement={handleEditElement}
          onEditRelation={handleEditRelation}
          deploymentNodeKinds={result.deploymentNodeKinds}
          deploymentNodes={result.deploymentNodes}
          deploymentInstances={result.deploymentInstances}
          deploymentRelations={result.deploymentRelations}
          onAddDeploymentNode={handleAddDeploymentNode}
          onAddDeployedInstance={handleAddDeployedInstance}
          onAddDeploymentRelation={() => {
            setPendingDeploymentRelationPreset({})
            setDialog('addDeploymentRelation')
          }}
          onEditDeploymentNode={handleEditDeploymentNode}
          onEditDeployedInstance={handleEditDeployedInstance}
          onDeleteDeploymentNode={handleDeleteDeploymentNode}
          onDeleteDeployedInstance={handleDeleteDeployedInstance}
          onDeleteDeploymentRelation={handleDeleteDeploymentRelation}
          busy={busy || parsing}
          connectPendingSource={connectPendingSource}
          onStartConnect={startConnect}
          onPickConnectTarget={pickConnectTarget}
          panel={sidebarPanel}
          onSetPanel={setSidebarPanel}
          disseminateDocuments={disseminateDocuments}
          disseminateActiveDocId={disseminateActiveDocId}
          onSelectDisseminateDocument={handleSelectDisseminateDocument}
          onCreateDisseminateDocument={handleCreateDisseminateDocument}
          onDeleteDisseminateDocument={handleDeleteDisseminateDocument}
          decisionRecords={decisionRecords}
          decisionActiveId={decisionActiveId}
          onSelectDecision={handleSelectDecision}
          onCreateDecision={handleCreateDecision}
          onDeleteDecision={handleDeleteDecision}
        />

        <ResizeHandle
          width={sidebarWidth}
          onChange={setSidebarWidth}
          onCommit={w => {
            try {
              localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w))
            } catch {
              // ignore (private browsing, quota, etc.)
            }
          }}
        />

        <main className="main-panel">
          {sidebarPanel === 'disseminate' ? (
            <div className="diagram-panel">
              {disseminateDoc ? (
                <DisseminateNotebook
                  doc={disseminateDoc}
                  model={result.layoutedModel}
                  diagramsById={disseminateDiagramsById}
                  views={result.views}
                  elements={result.elements}
                  decisionRecords={decisionRecords}
                  onUpdateDocument={handleUpdateDisseminateDocument}
                  activeLayoutSectionId={disseminateActiveSectionId}
                  onToggleLayoutSection={handleSelectDisseminateSection}
                  layoutOverride={disseminateLayoutOverride}
                  onChangeLayoutOverride={setDisseminateLayoutOverride}
                  onApplyLayout={handleApplyDisseminateLayout}
                  sandboxModel={disseminateSandbox?.layoutedModel ?? null}
                  sandboxView={
                    (disseminateSandbox?.layoutedModel &&
                      disseminateSandbox.diagrams.find(d => d.id === disseminateSection?.viewId)) ||
                    null
                  }
                  onExport={handleExportDisseminateDocument}
                  onExportSlides={handleExportDisseminateSlides}
                  busy={busy || parsing}
                />
              ) : (
                <div className="diagram-empty">
                  <p>Pick or create a document in the sidebar.</p>
                </div>
              )}
            </div>
          ) : sidebarPanel === 'decisions' ? (
            <div className="diagram-panel">
              {decisionRecord ? (
                <DecisionEditor
                  record={decisionRecord}
                  elements={result.elements}
                  relations={result.relationships}
                  views={result.views}
                  onUpdateRecord={handleUpdateDecision}
                  onAddLink={handleAddDecisionLink}
                  onRemoveLink={handleRemoveDecisionLink}
                  busy={busy || parsing}
                />
              ) : (
                <div className="diagram-empty">
                  <p>Pick or create a decision in the sidebar.</p>
                </div>
              )}
            </div>
          ) : (
            <DiagramPanel
              model={result.layoutedModel}
              diagrams={result.diagrams}
              views={result.views}
              activeViewId={activeViewId}
              decisionRecords={relatedDecisionRecords(
                activeViewId ?? '',
                result.diagrams.find(d => d.id === activeViewId)?.nodes.map(n => n.modelRef) ?? [],
                result.elements,
                result.views,
                decisionRecords,
              )}
              onOpenDecision={path => {
                setSidebarPanel('decisions')
                handleSelectDecision(path)
              }}
              revision={revision}
              connectHint={
                connectPendingSource
                  ? `Connecting from "${connectPendingSource}" — click the target element (Esc to cancel)`
                  : null
              }
              manualLayouts={manualLayouts}
              onSaveManualLayout={handleSaveManualLayout}
              onResetManualLayout={handleResetManualLayout}
              onNodeClick={handleNodeClick}
              onNodeContextMenu={handleNodeContextMenu}
              onEdgeContextMenu={handleEdgeContextMenu}
              onDropKind={handleDropKind}
              onAddStep={() => setDialog('addStep')}
              onManageViewContents={() => setDialog('viewContents')}
              onManageDeploymentViewContents={() => setDialog('deploymentViewContents')}
              onSelectView={setActiveViewId}
              onAddView={() => setDialog('addView')}
              onAddDeploymentView={() => setDialog('addDeploymentView')}
              onEditView={handleEditView}
              onDeleteView={handleDeleteView}
              onNavigateToView={handleNavigateToView}
              viewMode={viewMode}
              onSetViewMode={setViewMode}
              colorScheme={theme === 'system' ? undefined : theme}
              busy={busy || parsing}
            />
          )}

          {result.errors.length > 0 && (
            <div className="diagnostics">
              {result.errors.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  className="diagnostic-row"
                  onClick={() => setActiveFile(e.file)}
                  title="Jump to file"
                >
                  <span className="diagnostic-line">
                    {e.file}:{e.line + 1}
                  </span>{' '}
                  {e.message}
                </button>
              ))}
            </div>
          )}

          <SourcePanel files={files} activeFile={activeFile} onChangeFileText={handleChangeFileText} parsing={parsing} />
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {dialog === 'element' && (
        <AddElementDialog
          kinds={result.kinds}
          elements={result.elements}
          presetKind={pendingElementPreset.kind}
          presetParentFqn={pendingElementPreset.parentFqn}
          onSubmit={handleAddElement}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'relation' && (
        <AddRelationDialog
          elements={result.elements}
          relationshipKinds={result.relationshipKinds}
          defaultSource={pendingRelationPreset.source}
          defaultTarget={pendingRelationPreset.target}
          onSubmit={handleAddRelation}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'editElement' &&
        editingElementFqn &&
        (() => {
          const el = result.elements.find(e => e.id === editingElementFqn)
          if (!el) return null
          return <EditElementDialog element={el} onSubmit={handleSaveElement} onClose={() => setDialog(null)} />
        })()}
      {dialog === 'editRelation' &&
        editingRelationId &&
        (() => {
          const rel = result.relationships.find(r => r.id === editingRelationId)
          if (!rel) return null
          return <EditRelationDialog relation={rel} onSubmit={handleSaveRelation} onClose={() => setDialog(null)} />
        })()}
      {dialog === 'editView' &&
        editingViewId &&
        (() => {
          const view = result.views.find(v => v.id === editingViewId)
          if (!view) return null
          return (
            <EditViewDialog view={view} elements={result.elements} onSubmit={handleSaveView} onClose={() => setDialog(null)} />
          )
        })()}
      {dialog === 'addView' && (
        <AddViewDialog
          existingIds={result.views.map(v => v.id)}
          elements={result.elements}
          onSubmit={handleAddView}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'addDeploymentView' && (
        <AddDeploymentViewDialog
          existingIds={result.views.map(v => v.id)}
          onSubmit={handleAddDeploymentView}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'projectSettings' && (
        <ProjectSettingsDialog config={result.projectConfig} onSubmit={handleSaveProjectConfig} onClose={() => setDialog(null)} />
      )}
      {dialog === 'importElements' && (
        <ImportElementsDialog onSubmit={handleImportElements} onClose={() => setDialog(null)} />
      )}
      {dialog === 'addStep' &&
        activeViewId &&
        (() => {
          const view = result.views.find(v => v.id === activeViewId)
          if (!view) return null
          return (
            <AddStepDialog
              viewTitle={view.title}
              elements={result.elements}
              onSubmit={handleAddStep}
              onClose={() => setDialog(null)}
            />
          )
        })()}
      {dialog === 'viewContents' &&
        activeViewId &&
        (() => {
          const view = result.views.find(v => v.id === activeViewId)
          if (!view) return null
          const diagram = result.diagrams.find(d => d.id === activeViewId)
          const includedIds = new Set(diagram?.nodes.map(n => n.id) ?? [])
          return (
            <ViewContentsDialog
              viewTitle={view.title || view.id}
              elements={result.elements}
              includedIds={includedIds}
              onToggle={handleToggleViewElement}
              onClose={() => setDialog(null)}
            />
          )
        })()}
      {dialog === 'deploymentViewContents' &&
        activeViewId &&
        (() => {
          const view = result.views.find(v => v.id === activeViewId)
          if (!view) return null
          const diagram = result.diagrams.find(d => d.id === activeViewId)
          const includedIds = new Set(diagram?.nodes.map(n => n.id) ?? [])
          return (
            <DeploymentContentsDialog
              viewTitle={view.title || view.id}
              nodes={result.deploymentNodes}
              instances={result.deploymentInstances}
              includedIds={includedIds}
              onToggle={handleToggleViewElement}
              onClose={() => setDialog(null)}
            />
          )
        })()}
      {dialog === 'addDeploymentNode' && (
        <AddDeploymentNodeDialog
          kinds={result.deploymentNodeKinds.map(k => k.name)}
          nodes={result.deploymentNodes}
          presetParentFqn={pendingDeploymentNodeParent}
          onSubmit={handleSubmitDeploymentNode}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'addDeployedInstance' && pendingInstanceParent && (
        <AddDeployedInstanceDialog
          parentNodeFqn={pendingInstanceParent}
          elements={result.elements}
          onSubmit={handleSubmitDeployedInstance}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'addDeploymentRelation' && (
        <AddDeploymentRelationDialog
          nodes={result.deploymentNodes}
          instances={result.deploymentInstances}
          relationshipKinds={result.relationshipKinds}
          defaultSource={pendingDeploymentRelationPreset.source}
          defaultTarget={pendingDeploymentRelationPreset.target}
          onSubmit={handleSubmitDeploymentRelation}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'editDeploymentNode' &&
        editingDeploymentNodeFqn &&
        (() => {
          const node = result.deploymentNodes.find(n => n.id === editingDeploymentNodeFqn)
          if (!node) return null
          return <EditDeploymentNodeDialog node={node} onSubmit={handleSaveDeploymentNode} onClose={() => setDialog(null)} />
        })()}
      {dialog === 'editDeployedInstance' &&
        editingDeployedInstanceFqn &&
        (() => {
          const instance = result.deploymentInstances.find(i => i.id === editingDeployedInstanceFqn)
          if (!instance) return null
          return (
            <EditDeployedInstanceDialog instance={instance} onSubmit={handleSaveDeployedInstance} onClose={() => setDialog(null)} />
          )
        })()}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      {dialog === 'spec' && (
        <SpecificationEditor
          elementKinds={result.elementKindSpecs}
          relationshipKinds={result.relationshipKindSpecs}
          tags={result.tagSpecs}
          deploymentNodeKinds={result.deploymentNodeKinds}
          builtinPresets={BUILTIN_SPEC_PRESETS}
          presets={specPresets}
          onSavePreset={handleSaveSpecPreset}
          onImportPreset={handleImportSpecPreset}
          onImportSpecFile={handleImportSpecFile}
          onDeletePreset={handleDeleteSpecPreset}
          busy={busy || parsing}
          onClose={() => setDialog(null)}
          {...specHandlers}
        />
      )}
      {dialog === 'connectRepo' && (
        <ConnectRepoDialog
          busy={busy}
          error={connectError}
          onConnectGitHub={handleConnectGitHub}
          onLoginGitLab={handleLoginGitLab}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'push' && pendingPush && connectedRepo && (
        <PushDialog
          defaultMessage="Update LikeC4 diagrams"
          repoLabel={connectedRepoLabel(connectedRepo)}
          branch={connectedRepo.ref.branch}
          diff={pendingPush}
          busy={busy}
          error={pushError}
          onSubmit={handlePushToRepo}
          onClose={() => setDialog(null)}
        />
      )}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
