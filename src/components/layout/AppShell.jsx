import { useState } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { TopBar } from './TopBar.jsx'

export function AppShell({ workspace, onNavigate, children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function navigate(id) {
    onNavigate(id)
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <div
        className={menuOpen ? 'scrim open' : 'scrim'}
        onClick={function close() {
          setMenuOpen(false)
        }}
      />
      <Sidebar workspace={workspace} onNavigate={navigate} open={menuOpen} />
      <div className="workspace">
        <TopBar onOpenMenu={function open() { setMenuOpen(true) }} />
        <main className="page">{children}</main>
      </div>
    </div>
  )
}
