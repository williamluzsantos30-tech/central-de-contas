/**
 * Visao do Negocio — pagina que o DONO da agencia abre primeiro.
 *
 * Layout (referencia: dashboard "Visao do Negocio" — secoes agrupadas,
 * cards compactos com valor colorido por saude + delta vs mes anterior):
 *
 *   Header: titulo + periodo + Novo cliente
 *   Tabs:   Executivo | Analytics      (+ filtros squad/AM/gestor)
 *
 *   EXECUTIVO
 *     Aquisicao & Crescimento  Novos Clientes · MRR Novos · Expansao · Em Onboarding
 *     Pulso do Negocio         [aviso: ativos sem valor mensal]
 *                              MRR Atual · NRR · Saldo do Mes · Taxa de Renovacao · Ticket Medio
 *     Estabilidade e Risco     Clientes Ativos · Churn · MRR Perdido · MRR em Risco · Contratos a Vencer
 *     Qualidade da Receita     LTV Medio · Permanencia Media · Tempo ate Churn · NPS Medio
 *     Tendencias (12 meses)    mini-areas: MRR · Clientes Ativos · Churn Mensal
 *
 *   ANALYTICS
 *     Evolucao de Clientes (bar chart + tabela + modal por mes)
 *     Score e Saude por Squad
 *     Acoes Sugeridas
 *     Social Media
 *
 * Todas as metricas sao reconstruidas a partir de clientes.* +
 * cliente_eventos (expansao/perda/churn). Nao existe snapshot mensal:
 *   base no fim do mes M = data_inicio <= fim(M) AND (arquivado_em null OR > fim(M))
 *   MRR(M)               = SUM verba_mensal da base, desfazendo expansoes/
 *                          reducoes registradas DEPOIS de M
 *   NRR                  = 1 + (expansao - reducao - churn) / MRR_inicio
 *   Churn Rate           = churns(M) / base_inicio(M)
 *   Taxa de Renovacao    = renovados / (renovados + encerrados) dos contratos
 *                          com contrato_fim em M
 *   LTV Medio            = ticket medio x permanencia media
 *   Tempo ate Churn      = media(arquivado_em - data_inicio) dos perdidos
 *
 * Status (ativo/atencao/pausado) so existe no presente — pra meses
 * passados toda a base reconstruida conta como ativa.
 *
 * Ainda sem dado (dependem do modulo Financeiro): investimento em
 * aquisicao / CAC, despesas, lucro, inadimplencia.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  TrendingUp,
  AlertTriangle,
  Users,
  Download,
  Smile,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Instagram,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Cliente, Profile } from '@/types/database'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function formatBRLSigned(v: number): string {
  const s = v < 0 ? '-' : v > 0 ? '+' : ''
  return `${s}${formatBRL(Math.abs(v))}`
}

/** R$ 1,2M · R$ 46k · R$ 800 — pra eixo de grafico pequeno. */
function formatBRLCompacto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`
  return `R$ ${Math.round(v)}`
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function labelMes(mesISO: string): string {
  const [y, m] = mesISO.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

/** "Set/25" */
function labelMesCurto(mesISO: string): string {
  const [y, m] = mesISO.split('-').map(Number)
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${nomes[m - 1]}/${String(y).slice(2)}`
}

function shiftMes(mesISO: string, delta: number): string {
  const [y, m] = mesISO.split('-').map(Number)
  const nova = new Date(y, m - 1 + delta, 1)
  return `${nova.getFullYear()}-${String(nova.getMonth() + 1).padStart(2, '0')}-01`
}

/** Ultimos N meses (do atual pra tras) como array de mesISO. */
function ultimosMeses(n: number): string[] {
  const hoje = new Date()
  const atualISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(shiftMes(atualISO, -i))
  return out
}

/** Meses entre uma data ISO e um ponto de referencia. 0 se invalida. */
function mesesEntre(iso: string | null, ref: Date): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  return (ref.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
}

/** Variacao percentual. null quando nao da pra comparar (base zero). */
function pctDelta(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null
  return (atual - anterior) / anterior
}

// Evento manual de expansao/perda/churn — usado pra construir o
// Resultado do Negocio a partir do log real, nao mais placeholder.
interface EventoMovimento {
  tipo: 'expansao' | 'perda' | 'churn'
  cliente_id: string
  criado_em: string
  meta: {
    valor?: number
    valor_perdido?: number
    data?: string
    motivo?: string
    recorrente?: boolean
  } | null
}

// ==============================================================
// Calculo dos KPIs de um mes — funcao pura, chamada pro mes
// selecionado, pro mes anterior (delta) e pros 12 da tendencia.
// ==============================================================

interface Kpis {
  // Aquisicao
  novos: number
  mrrNovos: number
  expansao: number
  nExpansoes: number
  emOnboarding: number
  pctOnboardingFinalizado: number
  // Pulso
  mrr: number
  mrrInicio: number
  nrr: number
  saldo: number
  reducao: number
  nPerdas: number
  taxaRenovacao: number | null
  renovados: number
  vencidos: number
  ticketMedio: number
  semVerba: number
  // Estabilidade
  ativos: number
  nAssessoria: number
  nConsultoria: number
  churnsNoMes: number
  churnRate: number
  mrrPerdido: number
  emRisco: number
  mrrRisco: number
  aVencer: number
  mrrAVencer: number
  // Qualidade
  ltvMedio: number
  permanenciaMedia: number
  tempoAteChurn: number | null
  npsMedio: number | null
  nNps: number
}

