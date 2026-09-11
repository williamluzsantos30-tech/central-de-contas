/**
 * Visao Executiva — pagina que o DONO da agencia abre primeiro.
 * Reproduz o layout de resumo geral que ele mostrou como referencia.
 *
 * Estrutura:
 *   Header + filtros (mes/squad/AM/gestor)
 *   Banner "Mes Atual - Tempo Real" (so quando mes atual selecionado)
 *   Banner de alerta (condicional, quando ha metricas ruins)
 *   Hero: Receita do Mes (MRR) grande
 *   Grid de KPIs: NRR, Churn Rate, MRR em Risco, Composicao Base,
 *                  Ticket Medio
 *   Resultado do Negocio: Expansao / Reducao / Churn + Saldo
 *   Execucao Operacional: Clientes em Risco, Tempo Medio Vida,
 *                          Onboarding Finalizado, NPS Medio
 *   Lifetime Value: LTV Medio, LT Medio
 *   Evolucao de Clientes: bar chart + tabela historica ano corrente
 *   Score e Saude por Squad: cards por squad com score de -3 a +8
 *   Acoes Sugeridas: Verde / Amarelo / Vermelho — pra aplicar em cada
 *                     nivel de squad classificado acima
 *   Social Media: 3 KPIs (clientes com social, em atraso, NPS medio)
 *                  + ranking por responsavel
 *
 * Metricas derivadas de clientes.* (sem tabela historica ainda):
 *   MRR              = SUM verba_mensal WHERE status='ativo'
 *   Churn Rate       = churns_mes / (ativos_hoje + churns_mes) — aprox
 *   NRR              = 1 - churn_rate  — aprox (sem tracking de
 *                      expansao/reducao ainda; assume 0)
 *   MRR em Risco     = SUM verba_mensal WHERE status='atencao'
 *   NPS Medio        = AVG(nps) dos ativos com nps preenchido
 *   Tempo Medio Vida = AVG(hoje - data_inicio) em meses (ativos)
 *   LTV Medio        = ticket_medio × tempo_medio_vida
 *
 * O que ainda NAO faz (v2):
 *   - Metricas de Social Media integradas
 *   - Tracking de indicacoes por squad
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  BookOpen,
  Download,
  Smile,
  Zap,
  CheckCircle2,
  XCircle,
  Calendar,
  Instagram,
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

/** Meses entre data ISO e hoje. Retorna 0 se data invalida. */
function mesesDesde(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  const hoje = new Date()
  const diffMs = hoje.getTime() - d.getTime()
  return diffMs / (1000 * 60 * 60 * 24 * 30.44)
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

export default function VisaoExecutiva() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [eventosMov, setEventosMov] = useState<EventoMovimento[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
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
      // Eventos de movimento comercial — expansao, perda, churn.
      // Alimenta o bloco Resultado do Negocio.
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

  // Base filtrada por squad / AM / gestor
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      if (fSquad && c.squad !== fSquad) return false
      if (fAM && c.account_manager_id !== fAM) return false
      if (fGestor && c.gestor_id !== fGestor) return false
      return true
    })
  }, [clientes, fSquad, fAM, fGestor])

  // Squads distintos pra dropdown
  const squadsDistintos = useMemo(() => {
    const set = new Set<string>()
    for (const c of clientes) if (c.squad) set.add(c.squad)
    return [...set].sort()
  }, [clientes])

  const ams = useMemo(() => profiles.filter((p) => p.cargo === 'account_manager'), [profiles])
  const gestores = useMemo(() => profiles.filter((p) => p.cargo === 'gestor_trafego'), [profiles])

  const kpis = useMemo(() => {
    const [y, m] = mesISO.split('-').map(Number)
    const inicioMes = new Date(y, m - 1, 1)
    const fimMes = new Date(y, m, 0, 23, 59, 59)

    const ativos = clientesFiltrados.filter(
      (c) => c.status === 'ativo' && !c.arquivado_em,
    )
    const emRisco = clientesFiltrados.filter(
      (c) => c.status === 'atencao' && !c.arquivado_em,
    )
    const churnsNoMes = clientesFiltrados.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    })

    const mrr = ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrRisco = emRisco.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrChurn = churnsNoMes.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)

    // Filtra eventos manuais de movimento comercial do mes selecionado.
    // Prioriza meta.data (a data que o user informou no modal) e cai
    // pra criado_em se nao tem meta.data.
    const clienteIdsFiltrados = new Set(clientesFiltrados.map((c) => c.id))
    const eventosDoMes = eventosMov.filter((ev) => {
      if (!clienteIdsFiltrados.has(ev.cliente_id)) return false
      const dataStr = ev.meta?.data ?? ev.criado_em
      const d = new Date(dataStr)
      return d >= inicioMes && d <= fimMes
    })

    const expansoes = eventosDoMes.filter((ev) => ev.tipo === 'expansao')
    const perdas = eventosDoMes.filter((ev) => ev.tipo === 'perda')
    const churnsExplicitos = eventosDoMes.filter((ev) => ev.tipo === 'churn')

    const expansao = expansoes.reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)
    const reducao = perdas.reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)

    // Churn: usa a soma dos eventos tipo='churn' se houver, senao
    // fallback pro somatorio de arquivado_em (retrocompativel)
    const mrrChurnEfetivo =
      churnsExplicitos.length > 0
        ? churnsExplicitos.reduce((s, ev) => s + (ev.meta?.valor_perdido ?? 0), 0)
        : mrrChurn

    const baseInicioMes = ativos.length + churnsNoMes.length
    const churnRate = baseInicioMes > 0 ? churnsNoMes.length / baseInicioMes : 0

    // NRR = 1 + (expansao - reducao - churn) / MRR_inicio_mes
    const mrrInicioMes = mrr + mrrChurn - expansao + reducao // aproximacao
    const nrr = mrrInicioMes > 0 ? 1 + (expansao - reducao - mrrChurnEfetivo) / mrrInicioMes : 1

    const ticketMedio = ativos.length > 0 ? mrr / ativos.length : 0

    // Composicao por tipo
    const nAssessoria = ativos.filter((c) => c.tipo === 'assessoria').length
    const nConsultoria = ativos.filter((c) => c.tipo === 'consultoria').length

    // Resultado do negocio — agora vem do log real
    const saldo = expansao - reducao - mrrChurnEfetivo

    // Execucao operacional
    const emOnboarding = ativos.filter((c) => c.jornada === 'onboarding').length
    const finalizouOnboarding = ativos.filter((c) => c.jornada && c.jornada !== 'onboarding').length
    const pctOnboardingFinalizado =
      ativos.length > 0 ? finalizouOnboarding / ativos.length : 0

    const clientesComNps = ativos.filter((c) => typeof c.nps === 'number')
    const npsMedio =
      clientesComNps.length > 0
        ? clientesComNps.reduce((s, c) => s + (c.nps ?? 0), 0) / clientesComNps.length
        : null

    // Tempo medio de vida (meses) — dos ativos com data_inicio
    const vidasAtivos = ativos
      .map((c) => mesesDesde(c.data_inicio))
      .filter((v) => v > 0)
    const tempoMedioVida =
      vidasAtivos.length > 0
        ? vidasAtivos.reduce((a, b) => a + b, 0) / vidasAtivos.length
        : 0

    // LTV medio = ticket * tempo de vida
    const ltvMedio = ticketMedio * tempoMedioVida

    return {
      mrr,
      mrrRisco,
      mrrChurn: mrrChurnEfetivo,
      churnRate,
      nrr,
      ativos: ativos.length,
      emRisco: emRisco.length,
      churnsNoMes: churnsNoMes.length,
      ticketMedio,
      nAssessoria,
      nConsultoria,
      expansao,
      reducao,
      saldo,
      // Contagens dos eventos manuais — usadas pra sub-legendas
      nExpansoes: expansoes.length,
      nPerdas: perdas.length,
      nChurnEventos: churnsExplicitos.length,
      emOnboarding,
      pctOnboardingFinalizado,
      npsMedio,
      tempoMedioVida,
      ltvMedio,
    }
  }, [clientesFiltrados, mesISO, eventosMov])

  // Classificacao do "farol" pro banner de alerta
  const temAlerta = kpis.saldo < 0 || kpis.emRisco > 0 || kpis.churnRate > 0.05

  return (
    <div>
      <PageHeader
        title="Resumo Geral"
        description="Visão executiva da saúde da operação"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => alert('Código de Cultura — em breve')}>
              <BookOpen size={14} /> Código de Cultura
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Download size={14} /> Exportar
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={14} /> Novo cliente
            </Button>
          </div>
        }
      />

      {/* Filtros — container unico, sobrio, alinhado */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-soft/40 px-3 py-2">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border">
          <Calendar size={13} className="text-muted" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Filtros
          </span>
        </div>
        <FiltroPill
          value={mesISO}
          onChange={(v) => setMesISO(v)}
          options={ultimosMeses(12).map((iso) => ({
            value: iso,
            label: labelMes(iso).replace(/^./, (c) => c.toUpperCase()),
          }))}
        />
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

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : (
        <>
          {/* Banner Mes Atual — tempo real */}
          {eMesAtual && (
            <div className="mb-3 rounded-xl border border-sky-500/40 bg-sky-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-sky-300" />
                <p className="text-xs font-semibold text-sky-200">
                  Mês Atual
                  <span className="ml-2 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] uppercase text-sky-300">
                    Tempo Real
                  </span>
                </p>
              </div>
              <p className="mt-1 text-[11px] text-sky-300/80">
                Dados de {labelMes(mesISO)} são calculados em tempo real e podem
                mudar conforme novas movimentações são registradas.
              </p>
            </div>
          )}

          {/* Banner de alerta condicional */}
          {temAlerta && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-300" />
                <p className="text-xs font-semibold text-red-200">
                  {labelMes(mesISO)} em alerta
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                {kpis.nrr < 1 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    NRR {formatPct(kpis.nrr)}
                  </span>
                )}
                {kpis.churnRate > 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Churn {formatPct(kpis.churnRate)}
                  </span>
                )}
                {kpis.saldo !== 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Saldo {formatBRLSigned(kpis.saldo)}
                  </span>
                )}
                {kpis.emRisco > 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {kpis.emRisco} em risco ({formatBRL(kpis.mrrRisco)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Bloco principal — MRR + KPIs em grade */}
          <div className="rounded-xl border border-border bg-bg-card p-6">
            {/* Hero MRR */}
            <div className="mb-6 pb-6 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-emerald-300" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Receita do mês (MRR)
                </p>
              </div>
              <p className="text-5xl font-bold tabular-nums leading-none text-emerald-300">
                {formatBRL(kpis.mrr)}
              </p>
              <p className="mt-2 text-xs text-muted">receita recorrente mensal</p>
            </div>

            {/* Grid de sub-KPIs */}
            <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
              <SubKpi
                titulo="NRR"
                valor={formatPct(kpis.nrr)}
                tone={kpis.nrr >= 1 ? 'emerald' : kpis.nrr >= 0.95 ? 'amber' : 'red'}
              />
              <SubKpi
                titulo="Churn Rate"
                valor={formatPct(kpis.churnRate)}
                tone={kpis.churnRate === 0 ? 'emerald' : kpis.churnRate < 0.03 ? 'amber' : 'red'}
              />
              <SubKpi
                titulo="MRR em Risco"
                valor={formatBRL(kpis.mrrRisco)}
                tone={kpis.mrrRisco === 0 ? 'emerald' : 'red'}
              />
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                  Composição da Base
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">
                  {kpis.ativos}
                </p>
                <p className="text-[10px] text-muted">clientes ativos</p>
                <div className="mt-2 flex flex-col gap-0.5 text-[10px] text-muted">
                  <span>{kpis.nAssessoria} Assessoria</span>
                  <span>{kpis.nConsultoria} Consultoria</span>
                </div>
              </div>
              <SubKpi
                titulo="Ticket Médio"
                valor={formatBRL(kpis.ticketMedio)}
                tone="neutral"
              />
            </div>
          </div>

          {/* Resultado do Negocio */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-bg-card p-5 md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-4">
                Resultado do Negócio
              </p>
              <div className="space-y-3">
                <LinhaResultado
                  icone={<Plus size={12} className="text-emerald-400" />}
                  label="Expansão"
                  valor={kpis.expansao}
                  tone="emerald"
                  sub={
                    kpis.nExpansoes > 0
                      ? `${kpis.nExpansoes} ${kpis.nExpansoes === 1 ? 'registro' : 'registros'}`
                      : 'nenhuma'
                  }
                />
                <LinhaResultado
                  icone={<span className="text-amber-400 text-xs">−</span>}
                  label="Redução"
                  valor={-kpis.reducao}
                  tone="amber"
                  sub={
                    kpis.nPerdas > 0
                      ? `${kpis.nPerdas} ${kpis.nPerdas === 1 ? 'registro' : 'registros'}`
                      : 'nenhuma'
                  }
                />
                <LinhaResultado
                  icone={<span className="text-red-400 text-xs">−</span>}
                  label="Churn"
                  valor={-kpis.mrrChurn}
                  tone="red"
                  sub={
                    kpis.churnsNoMes > 0
                      ? `${kpis.churnsNoMes} ${kpis.churnsNoMes === 1 ? 'cliente' : 'clientes'}`
                      : 'nenhum'
                  }
                />
              </div>
              <p className="mt-3 text-[10px] text-muted italic">
                Dados do log real de <code className="text-brand-300">cliente_eventos</code> —
                Expansão/Perda/Churn registrados nas Fichas dos clientes.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                <Zap size={12} className="inline mr-1" />
                Saldo do Mês
              </p>
              <p
                className={cn(
                  'text-4xl font-bold tabular-nums leading-none mt-3',
                  kpis.saldo < 0
                    ? 'text-red-300'
                    : kpis.saldo > 0
                      ? 'text-emerald-300'
                      : 'text-zinc-300',
                )}
              >
                {formatBRLSigned(kpis.saldo)}
              </p>
              <p className="mt-3 text-[10px] text-muted leading-relaxed">
                Saldo = Expansão + Nova Receita manual − Redução − Churn no
                período.
              </p>
            </div>
          </div>

          {/* Execucao Operacional */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
              Execução Operacional
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ExecKpi
                icone={<AlertTriangle size={14} className="text-red-300" />}
                titulo="Clientes em Risco"
                valor={String(kpis.emRisco)}
                sub={`${formatBRL(kpis.mrrRisco)} em risco`}
              />
              <ExecKpi
                icone={<Clock size={14} className="text-brand-300" />}
                titulo="Tempo Médio de Vida"
                valor={`${kpis.tempoMedioVida.toFixed(1)}m`}
                sub={`${kpis.ativos} clientes ativos`}
              />
              <ExecKpi
                icone={<CheckCircle2 size={14} className="text-emerald-300" />}
                titulo="Onboarding Finalizado"
                valor={formatPct(kpis.pctOnboardingFinalizado)}
                sub={`${kpis.emOnboarding} em onboarding`}
              />
              <ExecKpi
                icone={<Smile size={14} className="text-amber-300" />}
                titulo="NPS Médio"
                valor={kpis.npsMedio !== null ? kpis.npsMedio.toFixed(1) : 'sem dado'}
                sub={
                  kpis.npsMedio !== null
                    ? 'de 0 a 10'
                    : 'nenhum cliente com NPS preenchido'
                }
              />
            </div>
          </div>

          {/* Lifetime Value */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
              <DollarSign size={12} className="inline mr-1" />
              Lifetime Value (LTV)
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ExecKpi
                icone={<DollarSign size={14} className="text-brand-300" />}
                titulo="LTV Médio"
                valor={formatBRL(kpis.ltvMedio)}
                sub={`ticket médio × tempo médio de vida`}
                grande
              />
              <ExecKpi
                icone={<Users size={14} className="text-brand-300" />}
                titulo="LT Médio (Base Ativa)"
                valor={`${kpis.tempoMedioVida.toFixed(1)} meses`}
                sub={`${kpis.ativos} clientes ativos`}
                grande
              />
            </div>
          </div>

          {/* Evolucao de Clientes */}
          <EvolucaoClientes clientes={clientesFiltrados} />

          {/* Score e Saude por Squad */}
          <ScoreSaudeSquads clientes={clientesFiltrados} mesISO={mesISO} />

          {/* Acoes Sugeridas — fica DEPOIS dos squads porque as sugestoes
              se aplicam por squad classificado. Ordem: primeiro voce ve
              quem esta bem/mal, depois o que fazer com cada nivel. */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
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

          {/* Visao rapida do setor de Social Media */}
          <SocialMediaVisao clientes={clientesFiltrados} profiles={profiles} />

          {/* Rodape com placeholders v2 */}
          <div className="mt-8 rounded-xl border border-dashed border-border bg-bg-soft/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Próximos blocos (v2)
            </p>
            <ul className="mt-2 space-y-1 text-[11px] text-muted">
              <li>· Tracking de indicações por squad</li>
            </ul>
          </div>
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

function SubKpi({ titulo, valor, tone }: { titulo: string; valor: string; tone: Tone }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
        {titulo}
      </p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums leading-none', toneText[tone])}>
        {valor}
      </p>
    </div>
  )
}

function LinhaResultado({
  icone,
  label,
  valor,
  tone,
  sub,
}: {
  icone: React.ReactNode
  label: string
  valor: number
  tone: 'emerald' | 'amber' | 'red'
  sub?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-bg-soft/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-bg-elev">{icone}</span>
        <div>
          <span className="text-xs text-zinc-200">{label}</span>
          {sub && <span className="ml-1.5 text-[10px] text-muted">· {sub}</span>}
        </div>
      </div>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-red-300',
        )}
      >
        {formatBRL(valor)}
      </span>
    </div>
  )
}

function ExecKpi({
  icone,
  titulo,
  valor,
  sub,
  grande = false,
}: {
  icone: React.ReactNode
  titulo: string
  valor: string
  sub?: string
  grande?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        {icone}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {titulo}
        </p>
      </div>
      <p className={cn('font-bold tabular-nums text-zinc-100', grande ? 'text-3xl' : 'text-2xl')}>
        {valor}
      </p>
      {sub && <p className="mt-1 text-[10px] text-muted">{sub}</p>}
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

    const novos = clientes.filter((c) => {
      const d = new Date(c.data_inicio)
      return d >= inicioMes && d <= fimMes
    }).length

    const churns = clientes.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    }).length

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
  // Passos "bonitos" — arredonda pra multiplos que produzem ticks limpos
  const passos = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  const alvoTicks = 5
  const stepIdeal = maxValor / alvoTicks
  const step = passos.find((p) => p >= stepIdeal) ?? Math.ceil(stepIdeal / 100) * 100
  const max = Math.ceil(maxValor / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return { max, ticks }
}

function EvolucaoClientes({ clientes }: { clientes: Cliente[] }) {
  const dados = useMemo(() => calculaEvolucao(clientes), [clientes])

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

            {/* Barras */}
            {dados.map((d, i) => {
              const xCenter = padL + colW * i + colW / 2
              const xLeftBar = xCenter - barW - 2
              const xRightBar = xCenter + 2
              const novosH = maxBar > 0 ? (d.novos / maxBar) * chartH : 0
              const churnsH = maxBar > 0 ? (d.churns / maxBar) * chartH : 0
              return (
                <g key={`col-${i}`}>
                  {d.novos > 0 && (
                    <rect
                      x={xLeftBar}
                      y={padT + chartH - novosH}
                      width={barW}
                      height={novosH}
                      fill="rgb(16 185 129)"
                      rx="2"
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
            {dados.map((d) => (
              <tr key={d.mesIdx} className="border-b border-border/60 hover:bg-bg-soft/40">
                <td className="py-2 text-zinc-300">{d.mesLabel}</td>
                <td className="py-2 text-right tabular-nums text-emerald-300">{d.novos}</td>
                <td className="py-2 text-right tabular-nums text-red-300">{d.churns}</td>
                <td
                  className={cn(
                    'py-2 text-right tabular-nums font-semibold',
                    d.saldo > 0 ? 'text-emerald-300' : d.saldo < 0 ? 'text-red-300' : 'text-zinc-400',
                  )}
                >
                  {d.saldo > 0 ? '+' : ''}
                  {d.saldo}
                </td>
                <td className="py-2 text-right tabular-nums text-zinc-100 font-semibold">
                  {d.baseAtiva}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

    if (nrr >= 1) {
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
                squad.nrr >= 1 ? 'text-emerald-300' : squad.nrr >= 0.95 ? 'text-amber-300' : 'text-red-300',
              )}
            >
              {(squad.nrr * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted">
            {squad.nrr >= 1 ? 'Meta atingida' : `Faltam ${((1 - squad.nrr) * 100).toFixed(1)}pp`}
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

    const emAtraso = socialAtivos.filter((c) => c.status === 'atencao') // mesmo array — status='ativo' filtrado ja; usar status_saude_geral
    // Refazendo: 'atraso' pra social e' quem esta em atencao pelo semaforo
    // ou pelo status_saude. Usa semaforo se estiver preenchido, senao 0.
    const emAtrasoReal = socialAtivos.filter(
      (c) => c.semaforo === 'atencao' || c.semaforo === 'critico',
    )
    void emAtraso

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
