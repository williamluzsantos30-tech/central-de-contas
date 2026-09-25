/**
 * KPICard — cartão de indicador.
 * Label (com ícone) + valor grande (cor semântica) + linha de contexto.
 * Variantes: badge de variação (seta + %) e mini sparkline inline.
 */
import { useState, type ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus, Pencil, Plus, Check, X } from 'lucide-react'
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
  /** Modo "meta": mostra meta/progresso e permite editar o alvo inline no card. */
  comMeta?: boolean
  /** Valor da meta (null = ainda não definida → botão "+ Definir meta"). */
  meta?: number | null
  /** Meta formatada pra exibição (ex.: "R$ 30.000"). */
  metaLabel?: string
  /** true = "menos é melhor" (no-show): inverte a cor da barra de progresso. */
  metaInvertida?: boolean
  /** Salva o valor da meta editado inline. */
  onSalvarMeta?: (valor: number) => void
  /** Métrica CALCULADA (metas): mostra "Planejado: X" (derivado das metas de
   *  input), sem edição. O `value` grande é o Realizado. */
  planejadoLabel?: string
  /** Conteúdo extra no pé do card (ex.: "Ideal Recalculado" nas Metas do Comercial). */
  rodape?: ReactNode
}

const BARRA: Record<string, string> = { ok: 'bg-green-500', med: 'bg-orange-500', ruim: 'bg-red-500' }
const TXT: Record<string, string> = { ok: 'text-green-300', med: 'text-orange-300', ruim: 'text-red-300' }

function metaCalc(atual: number, meta: number, invert: boolean): { pct: number; nivel: 'ok' | 'med' | 'ruim' } {
  if (invert) {
    const r = meta > 0 ? atual / meta : atual > 0 ? Infinity : 0
    return { pct: r * 100, nivel: r <= 0.7 ? 'ok' : r <= 1 ? 'med' : 'ruim' }
  }
  const pct = meta > 0 ? (atual / meta) * 100 : 0
  return { pct, nivel: pct >= 100 ? 'ok' : pct >= 50 ? 'med' : 'ruim' }
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
  comMeta,
  meta,
  metaLabel,
  metaInvertida,
  onSalvarMeta,
  planejadoLabel,
  rodape,
}: Props) {
  const temSpark = sparkline && sparkline.some((v) => v !== 0)
  const comparacao =
    !comMeta && valorAtual != null && valorAnterior != null
      ? calculatePeriodComparison(valorAtual, valorAnterior, direcaoFavoravel)
      : null

  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  function abrirEdicao() {
    setRascunho(meta != null ? String(meta) : '')
    setEditando(true)
  }
  function salvar() {
    const v = Number(rascunho)
    if (onSalvarMeta && v > 0) onSalvarMeta(v)
    setEditando(false)
  }

  const prog = comMeta && meta != null && meta > 0 && valorAtual != null ? metaCalc(valorAtual, meta, !!metaInvertida) : null

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
        {comMeta ? (
          meta != null && !editando ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              / <span className="text-zinc-300">{metaLabel}</span>
              {prog && <span className={cn('font-semibold tabular-nums', TXT[prog.nivel])}>{Math.round(prog.pct)}%</span>}
              <button onClick={abrirEdicao} className="text-muted hover:text-brand-300" title="Editar meta">
                <Pencil size={11} />
              </button>
            </span>
          ) : null
        ) : comparacao ? (
          <ComparacaoBadge c={comparacao} />
        ) : (
          delta !== undefined && delta !== null && <Delta pct={delta} invert={deltaInvert} />
        )}
      </div>

      {comMeta ? (
        editando ? (
          <div className="mt-2 flex items-center gap-1">
            <input
              type="number"
              min={0}
              autoFocus
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false) }}
              className="w-full rounded border border-border bg-bg-elev px-2 py-1 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
              placeholder="valor da meta"
            />
            <button onClick={salvar} className="rounded border border-green-500/40 bg-green-500/10 p-1 text-green-300 hover:bg-green-500/20" title="Salvar"><Check size={13} /></button>
            <button onClick={() => setEditando(false)} className="rounded border border-border p-1 text-muted hover:text-zinc-200" title="Cancelar"><X size={13} /></button>
          </div>
        ) : meta != null && prog ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-soft/60">
            <div className={cn('h-full rounded-full transition-all', BARRA[prog.nivel])} style={{ width: `${Math.min(100, Math.max(0, prog.pct))}%` }} />
          </div>
        ) : (
          <button onClick={abrirEdicao} className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-brand-300 hover:underline">
            <Plus size={11} /> Definir meta
          </button>
        )
      ) : planejadoLabel != null ? (
        <p className="mt-1.5 text-[10px] text-muted">
          Planejado: <span className="font-semibold text-brand-300">{planejadoLabel}</span>
        </p>
      ) : (
        <p className="mt-1.5 text-[10px] text-muted">{sub ?? 'vs. mês anterior'}</p>
      )}
      {rodape}
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
