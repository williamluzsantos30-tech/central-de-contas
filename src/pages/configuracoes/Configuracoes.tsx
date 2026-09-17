/**
 * Configurações — metas, equipe operacional e parâmetros do sistema.
 * Construída sobre o design system (@/components/ds).
 */
import { useMemo, useState } from 'react'
import {
  Settings2,
  Users2,
  ShieldCheck,
  ClipboardList,
  KeyRound,
  Save,
  Clock,
  Target,
  TrendingUp,
  RefreshCw,
  Calculator,
  Info,
  Lock,
  Zap,
  AlertTriangle,
  DollarSign,
  Plus,
  BarChart3,
} from 'lucide-react'
import { PageHeader, PrimaryButton, OutlineButton, Badge, FormField, Input, Select } from '@/components/ds'
import { cn } from '@/lib/utils'
import {
  agregadoMetas,
  squadsOperacionais,
  PARAMS_INICIAIS,
  SQUADS_INICIAIS,
  ROLES_INICIAIS,
  type Params,
  type Role,
  type Squad,
} from './mockSettings'
import {
  SettingsTabs,
  GoalCard,
  MiniStat,
  SquadCalcCard,
  SquadMetricPanel,
  SquadsTable,
  RolesTable,
  NewSquadModal,
  formatBRL,
  type TabDef,
} from './components'

const TABS: TabDef[] = [
  { key: 'geral', label: 'Geral', icon: Settings2 },
  { key: 'equipe', label: 'Equipe Operacional', icon: Users2 },
  { key: 'seguranca', label: 'Segurança', icon: ShieldCheck },
  { key: 'formularios', label: 'Formulários', icon: ClipboardList },
  { key: 'acessos', label: 'Gerenciar Acessos', icon: KeyRound },
]

const MESES = ['setembro 2026', 'agosto 2026', 'julho 2026', 'junho 2026']

