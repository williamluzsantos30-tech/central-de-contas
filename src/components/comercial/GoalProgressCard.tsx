/**
 * GoalProgressCard — card de progresso de uma Meta Comercial (mesmo padrão
 * visual dos painéis de meta de Squad): título + atual/meta + % + barra com
 * cor dinâmica. Metas "menos é melhor" (no-show) viram badge Excelente/
 * Atenção/Crítico por consumo do limite.
 */
import { cn } from '@/lib/utils'
import { pessoaComercialNome } from '@/pages/comercial/mockLeads'
import { formatMetaValor, metricaLabel, type MetaComercial } from '@/pages/comercial/mockMetasComerciais'
import type { GoalProgress } from '@/pages/comercial/metasComerciais'
import type { StatusIdeal } from '@/pages/comercial/marketingCalculator'
import { IdealRecalculadoLinha } from './IdealRecalculadoLinha'

const barra: Record<string, string> = { success: 'bg-green-500', atencao: 'bg-orange-500', critico: 'bg-red-500' }
const texto: Record<string, string> = { success: 'text-green-300', atencao: 'text-orange-300', critico: 'text-red-300' }
const badge: Record<string, { label: string; cls: string }> = {
  success: { label: 'Excelente', cls: 'border-green-500/40 bg-green-500/10 text-green-300' },
  atencao: { label: 'Atenção', cls: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  critico: { label: 'Crítico', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
}

export function escopoLabel(meta: MetaComercial): string {
  if (meta.canal) return meta.canal
  if (meta.responsavelId) return pessoaComercialNome(meta.responsavelId)
  return 'Geral'
}

export function GoalProgressCard({
  meta,
  progress,
  idealRecalculado,
  statusIdeal,
}: {
  meta: MetaComercial
  progress: GoalProgress
  /** Ideal da etapa a partir do realizado da anterior (só Agendadas/Realizadas/Fechamentos). */
  idealRecalculado?: number
  statusIdeal?: StatusIdeal
}) {
  const larguraBar = Math.min(100, Math.max(0, progress.percentual))
  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">{metricaLabel(meta.metrica)}</p>
          <p className="text-[11px] text-muted">{escopoLabel(meta)}</p>
        </div>
        {progress.invertida ? (
          <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold', badge[progress.status].cls)}>
            {badge[progress.status].label}
          </span>
        ) : (
          <span className={cn('shrink-0 text-sm font-bold tabular-nums', texto[progress.status])}>
            {Math.round(progress.percentual)}%
          </span>
        )}
      </div>

      <div className="mb-1.5 flex items-baseline gap-1 text-xs">
        <span className="font-semibold tabular-nums text-zinc-100">{formatMetaValor(meta.metrica, progress.valorAtual)}</span>
        <span className="text-muted">/ {formatMetaValor(meta.metrica, meta.valorMeta)}</span>
        {progress.invertida && <span className="ml-1 text-[10px] text-muted">(limite)</span>}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-bg-soft/60">
        <div className={cn('h-full rounded-full transition-all', barra[progress.status])} style={{ width: `${larguraBar}%` }} />
      </div>

      {idealRecalculado != null && statusIdeal && (
        <IdealRecalculadoLinha idealRecalculado={idealRecalculado} statusIdeal={statusIdeal} realizado={progress.valorAtual} />
      )}
    </div>
  )
}
