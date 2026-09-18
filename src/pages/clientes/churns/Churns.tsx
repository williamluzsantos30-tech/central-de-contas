/**
 * Clientes Churns — dashboard analítico de cancelamentos.
 *
 * Ligado ao registro REAL de churn: quando a equipe registra um churn na
 * Ficha do cliente ("Registrar Perda" → Churn), grava-se um evento
 * (cliente_eventos tipo='churn') e o cliente vira status='churn'. Este
 * painel lê e agrega esses registros (ver ./useChurnsData.ts).
 *
 * Gráficos em SVG próprio (mesmo padrão da Visão Executiva) — sem lib
 * externa, temáticos (light/dark via tokens), com tooltip no hover.
 */
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  Download,
  UserMinus,
  DollarSign,
  Percent,
  Clock,
  Ticket,
  Search,
  Eye,
} from 'lucide-react'
import { PageHeader, KPICard, FilterBar, FilterPill, OutlineButton } from '@/components/ds'
import { cn } from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { useChurnsData, type ClienteChurn } from './useChurnsData'

// ---- cores de série (data viz; sem laranja por preferência) ----
const COR_CHURN = '#ef4444' // red-500
const COR_MRR = '#fbbf24' // amber-400 (dourado, no lugar do laranja do mock)
const COR_TEMPO = '#8b5cf6' // violet-500 (brand)
const COR_BASE = '#10b981' // emerald-500
const PALETA_MOTIVO = ['#ef4444', '#8b5cf6', '#fbbf24', '#38bdf8', '#10b981', '#ec4899', '#a1a1aa']

// ---- formatação ----
function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function formatBRLk(v: number): string {
  if (v >= 1000) return `R$${Math.round(v / 1000)}k`
  return `R$${Math.round(v)}`
}
function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

/** Nice numbers pro eixo, ciente de magnitude (contagem ou R$). */
function niceScale(maxValor: number): { max: number; ticks: number[] } {
  if (maxValor <= 0) return { max: 1, ticks: [0, 1] }
  const alvo = 4
  const s = maxValor / alvo
  const mag = 10 ** Math.floor(Math.log10(s))
  const norm = s / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  const step = Math.max(1, nice * mag)
  const max = Math.ceil(maxValor / step - 1e-9) * step
  const ticks: number[] = []
  for (let i = 0; i * step <= max + 1e-9; i++) ticks.push(Math.round(i * step * 1e6) / 1e6)
  return { max, ticks }
}

