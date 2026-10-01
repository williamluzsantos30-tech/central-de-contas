/**
 * Peças das tarefas por ocorrência: prioridade NEUTRA (o vermelho fica só
 * pro atraso), trilha de cumprimento e seletor de responsável.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'
import { buscarProfilesComPapel } from '@/lib/profilesComPapel'
import { temAlgumCargo, type Cargo } from '@/lib/cargos'
import { cn } from '@/lib/utils'
import { rotuloData, type OcorrenciaTarefa } from '@/lib/ocorrencias'
import type { PrioridadeTarefa, Profile } from '@/types/database'

const PRIORIDADE: Record<PrioridadeTarefa, { icone: string; label: string }> = {
  alta: { icone: '▲', label: 'Alta' },
  media: { icone: '■', label: 'Média' },
  baixa: { icone: '▼', label: 'Baixa' },
}

export function PrioridadeBadge({ prioridade }: { prioridade: PrioridadeTarefa }) {
  const p = PRIORIDADE[prioridade]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-500/40 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
      title={`Prioridade ${p.label.toLowerCase()}`}
    >
      <span aria-hidden className="text-[8px] leading-none text-muted">
        {p.icone}
      </span>
      {p.label}
    </span>
  )
}

const ROTULO_STATUS = { feita: 'feita', perdida: 'perdida', pendente: 'em aberto' } as const

/** ● verde = feita · ● vermelho = perdida · ○ = em aberto. Mais antiga à esquerda. */
export function TrilhaCumprimento({ ocorrencias, hoje }: { ocorrencias: OcorrenciaTarefa[]; hoje: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label="Últimas ocorrências">
      {ocorrencias.map((o) => (
        <span
          key={o.id}
          title={`${rotuloData(o.dataPrevista, hoje)} · ${ROTULO_STATUS[o.status]}`}
          className={cn(
            'h-2 w-2 rounded-full',
            o.status === 'feita' && 'bg-emerald-400',
            o.status === 'perdida' && 'bg-red-400',
            o.status === 'pendente' && 'border border-zinc-400/70',
          )}
        />
      ))}
    </span>
  )
}

// Tarefa de cliente é função de gestão — designer tem fila própria em Webdesign.
const CARGOS_GESTAO: Cargo[] = ['gestor_trafego', 'account_manager', 'social_media', 'head', 'diretoria']

/** Pessoas que podem ser responsáveis por tarefa de cliente (pelo papel/cargo). */
export async function carregarResponsaveisTarefa(): Promise<Profile[]> {
  const { data } = await buscarProfilesComPapel((sel) =>
    supabase.from('profiles').select(sel).eq('ativo', true).eq('aprovado', true).order('nome'),
  )
  return ((data as Profile[]) ?? []).filter((p) => temAlgumCargo(p, CARGOS_GESTAO))
}

/**
 * Avatar (ou "Sem responsável") clicável que abre a lista pra trocar.
 * Popover em portal: não é cortado pelo overflow dos cards.
 */
export function ResponsavelPicker({
  responsavel,
  pessoas,
  onChange,
  disabled,
}: {
  responsavel: Profile | null | undefined
  pessoas: Profile[]
  onChange: (id: string | null) => Promise<void> | void
  disabled?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!aberto || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const largura = 224
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(window.innerWidth - largura - 8, r.right - largura)) })
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setAberto(false)
    }
    const fechar = () => setAberto(false)
    document.addEventListener('mousedown', fora)
    window.addEventListener('scroll', fechar, true)
    return () => {
      document.removeEventListener('mousedown', fora)
      window.removeEventListener('scroll', fechar, true)
    }
  }, [aberto])

  async function escolher(id: string | null) {
    setAberto(false)
    if (id !== (responsavel?.id ?? null)) await onChange(id)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          setAberto((v) => !v)
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-muted transition-colors hover:bg-bg-elev hover:text-zinc-200 disabled:cursor-default"
        title={responsavel ? `Responsável: ${responsavel.nome} (clique pra trocar)` : 'Definir responsável'}
        aria-label={responsavel ? `Responsável: ${responsavel.nome}` : 'Sem responsável'}
      >
        {responsavel ? (
          <Avatar name={responsavel.nome} url={responsavel.avatar_url} size="sm" />
        ) : (
          <>
            <UserRound size={12} /> <span className="italic">Sem responsável</span>
          </>
        )}
      </button>
      {aberto &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[60] max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-bg-card p-1 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Responsável</p>
            {pessoas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void escolher(p.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-bg-elev"
              >
                <Avatar name={p.nome} url={p.avatar_url} size="sm" />
                <span className="flex-1 truncate">{p.nome}</span>
                {p.id === responsavel?.id && <Check size={12} className="text-brand-300" />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void escolher(null)}
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-1.5 text-left text-xs text-muted hover:bg-bg-elev"
            >
              <UserRound size={12} /> Sem responsável
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
