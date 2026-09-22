/**
 * Tela "Fluxo de Caixa" (Financeiro › Fluxo de Caixa) — regime de caixa,
 * 100% derivado de Clientes, Comercial e Despesas (ver ./fluxoCaixaCalculator).
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowDownToLine, ArrowUpFromLine, Scale, Landmark, Clock } from 'lucide-react'
import { PageHeader, FilterPill } from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { MarginKPICard } from '@/components/financeiro/MarginKPICard'
import { FluxoCaixaTable } from '@/components/financeiro/FluxoCaixaTable'
import { FluxoCaixaChart, type FluxoPonto } from '@/components/financeiro/FluxoCaixaChart'
import { useDreData } from './useDreData'
import { formatBRL } from './despesasCalculator'
import { calculateFluxoCaixa, fluxoLiquidoMes, saldoAcumuladoAte } from './fluxoCaixaCalculator'
import { labelPeriodo, mesesDoPeriodo, shiftRef, ultimosMeses, labelMesCurto, type ModoPeriodo } from './dreCalculator'

const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function FluxoCaixa() {
  const { loading, input } = useDreData()
  const [ref, setRef] = useState(mesAtual())
  const [modo, setModo] = useState<ModoPeriodo>('mes')

  const { fc, saldoInicial, saldoFinal, evolucao } = useMemo(() => {
    const meses = mesesDoPeriodo(ref, modo)
    const fc = calculateFluxoCaixa(input, meses)
    const mesAntes = ultimosMeses(meses[0], 2)[0] // mês anterior ao 1º do período
    const saldoInicial = saldoAcumuladoAte(input, mesAntes)
    const saldoFinal = saldoInicial + fc.fluxoLiquido

    // Evolução 12 meses: entradas/saídas por mês + saldo acumulado corrente.
    const doze = ultimosMeses(meses[meses.length - 1], 12)
    let saldoRun = saldoAcumuladoAte(input, ultimosMeses(doze[0], 2)[0]) // saldo antes do 1º mês da série
    const evolucao: FluxoPonto[] = doze.map((m) => {
      const f = calculateFluxoCaixa(input, [m])
      saldoRun += fluxoLiquidoMes(input, m)
      return { mes: labelMesCurto(m), entradas: f.entradas, saidas: f.saidas, saldo: saldoRun }
    })
    return { fc, saldoInicial, saldoFinal, evolucao }
  }, [input, ref, modo])

  return (
    <div>
      <Breadcrumb trilha={['Financeiro', 'Fluxo de Caixa']} />
      <PageHeader
        title="Fluxo de Caixa"
        description="Regime de caixa — entradas e saídas efetivas por período"
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
          {/* KPIs */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MarginKPICard label="Entradas" value={formatBRL(fc.entradas)} icon={<ArrowDownToLine size={13} />} tone="success" sub="recebimentos no período" />
            <MarginKPICard label="Saídas" value={formatBRL(fc.saidas)} icon={<ArrowUpFromLine size={13} />} tone="danger" sub="pagamentos no período" />
            <MarginKPICard label="Fluxo líquido" value={formatBRL(fc.fluxoLiquido)} icon={<Scale size={13} />} tone={fc.fluxoLiquido >= 0 ? 'success' : 'danger'} sub="entradas − saídas" />
            <MarginKPICard label="Saldo final" value={formatBRL(saldoFinal)} icon={<Landmark size={13} />} tone={saldoFinal >= 0 ? 'info' : 'danger'} sub="acumulado (base 0)" />
          </div>

          {/* Aviso "a pagar" (previsto, fora do caixa realizado) */}
          {fc.aPagarPrevisto > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/[0.07] px-4 py-2.5 text-[12px] text-orange-200">
              <Clock size={14} className="text-orange-300" />
              <span>
                <strong>{formatBRL(fc.aPagarPrevisto)}</strong> em despesas ainda em aberto neste período (pendentes/atrasadas) — saída prevista, ainda não deduzida do caixa realizado.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Demonstrativo */}
            <FluxoCaixaTable fc={fc} saldoInicial={saldoInicial} />

            {/* Evolução */}
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-100">Entradas × Saídas e Saldo (12 meses)</h3>
              <FluxoCaixaChart dados={evolucao} />
            </div>
          </div>

          <p className="mt-2 text-[10px] text-muted">
            Regime de <strong className="text-zinc-400">caixa</strong>: saídas contadas pela <strong>data de pagamento</strong> das despesas (não pela competência, como no DRE).
            Entradas = MRR recorrente (assumido pago no mês) + caixa recolhido dos fechamentos. Saldo = acumulado dos fluxos líquidos (base 0).
          </p>
        </>
      )}
    </div>
  )
}
