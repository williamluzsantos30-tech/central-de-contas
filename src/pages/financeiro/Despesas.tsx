/**
 * Tela "Despesas" (Financeiro › Despesas) — lançamento e controle de custos.
 * KPIs do mês, filtros, tabela (com recorrências projetadas) e modal de
 * cadastro/edição. Base de dados dos futuros módulos financeiros (DRE etc.).
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Wallet, Lock, Repeat, AlertTriangle } from 'lucide-react'
import { PageHeader, KPICard, PrimaryButton, FilterBar, FilterPill } from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { DespesasTable } from '@/components/financeiro/DespesasTable'
import { DespesaFormModal } from '@/components/financeiro/DespesaFormModal'
import { useFinanceiro } from './store'
import {
  CATEGORIAS,
  SETORES_DESPESA,
  STATUS_DESPESA,
  type CategoriaDespesa,
  type Despesa,
  type OrigemDespesa,
  type StatusDespesa,
} from './mockDespesas'
import {
  calculateExpensesSummary,
  despesasDoPeriodo,
  formatBRL,
  formatMesAno,
  mesAtualISO,
  shiftPeriodo,
  type ExpenseFilters,
} from './despesasCalculator'

export default function Despesas() {
  const { despesas, excluirDespesa } = useFinanceiro()
  const [periodo, setPeriodo] = useState(mesAtualISO())
  const [fCategoria, setFCategoria] = useState<CategoriaDespesa | ''>('')
  const [fSetor, setFSetor] = useState('')
  const [fStatus, setFStatus] = useState<StatusDespesa | ''>('')
  const [fOrigem, setFOrigem] = useState<OrigemDespesa | ''>('')
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Despesa | null>(null)

  const filtros: ExpenseFilters = useMemo(
    () => ({ categoria: fCategoria, setor: fSetor, status: fStatus, origem: fOrigem, busca: q }),
    [fCategoria, fSetor, fStatus, fOrigem, q],
  )

  // KPIs somam o mês INTEIRO (sem a busca/filtros de tabela, exceto período).
  const resumo = useMemo(() => calculateExpensesSummary(despesas, periodo), [despesas, periodo])
  const rows = useMemo(() => despesasDoPeriodo(despesas, periodo, filtros), [despesas, periodo, filtros])

  function abrirNova() {
    setEditando(null)
    setModalOpen(true)
  }
  function abrirEdicao(d: Despesa) {
    setEditando(d)
    setModalOpen(true)
  }

  return (
    <div>
      <Breadcrumb trilha={['Financeiro', 'Despesas']} />
      <PageHeader
        title="Despesas"
        description="Lançamento e controle de custos da operação"
        actions={
          <div className="flex items-center gap-2">
            <MonthNavigator periodo={periodo} onChange={setPeriodo} />
            <PrimaryButton size="sm" onClick={abrirNova}>
              <Plus size={14} /> Nova Despesa
            </PrimaryButton>
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="Total de despesas do mês"
          value={formatBRL(resumo.total)}
          icon={<Wallet size={13} />}
          tone="neutral"
          sub={`${resumo.lancamentos} lançamento${resumo.lancamentos === 1 ? '' : 's'}`}
        />
        <KPICard
          label="Despesas fixas"
          value={formatBRL(resumo.fixas)}
          icon={<Lock size={13} />}
          tone="info"
          sub="recorrentes mensais fixas"
        />
        <KPICard
          label="Despesas variáveis"
          value={formatBRL(resumo.variaveis)}
          icon={<Repeat size={13} />}
          tone="purple"
          sub="variáveis + únicas"
        />
        <KPICard
          label="Pendentes / atrasadas"
          value={formatBRL(resumo.aberto)}
          icon={<AlertTriangle size={13} />}
          tone={resumo.atrasadasCount > 0 ? 'danger' : resumo.abertoCount > 0 ? 'attention' : 'success'}
          sub={
            resumo.atrasadasCount > 0
              ? `${resumo.abertoCount} em aberto · ${resumo.atrasadasCount} atrasada${resumo.atrasadasCount === 1 ? '' : 's'}`
              : `${resumo.abertoCount} em aberto`
          }
        />
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <FilterBar>
          <FilterPill value={fCategoria} onChange={(v) => setFCategoria(v as CategoriaDespesa | '')} placeholder="Todas categorias" options={CATEGORIAS.map((c) => ({ value: c.key, label: c.label }))} />
          <FilterPill value={fSetor} onChange={setFSetor} placeholder="Todos setores" options={SETORES_DESPESA.map((s) => ({ value: s, label: s }))} />
          <FilterPill value={fStatus} onChange={(v) => setFStatus(v as StatusDespesa | '')} placeholder="Todos status" options={STATUS_DESPESA.map((s) => ({ value: s.key, label: s.label }))} />
          <FilterPill value={fOrigem} onChange={(v) => setFOrigem(v as OrigemDespesa | '')} placeholder="Todas origens" options={[{ value: 'manual', label: 'Manual' }, { value: 'integracao_externa', label: 'Integração' }]} />
        </FilterBar>
      </div>

      <DespesasTable
        rows={rows}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar por descrição ou fornecedor...' }}
        onEdit={abrirEdicao}
        onExcluir={(d) => excluirDespesa(d.id)}
      />

      <DespesaFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        despesa={editando}
        periodoPadrao={periodo}
      />
    </div>
  )
}

/** Navegação de período (mês/ano) com ◀ ▶. */
function MonthNavigator({ periodo, onChange }: { periodo: string; onChange: (p: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-soft p-0.5">
      <button onClick={() => onChange(shiftPeriodo(periodo, -1))} className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100" title="Mês anterior">
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-[7.5rem] text-center text-xs font-medium capitalize text-zinc-100">{formatMesAno(periodo)}</span>
      <button onClick={() => onChange(shiftPeriodo(periodo, 1))} className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100" title="Próximo mês">
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
