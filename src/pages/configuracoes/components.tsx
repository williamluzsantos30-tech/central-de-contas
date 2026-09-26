/**
 * Componentes da tela de Configurações.
 * SettingsTabs, GoalCard, MiniStat, SquadCalcCard, SquadMetricPanel,
 * ProgressBar, SquadsTable, RolesTable, NewSquadModal, Toggle.
 */
import { useEffect, useRef, useState } from 'react'
import {
  TrendingUp,
  Zap,
  AlertTriangle,
  OctagonAlert,
  Pencil,
  Trash2,
  FileText,
  Minus,
  Plus,
  Target,
  Users2,
  type LucideIcon,
} from 'lucide-react'
import {
  Modal,
  FormField,
  Input,
  Select,
  PrimaryButton,
  OutlineButton,
  Badge,
  DataTable,
  type Column,
  type Tone,
} from '@/components/ds'
import { cn } from '@/lib/utils'
import {
  COLABORADORES,
  PERMISSOES,
  statusCrescimento,
  statusLimite,
  type Params,
  type Role,
  type Squad,
  type StatusTom,
  type TeamMember,
} from './mockSettings'

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const TOM_BAR: Record<StatusTom, string> = { ok: 'bg-green-500', atencao: 'bg-orange-500', critico: 'bg-red-500' }
const TOM_BADGE: Record<StatusTom, Tone> = { ok: 'success', atencao: 'warning', critico: 'danger' }

// ============================================================
// SettingsTabs
// ============================================================
export interface TabDef {
  key: string
  label: string
  icon: LucideIcon
  /** Contador ao lado do rótulo (ex.: acessos aguardando aprovação). */
  badge?: number
}
export function SettingsTabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-bg-soft p-0.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            active === t.key ? 'bg-bg-card text-zinc-100 shadow-sm' : 'text-muted hover:text-zinc-200',
          )}
        >
          <t.icon size={13} />
          {t.label}
          {!!t.badge && (
            <span className="rounded-full bg-orange-500/20 px-1.5 text-[10px] font-semibold tabular-nums text-orange-300">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ============================================================
// ProgressBar
// ============================================================
export function ProgressBar({ pct, tom }: { pct: number; tom: StatusTom }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elev">
      <div className={cn('h-full rounded-full transition-all', TOM_BAR[tom])} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
    </div>
  )
}

// ============================================================
// GoalCard (3 destaques) + MiniStat (4 mini)
// ============================================================
export function GoalCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  accent?: 'laranja' | 'verde'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-bg-card p-4',
        accent === 'laranja' ? 'border-orange-500/50' : accent === 'verde' ? 'border-emerald-500/50' : 'border-border',
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <Icon size={12} className={accent === 'laranja' ? 'text-orange-300' : accent === 'verde' ? 'text-emerald-300' : 'text-muted'} />
        {label}
      </div>
      <p className="text-2xl font-bold leading-none tabular-nums text-zinc-100">{value}</p>
      <p className="mt-2 text-[10px] text-muted">{hint}</p>
    </div>
  )
}

export function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <Icon size={11} /> {label}
      </div>
      <p className="text-lg font-bold tabular-nums text-zinc-100">{value}</p>
    </div>
  )
}

