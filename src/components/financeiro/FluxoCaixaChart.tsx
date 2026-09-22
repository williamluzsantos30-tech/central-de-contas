/**
 * FluxoCaixaChart — 12 meses: barras de Entradas (verde) e Saídas (vermelho)
 * no eixo esquerdo (R$) + linha de Saldo acumulado no eixo direito (R$, pode
 * ser negativo). SVG próprio, mesmo padrão dos demais gráficos.
 */
import { useRef, useState } from 'react'

const COR_ENTRADA = '#10b981'
const COR_SAIDA = '#ef4444'
const COR_SALDO = '#8b5cf6'

export interface FluxoPonto {
  mes: string
  entradas: number
  saidas: number
  saldo: number
}
interface Tip {
  i: number
  x: number
  w: number
}

function fmtK(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return `${v < 0 ? '-' : ''}R$${Math.round(a / 1000)}k`
  return `${v < 0 ? '-' : ''}R$${Math.round(a)}`
}
function niceMax(v: number): { max: number; ticks: number[] } {
  if (v <= 0) return { max: 1, ticks: [0, 1] }
  const s = v / 4
  const mag = 10 ** Math.floor(Math.log10(s))
  const norm = s / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const max = Math.ceil(v / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= max + step * 1e-6; t += step) ticks.push(t)
  return { max, ticks }
}
/** Escala simétrica/nice pro saldo (pode ser negativo). */
function niceRange(minV: number, maxV: number): { min: number; max: number; ticks: number[] } {
  if (!(maxV > minV)) maxV = minV + 1
  const step0 = (maxV - minV) / 4
  const mag = 10 ** Math.floor(Math.log10(Math.abs(step0) || 1))
  const norm = step0 / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const min = Math.floor(minV / step) * step
  const max = Math.ceil(maxV / step) * step
  const ticks: number[] = []
  for (let t = min; t <= max + step * 1e-6; t += step) ticks.push(t)
  return { min, max, ticks }
}

export function FluxoCaixaChart({ dados }: { dados: FluxoPonto[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const move = (i: number) => (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setTip({ i, x: e.clientX - r.left, w: r.width })
  }
  const clear = () => setTip(null)

  const W = 760
  const H = 280
  const padL = 44
  const padR = 50
  const padT = 16
  const padB = 32
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const barMax = niceMax(Math.max(1, ...dados.flatMap((d) => [d.entradas, d.saidas])))
  const saldoSc = niceRange(Math.min(0, ...dados.map((d) => d.saldo)), Math.max(1, ...dados.map((d) => d.saldo)))
  const saldoSpan = Math.max(1, saldoSc.max - saldoSc.min)
  const n = Math.max(1, dados.length)
  const colW = chartW / n
  const barW = colW * 0.28
  const xCentro = (i: number) => padL + colW * i + colW / 2
  const yBar = (v: number) => padT + chartH - (v / barMax.max) * chartH
  const ySaldo = (v: number) => padT + chartH - ((v - saldoSc.min) / saldoSpan) * chartH
  const linhaSaldo = dados.map((d, i) => `${xCentro(i).toFixed(1)},${ySaldo(d.saldo).toFixed(1)}`).join(' ')

  return (
    <div className="relative" ref={ref} onMouseLeave={clear}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" role="img" aria-label="Fluxo de caixa">
          {barMax.ticks.map((t) => (
            <g key={`l${t}`}>
              <line x1={padL} x2={padL + chartW} y1={yBar(t)} y2={yBar(t)} className="stroke-border" strokeDasharray="2 3" />
              <text x={padL - 6} y={yBar(t) + 3} textAnchor="end" fontSize="9" className="fill-muted">{fmtK(t)}</text>
            </g>
          ))}
          {saldoSc.ticks.map((t) => (
            <text key={`r${t}`} x={padL + chartW + 6} y={ySaldo(t) + 3} textAnchor="start" fontSize="9" fill={COR_SALDO} opacity={0.85}>{fmtK(t)}</text>
          ))}
          {tip && <rect x={padL + colW * tip.i} y={padT} width={colW} height={chartH} fill="currentColor" className="text-zinc-500" opacity={0.08} />}
          {/* linha do zero do saldo, se dentro do range */}
          {saldoSc.min < 0 && saldoSc.max > 0 && <line x1={padL} x2={padL + chartW} y1={ySaldo(0)} y2={ySaldo(0)} className="stroke-zinc-500" opacity={0.4} />}
          {dados.map((d, i) => {
            const hE = (d.entradas / barMax.max) * chartH
            const hS = (d.saidas / barMax.max) * chartH
            return (
              <g key={d.mes}>
                {d.entradas > 0 && <rect x={xCentro(i) - barW - 1} y={padT + chartH - hE} width={barW} height={hE} rx="2" fill={COR_ENTRADA} opacity={0.85} />}
                {d.saidas > 0 && <rect x={xCentro(i) + 1} y={padT + chartH - hS} width={barW} height={hS} rx="2" fill={COR_SAIDA} opacity={0.85} />}
                <text x={xCentro(i)} y={H - 8} textAnchor="middle" fontSize="8" className="fill-muted">{d.mes}</text>
              </g>
            )
          })}
          <polyline points={linhaSaldo} fill="none" stroke={COR_SALDO} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {dados.map((d, i) => (
            <circle key={`p${d.mes}`} cx={xCentro(i)} cy={ySaldo(d.saldo)} r={tip?.i === i ? 4 : 2.5} fill={COR_SALDO} />
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
          <p style={{ color: COR_ENTRADA }}>Entradas: {fmtK(dados[tip.i].entradas)}</p>
          <p style={{ color: COR_SAIDA }}>Saídas: {fmtK(dados[tip.i].saidas)}</p>
          <p style={{ color: COR_SALDO }}>Saldo: {fmtK(dados[tip.i].saldo)}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_ENTRADA }} /> Entradas</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_SAIDA }} /> Saídas</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded" style={{ background: COR_SALDO }} /> Saldo acumulado</span>
      </div>
    </div>
  )
}
