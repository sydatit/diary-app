import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
type Resolved = 'light' | 'dark'

const KEY = 'unplug.theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolve(pref: ThemePref): Resolved {
  return pref === 'system' ? (media().matches ? 'dark' : 'light') : pref
}

function apply(theme: Resolved) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141210' : '#faf7f2')
}

interface ThemeState {
  pref: ThemePref
  theme: Resolved
  setPref: (p: ThemePref) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [theme, setTheme] = useState<Resolved>(() => resolve(readPref()))

  useEffect(() => {
    const next = resolve(pref)
    setTheme(next)
    apply(next)
    if (pref !== 'system') return
    // Follow the OS setting live (e.g. auto dark mode at sunset).
    const mq = media()
    const onChange = () => {
      const t = mq.matches ? 'dark' : 'light'
      setTheme(t)
      apply(t)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p)
    try {
      if (p === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, p)
    } catch {
      /* storage unavailable: still applies for this session */
    }
  }, [])

  const toggle = useCallback(() => setPref(theme === 'dark' ? 'light' : 'dark'), [theme, setPref])

  return <ThemeContext.Provider value={{ pref, theme, setPref, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
