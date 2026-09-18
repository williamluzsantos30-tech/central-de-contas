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
      render: (c) => (
        <Link to={`/flags/${c.id}`} className="font-medium text-sky-300 hover:text-sky-200 hover:underline">
          {c.nome}
        </Link>
      ),
    },
    { key: 'cargo', header: 'Cargo', render: (c) => <span className="text-zinc-300">{c.cargo}</span> },
    { key: 'squad', header: 'Squad', render: (c) => <span className="text-zinc-200">{c.squad ?? '—'}</span> },
    {
      key: 'amarelas',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> Amarelas
        </span>
      ),
      align: 'center',
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
      render: (c) => <ContadorFlag n={derivar(c).vermelhaAtiva ? 1 : 0} cor="vermelha" />,
    },
    {
      key: 'ultima',
      header: 'Última Flag',
      render: (c) => {
        const u = derivar(c).ultimaFlag
        return <span className="tabular-nums text-zinc-300">{u ? dataBR(u) : '—'}</span>
      },
    },
    {
      key: 'status',
      header: 'Status de Risco',
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
      <nav className="mb-1 text-[11px] text-muted">Flags</nav>
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

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard icon={<Users2 size={13} />} label="Colaboradores com Flags" value={String(kpis.colaboradoresComFlags)} sub="com flag ativa" />
        <KPICard icon={<AlertTriangle size={13} className="text-yellow-400" />} label="Flags Amarelas Ativas" value={String(kpis.amarelasAtivas)} tone="attention" sub="amarelas em vigor" />
        <KPICard icon={<XCircle size={13} className="text-red-400" />} label="Flags Vermelhas Ativas" value={String(kpis.vermelhasAtivas)} tone="danger" sub="permanentes" />
        <KPICard icon={<OctagonAlert size={13} className="text-red-400" />} label="Elegíveis Desligamento" value={String(kpis.elegiveisDesligamento)} tone="danger" sub="com flag vermelha" />
      </div>

      {/* Tabela */}
      <div className="mb-3 flex items-center gap-2">
        <FlagIcon size={14} className="text-brand-300" />
        <h2 className="text-sm font-semibold text-zinc-100">Colaboradores</h2>
      </div>
      <DataTable columns={columns} rows={linhas} rowKey={(c) => c.id} minWidth={900} emptyLabel="Nenhum colaborador encontrado." />

      <RegisterFlagModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        colaboradores={ativos}
        onRegister={registrarFlag}
      />
    </div>
  )
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
