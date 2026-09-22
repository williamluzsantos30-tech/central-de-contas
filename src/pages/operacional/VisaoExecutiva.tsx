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
  ExternalLink,
  Calendar,
  Instagram,
  Archive,
  Lock,
  Share2,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { FilterBar, FilterPill } from '@/components/ds'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { CodigoCulturaModal } from '@/components/operacional/CodigoCulturaModal'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
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

const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** mesISO -> "AGO/26" (usado no rotulo de comparacao MoM dos squads). */
function labelMesCurto(mesISO: string): string {
  const [y, m] = mesISO.split('-').map(Number)
  return `${MES_CURTO[m - 1]}/${String(y).slice(-2)}`
}

/**
 * MRR reconstruido de um squad num mes: soma verba_mensal dos clientes
 * que ja tinham iniciado ate o fim do mes e ainda nao estavam arquivados
 * naquele momento (data_inicio <= fimMes E arquivado_em nulo ou > fimMes).
 * Base pro NRR (mrrInicio) e pra comparacao mes-a-mes.
 */
function mrrSquadNoMes(lista: Cliente[], mesISO: string): number {
  const [y, m] = mesISO.split('-').map(Number)
  const fimMes = new Date(y, m, 0, 23, 59, 59)
  return lista.reduce((s, c) => {
    if (!c.data_inicio) return s
    const ini = new Date(c.data_inicio)
    if (isNaN(ini.getTime()) || ini > fimMes) return s
    if (c.arquivado_em && new Date(c.arquivado_em) <= fimMes) return s
    return s + (c.verba_mensal ?? 0)
  }, 0)
}

