/**
 * Ficha do Cliente — a nova visao "cara" que abre por default quando
 * clica num cliente. Reune num so lugar: quem e', quanto vale, como
 * esta e quais acoes tomar. Diferente do Cliente Detalhe atual, que
 * e' orientado a features operacionais (tarefas, ativos, criacoes,
 * metas), a Ficha e' orientada a SITUACAO comercial do cliente.
 *
 * Blocos:
 *   Header: nome, badges (status, risco, jornada, outlier), NPS
 *   Info grid: Squad, AM, Gestor, Data, Ticket, Social, Ult. Contato,
 *              Servicos Contratados
 *   LTV Atual: tempo de casa, ticket, LTV
 *   Evolucao Mensal (v2 — precisa metrics por mes)
 *   Acoes Rapidas: Enviar NPS, Marcar Risco, Registrar Expansao,
 *                   Registrar Perda
 *   Contrato (v2)
 *   Briefing de Trafego (v2)
 *   Logins e Acessos — reusa LoginsAcessosPanel existente
 *   Acesso ao Portal do Cliente (v2 — feature nova)
 *   Timeline de Alteracoes (v2 — precisa events table)
 *
 * Callback onChanged() dispara reload no ClienteDetalhe (pai) —
 * necessario quando muda status via "Marcar Risco".
 */
import { useMemo, useState } from 'react'
import {
  Pencil,
  Phone,
  Calendar,
  Users,
  Send,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Smile,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoginsAcessosPanel } from '@/components/ativos/LoginsAcessosPanel'
import type { Cliente } from '@/types/database'

// Meses entre uma ISO date e hoje
function mesesDesde(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  const hoje = new Date()
  const diffMs = hoje.getTime() - d.getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 30.44))
}

