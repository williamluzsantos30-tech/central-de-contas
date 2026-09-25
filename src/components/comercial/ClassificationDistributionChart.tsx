/**
 * ClassificationDistributionChart — Funil Tráfego, bloco 2: distribuição dos
 * leads do período por classificação A/B/C (vinda do CRM). Donut no padrão do
 * LossReasonsChart + um card por classe.
 */
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ClassificacaoLead } from '@/pages/comercial/mockLeads'
import { CLASSIFICACOES, type DistribuicaoClassificacao } from '@/pages/comercial/trafficFunnelCalculator'
import { COR_CLASSE, TEXTO_CLASSE } from './classificacaoCores'

function pol(cx: number, cy: number, r: number, aDeg: number): [number, number] {
  const a = ((aDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
function arco(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number): string {
  const [x0o, y0o] = pol(cx, cy, rO, a0)
  const [x1o, y1o] = pol(cx, cy, rO, a1)
  const [x1i, y1i] = pol(cx, cy, rI, a1)
  const [x0i, y0i] = pol(cx, cy, rI, a0)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${x0o} ${y0o} A${rO} ${rO} 0 ${large} 1 ${x1o} ${y1o} L${x1i} ${y1i} A${rI} ${rI} 0 ${large} 0 ${x0i} ${y0i} Z`
}

export function ClassificationDistributionChart({ dist }: { dist: DistribuicaoClassificacao }) {
  const [hover, setHover] = useState<ClassificacaoLead | null>(null)
  const fatias = useMemo(() => {
    let ang = 0
    return CLASSIFICACOES.filter((c) => dist[c] > 0).map((c) => {
      const a0 = ang
      // Fatia única = círculo quase completo (arco SVG não fecha 360°).
      const a1 = ang + Math.min(359.99, (dist[c] / dist.classificados) * 360)
      ang = a1
      return { classe: c, a0, a1 }
    })
  }, [dist])

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Distribuição A/B/C</h3>
      <p className="mt-0.5 text-[11px] text-muted">Classificação que chega pronta do CRM, sobre os leads que entraram no período.</p>

      {dist.classificados === 0 ? (
        <p className="py-10 text-center text-xs text-muted">
          Nenhum lead classificado no período.
          {dist.total > 0 && ' Confira o mapeamento do campo "Classificação" em Configurações › Integrações.'}
        </p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row" onMouseLeave={() => setHover(null)}>
          <svg viewBox="0 0 180 180" width="150" height="150" className="shrink-0" role="img" aria-label="Distribuição por classificação">
            {fatias.map((f) => {
              const on = hover === f.classe
              return (
                <path
                  key={f.classe}
                  d={arco(90, 90, on ? 82 : 78, 48, f.a0, fatias.length > 1 ? f.a1 - 0.6 : f.a1)}
                  fill={COR_CLASSE[f.classe]}
                  opacity={hover != null && !on ? 0.45 : 0.92}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(f.classe)}
                />
              )
            })}
            <text x="90" y="86" textAnchor="middle" fontSize="22" fontWeight="700" className="fill-current text-zinc-100">
              {hover ? dist[hover] : dist.classificados}
            </text>
            <text x="90" y="102" textAnchor="middle" fontSize="9" className="fill-muted">
              {hover ? `lead ${hover}` : 'classificados'}
            </text>
          </svg>

          <div className="grid w-full flex-1 grid-cols-3 gap-2">
            {CLASSIFICACOES.map((c) => (
              <div
                key={c}
                onMouseEnter={() => setHover(c)}
                className={cn('rounded-lg border border-border bg-bg-soft/30 p-3 transition-colors', hover === c && 'bg-bg-elev')}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_CLASSE[c] }} /> Lead {c}
                </div>
                <p className={cn('mt-1 text-2xl font-bold tabular-nums', TEXTO_CLASSE[c])}>{dist[c]}</p>
                <p className="text-[11px] tabular-nums text-muted">{dist.pct[c].toFixed(0)}% dos classificados</p>
              </div>
            ))}
            {dist.semClassificacao > 0 && (
              <p className="col-span-3 text-[11px] text-muted">
                + {dist.semClassificacao} lead(s) sem classificação no CRM (fora do gráfico).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
