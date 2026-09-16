/**
 * Clientes Churns — dashboard analítico de cancelamentos.
 *
 * Visão macro do churn: KPIs, tendência 12 meses, distribuição por motivo,
 * por squad, por tempo de casa e comparativo de ticket médio.
 *
 * Gráficos em SVG próprio (mesmo padrão da Visão Executiva) — sem lib
 * externa, temáticos (light/dark via tokens). Dados vêm de ./mockData.ts;
 * trocar por API depois não muda a UI.
 */
import { useMemo, useState } from 'react'
import {
  ChevronDown,
  Calendar,
  Download,
  UserMinus,
  DollarSign,
  Percent,
  Clock,
  Ticket,
  ArrowUpRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  churnKpis,
  tendenciaChurns,
  churnsPorMotivo,
  churnsPorSquad,
  churnsPorTempoCasa,
  ticketComparativo,
} from './mockData'

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

type Pico = { value: string; label: string }
const PERIODOS: Pico[] = [
  { value: '', label: 'Todos os períodos' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '3m', label: 'Últimos 3 meses' },
]

export default function Churns() {
  // Filtros — visuais por enquanto (dados mockados). Passam a filtrar
  // quando a página for ligada à API.
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
          <Button variant="outline" onClick={() => window.print()}>
            <Download size={14} /> Exportar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={<UserMinus size={13} className="text-red-300" />}
          label="Total Churns"
          valor={String(churnKpis.totalChurns)}
          sparkline={tendenciaChurns.map((t) => t.qtd)}
        />
        <KpiCard
          icon={<DollarSign size={13} className="text-red-300" />}
          label="MRR Perdido"
          valor={formatBRL(churnKpis.mrrPerdido)}
        />
        <KpiCard
          icon={<DollarSign size={13} className="text-emerald-300" />}
          label="MRR Mês Atual"
          valor={formatBRL(churnKpis.mrrMesAtual)}
          badgePct={churnKpis.mrrMesAtualDeltaPct}
        />
        <KpiCard
          icon={<Percent size={13} className="text-red-300" />}
          label="Churn Rate"
          valor={formatPct(churnKpis.churnRate)}
        />
        <KpiCard
          icon={<Clock size={13} className="text-brand-300" />}
          label="Tempo Médio Casa"
          valor={`${churnKpis.tempoMedioCasaMeses}m`}
        />
        <KpiCard
          icon={<Ticket size={13} className="text-brand-300" />}
          label="Ticket Médio Churn"
          valor={formatBRL(churnKpis.ticketMedioChurn)}
          secondary={`Ativos: ${formatBRL(churnKpis.ticketMedioAtivo)}`}
        />
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-soft/40 px-3 py-2">
        <div className="mr-1 flex items-center gap-1.5 border-r border-border pr-2">
          <Calendar size={13} className="text-muted" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Filtros
          </span>
        </div>
        <Pill value={fPeriodo} onChange={setFPeriodo} options={PERIODOS} />
        <Pill
          value={fSquad}
          onChange={setFSquad}
          placeholder="Todos os Squads"
          options={churnsPorSquad.map((s) => ({ value: s.squad, label: s.squad }))}
        />
        <Pill value={fAM} onChange={setFAM} placeholder="Todos os AMs" options={[]} />
        <Pill value={fGestor} onChange={setFGestor} placeholder="Todos os Gestores" options={[]} />
      </div>

      {/* Grid de gráficos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Tendência de Churns (12 meses)">
          <TendenciaChart />
        </ChartCard>
        <ChartCard title="Distribuição por Motivo">
          <MotivoDonut />
        </ChartCard>
        <ChartCard title="Churns por Squad">
          <BarrasHorizontais dados={churnsPorSquad.map((s) => ({ label: s.squad, valor: s.qtd }))} cor={COR_CHURN} />
        </ChartCard>
        <ChartCard title="Distribuição por Tempo de Casa">
          <BarrasVerticais dados={churnsPorTempoCasa.map((f) => ({ label: f.faixa, valor: f.qtd }))} cor={COR_TEMPO} />
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="Ticket Médio: Churns vs Base Ativa">
          <TicketComparativo />
        </ChartCard>
      </div>
    </div>
  )
}

// ============================================================
// KPI card
// ============================================================
function KpiCard({
  icon,
  label,
  valor,
  badgePct,
  secondary,
  sparkline,
}: {
  icon: React.ReactNode
  label: string
  valor: string
  badgePct?: number
  secondary?: string
  sparkline?: number[]
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        </div>
        {sparkline && <Sparkline dados={sparkline} />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-2xl font-bold leading-none tabular-nums text-zinc-100">{valor}</p>
        {badgePct !== undefined && (
          <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[10px] font-semibold text-emerald-300">
            <ArrowUpRight size={10} />
            {Math.round(badgePct * 100)}%
          </span>
        )}
      </div>
      {secondary ? (
        <p className="mt-1.5 text-[10px] text-muted">{secondary}</p>
      ) : (
        <p className="mt-1.5 text-[10px] text-muted">vs. mês anterior</p>
      )}
    </div>
  )
}

function Sparkline({ dados }: { dados: number[] }) {
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
      <polyline
        points={pts}
        fill="none"
        stroke={COR_CHURN}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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
// 1) Tendência — barras (qtd) + linha (MRR), eixo duplo
// ============================================================
function TendenciaChart() {
  const dados = tendenciaChurns
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
  const n = dados.length
  const colW = chartW / n
  const barW = colW * 0.5

  const xCentro = (i: number) => padL + colW * i + colW / 2
  const yQtd = (v: number) => padT + chartH - (v / escQtd.max) * chartH
  const yMrr = (v: number) => padT + chartH - (v / escMrr.max) * chartH

  const linha = dados.map((d, i) => `${xCentro(i).toFixed(1)},${yMrr(d.mrr).toFixed(1)}`).join(' ')

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Tendência de churns">
        {/* grid + eixo esquerdo (qtd) */}
        {escQtd.ticks.map((t) => (
          <g key={`q${t}`}>
            <line x1={padL} x2={padL + chartW} y1={yQtd(t)} y2={yQtd(t)} className="stroke-border" strokeDasharray="2 3" />
            <text x={padL - 6} y={yQtd(t) + 3} textAnchor="end" fontSize="9" className="fill-muted">
              {t}
            </text>
          </g>
        ))}
        {/* eixo direito (mrr) em dourado */}
        {escMrr.ticks.map((t) => (
          <text
            key={`m${t}`}
            x={padL + chartW + 6}
            y={yMrr(t) + 3}
            textAnchor="start"
            fontSize="9"
            fill={COR_MRR}
            opacity={0.85}
          >
            {formatBRLk(t)}
          </text>
        ))}
        {/* barras */}
        {dados.map((d, i) => {
          const h = (d.qtd / escQtd.max) * chartH
          return (
            <g key={d.mes}>
              {d.qtd > 0 && (
                <rect
                  x={xCentro(i) - barW / 2}
                  y={padT + chartH - h}
                  width={barW}
                  height={h}
                  rx="2"
                  fill={COR_CHURN}
                  opacity={0.85}
                />
              )}
              <text x={xCentro(i)} y={H - 8} textAnchor="middle" fontSize="8" className="fill-muted">
                {d.mes}
              </text>
            </g>
          )
        })}
        {/* linha MRR */}
        <polyline points={linha} fill="none" stroke={COR_MRR} strokeWidth="2" strokeLinejoin="round" />
        {dados.map((d, i) => (
          <circle key={`p${d.mes}`} cx={xCentro(i)} cy={yMrr(d.mrr)} r="2.5" fill={COR_MRR} />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_CHURN }} /> Qtd de churns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded" style={{ background: COR_MRR }} /> MRR perdido
        </span>
      </div>
    </div>
  )
}