// ============================================================
// SquadCalcCard (Tab 1 — fórmulas por squad)
// ============================================================
export function SquadCalcCard({ squad, params }: { squad: Squad; params: Params }) {
  const gapNrr = 95 - (100 - params.churnLimitePct) // 6% com churn 11%
  const c = squad.clientes
  const churn = params.churnLimitePct

  const cols: { icon: LucideIcon; iconCls: string; label: string; valor: string; formula: string[] }[] = [
    { icon: Zap, iconCls: 'text-orange-300', label: 'Indicações', valor: String(squad.metas.indicacoes), formula: [`máx(3, [${c} ÷ 3]) = ${squad.metas.indicacoes}`] },
    { icon: TrendingUp, iconCls: 'text-emerald-300', label: 'Nova Receita', valor: formatBRL(squad.metas.novaReceita), formula: [`${formatBRL(squad.mrr)} × ${gapNrr}% = ${formatBRL(squad.metas.novaReceita)}`, `gap NRR = 95% − (100% − ${churn}%) = ${gapNrr}%`] },
    { icon: TrendingUp, iconCls: 'text-emerald-300', label: 'NRR', valor: `${squad.metas.nrr}%`, formula: ['Meta mínima fixa (retenção de receita)'] },
    { icon: AlertTriangle, iconCls: 'text-amber-300', label: 'Logo Churn', valor: String(squad.metas.logoChurn), formula: [`[${c} × ${churn}%] = ${squad.metas.logoChurn}`, 'Limite máximo de clientes que podem cancelar'] },
    { icon: OctagonAlert, iconCls: 'text-red-300', label: 'Rev. Churn', valor: formatBRL(squad.metas.revChurn), formula: [`${formatBRL(squad.mrr)} × ${churn}% = ${formatBRL(squad.metas.revChurn)}`, 'Limite máximo de MRR perdido'] },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-bg-soft/50 px-4 py-2.5">
        <span className="text-sm font-bold text-zinc-100">{squad.nome}</span>
        <span className="text-[11px] text-muted">👤 {squad.clientes} clientes</span>
        <span className="text-[11px] text-muted">💰 MRR {formatBRL(squad.mrr)}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {cols.map((m) => (
          <div key={m.label}>
            <div className={cn('mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted')}>
              <m.icon size={11} className={m.iconCls} /> {m.label}
            </div>
            <p className="text-lg font-bold tabular-nums text-zinc-100">{m.valor}</p>
            {m.formula.map((f, i) => (
              <p key={i} className="mt-1 text-[10px] leading-snug text-muted">{f}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// SquadMetricPanel (Tab 2 — painel de metas do mês)
// ============================================================
export function SquadMetricPanel({ squad, onEdit }: { squad: Squad; onEdit: () => void }) {
  const linhasCresc = [
    { icon: TrendingUp, label: 'Nova Receita', atual: squad.atual.novaReceita, meta: squad.metas.novaReceita, fmt: formatBRL },
    { icon: Zap, label: 'Indicações', atual: squad.atual.indicacoes, meta: squad.metas.indicacoes, fmt: (v: number) => String(v) },
    { icon: TrendingUp, label: 'NRR', atual: squad.atual.nrr, meta: squad.metas.nrr, fmt: (v: number) => `${v}%` },
  ]
  const linhasLimite = [
    { icon: AlertTriangle, label: 'Logo Churn', atual: squad.atual.logoChurn, limite: squad.metas.logoChurn, fmt: (v: number) => String(v) },
    { icon: OctagonAlert, label: 'Rev. Churn', atual: squad.atual.revChurn, limite: squad.metas.revChurn, fmt: formatBRL },
  ]

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-100">{squad.nome}</h3>
        <button onClick={onEdit} className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-brand-300">
          <Pencil size={11} /> Editar
        </button>
      </div>
      <div className="space-y-3">
        {linhasCresc.map((l) => {
          const st = statusCrescimento(l.atual, l.meta)
          return (
            <div key={l.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-300">
                  <l.icon size={12} className="text-muted" /> {l.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-zinc-300">{l.fmt(l.atual)} / {l.fmt(l.meta)}</span>
                  <Badge tone={TOM_BADGE[st.tom]}>{st.pct}%</Badge>
                </span>
              </div>
              <ProgressBar pct={st.pct} tom={st.tom} />
            </div>
          )
        })}
        {linhasLimite.map((l) => {
          const st = statusLimite(l.atual, l.limite)
          return (
            <div key={l.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-300">
                  <l.icon size={12} className="text-muted" /> {l.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-zinc-300">{l.fmt(l.atual)} / {l.fmt(l.limite)}</span>
                  <Badge tone={TOM_BADGE[st.tom]}>{st.label}</Badge>
                </span>
              </div>
              <ProgressBar pct={st.pct} tom={st.tom} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Toggle
// ============================================================
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={on}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-brand-600' : 'bg-zinc-600')}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

// ============================================================
// SquadsTable
// ============================================================
export function SquadsTable({
  squads,
  onToggle,
  onEdit,
  onDelete,
}: {
  squads: Squad[]
  onToggle: (id: string) => void
  onEdit: (s: Squad) => void
  onDelete: (id: string) => void
}) {
  const columns: Column<Squad>[] = [
    {
      key: 'nome',
      header: 'Nome',
      render: (s) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium text-zinc-100">{s.nome}</span>
          {!s.ativo && <Badge tone="neutral">Inativo</Badge>}
        </span>
      ),
    },
    { key: 'descricao', header: 'Descrição', render: (s) => <span className="text-zinc-300">{s.descricao ?? '—'}</span> },
    { key: 'lider', header: 'Líder', render: (s) => <span className="text-zinc-300">{s.lider ?? '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <span className="inline-flex items-center gap-2">
          <Toggle on={s.ativo} onChange={() => onToggle(s.id)} />
          <span className="text-[11px] text-muted">{s.ativo ? 'Ativo' : 'Inativo'}</span>
        </span>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (s) => (
        <span className="inline-flex items-center justify-end gap-1">
          <button onClick={() => onEdit(s)} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300" title="Editar">
            <Pencil size={12} />
          </button>
          <button
            onClick={() => !s.hasLinkedClients && onDelete(s.id)}
            disabled={s.hasLinkedClients}
            className={cn(
              'grid h-7 w-7 place-items-center rounded',
              s.hasLinkedClients ? 'cursor-not-allowed text-zinc-600' : 'text-red-400 hover:bg-red-500/10',
            )}
            title={s.hasLinkedClients ? 'Possui vínculos — só pode inativar' : 'Excluir'}
          >
            <Trash2 size={12} />
          </button>
        </span>
      ),
    },
  ]
  return <DataTable columns={columns} rows={squads} rowKey={(s) => s.id} minWidth={720} />
}

// ============================================================
// PermissionBadgeList — até 2 badges + "+N" com popover no hover
// ============================================================
export function PermissionBadgeList({ permissoes }: { permissoes: string[] }) {
  if (permissoes.length === 0) return <span className="text-[11px] text-muted">—</span>
  const visiveis = permissoes.slice(0, 2)
  const resto = permissoes.slice(2)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visiveis.map((p) => (
        <Badge key={p} tone="neutral">{p}</Badge>
      ))}
      {resto.length > 0 && (
        <span className="group relative">
          <Badge tone="neutral" className="cursor-default">+{resto.length}</Badge>
          <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden min-w-[160px] rounded-lg border border-border bg-bg-elev p-2 shadow-xl group-hover:block">
            <span className="flex flex-col gap-1">
              {resto.map((p) => (
                <span key={p} className="whitespace-nowrap text-[11px] text-zinc-200">{p}</span>
              ))}
            </span>
          </span>
        </span>
      )}
    </span>
  )
}

// ============================================================
// RolesTable (completa)
// ============================================================
export function RolesTable({
  roles,
  emUso,
  onToggle,
  onEdit,
  onDelete,
}: {
  roles: Role[]
  emUso: Set<string>
  onToggle: (id: string) => void
  onEdit: (r: Role) => void
  onDelete: (id: string) => void
}) {
  const columns: Column<Role>[] = [
    { key: 'nome', header: 'Nome', render: (r) => <span className="font-medium text-zinc-100">{r.nome}</span> },
    { key: 'tipo', header: 'Tipo', render: (r) => <Badge tone={r.tipo === 'estrategico' ? 'warning' : 'neutral'}>{r.tipo === 'estrategico' ? 'estratégico' : 'operacional'}</Badge> },
    { key: 'escopo', header: 'Escopo', render: (r) => <Badge tone="neutral">{r.escopo}</Badge> },
    { key: 'permissoes', header: 'Permissões', render: (r) => <PermissionBadgeList permissoes={r.permissoes} /> },
    { key: 'jd', header: 'JD', render: (r) => <Badge tone={r.jdPreenchida ? 'warning' : 'neutral'}>{r.jdPreenchida ? 'Preenchido' : 'Vazio'}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <Toggle on={r.ativo} onChange={() => onToggle(r.id)} />
          <span className="text-[11px] text-muted">{r.ativo ? 'Ativo' : 'Inativo'}</span>
        </span>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (r) => {
        const bloqueado = emUso.has(r.nome)
        return (
          <span className="inline-flex items-center justify-end gap-1">
            <button className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300" title="Job description">
              <FileText size={12} />
            </button>
            <button onClick={() => onEdit(r)} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300" title="Editar">
              <Pencil size={12} />
            </button>
            <button
              onClick={() => !bloqueado && onDelete(r.id)}
              disabled={bloqueado}
              className={cn('grid h-7 w-7 place-items-center rounded', bloqueado ? 'cursor-not-allowed text-zinc-600' : 'text-red-400 hover:bg-red-500/10')}
              title={bloqueado ? 'Possui vínculos ativos — só pode inativar' : 'Excluir'}
            >
              <Trash2 size={12} />
            </button>
          </span>
        )
      },
    },
  ]
  return <DataTable columns={columns} rows={roles} rowKey={(r) => r.id} minWidth={980} />
}

// ============================================================
// RoleFormModal — Novo Papel / Editar Papel (mesma estrutura)
// ============================================================
export function RoleFormModal({
  open,
  mode = 'create',
  role,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode?: 'create' | 'edit'
  role?: Role | null
  onClose: () => void
  onSubmit: (nome: string, tipo: Role['tipo'], escopo: Role['escopo'], permissoes: string[]) => void
}) {
  const nomeRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<Role['tipo']>('operacional')
  const [escopo, setEscopo] = useState<Role['escopo']>('Squad')
  const [perms, setPerms] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const editando = mode === 'edit'

  useEffect(() => {
    if (!open) return
    if (editando && role) {
      setNome(role.nome)
      setTipo(role.tipo)
      setEscopo(role.escopo)
      setPerms(role.permissoes)
    } else {
      setNome('')
      setTipo('operacional')
      setEscopo('Squad')
      setPerms([])
    }
    setErro(null)
    const t = setTimeout(() => {
      nomeRef.current?.focus()
      nomeRef.current?.select()
    }, 20)
    return () => clearTimeout(t)
  }, [open, editando, role])

  function togglePerm(p: string) {
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }
  function salvar() {
    if (!nome.trim()) {
      setErro('Informe o nome do papel.')
      return
    }
    onSubmit(nome.trim(), tipo, escopo, perms)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar Papel' : 'Novo Papel'}
      footer={
        <div className="flex justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar}>Salvar</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        {erro && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{erro}</div>}
        <FormField label="Nome" required>
          <Input ref={nomeRef} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Account Manager" />
        </FormField>
        <FormField label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as Role['tipo'])}>
            <option value="estrategico">Estratégico</option>
            <option value="operacional">Operacional</option>
          </Select>
        </FormField>
        <FormField label="Escopo do Cargo" hint="Global = Coordenador, Head, Diretor (não vinculado a squad)">
          <Select value={escopo} onChange={(e) => setEscopo(e.target.value as Role['escopo'])}>
            <option value="Squad">Squad</option>
            <option value="Global">Global</option>
          </Select>
        </FormField>
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Permissões</p>
          <div className="flex flex-col gap-1.5">
            {PERMISSOES.map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} className="h-3.5 w-3.5 rounded border-border bg-bg-elev accent-orange-500" />
                {p}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
// TeamMembersTable
// ============================================================
export function TeamMembersTable({
  membros,
  onToggle,
  onEdit,
}: {
  membros: TeamMember[]
  onToggle: (id: string) => void
  onEdit: (m: TeamMember) => void
}) {
  const columns: Column<TeamMember>[] = [
    {
      key: 'nome',
      header: 'Nome',
      render: (m) => (
        <span className="inline-flex items-center gap-2">
          <span className={cn('font-medium', m.ativo ? 'text-zinc-100' : 'text-zinc-500')}>{m.nome}</span>
          {!m.ativo && <Badge tone="neutral">Inativo</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'Email', render: (m) => (m.email ? <span className="text-sky-300">{m.email}</span> : <span className="text-muted">—</span>) },
    { key: 'papel', header: 'Papel', render: (m) => (m.papel ? <Badge tone="neutral" className="text-sky-200">{m.papel}</Badge> : <span className="text-muted">—</span>) },
    { key: 'squad', header: 'Squad Principal', render: (m) => <span className={m.ativo ? 'text-zinc-300' : 'text-zinc-500'}>{m.squad ?? '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (m) => (
        <span className="inline-flex items-center gap-2">
          <Toggle on={m.ativo} onChange={() => onToggle(m.id)} />
          <span className="text-[11px] text-muted">{m.ativo ? 'Ativo' : 'Inativo'}</span>
        </span>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (m) => (
        <span className="inline-flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(m)}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
            title="Editar papel e squad"
          >
            <Pencil size={12} />
          </button>
        </span>
      ),
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={membros}
      rowKey={(m) => m.id}
      minWidth={860}
      className="[&_tbody_tr:has(.text-zinc-500)]:bg-bg-soft/30"
    />
  )
}

// ============================================================
// EditMemberModal — atribui papel + squad a um membro (profiles)
// ============================================================
export function EditMemberModal({
  open,
  nome,
  papelIdAtual,
  squadIdAtual,
  papeis,
  squads,
  onClose,
  onSave,
}: {
  open: boolean
  nome: string
  papelIdAtual: string | null
  squadIdAtual: string | null
  papeis: { id: string; nome: string }[]
  squads: { id: string; nome: string }[]
  onClose: () => void
  onSave: (papelId: string | null, squadId: string | null) => void
}) {
  const [papelId, setPapelId] = useState('')
  const [squadId, setSquadId] = useState('')

  useEffect(() => {
    if (!open) return
    setPapelId(papelIdAtual ?? '')
    setSquadId(squadIdAtual ?? '')
  }, [open, papelIdAtual, squadIdAtual])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar membro: ${nome}`}
      footer={
        <div className="flex justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={() => onSave(papelId || null, squadId || null)}>Salvar</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Papel operacional" hint="Define as permissões do membro.">
          <Select value={papelId} onChange={(e) => setPapelId(e.target.value)}>
            <option value="">— Sem papel —</option>
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Squad principal">
          <Select value={squadId} onChange={(e) => setSquadId(e.target.value)}>
            <option value="">— Sem squad —</option>
            {squads.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  )
}

// ============================================================
// EditSquadGoalsModal — Editar Metas do Squad
// ============================================================
export interface MetasEdicao {
  indicacoesAtual: number
  novaReceitaManual: number
  descricaoManual: string
  metaIndicacoes: number
  metaNovaReceita: number
  logoChurn: number
  revChurn: number
}

export function EditSquadGoalsModal({
  open,
  squad,
  onClose,
  onSave,
}: {
  open: boolean
  squad: Squad | null
  onClose: () => void
  onSave: (squadId: string, m: MetasEdicao) => void
}) {
  const [ind, setInd] = useState(0)
  const [novaManual, setNovaManual] = useState(0)
  const [descManual, setDescManual] = useState('')
  const [metaInd, setMetaInd] = useState(0)
  const [metaNova, setMetaNova] = useState(0)
  const [logo, setLogo] = useState(0)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    if (open && squad) {
      setInd(squad.atual.indicacoes)
      setNovaManual(0)
      setDescManual('')
      setMetaInd(squad.metas.indicacoes)
      setMetaNova(squad.metas.novaReceita)
      setLogo(squad.metas.logoChurn)
      setRev(squad.metas.revChurn)
    }
  }, [open, squad])

  if (!squad) return null

  function salvar() {
    if (!squad) return
    onSave(squad.id, {
      indicacoesAtual: ind,
      novaReceitaManual: novaManual,
      descricaoManual: descManual,
      metaIndicacoes: metaInd,
      metaNovaReceita: metaNova,
      logoChurn: logo,
      revChurn: rev,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar Metas - ${squad.nome}`}
      footer={
        <div className="flex justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar}>Salvar</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Valor atual */}
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <Users2 size={11} /> Valor atual
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5">
            <span className="text-sm text-zinc-200">Indicações do Mês</span>
            <div className="flex items-center gap-1">
              <StepBtn icon={Minus} onClick={() => setInd((v) => Math.max(0, v - 1))} />
              <span className="w-8 text-center text-sm font-semibold tabular-nums text-zinc-100">{ind}</span>
              <StepBtn icon={Plus} onClick={() => setInd((v) => v + 1)} />
            </div>
          </div>
        </div>

        {/* Nova receita manual */}
        <FormField label="Nova Receita Manual (R$)">
          <Input type="number" value={novaManual} onChange={(e) => setNovaManual(Number(e.target.value))} />
        </FormField>
        <FormField label="Descrição da nova receita manual" hint="Aparece no card “Resultado do Negócio” do dashboard.">
          <Input value={descManual} onChange={(e) => setDescManual(e.target.value)} placeholder="Ex.: Indicação da Dra. Ana — projeto pontual" />
        </FormField>

        {/* Metas mensais */}
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <TrendingUp size={11} /> Metas mensais
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Meta Indicações">
              <Input type="number" value={metaInd} onChange={(e) => setMetaInd(Number(e.target.value))} />
            </FormField>
            <FormField label="Meta NRR (%)" hint="Fixa em 95% para todos os squads">
              <Input type="number" value={squad.metas.nrr} disabled />
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="Meta Nova Receita (R$)">
              <Input type="number" step="0.01" value={metaNova} onChange={(e) => setMetaNova(Number(e.target.value))} />
            </FormField>
          </div>
        </div>

        {/* Limites de churn */}
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <AlertTriangle size={11} className="text-amber-300" /> Limites de Churn (máximo tolerado)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Logo Churn (clientes)">
              <Input type="number" value={logo} onChange={(e) => setLogo(Number(e.target.value))} />
            </FormField>
            <FormField label="Rev. Churn (R$)">
              <Input type="number" step="0.01" value={rev} onChange={(e) => setRev(Number(e.target.value))} />
            </FormField>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function StepBtn({ icon: Icon, onClick }: { icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-bg-elev text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300"
    >
      <Icon size={13} />
    </button>
  )
}

// ============================================================
// NewMemberModal
// ============================================================
export function NewMemberModal({
  open,
  onClose,
  papeis,
  squads,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  papeis: string[]
  squads: string[]
  onCreate: (nome: string, email: string, papel: string | null, squad: string | null) => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('')
  const [squad, setSquad] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNome('')
      setEmail('')
      setPapel('')
      setSquad('')
      setErro(null)
    }
  }, [open])

  function salvar() {
    if (!nome.trim()) {
      setErro('Informe o nome.')
      return
    }
    onCreate(nome.trim(), email.trim(), papel || null, squad || null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Membro"
      footer={
        <div className="flex justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar}>Salvar</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        {erro && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{erro}</div>}
        <FormField label="Nome" required>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
        </FormField>
        <FormField label="Email/Login">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@movmed.com" />
        </FormField>
        <FormField label="Papel Operacional">
          <Select value={papel} onChange={(e) => setPapel(e.target.value)}>
            <option value="">Selecionar papel (opcional)</option>
            {papeis.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Squad Principal">
          <Select value={squad} onChange={(e) => setSquad(e.target.value)}>
            <option value="">Selecionar squad (opcional)</option>
            {squads.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  )
}

// ============================================================
// SquadFormModal — Novo Squad / Editar Squad (mesma estrutura)
// ============================================================
export function SquadFormModal({
  open,
  mode = 'create',
  squad,
  liders,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode?: 'create' | 'edit'
  squad?: Squad | null
  /** Líderes possíveis (profiles reais). Fonte central, sem lista fixa. */
  liders: { id: string; nome: string }[]
  onClose: () => void
  onSubmit: (nome: string, descricao: string, liderId: string | null) => void
}) {
  const nomeRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [liderId, setLiderId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const editando = mode === 'edit'

  useEffect(() => {
    if (!open) return
    if (editando && squad) {
      setNome(squad.nome)
      setDescricao(squad.descricao ?? '')
      setLiderId(squad.liderId ?? '')
    } else {
      setNome('')
      setDescricao('')
      setLiderId('')
    }
    setErro(null)
    // Foca e seleciona o nome ao abrir (útil no modo edição)
    const t = setTimeout(() => {
      nomeRef.current?.focus()
      nomeRef.current?.select()
    }, 20)
    return () => clearTimeout(t)
  }, [open, editando, squad])

  function submeter() {
    if (!nome.trim()) {
      setErro('Informe o nome do squad.')
      return
    }
    onSubmit(nome.trim(), descricao.trim(), liderId || null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar Squad' : 'Novo Squad'}
      footer={
        <div className="flex justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={submeter}>{editando ? 'Salvar' : 'Criar Squad'}</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        {erro && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{erro}</div>}
        <FormField label="Nome" required>
          <Input ref={nomeRef} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Squad MovSales" />
        </FormField>
        <FormField label="Descrição">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do squad" />
        </FormField>
        <FormField label="Líder do Squad">
          <Select value={liderId} onChange={(e) => setLiderId(e.target.value)}>
            <option value="">Nenhum</option>
            {liders.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  )
}
