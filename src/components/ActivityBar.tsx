import { DecisionsIcon, DeploymentIcon, DisseminateIcon, FolderIcon, LibraryIcon, ModelIcon } from './icons'

export type SidebarPanel = 'files' | 'library' | 'model' | 'deployment' | 'decisions' | 'disseminate'

interface ActivityItem {
  id: SidebarPanel
  /** short verb shown under the icon - the "what am I about to do here"
   * framing a newcomer can scan without hovering anything. */
  label: string
  /** fuller explanation (verb + the panel's actual technical name + what
   * it holds) - used for the hover tooltip and screen readers, where
   * there's room to spell it out. */
  hint: string
  icon: () => React.JSX.Element
}

const LOGICAL_ITEMS: ActivityItem[] = [
  {
    id: 'files',
    label: 'Project',
    hint: 'Project — files and project settings',
    icon: FolderIcon,
  },
  {
    id: 'library',
    label: 'Define',
    hint: 'Define — Specification: the kinds, styles and tags your model is built from',
    icon: LibraryIcon,
  },
  { id: 'model', label: 'Design', hint: 'Design — Model: the elements and relationships themselves', icon: ModelIcon },
]

const DEPLOYMENT_ITEM: ActivityItem = {
  id: 'deployment',
  label: 'Deployment',
  hint: 'Deployment — the operational view of how the system is deployed and runs',
  icon: DeploymentIcon,
}

const DECISIONS_ITEM: ActivityItem = {
  id: 'decisions',
  label: 'Decisions',
  hint: 'Decisions — ADRs, requirements, governance changes and compliance items, annotated onto elements/views/relationships',
  icon: DecisionsIcon,
}

const DISSEMINATE_ITEM: ActivityItem = {
  id: 'disseminate',
  label: 'Disseminate',
  hint: 'Disseminate — publish views and notes as a scrollable document',
  icon: DisseminateIcon,
}

/** VS Code-style icon strip picking which single panel the sidebar shows -
 * standard "Explorer / Search / ..." activity-bar convention, so the
 * sidebar shows one focused view at a time instead of every section
 * stacked and competing for scroll space. The first two buttons also
 * carry a short verb label (Define/Design) under their icon - "Specification"
 * and "Model" are technical LikeC4 terms that don't say what you'd go there
 * *to do*, so the verb is the primary, always-visible cue and the
 * technical name lives in the hover tooltip. "Deployment" already reads as
 * an action on its own, so it keeps its real name. It sits below a
 * divider, separate from the three logical-model panels above it - the
 * same layer split carried through the Specification editor and the
 * canvas's view-mode toggle. "Disseminate" sits in its own tier below a
 * second divider - it completes a Define -> Design -> Deployment ->
 * Disseminate lifecycle, but operates *across* whichever view you already
 * built rather than being a fourth model layer itself. "Decisions" gets
 * its own tier between the two, for the same reason: it's not another
 * logical-model layer, and not the publish step either - it's the
 * record of *why* the model looks the way it does, referenced from
 * Disseminate reports once it exists. */
export default function ActivityBar({
  active,
  onSelect,
}: {
  active: SidebarPanel
  onSelect: (panel: SidebarPanel) => void
}) {
  const renderButton = (item: ActivityItem) => {
    const Icon = item.icon
    return (
      <button
        key={item.id}
        type="button"
        className={'activity-bar-btn' + (active === item.id ? ' active' : '')}
        aria-label={item.hint}
        aria-current={active === item.id}
        title={item.hint}
        onClick={() => onSelect(item.id)}
      >
        <Icon />
        <span className="activity-bar-btn-label">{item.label}</span>
      </button>
    )
  }
  return (
    <nav className="activity-bar" aria-label="Sidebar panels">
      {LOGICAL_ITEMS.map(renderButton)}
      <div className="activity-bar-divider" aria-hidden="true" />
      {renderButton(DEPLOYMENT_ITEM)}
      <div className="activity-bar-divider" aria-hidden="true" />
      {renderButton(DECISIONS_ITEM)}
      <div className="activity-bar-divider" aria-hidden="true" />
      {renderButton(DISSEMINATE_ITEM)}
    </nav>
  )
}
