/**
 * Tela "DRE por Setor" (Financeiro › DRE por Setor) — custos e despesas
 * segmentados por setor (centro de custo). Receita/margem só no consolidado
 * (sem rateio por setor, por decisão). 100% derivado — ver ./dreSetorCalculator.
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Wallet, TrendingUp, Scale, Coins } from 'lucide-react'
import { PageHeader, FilterPill } from '@/components/ds'
import { cn } from '@/lib/utils'
import { MarginKPICard } from '@/components/financeiro/MarginKPICard'
import { DreSetorTable } from '@/components/financeiro/DreSetorTable'
import { useDreData } from './useDreData'
import { formatBRL } from './despesasCalculator'
import { calculateDreSetor, type SetorLinha } from './dreSetorCalculator'
import { labelPeriodo, mesesDoPeriodo, shiftRef, type ModoPeriodo } from './dreCalculator'

const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const COR_SETOR = ['#8b5cf6', '#10b981', '#3b82f6', '#eab308', '#ec4899', '#a1a1aa']

export default function DreSetor() {
  const { loading, input } = useDreData()
  const [ref, setRef] = useState(mesAtual())
  const [modo, setModo] = useState<ModoPeriodo>('mes')

  const data = useMemo(() => calculateDreSetor(input, mesesDoPeriodo(ref, modo)), [input, ref, modo])

  return (
    <div>
      <PageHeader
        title="DRE por Setor"
        description="Custos e despesas por centro de custo — receita no consolidado"
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
          {/* Consolidado da empresa (contexto) */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MarginKPICard label="Receita líquida" value={formatBRL(data.receitaLiquida)} icon={<TrendingUp size={13} />} tone="info" sub="consolidado (competência)" />
            <MarginKPICard label="Custo total" value={formatBRL(data.custoTotalEmpresa)} icon={<Wallet size={13} />} tone="warning" sub="despesas + CAC" />
            <MarginKPICard label="Investimento (CAC)" value={formatBRL(data.investimentoCac)} icon={<Coins size={13} />} tone="purple" sub="não alocado a setor" />
            <MarginKPICard label="Resultado" value={formatBRL(data.resultado)} icon={<Scale size={13} />} tone={data.resultado >= 0 ? 'success' : 'danger'} sub="receita − custo total" />
          </div>

          {/* Participação por setor */}
          <div className="mb-4 rounded-xl border border-border bg-bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">Participação no custo por setor</h3>
            <div className="space-y-2.5">
              {data.setores.filter((s) => s.total > 0).map((s, i) => (
                <ShareRow key={s.setor} setor={s} cor={COR_SETOR[i % COR_SETOR.length]} />
              ))}
              {data.totalDespesas === 0 && <p className="text-xs text-muted">Sem despesas no período.</p>}
            </div>
          </div>

          {/* Matriz Setor × Categoria */}
          <DreSetorTable data={data} />

          <p className="mt-2 text-[10px] text-muted">
            Sem rateio de receita por setor (decisão): cada setor mostra o que consome. O <strong className="text-zinc-400">Investimento (CAC)</strong> de {formatBRL(data.investimentoCac)} não pertence a um setor e entra só no custo total. "% da receita" = custo do setor ÷ receita líquida consolidada.
          </p>
        </>
      )}
    </div>
  )
}

function ShareRow({ setor, cor }: { setor: SetorLinha; cor: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium text-zinc-200">{setor.setor}</span>
        <span className="tabular-nums text-muted">
          {formatBRL(setor.total)} · <span className="text-zinc-300">{setor.pctTotal.toFixed(0)}%</span>
          {setor.pctReceita > 0 && <span className="ml-1 text-muted/70">({setor.pctReceita.toFixed(0)}% da receita)</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-soft/60">
        <div className={cn('h-full rounded-full')} style={{ width: `${Math.min(100, setor.pctTotal)}%`, background: cor }} />
      </div>
    </div>
  )
}
