/**
 * Peças visuais do Tráfego: pacing de verba (completo e compacto), selos de
 * Contrato × Saúde e indicador de salvamento.
 */
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ds'
import { cn, formatCurrency } from '@/lib/utils'
import {
  COR_PACING,
  CONTRATO_INFO,
  SAUDE_INFO,
  contratoDoCliente,
  saudeDaConta,
  type PacingVerba,
} from '@/lib/trafegoCliente'
import type { Cliente } from '@/types/database'

const pct0 = (n: number) => `${Math.round(n)}%`

/** Barra "Investido R$ Y de R$ X (Z%)" + rótulo de ritmo. */
export function BudgetPacingBar({ pacing, origem }: { pacing: PacingVerba; origem?: string }) {
  const cor = COR_PACING[pacing.nivel]
  if (pacing.nivel === 'sem_dado') {
    return <p className="mt-2 text-[11px] text-muted">{pacing.rotulo}</p>
  }
  return (
    <div className="mt-2 w-64 max-w-full">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-zinc-300">
          Investido <strong className="tabular-nums text-zinc-100">{formatCurrency(pacing.investido)}</strong> de{' '}
          <span className="tabular-nums">{formatCurrency(pacing.verba)}</span>
        </span>
        <span className="tabular-nums text-muted">{pct0(pacing.pct)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-soft">
        <div className={cn('h-full rounded-full', cor.barra)} style={{ width: `${Math.min(100, pacing.pct)}%` }} />
      </div>
      <p className={cn('mt-1 text-[11px] font-medium', cor.texto)} title={`Projeção de fim de mês: ${formatCurrency(pacing.projecao)} (${pct0(pacing.projecaoPct)} da verba)`}>
        {pacing.rotulo}
        {origem && <span className="font-normal text-muted"> · {origem}</span>}
      </p>
    </div>
  )
}

/** Versão da lista: mini barra + % com a mesma cor. */
export function BudgetPacingCompact({ pacing }: { pacing: PacingVerba }) {
  const cor = COR_PACING[pacing.nivel]
  if (pacing.nivel === 'sem_dado') return <p className="text-[10px] text-muted">{pacing.rotulo === 'Sem verba definida' ? '' : 'sem investido'}</p>
  return (
    <div className="mt-1 flex items-center gap-1.5" title={`Investido ${formatCurrency(pacing.investido)} · ${pacing.rotulo}`}>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-bg-soft">
        <span className={cn('block h-full rounded-full', cor.barra)} style={{ width: `${Math.min(100, pacing.pct)}%` }} />
      </span>
      <span className={cn('text-[10px] font-medium tabular-nums', cor.texto)}>{pct0(pacing.pct)}</span>
    </div>
  )
}

/** Dois conceitos com rótulo explícito: Contrato e Saúde da conta. */
export function StatusBadges({ cliente, compacto }: { cliente: Pick<Cliente, 'status' | 'status_saude_geral'>; compacto?: boolean }) {
  const contrato = CONTRATO_INFO[contratoDoCliente(cliente)]
  const saude = SAUDE_INFO[saudeDaConta(cliente)]
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={contrato.tone} title="Situação do contrato">
        {compacto ? '' : 'Contrato: '}
        {contrato.label}
      </Badge>
      <Badge tone={saude.tone} title="Saúde da conta (Controle do Head / marcação de atenção)">
        {compacto ? '' : 'Saúde: '}
        {saude.label}
      </Badge>
    </span>
  )
}

export type EstadoSalvar = 'idle' | 'saving' | 'saved' | 'error'

/** "Salvando..." → "✓ Salvo" (some em 2s) → erro com "Tentar novamente". */
export function SaveIndicator({ estado, onRetry }: { estado: EstadoSalvar; onRetry?: () => void }) {
  if (estado === 'saving')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-300">
        <Loader2 size={11} className="animate-spin" /> Salvando...
      </span>
    )
  if (estado === 'saved')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
        <Check size={11} /> Salvo
      </span>
    )
  if (estado === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
        <AlertTriangle size={11} /> Erro ao salvar ·{' '}
        <button type="button" onClick={onRetry} className="underline hover:text-red-300">
          Tentar novamente
        </button>
      </span>
    )
  return null
}
