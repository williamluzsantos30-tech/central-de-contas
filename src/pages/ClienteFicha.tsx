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
import { useEffect, useMemo, useState } from 'react'
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
  Megaphone,
  Instagram,
  LayoutGrid,
  Palette,
  Leaf,
  X,
  Mail,
  Video,
  MessageCircle,
  Paperclip,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoginsAcessosPanel } from '@/components/ativos/LoginsAcessosPanel'
import { uploadToStorageSafe } from '@/lib/storage'
import type { Cliente, ClienteEvento } from '@/types/database'

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

// Catalogo de servicos contratados. Adicionar aqui pra habilitar
// um novo servico em toda a UI. `key` casa com o valor guardado no
// array `clientes.servicos_contratados`.
interface ServicoDef {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  cor: string // classes Tailwind da badge
}

const SERVICOS_CATALOGO: ServicoDef[] = [
  {
    key: 'trafego_pago',
    label: 'Tráfego Pago',
    icon: Megaphone,
    cor: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  },
  {
    key: 'social_media',
    label: 'Social Media',
    icon: Instagram,
    cor: 'border-pink-500/40 bg-pink-500/10 text-pink-200',
  },
  {
    key: 'landing_page',
    label: 'Landing Page',
    icon: LayoutGrid,
    cor: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
  },
  {
    key: 'comercial_crm',
    label: 'Comercial/CRM',
    icon: Users,
    cor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  },
  {
    key: 'identidade_visual',
    label: 'Identidade Visual',
    icon: Palette,
    cor: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  },
  {
    key: 'salvia',
    label: 'Salvia',
    icon: Leaf,
    cor: 'border-lime-500/40 bg-lime-500/10 text-lime-200',
  },
]

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
  const [servicosModalOpen, setServicosModalOpen] = useState(false)
  const [contatoModalOpen, setContatoModalOpen] = useState(false)
  const [expansaoModalOpen, setExpansaoModalOpen] = useState(false)
  const [perdaModalOpen, setPerdaModalOpen] = useState(false)
  const [eventos, setEventos] = useState<ClienteEvento[]>([])
  const [loadingEventos, setLoadingEventos] = useState(true)

  async function loadEventos() {
    setLoadingEventos(true)
    const { data } = await supabase
      .from('cliente_eventos')
      .select('*, autor:profiles!criado_por(*)')
      .eq('cliente_id', cliente.id)
      .order('criado_em', { ascending: false })
      .limit(50)
    setEventos((data as ClienteEvento[]) ?? [])
    setLoadingEventos(false)
  }

  useEffect(() => {
    loadEventos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id])

  // Ultimo contato = evento tipo='contato' mais recente
  const ultimoContato = useMemo(() => {
    const c = eventos.find((e) => e.tipo === 'contato')
    if (!c) return null
    const dataContato =
      (c.meta as { data_contato?: string })?.data_contato ?? c.criado_em
    const tipoLabel =
      (c.meta as { tipo_contato?: string })?.tipo_contato ?? '—'
    const hoje = new Date()
    const d = new Date(dataContato)
    const dias = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    return { data: dataContato, tipoLabel, diasAtras: dias }
  }, [eventos])

  // Servicos que o cliente TEM contratados (mapeados pelo catalogo pra
  // ter icone/cor). Servicos "orfaos" (nao existem no catalogo) sao
  // exibidos como chip generico no fim, com aviso.
  const servicosAtuais = cliente.servicos_contratados ?? []
  const servicosMapeados = SERVICOS_CATALOGO.filter((s) => servicosAtuais.includes(s.key))
  const servicosOrfaos = servicosAtuais.filter(
    (k) => !SERVICOS_CATALOGO.find((s) => s.key === k),
  )

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
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Último Contato
              </p>
              <button
                type="button"
                onClick={() => setContatoModalOpen(true)}
                className="grid h-4 w-4 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
                title="Registrar novo contato"
              >
                <Phone size={9} />
              </button>
            </div>
            {ultimoContato ? (
              <>
                <p className="mt-1 text-sm text-zinc-100">
                  {formatDateBR(ultimoContato.data)}
                </p>
                <p className="text-[10px] text-muted">
                  {ultimoContato.tipoLabel} · {ultimoContato.diasAtras < 0 ? 'hoje' : `há ${ultimoContato.diasAtras} dias`}
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setContatoModalOpen(true)}
                className="mt-1 text-xs text-muted hover:text-brand-300 italic underline"
              >
                nunca registrado — registrar
              </button>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Serviços Contratados
              </p>
              <button
                type="button"
                onClick={() => setServicosModalOpen(true)}
                className="grid h-4 w-4 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
                title="Editar serviços"
              >
                <Pencil size={9} />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {servicosMapeados.length > 0 || servicosOrfaos.length > 0 ? (
                <>
                  {servicosMapeados.map((s) => {
                    const Icon = s.icon
                    return (
                      <span
                        key={s.key}
                        className={cn(
                          'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                          s.cor,
                        )}
                      >
                        <Icon size={9} />
                        {s.label}
                      </span>
                    )
                  })}
                  {servicosOrfaos.map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center rounded border border-border bg-bg-soft px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
                      title="Serviço sem definição no catálogo — pode ter sido removido"
                    >
                      {k}
                    </span>
                  ))}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setServicosModalOpen(true)}
                  className="text-xs text-muted hover:text-brand-300 italic underline"
                >
                  nenhum — adicionar
                </button>
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
            hint="Upsell / novo serviço"
            onClick={() => setExpansaoModalOpen(true)}
          />
          <AcaoBtn
            icon={<TrendingDown size={14} />}
            label="Registrar Perda"
            hint="Downsell / redução"
            tone="warning"
            onClick={() => setPerdaModalOpen(true)}
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

      {/* ============= Timeline real ============= */}
      <TimelineAlteracoes
        eventos={eventos}
        loading={loadingEventos}
        onReload={loadEventos}
        onRegistrarContato={() => setContatoModalOpen(true)}
      />

      {/* Modal — editar servicos contratados */}
      {servicosModalOpen && (
        <ServicosModal
          cliente={cliente}
          onClose={() => setServicosModalOpen(false)}
          onSaved={() => {
            setServicosModalOpen(false)
            onChanged()
            loadEventos()
          }}
        />
      )}

      {/* Modal — registrar novo contato */}
      {contatoModalOpen && (
        <ContatoModal
          cliente={cliente}
          onClose={() => setContatoModalOpen(false)}
          onSaved={() => {
            setContatoModalOpen(false)
            loadEventos()
          }}
        />
      )}

      {/* Modal — registrar expansao (upsell) */}
      {expansaoModalOpen && (
        <ExpansaoPerdaModal
          cliente={cliente}
          direcao="expansao"
          onClose={() => setExpansaoModalOpen(false)}
          onSaved={() => {
            setExpansaoModalOpen(false)
            onChanged()
            loadEventos()
          }}
        />
      )}

      {/* Modal — registrar perda (downsell) */}
      {perdaModalOpen && (
        <ExpansaoPerdaModal
          cliente={cliente}
          direcao="perda"
          onClose={() => setPerdaModalOpen(false)}
          onSaved={() => {
            setPerdaModalOpen(false)
            onChanged()
            loadEventos()
          }}
        />
      )}
    </div>
  )
}

