/**
 * Componentes da tela de Configurações.
 * SettingsTabs, GoalCard, MiniStat, SquadCalcCard, SquadMetricPanel,
 * ProgressBar, SquadsTable, RolesTable, NewSquadModal, Toggle.
 */
import { useEffect, useState } from 'react'
import {
  TrendingUp,
  Zap,
  AlertTriangle,
  OctagonAlert,
  Pencil,
  Trash2,
  FileText,
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
  statusCrescimento,
  statusLimite,
  type Params,
  type Role,
  type Squad,
  type StatusTom,
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
// RolesTable
// ============================================================
export function RolesTable({ roles, onToggle }: { roles: Role[]; onToggle: (id: string) => void }) {
  const columns: Column<Role>[] = [
    { key: 'nome', header: 'Nome', render: (r) => <span className="font-medium text-zinc-100">{r.nome}</span> },
    { key: 'tipo', header: 'Tipo', render: (r) => <Badge tone="accent">{r.tipo}</Badge> },
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
    { key: 'jd', header: 'JD', render: (r) => (r.jd ? <a className="text-sky-300 hover:underline">{r.jd}</a> : <span className="text-muted">Vazio</span>) },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: () => (
        <span className="inline-flex items-center justify-end gap-1">
          <button className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300" title="Job description">
            <FileText size={12} />
          </button>
          <button className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300" title="Editar">
            <Pencil size={12} />
          </button>
          <button className="grid h-7 w-7 place-items-center rounded text-red-400 hover:bg-red-500/10" title="Excluir">
            <Trash2 size={12} />
          </button>
        </span>
      ),
    },
  ]
  return <DataTable columns={columns} rows={roles} rowKey={(r) => r.id} minWidth={640} />
}

// ============================================================
// NewSquadModal
// ============================================================
export function NewSquadModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (nome: string, descricao: string, lider: string | null) => void
}) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [lider, setLider] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNome('')
      setDescricao('')
      setLider('')
      setErro(null)
    }
  }, [open])

  function criar() {
    if (!nome.trim()) {
      setErro('Informe o nome do squad.')
      return
    }
    onCreate(nome.trim(), descricao.trim(), lider || null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Squad"
      footer={
        <div className="flex justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={criar}>Criar Squad</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        {erro && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{erro}</div>}
        <FormField label="Nome" required>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Squad MovSales" />
        </FormField>
        <FormField label="Descrição">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do squad" />
        </FormField>
        <FormField label="Líder do Squad">
          <Select value={lider} onChange={(e) => setLider(e.target.value)}>
            <option value="">Nenhum</option>
            {COLABORADORES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  )
}
