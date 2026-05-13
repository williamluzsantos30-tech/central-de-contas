import { useEffect, useMemo, useState } from 'react'
import {
  Settings2,
  Users2,
  ShieldCheck,
  Clock,
  UserCheck,
  UserPlus,
  Check,
  X,
  Hourglass,
  Eye,
  EyeOff,
  RefreshCw,
  Megaphone,
  Palette,
  Share2,
  Briefcase,
  RotateCcw,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Users as UsersIcon,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Target,
  CheckCircle2,
  AlertCircle,
  CircleDot,
  ListChecks,
  BarChart3,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn, formatDateTime, userRoleLabel } from '@/lib/utils'
import {
  CARGOS,
  MODULOS,
  cargoDescricao,
  cargoLabel,
  cargoPermissoesDefault,
  loadCargoPermissoes,
  moduloDescricao,
  moduloLabel,
  resetCargoPermissoes,
  saveCargoPermissoes,
  type Cargo,
  type Modulo,
} from '@/lib/cargos'
import { Textarea } from '@/components/ui/Textarea'
import { TemplatesTab } from '@/pages/Templates'
import MetricasSocialMedia from '@/pages/social/Metricas'
import { EditarFotoPerfilModal } from '@/components/layout/EditarFotoPerfilModal'
import type { Profile, Squad, Tarefa } from '@/types/database'

type AdminTab = 'geral' | 'equipe' | 'performance' | 'metricas' | 'templates' | 'acessos'

interface Stats {
  total: number
  concluidas: number
  atrasadas: number
  taxa: number
  porGestor: { nome: string; pendentes: number; concluidas: number }[]
}

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>('geral')
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [uRes, tRes] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase
        .from('tarefas')
        .select('status, data_vencimento, responsavel_id, responsavel:profiles(nome)'),
    ])
    setUsuarios((uRes.data as Profile[]) ?? [])

    const tarefas = (tRes.data as {
      status: string
      data_vencimento: string | null
      responsavel_id: string | null
      responsavel: { nome: string } | null
    }[]) ?? []
    const total = tarefas.length
    const concluidas = tarefas.filter((t) => t.status === 'concluida').length
    const atrasadas = tarefas.filter(
      (t) => t.status !== 'concluida' && t.data_vencimento && t.data_vencimento < today,
    ).length
    const porGestorMap = new Map<string, { pendentes: number; concluidas: number }>()
    for (const t of tarefas) {
      const nome = t.responsavel?.nome ?? 'Sem responsável'
      const cur = porGestorMap.get(nome) ?? { pendentes: 0, concluidas: 0 }
      if (t.status === 'concluida') cur.concluidas++
      else cur.pendentes++
      porGestorMap.set(nome, cur)
    }
    setStats({
      total,
      concluidas,
      atrasadas,
      taxa: total > 0 ? Math.round((concluidas / total) * 100) : 0,
      porGestor: Array.from(porGestorMap.entries()).map(([nome, v]) => ({ nome, ...v })),
    })
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const pendentes = useMemo(() => usuarios.filter((u) => !u.aprovado), [usuarios])
  const aprovados = useMemo(() => usuarios.filter((u) => u.aprovado), [usuarios])

  const tabs: { key: AdminTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: 'geral', label: 'Geral', icon: Settings2 },
    { key: 'equipe', label: 'Equipe Operacional', icon: Users2 },
    { key: 'performance', label: 'Performance', icon: TrendingUp },
    { key: 'metricas', label: 'Métricas Social Media', icon: BarChart3 },
    { key: 'templates', label: 'Templates', icon: ListChecks },
    { key: 'acessos', label: 'Gerenciar Acessos', icon: ShieldCheck },
  ]

  return (
    <div>
      <PageHeader title="Admin" description="Usuários, relatórios e configurações" />

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-bg-soft/60 p-1">
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-all',
                active
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              <t.icon size={14} />
              {t.label}
              {t.key === 'acessos' && pendentes.length > 0 && (
                <Badge tone="warning" className="ml-0.5">
                  {pendentes.length}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'geral' && <GeralTab stats={stats} usuarios={aprovados} loading={loading} onChange={load} />}
      {tab === 'equipe' && (
        <EquipeOperacionalTab usuarios={aprovados} onChange={load} />
      )}
      {tab === 'performance' && <PerformanceTab usuarios={aprovados} />}
      {tab === 'metricas' && <MetricasSocialMedia embedded />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'acessos' && (
        <AcessosTab
          pendentes={pendentes}
          aprovados={aprovados}
          loading={loading}
          onChange={load}
        />
      )}
    </div>
  )
}

/* =========================================================
   Tab: Geral
   ========================================================= */

