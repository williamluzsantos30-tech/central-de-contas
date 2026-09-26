/**
 * Tela "LTV:CAC" (Financeiro › LTV:CAC) — retorno sobre aquisição, 100%
 * derivado de Clientes, Comercial e do DRE (ver ./ltvCacCalculator).
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, Coins, Scale, Timer, Users, Percent, CalendarClock, Wallet } from 'lucide-react'
import { PageHeader, FilterPill } from '@/components/ds'
import { cn } from '@/lib/utils'
import { MarginKPICard } from '@/components/financeiro/MarginKPICard'
import { LtvCacEvolutionChart, type RatioPonto } from '@/components/financeiro/LtvCacEvolutionChart'
import { useFinanceiro } from './store'
import { useDreData } from './useDreData'
import { formatBRL } from './despesasCalculator'
import { calculateLtvCac } from './ltvCacCalculator'
import { labelPeriodo, mesesDoPeriodo, shiftRef, ultimosMeses, labelMesCurto, type ModoPeriodo } from './dreCalculator'

const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function LtvCac() {
  const { loading, input } = useDreData()
  const { metasFinanceiras } = useFinanceiro()
  const [ref, setRef] = useState(mesAtual())
  const [modo, setModo] = useState<ModoPeriodo>('mes')

  const meses = useMemo(() => mesesDoPeriodo(ref, modo), [ref, modo])
  const r = useMemo(() => calculateLtvCac(input, meses), [input, meses])

  const evolucao = useMemo<RatioPonto[]>(() => {
    const anchor = meses[meses.length - 1]
    return ultimosMeses(anchor, 12).map((m) => ({ mes: labelMesCurto(m), ratio: Math.round(calculateLtvCac(input, [m]).ratio * 10) / 10 }))
  }, [input, meses])

  const ratioTone = r.ratio >= metasFinanceiras.ltvCacAlvo ? 'success' : r.ratio >= 1 ? 'warning' : 'danger'
  const paybackTone = r.paybackMeses > 0 && r.paybackMeses <= metasFinanceiras.paybackAlvoMeses ? 'success' : r.paybackMeses <= metasFinanceiras.paybackAlvoMeses * 1.5 ? 'warning' : 'danger'

  return (
    <div>
      <PageHeader
        title="LTV:CAC"
        description="Retorno sobre aquisição — valor do cliente × custo de aquisição"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill value={modo} onChange={(v) => setModo(v as ModoPeriodo)} options={[{ value: 'mes', label: 'Mensal' }, { value: 'trimestre', label: 'Trimestral' }, { value: 'ano', label: 'Anual' }]} />
            <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-soft p-0.5">
              <button onClick={() => setRef(shiftRef(ref, modo, -1))} className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100" title="Anterior"><ChevronLeft size={15} /></button>
              <span className="min-w-[7.5rem] text-center text-xs font-medium capitalize text-zinc-100">{labelPeriodo(ref, modo)}</span>
              <button onClick={() => setRef(shiftRef(ref, modo, 1))} className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100" title="Próximo"><ChevronRight size={15} /></button>
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">Carregando…</div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MarginKPICard label="LTV" value={formatBRL(r.ltv)} icon={<TrendingUp size={13} />} tone="info" sub="valor do tempo de vida (margem)" />
            <MarginKPICard label="CAC" value={formatBRL(r.cac)} icon={<Coins size={13} />} tone="purple" sub={`${r.novosClientes} novo${r.novosClientes === 1 ? '' : 's'} cliente${r.novosClientes === 1 ? '' : 's'}`} />
            <MarginKPICard
              label="LTV : CAC"
              value={r.cac > 0 ? `${r.ratio.toFixed(1)}x` : '—'}
              icon={<Scale size={13} />}
              tone={ratioTone}
              sub={r.cac > 0 ? 'quanto retorna por R$ de aquisição' : 'sem CAC no período'}
              meta={{ alvo: metasFinanceiras.ltvCacAlvo, atingiu: r.ratio >= metasFinanceiras.ltvCacAlvo }}
            />
            <MarginKPICard
              label="Payback"
              value={r.paybackMeses > 0 ? `${r.paybackMeses.toFixed(1)} m` : '—'}
              icon={<Timer size={13} />}
              tone={paybackTone}
              sub={`meta ≤ ${metasFinanceiras.paybackAlvoMeses} meses`}
            />
          </div>

          {/* Benchmark do índice */}
          <RatioBenchmark ratio={r.ratio} alvo={metasFinanceiras.ltvCacAlvo} temCac={r.cac > 0} />

          {/* Métricas de apoio */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MiniStat icon={<Wallet size={12} />} label="Ticket médio" value={formatBRL(r.ticketMedio)} />
            <MiniStat icon={<Users size={12} />} label="Clientes ativos" value={String(r.clientesAtivos)} />
            <MiniStat icon={<Percent size={12} />} label="Churn mensal" value={`${r.churnMensalPct.toFixed(1)}%`} />
            <MiniStat icon={<CalendarClock size={12} />} label="Lifetime" value={`${r.lifetimeMeses.toFixed(0)} m`} />
            <MiniStat icon={<Percent size={12} />} label="Margem bruta" value={`${r.margemBrutaPct.toFixed(1)}%`} />
            <MiniStat icon={<Coins size={12} />} label="Investimento" value={formatBRL(r.investimento)} />
          </div>

          <p className="mt-2 text-[10px] text-muted">
            LTV = Ticket médio × Margem bruta × Lifetime (1÷churn). CAC = Investimento ÷ novos clientes (fechamentos do Comercial). Payback = CAC ÷ (Ticket × Margem bruta).
          </p>

          {/* Evolução do índice */}
          <div className="mt-5 rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-brand-300" />
              <h3 className="text-sm font-semibold text-zinc-100">Evolução LTV:CAC (12 meses)</h3>
            </div>
            <LtvCacEvolutionChart dados={evolucao} meta={metasFinanceiras.ltvCacAlvo} />
          </div>
        </>
      )}
    </div>
  )
}

/** Barra de faixas: <1 crítico · 1–meta atenção · ≥meta saudável, com marcador. */
function RatioBenchmark({ ratio, alvo, temCac }: { ratio: number; alvo: number; temCac: boolean }) {
  const escalaMax = Math.max(alvo * 1.6, ratio * 1.1, 4)
  const pos = Math.min(100, Math.max(0, (ratio / escalaMax) * 100))
  const posAlvo = Math.min(100, (alvo / escalaMax) * 100)
  const pos1 = Math.min(100, (1 / escalaMax) * 100)
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Saúde do índice</p>
        <span className={cn('text-xs font-semibold', ratio >= alvo ? 'text-green-300' : ratio >= 1 ? 'text-orange-300' : 'text-red-300')}>
          {temCac ? `${ratio.toFixed(1)}x` : 'sem CAC'}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full" style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.5) 0%, rgba(249,115,22,0.5) 40%, rgba(34,197,94,0.5) 100%)' }}>
        {/* marcadores de 1x e meta */}
        <div className="absolute top-0 h-full w-px bg-zinc-100/40" style={{ left: `${pos1}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-zinc-100/80" style={{ left: `${posAlvo}%` }} title={`meta ${alvo}x`} />
        {temCac && <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg-card bg-zinc-100 shadow" style={{ left: `${pos}%` }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-muted">
        <span>0</span>
        <span>1x (empata)</span>
        <span>meta {alvo}x</span>
        <span>{escalaMax.toFixed(0)}x</span>
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-muted">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-base font-bold tabular-nums text-zinc-100">{value}</p>
    </div>
  )
}
