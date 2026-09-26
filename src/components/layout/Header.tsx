/**
 * Barra do topo: trilha da página (automática, a partir do menu) + busca
 * global (Ctrl/⌘ K). Usuário/tema/sair ficam no rodapé do menu lateral.
 */
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, FlaskConical, Home, Search } from 'lucide-react'
import { isDemoMode } from '@/lib/supabase'
import { CommandPalette } from './CommandPalette'
import { trilhaDaRota } from './navTrail'

const ehMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function Header() {
  const { pathname } = useLocation()
  const trilha = trilhaDaRota(pathname)
  const [buscaAberta, setBuscaAberta] = useState(false)

  // Título da aba do navegador acompanha a página.
  const atual = trilha[trilha.length - 1]?.label
  useEffect(() => {
    document.title = atual ? `${atual} · domus.agn` : 'domus.agn — a casa da sua agência'
  }, [atual])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscaAberta((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="theme-dark sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border/60 bg-bg-soft/70 px-6 backdrop-blur-xl">
      <nav aria-label="Você está em" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted">
        <Link to="/" className="shrink-0 rounded p-0.5 hover:text-zinc-100" title="Início">
          <Home size={14} />
        </Link>
        {trilha.map((c, i) => {
          const ultimo = i === trilha.length - 1
          return (
            <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={12} className="shrink-0 opacity-50" />
              {c.to && !ultimo ? (
                <Link to={c.to} className="truncate hover:text-zinc-100">
                  {c.label}
                </Link>
              ) : (
                <span className={ultimo ? 'truncate font-medium text-zinc-100' : 'truncate'}>{c.label}</span>
              )}
            </span>
          )
        })}
      </nav>

      {isDemoMode && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-300">
          <FlaskConical size={12} />
          Modo DEMO
        </span>
      )}

      <button
        onClick={() => setBuscaAberta(true)}
        className="flex h-8 w-72 shrink-0 items-center gap-2 rounded-md border border-border bg-bg-elev/60 px-2.5 text-xs text-muted transition-colors hover:border-brand-500/40 hover:text-zinc-200"
      >
        <Search size={14} className="shrink-0" />
        <span className="flex-1 truncate text-left">Buscar clientes, páginas…</span>
        <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px]">{ehMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <CommandPalette open={buscaAberta} onClose={() => setBuscaAberta(false)} />
    </header>
  )
}