function GeralTab({
  stats,
  usuarios,
  loading,
  onChange,
}: {
  stats: Stats | null
  usuarios: Profile[]
  loading: boolean
  onChange: () => void
}) {
  async function updateRole(p: Profile, role: Profile['role']) {
    await supabase.from('profiles').update({ role }).eq('id', p.id)
    onChange()
  }
  async function toggleAtivo(p: Profile) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    onChange()
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-xs text-muted">Taxa de conclusão</p>
            <p className="mt-2 text-2xl font-semibold">{stats?.taxa ?? 0}%</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted">Total de tarefas</p>
            <p className="mt-2 text-2xl font-semibold">{stats?.total ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted">Concluídas</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">{stats?.concluidas ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted">Atrasadas</p>
            <p className="mt-2 text-2xl font-semibold text-red-400">{stats?.atrasadas ?? 0}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-bg-soft">
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={u.nome} url={u.avatar_url} size="sm" />
                          <div>
                            <p className="font-medium">{u.nome}</p>
                            <p className="text-[11px] text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={u.role}
                          onChange={(e) => updateRole(u, e.target.value as Profile['role'])}
                          className="w-32"
                        >
                          <option value="admin">{userRoleLabel.admin}</option>
                          <option value="gestor">{userRoleLabel.gestor}</option>
                          <option value="supervisor">{userRoleLabel.supervisor}</option>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant={u.ativo ? 'secondary' : 'primary'}
                          onClick={() => toggleAtivo(u)}
                        >
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtividade por responsável</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {stats?.porGestor.length === 0 ? (
              <p className="text-xs text-muted">Sem dados.</p>
            ) : (
              stats?.porGestor.map((g) => {
                const total = g.pendentes + g.concluidas
                const pct = total > 0 ? Math.round((g.concluidas / total) * 100) : 0
                return (
                  <div key={g.nome}>
                    <div className="flex items-center justify-between text-xs">
                      <span>{g.nome}</span>
                      <span className="text-muted">
                        {g.concluidas}/{total} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-bg-soft">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/* =========================================================
   Tab: Equipe Operacional
   ========================================================= */

const moduloIcon: Record<Modulo, React.ComponentType<{ size?: number; className?: string }>> = {
  trafego: Megaphone,
  webdesign: Palette,
  social_media: Share2,
  admin: ShieldCheck,
}

const moduloAccent: Record<Modulo, { bg: string; border: string; text: string; ring: string }> = {
  trafego: {
    bg: 'bg-brand-500/10',
    border: 'border-brand-500/40',
    text: 'text-brand-300',
    ring: 'ring-brand-500/30',
  },
  webdesign: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/40',
    text: 'text-violet-300',
    ring: 'ring-violet-500/30',
  },
  social_media: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/40',
    text: 'text-pink-300',
    ring: 'ring-pink-500/30',
  },
  admin: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    ring: 'ring-emerald-500/30',
  },
}

const cargoAccent: Record<Cargo, { dot: string; text: string }> = {
  gestor_trafego: { dot: 'bg-brand-400', text: 'text-brand-200' },
  account_manager: { dot: 'bg-sky-400', text: 'text-sky-200' },
  designer: { dot: 'bg-violet-400', text: 'text-violet-200' },
  social_media: { dot: 'bg-pink-400', text: 'text-pink-200' },
  diretoria: { dot: 'bg-emerald-400', text: 'text-emerald-200' },
  head: { dot: 'bg-amber-400', text: 'text-amber-200' },
}

function EquipeOperacionalTab({
  usuarios,
  onChange,
}: {
  usuarios: Profile[]
  onChange: () => void
}) {
  const [perms, setPerms] = useState<Record<Cargo, Modulo[]>>(() => loadCargoPermissoes())
  const [dirty, setDirty] = useState(false)
  const [squads, setSquads] = useState<Squad[]>([])
  const [todosUsuarios, setTodosUsuarios] = useState<Profile[]>([])
  const [squadModalOpen, setSquadModalOpen] = useState(false)
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)

  async function loadSquadsAndMembros() {
    // Busca squads e profiles SEPARADAMENTE (sem joins) — assim, se a tabela squads
    // ainda não existir no Supabase, profiles continua carregando normalmente.
    const sRes = await supabase
      .from('squads')
      .select('*')
      .order('nome')
      .then(
        (r) => r,
        () => ({ data: [], error: { message: 'squads_table_missing' } } as const),
      )

    const pRes = await supabase.from('profiles').select('*').order('nome')

    const squadsData = (sRes.data as Squad[] | null) ?? []
    const profilesData = (pRes.data as Profile[] | null) ?? []

    // Faz join em memória: lider e squad de cada profile
    const profileById = new Map(profilesData.map((p) => [p.id, p]))
    const squadById = new Map(squadsData.map((s) => [s.id, s]))

    const squadsHidratados = squadsData.map((s) => ({
      ...s,
      lider: s.lider_id ? profileById.get(s.lider_id) ?? null : null,
    }))

    const profilesHidratados = profilesData.map((p) => ({
      ...p,
      squad: p.squad_id ? squadById.get(p.squad_id) ?? null : null,
    }))

    setSquads(squadsHidratados)
    setTodosUsuarios(profilesHidratados)
  }

  useEffect(() => {
    loadSquadsAndMembros()
  }, [])

  async function toggleSquadAtivo(s: Squad) {
    await supabase.from('squads').update({ ativo: !s.ativo }).eq('id', s.id)
    loadSquadsAndMembros()
  }
  async function excluirSquad(s: Squad) {
    if (!confirm(`Excluir o squad "${s.nome}"?\n\nIsso só funciona se nenhum cliente ou membro estiver vinculado.`)) return
    // Verifica vínculos
    const linkedMembers = todosUsuarios.filter((u) => u.squad_id === s.id).length
    if (linkedMembers > 0) {
      alert(
        `Não é possível excluir: ${linkedMembers} membro(s) vinculado(s) a este squad. Inative-o em vez disso.`,
      )
      return
    }
    await supabase.from('squads').delete().eq('id', s.id)
    loadSquadsAndMembros()
  }
  async function toggleMemberAtivo(p: Profile) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    loadSquadsAndMembros()
    onChange()
  }
  async function excluirMember(p: Profile) {
    if (!confirm(`Remover "${p.nome}" da equipe?`)) return
    await supabase.from('profiles').delete().eq('id', p.id)
    loadSquadsAndMembros()
    onChange()
  }

  function togglePerm(cargo: Cargo, modulo: Modulo) {
    setPerms((cur) => {
      const has = cur[cargo].includes(modulo)
      const next: Record<Cargo, Modulo[]> = {
        ...cur,
        [cargo]: has ? cur[cargo].filter((m) => m !== modulo) : [...cur[cargo], modulo],
      }
      saveCargoPermissoes(next)
      return next
    })
    setDirty(true)
    setTimeout(() => setDirty(false), 1500)
  }

  function reset() {
    if (!confirm('Restaurar permissões padrão para todos os cargos?')) return
    setPerms(resetCargoPermissoes())
    setDirty(true)
    setTimeout(() => setDirty(false), 1500)
  }

  // Conta usuários por cargo
  const countByCargo = useMemo(() => {
    const map = new Map<Cargo, number>()
    for (const u of usuarios) {
      if (u.cargo) map.set(u.cargo, (map.get(u.cargo) ?? 0) + 1)
    }
    return map
  }, [usuarios])

  return (
    <div className="space-y-5">
      {/* Resumo dos módulos */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {MODULOS.map((m) => {
          const Icon = moduloIcon[m]
          const accent = moduloAccent[m]
          const cargosCom = CARGOS.filter((c) => perms[c].includes(m))
          return (
            <Card key={m} className="overflow-hidden">
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-lg border',
                      accent.bg,
                      accent.border,
                      accent.text,
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className={cn('text-sm font-semibold leading-tight', accent.text)}>
                      {moduloLabel[m]}
                    </h3>
                    <p className="text-[11px] text-muted leading-tight mt-0.5">
                      {moduloDescricao[m]}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cargosCom.length === 0 ? (
                    <span className="text-[11px] italic text-muted">Nenhum cargo com acesso.</span>
                  ) : (
                    cargosCom.map((c) => (
                      <Badge key={c} tone="neutral" className="text-[10px]">
                        <span className={cn('h-1.5 w-1.5 rounded-full', cargoAccent[c].dot)} />
                        {cargoLabel[c]}
                      </Badge>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* Matriz de permissões */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-bg-soft/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/15 text-brand-300">
              <Briefcase size={15} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-100 leading-tight">
                Cargos e permissões
              </h3>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Defina o que cada cargo pode acessar. Mudanças salvam automaticamente.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 animate-fade-in">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                Salvo
              </span>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-border/60 hover:text-zinc-100"
              title="Restaurar permissões padrão"
            >
              <RotateCcw size={12} /> Restaurar padrão
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-soft/30">
              <tr className="text-left">
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Cargo
                </th>
                {MODULOS.map((m) => {
                  const Icon = moduloIcon[m]
                  const accent = moduloAccent[m]
                  return (
                    <th
                      key={m}
                      className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon size={14} className={accent.text} />
                        <span>{moduloLabel[m]}</span>
                      </div>
                    </th>
                  )
                })}
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Pessoas
                </th>
              </tr>
            </thead>
            <tbody>
              {CARGOS.map((c) => {
                const accent = cargoAccent[c]
                const count = countByCargo.get(c) ?? 0
                return (
                  <tr key={c} className="border-t border-border/60 hover:bg-bg-soft/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            accent.dot,
                          )}
                          style={{
                            boxShadow: '0 0 6px currentColor',
                          }}
                        />
                        <div className="min-w-0">
                          <p className={cn('text-sm font-semibold', accent.text)}>
                            {cargoLabel[c]}
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            {cargoDescricao[c]}
                          </p>
                        </div>
                      </div>
                    </td>
                    {MODULOS.map((m) => {
                      const has = perms[c].includes(m)
                      const accentM = moduloAccent[m]
                      const isDefault = cargoPermissoesDefault[c].includes(m) === has
                      return (
                        <td key={m} className="px-3 py-3 text-center">
                          <button
                            onClick={() => togglePerm(c, m)}
                            className={cn(
                              'group inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
                              has
                                ? cn(accentM.bg, accentM.border, accentM.text, 'shadow-[0_0_12px_-4px]')
                                : 'border-border/60 bg-bg-soft text-muted hover:border-border',
                              !isDefault && 'ring-1 ring-amber-500/40',
                            )}
                            title={has ? `Revogar acesso a ${moduloLabel[m]}` : `Conceder acesso a ${moduloLabel[m]}`}
                          >
                            {has ? <Check size={14} /> : <Lock size={11} className="opacity-50" />}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs text-muted tabular-nums">
                        {count} {count === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] text-muted">
        💡 As permissões controlam quais menus do sistema cada cargo enxerga. Usuários com role{' '}
        <span className="font-medium text-zinc-300">Admin</span> sempre têm acesso total
        independentemente do cargo.
      </p>

      {/* Squads */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-bg-soft/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/15 text-brand-300">
              <UsersIcon size={15} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-100 leading-tight">Squads</h3>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Times operacionais que atendem os clientes
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingSquad(null)
              setSquadModalOpen(true)
            }}
          >
            <Plus size={13} /> Novo Squad
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-soft/30">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted">
                <th className="px-5 py-3">Nome</th>
                <th className="px-3 py-3">Descrição</th>
                <th className="px-3 py-3">Líder</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {squads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-muted">
                    Nenhum squad cadastrado.
                  </td>
                </tr>
              ) : (
                squads.map((s) => {
                  const linkedMembers = todosUsuarios.filter((u) => u.squad_id === s.id).length
                  const canDelete = linkedMembers === 0
                  return (
                    <tr key={s.id} className={cn('border-t border-border/60 hover:bg-bg-soft/30', !s.ativo && 'opacity-60')}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-100">{s.nome}</p>
                          {!s.ativo && (
                            <Badge tone="neutral" className="text-[10px]">
                              Inativo
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">{s.descricao || '—'}</td>
                      <td className="px-3 py-3 text-sm text-zinc-300">{s.lider?.nome ?? '—'}</td>
                      <td className="px-3 py-3">
                        <ToggleSwitch checked={s.ativo} onChange={() => toggleSquadAtivo(s)} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex gap-0.5">
                          <button
                            onClick={() => {
                              setEditingSquad(s)
                              setSquadModalOpen(true)
                            }}
                            className="rounded p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => excluirSquad(s)}
                            disabled={!canDelete}
                            className={cn(
                              'rounded p-1.5 transition-colors',
                              canDelete
                                ? 'text-muted hover:bg-bg-elev hover:text-red-400'
                                : 'text-muted/30 cursor-not-allowed',
                            )}
                            title={canDelete ? 'Excluir' : `Vinculado a ${linkedMembers} membro(s) — não pode ser excluído`}
                          >
                            <Trash2 size={13} className={cn(canDelete && 'text-red-400/80')} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-2 border-t border-border bg-bg-soft/30 px-5 py-2.5 text-[11px] text-muted">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400/80" />
          Squads com vínculos a clientes ou membros não podem ser excluídos, apenas inativados.
          Registros inativos mantêm histórico para métricas e relatórios.
        </div>
      </Card>

      {/* Membros da Equipe */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-bg-soft/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/15 text-brand-300">
              <Users2 size={15} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-100 leading-tight">
                Membros da Equipe
              </h3>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Pessoas que compõem os squads
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setMemberModalOpen(true)}>
            <Plus size={13} /> Novo Membro
          </Button>
        </div>
        <div className="max-h-[460px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-soft/30 sticky top-0">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted">
                <th className="px-5 py-3">Nome</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Papel</th>
                <th className="px-3 py-3">Squad principal</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {todosUsuarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-muted">
                    Nenhum membro cadastrado.
                  </td>
                </tr>
              ) : (
                todosUsuarios.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      'border-t border-border/60 hover:bg-bg-soft/30',
                      !u.ativo && 'opacity-60',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-100">{u.nome}</p>
                        {!u.ativo && (
                          <Badge tone="neutral" className="text-[10px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {u.email.split('@')[0]}
                    </td>
                    <td className="px-3 py-3">
                      {u.cargo ? (
                        <Badge tone="brand" className="text-[10px]">
                          {cargoLabel[u.cargo]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-300">
                      {u.squad?.nome ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <ToggleSwitch checked={u.ativo} onChange={() => toggleMemberAtivo(u)} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-0.5">
                        <button
                          className="rounded p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
                          title="Editar (use a aba Gerenciar Acessos)"
                          disabled
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => excluirMember(u)}
                          className="rounded p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-red-400"
                          title="Remover"
                        >
                          <Trash2 size={13} className="text-red-400/80" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SquadModal
        open={squadModalOpen}
        onClose={() => setSquadModalOpen(false)}
        squad={editingSquad}
        usuarios={todosUsuarios}
        onSaved={loadSquadsAndMembros}
      />
      <CriarUsuarioModal
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        onCreated={() => {
          loadSquadsAndMembros()
          onChange()
        }}
      />
    </div>
  )
}

/* Toggle switch reutilizável */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'group inline-flex items-center gap-2 transition-opacity hover:opacity-80',
      )}
      title={checked ? 'Desativar' : 'Ativar'}
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          checked ? 'bg-brand-500' : 'bg-zinc-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          )}
        />
      </span>
      <span className={cn('text-xs', checked ? 'text-zinc-100' : 'text-muted')}>
        {checked ? 'Ativo' : 'Inativo'}
      </span>
    </button>
  )
}

/* Modal: Novo / Editar Squad */
function SquadModal({
  open,
  onClose,
  squad,
  usuarios,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  squad: Squad | null
  usuarios: Profile[]
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    lider_id: '',
    ativo: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (squad) {
      setForm({
        nome: squad.nome,
        descricao: squad.descricao ?? '',
        lider_id: squad.lider_id ?? '',
        ativo: squad.ativo,
      })
    } else {
      setForm({ nome: '', descricao: '', lider_id: '', ativo: true })
    }
    setError(null)
  }, [open, squad])

  async function save() {
    if (!form.nome.trim()) return setError('Nome é obrigatório')
    setSaving(true)
    setError(null)
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      lider_id: form.lider_id || null,
      ativo: form.ativo,
    }
    const { error: err } = squad
      ? await supabase.from('squads').update(payload).eq('id', squad.id)
      : await supabase.from('squads').insert(payload)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    onClose()
  }

  const aprovados = usuarios.filter((u) => u.aprovado)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={squad ? 'Editar Squad' : 'Novo Squad'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : squad ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <Field label="Nome">
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: BlackOps"
            autoFocus
          />
        </Field>
        <Field label="Descrição">
          <Textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="O que esse squad atende"
            className="min-h-[70px]"
          />
        </Field>
        <Field label="Líder">
          <Select
            value={form.lider_id}
            onChange={(e) => setForm({ ...form, lider_id: e.target.value })}
          >
            <option value="">— sem líder —</option>
            {aprovados.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-200">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            className="h-4 w-4 accent-brand-500"
          />
          Squad ativo
        </label>
      </div>
    </Modal>
  )
}

/* =========================================================
   Tab: Performance
   ========================================================= */

type Periodo = '7d' | '30d' | '90d' | 'all'

interface ColaboradorStats {
  user: Profile
  total: number
  concluidas: number
  pendentes: number
  atrasadas: number
  noPrazo: number
  forada: number
  taxaConclusao: number // 0..100
  taxaPontualidade: number // 0..100
  score: number // 0..100 (composição ponderada)
  porFrequencia: { diaria: number; semanal: number; mensal: number; esporadica: number }
}

function PerformanceTab({ usuarios }: { usuarios: Profile[] }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('30d')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tarefas')
      .select('*, responsavel:profiles(*)')
      .order('data_vencimento', { ascending: false })
    setTarefas((data as Tarefa[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo<ColaboradorStats[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff =
      periodo === 'all'
        ? null
        : (() => {
            const d = new Date(today)
            d.setDate(d.getDate() - (periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90))
            return d.toISOString().slice(0, 10)
          })()

    const tarefasFiltradas = cutoff
      ? tarefas.filter((t) => {
          // Inclui tarefas concluídas no período OU criadas/com vencimento no período
          if (t.data_conclusao && t.data_conclusao.slice(0, 10) >= cutoff) return true
          if (t.data_vencimento && t.data_vencimento >= cutoff) return true
          return false
        })
      : tarefas

    return usuarios
      .map<ColaboradorStats>((u) => {
        const minhas = tarefasFiltradas.filter((t) => t.responsavel_id === u.id)
        const total = minhas.length
        const concluidas = minhas.filter((t) => t.status === 'concluida').length
        const pendentes = minhas.filter(
          (t) =>
            t.status !== 'concluida' &&
            (!t.data_vencimento || t.data_vencimento >= today.toISOString().slice(0, 10)),
        ).length
        const atrasadas = minhas.filter(
          (t) =>
            t.status !== 'concluida' &&
            t.data_vencimento &&
            t.data_vencimento < today.toISOString().slice(0, 10),
        ).length

        const concluidasComDatas = minhas.filter(
          (t) => t.status === 'concluida' && t.data_conclusao && t.data_vencimento,
        )
        const noPrazo = concluidasComDatas.filter(
          (t) => (t.data_conclusao ?? '').slice(0, 10) <= (t.data_vencimento ?? ''),
        ).length
        const forada = concluidasComDatas.length - noPrazo

        const taxaConclusao = total > 0 ? (concluidas / total) * 100 : 0
        const taxaPontualidade =
          concluidasComDatas.length > 0 ? (noPrazo / concluidasComDatas.length) * 100 : 0
        // Score: 60% conclusão + 30% pontualidade + 10% penalidade por atrasadas
        const penalidade = total > 0 ? (atrasadas / total) * 100 : 0
        const score = Math.max(
          0,
          Math.round(taxaConclusao * 0.6 + taxaPontualidade * 0.3 - penalidade * 0.1),
        )

        const porFrequencia = {
          diaria: minhas.filter((t) => t.frequencia === 'diaria').length,
          semanal: minhas.filter((t) => t.frequencia === 'semanal').length,
          mensal: minhas.filter((t) => t.frequencia === 'mensal').length,
          esporadica: minhas.filter((t) => t.frequencia === 'esporadica').length,
        }

        return {
          user: u,
          total,
          concluidas,
          pendentes,
          atrasadas,
          noPrazo,
          forada,
          taxaConclusao,
          taxaPontualidade,
          score,
          porFrequencia,
        }
      })
      .sort((a, b) => b.score - a.score || b.concluidas - a.concluidas)
  }, [usuarios, tarefas, periodo])

  // KPIs do time todo
  const teamKpis = useMemo(() => {
    const totalTarefas = stats.reduce((s, c) => s + c.total, 0)
    const totalConcluidas = stats.reduce((s, c) => s + c.concluidas, 0)
    const totalAtrasadas = stats.reduce((s, c) => s + c.atrasadas, 0)
    const taxaTime = totalTarefas > 0 ? Math.round((totalConcluidas / totalTarefas) * 100) : 0
    const scoreMedio =
      stats.length > 0
        ? Math.round(stats.reduce((s, c) => s + c.score, 0) / stats.length)
        : 0
    const top = stats[0]
    return { totalTarefas, totalConcluidas, totalAtrasadas, taxaTime, scoreMedio, top }
  }, [stats])

  if (loading) {
    return <p className="text-sm text-muted">Carregando...</p>
  }

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Score = 60% conclusão + 30% pontualidade − 10% atraso. Ordenado pelo melhor desempenho.
        </p>
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          {(['7d', '30d', '90d', 'all'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                'px-3 py-1 text-[11px] font-medium rounded-md transition-colors',
                periodo === p
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Todo período'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs do time */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<Target size={15} />}
          label="Score médio do time"
          value={`${teamKpis.scoreMedio}%`}
          tone={teamKpis.scoreMedio >= 75 ? 'success' : teamKpis.scoreMedio >= 50 ? 'warning' : 'danger'}
        />
        <KpiCard
          icon={<CheckCircle2 size={15} />}
          label="Tarefas concluídas"
          value={teamKpis.totalConcluidas.toString()}
          subtitle={`de ${teamKpis.totalTarefas} no período`}
          tone="neutral"
        />
        <KpiCard
          icon={<AlertCircle size={15} />}
          label="Atrasadas"
          value={teamKpis.totalAtrasadas.toString()}
          tone={teamKpis.totalAtrasadas > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          icon={<Trophy size={15} />}
          label="Destaque"
          value={teamKpis.top?.user.nome.split(' ')[0] ?? '—'}
          subtitle={teamKpis.top ? `Score ${teamKpis.top.score}%` : ''}
          tone="brand"
        />
      </div>

      {/* Ranking geral */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border bg-bg-soft/40 px-5 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/15 text-brand-300">
            <Trophy size={15} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-100 leading-tight">
              Ranking geral
            </h3>
            <p className="text-[11px] text-muted leading-tight mt-0.5">
              {stats.length} colaboradores · ordenados por score
            </p>
          </div>
        </div>
        <CardBody className="p-4 space-y-3">
          {stats.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">
              Sem colaboradores aprovados.
            </p>
          ) : (
            stats.map((s, idx) => <PerformanceRow key={s.user.id} stats={s} rank={idx + 1} />)
          )}
        </CardBody>
      </Card>

      {/* Seções por cargo */}
      <CargoBreakdown stats={stats} />
    </div>
  )
}

function CargoBreakdown({ stats }: { stats: ColaboradorStats[] }) {
  const grupos = useMemo(() => {
    const map = new Map<Cargo, ColaboradorStats[]>()
    for (const s of stats) {
      if (!s.user.cargo) continue
      const arr = map.get(s.user.cargo) ?? []
      arr.push(s)
      map.set(s.user.cargo, arr)
    }
    // Ordena dentro do cargo por score
    for (const arr of map.values()) {
      arr.sort((a, b) => b.score - a.score || b.concluidas - a.concluidas)
    }
    // Retorna cargos na ordem do CARGOS
    return CARGOS.filter((c) => (map.get(c) ?? []).length > 0).map((c) => ({
      cargo: c,
      pessoas: map.get(c) as ColaboradorStats[],
    }))
  }, [stats])

  if (grupos.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Performance por cargo
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-border via-border to-transparent" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {grupos.map(({ cargo, pessoas }) => (
          <CargoCard key={cargo} cargo={cargo} pessoas={pessoas} />
        ))}
      </div>
    </div>
  )
}

function CargoCard({ cargo, pessoas }: { cargo: Cargo; pessoas: ColaboradorStats[] }) {
  const accent = cargoAccent[cargo]
  const totalTarefas = pessoas.reduce((s, p) => s + p.total, 0)
  const totalConcluidas = pessoas.reduce((s, p) => s + p.concluidas, 0)
  const totalAtrasadas = pessoas.reduce((s, p) => s + p.atrasadas, 0)
  const scoreMedio =
    pessoas.length > 0
      ? Math.round(pessoas.reduce((s, p) => s + p.score, 0) / pessoas.length)
      : 0

  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between border-b border-border px-5 py-3',
          'bg-gradient-to-r from-bg-soft/80 via-bg-soft/40 to-transparent',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn('h-2.5 w-2.5 rounded-full shrink-0', accent.dot)}
            style={{ boxShadow: '0 0 8px currentColor' }}
          />
          <div>
            <h3 className={cn('text-[13px] font-semibold leading-tight', accent.text)}>
              {cargoLabel[cargo]}
            </h3>
            <p className="text-[11px] text-muted leading-tight mt-0.5">
              {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'} ·{' '}
              {totalConcluidas}/{totalTarefas} concluídas
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted uppercase tracking-wider">Score médio</p>
          <p
            className={cn(
              'text-lg font-bold tabular-nums',
              scoreMedio >= 80
                ? 'text-emerald-300'
                : scoreMedio >= 60
                ? 'text-lime-300'
                : scoreMedio >= 40
                ? 'text-amber-300'
                : 'text-red-300',
            )}
          >
            {scoreMedio}%
          </p>
        </div>
      </div>
      <CardBody className="p-3 space-y-2">
        {totalAtrasadas > 0 && (
          <div className="flex items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/5 px-2.5 py-1 text-[11px] text-red-300">
            <AlertCircle size={11} /> {totalAtrasadas} tarefa(s) atrasada(s) no cargo
          </div>
        )}
        {pessoas.map((p, idx) => (
          <CargoMemberRow key={p.user.id} stats={p} rank={idx + 1} />
        ))}
      </CardBody>
    </Card>
  )
}

function CargoMemberRow({ stats, rank }: { stats: ColaboradorStats; rank: number }) {
  const { user, total, concluidas, atrasadas, score, taxaPontualidade } = stats

  const scoreColor =
    score >= 80
      ? 'text-emerald-300'
      : score >= 60
      ? 'text-lime-300'
      : score >= 40
      ? 'text-amber-300'
      : 'text-red-300'
  const barColor =
    score >= 80
      ? 'bg-emerald-400'
      : score >= 60
      ? 'bg-lime-400'
      : score >= 40
      ? 'bg-amber-400'
      : 'bg-red-400'

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft/30 px-3 py-2 transition-colors hover:bg-bg-soft/60">
      <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-bg-elev text-[10px] font-bold text-muted shrink-0">
        {rank}
      </span>
      <Avatar name={user.nome} url={user.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-100 truncate">{user.nome}</p>
          <span className={cn('text-sm font-bold tabular-nums shrink-0', scoreColor)}>
            {score}%
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-bg-elev overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: total > 0 ? `${(concluidas / total) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] text-muted tabular-nums shrink-0">
            {concluidas}/{total}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px]">
          <span className="text-emerald-400/80">✓ {Math.round(taxaPontualidade)}% pontualidade</span>
          {atrasadas > 0 ? (
            <span className="text-red-400/80">⚠ {atrasadas} atrasada(s)</span>
          ) : (
            <span className="text-muted">— sem atrasos</span>
          )}
        </div>
      </div>
    </div>
  )
}

function PerformanceRow({ stats, rank }: { stats: ColaboradorStats; rank: number }) {
  const { user, total, concluidas, pendentes, atrasadas, noPrazo, score, taxaPontualidade, porFrequencia } =
    stats

  const scoreColor =
    score >= 80
      ? { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', bar: 'bg-emerald-400' }
      : score >= 60
      ? { text: 'text-lime-300', bg: 'bg-lime-500/15', border: 'border-lime-500/40', bar: 'bg-lime-400' }
      : score >= 40
      ? { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/40', bar: 'bg-amber-400' }
      : { text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/40', bar: 'bg-red-400' }

  const trendIcon =
    score >= 70 ? (
      <TrendingUp size={12} className="text-emerald-400" />
    ) : score >= 40 ? (
      <Minus size={12} className="text-amber-400" />
    ) : (
      <TrendingDown size={12} className="text-red-400" />
    )

  return (
    <div className="rounded-xl border border-border bg-bg-soft/40 p-4 transition-colors hover:bg-bg-soft/70">
      <div className="flex items-center gap-3">
        {/* Rank + avatar */}
        <div className="relative">
          <Avatar name={user.nome} url={user.avatar_url} size="md" />
          <span
            className={cn(
              'absolute -top-1.5 -left-1.5 grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold',
              rank === 1
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                : rank === 2
                ? 'border-zinc-400/70 bg-zinc-500/30 text-zinc-100'
                : rank === 3
                ? 'border-orange-400/70 bg-orange-700/30 text-orange-200'
                : 'border-border bg-bg-elev text-muted',
            )}
            title={`Posição ${rank}`}
          >
            {rank}
          </span>
        </div>

        {/* Nome + cargo */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-100 truncate">{user.nome}</p>
            {user.cargo && (
              <Badge tone="neutral" className="text-[10px]">
                {cargoLabel[user.cargo]}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted truncate">{user.email}</p>
        </div>

        {/* Score */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5',
            scoreColor.bg,
            scoreColor.border,
          )}
        >
          {trendIcon}
          <span className={cn('text-base font-bold tabular-nums', scoreColor.text)}>{score}</span>
          <span className={cn('text-xs', scoreColor.text)}>%</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted mb-1">
          <span>Tarefas concluídas</span>
          <span className="tabular-nums">
            {concluidas}/{total}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elev overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreColor.bar)}
            style={{ width: total > 0 ? `${(concluidas / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Mini-stats */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Pill
          icon={<CheckCircle2 size={11} className="text-emerald-400" />}
          label="No prazo"
          value={noPrazo}
        />
        <Pill
          icon={<CircleDot size={11} className="text-zinc-400" />}
          label="Pendentes"
          value={pendentes}
        />
        <Pill
          icon={<AlertCircle size={11} className="text-red-400" />}
          label="Atrasadas"
          value={atrasadas}
          highlight={atrasadas > 0 ? 'danger' : undefined}
        />
        <Pill
          icon={<Target size={11} className="text-brand-300" />}
          label="Pontualidade"
          value={`${Math.round(taxaPontualidade)}%`}
        />
      </div>

      {/* Distribuição por frequência (visual sutil) */}
      {total > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
          {porFrequencia.diaria > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-500/25 bg-red-500/5 px-1.5 py-0.5 text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {porFrequencia.diaria} diária(s)
            </span>
          )}
          {porFrequencia.semanal > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/25 bg-orange-500/5 px-1.5 py-0.5 text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {porFrequencia.semanal} semanal(is)
            </span>
          )}
          {porFrequencia.mensal > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-pink-500/25 bg-pink-500/5 px-1.5 py-0.5 text-pink-300">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              {porFrequencia.mensal} mensal(is)
            </span>
          )}
          {porFrequencia.esporadica > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/40 px-1.5 py-0.5 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              {porFrequencia.esporadica} esporádica(s)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Pill({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  highlight?: 'danger'
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5',
        highlight === 'danger'
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-border bg-bg-soft/60',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-muted">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          'text-xs font-semibold tabular-nums',
          highlight === 'danger' ? 'text-red-300' : 'text-zinc-100',
        )}
      >
        {value}
      </span>
    </div>
  )
}

type KpiTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

const kpiToneStyles: Record<KpiTone, { box: string; iconBox: string; text: string }> = {
  neutral: {
    box: 'border-border',
    iconBox: 'border-border bg-bg-elev text-zinc-300',
    text: 'text-zinc-100',
  },
  brand: {
    box: 'border-brand-500/30',
    iconBox: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
    text: 'text-brand-200',
  },
  success: {
    box: 'border-emerald-500/30',
    iconBox: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    text: 'text-emerald-300',
  },
  warning: {
    box: 'border-amber-500/30',
    iconBox: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    text: 'text-amber-300',
  },
  danger: {
    box: 'border-red-500/30',
    iconBox: 'border-red-500/40 bg-red-500/10 text-red-300',
    text: 'text-red-300',
  },
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  tone: KpiTone
}) {
  const s = kpiToneStyles[tone]
  return (
    <Card className={cn('overflow-hidden', s.box)}>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums truncate', s.text)}>{value}</p>
          {subtitle && <p className="mt-0.5 text-[10.5px] text-muted truncate">{subtitle}</p>}
        </div>
        <div
          className={cn(
            'shrink-0 grid h-9 w-9 place-items-center rounded-lg border',
            s.iconBox,
          )}
        >
          {icon}
        </div>
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Tab: Gerenciar Acessos
   ========================================================= */

function AcessosTab({
  pendentes,
  aprovados,
  loading,
  onChange,
}: {
  pendentes: Profile[]
  aprovados: Profile[]
  loading: boolean
  onChange: () => void
}) {
  const [criarOpen, setCriarOpen] = useState(false)
  const [editFoto, setEditFoto] = useState<Profile | null>(null)

  async function aprovar(p: Profile) {
    await supabase.from('profiles').update({ aprovado: true, ativo: true }).eq('id', p.id)
    onChange()
  }
  async function rejeitar(p: Profile) {
    if (!confirm(`Rejeitar acesso de ${p.nome}?`)) return
    await supabase.from('profiles').delete().eq('id', p.id)
    onChange()
  }
  async function toggleAtivo(p: Profile) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    onChange()
  }
  async function alterarRole(p: Profile, role: Profile['role']) {
    await supabase.from('profiles').update({ role }).eq('id', p.id)
    onChange()
  }
  async function alterarCargo(p: Profile, cargo: Cargo) {
    // Se o novo cargo principal estiver em cargos_extras, remove dali pra não duplicar
    const extras = (p.cargos_extras ?? []).filter((c) => c !== cargo)
    await supabase
      .from('profiles')
      .update({ cargo, cargos_extras: extras })
      .eq('id', p.id)
    onChange()
  }
  async function toggleCargoExtra(p: Profile, cargo: Cargo) {
    const atual = p.cargos_extras ?? []
    const next = atual.includes(cargo)
      ? atual.filter((c) => c !== cargo)
      : [...atual, cargo]
    await supabase.from('profiles').update({ cargos_extras: next }).eq('id', p.id)
    onChange()
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setCriarOpen(true)}>
          <UserPlus size={14} /> Criar Usuário
        </Button>
      </div>

      {/* Aguardando aprovação */}
      <Card className="overflow-hidden">
        <div className="relative border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-300">
              <Clock size={15} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-amber-200 leading-tight flex items-center gap-2">
                Aguardando Aprovação
                {pendentes.length > 0 && (
                  <Badge tone="warning">{pendentes.length}</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Novos usuários que solicitaram acesso ao sistema
              </p>
            </div>
          </div>
        </div>
        <CardBody className="p-4">
          {loading ? (
            <p className="text-xs text-muted">Carregando...</p>
          ) : pendentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-soft/40 py-10 text-center">
              <UserCheck size={28} className="text-muted/60" />
              <p className="text-sm text-muted">Nenhum usuário aguardando aprovação</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pendentes.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.nome} url={u.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{u.nome}</p>
                      <p className="text-[11px] text-muted truncate">{u.email}</p>
                      <p className="text-[10px] text-muted/70 mt-0.5">
                        Solicitado em {formatDateTime(u.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Select
                      value={u.cargo ?? 'gestor_trafego'}
                      onChange={(e) => alterarCargo(u, e.target.value as Cargo)}
                      className="w-40 h-8 text-[12px]"
                    >
                      {CARGOS.map((c) => (
                        <option key={c} value={c}>
                          {cargoLabel[c]}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={u.role}
                      onChange={(e) => alterarRole(u, e.target.value as Profile['role'])}
                      className="w-28 h-8 text-[12px]"
                    >
                      <option value="admin">{userRoleLabel.admin}</option>
                      <option value="gestor">{userRoleLabel.gestor}</option>
                      <option value="supervisor">{userRoleLabel.supervisor}</option>
                    </Select>
                    <button
                      onClick={() => aprovar(u)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] text-emerald-300 transition-colors hover:bg-emerald-500/20"
                    >
                      <Check size={13} /> Aprovar
                    </button>
                    <button
                      onClick={() => rejeitar(u)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[12px] text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <X size={13} /> Rejeitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Usuários aprovados */}
      <Card className="overflow-hidden">
        <div className="relative border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
              <UserCheck size={15} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-emerald-200 leading-tight flex items-center gap-2">
                Usuários Aprovados
                <Badge tone="success">{aprovados.length}</Badge>
              </h3>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Usuários com acesso ao sistema
              </p>
            </div>
          </div>
        </div>
        <CardBody className="p-4">
          {loading ? (
            <p className="text-xs text-muted">Carregando...</p>
          ) : aprovados.length === 0 ? (
            <p className="text-xs text-muted">Nenhum usuário aprovado.</p>
          ) : (
            <ul className="space-y-2">
              {aprovados.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={() => setEditFoto(u)}
                      className="group relative shrink-0"
                      title="Trocar foto"
                    >
                      <Avatar name={u.nome} url={u.avatar_url} size="sm" />
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="text-[8px] text-white">📷</span>
                      </span>
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{u.nome}</p>
                      <p className="text-[11px] text-muted truncate">{u.email}</p>
                    </div>
                    {!u.ativo && (
                      <Badge tone="neutral" className="text-[10px]">
                        desativado
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Select
                      value={u.cargo ?? 'gestor_trafego'}
                      onChange={(e) => alterarCargo(u, e.target.value as Cargo)}
                      className="w-40 h-8 text-[12px]"
                    >
                      {CARGOS.map((c) => (
                        <option key={c} value={c}>
                          {cargoLabel[c]}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={u.role}
                      onChange={(e) => alterarRole(u, e.target.value as Profile['role'])}
                      className="w-28 h-8 text-[12px]"
                    >
                      <option value="admin">{userRoleLabel.admin}</option>
                      <option value="gestor">{userRoleLabel.gestor}</option>
                      <option value="supervisor">{userRoleLabel.supervisor}</option>
                    </Select>
                    <Button
                      size="sm"
                      variant={u.ativo ? 'secondary' : 'primary'}
                      onClick={() => toggleAtivo(u)}
                    >
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                  {/* Linha 2: cargos adicionais (chips). Sempre visível pra ficar óbvio que existe. */}
                  <div className="basis-full flex items-center gap-2 pt-1 pl-12">
                    <span className="text-[10px] uppercase tracking-wider text-muted">
                      Também atua como:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {CARGOS.filter((c) => c !== u.cargo).map((c) => {
                        const ativo = (u.cargos_extras ?? []).includes(c)
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleCargoExtra(u, c)}
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-[10px] transition-colors',
                              ativo
                                ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                                : 'border-border text-muted hover:border-brand-500/40 hover:text-zinc-300',
                            )}
                            title={ativo ? `Remover cargo adicional` : `Adicionar cargo adicional`}
                          >
                            {cargoLabel[c]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <CriarUsuarioModal open={criarOpen} onClose={() => setCriarOpen(false)} onCreated={onChange} />

      {editFoto && (
        <EditarFotoPerfilModal
          open
          onClose={() => setEditFoto(null)}
          profile={editFoto}
          onSaved={onChange}
        />
      )}
    </div>
  )
}

/* =========================================================
   Modal: Criar Usuário
   ========================================================= */

function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
  let out = ''
  const arr = new Uint32Array(length)
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr)
    for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  } else {
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function CriarUsuarioModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'gestor' as Profile['role'],
    cargo: 'gestor_trafego' as Cargo,
    cargosExtras: [] as Cargo[],
    aprovadoImediato: true,
  })
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm({
        nome: '',
        email: '',
        senha: '',
        role: 'gestor',
        cargo: 'gestor_trafego',
        cargosExtras: [],
        aprovadoImediato: true,
      })
      setShowPwd(false)
      setError(null)
    }
  }, [open])

  async function save() {
    if (!form.nome.trim()) return setError('Nome é obrigatório')
    if (!form.email.trim()) return setError('E-mail é obrigatório')
    if (!form.senha.trim()) return setError('Senha é obrigatória')
    if (form.senha.length < 6) return setError('Senha precisa ter pelo menos 6 caracteres')
    setSaving(true)
    setError(null)

    const email = form.email.trim()

    // Verifica se já existe profile com esse e-mail
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, nome, role, cargo')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      // Email já existe — pergunta se quer atualizar
      const ok = confirm(
        `Já existe um cadastro com esse e-mail:\n\n` +
          `• Nome: ${existing.nome}\n` +
          `• Role: ${existing.role}\n\n` +
          `Deseja atualizar os dados desse cadastro com as informações que você acabou de preencher?`,
      )
      if (!ok) {
        setSaving(false)
        setError('Use um e-mail diferente ou confirme a atualização.')
        return
      }
      const { error: errUpd } = await supabase
        .from('profiles')
        .update({
          nome: form.nome.trim(),
          role: form.role,
          cargo: form.cargo,
          cargos_extras: form.cargosExtras.filter((c) => c !== form.cargo),
          ativo: true,
          aprovado: form.aprovadoImediato,
        })
        .eq('id', (existing as { id: string }).id)
      setSaving(false)
      if (errUpd) {
        setError(errUpd.message)
        return
      }
      onCreated()
      onClose()
      return
    }

    // A senha em si não é persistida em `profiles` — em Supabase real ela vai para `auth.users`
    // através do fluxo de Auth (signUp/invite). O admin deve compartilhar a senha manualmente
    // com o usuário ou usar o botão "Convidar" do Supabase Dashboard.
    const { error: err } = await supabase.from('profiles').insert({
      nome: form.nome.trim(),
      email,
      role: form.role,
      cargo: form.cargo,
      cargos_extras: form.cargosExtras.filter((c) => c !== form.cargo),
      avatar_url: null,
      ativo: true,
      aprovado: form.aprovadoImediato,
    })
    setSaving(false)
    if (err) {
      // Mensagem amigável para alguns erros conhecidos
      const msg = err.message
      if (msg.includes('profiles_email_key') || msg.includes('duplicate key')) {
        setError('Esse e-mail já está cadastrado.')
      } else if (msg.includes('null value in column "id"')) {
        setError(
          'A migration de profiles ainda não foi aplicada no Supabase. Rode o arquivo migration-001-profiles-independente.sql no SQL Editor.',
        )
      } else if (msg.includes("'senha' column")) {
        setError('Versão antiga em cache. Atualize a página com Ctrl+Shift+R.')
      } else {
        setError(msg)
      }
      return
    }
    onCreated()
    onClose()
  }

  const pwdStrength = passwordStrength(form.senha)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar usuário"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Criando...' : 'Criar'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <Field label="Nome">
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Nome completo"
            autoFocus
          />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="usuario@movmed.com"
          />
        </Field>
        <Field label="Senha">
          <div className="relative">
            <Input
              type={showPwd ? 'text' : 'password'}
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              className="pr-20"
            />
            <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, senha: generateRandomPassword(12) }))
                }
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
                title="Gerar senha aleatória"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100"
                title={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          {form.senha.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex h-1 flex-1 gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex-1 rounded-full transition-colors',
                      i < pwdStrength.score ? pwdStrength.color : 'bg-bg-elev',
                    )}
                  />
                ))}
              </div>
              <span className={cn('text-[10px]', pwdStrength.text)}>{pwdStrength.label}</span>
            </div>
          )}
          <p className="mt-1 text-[10px] text-muted">
            Anote ou compartilhe esta senha com o usuário. Para login, ele deverá usá-la na primeira
            entrada.
          </p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cargo">
            <Select
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value as Cargo })}
            >
              {CARGOS.map((c) => (
                <option key={c} value={c}>
                  {cargoLabel[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nível de acesso">
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Profile['role'] })}
            >
              <option value="admin">{userRoleLabel.admin}</option>
              <option value="gestor">{userRoleLabel.gestor}</option>
              <option value="supervisor">{userRoleLabel.supervisor}</option>
            </Select>
          </Field>
        </div>
        <Field label="Cargos adicionais (opcional)">
          <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-bg-soft px-2 py-2">
            {CARGOS.filter((c) => c !== form.cargo).map((c) => {
              const ativo = form.cargosExtras.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      cargosExtras: ativo
                        ? form.cargosExtras.filter((x) => x !== c)
                        : [...form.cargosExtras, c],
                    })
                  }
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px] transition-colors',
                    ativo
                      ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                      : 'border-border text-muted hover:border-brand-500/40 hover:text-zinc-200',
                  )}
                >
                  {cargoLabel[c]}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Quando alguém trabalha em mais de uma frente (ex.: design + social). Aparece nos dropdowns das duas áreas.
          </p>
        </Field>
        <label className="flex items-center gap-2 rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-200">
          <input
            type="checkbox"
            checked={form.aprovadoImediato}
            onChange={(e) => setForm({ ...form, aprovadoImediato: e.target.checked })}
            className="h-4 w-4 accent-brand-500"
          />
          Aprovar acesso imediatamente
        </label>
      </div>
    </Modal>
  )
}

function passwordStrength(s: string): {
  score: number
  label: string
  color: string
  text: string
} {
  if (s.length === 0) return { score: 0, label: '', color: '', text: '' }
  let score = 0
  if (s.length >= 6) score++
  if (s.length >= 10) score++
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++
  if (/[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s)) score++
  if (s.length < 6) {
    return { score: 1, label: 'Muito curta', color: 'bg-red-500', text: 'text-red-300' }
  }
  if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-red-500', text: 'text-red-300' }
  if (score === 2) return { score: 2, label: 'Razoável', color: 'bg-amber-400', text: 'text-amber-300' }
  if (score === 3) return { score: 3, label: 'Boa', color: 'bg-lime-400', text: 'text-lime-300' }
  return { score: 4, label: 'Forte', color: 'bg-emerald-400', text: 'text-emerald-300' }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

/* =========================================================
   Tab placeholder (Equipe Operacional / Formulários)
   ========================================================= */

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Hourglass size={28} className="text-muted/50" />
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <p className="text-xs text-muted max-w-md">{description}</p>
        <Badge tone="neutral" className="mt-2 text-[10px]">
          Em breve
        </Badge>
      </CardBody>
    </Card>
  )
}