function calculaKpis(base: Cliente[], eventos: EventoMovimento[], mesISO: string): Kpis {
  const [y, m] = mesISO.split('-').map(Number)
  const inicioMes = new Date(y, m - 1, 1)
  const fimMes = new Date(y, m, 0, 23, 59, 59)
  const hoje = new Date()
  const eMesAtual = inicioMes <= hoje && hoje <= fimMes
  // Ponto de referencia temporal: hoje (mes corrente) ou fim do mes
  const ref = eMesAtual ? hoje : fimMes
  const noMes = (d: Date) => d >= inicioMes && d <= fimMes
  const verba = (c: Cliente) => c.verba_mensal ?? 0
  const soma = (arr: Cliente[]) => arr.reduce((s, c) => s + verba(c), 0)

  // Base reconstruida no fim do mes
  const naBase = base.filter((c) => {
    const dIn = new Date(c.data_inicio)
    if (isNaN(dIn.getTime()) || dIn > fimMes) return false
    if (!c.arquivado_em) return true
    return new Date(c.arquivado_em) > fimMes
  })
  // Status so vale no presente — nao ha historico de status
  const ativos = eMesAtual
    ? naBase.filter((c) => c.status === 'ativo' || c.status === 'atencao')
    : naBase
  const emRisco = eMesAtual ? naBase.filter((c) => c.status === 'atencao') : []
  const idsAtivos = new Set(ativos.map((c) => c.id))
  const idsBase = new Set(base.map((c) => c.id))

  const novos = base.filter((c) => noMes(new Date(c.data_inicio)))
  const churns = base.filter((c) => c.arquivado_em && noMes(new Date(c.arquivado_em)))

  // MRR no fim do mes — verba atual, desfazendo movimentos posteriores
  const dataEv = (ev: EventoMovimento) => new Date(ev.meta?.data ?? ev.criado_em)
  let mrr = soma(ativos)
  for (const ev of eventos) {
    if (!idsAtivos.has(ev.cliente_id)) continue
    if (dataEv(ev) <= fimMes) continue
    if (ev.tipo === 'expansao') mrr -= ev.meta?.valor ?? 0
    else if (ev.tipo === 'perda') mrr += ev.meta?.valor ?? 0
  }
  mrr = Math.max(0, mrr)

  // Movimentos comerciais do mes (log real das Fichas)
  const eventosMes = eventos.filter((ev) => idsBase.has(ev.cliente_id) && noMes(dataEv(ev)))
  const expansoes = eventosMes.filter((ev) => ev.tipo === 'expansao')
  const perdas = eventosMes.filter((ev) => ev.tipo === 'perda')
  const churnsEv = eventosMes.filter((ev) => ev.tipo === 'churn')
  const expansao = expansoes.reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)
  const reducao = perdas.reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)
  const mrrPerdido =
    churnsEv.length > 0
      ? churnsEv.reduce((s, ev) => s + (ev.meta?.valor_perdido ?? 0), 0)
      : soma(churns)

  const mrrNovos = soma(novos)
  const mrrInicio = Math.max(0, mrr - mrrNovos + mrrPerdido - expansao + reducao)
  const nrr = mrrInicio > 0 ? 1 + (expansao - reducao - mrrPerdido) / mrrInicio : 1
  const saldo = expansao - reducao - mrrPerdido

  const novosAindaAtivos = novos.filter((c) => idsAtivos.has(c.id)).length
  const baseInicio = ativos.length - novosAindaAtivos + churns.length
  const churnRate = baseInicio > 0 ? churns.length / baseInicio : 0

  const ticketMedio = ativos.length > 0 ? mrr / ativos.length : 0
  const semVerba = ativos.filter((c) => !c.verba_mensal).length
  const nAssessoria = ativos.filter((c) => c.tipo === 'assessoria').length
  const nConsultoria = ativos.filter((c) => c.tipo === 'consultoria').length

  const emOnboarding = ativos.filter((c) => c.jornada === 'onboarding').length
  const finalizou = ativos.filter((c) => c.jornada && c.jornada !== 'onboarding').length
  const pctOnboardingFinalizado = ativos.length > 0 ? finalizou / ativos.length : 0

  // Contratos — renovacao no mes + a vencer nos proximos 30 dias
  const vencidosLista = base.filter((c) => c.contrato_fim && noMes(new Date(c.contrato_fim)))
  const renovados = vencidosLista.filter((c) => c.contrato_status === 'renovado').length
  const encerrados = vencidosLista.filter((c) => c.contrato_status === 'encerrado').length
  const taxaRenovacao = renovados + encerrados > 0 ? renovados / (renovados + encerrados) : null
  const em30 = new Date(ref.getTime() + 30 * 864e5)
  const aVencerLista = ativos.filter((c) => {
    if (!c.contrato_fim || c.contrato_status === 'encerrado') return false
    const d = new Date(c.contrato_fim)
    return d >= ref && d <= em30
  })

  // Qualidade da receita
  const permanencias = ativos.map((c) => mesesEntre(c.data_inicio, ref)).filter((v) => v > 0)
  const permanenciaMedia =
    permanencias.length > 0 ? permanencias.reduce((a, b) => a + b, 0) / permanencias.length : 0
  const ltvMedio = ticketMedio * permanenciaMedia
  const temposChurn = base
    .filter((c) => c.arquivado_em && new Date(c.arquivado_em) <= fimMes)
    .map((c) => mesesEntre(c.data_inicio, new Date(c.arquivado_em as string)))
    .filter((v) => v >= 0)
  const tempoAteChurn =
    temposChurn.length > 0 ? temposChurn.reduce((a, b) => a + b, 0) / temposChurn.length : null
  const comNps = ativos.filter((c) => typeof c.nps === 'number')
  const npsMedio =
    comNps.length > 0 ? comNps.reduce((s, c) => s + (c.nps ?? 0), 0) / comNps.length : null

  return {
    novos: novos.length,
    mrrNovos,
    expansao,
    nExpansoes: expansoes.length,
    emOnboarding,
    pctOnboardingFinalizado,
    mrr,
    mrrInicio,
    nrr,
    saldo,
    reducao,
    nPerdas: perdas.length,
    taxaRenovacao,
    renovados,
    vencidos: vencidosLista.length,
    ticketMedio,
    semVerba,
    ativos: ativos.length,
    nAssessoria,
    nConsultoria,
    churnsNoMes: churns.length,
    churnRate,
    mrrPerdido,
    emRisco: emRisco.length,
    mrrRisco: soma(emRisco),
    aVencer: aVencerLista.length,
    mrrAVencer: soma(aVencerLista),
    ltvMedio,
    permanenciaMedia,
    tempoAteChurn,
    npsMedio,
    nNps: comNps.length,
  }
}

type Aba = 'executivo' | 'analytics'

