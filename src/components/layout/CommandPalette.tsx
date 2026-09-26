/**
 * Busca global (Ctrl/⌘ K) — páginas do menu (respeitando a visibilidade do
 * usuário) + clientes ativos. Setas navegam, Enter abre, Esc fecha.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CornerDownLeft, Search, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ENTRADAS_NAV } from './navTrail'
import { useNavVisivel } from './useNavVisivel'

type ClienteBusca = { id: string; nome: string; nicho: string | null; squad: string | null }

interface Resultado {
  chave: string
  tipo: 'pagina' | 'cliente'
  titulo: string
  contexto: string
  to: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
}

// Cache da lista de clientes na sessão (a busca abre várias vezes).
let cacheClientes: ClienteBusca[] | null = null

/** Minúsculo e sem acento, pra "renovacao" achar "Renovações". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const MAX_POR_GRUPO = 8

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { itemVisivel } = useNavVisivel()
  const [q, setQ] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [clientes, setClientes] = useState<ClienteBusca[]>(cacheClientes ?? [])
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setAtivo(0)
    if (cacheClientes) return
    supabase
      .from('clientes')
      .select('id, nome, nicho, squad')
      .is('arquivado_em', null)
      .order('nome')
      .then(({ data, error }) => {
        if (error || !data) return
        cacheClientes = data as ClienteBusca[]
        setClientes(cacheClientes)
      })
  }, [open])

  const paginas = useMemo<Resultado[]>(
    () =>
      ENTRADAS_NAV.filter((e) => itemVisivel(e.item)).map((e) => ({
        chave: `p:${e.item.to}`,
        tipo: 'pagina',
        titulo: e.item.label,
        contexto: e.pastas.join(' › '),
        to: e.item.to,
        Icon: e.item.icon,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  )

  const resultados = useMemo<Resultado[]>(() => {
    const termo = norm(q.trim())
    const bate = (...campos: (string | null | undefined)[]) => !termo || campos.some((c) => c && norm(c).includes(termo))
    const pags = paginas.filter((p) => bate(p.titulo, p.contexto)).slice(0, termo ? MAX_POR_GRUPO : 6)
    const clis: Resultado[] = termo
      ? clientes
          .filter((c) => bate(c.nome, c.nicho))
          .slice(0, MAX_POR_GRUPO)
          .map((c) => ({
            chave: `c:${c.id}`,
            tipo: 'cliente',
            titulo: c.nome,
            contexto: [c.nicho, c.squad].filter(Boolean).join(' · '),
            to: `/clientes/${c.id}`,
            Icon: Users,
          }))
      : []
    return [...pags, ...clis]
  }, [q, paginas, clientes])

  useEffect(() => setAtivo(0), [q])
  useEffect(() => {
    listaRef.current?.querySelector(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  function abrir(r: Resultado | undefined) {
    if (!r) return
    navigate(r.to)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAtivo((i) => Math.min(resultados.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      abrir(resultados[ativo])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  let idx = -1
  const grupo = (tipo: Resultado['tipo'], titulo: string) => {
    const itens = resultados.filter((r) => r.tipo === tipo)
    if (!itens.length) return null
    return (
      <div className="py-1">
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{titulo}</p>
        {itens.map((r) => {
          idx++
          const i = idx
          return (
            <button
              key={r.chave}
              data-idx={i}
              onMouseMove={() => setAtivo(i)}
              onClick={() => abrir(r)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                i === ativo ? 'bg-brand-500/15 text-zinc-100' : 'text-zinc-300',
              )}
            >
              <r.Icon size={15} className={cn('shrink-0', i === ativo ? 'text-brand-300' : 'text-muted')} />
              <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
              {r.contexto && <span className="shrink-0 truncate text-[11px] text-muted">{r.contexto}</span>}
              {i === ativo && <CornerDownLeft size={12} className="shrink-0 text-muted" />}
            </button>
          )
        })}
      </div>
    )
  }

  // Portal no body: fora do header (que é sempre escuro), segue o tema da página.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Buscar"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-bg-card shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar clientes ou páginas…"
            className="h-12 w-full bg-transparent text-sm text-zinc-100 placeholder:text-muted focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <div ref={listaRef} className="max-h-[50vh] overflow-y-auto p-1">
          {resultados.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">Nada encontrado para “{q}”.</p>
          ) : (
            <>
              {grupo('pagina', q.trim() ? 'Páginas' : 'Ir para')}
              {grupo('cliente', 'Clientes')}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1">
            <ArrowRight size={10} className="-rotate-90" />
            <ArrowRight size={10} className="rotate-90" /> navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft size={10} /> abrir
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
