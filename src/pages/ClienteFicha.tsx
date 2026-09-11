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
  Trash2,
  ArrowRight,
  Settings,
  FileCheck,
  Activity,
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

/**
 * Calcula LTV corretamente respeitando expansoes/reducoes recorrentes.
 *
 *   LTV = Σ (MRR do periodo × Meses no periodo)
 *
 * Retorna:
 *   ltvTotal        — soma total
 *   mrrInicial      — MRR reconstruido pra data_inicio (retro-engenharia
 *                     a partir do MRR atual e dos deltas recorrentes)
 *   periodos        — cada intervalo com seu MRR vigente:
 *                     { inicio, fim, mrr, meses, subtotal, composicao }
 *                     composicao guarda a lista de mudancas (Ticket
 *                     inicial, + Social Media R\$ 1.500, etc) pra
 *                     renderizar o breakdown que aparece no modal.
 *   temEventos      — false quando nao ha expansoes/reducoes registradas
 *                     (nesse caso periodos = [1 unico] com MRR atual)
 *
 * IMPORTANTE: eventos disponiveis so cobrem o periodo em que o log
 * ja estava ativo. Se o cliente teve expansoes ANTES da plataforma
 * comecar a rastrear, o MRR inicial reconstruido vai ser igual ao
 * MRR atual (subestima). Isso e uma limitacao aceitavel — a v2 poderia
 * pedir pro user cadastrar historico manualmente.
 */
interface LtvPeriodo {
  inicio: string
  fim: string
  mrr: number
  meses: number
  subtotal: number
  composicao: string[]
  ehEntrada: boolean
  ehExpansao: boolean
  ehReducao: boolean
}

interface LtvDetalhado {
  ltvTotal: number
  mrrInicial: number
  periodos: LtvPeriodo[]
  temEventos: boolean
}

function calcularLtvDetalhado(
  cliente: Cliente,
  eventos: ClienteEvento[],
): LtvDetalhado {
  const mrrAtual = cliente.verba_mensal ?? 0
  const dataInicio = cliente.data_inicio
  const dataFim = cliente.arquivado_em ?? new Date().toISOString()

  // Filtra so eventos recorrentes (nao TCV) tipo expansao/perda em ordem
  // cronologica. Excluir os auto-logs 'mrr' porque duplicariam.
  const movimentacoes = eventos
    .filter((ev) => {
      if (ev.tipo !== 'expansao' && ev.tipo !== 'perda') return false
      const meta = (ev.meta ?? {}) as Record<string, unknown>
      // recorrente default true (se undefined, assume que sim)
      const recorrente = meta.recorrente !== false
      const tcv = meta.tcv === true
      return recorrente && !tcv && typeof meta.valor === 'number'
    })
    .map((ev) => {
      const meta = (ev.meta ?? {}) as Record<string, unknown>
      const dataEv =
        (typeof meta.data === 'string' ? meta.data : null) ?? ev.criado_em
      return {
        data: dataEv,
        valor: (meta.valor as number) * (ev.tipo === 'expansao' ? 1 : -1),
        motivo: (meta.motivo as string) ?? null,
        tipo: ev.tipo as 'expansao' | 'perda',
        servicosAdicionados:
          (meta.servicos_adicionados as string[] | undefined) ?? [],
        servicosRemovidos:
          (meta.servicos_removidos as string[] | undefined) ?? [],
      }
    })
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

  // Reconstroi MRR inicial: MRR atual - sum(deltas)
  const totalDelta = movimentacoes.reduce((s, m) => s + m.valor, 0)
  const mrrInicial = Math.max(0, mrrAtual - totalDelta)

  // Monta periodos
  const periodos: LtvPeriodo[] = []
  let inicioAtual = dataInicio
  let mrrAtualPeriodo = mrrInicial
  const composicaoAtual: string[] = [`Ticket inicial: ${formatBRLShort(mrrInicial)}`]

  for (const mov of movimentacoes) {
    // Nao cria periodo se o evento e ANTES da data_inicio (dado ruim,
    // ignora com seguranca)
    if (new Date(mov.data) <= new Date(inicioAtual)) {
      // Se data igual, aplica direto sem criar periodo vazio
      mrrAtualPeriodo += mov.valor
      const sinal = mov.valor >= 0 ? '+' : '-'
      composicaoAtual.push(
        `${sinal} ${mov.motivo ?? mov.tipo}: ${formatBRLShort(Math.abs(mov.valor))}`,
      )
      continue
    }

    const meses = mesesEntre(inicioAtual, mov.data)
    if (meses > 0) {
      periodos.push({
        inicio: inicioAtual,
        fim: mov.data,
        mrr: mrrAtualPeriodo,
        meses,
        subtotal: mrrAtualPeriodo * meses,
        composicao: [...composicaoAtual],
        ehEntrada: periodos.length === 0,
        ehExpansao: false,
        ehReducao: false,
      })
    }

    // Aplica delta
    const anterior = mrrAtualPeriodo
    mrrAtualPeriodo = Math.max(0, mrrAtualPeriodo + mov.valor)
    composicaoAtual.length = 0 // resetar composicao do periodo novo
    composicaoAtual.push(
      `${mov.valor >= 0 ? '+' : '-'} ${mov.motivo ?? mov.tipo}: ${formatBRLShort(Math.abs(mov.valor))}`,
      `= ${formatBRLShort(mrrAtualPeriodo)}`,
    )
    inicioAtual = mov.data
    void anterior
  }

  // Fecha ultimo periodo ate hoje/churn
  const mesesFinal = mesesEntre(inicioAtual, dataFim)
  if (mesesFinal > 0) {
    periodos.push({
      inicio: inicioAtual,
      fim: dataFim,
      mrr: mrrAtualPeriodo,
      meses: mesesFinal,
      subtotal: mrrAtualPeriodo * mesesFinal,
      composicao: [...composicaoAtual],
      ehEntrada: periodos.length === 0,
      ehExpansao: movimentacoes.length > 0 && mrrAtualPeriodo > mrrInicial,
      ehReducao: movimentacoes.length > 0 && mrrAtualPeriodo < mrrInicial,
    })
  }

  const ltvTotal = periodos.reduce((s, p) => s + p.subtotal, 0)

  return {
    ltvTotal,
    mrrInicial,
    periodos,
    temEventos: movimentacoes.length > 0,
  }
}

