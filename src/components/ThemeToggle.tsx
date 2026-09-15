import { MoonIcon, SunIcon, SystemThemeIcon } from './icons'

export type ThemeChoice = 'light' | 'dark' | 'system'

const ORDER: ThemeChoice[] = ['system', 'light', 'dark']
const ICONS = { system: SystemThemeIcon, light: SunIcon, dark: MoonIcon }
const LABELS = { system: 'System', light: 'Light', dark: 'Dark' }

/** A single button cycling System → Light → Dark → System, showing the
 * current choice's icon - the common compact alternative to a 3-way
 * segmented control, standard in apps that offer a manual theme override
 * on top of following the OS setting. */
export default function ThemeToggle({
  theme,
  onChange,
}: {
  theme: ThemeChoice
  onChange: (theme: ThemeChoice) => void
}) {
  const Icon = ICONS[theme]
  return (
    <button
      type="button"
      className="btn icon-btn-standalone"
      title={`Theme: ${LABELS[theme]} (click to change)`}
      aria-label={`Theme: ${LABELS[theme]}. Click to change.`}
      onClick={() => onChange(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
    >
      <Icon />
    </button>
  )
}
