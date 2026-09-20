/**
 * BottleneckAlert — destaca o maior gargalo do funil (etapa com maior perda
 * e/ou maior tempo médio parado).
 */
import { AlertTriangle } from 'lucide-react'

export interface Gargalo {
  etapa: string
  perdaPct: number
  tempoMedioDias: number
}

export function BottleneckAlert({ gargalo }: { gargalo: Gargalo | null }) {
  if (!gargalo) {
    return (
      <div className="rounded-lg border border-border bg-bg-soft/30 p-3 text-xs text-muted">
        Sem gargalo relevante no período.
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-200">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <p>
        <strong>Maior gargalo: {gargalo.etapa}</strong>, com{' '}
        <strong className="tabular-nums">{gargalo.perdaPct.toFixed(0)}%</strong> de leads perdidos nesta
        etapa e tempo médio de{' '}
        <strong className="tabular-nums">{gargalo.tempoMedioDias.toFixed(1)} dias</strong>.
      </p>
    </div>
  )
}
