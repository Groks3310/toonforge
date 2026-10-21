import {
  Home,
  Image,
  UserRound,
  Mic,
  PersonStanding,
  BookOpen,
  Clapperboard,
  Music,
  Folder,
  Settings,
  CircleHelp,
  Play,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, ready: true },
  { id: 'cartoon', label: 'Cartoon Studio', icon: Image, ready: true },
  { id: 'character', label: 'Character Studio', icon: UserRound, ready: true },
  { id: 'motion', label: 'Motion Studio', icon: PersonStanding, ready: true },
  { id: 'talking', label: 'Talking Studio', icon: Mic, ready: false },
  { id: 'story', label: 'Story Studio', icon: BookOpen, ready: true },
  { id: 'video', label: 'Video Studio', icon: Clapperboard, ready: false },
  { id: 'audio', label: 'Audio Studio', icon: Music, ready: false },
  { id: 'projects', label: 'My Projects', icon: Folder, ready: false },
]

const FOOTER = [
  { id: 'settings', label: 'Settings', icon: Settings, ready: false },
  { id: 'help', label: 'Help & Support', icon: CircleHelp, ready: false },
]

export function Sidebar({ workspace, onNavigate, open }) {
  return (
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <Play size={16} fill="currentColor" />
        </div>
        <div>
          <h1>ToonForge</h1>
          <p>Create · Animate · Share</p>
        </div>
      </div>

      <nav className="nav-group" aria-label="Studios">
        {NAV.map(function renderItem(item) {
          return (
            <NavItem
              key={item.id}
              item={item}
              active={workspace === item.id}
              onNavigate={onNavigate}
            />
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-label">Account</div>
        <nav className="nav-group" aria-label="Account">
          {FOOTER.map(function renderFooter(item) {
            return (
              <NavItem
                key={item.id}
                item={item}
                active={workspace === item.id}
                onNavigate={onNavigate}
              />
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

function NavItem({ item, active, onNavigate }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      className={active ? 'nav-btn active' : 'nav-btn'}
      onClick={function click() {
        onNavigate(item.id)
      }}
    >
      <Icon size={18} />
      <span>{item.label}</span>
      {item.ready ? null : <span className="soon">Soon</span>}
    </button>
  )
}
