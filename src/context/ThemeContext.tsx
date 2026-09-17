import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Mode = 'light' | 'dark'

interface ThemeValue {
  mode: Mode
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue>({ mode: 'dark', dark: true, toggle: () => {} })

const STORAGE_KEY = 'ttl-sprint-theme'

function initialMode(): Mode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage bloqueado (ventana privada); se sigue con el valor por defecto.
  }
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  // La TV de la oficina se ve mejor en oscuro, asi que ese es el default.
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
    document.documentElement.style.colorScheme = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Sin persistencia, el tema dura lo que dure la pestania.
    }
  }, [mode])

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [])

  const value = useMemo(() => ({ mode, dark: mode === 'dark', toggle }), [mode, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
