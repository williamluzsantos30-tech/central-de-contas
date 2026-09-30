/**
 * Produção Social Media — SLA do planejamento com nível de urgência,
 * responsável por arte, ação "Enviar para Calendário" e confirmação de exclusão.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Trash2, User } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { temAlgumCargo } from '@/lib/cargos'
import { buscarProfilesComPapel } from '@/lib/profilesComPapel'
import { cn } from '@/lib/utils'
import { enviarArteAoCalendario, linkNoCalendario, podeEnviarAoCalendario } from '@/lib/socialCalendarioSync'
import { getPostPub } from '@/components/social/mockPosts'
import type { ItemSocialMedia, PlanejamentoSocialMedia, Profile } from '@/types/database'

// ── SLA do planejamento ─────────────────────────────────────────────────────

/** 16 dias corridos a partir da aprovação do planejamento pelo cliente (regra atual). */
export const SLA_PLANEJAMENTO_DIAS = 16

export type NivelSLA = 'estourado' | 'alerta' | 'no_prazo' | 'aguardando' | 'concluido'

export interface SlaPlanejamento {
  nivel: NivelSLA
  diasUsados: number
  diasEstourado: number
  pct: number
  prazo: Date | null
}

const DIA_MS = 86_400_000

/**
 * Verde < 70% do prazo · Laranja 70–100% · Vermelho acima do prazo.
 * Sem aprovação do cliente o SLA não começou; com todas as artes concluídas, cumprido.
 */
export function slaDoPlanejamento(p: PlanejamentoSocialMedia, itens: ItemSocialMedia[], hoje: Date = new Date()): SlaPlanejamento {
  const concluido = itens.length > 0 && itens.every((i) => i.status === 'conclusao')
  if (!p.aprovado_em) return { nivel: concluido ? 'concluido' : 'aguardando', diasUsados: 0, diasEstourado: 0, pct: 0, prazo: null }
  const inicio = new Date(p.aprovado_em)
  const prazo = new Date(inicio.getTime() + SLA_PLANEJAMENTO_DIAS * DIA_MS)
  const diasUsados = Math.max(0, Math.floor((hoje.getTime() - inicio.getTime()) / DIA_MS))
  const pct = diasUsados / SLA_PLANEJAMENTO_DIAS
  const nivel: NivelSLA = concluido ? 'concluido' : diasUsados > SLA_PLANEJAMENTO_DIAS ? 'estourado' : pct >= 0.7 ? 'alerta' : 'no_prazo'
  return { nivel, diasUsados, diasEstourado: Math.max(0, diasUsados - SLA_PLANEJAMENTO_DIAS), pct: Math.min(100, Math.round(pct * 100)), prazo }
}

const PESO: Record<NivelSLA, number> = { estourado: 0, alerta: 1, no_prazo: 2, aguardando: 3, concluido: 4 }

/** Estourado → alerta → no prazo; dentro do nível, o mais consumido primeiro. */
export function compararUrgencia(a: SlaPlanejamento, b: SlaPlanejamento): number {
  return PESO[a.nivel] - PESO[b.nivel] || b.diasUsados - a.diasUsados
}

export const COR_SLA: Record<NivelSLA, { texto: string; barra: string }> = {
  estourado: { texto: 'text-red-400', barra: 'bg-red-500/80' },
  alerta: { texto: 'text-orange-400', barra: 'bg-orange-500/80' },
  no_prazo: { texto: 'text-emerald-400', barra: 'bg-emerald-500/70' },
  aguardando: { texto: 'text-muted', barra: 'bg-zinc-500/50' },
  concluido: { texto: 'text-emerald-400', barra: 'bg-emerald-500/70' },
}

export function rotuloSla(s: SlaPlanejamento): string {
  if (s.nivel === 'concluido') return `SLA cumprido em ${s.diasUsados}d`
  if (s.nivel === 'aguardando') return 'Aguardando aprovação do cliente'
  if (s.nivel === 'estourado') return `SLA estourado · ${s.diasEstourado}d`
  return `${s.diasUsados}/${SLA_PLANEJAMENTO_DIAS} dias`
}

// ── Equipe (responsáveis) ──────────────────────────────────────────────────

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Criativos / Social Media pela função (papel da Equipe Operacional ou cargo). */
export function ehCriativo(p: Profile): boolean {
  if (temAlgumCargo(p, ['designer', 'social_media'])) return true
  return /design|social|criativ|video|editor/.test(semAcento(p.papel?.nome ?? ''))
}

export interface EquipeSocial {
  porId: Map<string, Profile>
  /** Opções do seletor (criativos; sem nenhum, a equipe toda). */
  opcoes: Profile[]
}

export const EQUIPE_VAZIA: EquipeSocial = { porId: new Map(), opcoes: [] }

export async function carregarEquipeSocial(): Promise<EquipeSocial> {
  const { data } = await buscarProfilesComPapel((sel) =>
    supabase.from('profiles').select(sel).eq('ativo', true).eq('aprovado', true).order('nome'),
  )
  const criativos = data.filter(ehCriativo)
  return { porId: new Map(data.map((p) => [p.id, p])), opcoes: criativos.length ? criativos : data }
}

