/**
 * Painel do Head de Tráfego — visão de TODAS as contas com status de saúde
 * (Estável / Instável / Crítica) e cadência de verificação obrigatória.
 *
 * Regra de cadência:
 *   - Estável  → 1x por semana (≥ 1 verificação na semana corrente)
 *   - Instável → 2x por semana
 *   - Crítica  → 3x por semana
 *
 * Modelo de plataformas (Opção C):
 *   - Cliente pode rodar em mais de uma plataforma (Meta + Google + etc)
 *   - Cada plataforma tem SEU PRÓPRIO status de saúde (cliente_saude_plataforma)
 *   - Status "geral" do cliente = pior das plataformas (cache em clientes,
 *     atualizado por trigger)
 *   - Verificações são REGISTRADAS POR PLATAFORMA (verificacoes_conta)
 *   - Cadência semanal usa o pior status (worst-case)
 *
 * Métricas (leads/CPL/verba) são preenchidas MANUALMENTE pelo head no modal
 * de edição de plataforma (a editar nas próximas fases).
 *
 * Migrations: 043-controle-head-base.sql.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Cliente,
  ClienteSaudePlataforma,
  PlataformaTrafego,
  Profile,
  StatusPlanoAcao,
  StatusSaudeConta,
  VerificacaoConta,
} from '@/types/database'
import {
  Search,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  ClipboardList,
  X,
  Info,
  UserPlus,
  Download,
  FileText,
  Pencil,
  Trash2,
  PlusCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import {
  downloadRelatorioDiarioPDF,
  downloadRelatorioSemanalPDF,
} from '@/components/trafego/ControleHeadPDF'

// =========================================================
// Tipos (re-exporta dos types globais pra ergonomia local)
// =========================================================

type StatusConta = StatusSaudeConta
type StatusPlano = StatusPlanoAcao
type Plataforma = PlataformaTrafego

const PLATAFORMAS: Plataforma[] = ['meta_ads', 'google_ads', 'tiktok_ads', 'youtube_ads']

const plataformaLabel: Record<Plataforma, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  youtube_ads: 'YouTube Ads',
}

/** Cor de identidade visual de cada plataforma (usada nos badges). */
const plataformaCor: Record<Plataforma, string> = {
  meta_ads: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  google_ads: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  tiktok_ads: 'bg-pink-500/15 text-pink-300 border-pink-500/40',
  youtube_ads: 'bg-red-500/15 text-red-300 border-red-500/40',
}

/**
 * SLA do Controle do Head — 3 dimensões pra cada nível:
 *   1. Cadência mínima por semana
 *   2. Intervalo máximo (em dias corridos) entre verificações
 *   3. Prazo (em dias úteis) pra concluir um plano de ação após registrado
 *
 * Mudar aqui propaga pra UI inteira + PDF.
 */
const SLA: Record<
  StatusConta,
  { cadenciaSemana: number; intervaloMaxDias: number; prazoPlanoDiasUteis: number }
> = {
  estavel: { cadenciaSemana: 1, intervaloMaxDias: 10, prazoPlanoDiasUteis: 14 },
  instavel: { cadenciaSemana: 2, intervaloMaxDias: 5, prazoPlanoDiasUteis: 7 },
  critico: { cadenciaSemana: 3, intervaloMaxDias: 3, prazoPlanoDiasUteis: 3 },
}

/** Atalho mantido por compatibilidade visual (cadência por status). */
const META_SEMANAL: Record<StatusConta, number> = {
  estavel: SLA.estavel.cadenciaSemana,
  instavel: SLA.instavel.cadenciaSemana,
  critico: SLA.critico.cadenciaSemana,
}

/** Regras de escalonamento automático (em semanas). */
const ESCALONAMENTO = {
  semanasInstavelParaCritica: 3, // instável persistente vira crítica
  semanasCriticaParaDiretoria: 2, // crítica persistente notifica diretoria
}

const statusLabel: Record<StatusConta, string> = {
  estavel: 'Estável',
  instavel: 'Instável',
  critico: 'Crítica',
}

const statusCor: Record<
  StatusConta,
  { dot: string; bar: string; border: string; bg: string; text: string }
> = {
  estavel: {
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-500/70',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
  },
  instavel: {
    dot: 'bg-amber-400',
    bar: 'bg-amber-500/70',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
  critico: {
    dot: 'bg-red-400',
    bar: 'bg-red-500/70',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-300',
  },
}

const statusPlanoLabel: Record<StatusPlano, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

const statusPlanoTone: Record<StatusPlano, 'danger' | 'warning' | 'success'> = {
  aberto: 'danger',
  em_andamento: 'warning',
  concluido: 'success',
}

/**
 * Saúde + métricas de UMA plataforma do cliente (forma usada na UI).
 * Idêntico a ClienteSaudePlataforma mas com nomes mais curtos pra UI.
 */
interface PlataformaSaude {
  plataforma: Plataforma
  status: StatusConta
  leads_30d: number
  cpl: number
  verba_gasta: number
  verba_orcamento: number
  tendencia_pct: number
  observacao: string | null
}

/** Verificação na forma que a UI usa (campos planos pra render rápido). */
interface Verificacao {
  id: string
  data: string // ISO created_at
  plataforma: Plataforma
  problema: string
  plano_acao: string
  status_plano: StatusPlano
  autor: string // nome do autor (resolvido do profile)
  autor_id: string
}

/**
 * Forma agregada usada pela UI: 1 cliente com suas plataformas + verificações.
 * Carregado por load() a partir de clientes + cliente_saude_plataforma +
 * verificacoes_conta (migration 043).
 */
interface Conta {
  id: string
  nome: string
  nicho: string
  squad: string
  gestor: { nome: string; avatar_url?: string | null }
  plataformas: PlataformaSaude[]
  /** Histórico de verificações ordenado mais recente primeiro */
  verificacoes: Verificacao[]
  /** Quando a conta entrou no status_geral atual (pra detectar escalonamento) */
  status_geral_desde: string
}

// =========================================================
// Helpers
// =========================================================

/** Ordem de gravidade: critico > instavel > estavel */
const ordemStatus: Record<StatusConta, number> = { critico: 3, instavel: 2, estavel: 1 }

/** Pior status entre as plataformas (worst-case). */
function statusGeral(c: Conta): StatusConta {
  let pior: StatusConta = 'estavel'
  for (const p of c.plataformas) {
    if (ordemStatus[p.status] > ordemStatus[pior]) pior = p.status
  }
  return pior
}

function daysAgo(n: number, horaLocal = 12): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(horaLocal, 0, 0, 0)
  return d.toISOString()
}

