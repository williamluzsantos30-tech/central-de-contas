import type { StatusEdicaoVideo } from '@/types/database'

/** Cor do dot (régua de contadores / lote). */
export const statusDot: Record<StatusEdicaoVideo, string> = {
  pendente: 'text-zinc-400',
  em_edicao: 'text-violet-400',
  em_aprovacao: 'text-amber-400',
  em_alteracao: 'text-red-400',
  conclusao: 'text-emerald-400',
}

/** Barra lateral da linha do vídeo. */
export const statusBar: Record<StatusEdicaoVideo, string> = {
  pendente: 'bg-zinc-500/70',
  em_edicao: 'bg-violet-500',
  em_aprovacao: 'bg-amber-500',
  em_alteracao: 'bg-red-500',
  conclusao: 'bg-emerald-500',
}

/** Pill do dropdown de status. */
export const statusPill: Record<StatusEdicaoVideo, string> = {
  pendente: 'border-zinc-500/50 bg-zinc-500/15 text-zinc-200',
  em_edicao: 'border-violet-500/50 bg-violet-500/20 text-violet-100',
  em_aprovacao: 'border-amber-500/60 bg-amber-500/25 text-amber-100',
  em_alteracao: 'border-red-500/70 bg-red-500/30 text-red-100 font-semibold',
  conclusao: 'border-emerald-500/60 bg-emerald-500/20 text-emerald-100',
}

export const dataCurta = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