// -------- Modal Servicos Contratados --------
function ServicosModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: Cliente
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<string[]>(
    cliente.servicos_contratados ?? [],
  )
  const [saving, setSaving] = useState(false)

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  async function salvar() {
    setSaving(true)
    const { error } = await supabase
      .from('clientes')
      .update({ servicos_contratados: selected })
      .eq('id', cliente.id)
    setSaving(false)
    if (error) {
      alert(`Erro: ${error.message}`)
      return
    }
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Serviços Contratados</h3>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          Selecione os serviços que este cliente contratou.
        </p>
        <div className="space-y-1.5">
          {SERVICOS_CATALOGO.map((s) => {
            const Icon = s.icon
            const isChecked = selected.includes(s.key)
            return (
              <label
                key={s.key}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                  isChecked
                    ? s.cor
                    : 'border-border bg-bg-soft/40 text-zinc-200 hover:border-brand-500/30',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(s.key)}
                  className="h-3.5 w-3.5 accent-brand-500 cursor-pointer"
                />
                <Icon size={13} />
                <span className="text-xs font-medium">{s.label}</span>
              </label>
            )
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
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
void Calendar
void Smile
void CheckCircle2

// ============================================================
// Modal — Registrar Contato
// ============================================================

const TIPOS_CONTATO = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'reuniao', label: 'Reunião', icon: Video },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
] as const

function ContatoModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: Cliente
  onClose: () => void
  onSaved: () => void
}) {
  const [tipo, setTipo] = useState<string>('')
  const [dataContato, setDataContato] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [resumo, setResumo] = useState('')
  const [proximoPasso, setProximoPasso] = useState('')
  const [arquivos, setArquivos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const uploaded: string[] = []
    for (const f of Array.from(files)) {
      const url = await uploadToStorageSafe(f, `cliente-eventos/${cliente.id}`)
      if (url) uploaded.push(url)
    }
    setArquivos((prev) => [...prev, ...uploaded])
    setUploading(false)
  }

  async function salvar() {
    setError(null)
    if (!tipo) {
      setError('Escolha o tipo de contato')
      return
    }
    if (resumo.trim().length < 3) {
      setError('Escreva um resumo do que foi discutido')
      return
    }
    setSaving(true)
    const tipoLabel = TIPOS_CONTATO.find((t) => t.value === tipo)?.label ?? tipo
    const { error: err } = await supabase.from('cliente_eventos').insert({
      cliente_id: cliente.id,
      tipo: 'contato',
      titulo: `Contato via ${tipoLabel}`,
      descricao: resumo.trim(),
      meta: {
        tipo_contato: tipoLabel,
        data_contato: dataContato,
        proximo_passo: proximoPasso.trim() || null,
      },
      arquivos,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Registrar Contato</h3>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          Documente uma interação com o cliente.
        </p>

        {error && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Tipo */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Tipo de Contato *
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
            >
              <option value="">Selecione o tipo</option>
              {TIPOS_CONTATO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Data do Contato
            </label>
            <input
              type="date"
              value={dataContato}
              onChange={(e) => setDataContato(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          {/* Resumo */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Resumo *
            </label>
            <textarea
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="O que foi discutido..."
              rows={4}
              className="w-full resize-none rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          {/* Próximo Passo */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Próximo Passo
            </label>
            <input
              value={proximoPasso}
              onChange={(e) => setProximoPasso(e.target.value)}
              placeholder="Ação combinada para o próximo contato"
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          {/* Anexos */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Anexos
            </label>
            <p className="mb-2 text-[10px] text-muted">
              Prints de conversas, exportações do WhatsApp, PDFs, áudios — até 20MB por arquivo.
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-soft/40 px-3 py-3 text-xs text-muted hover:border-brand-500/40 hover:text-brand-300">
              <Paperclip size={12} />
              {uploading ? 'Enviando…' : 'Adicionar arquivos'}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
                disabled={uploading}
              />
            </label>
            {arquivos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {arquivos.map((url, i) => (
                  <li
                    key={url}
                    className="flex items-center gap-2 rounded border border-border bg-bg-soft/40 px-2 py-1 text-[10px] text-zinc-200"
                  >
                    <Paperclip size={9} />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:text-brand-300"
                    >
                      Anexo {i + 1}
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setArquivos((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="ml-auto text-muted hover:text-red-300"
                    >
                      <X size={10} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} disabled={saving || uploading}>
            {saving ? 'Registrando…' : 'Registrar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Timeline de Alterações
// ============================================================

const eventoTipoConfig: Record<
  string,
  { cor: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  contato: { cor: 'text-sky-300', icon: Phone },
  nps: { cor: 'text-amber-300', icon: Smile },
  risco: { cor: 'text-red-300', icon: AlertTriangle },
  jornada: { cor: 'text-brand-300', icon: TrendingUp },
  servico: { cor: 'text-emerald-300', icon: CheckCircle2 },
  mrr: { cor: 'text-emerald-300', icon: DollarSign },
  responsavel: { cor: 'text-violet-300', icon: Users },
  expansao: { cor: 'text-emerald-300', icon: TrendingUp },
  perda: { cor: 'text-red-300', icon: TrendingDown },
}

function tempoRelativo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const dias = Math.floor(h / 24)
  if (dias < 30) return `há ${dias}d`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

// ============================================================
// Modal — Registrar Expansao / Perda
// ============================================================
//
// Um so modal atende os 2 casos porque a estrutura e' identica (valor,
// motivo, notas, flags recorrente/TCV, servicos_contratados). Muda so
// o SINAL do valor (perda subtrai do MRR) e alguns rotulos.

function ExpansaoPerdaModal({
  cliente,
  direcao,
  onClose,
  onSaved,
}: {
  cliente: Cliente
  direcao: 'expansao' | 'perda'
  onClose: () => void
  onSaved: () => void
}) {
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [valor, setValor] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [notas, setNotas] = useState('')
  const [recorrente, setRecorrente] = useState(true)
  const [tcv, setTcv] = useState(false)
  const [servicosAdicionar, setServicosAdicionar] = useState<string[]>([])
  const [servicosRemover, setServicosRemover] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Servicos ja contratados vs disponiveis
  const jaContratados = cliente.servicos_contratados ?? []
  const disponiveis = SERVICOS_CATALOGO.filter((s) => !jaContratados.includes(s.key))
  const contratados = SERVICOS_CATALOGO.filter((s) => jaContratados.includes(s.key))

  const ehExpansao = direcao === 'expansao'
  const titulo = ehExpansao ? 'Registrar Expansão' : 'Registrar Perda'
  const subLabel = ehExpansao
    ? 'Registre uma expansão de receita deste cliente.'
    : 'Registre uma redução ou perda de receita deste cliente.'
  const valorLabel = ehExpansao ? 'Valor da Expansão (R$) *' : 'Valor da Perda (R$) *'
  const motivoPh = ehExpansao ? 'Ex: Novo serviço contratado' : 'Ex: Cliente cancelou landing page'
  const btnLabel = ehExpansao ? 'Registrar Expansão' : 'Registrar Perda'
  const btnCls = ehExpansao ? 'bg-emerald-500' : 'bg-red-500'

  function toggleServico(key: string, tipo: 'add' | 'remove') {
    if (tipo === 'add') {
      setServicosAdicionar((p) =>
        p.includes(key) ? p.filter((k) => k !== key) : [...p, key],
      )
    } else {
      setServicosRemover((p) =>
        p.includes(key) ? p.filter((k) => k !== key) : [...p, key],
      )
    }
  }

  async function salvar() {
    setError(null)
    const valorNum = Number(valor)
    if (isNaN(valorNum) || valorNum <= 0) {
      setError('Valor precisa ser maior que zero')
      return
    }
    setSaving(true)
    const sinal = ehExpansao ? 1 : -1

    // 1) Insert evento
    const { error: evErr } = await supabase.from('cliente_eventos').insert({
      cliente_id: cliente.id,
      tipo: ehExpansao ? 'expansao' : 'perda',
      titulo: ehExpansao
        ? `Expansão · ${motivo.trim() || 'sem motivo'}`
        : `Perda · ${motivo.trim() || 'sem motivo'}`,
      descricao: notas.trim() || null,
      meta: {
        valor: valorNum,
        data,
        motivo: motivo.trim() || null,
        recorrente,
        tcv,
        servicos_adicionados: servicosAdicionar,
        servicos_removidos: servicosRemover,
      },
    })
    if (evErr) {
      setError(evErr.message)
      setSaving(false)
      return
    }

    // 2) Atualiza clientes se necessario
    const updates: Record<string, unknown> = {}
    // MRR so muda se recorrente e nao TCV (TCV nao mexe no MRR mensal
    // conforme sub-texto do modal — o valor total vai pra NRR/Expansao,
    // mas o mensal segue igual)
    if (recorrente && !tcv) {
      const novoMRR = (cliente.verba_mensal ?? 0) + sinal * valorNum
      updates.verba_mensal = Math.max(0, novoMRR)
    }
    // Servicos
    const novosServicos = [
      ...jaContratados.filter((k) => !servicosRemover.includes(k)),
      ...servicosAdicionar.filter((k) => !jaContratados.includes(k)),
    ]
    if (
      servicosAdicionar.length > 0 ||
      servicosRemover.length > 0
    ) {
      updates.servicos_contratados = novosServicos
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', cliente.id)
      if (upErr) {
        setError(`Evento salvo mas cliente nao atualizou: ${upErr.message}`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">{titulo}</h3>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-muted">{subLabel}</p>

        {error && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Data *
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              {valorLabel}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Motivo
            </label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={motivoPh}
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          {/* Flags */}
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-bg-soft/40 px-3 py-2">
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-brand-500 cursor-pointer"
            />
            <div>
              <span className="text-xs font-medium text-zinc-100">
                {ehExpansao ? 'Expansão recorrente' : 'Perda recorrente'}
              </span>
              <p className="text-[10px] text-muted">
                {recorrente
                  ? 'Adiciona ao MRR mensal a partir da data.'
                  : 'Receita apenas neste mês (ex: CRM, Identidade Visual, projeto pontual).'}
              </p>
            </div>
          </label>

          {ehExpansao && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-bg-soft/40 px-3 py-2">
              <input
                type="checkbox"
                checked={tcv}
                onChange={(e) => setTcv(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-brand-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-medium text-zinc-100">
                  Venda TCV (caixa coletado 100% no ato)
                </span>
                <p className="text-[10px] text-muted">
                  Marque quando o contrato foi pago integralmente no ato da venda. O
                  valor mensal acima continua sendo usado apenas para organização
                  de MRR; o valor total do contrato será contabilizado
                  integralmente em NRR e Expansão.
                </p>
              </div>
            </label>
          )}

          {/* Servicos */}
          {ehExpansao && disponiveis.length > 0 && (
            <div className="rounded-md border border-border bg-bg-soft/40 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Adicionar serviços contratados
              </p>
              <p className="mt-0.5 mb-2 text-[10px] text-muted">
                Opcional. Marque os serviços novos vendidos junto com essa
                expansão.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {disponiveis.map((s) => {
                  const Icon = s.icon
                  const marcado = servicosAdicionar.includes(s.key)
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleServico(s.key, 'add')}
                      className={cn(
                        'inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors',
                        marcado
                          ? s.cor
                          : 'border-border bg-bg-elev text-zinc-300 hover:border-brand-500/40',
                      )}
                    >
                      <Icon size={9} />
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!ehExpansao && contratados.length > 0 && (
            <div className="rounded-md border border-border bg-bg-soft/40 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Remover serviços contratados
              </p>
              <p className="mt-0.5 mb-2 text-[10px] text-muted">
                Opcional. Marque os serviços que o cliente deixou de contratar.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {contratados.map((s) => {
                  const Icon = s.icon
                  const marcado = servicosRemover.includes(s.key)
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleServico(s.key, 'remove')}
                      className={cn(
                        'inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors',
                        marcado
                          ? 'border-red-500/50 bg-red-500/15 text-red-200 line-through'
                          : 'border-border bg-bg-elev text-zinc-300 hover:border-red-500/40',
                      )}
                    >
                      <Icon size={9} />
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={salvar}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50',
              btnCls,
            )}
          >
            {saving ? 'Registrando…' : btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function TimelineAlteracoes({
  eventos,
  loading,
  onReload,
  onRegistrarContato,
}: {
  eventos: ClienteEvento[]
  loading: boolean
  onReload: () => void
  onRegistrarContato: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-brand-300" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Timeline de Alterações
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReload}
            className="grid h-7 w-7 place-items-center rounded-md border border-border bg-bg-soft text-muted hover:text-zinc-100"
            title="Recarregar"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
          <Button size="sm" variant="outline" onClick={onRegistrarContato}>
            <Phone size={11} /> Registrar Contato
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-xs text-muted">Carregando…</p>
      ) : eventos.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted italic">
          Sem eventos ainda. Registre um contato ou edite o cliente pra começar
          a alimentar a timeline.
        </p>
      ) : (
        <ul className="space-y-2">
          {eventos.map((ev) => {
            const cfg = eventoTipoConfig[ev.tipo] ?? {
              cor: 'text-muted',
              icon: Clock,
            }
            const Icon = cfg.icon
            const meta = (ev.meta ?? {}) as Record<string, unknown>
            const proximoPasso = typeof meta.proximo_passo === 'string' ? meta.proximo_passo : null
            return (
              <li
                key={ev.id}
                className="flex gap-3 rounded-lg border border-border bg-bg-soft/40 p-3"
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg-elev border border-border',
                    cfg.cor,
                  )}
                >
                  <Icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold text-zinc-100">
                      {ev.titulo}
                    </p>
                    <span className="text-[10px] text-muted">
                      {tempoRelativo(ev.criado_em)}
                    </span>
                  </div>
                  {ev.descricao && (
                    <p className="mt-1 text-[11px] text-muted whitespace-pre-wrap">
                      {ev.descricao}
                    </p>
                  )}
                  {proximoPasso && (
                    <p className="mt-1.5 text-[10px] text-brand-300">
                      → Próximo passo: {proximoPasso}
                    </p>
                  )}
                  {ev.arquivos && ev.arquivos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ev.arquivos.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-border bg-bg-soft px-1.5 py-0.5 text-[10px] text-zinc-300 hover:text-brand-300"
                        >
                          <Paperclip size={9} /> Anexo {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  {ev.autor?.nome && (
                    <p className="mt-1 text-[10px] text-muted italic">
                      por {ev.autor.nome}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
