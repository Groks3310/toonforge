import { useState } from 'react'
import { AppShell } from './components/layout/AppShell.jsx'
import { Dashboard } from './workspaces/dashboard/Dashboard.jsx'
import { CartoonStudio } from './workspaces/cartoon-studio/CartoonStudio.jsx'
import { ComingSoon } from './workspaces/coming-soon/ComingSoon.jsx'

const COMING_SOON = {
  character: {
    title: 'Character Studio',
    body: 'Reusable cartoon characters come next. We will start with a simple character format, then Three.js previews. This page is not a fake editor.',
  },
  talking: {
    title: 'Talking Studio',
    body: 'Characters will speak with the browser’s built-in speech synthesis and optional microphone recordings. Lip-sync starts after a character can be displayed.',
  },
  motion: {
    title: 'Motion Studio',
    body: 'Walk, wave, and other clips need a rigged character. We will not pretend those animations exist until we import real, licensed clips.',
  },
  story: {
    title: 'Story Studio',
    body: 'Multi-scene stories will reuse characters, dialogue, and backgrounds. Templates will be editable starting points, not generated scripts.',
  },
  video: {
    title: 'Video Studio',
    body: 'The timeline and export tools come after we can preview animation and audio together. Browser export formats will be tested before we promise MP4.',
  },
  audio: {
    title: 'Audio Studio',
    body: 'Recording, import, trimming, and beat detection will live here. No copyrighted music is bundled.',
  },
  projects: {
    title: 'My Projects',
    body: 'Projects will save on this device with IndexedDB. Nothing is stored on a server in this version.',
  },
  settings: {
    title: 'Settings',
    body: 'Theme already lives in the top-right control (Light, Dark, System). More preferences will be added as features exist.',
  },
  help: {
    title: 'Help & Support',
    body: 'ToonForge runs locally in your browser. Photographs never leave this computer unless you export and share them yourself.',
  },
}

export default function App() {
  const [workspace, setWorkspace] = useState('dashboard')

  function openWorkspace(id) {
    setWorkspace(id)
  }

  let content = <Dashboard onNavigate={openWorkspace} />
  if (workspace === 'cartoon') {
    content = <CartoonStudio />
  } else if (COMING_SOON[workspace]) {
    content = <ComingSoon {...COMING_SOON[workspace]} />
  }

  return (
    <AppShell workspace={workspace} onNavigate={openWorkspace}>
      {content}
    </AppShell>
  )
}