// ============================================================
// 2) Distribuição por motivo — donut + legenda
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

function MotivoDonut() {
  const total = useMemo(() => churnsPorMotivo.reduce((s, m) => s + m.qtd, 0), [])
  const fatias = useMemo(() => {
    let ang = 0
    return churnsPorMotivo.map((m, i) => {
      const frac = total > 0 ? m.qtd / total : 0
      const a0 = ang
      const a1 = ang + frac * 360
      ang = a1
      return { ...m, a0, a1, pct: frac, cor: PALETA_MOTIVO[i % PALETA_MOTIVO.length] }
    })
  }, [total])

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 180 180" width="160" height="160" className="shrink-0" role="img" aria-label="Distribuição por motivo">
        {fatias.map((f) => (
          <path
            key={f.motivo}
            d={arcoDonut(90, 90, 78, 48, f.a0, f.a1 - 0.6)}
            fill={f.cor}
            opacity={0.9}
          />
        ))}
        <text x="90" y="86" textAnchor="middle" fontSize="22" fontWeight="700" className="fill-zinc-100">
          {total}
        </text>
        <text x="90" y="102" textAnchor="middle" fontSize="9" className="fill-muted">
          churns
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {fatias.map((f) => (
          <li key={f.motivo} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
              <span className="truncate text-zinc-300">{f.motivo}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              {(f.pct * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================
// 3) Barras horizontais (squad)
// ============================================================
function BarrasHorizontais({ dados, cor }: { dados: { label: string; valor: number }[]; cor: string }) {
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
          return (
            <g key={d.label}>
              <text x={padL - 8} y={y + bh / 2 + 3} textAnchor="end" fontSize="10" className="fill-zinc-300">
                {d.label}
              </text>
              <rect x={padL} y={y} width={Math.max(0, x(d.valor) - padL)} height={bh} rx="2" fill={cor} opacity={0.85} />
              <text x={x(d.valor) + 5} y={y + bh / 2 + 3} fontSize="10" className="fill-zinc-300 tabular-nums">
                {d.valor}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ============================================================
// 4) Barras verticais (tempo de casa)
// ============================================================
function BarrasVerticais({ dados, cor }: { dados: { label: string; valor: number }[]; cor: string }) {
  const esc = niceScale(Math.max(1, ...dados.map((d) => d.valor)))
  const W = 560
  const H = 240
  const padL = 30
  const padR = 12
  const padT = 12
  const padB = 28
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n = dados.length
  const colW = chartW / n
  const barW = colW * 0.5
  const y = (v: number) => padT + chartH - (v / esc.max) * chartH

  return (
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
          return (
            <g key={d.label}>
              <rect x={cx - barW / 2} y={padT + chartH - h} width={barW} height={h} rx="2" fill={cor} opacity={0.85} />
              <text x={cx} y={padT + chartH - h - 4} textAnchor="middle" fontSize="9" className="fill-zinc-300 tabular-nums">
                {d.valor}
              </text>
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="9" className="fill-muted">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ============================================================
// 5) Ticket médio — churns vs base ativa (full width)
// ============================================================
function TicketComparativo() {
  const linhas = [
    { label: 'Churns', valor: ticketComparativo.churns, cor: COR_CHURN },
    { label: 'Base Ativa', valor: ticketComparativo.baseAtiva, cor: COR_BASE },
  ]
  const esc = niceScale(Math.max(...linhas.map((l) => l.valor)))
  const W = 900
  const rowH = 46
  const padL = 90
  const padR = 20
  const padB = 24
  const H = linhas.length * rowH + padB
  const chartW = W - padL - padR
  const x = (v: number) => padL + (v / esc.max) * chartW

  return (
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
          return (
            <g key={l.label}>
              <text x={padL - 8} y={y + bh / 2 + 4} textAnchor="end" fontSize="11" className="fill-zinc-200">
                {l.label}
              </text>
              <rect x={padL} y={y} width={Math.max(0, x(l.valor) - padL)} height={bh} rx="3" fill={l.cor} opacity={0.9} />
              <text
                x={x(l.valor) - 8}
                y={y + bh / 2 + 4}
                textAnchor="end"
                fontSize="11"
                fontWeight="700"
                fill="#fff"
              >
                {formatBRL(l.valor)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ============================================================
// Pill de filtro (select nativo estilizado)
// ============================================================
function Pill({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-md border border-border bg-bg-elev py-1.5 pl-3 pr-8 text-xs font-medium text-zinc-100 transition-colors hover:border-brand-500/40 focus:border-brand-500/60 focus:outline-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  )
}