// ============================================================
// Tooltip de hover — compartilhado por todos os gráficos
// ============================================================
interface TipState {
  i: number
  x: number
  y: number
  w: number
}
function useChartTip() {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)
  const move = (i: number) => (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setTip({ i, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
  }
  const clear = () => setTip(null)
  return { ref, tip, move, clear }
}

function TipBox({ tip, children }: { tip: TipState; children: React.ReactNode }) {
  const direita = tip.x < tip.w * 0.6
  return (
    <div
      className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-border bg-bg-elev px-2.5 py-1.5 text-[11px] shadow-xl"
      style={{
        left: tip.x,
        top: tip.y,
        transform: direita ? 'translate(14px, -50%)' : 'translate(calc(-100% - 14px), -50%)',
      }}
    >
      {children}
    </div>
  )
}

type Pico = { value: string; label: string }
const PERIODOS: Pico[] = [
  { value: '', label: 'Todos os períodos' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '3m', label: 'Últimos 3 meses' },
]

export default function Churns() {
  const d = useChurnsData()
  // Fonte única de squads (tabela central) — filtro lista só squads ativos.
  const { squads: squadsReais } = useSquads()

  // Filtros — visuais por enquanto (agregados são globais). Wire p/ API depois.
  const [fPeriodo, setFPeriodo] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fAM, setFAM] = useState('')
  const [fGestor, setFGestor] = useState('')

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <span>Clientes</span>
        <ChevronDown size={11} className="-rotate-90" />
        <span className="text-zinc-300">Churns</span>
      </nav>

      <PageHeader
        title="Clientes Churns"
        description="Dashboard analítico de cancelamentos"
        actions={
          <OutlineButton onClick={() => window.print()}>
            <Download size={14} /> Exportar
          </OutlineButton>
        }
      />

      {d.loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : (
        <>
          {d.vazio && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/[0.06] px-4 py-3 text-[12px] text-sky-200">
              <UserMinus size={14} className="text-sky-300" />
              <span>
                Nenhum churn registrado ainda. Ao registrar um churn na Ficha do cliente
                (<strong>Registrar Perda → Churn</strong>), ele aparece aqui automaticamente.
              </span>
            </div>
          )}

          {/* KPIs — perdas em vermelho (cor semântica do DS) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KPICard icon={<UserMinus size={13} className="text-red-400" />} label="Total Churns" value={String(d.kpis.totalChurns)} tone="danger" sparkline={d.tendencia.map((t) => t.qtd)} sub="no período" />
            <KPICard icon={<DollarSign size={13} className="text-red-400" />} label="MRR Perdido" value={formatBRL(d.kpis.mrrPerdido)} tone="danger" sub="acumulado" />
            <KPICard icon={<DollarSign size={13} className="text-red-400" />} label="MRR Mês Atual" value={formatBRL(d.kpis.mrrMesAtual)} tone="danger" delta={d.kpis.mrrMesAtualDeltaPct} deltaInvert sub="vs. mês anterior" />
            <KPICard icon={<Percent size={13} className="text-red-400" />} label="Churn Rate" value={formatPct(d.kpis.churnRate)} tone="danger" sub="da base já cancelou" />
            <KPICard icon={<Clock size={13} className="text-brand-300" />} label="Tempo Médio Casa" value={`${d.kpis.tempoMedioCasaMeses}m`} sub="até o churn" />
            <KPICard icon={<Ticket size={13} className="text-brand-300" />} label="Ticket Médio Churn" value={formatBRL(d.kpis.ticketMedioChurn)} sub={`Ativos: ${formatBRL(d.kpis.ticketMedioAtivo)}`} />
          </div>

          {/* Filtros */}
          <FilterBar className="mt-4">
            <FilterPill value={fPeriodo} onChange={setFPeriodo} options={PERIODOS} />
            <FilterPill value={fSquad} onChange={setFSquad} placeholder="Todos os Squads" options={squadsReais.map((s) => ({ value: s.nome, label: s.nome }))} />
            <FilterPill value={fAM} onChange={setFAM} placeholder="Todos os AMs" options={[]} />
            <FilterPill value={fGestor} onChange={setFGestor} placeholder="Todos os Gestores" options={[]} />
          </FilterBar>

          {/* Grid de gráficos */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Tendência de Churns (12 meses)">
              <TendenciaChart dados={d.tendencia} />
            </ChartCard>
            <ChartCard title="Distribuição por Motivo">
              <MotivoDonut dados={d.porMotivo} />
            </ChartCard>
            <ChartCard title="Churns por Squad">
              <BarrasHorizontais dados={d.porSquad.map((s) => ({ label: s.squad, valor: s.qtd }))} cor={COR_CHURN} />
            </ChartCard>
            <ChartCard title="Distribuição por Tempo de Casa">
              <BarrasVerticais dados={d.porTempoCasa.map((f) => ({ label: f.faixa, valor: f.qtd }))} cor={COR_TEMPO} />
            </ChartCard>
          </div>

          <div className="mt-4">
            <ChartCard title="Ticket Médio: Churns vs Base Ativa">
              <TicketComparativo churns={d.ticket.churns} baseAtiva={d.ticket.baseAtiva} />
            </ChartCard>
          </div>

          {/* Tabela de clientes churnados */}
          <div className="mt-4">
            <TabelaChurns clientes={d.clientes} />
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// Card wrapper de gráfico
// ============================================================
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-zinc-100">{title}</h3>
      {children}
    </div>
  )
}

// ============================================================
// 1) Tendência — barras (qtd) + linha (MRR), eixo duplo + hover
// ============================================================
function TendenciaChart({ dados }: { dados: { mes: string; qtd: number; mrr: number }[] }) {
  const { ref, tip, move, clear } = useChartTip()
  const W = 640
  const H = 260
  const padL = 34
  const padR = 44
  const padT = 14
  const padB = 34
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const escQtd = niceScale(Math.max(1, ...dados.map((d) => d.qtd)))
  const escMrr = niceScale(Math.max(1, ...dados.map((d) => d.mrr)))
  const n = Math.max(1, dados.length)
  const colW = chartW / n
  const barW = colW * 0.5

  const xCentro = (i: number) => padL + colW * i + colW / 2
  const yQtd = (v: number) => padT + chartH - (v / escQtd.max) * chartH
  const yMrr = (v: number) => padT + chartH - (v / escMrr.max) * chartH

  const linha = dados.map((d, i) => `${xCentro(i).toFixed(1)},${yMrr(d.mrr).toFixed(1)}`).join(' ')

  return (
    <div className="relative" ref={ref} onMouseLeave={clear}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Tendência de churns">
          {escQtd.ticks.map((t) => (
            <g key={`q${t}`}>
              <line x1={padL} x2={padL + chartW} y1={yQtd(t)} y2={yQtd(t)} className="stroke-border" strokeDasharray="2 3" />
              <text x={padL - 6} y={yQtd(t) + 3} textAnchor="end" fontSize="9" className="fill-muted">
                {t}
              </text>
            </g>
          ))}
          {escMrr.ticks.map((t) => (
            <text key={`m${t}`} x={padL + chartW + 6} y={yMrr(t) + 3} textAnchor="start" fontSize="9" fill={COR_MRR} opacity={0.85}>
              {formatBRLk(t)}
            </text>
          ))}
          {tip && (
            <rect x={padL + colW * tip.i} y={padT} width={colW} height={chartH} fill="currentColor" className="text-zinc-500" opacity={0.08} />
          )}
          {dados.map((d, i) => {
            const h = (d.qtd / escQtd.max) * chartH
            return (
              <g key={d.mes}>
                {d.qtd > 0 && (
                  <rect x={xCentro(i) - barW / 2} y={padT + chartH - h} width={barW} height={h} rx="2" fill={COR_CHURN} opacity={0.85} />
                )}
                <text x={xCentro(i)} y={H - 8} textAnchor="middle" fontSize="8" className="fill-muted">
                  {d.mes}
                </text>
              </g>
            )
          })}
          <polyline points={linha} fill="none" stroke={COR_MRR} strokeWidth="2" strokeLinejoin="round" />
          {dados.map((d, i) => (
            <circle key={`p${d.mes}`} cx={xCentro(i)} cy={yMrr(d.mrr)} r={tip?.i === i ? 4 : 2.5} fill={COR_MRR} />
          ))}
          {dados.map((d, i) => (
            <rect
              key={`h${d.mes}`}
              x={padL + colW * i}
              y={padT}
              width={colW}
              height={chartH}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={move(i)}
              onMouseMove={move(i)}
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_CHURN }} /> Qtd de churns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded" style={{ background: COR_MRR }} /> MRR perdido
        </span>
      </div>
      {tip && dados[tip.i] && (
        <TipBox tip={tip}>
          <p className="font-semibold text-zinc-100">{dados[tip.i].mes}</p>
          <p style={{ color: COR_CHURN }}>Churns: {dados[tip.i].qtd}</p>
          <p style={{ color: COR_MRR }}>MRR Perdido: {formatBRL(dados[tip.i].mrr)}</p>
        </TipBox>
      )}
    </div>
  )
}

// ============================================================
// 2) Distribuição por motivo — donut + legenda + hover
// ============================================================
function pol(cx: number, cy: number, r: number, aDeg: number): [number, number] {
  const a = ((aDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
function arcoDonut(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number): string {
  const [x0o, y0o] = pol(cx, cy, rO, a0)
  const [x1o, y1o] = pol(cx, cy, rO, a1)
  const [x1i, y1i] = pol(cx, cy, rI, a1)
  const [x0i, y0i] = pol(cx, cy, rI, a0)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${x0o} ${y0o} A${rO} ${rO} 0 ${large} 1 ${x1o} ${y1o} L${x1i} ${y1i} A${rI} ${rI} 0 ${large} 0 ${x0i} ${y0i} Z`
}

function MotivoDonut({ dados }: { dados: { motivo: string; qtd: number }[] }) {
  const { ref, tip, move, clear } = useChartTip()
  const total = useMemo(() => dados.reduce((s, m) => s + m.qtd, 0), [dados])
  const fatias = useMemo(() => {
    let ang = 0
    return dados.map((m, i) => {
      const frac = total > 0 ? m.qtd / total : 0
      const a0 = ang
      const a1 = ang + frac * 360
      ang = a1
      return { ...m, a0, a1, pct: frac, cor: PALETA_MOTIVO[i % PALETA_MOTIVO.length] }
    })
  }, [dados, total])

  if (total === 0) {
    return <p className="py-12 text-center text-xs text-muted">Sem churns no período.</p>
  }

  return (
    <div className="relative flex flex-col items-center gap-5 sm:flex-row" ref={ref} onMouseLeave={clear}>
      <svg viewBox="0 0 180 180" width="160" height="160" className="shrink-0" role="img" aria-label="Distribuição por motivo">
        {fatias.map((f, i) => {
          const hovered = tip?.i === i
          return (
            <path
              key={f.motivo}
              d={arcoDonut(90, 90, hovered ? 82 : 78, 48, f.a0, f.a1 - 0.6)}
              fill={f.cor}
              opacity={tip && !hovered ? 0.5 : 0.92}
              style={{ cursor: 'pointer' }}
              onMouseEnter={move(i)}
              onMouseMove={move(i)}
            />
          )
        })}
        <text x="90" y="86" textAnchor="middle" fontSize="22" fontWeight="700" className="fill-zinc-100">
          {tip && fatias[tip.i] ? fatias[tip.i].qtd : total}
        </text>
        <text x="90" y="102" textAnchor="middle" fontSize="9" className="fill-muted">
          churns
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {fatias.map((f, i) => (
          <li
            key={f.motivo}
            className={cn(
              'flex items-center justify-between gap-3 rounded px-1 py-0.5 text-[11px] transition-colors',
              tip?.i === i && 'bg-bg-elev',
            )}
            onMouseEnter={move(i)}
            onMouseMove={move(i)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
              <span className="truncate text-zinc-300">{f.motivo}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">{(f.pct * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
      {tip && fatias[tip.i] && (
        <TipBox tip={tip}>
          <p className="font-semibold text-zinc-100">{fatias[tip.i].motivo}</p>
          <p style={{ color: fatias[tip.i].cor }}>
            {fatias[tip.i].qtd} churns · {(fatias[tip.i].pct * 100).toFixed(1)}%
          </p>
        </TipBox>
      )}
    </div>
  )
}

// ============================================================
// 3) Barras horizontais (squad) + hover
// ============================================================
function BarrasHorizontais({ dados, cor }: { dados: { label: string; valor: number }[]; cor: string }) {
  const { ref, tip, move, clear } = useChartTip()
  if (dados.length === 0) return <p className="py-12 text-center text-xs text-muted">Sem dados.</p>
  const esc = niceScale(Math.max(1, ...dados.map((d) => d.valor)))
  const W = 560
  const rowH = 34
  const padL = 90
  const padR = 16
  const padB = 22
  const H = dados.length * rowH + padB
  const chartW = W - padL - padR
  const x = (v: number) => padL + (v / esc.max) * chartW

  return (
    <div className="relative" ref={ref} onMouseLeave={clear}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img">
          {esc.ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={H - padB} className="stroke-border" strokeDasharray="2 3" />
              <text x={x(t)} y={H - 8} textAnchor="middle" fontSize="9" className="fill-muted">
                {t}
              </text>
            </g>
          ))}
          {dados.map((d, i) => {
            const y = i * rowH + 6
            const bh = rowH - 14
            const hovered = tip?.i === i
            return (
              <g key={d.label}>
                {hovered && (
                  <rect x={padL} y={y - 4} width={chartW} height={bh + 8} fill="currentColor" className="text-zinc-500" opacity={0.08} rx="3" />
                )}
                <text x={padL - 8} y={y + bh / 2 + 3} textAnchor="end" fontSize="10" className="fill-zinc-300">
                  {d.label}
                </text>
                <rect x={padL} y={y} width={Math.max(0, x(d.valor) - padL)} height={bh} rx="2" fill={cor} opacity={hovered ? 1 : 0.85} />
                <text x={x(d.valor) + 5} y={y + bh / 2 + 3} fontSize="10" className="fill-zinc-300 tabular-nums">
                  {d.valor}
                </text>
                <rect x={0} y={y - 4} width={W} height={bh + 8} fill="transparent" style={{ cursor: 'pointer' }} onMouseEnter={move(i)} onMouseMove={move(i)} />
              </g>
            )
          })}
        </svg>
      </div>
      {tip && dados[tip.i] && (
        <TipBox tip={tip}>
          <p className="font-semibold text-zinc-100">{dados[tip.i].label}</p>
          <p style={{ color: cor }}>Churns: {dados[tip.i].valor}</p>
        </TipBox>
      )}
    </div>
  )
}

// ============================================================
// 4) Barras verticais (tempo de casa) + hover
// ============================================================
function BarrasVerticais({ dados, cor }: { dados: { label: string; valor: number }[]; cor: string }) {
  const { ref, tip, move, clear } = useChartTip()
  const esc = niceScale(Math.max(1, ...dados.map((d) => d.valor)))
  const W = 560
  const H = 240
  const padL = 30
  const padR = 12
  const padT = 12
  const padB = 28
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n = Math.max(1, dados.length)
  const colW = chartW / n
  const barW = colW * 0.5
  const y = (v: number) => padT + chartH - (v / esc.max) * chartH

  return (
    <div className="relative" ref={ref} onMouseLeave={clear}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img">
          {esc.ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + chartW} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="2 3" />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" className="fill-muted">
                {t}
              </text>
            </g>
          ))}
          {dados.map((d, i) => {
            const cx = padL + colW * i + colW / 2
            const h = (d.valor / esc.max) * chartH
            const hovered = tip?.i === i
            return (
              <g key={d.label}>
                {hovered && (
                  <rect x={padL + colW * i} y={padT} width={colW} height={chartH} fill="currentColor" className="text-zinc-500" opacity={0.08} />
                )}
                <rect x={cx - barW / 2} y={padT + chartH - h} width={barW} height={h} rx="2" fill={cor} opacity={hovered ? 1 : 0.85} />
                <text x={cx} y={padT + chartH - h - 4} textAnchor="middle" fontSize="9" className="fill-zinc-300 tabular-nums">
                  {d.valor}
                </text>
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="9" className="fill-muted">
                  {d.label}
                </text>
                <rect x={padL + colW * i} y={padT} width={colW} height={chartH} fill="transparent" style={{ cursor: 'pointer' }} onMouseEnter={move(i)} onMouseMove={move(i)} />
              </g>
            )
          })}
        </svg>
      </div>
      {tip && dados[tip.i] && (
        <TipBox tip={tip}>
          <p className="font-semibold text-zinc-100">{dados[tip.i].label}</p>
          <p style={{ color: cor }}>Churns: {dados[tip.i].valor}</p>
        </TipBox>
      )}
    </div>
  )
}

// ============================================================
// 5) Ticket médio — churns vs base ativa (full width) + hover
// ============================================================
function TicketComparativo({ churns, baseAtiva }: { churns: number; baseAtiva: number }) {
  const { ref, tip, move, clear } = useChartTip()
  const linhas = [
    { label: 'Churns', valor: churns, cor: COR_CHURN },
    { label: 'Base Ativa', valor: baseAtiva, cor: COR_BASE },
  ]
  const esc = niceScale(Math.max(1, ...linhas.map((l) => l.valor)))
  const W = 900
  const rowH = 46
  const padL = 90
  const padR = 20
  const padB = 24
  const H = linhas.length * rowH + padB
  const chartW = W - padL - padR
  const x = (v: number) => padL + (v / esc.max) * chartW

  return (
    <div className="relative" ref={ref} onMouseLeave={clear}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img">
          {esc.ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={H - padB} className="stroke-border" strokeDasharray="2 3" />
              <text x={x(t)} y={H - 8} textAnchor="middle" fontSize="9" className="fill-muted">
                {formatBRL(t)}
              </text>
            </g>
          ))}
          {linhas.map((l, i) => {
            const y = i * rowH + 8
            const bh = rowH - 18
            const hovered = tip?.i === i
            return (
              <g key={l.label}>
                <text x={padL - 8} y={y + bh / 2 + 4} textAnchor="end" fontSize="11" className="fill-zinc-200">
                  {l.label}
                </text>
                <rect x={padL} y={y} width={Math.max(0, x(l.valor) - padL)} height={bh} rx="3" fill={l.cor} opacity={hovered ? 1 : 0.9} />
                <text x={x(l.valor) - 8} y={y + bh / 2 + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#fff">
                  {formatBRL(l.valor)}
                </text>
                <rect x={0} y={y - 4} width={W} height={bh + 8} fill="transparent" style={{ cursor: 'pointer' }} onMouseEnter={move(i)} onMouseMove={move(i)} />
              </g>
            )
          })}
        </svg>
      </div>
      {tip && linhas[tip.i] && (
        <TipBox tip={tip}>
          <p className="font-semibold text-zinc-100">{linhas[tip.i].label}</p>
          <p style={{ color: linhas[tip.i].cor }}>Ticket médio: {formatBRL(linhas[tip.i].valor)}</p>
        </TipBox>
      )}
    </div>
  )
}

// ============================================================
// Tabela de clientes churnados (com busca)
// ============================================================
const MOTIVO_BADGE: Record<string, string> = {
  'Resultado insatisfatório': 'border-red-500/40 bg-red-500/10 text-red-300',
  'Problemas de atendimento': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Preço: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  'Dificuldades financeiras': 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  'Mudança de estratégia': 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  'Encerramento da clínica': 'border-pink-500/40 bg-pink-500/10 text-pink-300',
  'Não informado': 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  Outro: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
}

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '—'
}

function TabelaChurns({ clientes }: { clientes: ClienteChurn[] }) {
  const [busca, setBusca] = useState('')
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.nicho.toLowerCase().includes(q),
    )
  }, [busca, clientes])

  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full rounded-lg border border-border bg-bg-card py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
              <th className="px-3 py-2.5 text-left font-semibold">Squad</th>
              <th className="px-3 py-2.5 text-left font-semibold">Account Manager</th>
              <th className="px-3 py-2.5 text-right font-semibold">Ticket Mensal</th>
              <th className="px-3 py-2.5 text-left font-semibold">Data Churn</th>
              <th className="px-3 py-2.5 text-right font-semibold">Tempo Casa</th>
              <th className="px-3 py-2.5 text-right font-semibold">LTV</th>
              <th className="px-3 py-2.5 text-left font-semibold">Motivo</th>
              <th className="px-3 py-2.5 text-right font-semibold">NPS</th>
              <th className="px-3 py-2.5 text-right font-semibold" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-b-0 transition-colors hover:bg-bg-soft/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-100">{c.nome}</p>
                  {c.nicho && <p className="text-[10px] text-muted">{c.nicho}</p>}
                </td>
                <td className="px-3 py-3 text-zinc-300">{c.squad ?? '—'}</td>
                <td className="px-3 py-3 text-zinc-300">{c.accountManager ?? '—'}</td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-200">{formatBRL(c.ticketMensal)}</td>
                <td className="px-3 py-3 tabular-nums text-zinc-300">{dataBR(c.dataChurn)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-300">
                  {c.tempoCasaMeses !== null ? `${c.tempoCasaMeses}m` : '—'}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-300">
                  {c.ltv !== null ? formatBRL(c.ltv) : '—'}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'inline-block max-w-[150px] truncate rounded border px-1.5 py-0.5 text-[10px] font-medium align-middle',
                      MOTIVO_BADGE[c.motivo] ?? 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
                    )}
                    title={c.motivo}
                  >
                    {c.motivo}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  {typeof c.nps === 'number' ? (
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        c.nps >= 9 ? 'text-emerald-300' : c.nps >= 7 ? 'text-amber-300' : 'text-red-300',
                      )}
                    >
                      {c.nps}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <Link
                    to={`/clientes/${c.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-brand-300"
                    title="Ver ficha do cliente"
                  >
                    <Eye size={12} /> Ver
                  </Link>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-xs text-muted">
                  {clientes.length === 0
                    ? 'Nenhum churn registrado ainda.'
                    : `Nenhum cliente encontrado para “${busca}”.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
