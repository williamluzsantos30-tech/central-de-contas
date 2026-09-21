/**
 * KPICard — cartão de indicador.
 * Label (com ícone) + valor grande (cor semântica) + linha de contexto.
 * Variantes: badge de variação (seta + %) e mini sparkline inline.
 */
import type { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { textTone, hexTone, type Tone } from './tones'

interface Props {
  label: string
  value: string
  icon?: ReactNode
  /** Cor semântica do valor (verde=bom, vermelho=ruim…). Default neutro. */
  tone?: Tone
  /** Linha de contexto (default "vs. mês anterior"). */
  sub?: string
  /** Variação % vs período anterior — vira badge com seta. */
  delta?: number | null
  /** true = subir é ruim (churn, atraso): inverte a cor do delta. */
  deltaInvert?: boolean
  /** Série pro mini sparkline (cor = tone). */
  sparkline?: number[]
  /** Comparação automática vs. período anterior (passe o valor numérico atual…). */
  valorAtual?: number
  /** …e o do período anterior; o card calcula a variação e mostra ▲/▼ colorido. */
  valorAnterior?: number
  /** Define se aumentar é bom ('maior', default) ou ruim ('menor': CAC, no-show…). */
  direcaoFavoravel?: 'maior' | 'menor'
}

export interface PeriodComparison {
  percentual: number
  favoravel: boolean
  temDadoAnterior: boolean
}

/** Compara atual vs. anterior e diz se a variação é favorável (por direção). */
export function calculatePeriodComparison(
  valorAtual: number,
  valorAnterior: number | undefined,
  direcaoFavoravel: 'maior' | 'menor' = 'maior',
): PeriodComparison {
  if (valorAnterior == null || valorAnterior === 0) {
    return { percentual: 0, favoravel: false, temDadoAnterior: false }
  }
  const percentual = ((valorAtual - valorAnterior) / valorAnterior) * 100
  const favoravel = direcaoFavoravel === 'menor' ? valorAtual < valorAnterior : valorAtual > valorAnterior
  return { percentual, favoravel, temDadoAnterior: true }
}

export function KPICard({
  label,
  value,
  icon,
  tone = 'neutral',
  sub,
  delta,
  deltaInvert,
  sparkline,
  valorAtual,
  valorAnterior,
  direcaoFavoravel = 'maior',
}: Props) {
  const temSpark = sparkline && sparkline.some((v) => v !== 0)
  const comparacao =
    valorAtual != null && valorAnterior != null
      ? calculatePeriodComparison(valorAtual, valorAnterior, direcaoFavoravel)
      : null
  return (
    <div className="rounded-lg border border-border bg-bg-card px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-muted">
          {icon}
          <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
        </div>
        {temSpark && <Sparkline dados={sparkline!} cor={hexTone[tone]} />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className={cn('text-2xl font-bold leading-none tabular-nums', textTone[tone])}>{value}</p>
        {comparacao ? (
          <ComparacaoBadge c={comparacao} />
        ) : (
          delta !== undefined && delta !== null && <Delta pct={delta} invert={deltaInvert} />
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-muted">{sub ?? 'vs. mês anterior'}</p>
    </div>
  )
}

/** Badge de comparação com período anterior (seta por direção, cor por favor). */
function ComparacaoBadge({ c }: { c: PeriodComparison }) {
  if (!c.temDadoAnterior) {
    return (
      <span className="inline-flex items-center rounded border border-border px-1 py-0.5 text-[10px] text-muted" title="Sem dado anterior para comparar">
        —
      </span>
    )
  }
  const zero = Math.abs(c.percentual) < 0.05
  const Icon = zero ? Minus : c.percentual > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[10px] font-semibold tabular-nums',
        zero
          ? 'border-border text-muted'
          : c.favoravel
            ? 'border-green-500/40 bg-green-500/10 text-green-300'
            : 'border-red-500/40 bg-red-500/10 text-red-300',
      )}
      title="vs. período anterior"
    >
      <Icon size={10} />
      {c.percentual > 0 ? '+' : ''}
      {c.percentual.toFixed(1)}%
    </span>
  )
}

function Delta({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const up = pct > 0.0005
  const down = pct < -0.0005
  const bom = invert ? down : up
  const ruim = invert ? up : down
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[10px] font-semibold tabular-nums',
        bom
          ? 'border-green-500/40 bg-green-500/10 text-green-300'
          : ruim
            ? 'border-red-500/40 bg-red-500/10 text-red-300'
            : 'border-border text-muted',
      )}
    >
      <Icon size={10} />
      {up ? '+' : ''}
      {(pct * 100).toFixed(1)}%
    </span>
  )
}

function Sparkline({ dados, cor }: { dados: number[]; cor: string }) {
  const W = 60
  const H = 22
  const max = Math.max(1, ...dados)
  const n = dados.length
  const pts = dados
    .map((v, i) => {
      const x = n > 1 ? (W * i) / (n - 1) : W / 2
      const y = H - (v / max) * (H - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
