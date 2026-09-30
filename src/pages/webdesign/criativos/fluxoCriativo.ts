/**
 * Criativos — fluxo da esteira com APROVAÇÃO DO DESIGN condicional
 * (confirmado com o usuário em 30/09/2026):
 *
 *   Pendente → Design → Design Finalizado → Aprovação do Design
 *     ├─ aprovado  → Conclusão (Alteração é pulada)
 *     └─ reprovado → Alteração (com motivo) → ajuste pronto → Aprovação do Design …
 *
 * O cliente decide por fora (WhatsApp/reunião) e o TIME registra no sistema
 * quem decidiu e o motivo. A etapa atual continua em
 * `criativos_webdesign.status`; o histórico de etapas e decisões fica num
 * JSON por criativo (`criativos_webdesign_fluxo`, migration 097 — sem ela,
 * salva no navegador).
 */
import { calculateSLADeadline, diasUteisEntre } from '@/lib/dates'
import { criarFluxoStore } from '@/lib/fluxoStore'
import type { CriativoWebdesign, StatusCriativoWebdesign } from '@/types/database'

export interface DecisaoDesign {
  id: string
  status: 'aprovado' | 'reprovado'
  /** "Cliente" ou quem decidiu internamente. */
  por: string
  data: string
  motivo?: string
  /** Arquivo avaliado nessa decisão. */
  arquivoUrl?: string | null
}

export interface FluxoCriativo {
  historico: { etapa: StatusCriativoWebdesign; data: string }[]
  decisoes: DecisaoDesign[]
  /** Reprovação em aberto (criativo em ajuste). */
  reprovacao: { motivo: string; data: string } | null
}

export const fluxoCriativoVazio = (): FluxoCriativo => ({ historico: [], decisoes: [], reprovacao: null })

export function normalizarFluxoCriativo(raw: unknown): FluxoCriativo {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FluxoCriativo>
  return {
    historico: Array.isArray(r.historico) ? r.historico : [],
    decisoes: Array.isArray(r.decisoes) ? r.decisoes : [],
    reprovacao: r.reprovacao ?? null,
  }
}

export const storeFluxoCriativo = criarFluxoStore('criativos_webdesign_fluxo', 'criativo_id', 'domus-criativo-fluxo-v1', normalizarFluxoCriativo)

// ── Transições (puras) ──────────────────────────────────────────────────────

const agora = () => new Date().toISOString()
const novoId = () => Math.random().toString(36).slice(2, 10)

export function registrarEtapa(f: FluxoCriativo, etapa: StatusCriativoWebdesign, data = agora()): FluxoCriativo {
  return { ...f, historico: [...f.historico, { etapa, data }] }
}

export function aprovarDesign(f: FluxoCriativo, por: string, arquivoUrl: string | null, data = agora()) {
  const fluxo = registrarEtapa(
    { ...f, reprovacao: null, decisoes: [...f.decisoes, { id: novoId(), status: 'aprovado', por, data, arquivoUrl }] },
    'conclusao',
    data,
  )
  return { status: 'conclusao' as StatusCriativoWebdesign, fluxo }
}

export function reprovarDesign(f: FluxoCriativo, por: string, motivo: string, arquivoUrl: string | null, data = agora()) {
  const m = motivo.trim()
  const fluxo = registrarEtapa(
    {
      ...f,
      reprovacao: { motivo: m, data },
      decisoes: [...f.decisoes, { id: novoId(), status: 'reprovado', por, data, motivo: m, arquivoUrl }],
    },
    'alteracao',
    data,
  )
  return { status: 'alteracao' as StatusCriativoWebdesign, fluxo }
}

/** Ajuste pronto: volta pra Aprovação do Design (a reprovação fica no histórico). */
export function reenviarParaAprovacao(f: FluxoCriativo, data = agora()) {
  return { status: 'aprovacao_design' as StatusCriativoWebdesign, fluxo: registrarEtapa(f, 'aprovacao_design', data) }
}

/** Alteração foi percorrida (houve reprovação) ou só pulada (aprovado de primeira)? */
export function alteracaoPercorrida(f: FluxoCriativo): boolean {
  return f.decisoes.some((d) => d.status === 'reprovado') || f.historico.some((h) => h.etapa === 'alteracao')
}

// ── SLA (5 dias úteis desde a criação) ──────────────────────────────────────

export const SLA_CRIATIVO_DIAS_UTEIS = 5

export type NivelSlaCriativo = 'no_prazo' | 'alerta' | 'estourado' | 'concluido'

export interface SlaCriativo {
  nivel: NivelSlaCriativo
  diasUsados: number
  diasEstourado: number
  pct: number
  prazo: Date
}

/** Verde < 70% do prazo · laranja 70–100% · vermelho quando passa do prazo. */
export function slaDoCriativo(c: Pick<CriativoWebdesign, 'created_at' | 'status'>, hoje: Date = new Date()): SlaCriativo {
  const prazo = calculateSLADeadline(c.created_at, SLA_CRIATIVO_DIAS_UTEIS)
  const diasUsados = diasUteisEntre(c.created_at, hoje)
  const pct = diasUsados / SLA_CRIATIVO_DIAS_UTEIS
  const nivel: NivelSlaCriativo =
    c.status === 'conclusao' ? 'concluido' : diasUsados > SLA_CRIATIVO_DIAS_UTEIS ? 'estourado' : pct >= 0.7 ? 'alerta' : 'no_prazo'
  return {
    nivel,
    diasUsados,
    diasEstourado: Math.max(0, diasUsados - SLA_CRIATIVO_DIAS_UTEIS),
    pct: Math.min(100, Math.round(pct * 100)),
    prazo,
  }
}

export const COR_SLA_CRIATIVO: Record<NivelSlaCriativo, { texto: string; barra: string }> = {
  no_prazo: { texto: 'text-emerald-400', barra: 'bg-emerald-500/70' },
  alerta: { texto: 'text-orange-400', barra: 'bg-orange-500/80' },
  estourado: { texto: 'text-red-400', barra: 'bg-red-500/80' },
  concluido: { texto: 'text-emerald-400', barra: 'bg-emerald-500/70' },
}

export function rotuloSlaCriativo(s: SlaCriativo): string {
  if (s.nivel === 'concluido') return `SLA cumprido em ${s.diasUsados}d`
  if (s.nivel === 'estourado') return `SLA estourado · ${s.diasEstourado}d`
  return `${s.diasUsados}/${SLA_CRIATIVO_DIAS_UTEIS} dias úteis`
}