export default function Configuracoes() {
  const [tab, setTab] = useState('geral')
  const [params, setParams] = useState<Params>(PARAMS_INICIAIS)
  const [squads, setSquads] = useState<Squad[]>(SQUADS_INICIAIS)
  const [roles, setRoles] = useState<Role[]>(ROLES_INICIAIS)
  const [dirty, setDirty] = useState(false)
  const [mes, setMes] = useState(MESES[0])
  const [novoSquadOpen, setNovoSquadOpen] = useState(false)

  const ops = useMemo(() => squadsOperacionais(squads), [squads])
  const agg = useMemo(() => agregadoMetas(squads), [squads])

  function setParam<K extends keyof Params>(k: K, v: number) {
    setParams((p) => ({ ...p, [k]: v }))
    setDirty(true)
  }

  function toggleSquad(id: string) {
    setSquads((prev) => prev.map((s) => (s.id === id ? { ...s, ativo: !s.ativo } : s)))
  }
  function excluirSquad(id: string) {
    setSquads((prev) => prev.filter((s) => s.id !== id))
  }
  function criarSquad(nome: string, descricao: string, lider: string | null) {
    setSquads((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        nome,
        descricao: descricao || null,
        lider,
        ativo: true,
        hasLinkedClients: false,
        clientes: 0,
        mrr: 0,
        metas: { indicacoes: 0, novaReceita: 0, nrr: 95, logoChurn: 0, revChurn: 0 },
        atual: { novaReceita: 0, indicacoes: 0, nrr: 0, logoChurn: 0, revChurn: 0 },
      },
    ])
  }
  function toggleRole(id: string) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ativo: !r.ativo } : r)))
  }

  return (
    <div>
      <nav className="mb-1 text-[11px] text-muted">Configurações</nav>
      <PageHeader
        title="Configurações"
        description="Configure metas, equipe operacional e parâmetros do sistema"
        actions={
          <PrimaryButton disabled={!dirty} onClick={() => setDirty(false)}>
            <Save size={14} /> Salvar Alterações
          </PrimaryButton>
        }
      />

      <p className="mb-4 -mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
        <Clock size={12} /> Última atualização: 03/08/2026, 14:56
      </p>

      <div className="mb-5">
        <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'geral' && (
        <div className="space-y-5">
          {/* Metas Mensais */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Metas Mensais</p>
                <Badge tone="neutral"><Lock size={9} /> Automático</Badge>
              </div>
              <OutlineButton size="sm" onClick={() => setSquads((s) => [...s])}>
                <RefreshCw size={12} /> Recalcular
              </OutlineButton>
            </div>
            <p className="mb-4 text-[11px] text-muted">
              Consolidação das metas dos squads para <strong className="text-zinc-300">Setembro de 2026</strong>. Atualizado ao encerrar o mês anterior.
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <GoalCard icon={Target} accent="laranja" label="Meta do Mês" value={formatBRL(agg.metaDoMes)} hint="Soma das metas de Nova Receita dos squads" />
              <GoalCard icon={TrendingUp} accent="verde" label="Meta Mínima" value={formatBRL(agg.metaMinima)} hint="Necessária para atingir NRR de 95%" />
              <GoalCard icon={Clock} label="Meta Recomendada" value={formatBRL(agg.metaRecomendada)} hint="Mínima × 1,75 (patamar de crescimento)" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat icon={Users2} label="Squads operacionais" value={String(agg.squadsOperacionais)} />
              <MiniStat icon={Zap} label="Indicações totais" value={String(agg.indicacoesTotais)} />
              <MiniStat icon={AlertTriangle} label="Limite Logo Churn" value={String(agg.limiteLogoChurn)} />
              <MiniStat icon={DollarSign} label="Limite Rev. Churn" value={formatBRL(agg.limiteRevChurn)} />
            </div>

            <div className="mt-4 rounded-lg border border-border bg-bg-soft/40 p-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200">
                <Info size={12} className="text-brand-300" /> Como é calculado:
              </p>
              <ul className="space-y-1 text-[10px] text-muted">
                <li>· Nova Receita por squad = MRR × (95 − (100 − {params.churnLimitePct}))/100 = {95 - (100 - params.churnLimitePct)}% do MRR</li>
                <li>· Indicações = máx(3, [clientes ÷ 3])</li>
                <li>· Churn = {params.churnLimitePct}% de clientes/MRR</li>
                <li>· Meta do Mês = soma das metas de Nova Receita de todos os squads operacionais</li>
              </ul>
            </div>
          </section>

          {/* Como cada meta é calculada por squad */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator size={14} className="text-orange-300" />
                <h2 className="text-sm font-semibold text-zinc-100">Como cada meta é calculada por squad</h2>
              </div>
              <Badge tone="neutral">Setembro de 2026</Badge>
            </div>
            <p className="mb-4 text-[11px] text-muted">
              Portfólio real (clientes ativos e MRR) aplicado às fórmulas oficiais. Base editável no Painel de Metas dos Squads.
            </p>
            <div className="space-y-4">
              {ops.map((s) => (
                <SquadCalcCard key={s.id} squad={s} params={params} />
              ))}
            </div>
          </section>

          {/* Parâmetro de cálculo */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Parâmetro de Cálculo</p>
            <FormField label="Limite Máximo de Churn Mensal (%)" hint="Usado para calcular automaticamente metas de logo churn, rev. churn e nova receita dos squads" className="max-w-sm">
              <Input type="number" value={params.churnLimitePct} onChange={(e) => setParam('churnLimitePct', Number(e.target.value))} />
            </FormField>
          </section>

          {/* Onboarding */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Onboarding</p>
            <FormField label="SLA Padrão de Onboarding (dias)" className="max-w-sm">
              <Input type="number" value={params.slaOnboardingDias} onChange={(e) => setParam('slaOnboardingDias', Number(e.target.value))} />
            </FormField>
          </section>

          {/* Thresholds do mapa de clientes */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Thresholds do Mapa de Clientes</p>
            <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Receita Alta (R$)">
                <Input type="number" value={params.receitaAlta} onChange={(e) => setParam('receitaAlta', Number(e.target.value))} />
              </FormField>
              <FormField label="Saúde Alta (NPS mínimo)">
                <Input type="number" value={params.saudeAltaNps} onChange={(e) => setParam('saudeAltaNps', Number(e.target.value))} />
              </FormField>
            </div>
          </section>

          {/* Regras de classificação NPS */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Regras de Classificação NPS</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="Satisfeito (NPS ≥)">
                <Input type="number" value={params.npsSatisfeito} onChange={(e) => setParam('npsSatisfeito', Number(e.target.value))} />
              </FormField>
              <FormField label="Neutro (NPS ≥)">
                <Input type="number" value={params.npsNeutro} onChange={(e) => setParam('npsNeutro', Number(e.target.value))} />
              </FormField>
              <FormField label="Insatisfeito (NPS ≤)">
                <Input type="number" value={params.npsInsatisfeito} onChange={(e) => setParam('npsInsatisfeito', Number(e.target.value))} />
              </FormField>
            </div>
            <div className="mt-3 space-y-2">
              <PreviewNps cor="verde" texto={`Satisfeito: NPS ≥ ${params.npsSatisfeito}`} />
              <PreviewNps cor="laranja" texto={`Neutro: NPS ${params.npsNeutro} - ${params.npsSatisfeito - 1}`} />
              <PreviewNps cor="vermelho" texto={`Insatisfeito: NPS ≤ ${params.npsInsatisfeito}`} />
            </div>
          </section>
        </div>
      )}

      {tab === 'equipe' && (
        <div className="space-y-5">
          {/* Painel de metas do mês */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-orange-300" />
                <h2 className="text-sm font-semibold text-zinc-100">Painel de Metas do Mês</h2>
              </div>
              <Select value={mes} onChange={(e) => setMes(e.target.value)} className="w-44">
                {MESES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {ops.map((s) => (
                <SquadMetricPanel key={s.id} squad={s} onEdit={() => setDirty(true)} />
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5 text-[11px] text-muted">
              <BarChart3 size={13} className="mt-0.5 shrink-0 text-brand-300" />
              Os valores de Nova Receita, NRR, Logo Churn e Rev. Churn são calculados automaticamente com base nas movimentações do mês selecionado. Apenas Indicações e Metas são editáveis.
            </div>
          </section>

          {/* Squads */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 size={14} className="text-brand-300" />
                <h2 className="text-sm font-semibold text-zinc-100">Squads</h2>
              </div>
              <PrimaryButton size="sm" onClick={() => setNovoSquadOpen(true)}>
                <Plus size={13} /> Novo Squad
              </PrimaryButton>
            </div>
            <SquadsTable squads={squads} onToggle={toggleSquad} onEdit={() => setDirty(true)} onDelete={excluirSquad} />
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200/90">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-300" />
              Squads com vínculos a clientes ou membros não podem ser excluídos, apenas inativados. Registros inativos mantêm histórico para métricas e relatórios.
            </div>
          </section>

          {/* Papéis operacionais */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-brand-300" />
                <h2 className="text-sm font-semibold text-zinc-100">Papéis Operacionais</h2>
              </div>
              <PrimaryButton size="sm">
                <Plus size={13} /> Novo Papel
              </PrimaryButton>
            </div>
            <RolesTable roles={roles} onToggle={toggleRole} />
          </section>
        </div>
      )}

      {(tab === 'seguranca' || tab === 'formularios' || tab === 'acessos') && (
        <div className="rounded-lg border border-dashed border-border bg-bg-soft/30 p-12 text-center">
          <p className="text-sm text-zinc-200">{TABS.find((t) => t.key === tab)?.label}</p>
          <p className="mt-1 text-[11px] text-muted">Em breve.</p>
        </div>
      )}

      <NewSquadModal open={novoSquadOpen} onClose={() => setNovoSquadOpen(false)} onCreate={criarSquad} />
    </div>
  )
}

const PREVIEW_COR = {
  verde: { dot: 'bg-green-500', cls: 'border-green-500/30 bg-green-500/[0.06] text-green-200' },
  laranja: { dot: 'bg-orange-500', cls: 'border-orange-500/30 bg-orange-500/[0.06] text-orange-200' },
  vermelho: { dot: 'bg-red-500', cls: 'border-red-500/30 bg-red-500/[0.06] text-red-200' },
} as const

function PreviewNps({ cor, texto }: { cor: keyof typeof PREVIEW_COR; texto: string }) {
  const c = PREVIEW_COR[cor]
  return (
    <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', c.cls)}>
      <span className={cn('h-2 w-2 rounded-full', c.dot)} />
      {texto}
    </div>
  )
}
