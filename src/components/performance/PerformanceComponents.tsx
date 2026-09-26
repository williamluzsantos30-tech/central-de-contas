/**
 * Peças da tela Performance da Equipe: legenda das métricas por cargo, card
 * do ranking, grupo por cargo, badge de score e o hook das faixas de cor.
 */
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ds'
import {
  EVENTO_FAIXAS_PERFORMANCE,
  lerFaixasPerformance,
  nivelDoScore,
  type FaixasPerformance,
  type NivelScore,
} from '@/lib/metasPerformance'
import {
  METRICA_POR_CARGO,
  ORDEM_CARGOS,
  type CargoPerformance,
  type PerformanceColaborador,
} from '@/pages/operacional/performanceCalculator'

/** Faixas de cor (Configurações › Geral › Metas de Performance), ao vivo. */
export function useFaixasPerformance(): FaixasPerformance {
  const [f, setF] = useState(lerFaixasPerformance)
  useEffect(() => {
    const reler = () => setF(lerFaixasPerformance())
    window.addEventListener(EVENTO_FAIXAS_PERFORMANCE, reler)
    return () => window.removeEventListener(EVENTO_FAIXAS_PERFORMANCE, reler)
  }, [])
  return f
}

const NIVEL: Record<NivelScore, { badge: string; bar: string; texto: string }> = {
  bom: { badge: 'border-green-500/40 bg-green-500/10 text-green-300', bar: 'bg-green-500', texto: 'text-green-300' },
  medio: { badge: 'border-orange-500/40 bg-orange-500/10 text-orange-300', bar: 'bg-orange-500', texto: 'text-orange-300' },
  ruim: { badge: 'border-red-500/40 bg-red-500/10 text-red-300', bar: 'bg-red-500', texto: 'text-red-300' },
}

export function classesDoNivel(pct: number, f: FaixasPerformance) {
  return NIVEL[nivelDoScore(pct, f)]
}

/** Score grande com cor semântica. */
export function ScoreBadge({ pct, faixas, tamanho = 'lg' }: { pct: number; faixas: FaixasPerformance; tamanho?: 'lg' | 'sm' }) {
  const c = classesDoNivel(pct, faixas)
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg border font-bold tabular-nums',
        c.badge,
        tamanho === 'lg' ? 'min-w-[64px] px-2.5 py-1 text-lg' : 'min-w-[44px] px-1.5 py-0.5 text-xs',
      )}
    >
      {pct}%
    </span>
  )
}

/** Legenda compacta: qual métrica vale 100% do score de cada cargo. */
export function PerformanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 rounded-lg border border-border bg-bg-card px-3 py-2 text-[11px] text-muted">
      <span className="mr-1 font-semibold uppercase tracking-wider text-[10px]">Score = 100% de</span>
      {ORDEM_CARGOS.map((c, i) => (
        <span key={c} className="inline-flex items-center">
          {i > 0 && <span className="mx-1.5 opacity-40">·</span>}
          <span className="text-zinc-200">{METRICA_POR_CARGO[c].cargo}:</span>
          <span className="ml-1">{METRICA_POR_CARGO[c].curta}</span>
        </span>
      ))}
    </div>
  )
}

/** Card do Ranking Geral. E-mail/identificador SEMPRE visível (nomes repetidos). */
export function PerformanceRankingCard({
  p,
  posicao,
  faixas,
}: {
  p: PerformanceColaborador
  posicao: number
  faixas: FaixasPerformance
}) {
  const score = p.scorePercentual ?? 0
  const c = classesDoNivel(score, faixas)
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-bg-card px-3 py-3 sm:grid-cols-[28px_minmax(0,1.3fr)_minmax(0,1.5fr)_auto]">
      <span
        className={cn(
          'grid h-7 w-7 place-items-center rounded-full text-xs font-bold tabular-nums',
          posicao === 1 ? 'bg-brand-500/20 text-brand-200 ring-1 ring-brand-500/50' : 'bg-bg-elev text-muted',
        )}
      >
        {posicao}
      </span>

      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={p.colaborador.nome} url={p.colaborador.avatarUrl} size="md" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-zinc-100">{p.colaborador.nome}</p>
            <Badge tone="neutral">{METRICA_POR_CARGO[p.cargo].cargo}</Badge>
          </div>
          <p className="truncate text-[11px] text-muted" title={p.colaborador.identificador}>
            {p.colaborador.identificador}
          </p>
        </div>
      </div>

      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="truncate text-xs font-medium text-zinc-200">{p.resumo}</p>
        <p className="truncate text-[10px] text-muted" title={p.detalheTexto}>
          {p.detalheTexto}
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-elev">
          <div className={cn('h-full rounded-full', c.bar)} style={{ width: `${Math.max(2, score)}%` }} />
        </div>
      </div>

      <div className="col-span-2 flex justify-end sm:col-span-1">
        <ScoreBadge pct={score} faixas={faixas} />
      </div>
    </li>
  )
}

/** Grupo "Performance por cargo": média do cargo + métrica usada + pessoas. */
export function CargoPerformanceGroup({
  cargo,
  pessoas,
  faixas,
}: {
  cargo: CargoPerformance
  pessoas: PerformanceColaborador[]
  faixas: FaixasPerformance
}) {
  const comScore = pessoas.filter((p) => p.scorePercentual != null)
  const media = comScore.length ? Math.round(comScore.reduce((s, p) => s + (p.scorePercentual ?? 0), 0) / comScore.length) : null
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">{METRICA_POR_CARGO[cargo].cargo}</p>
          <p className="text-[11px] text-muted">
            Score baseado em: <span className="text-zinc-300">{METRICA_POR_CARGO[cargo].metrica}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          {media != null ? <ScoreBadge pct={media} faixas={faixas} tamanho="sm" /> : <span className="text-[11px] text-muted">—</span>}
          <p className="mt-0.5 text-[10px] text-muted">média · {pessoas.length} pessoa{pessoas.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {pessoas.map((p) => (
          <li key={p.colaboradorId} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-zinc-200">{p.colaborador.nome}</span>
              <span className="block truncate text-[10px] text-muted">{p.resumo}</span>
            </span>
            {p.scorePercentual != null ? (
              <>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-elev">
                  <span
                    className={cn('block h-full rounded-full', classesDoNivel(p.scorePercentual, faixas).bar)}
                    style={{ width: `${Math.max(2, p.scorePercentual)}%` }}
                  />
                </span>
                <span className={cn('w-10 text-right font-semibold tabular-nums', classesDoNivel(p.scorePercentual, faixas).texto)}>
                  {p.scorePercentual}%
                </span>
              </>
            ) : (
              <span className="w-[7.5rem] text-right text-[10px] text-muted">sem dados</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