function formatDateBR(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

const statusTone: Record<Cliente['status'], { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' },
  atencao: {
    label: 'Atenção',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  },
  pausado: { label: 'Pausado', className: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-200' },
  churn: { label: 'Churn', className: 'border-red-500/40 bg-red-500/10 text-red-200' },
}

interface Props {
  cliente: Cliente
  onChanged: () => void
  onEdit: () => void
}

export function ClienteFicha({ cliente, onChanged, onEdit }: Props) {
  const tempoCasa = useMemo(() => mesesDesde(cliente.data_inicio), [cliente.data_inicio])
  const ltvAtual = useMemo(
    () => (cliente.verba_mensal ?? 0) * tempoCasa,
    [cliente.verba_mensal, tempoCasa],
  )

  const [savingRisco, setSavingRisco] = useState(false)

  async function marcarRisco() {
    if (cliente.status === 'atencao') {
      alert('Cliente já está marcado como em risco (Atenção).')
      return
    }
    if (!confirm('Marcar este cliente como em RISCO (Atenção)?')) return
    setSavingRisco(true)
    const { error } = await supabase
      .from('clientes')
      .update({ status: 'atencao' })
      .eq('id', cliente.id)
    setSavingRisco(false)
    if (error) {
      alert(`Erro: ${error.message}`)
      return
    }
    onChanged()
  }

  const status = statusTone[cliente.status]

  return (
    <div className="space-y-6">
      {/* ============= Header ============= */}
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-zinc-100">{cliente.nome}</h2>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                  status.className,
                )}
              >
                {status.label}
              </span>
            </div>
            {cliente.nicho && (
              <p className="mt-1 text-sm text-muted">{cliente.nicho}</p>
            )}

            {/* Row de badges de contexto */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="text-muted uppercase tracking-wider">Risco:</span>
                <Badge tone={cliente.status === 'atencao' ? 'warning' : 'neutral'}>
                  {cliente.status === 'atencao'
                    ? 'Atenção'
                    : cliente.status === 'churn'
                      ? 'Churn'
                      : 'OK'}
                </Badge>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-muted uppercase tracking-wider">Jornada:</span>
                <Badge tone="brand">{cliente.jornada ?? '—'}</Badge>
              </span>
              <span className="flex items-center gap-1.5 text-muted italic">
                Outlier: — <span className="text-[10px]">(v2)</span>
              </span>
            </div>
          </div>

          {/* Canto direito: NPS */}
          <div className="rounded-lg border border-border bg-bg-soft/60 px-4 py-2 text-right">
            <p className="text-[9px] uppercase tracking-wider text-muted">NPS do mês</p>
            <p
              className={cn(
                'text-3xl font-bold tabular-nums leading-none mt-1',
                cliente.nps === null
                  ? 'text-zinc-500'
                  : cliente.nps >= 8
                    ? 'text-emerald-300'
                    : cliente.nps >= 6
                      ? 'text-amber-300'
                      : 'text-red-300',
              )}
            >
              {cliente.nps ?? '—'}
            </p>
            <p className="mt-1 text-[10px] text-muted">
              {cliente.nps === null
                ? 'sem NPS'
                : cliente.nps >= 8
                  ? 'Promotor'
                  : cliente.nps >= 6
                    ? 'Neutro'
                    : 'Detrator'}
            </p>
          </div>
        </div>

        {/* Grid info principal */}
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 md:grid-cols-4">
          <InfoField label="Squad" value={cliente.squad ?? '—'} />
          <InfoField label="Account Manager" value={cliente.account_manager?.nome ?? '—'} />
          <InfoField label="Gestor de Tráfego" value={cliente.gestor?.nome ?? '—'} />
          <InfoField label="Data de Entrada" value={formatDateBR(cliente.data_inicio)} />
          <InfoField
            label="Ticket Mensal"
            value={formatCurrency(cliente.verba_mensal ?? 0)}
            destaque
          />
          <InfoField label="Social Media" value={cliente.social_media?.nome ?? '—'} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Último Contato
            </p>
            <p className="mt-1 text-sm text-zinc-100">—</p>
            <p className="text-[10px] text-muted italic">v2 — tracking pendente</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Serviços Contratados
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {cliente.modulos && cliente.modulos.length > 0 ? (
                cliente.modulos.map((m) => (
                  <Badge key={m} tone="brand" className="!text-[10px]">
                    {m === 'trafego' ? 'Tráfego Pago' : m === 'social_media' ? 'Social Media' : m}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Botao editar no rodape do header */}
        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil size={12} /> Editar cliente
          </Button>
        </div>
      </div>

      {/* ============= LTV Atual ============= */}
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign size={14} className="text-emerald-300" />
          <h3 className="text-sm font-semibold text-zinc-100">LTV Atual</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Tempo de Casa
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
              {Math.floor(tempoCasa)} {Math.floor(tempoCasa) === 1 ? 'mês' : 'meses'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Ticket Mensal
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
              {formatCurrency(cliente.verba_mensal ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              LTV Atual
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
              {formatCurrency(ltvAtual)}
            </p>
          </div>
        </div>
      </div>

      {/* ============= Evolucao Mensal (placeholder) ============= */}
      <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp size={14} className="text-muted" />
          <h3 className="text-sm font-semibold text-zinc-100">Evolução Mensal</h3>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300">
            v2
          </span>
        </div>
        <p className="text-xs text-muted">
          Tabela mês a mês com Investimento, Faturamento, ROAS, Leads, Consultas, Vendas e
          Variação — vai chegar quando ligar as métricas mensais de tráfego por cliente.
        </p>
      </div>

      {/* ============= Acoes Rapidas ============= */}
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-100">Ações Rápidas</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <AcaoBtn
            icon={<Send size={14} />}
            label="Enviar NPS"
            hint="Link público (v2)"
            disabled
            onClick={() => alert('Envio de NPS por link público — v2')}
          />
          <AcaoBtn
            icon={<AlertTriangle size={14} />}
            label={cliente.status === 'atencao' ? 'Já em risco' : 'Marcar Risco'}
            hint="Muda status pra Atenção"
            tone="warning"
            disabled={savingRisco || cliente.status === 'atencao'}
            onClick={marcarRisco}
          />
          <AcaoBtn
            icon={<TrendingUp size={14} />}
            label="Registrar Expansão"
            hint="Log de MRR+ (v2)"
            disabled
            onClick={() => alert('Registrar expansão — v2')}
          />
          <AcaoBtn
            icon={<TrendingDown size={14} />}
            label="Registrar Perda"
            hint="Log de MRR- (v2)"
            disabled
            onClick={() => alert('Registrar perda — v2')}
          />
        </div>
      </div>

      {/* ============= Contrato (placeholder) ============= */}
      <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <FileText size={14} className="text-muted" />
          <h3 className="text-sm font-semibold text-zinc-100">Contrato</h3>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300">
            v2
          </span>
        </div>
        <p className="text-xs text-muted">
          Tipo (mensal/anual), início, fim, dias restantes, status, responsável — precisa
          da tabela de contratos.
        </p>
      </div>

      {/* ============= Briefing (placeholder) ============= */}
      <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <FileText size={14} className="text-muted" />
          <h3 className="text-sm font-semibold text-zinc-100">Briefing de Tráfego</h3>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300">
            v2
          </span>
        </div>
        <p className="text-xs text-muted">
          Status do briefing (pendente / enviado / respondido) + botão pra enviar link. v2.
        </p>
      </div>

      {/* ============= Logins e Acessos — reusa componente ============= */}
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <LinkIcon size={14} className="text-brand-300" />
          <h3 className="text-sm font-semibold text-zinc-100">Logins e Acessos</h3>
        </div>
        <LoginsAcessosPanel clienteId={cliente.id} />
      </div>

      {/* ============= Portal do Cliente (placeholder) ============= */}
      <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <LinkIcon size={14} className="text-muted" />
          <h3 className="text-sm font-semibold text-zinc-100">Acesso ao Portal do Cliente</h3>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300">
            v2
          </span>
        </div>
        <p className="text-xs text-muted">
          Página read-only pro cliente ver evolução, briefing, aprovar planejamento. v2.
        </p>
      </div>

      {/* ============= Timeline (placeholder) ============= */}
      <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Clock size={14} className="text-muted" />
          <h3 className="text-sm font-semibold text-zinc-100">Timeline de Alterações</h3>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300">
            v2
          </span>
        </div>
        <p className="text-xs text-muted">
          Log de eventos do cliente (NPS registrado, contato, mudança de jornada, alteração
          de serviços). Precisa tabela cliente_eventos. v2.
        </p>
      </div>
    </div>
  )
}

// -------- Helpers UI --------

function InfoField({
  label,
  value,
  destaque = false,
}: {
  label: string
  value: string
  destaque?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p
        className={cn(
          'mt-1',
          destaque ? 'text-lg font-bold tabular-nums text-zinc-100' : 'text-sm text-zinc-100',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function AcaoBtn({
  icon,
  label,
  hint,
  onClick,
  disabled = false,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
  tone?: 'neutral' | 'warning'
}) {
  const cls =
    tone === 'warning'
      ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-200'
      : 'border-border bg-bg-soft hover:bg-bg-elev text-zinc-200'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors',
        cls,
        disabled && 'opacity-60 cursor-not-allowed hover:bg-bg-soft',
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-[10px] text-muted">{hint}</span>
    </button>
  )
}

// Suppress unused warnings for icons imported for future use
void Phone
void Calendar
void Users
void Smile
void CheckCircle2
