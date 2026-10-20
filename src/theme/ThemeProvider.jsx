import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'toonforge-theme'
const ThemeContext = createContext(null)

function readStoredPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value
    }
  } catch {
    /* private mode */
  }
  return 'system'
}

function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredPreference)
  const [systemDark, setSystemDark] = useState(getSystemDark)

  useEffect(function watchSystemTheme() {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function onChange(event) {
      setSystemDark(event.matches)
    }
    media.addEventListener('change', onChange)
    return function cleanup() {
      media.removeEventListener('change', onChange)
    }
  }, [])

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(function applyTheme() {
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.themePreference = preference
    const themeColor = resolved === 'dark' ? '#0f1113' : '#f6f4ef'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', themeColor)
    }
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      /* ignore */
    }
  }, [preference, resolved])

  const value = useMemo(
    function createValue() {
      return { preference, setPreference, resolved }
    },
    [preference, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }
  return context
}