/** ISO datetime → "dd/mm/aaaa às HH:MM". */
function fmtDataHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} às ${hh}:${mi}`
}

/** Ultimos N meses (do atual pra tras) como array de mesISO. */
function ultimosMeses(n: number): string[] {
  const hoje = new Date()
  const atualISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(shiftMes(atualISO, -i))
  return out
}

/**
 * Meses de casa, inteiros — o mes em curso conta. Cliente que entrou
 * hoje = 1 mes; com 45 dias = 2 meses. Mesma regra da Ficha e da lista.
 * Retorna 0 so se a data for invalida.
 */
function mesesDesde(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  const diffMs = Date.now() - d.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))) + 1
}

function mesesLabel(n: number): string {
  return `${n} ${n === 1 ? 'mês' : 'meses'}`
}

/** Dias inteiros entre duas datas ISO. 0 se invalida ou negativa. */
function diasEntre(iniISO: string | null, fimISO: string | null): number {
  if (!iniISO || !fimISO) return 0
  const ini = new Date(iniISO)
  const fim = new Date(fimISO)
  if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return 0
  return Math.max(0, Math.round((fim.getTime() - ini.getTime()) / 86_400_000))
}

// Meta interna de dias pra concluir o onboarding. Vira config por
// agencia quando o modulo de metas nascer.
const SLA_ONBOARDING_DIAS = 30

/** Data curta pt-BR. Trata 'YYYY-MM-DD' sem deslocar fuso. */
function formatDataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

type TipoMov = 'expansao' | 'perda' | 'churn'

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

// Evento de mudanca de jornada (auto-log do trigger). Usado pra medir
// quanto tempo o cliente levou pra SAIR do onboarding.
interface EventoJornada {
  cliente_id: string
  criado_em: string
  meta: { campo?: string; de?: string | null; para?: string | null } | null
}

export default function VisaoExecutiva() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [eventosMov, setEventosMov] = useState<EventoMovimento[]>([])
  const [eventosJornada, setEventosJornada] = useState<EventoJornada[]>([])
  const [loading, setLoading] = useState(true)
  // Períodos arquivados (histórico congelado): mes "YYYY-MM" → snapshot + data.
  const [arquivados, setArquivados] = useState<Map<string, { snapshot: Record<string, unknown>; arquivadoEm: string | null }>>(new Map())
  const [arquivDisponivel, setArquivDisponivel] = useState(true) // false = migration 090 não rodada
  const [arquivando, setArquivando] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [culturaOpen, setCulturaOpen] = useState(false)
  const [movTipo, setMovTipo] = useState<TipoMov | null>(null)
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [fSquad, setFSquad] = useState('')
  const [fAM, setFAM] = useState('')
  const [fGestor, setFGestor] = useState('')
  // Fonte única de squads (tabela central em Configurações). Só ativos.
  const { squads: squadsReais } = useSquads()

  async function load() {
    setLoading(true)
    const [cRes, pRes, eRes, jRes] = await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('profiles').select('*').eq('ativo', true).eq('aprovado', true),
      // Eventos de movimento comercial — expansao, perda, churn.
      // Alimenta o bloco Resultado do Negocio.
      supabase
        .from('cliente_eventos')
        .select('tipo, cliente_id, criado_em, meta')
        .in('tipo', ['expansao', 'perda', 'churn']),
      // Eventos de jornada — pra medir o tempo medio de onboarding.
      supabase
        .from('cliente_eventos')
        .select('cliente_id, criado_em, meta')
        .eq('tipo', 'jornada'),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setProfiles((pRes.data as Profile[]) ?? [])
    setEventosMov((eRes.data as EventoMovimento[]) ?? [])
    setEventosJornada((jRes.data as EventoJornada[]) ?? [])
    setLoading(false)
    void loadArquivados()
  }

  // Carrega os períodos já arquivados (histórico congelado). Se a tabela não
  // existir (migration 090 não rodada), desativa o recurso sem quebrar a tela.
  async function loadArquivados() {
    const { data, error } = await supabase.from('resumo_periodos_arquivados').select('mes, snapshot, arquivado_em')
    if (error) {
      setArquivDisponivel(false)
      return
    }
    setArquivDisponivel(true)
    const m = new Map<string, { snapshot: Record<string, unknown>; arquivadoEm: string | null }>()
    for (const r of (data as { mes: string; snapshot: Record<string, unknown>; arquivado_em: string | null }[]) ?? []) {
      m.set(r.mes, { snapshot: r.snapshot, arquivadoEm: r.arquivado_em })
    }
    setArquivados(m)
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

  // Indicações reais por squad (coluna atual_indicacoes, migration 087) —
  // useSquads faz select('*'), então o valor vem no runtime.
  const indicacoesPorSquad = useMemo(
    () =>
      new Map(
        squadsReais.map((s) => [
          s.nome,
          Number((s as unknown as { atual_indicacoes?: number }).atual_indicacoes ?? 0),
        ]),
      ),
    [squadsReais],
  )

  const ams = useMemo(() => profiles.filter((p) => p.cargo === 'account_manager'), [profiles])
  const gestores = useMemo(() => profiles.filter((p) => p.cargo === 'gestor_trafego'), [profiles])

  const kpisLive = useMemo(() => {
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

    // Tempo medio de onboarding — dias entre data_inicio e o evento que
    // TIROU o cliente do onboarding (jornada: de='onboarding' -> outra).
    // So conta quem de fato concluiu; quem ainda esta em onboarding ou
    // entrou direto em outra jornada nao entra na media.
    const idsFiltrados = new Set(clientesFiltrados.map((c) => c.id))
    const inicioPorCliente = new Map(clientesFiltrados.map((c) => [c.id, c.data_inicio]))
    const primeiraSaida = new Map<string, string>()
    for (const ev of eventosJornada) {
      if (!idsFiltrados.has(ev.cliente_id)) continue
      if (ev.meta?.campo !== 'jornada') continue
      if (ev.meta?.de !== 'onboarding' || !ev.meta?.para || ev.meta.para === 'onboarding') continue
      const atual = primeiraSaida.get(ev.cliente_id)
      if (!atual || new Date(ev.criado_em) < new Date(atual)) {
        primeiraSaida.set(ev.cliente_id, ev.criado_em)
      }
    }
    const temposOnboarding: number[] = []
    for (const [id, saida] of primeiraSaida) {
      const dias = diasEntre(inicioPorCliente.get(id) ?? null, saida)
      if (dias > 0) temposOnboarding.push(dias)
    }
    const tempoMedioOnboarding =
      temposOnboarding.length > 0
        ? Math.round(temposOnboarding.reduce((a, b) => a + b, 0) / temposOnboarding.length)
        : null
    const nOnboardingConcluido = temposOnboarding.length

    const clientesComNps = ativos.filter((c) => typeof c.nps === 'number')
    const npsMedio =
      clientesComNps.length > 0
        ? clientesComNps.reduce((s, c) => s + (c.nps ?? 0), 0) / clientesComNps.length
        : null

    // Tempo medio de vida — media dos meses de casa (inteiros, mes em
    // curso conta), arredondada pra meses inteiros tambem.
    const vidasAtivos = ativos
      .map((c) => mesesDesde(c.data_inicio))
      .filter((v) => v > 0)
    const tempoMedioVida =
      vidasAtivos.length > 0
        ? Math.max(1, Math.round(vidasAtivos.reduce((a, b) => a + b, 0) / vidasAtivos.length))
        : 0

    // LTV medio = ticket medio x meses inteiros
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
      // Listas pro modal de movimentacoes (click na linha do Resultado)
      expansoesLista: expansoes,
      perdasLista: perdas,
      churnsEvLista: churnsExplicitos,
      churnsClientesLista: churnsNoMes,
      emOnboarding,
      pctOnboardingFinalizado,
      tempoMedioOnboarding,
      nOnboardingConcluido,
      npsMedio,
      tempoMedioVida,
      ltvMedio,
    }
  }, [clientesFiltrados, mesISO, eventosMov, eventosJornada])

  // Se o mês está arquivado, os números vêm do snapshot CONGELADO (não do
  // cálculo em tempo real) — assim o histórico não se altera. A forma do
  // objeto é a mesma, então todo o resto da tela renderiza sem mudança.
  const mesRef = mesISO.slice(0, 7)
  const arquivoDoMes = arquivados.get(mesRef)
  const arquivado = !!arquivoDoMes
  const kpis = (arquivoDoMes?.snapshot as typeof kpisLive) ?? kpisLive
  // Mês encerrado (passado) e ainda não arquivado → pode arquivar.
  const podeArquivar = !eMesAtual && !arquivado

  async function arquivarMes() {
    if (!arquivDisponivel) {
      alert('Rode a migration 090 no Supabase para habilitar o arquivamento de períodos.')
      return
    }
    setArquivando(true)
    const { error } = await supabase
      .from('resumo_periodos_arquivados')
      .upsert({ mes: mesRef, snapshot: kpisLive as unknown as Record<string, unknown>, arquivado_em: new Date().toISOString() })
    setArquivando(false)
    if (error) {
      alert('Não foi possível arquivar: ' + error.message)
      return
    }
    await loadArquivados()
  }

  // Exportar = imprimir só as métricas. Aplica o tema light e usa @media print
  // (esconde sidebar/topbar/controles) — o PDF sai limpo com os mesmos números
  // da tela. Restaura o tema depois de imprimir.
  function exportarPDF() {
    const html = document.documentElement
    const prev = html.classList.contains('light') ? 'light' : html.classList.contains('dark') ? 'dark' : ''
    html.classList.remove('dark', 'light')
    html.classList.add('light')
    const restaurar = () => {
      html.classList.remove('light', 'dark')
      if (prev) html.classList.add(prev)
      window.removeEventListener('afterprint', restaurar)
    }
    window.addEventListener('afterprint', restaurar)
    window.print()
    setTimeout(restaurar, 1500)
  }

  // Farol do banner de alerta — dispara quando qualquer meta comercial
  // e' quebrada. Metas fixadas pelo user:
  //   NRR   >= 95%   (abaixo = nao esta crescendo)
  //   Churn <  10%   (acima = meta nao atingida)
  const temAlerta =
    kpis.nrr < 0.95 || kpis.churnRate >= 0.1 || kpis.saldo < 0 || kpis.emRisco > 0

  return (
    <div>
      <PageHeader
        title="Resumo Geral"
        description="Visão executiva da saúde da operação"
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {arquivado && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300">
                <CheckCircle2 size={13} /> Período Arquivado
              </span>
            )}
            {podeArquivar && (
              <Button variant="outline" onClick={arquivarMes} disabled={arquivando}>
                <Archive size={14} /> {arquivando ? 'Arquivando…' : 'Arquivar Período'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setCulturaOpen(true)}>
              <BookOpen size={14} /> Código de Cultura
            </Button>
            <Button variant="outline" onClick={exportarPDF}>
              <Download size={14} /> Exportar
            </Button>
          </div>
        }
      />

      {/* Cabeçalho só na impressão (contexto do relatório) */}
      <p className="mb-3 hidden text-[11px] text-zinc-500 print:block">
        Resumo Geral · {labelMes(mesISO).replace(/^./, (c) => c.toUpperCase())} · gerado em {fmtDataHora(new Date().toISOString())}
      </p>

      {/* Filtros */}
      <FilterBar className="mb-4 print:hidden">
        <FilterPill
          value={mesISO}
          onChange={(v) => setMesISO(v)}
          options={ultimosMeses(12).map((iso) => ({
            value: iso,
            label: labelMes(iso).replace(/^./, (c) => c.toUpperCase()),
          }))}
        />
        <FilterPill value={fSquad} onChange={setFSquad} placeholder="Todos os Squads" options={squadsReais.map((s) => ({ value: s.nome, label: s.nome }))} />
        <FilterPill value={fAM} onChange={setFAM} placeholder="Todos os AMs" options={ams.map((p) => ({ value: p.id, label: p.nome }))} />
        <FilterPill value={fGestor} onChange={setFGestor} placeholder="Todos os Gestores" options={gestores.map((p) => ({ value: p.id, label: p.nome }))} />
      </FilterBar>

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : (
        <>
          {/* Banner de estado do período: arquivado (congelado) / mês atual
              (tempo real) / mês encerrado a arquivar. */}
          {arquivado ? (
            <div className="mb-3 rounded-xl border border-green-500/40 bg-green-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-green-300" />
                <p className="text-xs font-semibold text-green-200">
                  Período Arquivado
                  <span className="ml-2 rounded border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-[10px] uppercase text-green-300">
                    Histórico Congelado
                  </span>
                </p>
              </div>
              <p className="mt-1 text-[11px] text-green-300/80">
                Dados de {labelMes(mesISO)} foram arquivados{arquivoDoMes?.arquivadoEm ? ` em ${fmtDataHora(arquivoDoMes.arquivadoEm)}` : ''}. Estes valores são históricos e não serão alterados.
              </p>
            </div>
          ) : eMesAtual ? (
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
          ) : podeArquivar ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3">
              <div className="flex items-start gap-2">
                <Archive size={14} className="mt-0.5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-xs font-semibold text-amber-200">Mês encerrado</p>
                  <p className="mt-0.5 text-[11px] text-amber-300/80">
                    {labelMes(mesISO)} já terminou. Arquive para <strong>congelar</strong> estas métricas e preservar o histórico — depois disso os valores não mudam mais.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={arquivarMes} disabled={arquivando} className="shrink-0 print:hidden">
                <Archive size={14} /> {arquivando ? 'Arquivando…' : 'Arquivar Período'}
              </Button>
            </div>
          ) : null}

          {/* Farol rapido — NRR / Churn Rate / Saldo / Risco.
              Verde = dentro da meta, vermelho = fora. Sempre visivel;
              a moldura so fica vermelha quando algo esta fora. */}
          <div
            className={cn(
              'mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2',
              temAlerta ? 'border-red-500/40 bg-red-500/[0.06]' : 'border-border bg-bg-card',
            )}
          >
            {temAlerta && <AlertTriangle size={13} className="mr-1 text-red-300" />}
            <Farol ok={kpis.nrr >= 0.95} label="NRR" valor={formatPct(kpis.nrr)} />
            <Farol ok={kpis.churnRate < 0.1} label="Churn Rate" valor={formatPct(kpis.churnRate)} />
            <Farol ok={kpis.saldo >= 0} label="Saldo" valor={formatBRLSigned(kpis.saldo)} />
            <Farol
              ok={kpis.emRisco === 0}
              label="Risco"
              valor={kpis.emRisco === 0 ? '0' : `${kpis.emRisco} · ${formatBRL(kpis.mrrRisco)}`}
            />
          </div>

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
                tone={kpis.nrr >= 0.95 ? 'emerald' : kpis.nrr >= 0.9 ? 'amber' : 'red'}
              />
              <SubKpi
                titulo="Churn Rate"
                valor={formatPct(kpis.churnRate)}
                tone={kpis.churnRate < 0.05 ? 'emerald' : kpis.churnRate < 0.1 ? 'amber' : 'red'}
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
                  onClick={kpis.nExpansoes > 0 ? () => setMovTipo('expansao') : undefined}
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
                  onClick={kpis.nPerdas > 0 ? () => setMovTipo('perda') : undefined}
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
                  onClick={
                    kpis.churnsNoMes > 0 || kpis.nChurnEventos > 0
                      ? () => setMovTipo('churn')
                      : undefined
                  }
                />
              </div>
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
                titulo="Tempo Médio Onboarding"
                valor={
                  kpis.tempoMedioOnboarding !== null
                    ? `${kpis.tempoMedioOnboarding} ${kpis.tempoMedioOnboarding === 1 ? 'dia' : 'dias'}`
                    : 'sem dado'
                }
                sub={
                  kpis.tempoMedioOnboarding !== null
                    ? `SLA: ${SLA_ONBOARDING_DIAS} dias · ${kpis.nOnboardingConcluido} ${kpis.nOnboardingConcluido === 1 ? 'concluído' : 'concluídos'}`
                    : 'nenhum onboarding concluído'
                }
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
                valor={mesesLabel(kpis.tempoMedioVida)}
                sub={`${kpis.ativos} clientes ativos`}
                grande
              />
            </div>
          </div>

          {/* Evolucao de Clientes */}
          <EvolucaoClientes clientes={clientesFiltrados} />

          {/* Score e Saude por Squad */}
          <ScoreSaudeSquads
            clientes={clientesFiltrados}
            mesISO={mesISO}
            squadsAtivos={squadsReais.map((s) => s.nome)}
            fSquad={fSquad}
            indicacoesPorSquad={indicacoesPorSquad}
            eventosMov={eventosMov}
          />

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
        </>
      )}

      <CodigoCulturaModal open={culturaOpen} onClose={() => setCulturaOpen(false)} />

      {movTipo && (
        <MovimentacoesModal
          tipo={movTipo}
          mesLabel={labelMes(mesISO)}
          eventos={
            movTipo === 'expansao'
              ? kpis.expansoesLista
              : movTipo === 'perda'
                ? kpis.perdasLista
                : kpis.churnsEvLista
          }
          churnsClientes={kpis.churnsClientesLista}
          clientes={clientesFiltrados}
          onClose={() => setMovTipo(null)}
        />
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

/** Pill do farol: ponto verde/vermelho + label + valor compacto. */
function Farol({ ok, label, valor }: { ok: boolean; label: string; valor: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
        ok
          ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300'
          : 'border-red-500/40 bg-red-500/10 text-red-300',
      )}
      title={ok ? 'Dentro da meta' : 'Fora da meta'}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-red-400')} />
      {label}
      <span className="normal-case tracking-normal tabular-nums opacity-80">{valor}</span>
    </span>
  )
}

function SubKpi({
  titulo,
  valor,
  tone,
  sub,
}: {
  titulo: string
  valor: string
  tone: Tone
  sub?: string
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{titulo}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums leading-none', toneText[tone])}>
        {valor}
      </p>
      {sub && <p className="mt-1.5 text-[9px] uppercase tracking-wider text-muted">{sub}</p>}
    </div>
  )
}

function LinhaResultado({
  icone,
  label,
  valor,
  tone,
  sub,
  onClick,
}: {
  icone: React.ReactNode
  label: string
  valor: number
  tone: 'emerald' | 'amber' | 'red'
  sub?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      title={onClick ? 'Ver movimentações' : undefined}
      className={cn(
        'flex items-center justify-between rounded-md border border-border bg-bg-soft/40 px-3 py-2 transition-colors',
        onClick && 'cursor-pointer hover:border-border/60 hover:bg-bg-elev',
      )}
    >
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
                    className="stroke-border"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={padL - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    className="fill-muted"
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
                    className="fill-muted"
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
// Modal — movimentacoes de um tipo (expansao / reducao / churn) no mes
// ==============================================================
//
// Abre ao clicar numa linha do Resultado do Negocio. Lista cada
// registro com cliente (link pra Ficha), data, valor e motivo. Churn
// sem evento explicito cai nos clientes arquivados no mes.

function MovimentacoesModal({
  tipo,
  mesLabel,
  eventos,
  churnsClientes,
  clientes,
  onClose,
}: {
  tipo: TipoMov
  mesLabel: string
  eventos: EventoMovimento[]
  churnsClientes: Cliente[]
  clientes: Cliente[]
  onClose: () => void
}) {
  const cfg = {
    expansao: {
      titulo: 'Expansões',
      sinal: '+',
      texto: 'text-emerald-300',
      borda: 'border-emerald-500/30',
      hover: 'hover:bg-emerald-500/10',
    },
    perda: {
      titulo: 'Reduções',
      sinal: '−',
      texto: 'text-amber-300',
      borda: 'border-amber-500/30',
      hover: 'hover:bg-amber-500/10',
    },
    churn: {
      titulo: 'Churns',
      sinal: '−',
      texto: 'text-red-300',
      borda: 'border-red-500/30',
      hover: 'hover:bg-red-500/10',
    },
  }[tipo]

  const nomeDe = (id: string) => clientes.find((c) => c.id === id)?.nome ?? '—'

  const linhas =
    tipo === 'churn' && eventos.length === 0
      ? churnsClientes.map((c) => ({
          key: c.id,
          clienteId: c.id,
          nome: c.nome,
          data: c.arquivado_em ?? '',
          valor: c.verba_mensal ?? 0,
          motivo: null as string | null,
          recorrente: true,
        }))
      : eventos.map((ev, i) => ({
          key: `${ev.cliente_id}-${i}`,
          clienteId: ev.cliente_id,
          nome: nomeDe(ev.cliente_id),
          data: ev.meta?.data ?? ev.criado_em,
          valor: tipo === 'churn' ? (ev.meta?.valor_perdido ?? 0) : (ev.meta?.valor ?? 0),
          motivo: ev.meta?.motivo ?? null,
          recorrente: ev.meta?.recorrente !== false,
        }))
  linhas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  const total = linhas.reduce((s, l) => s + l.valor, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">
            {cfg.titulo} — {mesLabel}
          </h3>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
            aria-label="Fechar"
          >
            <XCircle size={12} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          {linhas.length} {linhas.length === 1 ? 'registro' : 'registros'} ·{' '}
          <span className={cn('font-semibold tabular-nums', cfg.texto)}>
            {cfg.sinal}
            {formatBRL(total)}
          </span>
          /mês
        </p>

        {linhas.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-muted italic">Nenhum registro no mês</p>
        ) : (
          <div className={cn('overflow-hidden rounded-lg border', cfg.borda)}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">Motivo</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.key} className={cn('border-b border-border/60 transition-colors', cfg.hover)}>
                    <td className="px-3 py-2">
                      <a
                        href={`/clientes/${l.clienteId}`}
                        className="inline-flex items-center gap-1 text-zinc-200 hover:text-brand-300"
                      >
                        <span className="truncate">{l.nome}</span>
                        <ExternalLink size={10} className="shrink-0 opacity-60" />
                      </a>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">{formatDataCurta(l.data)}</td>
                    <td className="px-3 py-2 text-muted">
                      {l.motivo ?? '—'}
                      {!l.recorrente && (
                        <span className="ml-1.5 rounded border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider">
                          pontual
                        </span>
                      )}
                    </td>
                    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', cfg.texto)}>
                      {cfg.sinal}
                      {formatBRL(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  mrrMes: number // MRR reconstruido do mes (base do NRR e da comparacao MoM)
  nrr: number
  churnsCount: number
  emRiscoCount: number
  revChurn: number
  indicacoes: number
  score: number
  badges: { label: string; positive: boolean }[]
  classificacao: 'critico' | 'atencao' | 'saudavel'
}

// Comparacao mes-a-mes de um squad. temAnterior=false quando nao ha base
// do mes anterior (ou MRR anterior = 0) — nesse caso a UI mostra "—".
interface ComparacaoMoM {
  temAnterior: boolean
  mrrDelta: number
  mrrDeltaPct: number
  scoreDelta: number
  mesLabel: string
  mesAntLabel: string
}

function calculaScoreSquads(
  clientes: Cliente[],
  mesISO: string,
  mrrMedioSquad: number,
  squadsAtivos: string[],
  incluirSemSquad: boolean,
  indicacoesPorSquad: Map<string, number>,
  eventosMov: EventoMovimento[],
): ScoreSquad[] {
  const [y, m] = mesISO.split('-').map(Number)
  const inicioMes = new Date(y, m - 1, 1)
  const fimMes = new Date(y, m, 0, 23, 59, 59)

  const byNome = new Map<string, Cliente[]>()
  for (const c of clientes) {
    const nome = c.squad ?? '(sem squad)'
    if (!byNome.has(nome)) byNome.set(nome, [])
    byNome.get(nome)!.push(c)
  }

  // Um card por squad ATIVO cadastrado (mesmo sem clientes) + "(sem squad)"
  // quando há clientes sem squad. Squads inativos não entram. A fonte é a
  // lista central (useSquads), nunca nomes hardcoded.
  const nomesAlvo = [...squadsAtivos]
  if (incluirSemSquad && byNome.has('(sem squad)')) nomesAlvo.push('(sem squad)')

  const resultados: ScoreSquad[] = []
  for (const nome of Array.from(new Set(nomesAlvo))) {
    const lista = byNome.get(nome) ?? []
    const ativos = lista.filter((c) => c.status === 'ativo' && !c.arquivado_em)
    const emRisco = lista.filter((c) => c.status === 'atencao' && !c.arquivado_em)
    const churnsNoMes = lista.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    })

    const mrr = ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const revChurn = churnsNoMes.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)

    // NRR com expansao — pode passar de 100%. Puxa os eventos de movimento
    // comercial DAQUELE squad no mes (prioriza meta.data, cai pra criado_em).
    const squadClienteIds = new Set(lista.map((c) => c.id))
    const eventosDoMes = eventosMov.filter((ev) => {
      if (!squadClienteIds.has(ev.cliente_id)) return false
      const d = new Date(ev.meta?.data ?? ev.criado_em)
      return d >= inicioMes && d <= fimMes
    })
    const expansao = eventosDoMes
      .filter((ev) => ev.tipo === 'expansao')
      .reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)
    const reducao = eventosDoMes
      .filter((ev) => ev.tipo === 'perda')
      .reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)
    const churnsEv = eventosDoMes.filter((ev) => ev.tipo === 'churn')
    // Churn perdido = soma dos eventos tipo 'churn'; sem eventos, cai pro
    // rev churn reconstruido de arquivado_em (retrocompativel).
    const churnPerdido =
      churnsEv.length > 0
        ? churnsEv.reduce((s, ev) => s + (ev.meta?.valor_perdido ?? 0), 0)
        : revChurn

    // mrrInicio = MRR do mes reconstruido. NRR = (inicio + exp - red - churn)
    // / inicio; se inicio=0, NRR=1 (evita divisao por zero).
    const mrrMes = mrrSquadNoMes(lista, mesISO)
    const nrr = mrrMes > 0 ? (mrrMes + expansao - reducao - churnPerdido) / mrrMes : 1

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
    // Indicações — valor real do squad (atual_indicacoes na tabela squads,
    // editável no Painel de Metas). Com indicação = +1; sem = -1.
    const indicacoes = indicacoesPorSquad.get(nome) ?? 0
    if (indicacoes > 0) {
      score += 1
      badges.push({ label: `+1 Indicações`, positive: true })
    } else {
      score -= 1
      badges.push({ label: '-1 Sem indic.', positive: false })
    }

    const classificacao: 'critico' | 'atencao' | 'saudavel' =
      score <= 0 ? 'critico' : score <= 4 ? 'atencao' : 'saudavel'

    resultados.push({
      nome,
      clientes: lista,
      mrr,
      mrrMes,
      nrr,
      churnsCount: churnsNoMes.length,
      emRiscoCount: emRisco.length,
      revChurn,
      indicacoes,
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

function ScoreSaudeSquads({
  clientes,
  mesISO,
  squadsAtivos,
  fSquad,
  indicacoesPorSquad,
  eventosMov,
}: {
  clientes: Cliente[]
  mesISO: string
  squadsAtivos: string[]
  fSquad: string
  indicacoesPorSquad: Map<string, number>
  eventosMov: EventoMovimento[]
}) {
  const { squads, comparacoes } = useMemo(() => {
    // Fonte dos cards = squads ativos (tabela central). Respeita o filtro de
    // squad selecionado; sem filtro, mostra todos os ativos + "(sem squad)".
    const nomesAlvo = fSquad ? [fSquad] : squadsAtivos
    const incluirSemSquad = !fSquad
    const nQtd = nomesAlvo.length || 1
    const mrrTotal = clientes
      .filter((c) => c.status === 'ativo' && !c.arquivado_em)
      .reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrMedioSquad = mrrTotal / nQtd
    const atual = calculaScoreSquads(
      clientes,
      mesISO,
      mrrMedioSquad,
      nomesAlvo,
      incluirSemSquad,
      indicacoesPorSquad,
      eventosMov,
    )

    // Roda o mesmo calculo pro mes anterior pra montar a comparacao MoM.
    const mesAnt = shiftMes(mesISO, -1)
    const anterior = calculaScoreSquads(
      clientes,
      mesAnt,
      mrrMedioSquad,
      nomesAlvo,
      incluirSemSquad,
      indicacoesPorSquad,
      eventosMov,
    )
    const mapAnt = new Map(anterior.map((s) => [s.nome, { score: s.score, mrrMes: s.mrrMes }]))

    const mesLabel = labelMesCurto(mesISO)
    const mesAntLabel = labelMesCurto(mesAnt)
    const comps = new Map<string, ComparacaoMoM>()
    for (const sq of atual) {
      const ant = mapAnt.get(sq.nome)
      const temAnterior = !!ant && ant.mrrMes > 0
      const mrrDelta = temAnterior ? sq.mrrMes - ant!.mrrMes : 0
      const mrrDeltaPct = temAnterior && ant!.mrrMes > 0 ? mrrDelta / ant!.mrrMes : 0
      const scoreDelta = temAnterior ? sq.score - ant!.score : 0
      comps.set(sq.nome, { temAnterior, mrrDelta, mrrDeltaPct, scoreDelta, mesLabel, mesAntLabel })
    }
    return { squads: atual, comparacoes: comps }
  }, [clientes, mesISO, squadsAtivos, fSquad, indicacoesPorSquad, eventosMov])

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
          <SquadCard key={sq.nome} squad={sq} comparacao={comparacoes.get(sq.nome)!} />
        ))}
      </div>
    </div>
  )
}

function SquadCard({ squad, comparacao }: { squad: ScoreSquad; comparacao: ComparacaoMoM }) {
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

  // Pill neutro reutilizado quando nao ha base do mes anterior.
  const pillNeutro = 'border-border bg-bg-elev text-muted'

  // Δ MRR (vs mes anterior)
  const mrrUp = comparacao.temAnterior && comparacao.mrrDelta > 0
  const mrrDown = comparacao.temAnterior && comparacao.mrrDelta < 0
  const MrrIcon = mrrUp ? ArrowUpRight : mrrDown ? ArrowDownRight : Minus
  const mrrPillCls = mrrUp
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : mrrDown
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : pillNeutro
  const mrrTexto = comparacao.temAnterior
    ? `${formatBRLSigned(comparacao.mrrDelta)} MRR (${comparacao.mrrDeltaPct > 0 ? '+' : ''}${(comparacao.mrrDeltaPct * 100).toFixed(1)}%)`
    : '— MRR'

  // Δ Score (vs mes anterior)
  const scoreUp = comparacao.temAnterior && comparacao.scoreDelta > 0
  const scoreDown = comparacao.temAnterior && comparacao.scoreDelta < 0
  const scorePillCls = scoreUp
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : scoreDown
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : pillNeutro
  const scoreTexto = comparacao.temAnterior
    ? `${comparacao.scoreDelta > 0 ? '+' : ''}${comparacao.scoreDelta} pts Score`
    : '— Score'

  // NRR — pode passar de 100%. Barra verde quando >= 100% da meta.
  const nrrPct = squad.nrr * 100
  const nrrGood = squad.nrr >= 1
  const nrrWarn = squad.nrr >= 0.9
  const nrrValCls = nrrGood ? 'text-emerald-300' : nrrWarn ? 'text-amber-300' : 'text-red-300'
  const nrrBarCls = nrrGood ? 'bg-emerald-400' : nrrWarn ? 'bg-amber-400' : 'bg-red-400'
  const nrrBarW = Math.max(0, Math.min(100, nrrPct))
  const nrrSub = nrrGood
    ? 'Meta de retenção atingida'
    : `Faltam ${(100 - nrrPct).toFixed(1)}pp para 100%`

  // Rev. Churn — barra vermelha proporcional ao % do MRR.
  const base = squad.clientes.length
  const revPct = squad.mrr + squad.revChurn > 0 ? (squad.revChurn / (squad.mrr + squad.revChurn)) * 100 : 0
  const revSub = squad.revChurn === 0 ? 'Sem perda de receita' : `${revPct.toFixed(1)}% do MRR`
  const churnSub =
    squad.churnsCount === 0
      ? 'Nenhum cliente perdido'
      : `${base > 0 ? ((squad.churnsCount / base) * 100).toFixed(1) : '0'}% da base`
  const indSub =
    squad.indicacoes > 0
      ? `${base > 0 ? Math.round((squad.indicacoes / base) * 100) : 0}% da base indicou`
      : 'Nenhuma indicação registrada'

  return (
    <div className={cn('rounded-xl border bg-bg-card p-5', cls)}>
      {/* Header + badge de score */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-zinc-100">{squad.nome}</h4>
          <p className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-muted">
            <Users size={11} />
            {squad.clientes.length} clientes · {formatBRL(squad.mrr)} MRR
          </p>
        </div>
        <div className={cn('flex shrink-0 flex-col items-center rounded-lg border px-3 py-1.5', scoreCls)}>
          <span className="text-2xl font-bold leading-none tabular-nums">
            {squad.score > 0 ? '+' : ''}
            {squad.score}
          </span>
          <span className="mt-1 text-[9px] uppercase tracking-wider opacity-60">de 8</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide">{classLabel}</span>
        </div>
      </div>

      {/* Comparacao com o mes anterior */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
          {comparacao.mesLabel} vs {comparacao.mesAntLabel}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
            mrrPillCls,
          )}
        >
          <MrrIcon size={10} />
          {mrrTexto}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
            scorePillCls,
          )}
        >
          {scoreTexto}
        </span>
      </div>

      {/* Progress bar 3 zonas */}
      <div className="relative h-2 overflow-hidden rounded-full bg-bg-elev">
        <div className="absolute inset-0 flex">
          <div className="w-1/3 bg-red-500/20" />
          <div className="w-1/3 bg-amber-500/20" />
          <div className="w-1/3 bg-emerald-500/20" />
        </div>
        <div
          className={cn(
            'absolute top-0 h-full w-1 rounded transition-all duration-300',
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
      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-border pt-4">
        {/* NRR */}
        <div className="flex flex-col rounded-lg border border-border/60 bg-bg-elev/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
              <TrendingUp size={11} /> NRR
            </span>
            <span className={cn('text-xs font-semibold tabular-nums', nrrValCls)}>{nrrPct.toFixed(1)}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-card">
            <div
              className={cn('h-full rounded-full transition-all duration-300', nrrBarCls)}
              style={{ width: `${nrrBarW}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted">{nrrSub}</p>
        </div>

        {/* Logo Churn */}
        <div className="flex flex-col rounded-lg border border-border/60 bg-bg-elev/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
              <Users size={11} /> Logo Churn
            </span>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                squad.churnsCount === 0 ? 'text-emerald-300' : 'text-red-300',
              )}
            >
              {squad.churnsCount}
            </span>
          </div>
          <p className="mt-auto pt-1.5 text-[10px] text-muted">{churnSub}</p>
        </div>

        {/* Rev. Churn */}
        <div className="flex flex-col rounded-lg border border-border/60 bg-bg-elev/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
              <DollarSign size={11} /> Rev. Churn
            </span>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                squad.revChurn > 0 ? 'text-red-300' : 'text-emerald-300',
              )}
            >
              {formatBRL(squad.revChurn)}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-card">
            <div
              className="h-full rounded-full bg-red-400 transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, revPct))}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted">{revSub}</p>
        </div>

        {/* Indicações */}
        <div className="flex flex-col rounded-lg border border-border/60 bg-bg-elev/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
              <Share2 size={11} /> Indicações
            </span>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                squad.indicacoes > 0 ? 'text-emerald-300' : 'text-muted',
              )}
            >
              {squad.indicacoes}
            </span>
          </div>
          <p className="mt-auto pt-1.5 text-[10px] text-muted">{indSub}</p>
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
