/**
 * Tela "Comissionamento" (Financeiro › Comissionamento) — comissões da equipe
 * comercial sobre os fechamentos do período. 100% derivado dos Leads (Comercial);
 * a REGRA (base + % por papel) é configurável em Configurações.
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, HandCoins, Trophy, Percent, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, FilterPill, Badge, DataTable, type Column, type Tone } from '@/components/ds'
import { MarginKPICard } from '@/components/financeiro/MarginKPICard'
import { useComercial } from '@/pages/comercial/store'
import { useFinanceiro } from './store'
import { formatBRL } from './despesasCalculator'
import { labelPeriodo, mesesDoPeriodo, shiftRef, type ModoPeriodo } from './dreCalculator'
import { BASES_COMISSAO, calculateComissoes, type ComissaoPessoa, type PapelComissao } from './comissaoCalculator'

const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const PAPEL_TONE: Record<PapelComissao, Tone> = { Closer: 'accent', SDR: 'info', 'Social Selling': 'purple' }

export default function Comissionamento() {
  const { leads } = useComercial()
  const { comissaoConfig } = useFinanceiro()
  const [ref, setRef] = useState(mesAtual())
  const [modo, setModo] = useState<ModoPeriodo>('mes')

  const r = useMemo(() => calculateComissoes(leads, comissaoConfig, mesesDoPeriodo(ref, modo)), [leads, comissaoConfig, ref, modo])
  const baseLabel = BASES_COMISSAO.find((b) => b.key === comissaoConfig.base)?.label ?? comissaoConfig.base

  const columns: Column<ComissaoPessoa>[] = [
    { key: 'nome', header: 'Pessoa', render: (p) => <span className="font-medium text-zinc-100">{p.nome}</span> },
    { key: 'papel', header: 'Papel', render: (p) => <Badge tone={PAPEL_TONE[p.papel]}>{p.papel}</Badge> },
    { key: 'deals', header: 'Deals', align: 'right', render: (p) => <span className="tabular-nums text-zinc-300">{p.deals}</span> },
    { key: 'base', header: `Base (${baseLabel})`, align: 'right', render: (p) => <span className="tabular-nums text-zinc-300">{formatBRL(p.base)}</span> },
    { key: 'comissao', header: 'Comissão', align: 'right', render: (p) => <span className="font-semibold tabular-nums text-green-300">{formatBRL(p.comissao)}</span> },
  ]

  return (
    <div>
      <PageHeader
        title="Comissionamento"
        description="Comissões da equipe comercial sobre os fechamentos"
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

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MarginKPICard label="Total de comissões" value={formatBRL(r.totalComissao)} icon={<HandCoins size={13} />} tone="success" sub="a pagar no período" />
        <MarginKPICard label="Fechamentos" value={String(r.fechamentos)} icon={<Trophy size={13} />} tone="info" sub="deals ganhos" />
        <MarginKPICard label={`Base (${baseLabel})`} value={formatBRL(r.totalBase)} icon={<Users size={13} />} tone="purple" sub="soma dos fechamentos" />
        <MarginKPICard label="Comissão / base" value={r.totalBase > 0 ? `${((r.totalComissao / r.totalBase) * 100).toFixed(1)}%` : '—'} icon={<Percent size={13} />} tone="neutral" sub="peso efetivo" />
      </div>

      {/* Regra vigente */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-soft/40 px-4 py-2.5 text-[11px] text-muted">
        <span className="font-semibold uppercase tracking-wider text-zinc-300">Regra vigente</span>
        <span>base <strong className="text-zinc-200">{baseLabel}</strong></span>
        <Dot /> <span>Closer <strong className="text-zinc-200">{comissaoConfig.pctCloser}%</strong></span>
        <Dot /> <span>SDR <strong className="text-zinc-200">{comissaoConfig.pctSdr}%</strong></span>
        <Dot /> <span>Social Selling <strong className="text-zinc-200">{comissaoConfig.pctSocial}%</strong></span>
        <Link to="/configuracoes" className="ml-auto text-brand-300 hover:underline">Ajustar em Configurações</Link>
      </div>

      <DataTable
        columns={columns}
        rows={r.porPessoa}
        rowKey={(p) => p.id}
        emptyLabel="Nenhum fechamento no período — nada a comissionar."
        minWidth={640}
      />
    </div>
  )
}

function Dot() {
  return <span className="text-muted/50">·</span>
}
