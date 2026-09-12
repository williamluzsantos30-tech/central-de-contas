import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

// Le tambem a key antiga 'movmed-theme' na primeira carga pra usuarios
// que ja tinham escolhido tema no branding anterior nao terem que
// escolher de novo.
const STORAGE_KEY = 'domus-theme'
const LEGACY_KEY = 'movmed-theme'

// Light e' o padrao (conteudo claro, chrome escuro via .theme-dark).
// Dark so' quando o usuario escolheu explicitamente.
function readPersisted(): Theme {
  if (typeof window === 'undefined') return 'light'
  const v =
    window.localStorage.getItem(STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_KEY)
  return v === 'dark' ? 'dark' : 'light'
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