/** Retorna meses inteiros truncados entre 2 datas ISO. */
function mesesEntre(iniISO: string, fimISO: string): number {
  const ini = new Date(iniISO)
  const fim = new Date(fimISO)
  if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return 0
  const diffMs = fim.getTime() - ini.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)))
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
  const [ltvModalOpen, setLtvModalOpen] = useState(false)

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

  // LTV detalhado — soma MRR × meses respeitando as expansoes/reducoes
  // recorrentes logadas em cliente_eventos. Se nao ha eventos, usa
  // fallback ticket × tempo (v1).
  const ltvDetalhado = useMemo(
    () => calcularLtvDetalhado(cliente, eventos),
    [cliente, eventos],
  )
  const ltvAtual = ltvDetalhado.ltvTotal

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
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-emerald-300" />
            <h3 className="text-sm font-semibold text-zinc-100">LTV Atual</h3>
          </div>
          <button
            type="button"
            onClick={() => setLtvModalOpen(true)}
            className="text-[11px] text-brand-300 hover:underline"
          >
            Ver cálculo detalhado →
          </button>
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
            {ltvDetalhado.temEventos ? (
              <p className="mt-1 text-[10px] text-muted">
                Soma de {ltvDetalhado.periodos.length}{' '}
                {ltvDetalhado.periodos.length === 1 ? 'período' : 'períodos'} de MRR
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-muted">Ticket × Tempo de casa</p>
            )}
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
          <EnviarNpsBtn cliente={cliente} onCriado={loadEventos} />
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

      {/* Modal — detalhamento do LTV */}
      {ltvModalOpen && (
        <LtvDetalheModal
          cliente={cliente}
          detalhe={ltvDetalhado}
          tempoCasa={tempoCasa}
          onClose={() => setLtvModalOpen(false)}
        />
      )}

      {/* Modal — registrar perda de receita (Reducao vs Churn) */}
      {perdaModalOpen && (
        <PerdaReceitaModal
          cliente={cliente}
          ltvDetalhado={ltvDetalhado}
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
// Botao Enviar NPS — dropdown com Onboarding vs Operacao
// ============================================================

function EnviarNpsBtn({
  cliente,
  onCriado,
}: {
  cliente: Cliente
  onCriado: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [gerando, setGerando] = useState<string | null>(null)

  async function gerarLink(tipo: 'onboarding' | 'operacao') {
    setGerando(tipo)
    const { data, error } = await supabase
      .from('nps_surveys')
      .insert({ cliente_id: cliente.id, tipo })
      .select('token')
      .single()
    setGerando(null)
    setAberto(false)
    if (error) {
      alert(`Erro: ${error.message}`)
      return
    }
    const url = `${window.location.origin}/publico/nps/${data.token}`
    try {
      await navigator.clipboard.writeText(url)
      alert(
        `Link do NPS ${tipo === 'onboarding' ? 'Onboarding' : 'Operação'} copiado!\n\n${url}\n\nEnvie pro cliente responder.`,
      )
    } catch {
      prompt('Copie o link do NPS:', url)
    }
    onCriado()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full flex-col items-start gap-1 rounded-lg border border-border bg-bg-soft px-3 py-3 text-left text-zinc-200 transition-colors hover:bg-bg-elev"
      >
        <div className="flex items-center gap-2">
          <Send size={14} />
          <span className="text-xs font-medium">Enviar NPS</span>
        </div>
        <span className="text-[10px] text-muted">Gera link público</span>
      </button>
      {aberto && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAberto(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-bg-card shadow-xl">
            <button
              type="button"
              onClick={() => gerarLink('onboarding')}
              disabled={gerando !== null}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-bg-elev disabled:opacity-50"
            >
              <Send size={11} className="text-brand-300" />
              <div>
                <p className="font-medium">NPS Onboarding</p>
                <p className="text-[10px] text-muted">Primeiros 30 dias</p>
              </div>
            </button>
            <div className="border-t border-border" />
            <button
              type="button"
              onClick={() => gerarLink('operacao')}
              disabled={gerando !== null}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-bg-elev disabled:opacity-50"
            >
              <Send size={11} className="text-emerald-300" />
              <div>
                <p className="font-medium">NPS Operação</p>
                <p className="text-[10px] text-muted">Cliente ativo</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

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

// Config visual por tipo de evento. Cada tipo tem sua propria bolinha
// colorida (mesma paleta usada na referencia visual).
const eventoTipoConfig: Record<
  string,
  {
    corBg: string
    corIcon: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    tituloDisplay?: string // sobrescreve o titulo salvo no banco (opcional)
  }
> = {
  contato: {
    corBg: 'bg-sky-500/15',
    corIcon: 'text-sky-300',
    icon: Phone,
    tituloDisplay: 'Comunicação',
  },
  nps: {
    corBg: 'bg-violet-500/15',
    corIcon: 'text-violet-300',
    icon: MessageCircle,
    tituloDisplay: 'NPS Registrado',
  },
  risco: {
    corBg: 'bg-red-500/15',
    corIcon: 'text-red-300',
    icon: AlertTriangle,
    tituloDisplay: 'Risco Alterado',
  },
  jornada: {
    corBg: 'bg-emerald-500/15',
    corIcon: 'text-emerald-300',
    icon: TrendingUp,
    tituloDisplay: 'Jornada Alterada',
  },
  servico: {
    corBg: 'bg-zinc-500/15',
    corIcon: 'text-zinc-300',
    icon: Settings,
    tituloDisplay: 'Serviços Atualizados',
  },
  mrr: {
    corBg: 'bg-emerald-500/15',
    corIcon: 'text-emerald-300',
    icon: DollarSign,
    tituloDisplay: 'MRR Atualizado',
  },
  responsavel: {
    corBg: 'bg-violet-500/15',
    corIcon: 'text-violet-300',
    icon: Users,
    tituloDisplay: 'Responsável Alterado',
  },
  expansao: {
    corBg: 'bg-emerald-500/15',
    corIcon: 'text-emerald-300',
    icon: DollarSign,
    tituloDisplay: 'Expansão Registrada',
  },
  perda: {
    corBg: 'bg-amber-500/15',
    corIcon: 'text-amber-300',
    icon: TrendingDown,
    tituloDisplay: 'Redução Registrada',
  },
  churn: {
    corBg: 'bg-red-500/15',
    corIcon: 'text-red-300',
    icon: Users,
    tituloDisplay: 'Churn Registrado',
  },
  briefing: {
    corBg: 'bg-orange-500/15',
    corIcon: 'text-orange-300',
    icon: Activity,
    tituloDisplay: 'Briefing Recebido',
  },
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
  if (dias < 30) return `há ${dias} dias`
  const meses = dias / 30
  if (meses < 12) {
    const arred = Math.round(meses)
    if (arred === 1) return 'há cerca de 1 mês'
    if (Math.abs(meses - arred) > 0.15) {
      return `há cerca de ${arred} ${arred === 1 ? 'mês' : 'meses'}`
    }
    return `há ${arred} ${arred === 1 ? 'mês' : 'meses'}`
  }
  const anos = Math.round(meses / 12)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

// Rotulos legiveis pra keys de servicos_contratados
function labelServico(key: string): string {
  const s = SERVICOS_CATALOGO.find((x) => x.key === key)
  return s?.label ?? key
}

// Classificacao NPS
function classificarNps(nps: number): { label: string; cor: string } {
  if (nps >= 9) return { label: 'Alto', cor: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' }
  if (nps >= 7) return { label: 'Médio', cor: 'border-amber-500/50 bg-amber-500/15 text-amber-200' }
  return { label: 'Baixo', cor: 'border-red-500/50 bg-red-500/15 text-red-200' }
}

function formatBRLShort(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
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

// ============================================================
// Modal — Detalhamento do LTV Atual
// ============================================================

function LtvDetalheModal({
  cliente,
  detalhe,
  tempoCasa,
  onClose,
}: {
  cliente: Cliente
  detalhe: LtvDetalhado
  tempoCasa: number
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-emerald-300" />
            <h3 className="text-sm font-semibold text-zinc-100">
              LTV Atual — {cliente.nome}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          Detalhamento do cálculo de Lifetime Value.
        </p>

        {/* KPIs topo */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-bg-soft/40 p-3 text-center">
            <p className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-muted">
              <Clock size={9} /> Tempo de Casa
            </p>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-zinc-100">
              {Math.floor(tempoCasa)} meses
            </p>
          </div>
          <div className="rounded-lg border border-border bg-bg-soft/40 p-3 text-center">
            <p className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-muted">
              <DollarSign size={9} /> Ticket Atual
            </p>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-zinc-100">
              {formatBRLShort(cliente.verba_mensal ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
            <p className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-emerald-300">
              <TrendingUp size={9} /> LTV Atual
            </p>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-emerald-300">
              {formatBRLShort(detalhe.ltvTotal)}
            </p>
          </div>
        </div>

        {/* Explicacao */}
        <div className="mb-4 rounded-lg border border-border bg-bg-soft/40 p-3">
          <p className="text-[11px] font-semibold text-zinc-100 mb-1.5">
            💡 Como calculamos o LTV Atual
          </p>
          <p className="text-[11px] text-muted leading-relaxed">
            O LTV (Lifetime Value) é calculado somando o valor gerado em cada
            período de MRR vigente, respeitando a data das expansões. Cliente
            desde <span className="text-zinc-100">{formatDateBR(cliente.data_inicio)}</span>.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 rounded border border-border bg-bg-elev px-2 py-0.5 text-[10px] font-medium text-zinc-200">
            <CheckCircle2 size={9} /> Inclui expansões
          </span>
        </div>

        {/* Formula */}
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] text-muted">Fórmula aplicada:</p>
          <div className="rounded-md border border-border bg-bg-soft/60 px-3 py-2 font-mono text-[11px] text-brand-200">
            LTV = Σ (MRR do período × Meses no período)
          </div>
        </div>

        {/* Tabela de periodos */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-soft/40 text-[9px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 text-left font-semibold">Período</th>
                <th className="px-3 py-2 text-left font-semibold">Composição do MRR</th>
                <th className="px-3 py-2 text-right font-semibold">Meses</th>
                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.periodos.map((p, i) => (
                <tr key={i} className="border-b border-border/60 last:border-b-0">
                  <td className="px-3 py-2.5 align-top">
                    <p className="tabular-nums text-zinc-200">
                      {formatDateBR(p.inicio)} <span className="text-muted">→</span>{' '}
                      {formatDateBR(p.fim)}
                    </p>
                    {p.ehEntrada && (
                      <span className="mt-1 inline-block rounded border border-border bg-bg-soft px-1.5 py-0.5 text-[9px] font-medium text-zinc-300">
                        Entrada
                      </span>
                    )}
                    {p.ehExpansao && (
                      <span className="mt-1 inline-block rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200">
                        + Expansão recorrente
                      </span>
                    )}
                    {p.ehReducao && (
                      <span className="mt-1 inline-block rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-200">
                        − Redução recorrente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <ul className="space-y-0.5">
                      {p.composicao.map((c, j) => (
                        <li
                          key={j}
                          className={cn(
                            'text-[11px]',
                            c.startsWith('+')
                              ? 'text-emerald-300'
                              : c.startsWith('-')
                                ? 'text-red-300'
                                : c.startsWith('=')
                                  ? 'font-semibold text-zinc-100'
                                  : 'text-zinc-300',
                          )}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-2.5 text-right align-top tabular-nums text-zinc-100">
                    {p.meses}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top tabular-nums font-semibold text-zinc-100">
                    {formatBRLShort(p.subtotal)}
                  </td>
                </tr>
              ))}
              <tr className="bg-bg-soft/60 font-bold">
                <td className="px-3 py-2.5 text-zinc-100" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-100">
                  {detalhe.periodos.reduce((s, p) => s + p.meses, 0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300">
                  {formatBRLShort(detalhe.ltvTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {!detalhe.temEventos && (
          <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <AlertTriangle size={10} className="inline mr-1" />
            Este cliente ainda não tem expansões/reduções registradas na
            plataforma. LTV calculado como ticket atual × tempo de casa. Quando
            registrar expansões, o cálculo por períodos entra automático.
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Modal — Registrar Perda de Receita
// ============================================================
//
// Sub-tipos:
//   REDUCAO — cliente cancelou 1+ servico mas continua na base.
//             Reduz MRR se recorrente, remove servicos, gera evento
//             tipo='perda'
//   CHURN   — cliente saiu completo. Muda status pra 'churn',
//             congela LTV, gera evento tipo='churn' com o LTV
//             congelado no meta. O trigger sync_arquivado_em cuida
//             de setar clientes.arquivado_em automaticamente.

const MOTIVOS_PERDA = [
  'Resultado insatisfatório',
  'Problemas de atendimento',
  'Preço',
  'Mudança de estratégia',
  'Dificuldades financeiras',
  'Encerramento da clínica',
  'Outro',
] as const

function PerdaReceitaModal({
  cliente,
  ltvDetalhado,
  onClose,
  onSaved,
}: {
  cliente: Cliente
  ltvDetalhado: LtvDetalhado
  onClose: () => void
  onSaved: () => void
}) {
  const [subtipo, setSubtipo] = useState<'reducao' | 'churn'>('reducao')
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [motivo, setMotivo] = useState<string>('')
  const [valor, setValor] = useState<string>(String(cliente.verba_mensal ?? ''))
  const [notas, setNotas] = useState('')
  const [servicosRemover, setServicosRemover] = useState<string[]>([])
  const [recorrente, setRecorrente] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculos exibidos no header
  const ticket = cliente.verba_mensal ?? 0
  const tempoCasa = mesesDesde(cliente.data_inicio)
  // LTV usa o calculo detalhado (soma periodos) — fallback pra ticket
  // × tempo se nao ha eventos
  const ltvAtual = ltvDetalhado.ltvTotal

  const jaContratados = cliente.servicos_contratados ?? []
  const contratados = SERVICOS_CATALOGO.filter((s) => jaContratados.includes(s.key))

  function toggleServico(key: string) {
    setServicosRemover((p) =>
      p.includes(key) ? p.filter((k) => k !== key) : [...p, key],
    )
  }

  async function salvar() {
    setError(null)
    if (!motivo) {
      setError('Escolha o motivo')
      return
    }
    setSaving(true)

    if (subtipo === 'churn') {
      // Snapshot do LTV pra congelar. Evento com tipo='churn' e meta rica.
      const { error: evErr } = await supabase.from('cliente_eventos').insert({
        cliente_id: cliente.id,
        tipo: 'churn',
        titulo: `Churn · ${motivo}`,
        descricao: notas.trim() || null,
        meta: {
          motivo,
          data,
          valor_perdido: Number(valor) || ticket,
          ltv_congelado: ltvAtual,
          ticket_mensal_no_churn: ticket,
          tempo_de_casa_meses: Math.floor(tempoCasa),
        },
      })
      if (evErr) {
        setError(evErr.message)
        setSaving(false)
        return
      }
      // Update: muda status pra churn (o trigger sync_arquivado_em
      // deve setar arquivado_em; se nao houver esse trigger no banco
      // novo, precisamos setar aqui explicitamente).
      const { error: upErr } = await supabase
        .from('clientes')
        .update({ status: 'churn', arquivado_em: new Date().toISOString() })
        .eq('id', cliente.id)
      if (upErr) {
        setError(`Evento salvo mas cliente nao atualizou: ${upErr.message}`)
        setSaving(false)
        return
      }
    } else {
      // Reducao
      const valorNum = Number(valor)
      if (isNaN(valorNum) || valorNum <= 0) {
        setError('Valor da redução precisa ser maior que zero')
        setSaving(false)
        return
      }
      const { error: evErr } = await supabase.from('cliente_eventos').insert({
        cliente_id: cliente.id,
        tipo: 'perda',
        titulo: `Redução · ${motivo}`,
        descricao: notas.trim() || null,
        meta: {
          motivo,
          data,
          valor: valorNum,
          recorrente,
          servicos_removidos: servicosRemover,
        },
      })
      if (evErr) {
        setError(evErr.message)
        setSaving(false)
        return
      }
      const updates: Record<string, unknown> = {}
      if (recorrente) {
        updates.verba_mensal = Math.max(0, (cliente.verba_mensal ?? 0) - valorNum)
      }
      if (servicosRemover.length > 0) {
        updates.servicos_contratados = jaContratados.filter(
          (k) => !servicosRemover.includes(k),
        )
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
    }

    setSaving(false)
    onSaved()
  }

  const ehChurn = subtipo === 'churn'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">
            Registrar Perda de Receita
          </h3>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          Registre uma perda de receita para este cliente.
        </p>

        {/* Header stats — Ticket + Tempo Casa + LTV */}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-bg-soft/40 p-3">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted">Ticket Mensal</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-zinc-100">
              {formatCurrency(ticket)}
            </p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-[9px] uppercase tracking-wider text-muted">Tempo de Casa</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-zinc-100">
              {Math.floor(tempoCasa)} meses
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted">LTV Atual</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-emerald-300">
              {formatCurrency(ltvAtual)}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {error}
          </div>
        )}

        {/* Tipo de Perda — Redução vs Churn */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">
            Tipo de Perda *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSubtipo('reducao')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                subtipo === 'reducao'
                  ? 'border-amber-500/60 bg-amber-500/10'
                  : 'border-border bg-bg-soft/40 hover:border-amber-500/30',
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <TrendingDown size={13} className="text-amber-300" />
                <span className="text-xs font-semibold text-zinc-100">Redução</span>
              </div>
              <p className="text-[10px] text-muted leading-snug">
                Cancelou serviço(s) mas continua cliente
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSubtipo('churn')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                subtipo === 'churn'
                  ? 'border-red-500/60 bg-red-500/10'
                  : 'border-border bg-bg-soft/40 hover:border-red-500/30',
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <Users size={13} className="text-red-300" />
                <span className="text-xs font-semibold text-zinc-100">Churn</span>
              </div>
              <p className="text-[10px] text-muted leading-snug">
                Cliente encerrou contrato completamente
              </p>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Data */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              {ehChurn ? 'Data do Churn *' : 'Data da Redução *'}
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          {/* Motivo (dropdown com opcoes) */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Motivo *
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
            >
              <option value="">Selecione o motivo</option>
              {MOTIVOS_PERDA.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Valor (Reducao: valor da reducao. Churn: valor perdido = ticket) */}
          {ehChurn ? (
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                Valor Perdido (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted">
                Valor pré-preenchido com o ticket mensal atual. Ao confirmar, o
                LTV de {formatCurrency(ltvAtual)} será congelado.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                Valor da Redução (R$) *
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
          )}

          {/* Notas */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={ehChurn ? 'Observações sobre o churn...' : 'Observações adicionais...'}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
            />
          </div>

          {/* Reducao — recorrente e servicos */}
          {!ehChurn && (
            <>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-bg-soft/40 px-3 py-2">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-brand-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-zinc-100">
                    Redução recorrente
                  </span>
                  <p className="text-[10px] text-muted">
                    {recorrente
                      ? 'Reduz o MRR mensal a partir da data.'
                      : 'Perda pontual — não altera MRR.'}
                  </p>
                </div>
              </label>

              {contratados.length > 0 && (
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
                          onClick={() => toggleServico(s.key)}
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
            </>
          )}

          {/* Warning churn */}
          {ehChurn && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2">
              <p className="flex items-start gap-1.5 text-[11px] text-red-200">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Atenção:</strong> Registrar churn irá marcar o cliente
                  como inativo, congelar o LTV realizado e removê-lo dos
                  relatórios de clientes ativos.
                </span>
              </p>
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
              ehChurn ? 'bg-red-500' : 'bg-amber-500',
            )}
          >
            {saving ? 'Registrando…' : ehChurn ? 'Registrar Churn' : 'Registrar Redução'}
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
  async function deletar(id: string) {
    if (!confirm('Excluir esse evento da timeline? A ação não pode ser desfeita.')) return
    const { error } = await supabase.from('cliente_eventos').delete().eq('id', id)
    if (error) {
      alert(`Erro: ${error.message}`)
      return
    }
    onReload()
  }

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
          {eventos.map((ev) => (
            <EventoLinha key={ev.id} evento={ev} onDelete={() => deletar(ev.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}

// ==========================================================
// Linha individual da Timeline — renderiza icone circular +
// titulo + descrição + badges de diff + anexos + delete
// ==========================================================

function EventoLinha({
  evento,
  onDelete,
}: {
  evento: ClienteEvento
  onDelete: () => void
}) {
  const cfg = eventoTipoConfig[evento.tipo] ?? {
    corBg: 'bg-zinc-500/15',
    corIcon: 'text-zinc-300',
    icon: Clock,
  }
  const Icon = cfg.icon
  const meta = (evento.meta ?? {}) as Record<string, unknown>
  const proximoPasso = typeof meta.proximo_passo === 'string' ? meta.proximo_passo : null
  const titulo = cfg.tituloDisplay ?? evento.titulo

  return (
    <li className="group flex gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-3">
      {/* Bolinha do icone */}
      <span
        className={cn(
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full',
          cfg.corBg,
          cfg.corIcon,
        )}
      >
        <Icon size={14} />
      </span>

      {/* Conteudo */}
      <div className="min-w-0 flex-1">
        {/* Linha 1: titulo + badge extra + tempo + delete */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-zinc-100">{titulo}</p>
          <div className="flex items-center gap-2">
            {evento.tipo === 'nps' && typeof meta.para === 'number' && (
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                  classificarNps(meta.para as number).cor,
                )}
              >
                {classificarNps(meta.para as number).label}
              </span>
            )}
            <span className="text-[10px] text-muted whitespace-nowrap">
              {tempoRelativo(evento.criado_em)}
            </span>
            <button
              onClick={onDelete}
              className="grid h-5 w-5 place-items-center rounded text-muted opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
              title="Excluir evento"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>

        {/* Linha 2: descricao curta (manual) */}
        {evento.descricao && evento.tipo !== 'servico' && evento.tipo !== 'mrr' &&
          evento.tipo !== 'jornada' && evento.tipo !== 'nps' && (
            <p className="mt-1 text-[11px] text-muted whitespace-pre-wrap">
              {evento.descricao}
            </p>
          )}

        {/* Linha 3: renderizacao especifica por tipo */}
        <RenderDiffPorTipo evento={evento} />

        {/* Proximo passo */}
        {proximoPasso && (
          <p className="mt-1.5 text-[10px] text-brand-300">
            → Próximo passo: {proximoPasso}
          </p>
        )}

        {/* Anexos */}
        {evento.arquivos && evento.arquivos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {evento.arquivos.map((url, i) => (
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

        {/* Autor */}
        {evento.autor?.nome && (
          <p className="mt-1 text-[10px] text-muted italic">
            por {evento.autor.nome}
          </p>
        )}
      </div>
    </li>
  )
}

// Renderiza diff especifico por tipo (badges de/para com seta)
function RenderDiffPorTipo({ evento }: { evento: ClienteEvento }) {
  const meta = (evento.meta ?? {}) as Record<string, unknown>

  // Servicos: descricao "Adicionados: X. Removidos: Y" + badges antes/depois
  if (evento.tipo === 'servico') {
    const de = Array.isArray(meta.de) ? (meta.de as string[]) : []
    const para = Array.isArray(meta.para) ? (meta.para as string[]) : []
    const adicionados = para.filter((k) => !de.includes(k))
    const removidos = de.filter((k) => !para.includes(k))
    return (
      <>
        {(adicionados.length > 0 || removidos.length > 0) && (
          <p className="mt-1 text-[11px] text-muted">
            {adicionados.length > 0 && (
              <>Adicionados: {adicionados.map(labelServico).join(', ')}. </>
            )}
            {removidos.length > 0 && (
              <>Removidos: {removidos.map(labelServico).join(', ')}.</>
            )}
          </p>
        )}
        <DiffLine
          de={de.length > 0 ? de.map(labelServico).join(', ') : '—'}
          para={para.length > 0 ? para.map(labelServico).join(', ') : '—'}
        />
      </>
    )
  }

  // NPS: mostra "NPS X/10 registrado via ..." + badge do valor
  if (evento.tipo === 'nps') {
    const para = typeof meta.para === 'number' ? meta.para : null
    return (
      <>
        <p className="mt-1 text-[11px] text-muted">
          NPS {para ?? '—'}/10 registrado
        </p>
        {para !== null && (
          <div className="mt-1.5">
            <span className="inline-block rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 tabular-nums">
              {para}
            </span>
          </div>
        )}
      </>
    )
  }

  // Jornada: badges de/para
  if (evento.tipo === 'jornada') {
    const de = meta.de ?? '—'
    const para = meta.para ?? '—'
    return (
      <>
        <p className="mt-1 text-[11px] text-muted">
          Jornada alterada de "{String(de)}" para "{String(para)}"
        </p>
        <DiffLine de={String(de)} para={String(para)} />
      </>
    )
  }

  // Churn: mostra motivo + LTV congelado + tempo de casa
  if (evento.tipo === 'churn') {
    const motivo = typeof meta.motivo === 'string' ? meta.motivo : null
    const ltv = typeof meta.ltv_congelado === 'number' ? meta.ltv_congelado : null
    const tempo = typeof meta.tempo_de_casa_meses === 'number' ? meta.tempo_de_casa_meses : null
    const valor = typeof meta.valor_perdido === 'number' ? meta.valor_perdido : null
    return (
      <>
        {motivo && (
          <p className="mt-1 text-[11px] text-muted">
            Motivo: <span className="text-zinc-100">{motivo}</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {valor !== null && (
            <span className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-200">
              <TrendingDown size={9} /> {formatBRLShort(valor)}/mês perdido
            </span>
          )}
          {ltv !== null && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
              LTV congelado: {formatBRLShort(ltv)}
            </span>
          )}
          {tempo !== null && (
            <span className="inline-flex items-center gap-1 rounded border border-border bg-bg-elev px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {tempo} meses de casa
            </span>
          )}
        </div>
      </>
    )
  }

  // MRR / Expansao / Perda: mostra R$ X → R$ Y
  if (evento.tipo === 'mrr' || evento.tipo === 'expansao' || evento.tipo === 'perda') {
    const de = meta.de as number | undefined
    const para = meta.para as number | undefined
    const valor = meta.valor as number | undefined
    // Se e evento manual (expansao/perda), mostra o VALOR do movimento
    // no lugar de/para. Se e evento automatico (mrr), mostra o diff.
    if (evento.tipo === 'expansao' || evento.tipo === 'perda') {
      if (typeof valor === 'number') {
        return (
          <p className="mt-1 text-[11px] text-muted">
            {evento.tipo === 'expansao' ? 'Expansão' : 'Perda'} de{' '}
            <span className="font-semibold text-zinc-100">{formatBRLShort(valor)}</span>{' '}
            registrada
          </p>
        )
      }
    }
    if (typeof de === 'number' && typeof para === 'number') {
      return <DiffLine de={formatBRLShort(de)} para={formatBRLShort(para)} />
    }
    return null
  }

  // Risco: badge do status
  if (evento.tipo === 'risco') {
    const de = meta.de as string | undefined
    const para = meta.para as string | undefined
    if (de && para) {
      return <DiffLine de={de} para={para} />
    }
    return null
  }

  return null
}

// Componente do "de → para" com badges
function DiffLine({ de, para }: { de: string; para: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="rounded bg-bg-elev border border-border px-2 py-0.5 text-[10px] text-muted line-through">
        {de}
      </span>
      <ArrowRight size={10} className="text-muted" />
      <span className="rounded bg-brand-500/15 border border-brand-500/40 px-2 py-0.5 text-[10px] font-medium text-brand-200">
        {para}
      </span>
    </div>
  )
}
