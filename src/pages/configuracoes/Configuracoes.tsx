/**
 * Configurações — metas, equipe operacional e parâmetros do sistema.
 * Construída sobre o design system (@/components/ds).
 */
import { useEffect, useMemo, useState } from 'react'
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
import { supabase } from '@/lib/supabase'
import type { PapelOperacional, Profile } from '@/types/database'
import {
  agregadoMetas,
  squadsOperacionais,
  PARAMS_INICIAIS,
  type Params,
  type Role,
  type Squad,
  type TeamMember,
} from './mockSettings'
import {
  SettingsTabs,
  GoalCard,
  MiniStat,
  SquadCalcCard,
  SquadMetricPanel,
  SquadsTable,
  RolesTable,
  SquadFormModal,
  RoleFormModal,
  TeamMembersTable,
  EditMemberModal,
  EditSquadGoalsModal,
  formatBRL,
  type TabDef,
  type MetasEdicao,
} from './components'

const TABS: TabDef[] = [
  { key: 'geral', label: 'Geral', icon: Settings2 },
  { key: 'equipe', label: 'Equipe Operacional', icon: Users2 },
  { key: 'seguranca', label: 'Segurança', icon: ShieldCheck },
  { key: 'formularios', label: 'Formulários', icon: ClipboardList },
  { key: 'acessos', label: 'Gerenciar Acessos', icon: KeyRound },
]

const MESES = ['setembro 2026', 'agosto 2026', 'julho 2026', 'junho 2026']

// Linha crua da tabela `squads` (com colunas de metas da migration 087).
type SquadRow = {
  id: string
  nome: string
  descricao: string | null
  lider_id: string | null
  ativo: boolean
  meta_indicacoes: number
  meta_nova_receita: number
  meta_nrr: number
  meta_logo_churn: number
  meta_rev_churn: number
  atual_indicacoes: number
  atual_nova_receita: number
  atual_nova_receita_desc: string | null
  lider?: { id: string; nome: string } | null
}
type ClienteMini = {
  squad: string | null
  verba_mensal: number | null
  status: string
  arquivado_em: string | null
}