export default function VisaoExecutiva() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [eventosMov, setEventosMov] = useState<EventoMovimento[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [aba, setAba] = useState<Aba>('executivo')
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [fSquad, setFSquad] = useState('')
  const [fAM, setFAM] = useState('')
  const [fGestor, setFGestor] = useState('')

  async function load() {
    setLoading(true)
    const [cRes, pRes, eRes] = await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('profiles').select('*').eq('ativo', true).eq('aprovado', true),
      supabase
        .from('cliente_eventos')
        .select('tipo, cliente_id, criado_em, meta')
        .in('tipo', ['expansao', 'perda', 'churn']),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setProfiles((pRes.data as Profile[]) ?? [])
    setEventosMov((eRes.data as EventoMovimento[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const hoje = new Date()
  const mesAtualISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const eMesAtual = mesISO === mesAtualISO

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      if (fSquad && c.squad !== fSquad) return false
      if (fAM && c.account_manager_id !== fAM) return false
      if (fGestor && c.gestor_id !== fGestor) return false
      return true
    })
  }, [clientes, fSquad, fAM, fGestor])

  const squadsDistintos = useMemo(() => {
    const set = new Set<string>()
    for (const c of clientes) if (c.squad) set.add(c.squad)
    return [...set].sort()
  }, [clientes])

  const ams = useMemo(() => profiles.filter((p) => p.cargo === 'account_manager'), [profiles])
  const gestores = useMemo(() => profiles.filter((p) => p.cargo === 'gestor_trafego'), [profiles])

  const k = useMemo(
    () => calculaKpis(clientesFiltrados, eventosMov, mesISO),
    [clientesFiltrados, eventosMov, mesISO],
  )
  const kAnt = useMemo(
    () => calculaKpis(clientesFiltrados, eventosMov, shiftMes(mesISO, -1)),
    [clientesFiltrados, eventosMov, mesISO],
  )

  // Serie dos ultimos 12 meses (mais antigo -> mais recente)
  const serie = useMemo(() => {
    return ultimosMeses(12)
      .reverse()
      .map((iso) => {
        const kp = calculaKpis(clientesFiltrados, eventosMov, iso)
        return { label: labelMesCurto(iso), mrr: kp.mrr, ativos: kp.ativos, churns: kp.churnsNoMes }
      })
  }, [clientesFiltrados, eventosMov])

  // Metas fixadas pelo dono: NRR >= 95% (crescendo) · Churn < 10% (meta)
  const temAlerta = k.nrr < 0.95 || k.churnRate >= 0.1 || k.saldo < 0 || k.emRisco > 0

  return (
    <div>
      <PageHeader
        title="Visão do Negócio"
        description="Métricas estratégicas e indicadores de performance"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FiltroPill
              value={mesISO}
              onChange={(v) => setMesISO(v)}
              options={ultimosMeses(12).map((iso) => ({
                value: iso,
                label: labelMes(iso).replace(/^./, (c) => c.toUpperCase()),
              }))}
            />
            <Button variant="outline" onClick={() => window.print()}>
              <Download size={14} /> Exportar
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={14} /> Novo cliente
            </Button>
          </div>
        }
      />

      {/* Tabs + filtros secundarios */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
            {(
              [
                { key: 'executivo', label: 'Executivo' },
                { key: 'analytics', label: 'Analytics' },
              ] as { key: Aba; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setAba(t.key)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  aba === t.key
                    ? 'bg-bg-card text-zinc-100 shadow-sm'
                    : 'text-muted hover:text-zinc-200',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {eMesAtual && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300"
              title="Dados do mês corrente são calculados em tempo real"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Tempo real
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroPill
            value={fSquad}
            onChange={setFSquad}
            placeholder="Todos os Squads"
            options={squadsDistintos.map((s) => ({ value: s, label: s }))}
          />
          <FiltroPill
            value={fAM}
            onChange={setFAM}
            placeholder="Todos os AMs"
            options={ams.map((p) => ({ value: p.id, label: p.nome }))}
          />
          <FiltroPill
            value={fGestor}
            onChange={setFGestor}
            placeholder="Todos os Gestores"
            options={gestores.map((p) => ({ value: p.id, label: p.nome }))}
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : aba === 'analytics' ? (
        <>
          <EvolucaoClientes clientes={clientesFiltrados} />
          <ScoreSaudeSquads clientes={clientesFiltrados} mesISO={mesISO} />

          {/* Acoes Sugeridas — depois dos squads porque se aplicam por nivel */}
          <div className="mt-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Ações Sugeridas
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <BoxAcao
                titulo="Verde (base saudável)"
                icon={<CheckCircle2 size={14} className="text-emerald-300" />}
                tone="emerald"
                acoes={[
                  'Manter padrão atual',
                  'Documentar boas práticas',
                  'Apto a receber novos clientes',
                ]}
              />
              <BoxAcao
                titulo="Amarelo (atenção)"
                icon={<AlertTriangle size={14} className="text-amber-300" />}
                tone="amber"
                acoes={[
                  'Revisar onboarding',
                  'Reunião com AM e Gestores',
                  'Monitorar próximo ciclo',
                ]}
              />
              <BoxAcao
                titulo="Vermelho (crítico)"
                icon={<XCircle size={14} className="text-red-300" />}
                tone="red"
                acoes={[
                  'Congelar entrada de novos clientes',
                  'Revisão completa de processos',
                  'Intervenção direta da liderança',
                ]}
              />
            </div>
          </div>

          <SocialMediaVisao clientes={clientesFiltrados} profiles={profiles} />
        </>
      ) : (
        <>
          {/* Alerta — so o que esta fora da meta */}
          {temAlerta && (
            <div className="mb-1 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-300" />
                <p className="text-xs font-semibold text-red-200">
                  {labelMes(mesISO).replace(/^./, (c) => c.toUpperCase())} em alerta
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                {k.nrr < 0.95 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    NRR {formatPct(k.nrr)} <span className="opacity-70">(meta ≥ 95%)</span>
                  </span>
                )}
                {k.churnRate >= 0.1 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Churn {formatPct(k.churnRate)} <span className="opacity-70">(meta &lt; 10%)</span>
                  </span>
                )}
                {k.saldo < 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Saldo {formatBRLSigned(k.saldo)}
                  </span>
                )}
                {k.emRisco > 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {k.emRisco} em risco ({formatBRL(k.mrrRisco)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ---------------- Aquisicao & Crescimento ---------------- */}
          <Secao titulo="Aquisição & Crescimento">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="Novos Clientes"
                valor={String(k.novos)}
                tone={k.novos > 0 ? 'emerald' : 'neutral'}
                delta={pctDelta(k.novos, kAnt.novos)}
                sub="entraram no mês"
              />
              <KpiCard
                label="MRR Novos"
                valor={formatBRL(k.mrrNovos)}
                tone={k.mrrNovos > 0 ? 'emerald' : 'neutral'}
                delta={pctDelta(k.mrrNovos, kAnt.mrrNovos)}
                sub="receita dos novos contratos"
              />
              <KpiCard
                label="Expansão (Upsell)"
                valor={formatBRL(k.expansao)}
                tone={k.expansao > 0 ? 'emerald' : 'neutral'}
                delta={pctDelta(k.expansao, kAnt.expansao)}
                sub={
                  k.nExpansoes > 0
                    ? `${k.nExpansoes} ${k.nExpansoes === 1 ? 'registro' : 'registros'}`
                    : 'nenhum registro no mês'
                }
              />
              <KpiCard
                label="Em Onboarding"
                valor={String(k.emOnboarding)}
                tone="neutral"
                sub={`${formatPct(k.pctOnboardingFinalizado)} da base já finalizou`}
              />
            </div>
          </Secao>

          {/* ---------------- Pulso do Negocio ---------------- */}
          <Secao titulo="Pulso do Negócio">
            {k.semVerba > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200">
                <AlertTriangle size={13} className="text-amber-300" />
                <span>
                  <strong className="font-semibold">
                    {k.semVerba} {k.semVerba === 1 ? 'cliente ativo' : 'clientes ativos'}
                  </strong>{' '}
                  sem valor mensal preenchido. O MRR pode estar subestimado.
                </span>
                <Link to="/clientes" className="font-semibold underline underline-offset-2 hover:text-amber-100">
                  Ver clientes
                </Link>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                label="MRR Atual"
                valor={formatBRL(k.mrr)}
                tone="emerald"
                delta={pctDelta(k.mrr, kAnt.mrr)}
                sub="vs mês anterior"
              />
              <KpiCard
                label="NRR"
                valor={formatPct(k.nrr)}
                tone={k.nrr >= 0.95 ? 'emerald' : k.nrr >= 0.9 ? 'amber' : 'red'}
                sub="meta ≥ 95%"
              />
              <KpiCard
                label="Saldo do Mês"
                valor={formatBRLSigned(k.saldo)}
                tone={k.saldo > 0 ? 'emerald' : k.saldo < 0 ? 'red' : 'neutral'}
                sub="expansão − redução − churn"
              />
              <KpiCard
                label="Taxa de Renovação"
                valor={k.taxaRenovacao === null ? '—' : formatPct(k.taxaRenovacao)}
                tone={
                  k.taxaRenovacao === null
                    ? 'neutral'
                    : k.taxaRenovacao >= 0.8
                      ? 'emerald'
                      : k.taxaRenovacao >= 0.5
                        ? 'amber'
                        : 'red'
                }
                sub={`${k.renovados}/${k.vencidos} ${k.vencidos === 1 ? 'contrato vencido' : 'contratos vencidos'}`}
              />
              <KpiCard
                label="Ticket Médio"
                valor={formatBRL(k.ticketMedio)}
                tone="neutral"
                delta={pctDelta(k.ticketMedio, kAnt.ticketMedio)}
                sub="por cliente ativo"
              />
            </div>
          </Secao>

          {/* ---------------- Estabilidade e Risco ---------------- */}
          <Secao titulo="Estabilidade e Risco">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                label="Clientes Ativos"
                valor={String(k.ativos)}
                tone="emerald"
                delta={pctDelta(k.ativos, kAnt.ativos)}
                sub={`${k.nAssessoria} assessoria · ${k.nConsultoria} consultoria`}
              />
              <KpiCard
                label="Churn"
                valor={`${k.churnsNoMes} (${formatPct(k.churnRate)})`}
                tone={k.churnRate < 0.05 ? 'emerald' : k.churnRate < 0.1 ? 'amber' : 'red'}
                delta={pctDelta(k.churnsNoMes, kAnt.churnsNoMes)}
                deltaInvert
                sub="meta < 10%"
              />
              <KpiCard
                label="MRR Perdido"
                valor={formatBRL(k.mrrPerdido)}
                tone={k.mrrPerdido > 0 ? 'red' : 'emerald'}
                delta={pctDelta(k.mrrPerdido, kAnt.mrrPerdido)}
                deltaInvert
                sub={
                  k.churnsNoMes > 0
                    ? `${k.churnsNoMes} ${k.churnsNoMes === 1 ? 'cliente perdido' : 'clientes perdidos'}`
                    : 'nenhum churn no mês'
                }
              />
              <KpiCard
                label="MRR em Risco"
                valor={formatBRL(k.mrrRisco)}
                tone={k.emRisco > 0 ? 'amber' : 'emerald'}
                sub={`${k.emRisco} ${k.emRisco === 1 ? 'cliente' : 'clientes'} em atenção`}
              />
              <KpiCard
                label="Contratos a Vencer"
                valor={String(k.aVencer)}
                tone={k.aVencer > 0 ? 'amber' : 'emerald'}
                sub={`${formatBRL(k.mrrAVencer)} nos próximos 30 dias`}
              />
            </div>
          </Secao>

          {/* ---------------- Qualidade da Receita ---------------- */}
          <Secao titulo="Qualidade da Receita">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="LTV Médio"
                valor={formatBRL(k.ltvMedio)}
                tone="emerald"
                sub="ticket médio × permanência média"
              />
              <KpiCard
                label="Permanência Média"
                valor={`${Math.round(k.permanenciaMedia)} ${Math.round(k.permanenciaMedia) === 1 ? 'mês' : 'meses'}`}
                tone="neutral"
                sub="tempo médio dos clientes ativos"
              />
              <KpiCard
                label="Tempo até Churn"
                valor={
                  k.tempoAteChurn === null
                    ? '—'
                    : `${Math.round(k.tempoAteChurn)} ${Math.round(k.tempoAteChurn) === 1 ? 'mês' : 'meses'}`
                }
                tone={k.tempoAteChurn === null ? 'neutral' : 'amber'}
                sub={k.tempoAteChurn === null ? 'nenhum cliente perdido' : 'média antes de cancelar'}
              />
              <KpiCard
                label="NPS Médio"
                valor={k.npsMedio === null ? '—' : k.npsMedio.toFixed(1)}
                tone={
                  k.npsMedio === null
                    ? 'neutral'
                    : k.npsMedio >= 9
                      ? 'emerald'
                      : k.npsMedio >= 7
                        ? 'amber'
                        : 'red'
                }
                sub={
                  k.npsMedio === null
                    ? 'nenhum NPS registrado'
                    : `${k.nNps} ${k.nNps === 1 ? 'resposta' : 'respostas'} · escala 0 a 10`
                }
              />
            </div>
          </Secao>

          {/* ---------------- Tendencias ---------------- */}
          <Secao titulo="Tendências (12 meses)">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <MiniTendencia
                id="mrr"
                titulo="Evolução do MRR"
                labels={serie.map((p) => p.label)}
                valores={serie.map((p) => p.mrr)}
                cor="#34d399"
                formato={formatBRLCompacto}
              />
              <MiniTendencia
                id="ativos"
                titulo="Clientes Ativos"
                labels={serie.map((p) => p.label)}
                valores={serie.map((p) => p.ativos)}
                cor="#a78bfa"
                formato={(v) => String(v)}
              />
              <MiniTendencia
                id="churn"
                titulo="Churn Mensal"
                labels={serie.map((p) => p.label)}
                valores={serie.map((p) => p.churns)}
                cor="#f87171"
                formato={(v) => String(v)}
              />
            </div>
          </Secao>
        </>
      )}

      <ClienteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        cliente={null}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />
    </div>
  )
}

// ------ Sub-componentes ------
type Tone = 'emerald' | 'amber' | 'red' | 'neutral'

const toneText: Record<Tone, string> = {
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  red: 'text-red-300',
  neutral: 'text-zinc-100',
}

// Pill de filtro — <select> nativo estilizado como botao dark.
// Sem placeholder = filtro obrigatorio (usa a primeira option como valor
// atual). Com placeholder = "Todos os X" como opcao neutra vazia.
function FiltroPill({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none rounded-md border border-border bg-bg-elev pl-3 pr-8 py-1.5 text-xs font-medium text-zinc-100 hover:border-brand-500/40 focus:border-brand-500/60 focus:outline-none transition-colors"
      style={{
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 16 16\' fill=\'none\'%3E%3Cpath d=\'M4 6l4 4 4-4\' stroke=\'%23a1a1aa\' stroke-width=\'1.5\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Secao colapsavel — chevron + titulo, como na referencia. */
function Secao({
  titulo,
  children,
  defaultOpen = true,
}: {
  titulo: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2.5 flex items-center gap-1.5 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          size={14}
          className={cn('text-muted transition-transform duration-200', !open && '-rotate-90')}
        />
        <span className="text-xs font-semibold text-zinc-100">{titulo}</span>
      </button>
      {open && children}
    </section>
  )
}

/** Delta vs mes anterior. invert = subir e' ruim (churn, perdas). */
function Delta({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null
  const up = pct > 0.0005
  const down = pct < -0.0005
  const bom = invert ? down : up
  const ruim = invert ? up : down
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums',
        bom ? 'text-emerald-400' : ruim ? 'text-red-400' : 'text-muted',
      )}
      title="Variação vs mês anterior"
    >
      <Icon size={11} />
      {up ? '+' : ''}
      {(pct * 100).toFixed(1)}%
    </span>
  )
}

function KpiCard({
  label,
  valor,
  tone = 'neutral',
  delta,
  deltaInvert,
  sub,
}: {
  label: string
  valor: string
  tone?: Tone
  delta?: number | null
  deltaInvert?: boolean
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card px-4 py-3.5 transition-colors hover:border-border/80">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={cn('text-2xl font-bold tabular-nums leading-none', toneText[tone])}>{valor}</p>
        {delta !== undefined && <Delta pct={delta} invert={deltaInvert} />}
      </div>
      {sub && <p className="mt-1.5 text-[10px] text-muted">{sub}</p>}
    </div>
  )
}

/**
 * Mini grafico de area (tendencia 12 meses). SVG puro, cores via classes
 * de tema (grid/texto) + hex da serie (line/gradient).
 */
function MiniTendencia({
  id,
  titulo,
  labels,
  valores,
  cor,
  formato,
}: {
  id: string
  titulo: string
  labels: string[]
  valores: number[]
  cor: string
  formato: (v: number) => string
}) {
  const W = 320
  const H = 132
  const padL = 44
  const padR = 10
  const padT = 10
  const padB = 22
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n = valores.length
  const { max, ticks } = niceScale(Math.max(0, ...valores))
  const ticksVis = ticks.length > 5 ? ticks.filter((_, i) => i % 2 === 0) : ticks
  const x = (i: number) => padL + (n > 1 ? (chartW * i) / (n - 1) : chartW / 2)
  const y = (v: number) => padT + chartH - (v / max) * chartH
  const pontos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const linha = pontos.join(' ')
  const area = `M${x(0).toFixed(1)},${(padT + chartH).toFixed(1)} L${pontos.join(' L')} L${x(n - 1).toFixed(1)},${(padT + chartH).toFixed(1)} Z`
  const atual = valores[n - 1] ?? 0
  const anterior = valores[n - 2] ?? 0
  const delta = pctDelta(atual, anterior)
  const gradId = `grad-tend-${id}`
  const semDados = valores.every((v) => v === 0)

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} style={{ color: cor }} />
          <p className="text-xs font-semibold text-zinc-100">{titulo}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold tabular-nums text-zinc-200">{formato(atual)}</span>
          <Delta pct={delta} invert={id === 'churn'} />
        </div>
      </div>
      {semDados ? (
        <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-bg-soft/30">
          <p className="text-[11px] text-muted">Sem dados nos últimos 12 meses</p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={titulo}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticksVis.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={padL + chartW}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeDasharray="2 3"
              />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="8" className="fill-muted">
                {formato(t)}
              </text>
            </g>
          ))}
          <path d={area} fill={`url(#${gradId})`} />
          <polyline
            points={linha}
            fill="none"
            stroke={cor}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={x(n - 1)} cy={y(atual)} r="3" fill={cor} />
          {labels.map((l, i) =>
            i % 2 === 0 ? (
              <text
                key={l}
                x={x(i)}
                y={H - 6}
                textAnchor="middle"
                fontSize="8"
                className="fill-muted"
              >
                {l}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  )
}

function BoxAcao({
  titulo,
  icon,
  acoes,
  tone,
}: {
  titulo: string
  icon: React.ReactNode
  acoes: string[]
  tone: 'emerald' | 'amber' | 'red'
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-500/40 bg-emerald-500/[0.05]'
      : tone === 'amber'
        ? 'border-amber-500/40 bg-amber-500/[0.05]'
        : 'border-red-500/40 bg-red-500/[0.05]'
  const textCls =
    tone === 'emerald' ? 'text-emerald-200' : tone === 'amber' ? 'text-amber-200' : 'text-red-200'
  return (
    <div className={cn('rounded-xl border p-4', cls)}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className={cn('text-xs font-semibold', textCls)}>{titulo}</p>
      </div>
      <ul className="space-y-1.5 text-[11px] text-muted">
        {acoes.map((a) => (
          <li key={a} className="flex items-start gap-1.5">
            <span className={cn('mt-0.5', textCls)}>·</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ==============================================================
// Evolucao de Clientes — bar chart + tabela historica do ano
// ==============================================================
//
// Derivado de data_inicio (entrada) + arquivado_em (churn). Nao
// precisa snapshot mensal — reconstrucao 100% baseada em eventos.
//
// Por mes do ano corrente:
//   NOVOS       = clientes com data_inicio dentro do mes
//   CHURNS      = clientes com arquivado_em dentro do mes
//   SALDO       = NOVOS - CHURNS
//   BASE ATIVA  = quantos estavam ativos no ULTIMO dia do mes
//                 (data_inicio <= fim AND (arquivado_em is null
//                  OR arquivado_em > fim))
//
// Chart: SVG puro, 12 colunas (jan-dez), 2 barras por coluna
// (emerald novos, red churns) + polyline sky pra Base Ativa.

interface MesEvolucao {
  mesLabel: string
  mesIdx: number
  novos: number
  churns: number
  saldo: number
  baseAtiva: number
  // Listas dos clientes que movimentaram — pra o modal de detalhe
  novosLista: Cliente[]
  churnsLista: Cliente[]
}

function calculaEvolucao(clientes: Cliente[]): MesEvolucao[] {
  const ano = new Date().getFullYear()
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const dados: MesEvolucao[] = []
  const hoje = new Date()

  for (let m = 0; m < 12; m++) {
    const inicioMes = new Date(ano, m, 1)
    const fimMes = new Date(ano, m + 1, 0, 23, 59, 59)

    // Nao projeta pro futuro
    if (inicioMes > hoje) break

    const novosLista = clientes.filter((c) => {
      const d = new Date(c.data_inicio)
      return d >= inicioMes && d <= fimMes
    })
    const novos = novosLista.length

    const churnsLista = clientes.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    })
    const churns = churnsLista.length

    const baseAtiva = clientes.filter((c) => {
      const dIn = new Date(c.data_inicio)
      if (dIn > fimMes) return false
      if (!c.arquivado_em) return true
      const dOut = new Date(c.arquivado_em)
      return dOut > fimMes
    }).length

    dados.push({
      mesLabel: `${nomes[m]}/${String(ano).slice(2)}`,
      mesIdx: m,
      novos,
      churns,
      saldo: novos - churns,
      baseAtiva,
      novosLista,
      churnsLista,
    })
  }
  return dados
}

/**
 * Nice numbers pra eixo Y: retorna [max_ajustado, ticks[]] onde os
 * ticks sao numeros redondos sem duplicatas.
 *
 * Ex: valor bruto 3 -> max=3, ticks=[0,1,2,3]
 *     valor bruto 7 -> max=8, ticks=[0,2,4,6,8]
 *     valor bruto 23 -> max=25, ticks=[0,5,10,15,20,25]
 */
function niceScale(maxValor: number): { max: number; ticks: number[] } {
  if (maxValor <= 0) return { max: 1, ticks: [0, 1] }
  // Passo "bonito" em qualquer magnitude: normaliza pra [1,10) e
  // arredonda pra 1 / 2 / 2.5 / 5 / 10 — funciona tanto pra contagem
  // (3, 7, 23) quanto pra MRR (1.046.500 -> ticks de 250k).
  const alvoTicks = 5
  const stepIdeal = maxValor / alvoTicks
  const mag = 10 ** Math.floor(Math.log10(stepIdeal))
  const norm = stepIdeal / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  // Nunca abaixo de 1 — contagens e R$ sao inteiros
  const step = Math.max(1, nice * mag)
  const max = Math.ceil(maxValor / step - 1e-9) * step
  const ticks: number[] = []
  for (let i = 0; i * step <= max + 1e-9; i++) ticks.push(Math.round(i * step * 1e6) / 1e6)
  return { max, ticks }
}

function EvolucaoClientes({ clientes }: { clientes: Cliente[] }) {
  const dados = useMemo(() => calculaEvolucao(clientes), [clientes])
  const [mesSelecionado, setMesSelecionado] = useState<MesEvolucao | null>(null)

  if (dados.length === 0) {
    return null
  }

  // Escalas com nice numbers pra tirar duplicatas e ficar redondo
  const maxBarRaw = Math.max(1, ...dados.map((d) => Math.max(d.novos, d.churns)))
  const maxBaseRaw = Math.max(1, ...dados.map((d) => d.baseAtiva))
  const escalaBar = niceScale(maxBarRaw)
  const escalaBase = niceScale(maxBaseRaw)
  const maxBar = escalaBar.max
  const maxBase = escalaBase.max
  const yTicks = escalaBar.ticks
  const yBaseTicks = escalaBase.ticks

  // Aspect ratio mais compacto — reduz altura quando dados sao poucos
  const W = 900
  const H = 220
  const padL = 42
  const padR = 42
  const padT = 16
  const padB = 32
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const colW = chartW / dados.length
  const barW = colW * 0.32

  // Empty state: se TODO mundo esta zerado, mostra mensagem
  const semDados = maxBarRaw === 1 && maxBaseRaw === 1 &&
    dados.every((d) => d.novos === 0 && d.churns === 0 && d.baseAtiva === 0)

  // Points do polyline
  const linePoints = dados
    .map((d, i) => {
      const x = padL + colW * i + colW / 2
      const y = padT + chartH - (d.baseAtiva / maxBase) * chartH
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="mt-6 rounded-xl border border-border bg-bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-300" />
          <h3 className="text-sm font-semibold text-zinc-100">Evolução de Clientes</h3>
        </div>
        <span className="rounded-md border border-border bg-bg-soft px-3 py-1 text-[11px] text-zinc-200">
          Ano corrente
        </span>
      </div>
      <p className="mb-3 text-[11px] text-muted">
        Barras verdes = clientes novos no mês · vermelhas = churns · linha azul = base ativa no fim
        do mês.
      </p>

      {semDados ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-bg-soft/30 py-16 text-center">
          <div>
            <p className="text-xs text-muted">Sem movimentação no ano corrente ainda.</p>
            <p className="mt-1 text-[10px] text-muted italic">
              Cadastre clientes ou registre churns pra alimentar o gráfico.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px] w-full">
            {/* Grid lines + labels eixo esquerdo (barras) — usa ticks nice */}
            {yTicks.map((t, i) => {
              const y = padT + chartH - (t / maxBar) * chartH
              return (
                <g key={`y1-${i}`}>
                  <line
                    x1={padL}
                    x2={padL + chartW}
                    y1={y}
                    y2={y}
                    stroke="rgb(38 38 46)"
                    strokeDasharray="2 3"
                    strokeOpacity="0.6"
                  />
                  <text
                    x={padL - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="rgb(113 113 122)"
                  >
                    {t}
                  </text>
                </g>
              )
            })}

            {/* Labels eixo direito (base ativa) — em sky pra combinar com a linha */}
            {yBaseTicks.map((t, i) => {
              const y = padT + chartH - (t / maxBase) * chartH
              return (
                <text
                  key={`y2-${i}`}
                  x={padL + chartW + 8}
                  y={y + 3}
                  textAnchor="start"
                  fontSize="10"
                  fill="rgb(56 189 248)"
                  opacity="0.7"
                >
                  {t}
                </text>
              )
            })}

            {/* Barras — cada mes e uma coluna clicavel que abre o modal
                de detalhamento (novos + churns daquele mes) */}
            {dados.map((d, i) => {
              const xCenter = padL + colW * i + colW / 2
              const xLeftBar = xCenter - barW - 2
              const xRightBar = xCenter + 2
              const novosH = maxBar > 0 ? (d.novos / maxBar) * chartH : 0
              const churnsH = maxBar > 0 ? (d.churns / maxBar) * chartH : 0
              const temMov = d.novos > 0 || d.churns > 0
              return (
                <g
                  key={`col-${i}`}
                  onClick={temMov ? () => setMesSelecionado(d) : undefined}
                  className={temMov ? 'cursor-pointer' : undefined}
                >
                  {/* Hitbox invisivel maior pra facilitar o click */}
                  {temMov && (
                    <rect
                      x={padL + colW * i}
                      y={padT}
                      width={colW}
                      height={chartH}
                      fill="transparent"
                    />
                  )}
                  {d.novos > 0 && (
                    <rect
                      x={xLeftBar}
                      y={padT + chartH - novosH}
                      width={barW}
                      height={novosH}
                      fill="rgb(16 185 129)"
                      rx="2"
                      className="transition-opacity hover:opacity-80"
                    />
                  )}
                  {d.churns > 0 && (
                    <rect
                      x={xRightBar}
                      y={padT + chartH - churnsH}
                      width={barW}
                      height={churnsH}
                      fill="rgb(239 68 68)"
                      rx="2"
                      className="transition-opacity hover:opacity-80"
                    />
                  )}
                  <text
                    x={xCenter}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="rgb(161 161 170)"
                  >
                    {d.mesLabel}
                  </text>
                </g>
              )
            })}

            {/* Linha Base Ativa */}
            <polyline
              points={linePoints}
              fill="none"
              stroke="rgb(56 189 248)"
              strokeWidth="2"
            />
            {dados.map((d, i) => {
              const x = padL + colW * i + colW / 2
              const y = padT + chartH - (d.baseAtiva / maxBase) * chartH
              return <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill="rgb(56 189 248)" />
            })}
          </svg>
        </div>
      )}

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Novos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
          Churns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded bg-sky-400" />
          Base Ativa
        </span>
      </div>

      {/* Tabela */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
              <th className="py-2 text-left font-semibold">Mês</th>
              <th className="py-2 text-right font-semibold">Novos</th>
              <th className="py-2 text-right font-semibold">Churns</th>
              <th className="py-2 text-right font-semibold">Saldo</th>
              <th className="py-2 text-right font-semibold">Base Ativa</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => {
              const temMov = d.novos > 0 || d.churns > 0
              return (
                <tr
                  key={d.mesIdx}
                  onClick={temMov ? () => setMesSelecionado(d) : undefined}
                  className={cn(
                    'border-b border-border/60 transition-colors',
                    temMov && 'cursor-pointer hover:bg-bg-soft/60',
                  )}
                  title={temMov ? 'Clique para ver os clientes' : undefined}
                >
                  <td className="py-2 text-zinc-300">{d.mesLabel}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-300">{d.novos}</td>
                  <td className="py-2 text-right tabular-nums text-red-300">{d.churns}</td>
                  <td
                    className={cn(
                      'py-2 text-right tabular-nums font-semibold',
                      d.saldo > 0
                        ? 'text-emerald-300'
                        : d.saldo < 0
                          ? 'text-red-300'
                          : 'text-zinc-400',
                    )}
                  >
                    {d.saldo > 0 ? '+' : ''}
                    {d.saldo}
                  </td>
                  <td className="py-2 text-right tabular-nums text-zinc-100 font-semibold">
                    {d.baseAtiva}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal — detalhamento da movimentacao do mes */}
      {mesSelecionado && (
        <MovimentacaoMesModal mes={mesSelecionado} onClose={() => setMesSelecionado(null)} />
      )}
    </div>
  )
}

// ==============================================================
// Modal — detalhamento da movimentacao de um mes
// ==============================================================

function MovimentacaoMesModal({
  mes,
  onClose,
}: {
  mes: MesEvolucao
  onClose: () => void
}) {
  const saldoStr = mes.saldo > 0 ? `+${mes.saldo}` : `${mes.saldo}`
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">
            Movimentação de clientes — {mes.mesLabel}
          </h3>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
          >
            <XCircle size={12} />
          </button>
        </div>
        <p className="mb-5 text-[11px] text-muted">
          {mes.novos} novo(s) · {mes.churns} churn(s) · Saldo {saldoStr}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Coluna Novos */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03] p-3">
            <div className="mb-2 flex items-center gap-1.5 border-b border-emerald-500/20 pb-2">
              <Users size={12} className="text-emerald-300" />
              <p className="text-xs font-semibold text-emerald-200">Novos ({mes.novos})</p>
            </div>
            {mes.novosLista.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted italic">Nenhum</p>
            ) : (
              <ul className="space-y-0.5">
                {mes.novosLista.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`/clientes/${c.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                    >
                      <span className="truncate">{c.nome}</span>
                      <ExternalLink size={10} className="shrink-0 opacity-60" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Coluna Churns */}
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.03] p-3">
            <div className="mb-2 flex items-center gap-1.5 border-b border-red-500/20 pb-2">
              <Users size={12} className="text-red-300" />
              <p className="text-xs font-semibold text-red-200">Churns ({mes.churns})</p>
            </div>
            {mes.churnsLista.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted italic">Nenhum</p>
            ) : (
              <ul className="space-y-0.5">
                {mes.churnsLista.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`/clientes/${c.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-zinc-200 hover:bg-red-500/10 hover:text-red-200"
                    >
                      <span className="truncate">{c.nome}</span>
                      <ExternalLink size={10} className="shrink-0 opacity-60" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==============================================================
// Score e Saúde por Squad
// ==============================================================
//
// Formula do score (0-8, com penalizacoes negativas em cima):
//   +2 se NRR >= 100% (retencao meta atingida)
//   +2 se zero churn no mes selecionado
//   +2 se zero clientes em atencao
//   +2 se MRR do squad > media geral (squad puxando resultado)
//   -2 se ha perda de MRR no mes (churn > 0)
//   -1 se squad nao tem indicacoes registradas (v2 — placeholder 0)
//
// Score final vai de -3 (critico) a +8 (saudavel).
// Classificacao: <=0 Critico, 1-4 Atencao, 5+ Saudavel.

interface ScoreSquad {
  nome: string
  clientes: Cliente[]
  mrr: number
  nrr: number
  churnsCount: number
  emRiscoCount: number
  revChurn: number
  score: number
  badges: { label: string; positive: boolean }[]
  classificacao: 'critico' | 'atencao' | 'saudavel'
}

function calculaScoreSquads(clientes: Cliente[], mesISO: string, mrrMedioSquad: number): ScoreSquad[] {
  const [y, m] = mesISO.split('-').map(Number)
  const inicioMes = new Date(y, m - 1, 1)
  const fimMes = new Date(y, m, 0, 23, 59, 59)

  const byNome = new Map<string, Cliente[]>()
  for (const c of clientes) {
    const nome = c.squad ?? '(sem squad)'
    if (!byNome.has(nome)) byNome.set(nome, [])
    byNome.get(nome)!.push(c)
  }

  const resultados: ScoreSquad[] = []
  for (const [nome, lista] of byNome) {
    const ativos = lista.filter((c) => c.status === 'ativo' && !c.arquivado_em)
    const emRisco = lista.filter((c) => c.status === 'atencao' && !c.arquivado_em)
    const churnsNoMes = lista.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    })

    const mrr = ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const revChurn = churnsNoMes.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)

    const baseInicio = ativos.length + churnsNoMes.length
    const churnRateSquad = baseInicio > 0 ? churnsNoMes.length / baseInicio : 0
    const nrr = 1 - churnRateSquad

    // Score components
    let score = 0
    const badges: { label: string; positive: boolean }[] = []

    if (nrr >= 0.95) {
      // Meta atingida — NRR acima de 95%
      score += 2
      badges.push({ label: '+2 NRR', positive: true })
    }
    if (churnsNoMes.length === 0) {
      score += 2
      badges.push({ label: '+2 Zero churn', positive: true })
    } else {
      score -= 2
      badges.push({ label: '-2 Perda MRR', positive: false })
    }
    if (emRisco.length === 0) {
      score += 2
      badges.push({ label: '+2 Zero risco', positive: true })
    }
    if (mrr > mrrMedioSquad) {
      score += 2
      badges.push({ label: '+2 MRR acima da média', positive: true })
    }
    // Indicacoes ainda nao tem tracking — placeholder negativa
    score -= 1
    badges.push({ label: '-1 Sem indic.', positive: false })

    const classificacao: 'critico' | 'atencao' | 'saudavel' =
      score <= 0 ? 'critico' : score <= 4 ? 'atencao' : 'saudavel'

    resultados.push({
      nome,
      clientes: lista,
      mrr,
      nrr,
      churnsCount: churnsNoMes.length,
      emRiscoCount: emRisco.length,
      revChurn,
      score,
      badges,
      classificacao,
    })
  }
  // Ordena: saudavel primeiro, depois atencao, depois critico
  const ordem = { saudavel: 0, atencao: 1, critico: 2 }
  resultados.sort((a, b) => ordem[a.classificacao] - ordem[b.classificacao])
  return resultados
}

function ScoreSaudeSquads({ clientes, mesISO }: { clientes: Cliente[]; mesISO: string }) {
  const squads = useMemo(() => {
    const nomes = new Set<string>()
    for (const c of clientes) if (c.squad) nomes.add(c.squad)
    const nQtd = nomes.size || 1
    const mrrTotal = clientes
      .filter((c) => c.status === 'ativo' && !c.arquivado_em)
      .reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrMedioSquad = mrrTotal / nQtd
    return calculaScoreSquads(clientes, mesISO, mrrMedioSquad)
  }, [clientes, mesISO])

  if (squads.length === 0) {
    return null
  }

  return (
    <div className="mt-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
        Score e Saúde por Squad
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {squads.map((sq) => (
          <SquadCard key={sq.nome} squad={sq} />
        ))}
      </div>
    </div>
  )
}

function SquadCard({ squad }: { squad: ScoreSquad }) {
  const cls =
    squad.classificacao === 'saudavel'
      ? 'border-emerald-500/40'
      : squad.classificacao === 'atencao'
        ? 'border-amber-500/40'
        : 'border-red-500/40'

  const scoreCls =
    squad.classificacao === 'saudavel'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
      : squad.classificacao === 'atencao'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
        : 'border-red-500/40 bg-red-500/10 text-red-200'

  const classLabel =
    squad.classificacao === 'saudavel'
      ? 'Saudável'
      : squad.classificacao === 'atencao'
        ? 'Atenção'
        : 'Crítico'

  // Progress bar — score varia de -3 a +8, normaliza pra 0-100
  const scoreNorm = Math.max(0, Math.min(100, ((squad.score + 3) / 11) * 100))

  return (
    <div className={cn('rounded-xl border bg-bg-card p-5', cls)}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">{squad.nome}</h4>
          <p className="mt-1 text-[11px] text-muted">
            <Users size={10} className="inline mr-1" />
            {squad.clientes.length} clientes · {formatBRL(squad.mrr)} MRR
          </p>
        </div>
        <div className={cn('rounded-md border px-3 py-2 text-right', scoreCls)}>
          <p className="text-lg font-bold tabular-nums leading-none">
            {squad.score > 0 ? '+' : ''}
            {squad.score}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-wider opacity-80">
            de 8 · {classLabel}
          </p>
        </div>
      </div>

      {/* Progress bar 3 zonas */}
      <div className="relative h-2 rounded-full bg-bg-elev overflow-hidden">
        <div className="absolute inset-0 flex">
          <div className="w-1/3 bg-red-500/20" />
          <div className="w-1/3 bg-amber-500/20" />
          <div className="w-1/3 bg-emerald-500/20" />
        </div>
        <div
          className={cn(
            'absolute top-0 h-full w-1 rounded transition-all',
            squad.classificacao === 'saudavel'
              ? 'bg-emerald-400'
              : squad.classificacao === 'atencao'
                ? 'bg-amber-400'
                : 'bg-red-400',
          )}
          style={{ left: `${scoreNorm}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-muted">
        <span>Crítico</span>
        <span>Atenção</span>
        <span>Saudável</span>
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {squad.badges.map((b, i) => (
          <span
            key={i}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium',
              b.positive
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200',
            )}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Sub-KPIs 2x2 */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">NRR</span>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                squad.nrr >= 0.95 ? 'text-emerald-300' : squad.nrr >= 0.9 ? 'text-amber-300' : 'text-red-300',
              )}
            >
              {(squad.nrr * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted">
            {squad.nrr >= 0.95
              ? 'Meta atingida (≥ 95%)'
              : `Faltam ${((0.95 - squad.nrr) * 100).toFixed(1)}pp para meta`}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">Logo Churn</span>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                squad.churnsCount === 0 ? 'text-emerald-300' : 'text-red-300',
              )}
            >
              {squad.churnsCount}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted">
            {squad.churnsCount === 0
              ? 'Nenhum cliente perdido'
              : `${((squad.churnsCount / squad.clientes.length) * 100).toFixed(1)}% da base`}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">Rev. Churn</span>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                squad.revChurn === 0 ? 'text-emerald-300' : 'text-red-300',
              )}
            >
              {formatBRL(squad.revChurn)}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted">
            {squad.revChurn === 0
              ? 'Sem perda de receita'
              : squad.mrr > 0
                ? `${((squad.revChurn / (squad.mrr + squad.revChurn)) * 100).toFixed(1)}% do MRR`
                : ''}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">Indicações</span>
            <span className="text-xs font-semibold text-muted tabular-nums">0</span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted italic">v2 — tracking pendente</p>
        </div>
      </div>
    </div>
  )
}

// ==============================================================
// Social Media — visao rapida do setor
// ==============================================================
//
// 3 KPIs no topo:
//   Clientes com Social Media  = count clientes com modulo social_media
//                                 e status='ativo'
//   Social em Atraso           = subset acima com status='atencao'
//                                 (aproximacao; mais preciso via
//                                 producoes_social_media_items no v2)
//   NPS Medio (Social)         = AVG nps dos clientes com social_media
//
// Ranking por Responsavel:
//   Agrupa por social_media_id, mostra nome + count + AVG nps.
//   Ordena por count desc (quem tem mais clientes primeiro).

function SocialMediaVisao({
  clientes,
  profiles,
}: {
  clientes: Cliente[]
  profiles: Profile[]
}) {
  const dados = useMemo(() => {
    // So considera clientes de Social Media ativos
    const socialAtivos = clientes.filter(
      (c) =>
        c.modulos.includes('social_media') &&
        c.status === 'ativo' &&
        !c.arquivado_em,
    )
    const totalAtivos = clientes.filter(
      (c) => c.status === 'ativo' && !c.arquivado_em,
    ).length

    // 'Em atraso' pra social = semaforo fora do verde (amarelo/laranja/
    // vermelho = Atencao/Risco/Critico). Sem semaforo preenchido nao conta.
    const emAtrasoReal = socialAtivos.filter(
      (c) => c.semaforo === 'amarelo' || c.semaforo === 'laranja' || c.semaforo === 'vermelho',
    )

    const comNps = socialAtivos.filter((c) => typeof c.nps === 'number')
    const npsMedio =
      comNps.length > 0
        ? comNps.reduce((s, c) => s + (c.nps ?? 0), 0) / comNps.length
        : null

    // Ranking por responsavel
    const porResponsavel = new Map<
      string,
      { nome: string; clientes: number; npsSum: number; npsCount: number }
    >()
    for (const c of socialAtivos) {
      const respId = c.social_media_id ?? '__sem__'
      const resp = profiles.find((p) => p.id === respId)
      const nome = resp?.nome ?? '— sem responsável —'
      const atual = porResponsavel.get(respId) ?? {
        nome,
        clientes: 0,
        npsSum: 0,
        npsCount: 0,
      }
      atual.clientes += 1
      if (typeof c.nps === 'number') {
        atual.npsSum += c.nps
        atual.npsCount += 1
      }
      porResponsavel.set(respId, atual)
    }
    const ranking = [...porResponsavel.values()]
      .map((r) => ({
        nome: r.nome,
        clientes: r.clientes,
        nps: r.npsCount > 0 ? r.npsSum / r.npsCount : null,
      }))
      .sort((a, b) => b.clientes - a.clientes)

    return {
      totalSocial: socialAtivos.length,
      totalAtivos,
      emAtraso: emAtrasoReal.length,
      pctAtraso: socialAtivos.length > 0 ? emAtrasoReal.length / socialAtivos.length : 0,
      npsMedio,
      ranking,
    }
  }, [clientes, profiles])

  if (dados.totalSocial === 0) {
    return null
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Instagram size={14} className="text-pink-400" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Social Media
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Instagram size={12} className="text-pink-400" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Clientes com Social Media
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-zinc-100">
            {dados.totalSocial}
          </p>
          <p className="mt-1 text-[10px] text-muted">de {dados.totalAtivos} ativos</p>
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle
              size={12}
              className={dados.pctAtraso > 0 ? 'text-amber-300' : 'text-muted'}
            />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Social em Atraso
            </p>
          </div>
          <p
            className={cn(
              'text-2xl font-bold tabular-nums',
              dados.pctAtraso === 0
                ? 'text-emerald-300'
                : dados.pctAtraso < 0.1
                  ? 'text-amber-300'
                  : 'text-red-300',
            )}
          >
            {(dados.pctAtraso * 100).toFixed(0)}%
          </p>
          <p className="mt-1 text-[10px] text-muted">
            {dados.emAtraso} {dados.emAtraso === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Smile size={12} className="text-amber-300" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              NPS Médio (Social)
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-zinc-100">
            {dados.npsMedio !== null ? dados.npsMedio.toFixed(1) : '—'}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            {dados.npsMedio !== null ? 'de 0 a 10' : 'sem NPS preenchido'}
          </p>
        </div>
      </div>

      {/* Ranking */}
      {dados.ranking.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-bg-card p-5">
          <h4 className="mb-3 text-sm font-semibold text-zinc-100">
            Ranking por Social Media
          </h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                <th className="py-2 text-left font-semibold">Responsável</th>
                <th className="py-2 text-right font-semibold">Clientes</th>
                <th className="py-2 text-right font-semibold">NPS Médio</th>
              </tr>
            </thead>
            <tbody>
              {dados.ranking.map((r) => (
                <tr key={r.nome} className="border-b border-border/60 hover:bg-bg-soft/40">
                  <td className="py-2">
                    <span className="inline-flex items-center gap-2 text-zinc-200">
                      <Instagram size={11} className="text-pink-400" />
                      {r.nome}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-zinc-100">
                    {r.clientes}
                  </td>
                  <td
                    className={cn(
                      'py-2 text-right tabular-nums font-semibold',
                      r.nps === null
                        ? 'text-muted'
                        : r.nps >= 8
                          ? 'text-emerald-300'
                          : r.nps >= 6
                            ? 'text-amber-300'
                            : 'text-red-300',
                    )}
                  >
                    {r.nps !== null ? r.nps.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