function inicioDaSemana(): Date {
  const d = new Date()
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function verificacoesDaSemana(c: Conta): Verificacao[] {
  const seg = inicioDaSemana().getTime()
  return c.verificacoes.filter((v) => new Date(v.data).getTime() >= seg)
}

function ultimaVerificacao(c: Conta): Verificacao | null {
  return c.verificacoes[0] ?? null
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function labelDiasDesde(dias: number | null): string {
  if (dias === null) return 'Nunca verificada'
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return `${dias} dias atrás`
}

function formatDataHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function estaAtrasada(c: Conta): boolean {
  const meta = META_SEMANAL[statusGeral(c)]
  const feitas = verificacoesDaSemana(c).length
  if (feitas >= meta) return false
  const today = new Date()
  const diaSemana = today.getDay() === 0 ? 7 : today.getDay()
  const esperado = Math.floor((meta * diaSemana) / 7)
  return feitas < esperado
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ---- SLA ----

type StatusSLA = 'ok' | 'em_risco' | 'quebrado'

const ordemSLA: Record<StatusSLA, number> = { ok: 1, em_risco: 2, quebrado: 3 }

/** Conta dias úteis (seg-sex) entre duas datas (não inclui o dia inicial). */
function diasUteisEntre(start: Date, end: Date): number {
  const a = new Date(start)
  a.setHours(0, 0, 0, 0)
  const b = new Date(end)
  b.setHours(0, 0, 0, 0)
  if (b <= a) return 0
  let count = 0
  const cur = new Date(a)
  while (cur < b) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

interface AvaliacaoPlano {
  verifId: string
  diasUteisRestantes: number
  status: StatusSLA
}

interface AvaliacaoSLA {
  cadencia: { status: StatusSLA; feitas: number; meta: number }
  intervalo: { status: StatusSLA; diasDesdeUltima: number | null; limite: number }
  planos: AvaliacaoPlano[]
  /** Pior dos 3 indicadores acima */
  geral: StatusSLA
  /** Se a conta está em situação de escalonamento (instável→crítica ou crítica→diretoria) */
  escalonamento: 'nenhum' | 'sugere_critica' | 'notifica_diretoria'
}

function avaliarSLA(c: Conta): AvaliacaoSLA {
  const sg = statusGeral(c)
  const sla = SLA[sg]

  // 1. Cadência semanal
  const feitas = verificacoesDaSemana(c).length
  const cadencia: AvaliacaoSLA['cadencia'] = {
    feitas,
    meta: sla.cadenciaSemana,
    status:
      feitas >= sla.cadenciaSemana
        ? 'ok'
        : estaAtrasada(c)
          ? 'quebrado'
          : 'em_risco',
  }

  // 2. Intervalo máximo
  const ult = ultimaVerificacao(c)
  const dias = ult ? diasDesde(ult.data) : null
  let intervaloStatus: StatusSLA
  if (dias === null) {
    intervaloStatus = 'quebrado' // nunca verificada
  } else if (dias > sla.intervaloMaxDias) {
    intervaloStatus = 'quebrado'
  } else if (dias >= sla.intervaloMaxDias - 1) {
    intervaloStatus = 'em_risco'
  } else {
    intervaloStatus = 'ok'
  }
  const intervalo = {
    status: intervaloStatus,
    diasDesdeUltima: dias,
    limite: sla.intervaloMaxDias,
  }

  // 3. Prazo dos planos abertos
  const hoje = new Date()
  const planos: AvaliacaoPlano[] = c.verificacoes
    .filter((v) => v.status_plano !== 'concluido')
    .map((v) => {
      const diasUteisCorridos = diasUteisEntre(new Date(v.data), hoje)
      const restantes = sla.prazoPlanoDiasUteis - diasUteisCorridos
      let st: StatusSLA = 'ok'
      if (restantes < 0) st = 'quebrado'
      else if (restantes <= 1) st = 'em_risco'
      return { verifId: v.id, diasUteisRestantes: restantes, status: st }
    })

  // Geral = pior status entre as 3 dimensões
  let geral: StatusSLA = 'ok'
  const candidates: StatusSLA[] = [cadencia.status, intervalo.status, ...planos.map((p) => p.status)]
  for (const s of candidates) {
    if (ordemSLA[s] > ordemSLA[geral]) geral = s
  }

  // Escalonamento automático baseado em status_geral_desde
  let escalonamento: AvaliacaoSLA['escalonamento'] = 'nenhum'
  const desde = new Date(c.status_geral_desde)
  const diasNoStatus = Math.floor((hoje.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24))
  const semanasNoStatus = Math.floor(diasNoStatus / 7)
  if (sg === 'instavel' && semanasNoStatus >= ESCALONAMENTO.semanasInstavelParaCritica) {
    escalonamento = 'sugere_critica'
  } else if (sg === 'critico' && semanasNoStatus >= ESCALONAMENTO.semanasCriticaParaDiretoria) {
    escalonamento = 'notifica_diretoria'
  }

  return { cadencia, intervalo, planos, geral, escalonamento }
}

// =========================================================
// Carregamento do banco
// =========================================================

/** Mapeia ClienteSaudePlataforma (banco) → PlataformaSaude (UI). */
function csptoUI(p: ClienteSaudePlataforma): PlataformaSaude {
  return {
    plataforma: p.plataforma,
    status: p.status_saude,
    leads_30d: Number(p.leads_30d) || 0,
    cpl: Number(p.cpl) || 0,
    verba_gasta: Number(p.verba_gasta) || 0,
    verba_orcamento: Number(p.verba_orcamento) || 0,
    tendencia_pct: Number(p.tendencia_pct) || 0,
    observacao: p.observacao,
  }
}

/** Mapeia VerificacaoConta (banco) → Verificacao (UI), achatando autor. */
function verifToUI(v: VerificacaoConta & { autor?: { nome?: string } | null }): Verificacao {
  return {
    id: v.id,
    data: v.created_at,
    plataforma: v.plataforma,
    problema: v.problema,
    plano_acao: v.plano_acao,
    status_plano: v.status_plano,
    autor: v.autor?.nome ?? '—',
    autor_id: v.autor_id,
  }
}

/** Linha cliente vinda da query (com joins). */
interface ClienteRow {
  id: string
  nome: string
  nicho: string | null
  squad: string | null
  status_saude_geral: StatusSaudeConta | null
  status_geral_desde: string | null
  gestor: { nome: string; avatar_url: string | null } | null
  plataformas_saude: ClienteSaudePlataforma[] | null
  verificacoes:
    | (VerificacaoConta & { autor: { nome: string; avatar_url: string | null } | null })[]
    | null
}

/** Carrega clientes de tráfego com saúde + verificações em uma query. */
async function carregarContas(): Promise<Conta[]> {
  // Exclui churn/arquivados/onboarding (mesma regra das outras telas)
  const { data, error } = await supabase
    .from('clientes')
    .select(
      `id, nome, nicho, squad,
       status_saude_geral, status_geral_desde,
       gestor:profiles!gestor_id(nome, avatar_url),
       plataformas_saude:cliente_saude_plataforma(
         cliente_id, plataforma, status_saude, leads_30d, cpl,
         verba_gasta, verba_orcamento, tendencia_pct, observacao,
         updated_at, updated_by
       ),
       verificacoes:verificacoes_conta(
         id, cliente_id, plataforma, autor_id, problema, plano_acao,
         status_plano, created_at, updated_at,
         autor:profiles!autor_id(nome, avatar_url)
       )`,
    )
    .contains('modulos', ['trafego'])
    .is('arquivado_em', null)
    .neq('status', 'churn')
    .neq('jornada', 'onboarding')
    .order('nome')

  if (error) {
    console.error('[ControleHead] erro ao carregar contas:', error)
    return []
  }

  const rows = (data ?? []) as unknown as ClienteRow[]
  return rows
    // Só mostra contas que TEM pelo menos uma plataforma cadastrada
    // (cliente novo sem plataforma cadastrada some até o head adicionar)
    .filter((r) => (r.plataformas_saude ?? []).length > 0)
    .map<Conta>((r) => {
      const verifs = (r.verificacoes ?? [])
        .map(verifToUI)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      return {
        id: r.id,
        nome: r.nome,
        nicho: r.nicho ?? '—',
        squad: r.squad ?? '—',
        gestor: {
          nome: r.gestor?.nome ?? 'Sem gestor',
          avatar_url: r.gestor?.avatar_url ?? null,
        },
        plataformas: (r.plataformas_saude ?? []).map(csptoUI),
        verificacoes: verifs,
        status_geral_desde: r.status_geral_desde ?? new Date().toISOString(),
      }
    })
}

/** Cliente simples (id+nome+nicho+squad) pro picker de adicionar ao radar. */
interface ClienteSimples {
  id: string
  nome: string
  nicho: string | null
  squad: string | null
}

/** Lista todos os clientes de tráfego ativos (mesmo sem plataforma no radar). */
async function carregarClientesTrafego(): Promise<ClienteSimples[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, nicho, squad')
    .contains('modulos', ['trafego'])
    .is('arquivado_em', null)
    .neq('status', 'churn')
    .neq('jornada', 'onboarding')
    .order('nome')
  if (error) {
    console.error('[ControleHead] erro ao listar clientes:', error)
    return []
  }
  return (data ?? []) as ClienteSimples[]
}

// =========================================================
// Página
// =========================================================

export default function ControleHead() {
  const { profile } = useAuth()
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fGestor, setFGestor] = useState('')
  const [fPlataforma, setFPlataforma] = useState<Plataforma | ''>('')
  /** Filtro de SLA: '' = todos, 'quebrado' = só com SLA quebrado, 'em_risco' = só em risco */
  const [fSla, setFSla] = useState<'' | 'quebrado' | 'em_risco'>('')
  const [collapsed, setCollapsed] = useState<Record<StatusConta, boolean>>({
    critico: false,
    instavel: false,
    estavel: true,
  })
  const [registrarPara, setRegistrarPara] = useState<Conta | null>(null)
  // Estado de geração de PDF: 'diario' | 'semanal' | null
  // Bloqueia ambos os botões enquanto um está gerando (pdf() é assíncrono)
  const [gerandoPdf, setGerandoPdf] = useState<'diario' | 'semanal' | null>(null)

  // Fase 2B: gerenciamento de plataformas
  const [clientesTrafego, setClientesTrafego] = useState<ClienteSimples[]>([])
  /** Modal de editar/adicionar plataforma de UMA conta já no radar */
  const [gerenciarPlat, setGerenciarPlat] = useState<{
    contaId: string
    contaNome: string
    plataforma: PlataformaSaude | null // null = adicionar nova
    usadas: Plataforma[]
  } | null>(null)
  /** Modal de adicionar conta nova ao radar (escolhe cliente + plataforma) */
  const [adicionarConta, setAdicionarConta] = useState(false)

  /** Pode editar métricas? (head/diretoria/admin) — espelha a RLS */
  const podeEditar = useMemo(() => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    const cargos = [profile.cargo, ...(profile.cargos_extras ?? [])]
    return cargos.includes('head') || cargos.includes('diretoria')
  }, [profile])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setErro(null)
    try {
      const [arr, cli] = await Promise.all([carregarContas(), carregarClientesTrafego()])
      setContas(arr)
      setClientesTrafego(cli)
    } catch (e) {
      console.error(e)
      setErro('Erro ao carregar contas. Tente recarregar a página.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Refresh ao voltar pra aba (mantém em dia com mudanças de outros usuários)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  /** Upsert de uma plataforma (status + métricas). Trigger no banco recalcula o geral. */
  async function salvarPlataforma(
    clienteId: string,
    plataforma: Plataforma,
    dados: {
      status_saude: StatusConta
      leads_30d: number
      cpl: number
      verba_gasta: number
      verba_orcamento: number
      tendencia_pct: number
      observacao: string | null
    },
  ) {
    const { error } = await supabase.from('cliente_saude_plataforma').upsert(
      {
        cliente_id: clienteId,
        plataforma,
        ...dados,
        updated_by: profile?.id ?? null,
      },
      { onConflict: 'cliente_id,plataforma' },
    )
    if (error) {
      alert(`Erro ao salvar plataforma: ${error.message}`)
      return
    }
    setGerenciarPlat(null)
    setAdicionarConta(false)
    await load(true)
  }

  async function removerPlataforma(clienteId: string, plataforma: Plataforma) {
    if (!confirm(`Remover ${plataformaLabel[plataforma]} do radar dessa conta?`)) return
    const { error } = await supabase
      .from('cliente_saude_plataforma')
      .delete()
      .eq('cliente_id', clienteId)
      .eq('plataforma', plataforma)
    if (error) {
      alert(`Erro ao remover: ${error.message}`)
      return
    }
    await load(true)
  }

  const squads = useMemo(() => Array.from(new Set(contas.map((c) => c.squad))).sort(), [contas])
  const gestores = useMemo(
    () => Array.from(new Set(contas.map((c) => c.gestor.nome))).sort(),
    [contas],
  )

  /** SLA pré-computado por conta — reusado em filtros, KPIs e cards. */
  const slaPorConta = useMemo(() => {
    const m = new Map<string, AvaliacaoSLA>()
    for (const c of contas) m.set(c.id, avaliarSLA(c))
    return m
  }, [contas])

  const filtered = useMemo(() => {
    return contas.filter((c) => {
      if (fSquad && c.squad !== fSquad) return false
      if (fGestor && c.gestor.nome !== fGestor) return false
      if (fPlataforma && !c.plataformas.some((p) => p.plataforma === fPlataforma)) return false
      if (fSla) {
        const av = slaPorConta.get(c.id)!
        if (fSla === 'quebrado' && av.geral !== 'quebrado') return false
        if (fSla === 'em_risco' && av.geral === 'ok') return false
      }
      if (q) {
        const hay = `${c.nome} ${c.nicho} ${c.gestor.nome}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [contas, q, fSquad, fGestor, fPlataforma, fSla, slaPorConta])

  const grupos = useMemo(() => {
    const m: Record<StatusConta, Conta[]> = { critico: [], instavel: [], estavel: [] }
    for (const c of filtered) m[statusGeral(c)].push(c)
    return m
  }, [filtered])

  const kpis = useMemo(() => {
    const out = {
      estavel: { total: 0, no_prazo: 0 },
      instavel: { total: 0, no_prazo: 0 },
      critico: { total: 0, no_prazo: 0 },
      atrasadas: 0,
      planos_abertos: 0,
      sla_quebrado: 0,
      sla_em_risco: 0,
      escala_critica: 0,
      escala_diretoria: 0,
    }
    for (const c of filtered) {
      const s = statusGeral(c)
      out[s].total++
      if (verificacoesDaSemana(c).length >= META_SEMANAL[s]) out[s].no_prazo++
      if (estaAtrasada(c)) out.atrasadas++
      for (const v of c.verificacoes) {
        if (v.status_plano !== 'concluido') out.planos_abertos++
      }
      const av = slaPorConta.get(c.id)!
      if (av.geral === 'quebrado') out.sla_quebrado++
      else if (av.geral === 'em_risco') out.sla_em_risco++
      if (av.escalonamento === 'sugere_critica') out.escala_critica++
      if (av.escalonamento === 'notifica_diretoria') out.escala_diretoria++
    }
    return out
  }, [filtered, slaPorConta])

  async function registrarVerificacao(
    contaId: string,
    plataforma: Plataforma,
    problema: string,
    plano: string,
  ) {
    if (!profile?.id) return
    const { error } = await supabase.from('verificacoes_conta').insert({
      cliente_id: contaId,
      plataforma,
      autor_id: profile.id,
      problema,
      plano_acao: plano,
      status_plano: 'aberto',
    })
    if (error) {
      alert(`Erro ao registrar verificação: ${error.message}`)
      return
    }
    await load(true)
  }

  async function mudarStatusPlataforma(
    contaId: string,
    plat: Plataforma,
    novo: StatusConta,
  ) {
    // Trigger no banco recalcula status_saude_geral + reseta status_geral_desde
    const { error } = await supabase
      .from('cliente_saude_plataforma')
      .update({ status_saude: novo, updated_by: profile?.id ?? null })
      .eq('cliente_id', contaId)
      .eq('plataforma', plat)
    if (error) {
      alert(`Erro ao mudar status: ${error.message}`)
      return
    }
    await load(true)
  }

  async function mudarStatusPlano(
    _contaId: string,
    verifId: string,
    novo: StatusPlano,
  ) {
    const { error } = await supabase
      .from('verificacoes_conta')
      .update({ status_plano: novo })
      .eq('id', verifId)
    if (error) {
      alert(`Erro ao mudar status do plano: ${error.message}`)
      return
    }
    await load(true)
  }

  return (
    <div>
      <PageHeader
        title="Controle do Head de Tráfego"
        description={`${contas.length} contas no seu radar · cadência semanal de verificação`}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setGerandoPdf('diario')
                downloadRelatorioDiarioPDF(contas).finally(() => setGerandoPdf(null))
              }}
              disabled={gerandoPdf !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300 disabled:opacity-50"
              title="Baixar PDF com verificações registradas hoje"
            >
              <Download size={13} />
              {gerandoPdf === 'diario' ? 'Gerando…' : 'Relatório diário'}
            </button>
            <button
              type="button"
              onClick={() => {
                setGerandoPdf('semanal')
                downloadRelatorioSemanalPDF(contas).finally(() => setGerandoPdf(null))
              }}
              disabled={gerandoPdf !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300 disabled:opacity-50"
              title="Baixar PDF semanal com KPIs + contas críticas + verificações da semana"
            >
              <FileText size={13} />
              {gerandoPdf === 'semanal' ? 'Gerando…' : 'Relatório semanal'}
            </button>
            {podeEditar && (
              <button
                type="button"
                onClick={() => setAdicionarConta(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-500/50 bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-200 transition-colors hover:bg-brand-500/25"
                title="Colocar um cliente de tráfego no radar adicionando uma plataforma"
              >
                <PlusCircle size={13} />
                Adicionar ao radar
              </button>
            )}
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300"
              title="Cadastrar um cliente NOVO (que ainda não existe na base)"
            >
              <UserPlus size={13} />
              Cadastrar cliente
            </Link>
          </div>
        }
      />

      {/* Erro de carga */}
      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>{erro}</div>
        </div>
      )}

      {/* Explicação do cadastro */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-bg-soft/60 px-3 py-2 text-xs text-zinc-300">
        <Info size={14} className="mt-0.5 shrink-0 text-brand-300" />
        <div>
          <strong className="text-zinc-100">Como funciona o cadastro:</strong> toda
          conta de tráfego cadastrada em{' '}
          <Link to="/clientes" className="text-brand-300 underline hover:text-brand-200">
            /clientes
          </Link>{' '}
          aparece automaticamente aqui. Cada plataforma do cliente (Meta, Google,
          TikTok, YouTube) tem <strong className="text-zinc-100">saúde própria</strong> —
          o status "geral" do card é o pior delas. Clientes em churn ou arquivados
          somem do radar.
        </div>
      </div>

      {/* Alerta de SLA quebrado / escalonamento */}
      {(kpis.sla_quebrado > 0 || kpis.escala_diretoria > 0) && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-300" />
            <div>
              <strong className="text-red-100">SLA quebrado em {kpis.sla_quebrado} conta{kpis.sla_quebrado === 1 ? '' : 's'}.</strong>
              {kpis.escala_diretoria > 0 && (
                <>
                  {' '}{kpis.escala_diretoria} conta{kpis.escala_diretoria === 1 ? ' está' : 's estão'} há 2+ semanas em estado crítico — <strong>notificar diretoria</strong>.
                </>
              )}
              {kpis.escala_critica > 0 && (
                <>
                  {' '}{kpis.escala_critica} instável{kpis.escala_critica === 1 ? '' : 's'} há 3+ semanas — considerar reclassificar como crítica.
                </>
              )}
            </div>
          </div>
          {kpis.sla_quebrado > 0 && fSla !== 'quebrado' && (
            <button
              onClick={() => setFSla('quebrado')}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-red-500/50 bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-500/25"
            >
              Filtrar SLA quebrado
            </button>
          )}
          {fSla === 'quebrado' && (
            <button
              onClick={() => setFSla('')}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-red-500/50 bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-500/25"
            >
              <X size={11} /> Limpar filtro
            </button>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          tone="critico"
          label="Críticas"
          valor={kpis.critico.total}
          subtitle={`${kpis.critico.no_prazo}/${kpis.critico.total} no prazo · 3x semana`}
          icon={AlertTriangle}
        />
        <KpiCard
          tone="instavel"
          label="Instáveis"
          valor={kpis.instavel.total}
          subtitle={`${kpis.instavel.no_prazo}/${kpis.instavel.total} no prazo · 2x semana`}
          icon={Activity}
        />
        <KpiCard
          tone="estavel"
          label="Estáveis"
          valor={kpis.estavel.total}
          subtitle={`${kpis.estavel.no_prazo}/${kpis.estavel.total} no prazo · 1x semana`}
          icon={CheckCircle2}
        />
        <KpiCard
          tone="critico"
          label="Atrasadas"
          valor={kpis.atrasadas}
          subtitle="Verificações abaixo do esperado"
          icon={Calendar}
        />
        <KpiCard
          tone="instavel"
          label="Planos abertos"
          valor={kpis.planos_abertos}
          subtitle="Ações pendentes ou em andamento"
          icon={ClipboardList}
        />
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por cliente, nicho ou gestor..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={fSquad} onChange={(e) => setFSquad(e.target.value)} className="w-44">
            <option value="">Todos squads</option>
            {squads.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select value={fGestor} onChange={(e) => setFGestor(e.target.value)} className="w-56">
            <option value="">Todos gestores</option>
            {gestores.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
          <Select
            value={fPlataforma}
            onChange={(e) => setFPlataforma(e.target.value as Plataforma | '')}
            className="w-44"
          >
            <option value="">Todas plataformas</option>
            {PLATAFORMAS.map((p) => (
              <option key={p} value={p}>{plataformaLabel[p]}</option>
            ))}
          </Select>
          <Select
            value={fSla}
            onChange={(e) => setFSla(e.target.value as '' | 'quebrado' | 'em_risco')}
            className="w-44"
          >
            <option value="">Todos SLAs</option>
            <option value="em_risco">Em risco ou pior</option>
            <option value="quebrado">Só SLA quebrado</option>
          </Select>
        </CardBody>
      </Card>

      {/* Loading global */}
      {loading && (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando contas...
        </div>
      )}

      {/* Nenhuma conta com plataforma cadastrada ainda */}
      {!loading && contas.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
          <Users size={28} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-zinc-200">Nenhuma conta de tráfego no radar ainda.</p>
          <p className="mt-1 text-xs text-muted">
            Os clientes só aparecem aqui depois que voc&ecirc; cadastra pelo menos uma{' '}
            <strong>plataforma</strong> (Meta, Google, TikTok ou YouTube) com a saúde inicial.
          </p>
          <p className="mt-2 text-xs text-muted">
            Pra adicionar uma plataforma: na pr&oacute;xima fase (2B) habilitamos um modal{' '}
            <em>"Adicionar plataforma"</em> em cada card de cliente. Por ora voc&ecirc;
            pode rodar o SQL abaixo no Supabase como ensaio:
          </p>
          <pre className="mt-3 mx-auto inline-block max-w-xl text-left text-[10px] text-muted bg-bg-soft p-3 rounded border border-border">
{`INSERT INTO cliente_saude_plataforma
  (cliente_id, plataforma, status_saude)
VALUES
  ('<uuid_do_cliente>', 'meta_ads', 'estavel');`}
          </pre>
        </div>
      )}

      {/* Seções por status */}
      {!loading && contas.length > 0 && (
      <div className="space-y-5">
        {(['critico', 'instavel', 'estavel'] as StatusConta[]).map((s) => {
          const items = grupos[s]
          if (items.length === 0) return null
          const isCollapsed = collapsed[s]
          const cor = statusCor[s]
          return (
            <div key={s}>
              <button
                onClick={() => setCollapsed((o) => ({ ...o, [s]: !o[s] }))}
                className="mb-2 flex w-full items-center gap-2.5 text-left"
              >
                <span className={cn('h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]', cor.dot)} />
                <span className={cn('text-[11px] font-semibold uppercase tracking-wider', cor.text)}>
                  {statusLabel[s]} · {META_SEMANAL[s]}x por semana
                </span>
                <span className="rounded-md bg-bg-elev px-1.5 py-0.5 text-[10px] text-muted">
                  {items.length}
                </span>
                {isCollapsed ? (
                  <ChevronRight size={12} className="ml-auto text-muted" />
                ) : (
                  <ChevronDown size={12} className="ml-auto text-muted" />
                )}
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {items.map((c) => (
                    <ContaCard
                      key={c.id}
                      conta={c}
                      sla={slaPorConta.get(c.id)!}
                      podeEditar={podeEditar}
                      onRegistrar={() => setRegistrarPara(c)}
                      onMudarStatusPlataforma={(plat, novo) =>
                        mudarStatusPlataforma(c.id, plat, novo)
                      }
                      onMudarStatusPlano={(verifId, novo) =>
                        mudarStatusPlano(c.id, verifId, novo)
                      }
                      onEditarPlataforma={(plat) =>
                        setGerenciarPlat({
                          contaId: c.id,
                          contaNome: c.nome,
                          plataforma: plat,
                          usadas: c.plataformas.map((p) => p.plataforma),
                        })
                      }
                      onAdicionarPlataforma={() =>
                        setGerenciarPlat({
                          contaId: c.id,
                          contaNome: c.nome,
                          plataforma: null,
                          usadas: c.plataformas.map((p) => p.plataforma),
                        })
                      }
                      onRemoverPlataforma={(plat) => removerPlataforma(c.id, plat)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
            <Users size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-zinc-200">Nenhuma conta nos filtros atuais</p>
            <p className="mt-1 text-xs text-muted">Limpe os filtros pra ver todas.</p>
          </div>
        )}
      </div>
      )}

      {/* Modal: registrar verificação */}
      <RegistrarVerificacaoModal
        conta={registrarPara}
        onClose={() => setRegistrarPara(null)}
        onSalvar={(plat, problema, plano) => {
          if (!registrarPara) return
          registrarVerificacao(registrarPara.id, plat, problema, plano)
          setRegistrarPara(null)
        }}
      />

      {/* Modal: editar / adicionar plataforma de uma conta existente */}
      {gerenciarPlat && (
        <PlataformaModal
          open
          contaNome={gerenciarPlat.contaNome}
          plataformaAtual={gerenciarPlat.plataforma}
          plataformasUsadas={gerenciarPlat.usadas}
          onClose={() => setGerenciarPlat(null)}
          onSalvar={(plat, dados) =>
            salvarPlataforma(gerenciarPlat.contaId, plat, dados)
          }
        />
      )}

      {/* Modal: adicionar conta nova ao radar (escolhe cliente) */}
      {adicionarConta && (
        <AdicionarContaModal
          clientes={clientesTrafego}
          contasNoRadar={contas}
          onClose={() => setAdicionarConta(false)}
          onSalvar={(clienteId, plat, dados) =>
            salvarPlataforma(clienteId, plat, dados)
          }
        />
      )}
    </div>
  )
}

// =========================================================
// Modal: Plataforma (editar / adicionar) — dados manuais
// =========================================================

interface PlataformaFormDados {
  status_saude: StatusConta
  leads_30d: number
  cpl: number
  verba_gasta: number
  verba_orcamento: number
  tendencia_pct: number
  observacao: string | null
}

/** Campos compartilhados entre os dois modais (plataforma + adicionar conta). */
function CamposPlataforma({
  dados,
  setDados,
}: {
  dados: PlataformaFormDados
  setDados: (d: PlataformaFormDados) => void
}) {
  return (
    <div className="space-y-3">
      <Field label="Saúde da plataforma *">
        <Select
          value={dados.status_saude}
          onChange={(e) =>
            setDados({ ...dados, status_saude: e.target.value as StatusConta })
          }
        >
          <option value="estavel">Estável (1x/semana)</option>
          <option value="instavel">Instável (2x/semana)</option>
          <option value="critico">Crítica (3x/semana)</option>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Leads (30 dias)">
          <Input
            type="number"
            value={String(dados.leads_30d)}
            onChange={(e) =>
              setDados({ ...dados, leads_30d: Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="CPL (R$)">
          <Input
            type="number"
            step="0.01"
            value={String(dados.cpl)}
            onChange={(e) => setDados({ ...dados, cpl: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Verba gasta (R$)">
          <Input
            type="number"
            step="0.01"
            value={String(dados.verba_gasta)}
            onChange={(e) =>
              setDados({ ...dados, verba_gasta: Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Verba orçamento (R$)">
          <Input
            type="number"
            step="0.01"
            value={String(dados.verba_orcamento)}
            onChange={(e) =>
              setDados({ ...dados, verba_orcamento: Number(e.target.value) || 0 })
            }
          />
        </Field>
      </div>

      <Field
        label="Tendência de leads (%)"
        hint="Variação vs. período anterior. Positivo = melhorou, negativo = piorou."
      >
        <Input
          type="number"
          value={String(dados.tendencia_pct)}
          onChange={(e) =>
            setDados({ ...dados, tendencia_pct: Number(e.target.value) || 0 })
          }
        />
      </Field>

      <Field label="Observação (opcional)">
        <Textarea
          value={dados.observacao ?? ''}
          onChange={(e) =>
            setDados({ ...dados, observacao: e.target.value || null })
          }
          placeholder="Contexto rápido sobre essa plataforma..."
          className="min-h-[60px]"
        />
      </Field>
    </div>
  )
}

const DADOS_VAZIOS: PlataformaFormDados = {
  status_saude: 'estavel',
  leads_30d: 0,
  cpl: 0,
  verba_gasta: 0,
  verba_orcamento: 0,
  tendencia_pct: 0,
  observacao: null,
}

function PlataformaModal({
  open,
  contaNome,
  plataformaAtual,
  plataformasUsadas,
  onClose,
  onSalvar,
}: {
  open: boolean
  contaNome: string
  /** null = adicionar nova; preenchido = editar existente */
  plataformaAtual: PlataformaSaude | null
  plataformasUsadas: Plataforma[]
  onClose: () => void
  onSalvar: (plat: Plataforma, dados: PlataformaFormDados) => void
}) {
  const editando = !!plataformaAtual
  const disponiveis = PLATAFORMAS.filter(
    (p) => editando || !plataformasUsadas.includes(p),
  )
  const [plataforma, setPlataforma] = useState<Plataforma | ''>(
    plataformaAtual?.plataforma ?? disponiveis[0] ?? '',
  )
  const [dados, setDados] = useState<PlataformaFormDados>(
    plataformaAtual
      ? {
          status_saude: plataformaAtual.status,
          leads_30d: plataformaAtual.leads_30d,
          cpl: plataformaAtual.cpl,
          verba_gasta: plataformaAtual.verba_gasta,
          verba_orcamento: plataformaAtual.verba_orcamento,
          tendencia_pct: plataformaAtual.tendencia_pct,
          observacao: plataformaAtual.observacao,
        }
      : DADOS_VAZIOS,
  )

  function handleSalvar() {
    if (!plataforma) return
    onSalvar(plataforma as Plataforma, dados)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${editando ? 'Editar' : 'Adicionar'} plataforma — ${contaNome}`}
      className="max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-zinc-200"
          >
            <X size={12} /> Cancelar
          </button>
          <Button onClick={handleSalvar} disabled={!plataforma}>
            <CheckCircle2 size={13} /> Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Plataforma *">
          <Select
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value as Plataforma | '')}
            disabled={editando}
          >
            {disponiveis.length === 0 && <option value="">— todas já cadastradas —</option>}
            {disponiveis.map((p) => (
              <option key={p} value={p}>
                {plataformaLabel[p]}
              </option>
            ))}
          </Select>
        </Field>
        <CamposPlataforma dados={dados} setDados={setDados} />
      </div>
    </Modal>
  )
}

// =========================================================
// Modal: Adicionar conta ao radar (escolhe cliente + plataforma)
// =========================================================

function AdicionarContaModal({
  clientes,
  contasNoRadar,
  onClose,
  onSalvar,
}: {
  clientes: ClienteSimples[]
  contasNoRadar: Conta[]
  onClose: () => void
  onSalvar: (clienteId: string, plat: Plataforma, dados: PlataformaFormDados) => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [plataforma, setPlataforma] = useState<Plataforma | ''>('meta_ads')
  const [dados, setDados] = useState<PlataformaFormDados>(DADOS_VAZIOS)
  const [erro, setErro] = useState<string | null>(null)

  // Plataformas já cadastradas pro cliente escolhido (pra não duplicar)
  const usadas = useMemo(() => {
    const conta = contasNoRadar.find((c) => c.id === clienteId)
    return conta?.plataformas.map((p) => p.plataforma) ?? []
  }, [clienteId, contasNoRadar])
  const disponiveis = PLATAFORMAS.filter((p) => !usadas.includes(p))

  // Se a plataforma selecionada virou indisponível, troca pra primeira livre
  useEffect(() => {
    if (plataforma && usadas.includes(plataforma as Plataforma)) {
      setPlataforma(disponiveis[0] ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  function handleSalvar() {
    if (!clienteId) {
      setErro('Escolha o cliente.')
      return
    }
    if (!plataforma) {
      setErro('Escolha a plataforma.')
      return
    }
    onSalvar(clienteId, plataforma as Plataforma, dados)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar conta ao radar"
      className="max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-zinc-200"
          >
            <X size={12} /> Cancelar
          </button>
          <Button onClick={handleSalvar}>
            <CheckCircle2 size={13} /> Adicionar ao radar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          Escolha um cliente de tráfego e cadastre a primeira plataforma com a
          saúde inicial. Ele passa a aparecer no radar.
        </p>
        {erro && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {erro}
          </div>
        )}
        <Field label="Cliente *">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">— selecione —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.squad ? ` · ${c.squad}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plataforma *">
          <Select
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value as Plataforma | '')}
            disabled={!clienteId}
          >
            {disponiveis.length === 0 ? (
              <option value="">— todas já cadastradas —</option>
            ) : (
              disponiveis.map((p) => (
                <option key={p} value={p}>
                  {plataformaLabel[p]}
                </option>
              ))
            )}
          </Select>
        </Field>
        <CamposPlataforma dados={dados} setDados={setDados} />
      </div>
    </Modal>
  )
}

// =========================================================
// Subcomponentes
// =========================================================

function KpiCard({
  tone,
  label,
  valor,
  subtitle,
  icon: Icon,
}: {
  tone: StatusConta
  label: string
  valor: number
  subtitle: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  const cor = statusCor[tone]
  return (
    <Card className={cn('border', cor.border, cor.bg)}>
      <CardBody className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', cor.text)}>
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">{valor}</p>
          <p className="mt-1 text-[10px] text-muted">{subtitle}</p>
        </div>
        <Icon size={18} className={cor.text} />
      </CardBody>
    </Card>
  )
}

function ContaCard({
  conta,
  sla,
  podeEditar,
  onRegistrar,
  onMudarStatusPlataforma,
  onMudarStatusPlano,
  onEditarPlataforma,
  onAdicionarPlataforma,
  onRemoverPlataforma,
}: {
  conta: Conta
  sla: AvaliacaoSLA
  podeEditar: boolean
  onRegistrar: () => void
  onMudarStatusPlataforma: (plat: Plataforma, novo: StatusConta) => void
  onMudarStatusPlano: (verifId: string, novo: StatusPlano) => void
  onEditarPlataforma: (plat: PlataformaSaude) => void
  onAdicionarPlataforma: () => void
  onRemoverPlataforma: (plat: Plataforma) => void
}) {
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const sGeral = statusGeral(conta)
  const cor = statusCor[sGeral]
  const meta = META_SEMANAL[sGeral]
  const naSemana = verificacoesDaSemana(conta)
  const feitas = naSemana.length
  const completo = feitas >= meta
  const atrasada = estaAtrasada(conta)
  const ultima = ultimaVerificacao(conta)
  const dias = diasDesde(ultima?.data ?? null)
  const planosAbertos = conta.verificacoes.filter((v) => v.status_plano !== 'concluido').length

  // SLA → cores e label do badge
  const slaCor =
    sla.geral === 'quebrado'
      ? 'border-red-500/40 bg-red-500/15 text-red-300'
      : sla.geral === 'em_risco'
        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  const slaLabel =
    sla.geral === 'quebrado' ? 'SLA quebrado' : sla.geral === 'em_risco' ? 'SLA em risco' : 'SLA OK'

  // Mapa de planos pra usar no histórico
  const planoSLAMap = new Map(sla.planos.map((p) => [p.verifId, p]))

  return (
    <div
      className={cn(
        'rounded-xl border bg-bg-card overflow-hidden transition-colors',
        cor.border,
        'hover:border-brand-500/40',
      )}
    >
      <div className="flex">
        <div className={cn('w-1 shrink-0', cor.bar)} />
        <div className="flex-1 p-4">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-zinc-100">{conta.nome}</h3>
              <p className="mt-0.5 text-[11px] text-muted">
                {conta.nicho} · Squad {conta.squad}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Avatar name={conta.gestor.nome} size="sm" />
              <span
                className={cn(
                  'inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                  slaCor,
                )}
                title={`Cadência: ${sla.cadencia.status}; Intervalo: ${sla.intervalo.status}; Planos: ${sla.planos.filter((p) => p.status === 'quebrado').length} vencidos / ${sla.planos.filter((p) => p.status === 'em_risco').length} no limite`}
              >
                {slaLabel}
              </span>
              {atrasada && (
                <Badge tone="danger" className="text-[9px]">Atrasada</Badge>
              )}
              {planosAbertos > 0 && (
                <Badge tone="warning" className="text-[9px]">
                  {planosAbertos} {planosAbertos === 1 ? 'plano' : 'planos'}
                </Badge>
              )}
            </div>
          </div>

          {/* Linha de escalonamento (se aplica) */}
          {sla.escalonamento !== 'nenhum' && (
            <div
              className={cn(
                'mb-3 rounded-md border px-2 py-1.5 text-[10px]',
                sla.escalonamento === 'notifica_diretoria'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
              )}
            >
              {sla.escalonamento === 'notifica_diretoria' ? (
                <>
                  <strong>Escalonar pra diretoria.</strong> Conta crítica há{' '}
                  {Math.floor(
                    (Date.now() - new Date(conta.status_geral_desde).getTime()) /
                      (1000 * 60 * 60 * 24 * 7),
                  )}
                  + semanas consecutivas.
                </>
              ) : (
                <>
                  <strong>Considerar reclassificar como crítica.</strong> Instável há 3+
                  semanas sem voltar a estável.
                </>
              )}
            </div>
          )}

          {/* Plataformas com saúde individual */}
          <div className="mb-3 space-y-2">
            {conta.plataformas.map((p) => (
              <PlataformaRow
                key={p.plataforma}
                plat={p}
                podeEditar={podeEditar}
                onMudar={(novo) => onMudarStatusPlataforma(p.plataforma, novo)}
                onEditar={() => onEditarPlataforma(p)}
                onRemover={() => onRemoverPlataforma(p.plataforma)}
              />
            ))}
            {/* Adicionar outra plataforma (se ainda não usa todas as 4) */}
            {podeEditar && conta.plataformas.length < 4 && (
              <button
                onClick={onAdicionarPlataforma}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-[11px] text-muted transition-colors hover:border-brand-500/40 hover:text-brand-300"
              >
                <PlusCircle size={12} />
                Adicionar plataforma
              </button>
            )}
          </div>

          {/* Cadência semanal */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
              <span>Verificações esta semana</span>
              <span className={cn('font-semibold', completo ? 'text-emerald-300' : cor.text)}>
                {feitas}/{meta}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: meta }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-sm',
                    i < feitas
                      ? completo
                        ? 'bg-emerald-500'
                        : cor.bar
                      : 'bg-bg-soft border border-border',
                  )}
                />
              ))}
            </div>
            {ultima ? (
              <p className="mt-1.5 text-[10px] text-muted">
                Última: <span className="text-zinc-300">{labelDiasDesde(dias)}</span> ·{' '}
                <span className={cn('px-1 py-0.5 rounded border text-[9px]', plataformaCor[ultima.plataforma])}>
                  {plataformaLabel[ultima.plataforma]}
                </span>{' '}
                <span className="text-zinc-400">{ultima.problema.slice(0, 50)}</span>
                {ultima.problema.length > 50 && '…'}
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] text-amber-300">
                Nenhuma verificação registrada ainda
              </p>
            )}
          </div>

          {/* Toggle histórico */}
          {conta.verificacoes.length > 0 && (
            <button
              onClick={() => setHistoricoAberto((v) => !v)}
              className="mb-3 inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand-300"
            >
              {historicoAberto ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {historicoAberto ? 'Esconder histórico' : `Ver histórico (${conta.verificacoes.length})`}
            </button>
          )}

          {historicoAberto && (
            <div className="mb-3 space-y-2 rounded-lg border border-border bg-bg-soft/60 p-2">
              {conta.verificacoes.map((v) => (
                <VerificacaoItem
                  key={v.id}
                  verif={v}
                  planoSla={planoSLAMap.get(v.id) ?? null}
                  onMudarStatusPlano={(novo) => onMudarStatusPlano(v.id, novo)}
                />
              ))}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={onRegistrar}>
              <Plus size={12} />
              Registrar verificação
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlataformaRow({
  plat,
  podeEditar,
  onMudar,
  onEditar,
  onRemover,
}: {
  plat: PlataformaSaude
  podeEditar: boolean
  onMudar: (novo: StatusConta) => void
  onEditar: () => void
  onRemover: () => void
}) {
  const cor = statusCor[plat.status]
  const cplFmt = `R$ ${plat.cpl.toFixed(2).replace('.', ',')}`
  const verbaPct =
    plat.verba_orcamento > 0
      ? Math.round((plat.verba_gasta / plat.verba_orcamento) * 100)
      : 0
  const positivo = plat.tendencia_pct > 0
  const Trend = positivo ? TrendingUp : TrendingDown
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold', plataformaCor[plat.plataforma])}>
            {plataformaLabel[plat.plataforma]}
          </span>
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold', cor.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', cor.dot)} />
            {statusLabel[plat.status]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Select
            value={plat.status}
            onChange={(e) => onMudar(e.target.value as StatusConta)}
            className="h-6 w-24 text-[10px]"
            title="Mudar saúde desta plataforma"
            disabled={!podeEditar}
          >
            <option value="estavel">Estável</option>
            <option value="instavel">Instável</option>
            <option value="critico">Crítica</option>
          </Select>
          {podeEditar && (
            <>
              <button
                onClick={onEditar}
                className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted transition-colors hover:border-brand-500/40 hover:text-brand-300"
                title="Editar métricas desta plataforma"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={onRemover}
                className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                title="Remover plataforma do radar"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MicroMetric
          label="Leads 30d"
          valor={String(plat.leads_30d)}
          extra={
            <span className={cn('inline-flex items-center gap-0.5 text-[9px]', positivo ? 'text-emerald-400' : 'text-red-400')}>
              <Trend size={9} />
              {Math.abs(plat.tendencia_pct)}%
            </span>
          }
        />
        <MicroMetric label="CPL" valor={cplFmt} />
        <MicroMetric label="Verba" valor={`${verbaPct}%`} sub={formatBRL(plat.verba_gasta)} />
      </div>
    </div>
  )
}

function MicroMetric({
  label,
  valor,
  sub,
  extra,
}: {
  label: string
  valor: string
  sub?: string
  extra?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-bg-card px-2 py-1">
      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1 text-xs font-semibold text-zinc-100">
        {valor}
        {extra}
      </p>
      {sub && <p className="text-[9px] text-muted">{sub}</p>}
    </div>
  )
}

function VerificacaoItem({
  verif,
  planoSla,
  onMudarStatusPlano,
}: {
  verif: Verificacao
  /** Avaliação de SLA do plano (null se já concluído) */
  planoSla: AvaliacaoPlano | null
  onMudarStatusPlano: (novo: StatusPlano) => void
}) {
  /** Texto + cor do badge de prazo do plano (só pra planos não concluídos). */
  function prazoBadge() {
    if (!planoSla) return null
    const d = planoSla.diasUteisRestantes
    if (d < 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-200">
          Vencido há {Math.abs(d)} {Math.abs(d) === 1 ? 'dia útil' : 'dias úteis'}
        </span>
      )
    }
    if (d <= 1) {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
          {d === 0 ? 'Vence hoje' : `Vence em ${d} dia útil`}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
        Vence em {d} dias úteis
      </span>
    )
  }

  return (
    <div className="rounded-md border border-border bg-bg-card p-2.5 text-[11px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-muted">
          <Calendar size={10} />
          <span>{formatDataHora(verif.data)}</span>
          <span>·</span>
          <span className="text-zinc-300">{verif.autor}</span>
          <span>·</span>
          <span className={cn('inline-flex items-center rounded border px-1.5 py-0 text-[9px] font-semibold', plataformaCor[verif.plataforma])}>
            {plataformaLabel[verif.plataforma]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {prazoBadge()}
          <Badge tone={statusPlanoTone[verif.status_plano]} className="text-[9px]">
            {statusPlanoLabel[verif.status_plano]}
          </Badge>
        </div>
      </div>
      <div className="mb-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Problema</p>
        <p className="mt-0.5 whitespace-pre-wrap text-zinc-200">{verif.problema}</p>
      </div>
      <div className="mb-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Plano de ação</p>
        <p className="mt-0.5 whitespace-pre-wrap text-zinc-200">{verif.plano_acao}</p>
      </div>
      <div className="flex items-center justify-end">
        <Select
          value={verif.status_plano}
          onChange={(e) => onMudarStatusPlano(e.target.value as StatusPlano)}
          className="h-6 w-36 text-[10px]"
        >
          <option value="aberto">Aberto</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
        </Select>
      </div>
    </div>
  )
}

// =========================================================
// Modal: Registrar verificação
// =========================================================

function RegistrarVerificacaoModal({
  conta,
  onClose,
  onSalvar,
}: {
  conta: Conta | null
  onClose: () => void
  onSalvar: (plataforma: Plataforma, problema: string, plano: string) => void
}) {
  const [plataforma, setPlataforma] = useState<Plataforma | ''>('')
  const [problema, setProblema] = useState('')
  const [plano, setPlano] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (conta) {
      // Pré-seleciona a plataforma de pior status
      const ordenadas = [...conta.plataformas].sort(
        (a, b) => ordemStatus[b.status] - ordemStatus[a.status],
      )
      setPlataforma(ordenadas[0]?.plataforma ?? '')
      setProblema('')
      setPlano('')
      setErro(null)
    }
  }, [conta?.id])

  function handleSalvar() {
    const p1 = problema.trim()
    const p2 = plano.trim()
    if (!plataforma) {
      setErro('Selecione a plataforma que está sendo verificada.')
      return
    }
    if (!p1 || !p2) {
      setErro('Preencha o problema encontrado E o plano de ação antes de salvar.')
      return
    }
    onSalvar(plataforma as Plataforma, p1, p2)
  }

  if (!conta) return null

  return (
    <Modal
      open={!!conta}
      onClose={onClose}
      title={`Registrar verificação — ${conta.nome}`}
      className="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-zinc-200"
          >
            <X size={12} /> Cancelar
          </button>
          <Button onClick={handleSalvar}>
            <CheckCircle2 size={13} /> Salvar verificação
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-bg-soft px-3 py-2 text-[11px] text-muted">
          <span className="text-zinc-300">{conta.nicho}</span> · Squad{' '}
          <span className="text-zinc-300">{conta.squad}</span> · Gestor{' '}
          <span className="text-zinc-300">{conta.gestor.nome}</span>
        </div>

        {erro && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {erro}
          </div>
        )}

        <Field
          label="Plataforma *"
          hint="Qual plataforma está sendo verificada nessa rodada. Cada verificação cobre uma plataforma."
        >
          <Select
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value as Plataforma | '')}
          >
            <option value="">— selecione —</option>
            {conta.plataformas.map((p) => (
              <option key={p.plataforma} value={p.plataforma}>
                {plataformaLabel[p.plataforma]} · {statusLabel[p.status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Problema encontrado *"
          hint="O que você identificou de errado, atípico ou que precisa de atenção. Seja específico."
        >
          <Textarea
            value={problema}
            onChange={(e) => setProblema(e.target.value)}
            placeholder="Ex: CPL subiu 80% em 7 dias. CTR caindo nos 2 conjuntos principais. Cliente reclamou de qualidade dos leads."
            className="min-h-[100px]"
            autoFocus
          />
        </Field>

        <Field
          label="Plano de ação *"
          hint="O que vai ser feito pra resolver, quem é responsável e prazo se aplicável."
        >
          <Textarea
            value={plano}
            onChange={(e) => setPlano(e.target.value)}
            placeholder="Ex: 1) Pausar conjuntos com CPL > R$ 200; 2) Subir 3 novos criativos com prova social até quinta; 3) Reunião com gestor pra revisar segmentação."
            className="min-h-[100px]"
          />
        </Field>

        <p className="text-[10px] text-muted">
          A verificação é salva como <strong>Aberto</strong>. Conforme o plano avança, atualize o
          status no histórico (Em andamento → Concluído) pra manter o registro vivo.
        </p>
      </div>
    </Modal>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      {hint && <p className="mb-1.5 text-[10px] text-muted">{hint}</p>}
      {children}
    </div>
  )
}