// ── Responsável por arte ───────────────────────────────────────────────────

export function ResponsavelArte({
  responsavelId,
  equipe,
  onEscolher,
}: {
  responsavelId: string | null
  equipe: EquipeSocial
  onEscolher: (id: string | null) => void
}) {
  const [editando, setEditando] = useState(false)
  const pessoa = responsavelId ? equipe.porId.get(responsavelId) : undefined
  if (editando) {
    return (
      <select
        autoFocus
        value={responsavelId ?? ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          setEditando(false)
          onEscolher(e.target.value || null)
        }}
        onBlur={() => setEditando(false)}
        className="h-7 max-w-[10rem] rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
      >
        <option value="">Sem responsável</option>
        {equipe.opcoes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditando(true)
      }}
      title={pessoa ? `Responsável: ${pessoa.nome} — clique pra trocar` : 'Atribuir responsável pela arte'}
      className={cn(
        'inline-flex h-7 max-w-[9rem] shrink-0 items-center gap-1.5 rounded-full text-[11px] transition-colors',
        pessoa ? 'pr-2 text-zinc-200 hover:bg-bg-elev' : 'border border-dashed border-border px-2 text-muted hover:border-brand-500/50 hover:text-zinc-200',
      )}
    >
      {pessoa ? (
        <>
          <Avatar name={pessoa.nome} url={pessoa.avatar_url} size="sm" />
          <span className="truncate">{pessoa.nome.split(' ')[0]}</span>
        </>
      ) : (
        <>
          <User size={10} /> Sem responsável
        </>
      )}
    </button>
  )
}

// ── Enviar para Calendário / Ver no Calendário ─────────────────────────────

export function AcaoCalendario({
  arte,
  clienteId,
  onChanged,
}: {
  arte: ItemSocialMedia
  clienteId: string | null
  onChanged: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const jaFoi = arte.status === 'em_aprovacao' || arte.status === 'conclusao'
  const temArte = (arte.artes_prontas ?? []).some(Boolean)

  if (jaFoi && arte.prazo) {
    const enviadoEm = getPostPub(arte.id).enviadoAoCalendarioEm
    return (
      <Link
        to={linkNoCalendario(arte, clienteId)}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted hover:text-brand-300"
        title={`Abrir a postagem no Calendário de Postagens${enviadoEm ? ` · enviada em ${new Date(enviadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}`}
      >
        Ver no Calendário <ArrowRight size={10} />
      </Link>
    )
  }
  if (!temArte) return null
  const pode = podeEnviarAoCalendario(arte)
  return (
    <button
      type="button"
      disabled={!pode.ok || enviando}
      onClick={async (e) => {
        e.stopPropagation()
        setEnviando(true)
        const { error } = await enviarArteAoCalendario(arte)
        setEnviando(false)
        if (error) alert('Erro ao enviar: ' + error)
        onChanged()
      }}
      title={pode.ok ? 'Leva a arte e a legenda pro post do Calendário e coloca Em Aprovação (o cliente decide pelo link do calendário)' : pode.motivo}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-brand-500/40 bg-brand-500/10 px-2 text-[11px] font-medium text-brand-300 hover:bg-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <CalendarDays size={11} /> {enviando ? 'Enviando…' : 'Enviar para Calendário'}
    </button>
  )
}

// ── Excluir planejamento ───────────────────────────────────────────────────

export function competenciaDo(p: PlanejamentoSocialMedia): string {
  if (!p.mes_referencia) return p.titulo
  const d = new Date(`${p.mes_referencia.slice(0, 10)}T12:00:00`)
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function DeletePlanejamentoModal({
  open,
  planejamento,
  nArtes,
  onCancel,
  onConfirm,
}: {
  open: boolean
  planejamento: PlanejamentoSocialMedia
  nArtes: number
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [excluindo, setExcluindo] = useState(false)
  if (!open) return null
  // Portal: o card pode estar dentro de container animado (transform), que
  // quebraria o position: fixed do modal.
  return createPortal(
    <Modal
      open={open}
      onClose={onCancel}
      title="Excluir planejamento"
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={excluindo}
            onClick={async () => {
              setExcluindo(true)
              await onConfirm()
              setExcluindo(false)
            }}
          >
            <Trash2 size={14} /> {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-100">
        Excluir o planejamento de <strong>{competenciaDo(planejamento)}</strong> para{' '}
        <strong>{planejamento.cliente?.nome ?? 'este cliente'}</strong>?{' '}
        {nArtes > 1
          ? `Todas as ${nArtes} artes vinculadas serão removidas.`
          : nArtes === 1
            ? 'A arte vinculada será removida.'
            : 'Ele não tem artes vinculadas.'}{' '}
        Esta ação não pode ser desfeita.
      </p>
    </Modal>,
    document.body,
  )
}
