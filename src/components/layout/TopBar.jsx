import { Menu, UserRound } from 'lucide-react'
import { ThemeSwitch } from '../ui/ThemeSwitch.jsx'

export function TopBar({ onOpenMenu }) {
  return (
    <header className="topbar">
      <button type="button" className="menu-toggle" onClick={onOpenMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <div className="offline-pill" title="Image processing runs in this browser">
        <span />
        Offline ready
      </div>
      <ThemeSwitch />
      <div className="user-chip" title="No account. Everything stays on this device.">
        <UserRound size={16} />
      </div>
    </header>
  )
}
