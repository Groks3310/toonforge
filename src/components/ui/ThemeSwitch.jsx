import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../theme/ThemeProvider.jsx'

const OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

export function ThemeSwitch() {
  const { preference, setPreference } = useTheme()

  return (
    <div className="theme-switch" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map(function renderOption(option) {
        const Icon = option.icon
        const active = preference === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            className={active ? 'active' : ''}
            onClick={function select() {
              setPreference(option.id)
            }}
          >
            <Icon size={15} />
          </button>
        )
      })}
    </div>
  )
}
