/**
 * AlertCard — cartão de contagem com severidade (ex.: "Vencendo em 7 dias").
 * Ícone em tile + número + rótulo. A cor da severidade SÓ aparece quando há
 * algo a fazer: valor 0 (ou `ativo={false}`) renderiza neutro — "0 vencidos"
 * não é alarme.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { badgeTone, textTone, type Tone } from './tones'

const CARD_TONE: Record<Tone, string> = {
  neutral: '',
  success: 'border-green-500/40 bg-green-500/[0.05]',
  danger: 'border-red-500/40 bg-red-500/[0.06]',
  warning: 'border-orange-500/40 bg-orange-500/[0.06]',
  attention: 'border-yellow-500/40 bg-yellow-500/[0.06]',
  info: 'border-blue-500/40 bg-blue-500/[0.05]',
  accent: 'border-brand-500/40 bg-brand-500/[0.06]',
  purple: 'border-purple-500/40 bg-purple-500/[0.05]',
}

export function AlertCard({
  icon,
  valor,
  label,
  tone,
  ativo,
  onClick,
}: {
  icon: ReactNode
  valor: number | string
  label: string
  tone: Tone
  /** Força o estado; padrão = valor numérico > 0. */
  ativo?: boolean
  onClick?: () => void
}) {
  const aceso = ativo ?? (typeof valor === 'number' ? valor > 0 : true)
  const t: Tone = aceso ? tone : 'neutral'
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-bg-card p-4 transition-colors',
        CARD_TONE[t],
        onClick && 'cursor-pointer hover:border-brand-500/40',
      )}
    >
      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', aceso ? badgeTone[tone] : 'border-border bg-bg-elev text-muted')}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cn('text-2xl font-bold leading-none tabular-nums', aceso ? textTone[tone] : 'text-zinc-100')}>{valor}</p>
        <p className="mt-1 truncate text-[11px] text-muted">{label}</p>
      </div>
    </div>
  )
}
