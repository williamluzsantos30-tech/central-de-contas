/**
 * LtvCacEvolutionChart — evolução do índice LTV:CAC nos últimos 12 meses
 * (SVG próprio, mesmo padrão dos demais gráficos). Linha única + linha de meta.
 */
import { useRef, useState } from 'react'

const COR = '#8b5cf6' // violet-500 (brand)
const COR_META = '#10b981'

export interface RatioPonto {
  mes: string
  ratio: number
}
interface Tip {
  i: number
  x: number
  w: number
}

function niceAxis(minV: number, maxV: number): { min: number; max: number; ticks: number[] } {
  if (!(maxV > minV)) maxV = minV + 1
  const rawStep = (maxV - minV) / 4
  const mag = 10 ** Math.floor(Math.log10(Math.abs(rawStep) || 1))
  const norm = rawStep / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const min = Math.floor(minV / step) * step
  const max = Math.ceil(maxV / step) * step
  const ticks: number[] = []
  for (let t = min; t <= max + step * 1e-6; t += step) ticks.push(Math.round(t * 10) / 10)
  return { min, max, ticks }
}

export function LtvCacEvolutionChart({ dados, meta }: { dados: RatioPonto[]; meta?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const move = (i: number) => (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setTip({ i, x: e.clientX - r.left, w: r.width })
  }
  const clear = () => setTip(null)

  const W = 720
  const H = 240
  const padL = 34
  const padR = 16
  const padT = 16
  const padB = 30
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const vals = dados.map((d) => d.ratio)
  const { min: yMin, max: yMax, ticks } = niceAxis(Math.min(0, ...vals), Math.max(4, ...vals, meta ?? 0))
  const span = Math.max(1, yMax - yMin)
  const n = Math.max(1, dados.length)
  const colW = chartW / n
  const xCentro = (i: number) => padL + colW * i + colW / 2
  const y = (v: number) => padT + chartH - ((v - yMin) / span) * chartH
  const linha = dados.map((d, i) => `${xCentro(i).toFixed(1)},${y(d.ratio).toFixed(1)}`).join(' ')

  return (
    <div className="relative" ref={ref} onMouseLeave={clear}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Evolução LTV:CAC">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + chartW} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="2 3" />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" className="fill-muted">{t}x</text>
            </g>
          ))}
          {meta != null && meta >= yMin && meta <= yMax && (
            <line x1={padL} x2={padL + chartW} y1={y(meta)} y2={y(meta)} stroke={COR_META} strokeDasharray="4 4" opacity={0.5} />
          )}
          {tip && <rect x={padL + colW * tip.i} y={padT} width={colW} height={chartH} fill="currentColor" className="text-zinc-500" opacity={0.08} />}
          <polyline points={linha} fill="none" stroke={COR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {dados.map((d, i) => (
            <g key={d.mes}>
              <circle cx={xCentro(i)} cy={y(d.ratio)} r={tip?.i === i ? 4 : 2.5} fill={COR} />
              <text x={xCentro(i)} y={H - 8} textAnchor="middle" fontSize="8" className="fill-muted">{d.mes}</text>
            </g>
          ))}
          {dados.map((d, i) => (
            <rect key={`h${d.mes}`} x={padL + colW * i} y={padT} width={colW} height={chartH} fill="transparent" style={{ cursor: 'pointer' }} onMouseEnter={move(i)} onMouseMove={move(i)} />
          ))}
        </svg>
      </div>
      {tip && dados[tip.i] && (
        <div
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-border bg-bg-elev px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{ left: tip.x, top: 8, transform: tip.x < tip.w * 0.6 ? 'translateX(14px)' : 'translateX(calc(-100% - 14px))' }}
        >
          <p className="font-semibold text-zinc-200">{dados[tip.i].mes}</p>
          <p style={{ color: COR }}>LTV:CAC {dados[tip.i].ratio.toFixed(1)}x</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded" style={{ background: COR }} /> LTV:CAC</span>
        {meta != null && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: COR_META }} /> meta {meta}x</span>}
      </div>
    </div>
  )
}
