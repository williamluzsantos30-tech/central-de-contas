/**
 * LossReasonsChart — donut de motivos de perda (motivoPerda +
 * motivoDesqualificacao agregados), mesmo padrão visual do donut de
 * "Distribuição por Motivo" dos Churns.
 */
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

const PALETA = ['#7c3aed', '#3b82f6', '#f97316', '#dc2626', '#22c55e', '#a855f7', '#eab308', '#06b6d4']

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

export function LossReasonsChart({ dados }: { dados: { motivo: string; qtd: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = useMemo(() => dados.reduce((s, d) => s + d.qtd, 0), [dados])
  const fatias = useMemo(() => {
    let ang = 0
    return dados.map((d, i) => {
      const frac = total > 0 ? d.qtd / total : 0
      const a0 = ang
      const a1 = ang + frac * 360
      ang = a1
      return { ...d, a0, a1, pct: frac, cor: PALETA[i % PALETA.length] }
    })
  }, [dados, total])

  if (total === 0) return <p className="py-10 text-center text-xs text-muted">Sem perdas no período.</p>

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row" onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 180 180" width="150" height="150" className="shrink-0" role="img" aria-label="Motivos de perda">
        {fatias.map((f, i) => {
          const on = hover === i
          return (
            <path
              key={f.motivo}
              d={arco(90, 90, on ? 82 : 78, 48, f.a0, f.a1 - 0.6)}
              fill={f.cor}
              opacity={hover != null && !on ? 0.5 : 0.92}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
            />
          )
        })}
        <text x="90" y="86" textAnchor="middle" fontSize="22" fontWeight="700" className="fill-current text-zinc-100">
          {hover != null && fatias[hover] ? fatias[hover].qtd : total}
        </text>
        <text x="90" y="102" textAnchor="middle" fontSize="9" className="fill-muted">perdas</text>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {fatias.map((f, i) => (
          <li
            key={f.motivo}
            className={cn('flex items-center justify-between gap-3 rounded px-1 py-0.5 text-[11px] transition-colors', hover === i && 'bg-bg-elev')}
            onMouseEnter={() => setHover(i)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
              <span className="truncate text-zinc-300">{f.motivo}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              {f.qtd} · {(f.pct * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