// Churn deste mês corrente (o "atual" de churn/NRR é calculado dos clientes).
function noMesCorrente(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export default function Configuracoes() {
  const [tab, setTab] = useState('geral')
  const [params, setParams] = useState<Params>(PARAMS_INICIAIS)
  // Squads (+ metas, migration 087), papéis e membros vêm do banco — fonte
  // única. Guardamos as linhas cruas e mapeamos pros shapes dos componentes.
  const [squadsDB, setSquadsDB] = useState<SquadRow[]>([])
  const [clientesDB, setClientesDB] = useState<ClienteMini[]>([])
  const [papeisDB, setPapeisDB] = useState<PapelOperacional[]>([])
  const [profilesDB, setProfilesDB] = useState<Profile[]>([])
  const [dirty, setDirty] = useState(false)
  const [mes, setMes] = useState(MESES[0])
  const [squadForm, setSquadForm] = useState<{ mode: 'create' | 'edit'; squad: Squad | null } | null>(null)
  const [metasSquad, setMetasSquad] = useState<Squad | null>(null)
  const [roleForm, setRoleForm] = useState<{ mode: 'create' | 'edit'; role: Role | null } | null>(null)
  const [editMember, setEditMember] = useState<Profile | null>(null)

  // Carrega papéis + membros (profiles com papel/squad embarcados) do banco.
  async function loadEquipe() {
    const [pRes, prRes, sRes, cRes] = await Promise.all([
      supabase.from('papeis_operacionais').select('*').order('nome'),
      supabase
        .from('profiles')
        // FK explícita: profiles tem 2 relações com squads (squad_id e o
        // lider_id de squads), então desambiguamos pelo nome da constraint.
        .select('*, papel:papeis_operacionais!profiles_papel_fk(*), squad:squads!profiles_squad_fk(*)')
        .order('nome'),
      // Squads com líder embarcado (FK por coluna lider_id, pra desambiguar).
      supabase.from('squads').select('*, lider:profiles!lider_id(id, nome)').order('nome'),
      // Clientes (mínimo) pra calcular clientes/MRR/churn por squad em tempo real.
      supabase.from('clientes').select('squad, verba_mensal, status, arquivado_em'),
    ])
    setPapeisDB((pRes.data as PapelOperacional[]) ?? [])
    setProfilesDB((prRes.data as Profile[]) ?? [])
    setSquadsDB((sRes.data as SquadRow[]) ?? [])
    setClientesDB((cRes.data as ClienteMini[]) ?? [])
  }
  useEffect(() => {
    loadEquipe()
  }, [])

  // DB → shapes que RolesTable/TeamMembersTable esperam.
  const roles = useMemo<Role[]>(
    () =>
      papeisDB.map((p) => ({
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
        escopo: p.escopo,
        permissoes: p.permissoes ?? [],
        jdPreenchida: p.jd_preenchida,
        ativo: p.ativo,
      })),
    [papeisDB],
  )
  const members = useMemo<TeamMember[]>(
    () =>
      profilesDB.map((pr) => ({
        id: pr.id,
        nome: pr.nome,
        email: pr.email,
        papel: pr.papel?.nome ?? null,
        squad: pr.squad?.nome ?? null,
        ativo: pr.ativo,
      })),
    [profilesDB],
  )

  // DB → shape Squad que a UI de squads espera. clientes/MRR e o "atual" de
  // churn/NRR são calculados dos clientes vinculados (cliente.squad === nome).
  const squads = useMemo<Squad[]>(() => {
    // Fórmulas oficiais das metas (as mesmas do bloco "Como é calculado"),
    // aplicadas ao portfólio REAL de cada squad. O valor do banco (meta_*)
    // entra só como override manual (quando > 0); senão usa o calculado.
    const churnPct = params.churnLimitePct // ex.: 11
    const gapNrr = Math.max(0, 95 - (100 - churnPct)) // ex.: 6
    return squadsDB.map((row) => {
      const doSquad = clientesDB.filter((c) => c.squad === row.nome)
      const ativos = doSquad.filter((c) => c.status === 'ativo' && !c.arquivado_em)
      const churnsMes = doSquad.filter((c) => noMesCorrente(c.arquivado_em))
      const mrr = ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
      const revChurn = churnsMes.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
      const baseInicio = ativos.length + churnsMes.length
      const nrrAtual = baseInicio > 0 ? (1 - churnsMes.length / baseInicio) * 100 : 100
      const hasLinkedMembers = profilesDB.some((p) => p.squad_id === row.id)

      // Metas calculadas do MRR/clientes reais (override manual se houver).
      const calcIndic = Math.max(3, Math.floor(ativos.length / 3))
      const calcNovaReceita = Math.round(((mrr * gapNrr) / 100) * 100) / 100
      const calcLogoChurn = Math.floor((ativos.length * churnPct) / 100)
      const calcRevChurn = Math.round(((mrr * churnPct) / 100) * 100) / 100

      return {
        id: row.id,
        nome: row.nome,
        descricao: row.descricao,
        lider: row.lider?.nome ?? null,
        liderId: row.lider_id,
        ativo: row.ativo,
        // Só pode excluir squad SEM vínculos (clientes ou membros).
        hasLinkedClients: doSquad.length > 0 || hasLinkedMembers,
        clientes: ativos.length,
        mrr,
        metas: {
          indicacoes: row.meta_indicacoes || calcIndic,
          novaReceita: Number(row.meta_nova_receita) || calcNovaReceita,
          nrr: Number(row.meta_nrr) || 95,
          logoChurn: row.meta_logo_churn || calcLogoChurn,
          revChurn: Number(row.meta_rev_churn) || calcRevChurn,
        },
        atual: {
          indicacoes: row.atual_indicacoes,
          novaReceita: Number(row.atual_nova_receita),
          nrr: Math.round(nrrAtual * 10) / 10,
          logoChurn: churnsMes.length,
          revChurn,
        },
      }
    })
  }, [squadsDB, clientesDB, profilesDB, params])

  const ops = useMemo(() => squadsOperacionais(squads), [squads])
  const agg = useMemo(() => agregadoMetas(squads), [squads])
  // Papel em uso = referenciado por algum membro → não pode ser excluído.
  const papeisEmUso = useMemo(
    () => new Set(members.map((m) => m.papel).filter(Boolean) as string[]),
    [members],
  )

  function setParam<K extends keyof Params>(k: K, v: number) {
    setParams((p) => ({ ...p, [k]: v }))
    setDirty(true)
  }

  async function toggleSquad(id: string) {
    const s = squadsDB.find((x) => x.id === id)
    if (!s) return
    await supabase.from('squads').update({ ativo: !s.ativo }).eq('id', id)
    loadEquipe()
  }
  async function excluirSquad(id: string) {
    await supabase.from('squads').delete().eq('id', id)
    loadEquipe()
  }
  async function criarSquad(nome: string, descricao: string, liderId: string | null) {
    await supabase
      .from('squads')
      .insert({ nome, descricao: descricao || null, lider_id: liderId || null, ativo: true })
    loadEquipe()
  }
  async function atualizarSquad(id: string, nome: string, descricao: string, liderId: string | null) {
    await supabase
      .from('squads')
      .update({ nome, descricao: descricao || null, lider_id: liderId || null })
      .eq('id', id)
    loadEquipe()
  }
  async function salvarMetasSquad(id: string, m: MetasEdicao) {
    const s = squadsDB.find((x) => x.id === id)
    const novaAtual = Number(s?.atual_nova_receita ?? 0) + m.novaReceitaManual
    await supabase
      .from('squads')
      .update({
        meta_indicacoes: m.metaIndicacoes,
        meta_nova_receita: m.metaNovaReceita,
        meta_logo_churn: m.logoChurn,
        meta_rev_churn: m.revChurn,
        atual_indicacoes: m.indicacoesAtual,
        atual_nova_receita: novaAtual,
        atual_nova_receita_desc: m.descricaoManual || null,
      })
      .eq('id', id)
    loadEquipe()
  }
  async function toggleRole(id: string) {
    const r = papeisDB.find((x) => x.id === id)
    if (!r) return
    await supabase.from('papeis_operacionais').update({ ativo: !r.ativo }).eq('id', id)
    loadEquipe()
  }
  async function excluirRole(id: string) {
    await supabase.from('papeis_operacionais').delete().eq('id', id)
    loadEquipe()
  }
  async function criarRole(nome: string, tipo: Role['tipo'], escopo: Role['escopo'], permissoes: string[]) {
    await supabase
      .from('papeis_operacionais')
      .insert({ nome, tipo, escopo, permissoes, jd_preenchida: false, ativo: true })
    loadEquipe()
  }
  async function atualizarRole(id: string, nome: string, tipo: Role['tipo'], escopo: Role['escopo'], permissoes: string[]) {
    await supabase.from('papeis_operacionais').update({ nome, tipo, escopo, permissoes }).eq('id', id)
    loadEquipe()
  }
  async function toggleMembro(id: string) {
    const pr = profilesDB.find((x) => x.id === id)
    if (!pr) return
    await supabase.from('profiles').update({ ativo: !pr.ativo }).eq('id', id)
    loadEquipe()
  }
  // Conecta o membro ao papel e ao squad (grava profiles.papel_id/squad_id).
  async function salvarMembro(id: string, papelId: string | null, squadId: string | null) {
    await supabase.from('profiles').update({ papel_id: papelId, squad_id: squadId }).eq('id', id)
    loadEquipe()
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
              <OutlineButton size="sm" onClick={() => loadEquipe()}>
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
                <SquadMetricPanel key={s.id} squad={s} onEdit={() => setMetasSquad(s)} />
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
              <PrimaryButton size="sm" onClick={() => setSquadForm({ mode: 'create', squad: null })}>
                <Plus size={13} /> Novo Squad
              </PrimaryButton>
            </div>
            <SquadsTable squads={squads} onToggle={toggleSquad} onEdit={(s) => setSquadForm({ mode: 'edit', squad: s })} onDelete={excluirSquad} />
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
              <PrimaryButton size="sm" onClick={() => setRoleForm({ mode: 'create', role: null })}>
                <Plus size={13} /> Novo Papel
              </PrimaryButton>
            </div>
            <RolesTable
              roles={roles}
              emUso={papeisEmUso}
              onToggle={toggleRole}
              onDelete={excluirRole}
              onEdit={(r) => setRoleForm({ mode: 'edit', role: r })}
            />
          </section>

          {/* Membros da equipe */}
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users2 size={14} className="text-brand-300" />
              <h2 className="text-sm font-semibold text-zinc-100">Membros da Equipe</h2>
            </div>
            <TeamMembersTable
              membros={members}
              onToggle={toggleMembro}
              onEdit={(m) => setEditMember(profilesDB.find((p) => p.id === m.id) ?? null)}
            />
            <p className="mt-3 text-[11px] text-muted">
              Membros entram pela tela de acesso (cadastro + aprovação). Aqui você define o{' '}
              <strong className="text-zinc-300">papel</strong> (permissões) e o{' '}
              <strong className="text-zinc-300">squad</strong> de cada um, e ativa/inativa.
            </p>
          </section>
        </div>
      )}

      {(tab === 'seguranca' || tab === 'formularios' || tab === 'acessos') && (
        <div className="rounded-lg border border-dashed border-border bg-bg-soft/30 p-12 text-center">
          <p className="text-sm text-zinc-200">{TABS.find((t) => t.key === tab)?.label}</p>
          <p className="mt-1 text-[11px] text-muted">Em breve.</p>
        </div>
      )}

      <SquadFormModal
        open={!!squadForm}
        mode={squadForm?.mode ?? 'create'}
        squad={squadForm?.squad ?? null}
        liders={profilesDB.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))}
        onClose={() => setSquadForm(null)}
        onSubmit={(nome, desc, liderId) => {
          if (squadForm?.mode === 'edit' && squadForm.squad) atualizarSquad(squadForm.squad.id, nome, desc, liderId)
          else criarSquad(nome, desc, liderId)
        }}
      />
      <EditSquadGoalsModal open={!!metasSquad} squad={metasSquad} onClose={() => setMetasSquad(null)} onSave={salvarMetasSquad} />
      <EditMemberModal
        open={!!editMember}
        nome={editMember?.nome ?? ''}
        papelIdAtual={editMember?.papel_id ?? null}
        squadIdAtual={editMember?.squad_id ?? null}
        papeis={papeisDB.map((p) => ({ id: p.id, nome: p.nome }))}
        squads={squadsDB.filter((s) => s.ativo).map((s) => ({ id: s.id, nome: s.nome }))}
        onClose={() => setEditMember(null)}
        onSave={(papelId, squadId) => {
          if (editMember) salvarMembro(editMember.id, papelId, squadId)
          setEditMember(null)
        }}
      />
      <RoleFormModal
        open={!!roleForm}
        mode={roleForm?.mode ?? 'create'}
        role={roleForm?.role ?? null}
        onClose={() => setRoleForm(null)}
        onSubmit={(nome, tipo, escopo, perms) => {
          if (roleForm?.mode === 'edit' && roleForm.role) atualizarRole(roleForm.role.id, nome, tipo, escopo, perms)
          else criarRole(nome, tipo, escopo, perms)
        }}
      />
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
