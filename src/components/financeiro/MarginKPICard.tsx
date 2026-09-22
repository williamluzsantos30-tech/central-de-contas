/**
 * MarginKPICard — card de destaque das margens/resultados do DRE.
 * Valor grande + (opcional) badge de meta atingida/abaixo (verde/vermelho),
 * coerente com as Metas Financeiras de Configurações.
 */
import type { ReactNode } from 'react'
import { Check, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { textTone, type Tone } from '@/components/ds'

export function MarginKPICard({
  label,
  value,
  icon,
  tone = 'neutral',
  sub,
  meta,
}: {
  label: string
  value: string
  icon?: ReactNode
  tone?: Tone
  sub?: string
  /** Meta (%) + se foi atingida — mostra badge colorido. */
  meta?: { alvo: number; atingiu: boolean }
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-muted">
          {icon}
          <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
        </div>
        {meta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[10px] font-semibold',
              meta.atingiu ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-red-500/40 bg-red-500/10 text-red-300',
            )}
            title={`Meta: ${meta.alvo}%`}
          >
            {meta.atingiu ? <Check size={10} /> : <TrendingDown size={10} />}
            meta {meta.alvo}%
          </span>
        )}
      </div>
      <p className={cn('text-2xl font-bold leading-none tabular-nums', textTone[tone])}>{value}</p>
      <p className="mt-1.5 text-[10px] text-muted">{sub ?? ' '}</p>
    </div>
  )
}
