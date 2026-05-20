import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'movmed-theme'

function readPersisted(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'light' ? 'light' : 'dark'
}

function apply(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(theme)
}

/**
 * Gerencia tema dark/light com persistencia em localStorage.
 * A classe correta (dark/light) e aplicada em <html>.
 * O index.html ja seta a classe inicial via inline script pra evitar
 * flash; este hook mantem sincronizado depois.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readPersisted())

  useEffect(() => {
    apply(theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignora storage cheio / privado */
    }
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  )

  return { theme, setTheme, toggle }
}
