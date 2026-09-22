/**
 * MarginEvolutionChart — evolução de Margem Bruta % e Margem Líquida % nos
 * últimos 12 meses (SVG próprio, mesmo padrão dos gráficos de Churns/Resumo).
 * Duas linhas, linha do zero, hover com tooltip. Lida com margens negativas.
 */
import { useRef, useState } from 'react'

const COR_BRUTA = '#8b5cf6' // violet-500 (brand)
const COR_LIQUIDA = '#10b981' // emerald-500

/** Eixo com passo "nice" (~5 marcas), tolerante a ranges enormes/negativos. */
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

export interface MargemPonto {
  mes: string // label curto (ex.: "set/26")
  bruta: number // %
  liquida: number // %
}

interface Tip {
  i: number
  x: number
  y: number
  w: number
}

export function MarginEvolutionChart({ dados, metaBruta, metaLiquida }: { dados: MargemPonto[]; metaBruta?: number; metaLiquida?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const move = (i: number) => (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setTip({ i, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
  }
  const clear = () => setTip(null)

  const W = 720
  const H = 260
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 30
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const vals = dados.flatMap((d) => [d.bruta, d.liquida])
  // Escala "nice" com ~5 marcas — margens podem estourar (ex.: custos >>
  // receita), então o passo se adapta em vez de ser fixo em 20% (senão o
  // eixo vira centenas de labels sobrepostos).
  const { min: yMin, max: yMax, ticks } = niceAxis(Math.min(0, ...vals), Math.max(10, ...vals, metaBruta ?? 0))
  const span = Math.max(1, yMax - yMin)
  const n = Math.max(1, dados.length)
  const colW = chartW / n
  const xCentro = (i: number) => padL + colW * i + colW / 2
  const y = (v: number) => padT + chartH - ((v - yMin) / span) * chartH

  const linha = (key: 'bruta' | 'liquida') => dados.map((d, i) => `${xCentro(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')

  return (
    <div className="relative" ref={ref} onMouseLeave={clear}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Evolução de margens">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + chartW} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-zinc-500' : 'stroke-border'} strokeDasharray={t === 0 ? undefined : '2 3'} opacity={t === 0 ? 0.5 : 1} />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" className="fill-muted">{t}%</text>
            </g>
          ))}
          {/* linhas de meta (tracejado sutil) */}
          {metaBruta != null && metaBruta >= yMin && metaBruta <= yMax && (
            <line x1={padL} x2={padL + chartW} y1={y(metaBruta)} y2={y(metaBruta)} stroke={COR_BRUTA} strokeDasharray="4 4" opacity={0.35} />
          )}
          {tip && <rect x={padL + colW * tip.i} y={padT} width={colW} height={chartH} fill="currentColor" className="text-zinc-500" opacity={0.08} />}
          <polyline points={linha('bruta')} fill="none" stroke={COR_BRUTA} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={linha('liquida')} fill="none" stroke={COR_LIQUIDA} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {dados.map((d, i) => (
            <g key={d.mes}>
              <circle cx={xCentro(i)} cy={y(d.bruta)} r={tip?.i === i ? 4 : 2.5} fill={COR_BRUTA} />
              <circle cx={xCentro(i)} cy={y(d.liquida)} r={tip?.i === i ? 4 : 2.5} fill={COR_LIQUIDA} />
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
          <p className="mb-1 font-semibold text-zinc-200">{dados[tip.i].mes}</p>
          <p className="flex items-center gap-1.5" style={{ color: COR_BRUTA }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COR_BRUTA }} /> Bruta: {dados[tip.i].bruta.toFixed(1)}%
          </p>
          <p className="flex items-center gap-1.5" style={{ color: COR_LIQUIDA }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COR_LIQUIDA }} /> Líquida: {dados[tip.i].liquida.toFixed(1)}%
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded" style={{ background: COR_BRUTA }} /> Margem Bruta</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded" style={{ background: COR_LIQUIDA }} /> Margem Líquida</span>
        {(metaBruta != null || metaLiquida != null) && <span className="text-muted/70">metas: bruta {metaBruta ?? '—'}% · líquida {metaLiquida ?? '—'}%</span>}
      </div>
    </div>
  )
}
