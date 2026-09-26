/**
 * Gestão de Flags — Overview (Tela 1).
 * Filtros + 4 KPIs (derivados) + tabela de colaboradores. "Registrar Flag"
 * abre o modal; ao registrar, contadores/KPIs/linha se atualizam sozinhos.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users2, AlertTriangle, XCircle, OctagonAlert, Eye, Flag as FlagIcon } from 'lucide-react'
import {
  PageHeader,
  PrimaryButton,
  KPICard,
  FilterBar,
  FilterPill,
  DataTable,
  Badge,
  type Column,
  type RowTone,
} from '@/components/ds'
import { cn } from '@/lib/utils'
import { useFlags } from './store'
import { RegisterFlagModal, dataBR } from './components'
import { derivar, derivarKpis, type Colaborador } from './mockFlags'

const PERIODOS = [
  { value: '90', label: 'Últimos 90 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '180', label: 'Últimos 180 dias' },
  { value: '', label: 'Todo o período' },
]

export default function Flags() {
  const { colaboradores, squadsAtivos, cargos, registrarFlag } = useFlags()
  const [modalOpen, setModalOpen] = useState(false)
  const [fSquad, setFSquad] = useState('')
  const [fCargo, setFCargo] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPeriodo, setFPeriodo] = useState('90')

  // Só membros ATIVOS aparecem na operação de flags.
  const ativos = useMemo(() => colaboradores.filter((c) => c.ativo), [colaboradores])

  // Squad/Cargo escopam KPIs + tabela; Status só a tabela; Período é visual.
  const base = useMemo(
    () => ativos.filter((c) => (!fSquad || c.squad === fSquad) && (!fCargo || c.cargo === fCargo)),
    [ativos, fSquad, fCargo],
  )
  const kpis = useMemo(() => derivarKpis(base), [base])
  const linhas = useMemo(
    () => base.filter((c) => !fStatus || derivar(c).statusRisco === fStatus),
    [base, fStatus],
  )

  const columns: Column<Colaborador>[] = [
    {
      key: 'nome',
      header: 'Nome',
      sortValue: (c) => c.nome,
      render: (c) => (
        <Link to={`/flags/${c.id}`} className="font-medium text-zinc-100 hover:text-brand-300 hover:underline">
          {c.nome}
        </Link>
      ),
    },
    { key: 'cargo', header: 'Cargo', sortValue: (c) => c.cargo, render: (c) => <span className="text-zinc-300">{c.cargo}</span> },
    { key: 'squad', header: 'Squad', sortValue: (c) => c.squad, render: (c) => <span className="text-zinc-200">{c.squad ?? '—'}</span> },
    {
      key: 'amarelas',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> Amarelas
        </span>
      ),
      align: 'center',
      sortValue: (c) => derivar(c).amarelasAtivas,
      render: (c) => <ContadorFlag n={derivar(c).amarelasAtivas} cor="amarela" />,
    },
    {
      key: 'vermelha',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Vermelha
        </span>
      ),
      align: 'center',
      sortValue: (c) => (derivar(c).vermelhaAtiva ? 1 : 0),
      render: (c) => <ContadorFlag n={derivar(c).vermelhaAtiva ? 1 : 0} cor="vermelha" />,
    },
    {
      key: 'ultima',
      header: 'Última Flag',
      sortValue: (c) => derivar(c).ultimaFlag,
      render: (c) => {
        const u = derivar(c).ultimaFlag
        return <span className="tabular-nums text-zinc-300">{u ? dataBR(u) : '—'}</span>
      },
    },
    {
      key: 'status',
      header: 'Status de Risco',
      sortValue: (c) => ordemRisco(c),
      render: (c) => {
        const critico = derivar(c).statusRisco === 'critico'
        return <Badge tone={critico ? 'warning' : 'neutral'}>{critico ? 'Crítico' : 'Normal'}</Badge>
      },
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (c) => (
        <Link
          to={`/flags/${c.id}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-brand-300"
        >
          <Eye size={12} /> Ver detalhes
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Gestão de Flags"
        description="Controle de performance e disciplina operacional"
        actions={
          <PrimaryButton onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Registrar Flag
          </PrimaryButton>
        }
      />

      {/* Filtros */}
      <FilterBar className="mb-4">
        <FilterPill value={fSquad} onChange={setFSquad} placeholder="Todos os squads" options={squadsAtivos.map((s) => ({ value: s, label: s }))} />
        <FilterPill value={fCargo} onChange={setFCargo} placeholder="Todos os cargos" options={cargos.map((c) => ({ value: c, label: c }))} />
        <FilterPill
          value={fStatus}
          onChange={setFStatus}
          placeholder="Todos"
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'critico', label: 'Crítico' },
          ]}
        />
        <FilterPill value={fPeriodo} onChange={setFPeriodo} options={PERIODOS} />
      </FilterBar>

      {/* KPIs — cor de alerta só quando há flag (zero é neutro) */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard icon={<Users2 size={13} />} label="Colaboradores com Flags" value={String(kpis.colaboradoresComFlags)} sub="com flag ativa" />
        <KPICard icon={<AlertTriangle size={13} className={kpis.amarelasAtivas ? 'text-yellow-400' : undefined} />} label="Flags Amarelas Ativas" value={String(kpis.amarelasAtivas)} tone={kpis.amarelasAtivas ? 'attention' : 'neutral'} sub="amarelas em vigor" />
        <KPICard icon={<XCircle size={13} className={kpis.vermelhasAtivas ? 'text-red-400' : undefined} />} label="Flags Vermelhas Ativas" value={String(kpis.vermelhasAtivas)} tone={kpis.vermelhasAtivas ? 'danger' : 'neutral'} sub="permanentes" />
        <KPICard icon={<OctagonAlert size={13} className={kpis.elegiveisDesligamento ? 'text-red-400' : undefined} />} label="Elegíveis Desligamento" value={String(kpis.elegiveisDesligamento)} tone={kpis.elegiveisDesligamento ? 'danger' : 'neutral'} sub="com flag vermelha" />
      </div>

      {/* Tabela */}
      <div className="mb-3 flex items-center gap-2">
        <FlagIcon size={14} className="text-brand-300" />
        <h2 className="text-sm font-semibold text-zinc-100">Colaboradores</h2>
      </div>
      <DataTable
        columns={columns}
        rows={linhas}
        rowKey={(c) => c.id}
        rowTone={tomDaLinha}
        defaultSort={{ key: 'status', dir: 'asc' }}
        minWidth={900}
        emptyLabel="Nenhum colaborador encontrado."
      />

      <RegisterFlagModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        colaboradores={ativos}
        onRegister={registrarFlag}
      />
    </div>
  )
}

/** Mais grave primeiro: vermelha ativa (0) → crítico (1) → normal (2). */
function ordemRisco(c: Colaborador): number {
  const d = derivar(c)
  return d.vermelhaAtiva ? 0 : d.statusRisco === 'critico' ? 1 : 2
}

/** Linha tingida só pra quem pede ação (vermelha = desligamento; crítico = atenção). */
function tomDaLinha(c: Colaborador): RowTone | undefined {
  const r = ordemRisco(c)
  return r === 0 ? 'danger' : r === 1 ? 'warning' : undefined
}

function ContadorFlag({ n, cor }: { n: number; cor: 'amarela' | 'vermelha' }) {
  if (n === 0) return <span className="tabular-nums text-muted">0</span>
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center gap-1 rounded-full border px-1.5 text-[11px] font-semibold tabular-nums',
        cor === 'amarela'
          ? 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300'
          : 'border-red-500/40 bg-red-500/15 text-red-300',
      )}
    >
      {n}
    </span>
  )
}
