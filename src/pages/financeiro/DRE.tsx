/**
 * Tela "DRE" (Financeiro › DRE) — Demonstração de Resultado nas visões
 * Competência e Caixa lado a lado. 100% derivada de Clientes (MRR), Comercial
 * (Caixa Recolhido + CAC) e Despesas — ver ./dreCalculator + ./useDreData.
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Percent, DollarSign, Activity, TrendingUp } from 'lucide-react'
import { PageHeader, FilterPill } from '@/components/ds'
import { MarginKPICard } from '@/components/financeiro/MarginKPICard'
import { MarginEvolutionChart, type MargemPonto } from '@/components/financeiro/MarginEvolutionChart'
import { DRETable } from '@/components/financeiro/DRETable'
import { useFinanceiro } from './store'
import { useDreData } from './useDreData'
import { formatBRL } from './despesasCalculator'
import {
  calculateDRE,
  labelMesCurto,
  labelPeriodo,
  mesesDoPeriodo,
  refAnterior,
  shiftRef,
  ultimosMeses,
  type ModoPeriodo,
} from './dreCalculator'

const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DRE() {
  const { loading, input } = useDreData()
  const { metasFinanceiras } = useFinanceiro()
  const [ref, setRef] = useState(mesAtual())
  const [modo, setModo] = useState<ModoPeriodo>('mes')

  const dre = useMemo(() => {
    const meses = mesesDoPeriodo(ref, modo)
    const mesesAnt = mesesDoPeriodo(refAnterior(ref, modo), modo)
    return {
      comp: calculateDRE(input, meses, 'competencia'),
      caixa: calculateDRE(input, meses, 'caixa'),
      compAnt: calculateDRE(input, mesesAnt, 'competencia'),
      caixaAnt: calculateDRE(input, mesesAnt, 'caixa'),
    }
  }, [input, ref, modo])

  // Evolução: 12 meses terminando no último mês do período (base competência).
  const evolucao = useMemo<MargemPonto[]>(() => {
    const meses = mesesDoPeriodo(ref, modo)
    const anchor = meses[meses.length - 1]
    return ultimosMeses(anchor, 12).map((m) => {
      const r = calculateDRE(input, [m], 'competencia')
      return { mes: labelMesCurto(m), bruta: Math.round(r.margemBrutaPct * 10) / 10, liquida: Math.round(r.margemLiquidaPct * 10) / 10 }
    })
  }, [input, ref, modo])

  const { comp, caixa, compAnt, caixaAnt } = dre
  const mb = comp.margemBrutaPct
  const ml = comp.margemLiquidaPct

  return (
    <div>
      <PageHeader
        title="DRE"
        description="Demonstração de Resultado — visão Competência e Caixa"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              value={modo}
              onChange={(v) => setModo(v as ModoPeriodo)}
              options={[
                { value: 'mes', label: 'Mensal' },
                { value: 'trimestre', label: 'Trimestral' },
                { value: 'ano', label: 'Anual' },
              ]}
            />
            <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-soft p-0.5">
              <button onClick={() => setRef(shiftRef(ref, modo, -1))} className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100" title="Anterior">
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-[7.5rem] text-center text-xs font-medium capitalize text-zinc-100">{labelPeriodo(ref, modo)}</span>
              <button onClick={() => setRef(shiftRef(ref, modo, 1))} className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100" title="Próximo">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">Carregando…</div>
      ) : (
        <>
          {/* Margens do período */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MarginKPICard
              label="Margem Bruta"
              value={`${mb.toFixed(1)}%`}
              icon={<Percent size={13} />}
              tone={mb >= metasFinanceiras.margemBrutaAlvo ? 'success' : mb > 0 ? 'warning' : 'danger'}
              sub={`${formatBRL(comp.margemBruta)} · competência`}
              meta={{ alvo: metasFinanceiras.margemBrutaAlvo, atingiu: mb >= metasFinanceiras.margemBrutaAlvo }}
            />
            <MarginKPICard
              label="Margem Líquida"
              value={`${ml.toFixed(1)}%`}
              icon={<Percent size={13} />}
              tone={ml >= metasFinanceiras.margemLiquidaAlvo ? 'success' : ml > 0 ? 'warning' : 'danger'}
              sub={`${formatBRL(comp.lucroLiquido)} · competência`}
              meta={{ alvo: metasFinanceiras.margemLiquidaAlvo, atingiu: ml >= metasFinanceiras.margemLiquidaAlvo }}
            />
            <MarginKPICard label="EBITDA" value={formatBRL(comp.ebitda)} icon={<Activity size={13} />} tone={comp.ebitda >= 0 ? 'success' : 'danger'} sub="resultado operacional" />
            <MarginKPICard label="Lucro Líquido" value={formatBRL(comp.lucroLiquido)} icon={<DollarSign size={13} />} tone={comp.lucroLiquido >= 0 ? 'success' : 'danger'} sub="competência" />
          </div>

          {/* Demonstrativo */}
          <DRETable comp={comp} caixa={caixa} compAnterior={compAnt} caixaAnterior={caixaAnt} />

          <p className="mt-2 text-[10px] text-muted">
            <strong className="text-zinc-400">Competência</strong> = MRR ativo dos Clientes · <strong className="text-zinc-400">Caixa</strong> = Caixa Recolhido dos fechamentos (Comercial).
            Custos diretos = custos fixos/variáveis de Tráfego, Social Media e Design + CAC; demais custos fixos/variáveis entram em Despesas Operacionais.
          </p>

          {/* Evolução de margens */}
          <div className="mt-5 rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-brand-300" />
              <h3 className="text-sm font-semibold text-zinc-100">Evolução de Margens (12 meses)</h3>
            </div>
            <MarginEvolutionChart dados={evolucao} metaBruta={metasFinanceiras.margemBrutaAlvo} metaLiquida={metasFinanceiras.margemLiquidaAlvo} />
          </div>
        </>
      )}
    </div>
  )
}
