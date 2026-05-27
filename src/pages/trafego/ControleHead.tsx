/**
 * Painel do Head de Tráfego — visão de TODAS as contas com status de saúde
 * (Estável / Instável / Crítica) e cadência de verificação obrigatória.
 *
 * Regra de cadência (definida pelo head):
 *   - Estável  → 1x por semana (≥ 1 verificação na semana corrente)
 *   - Instável → 2x por semana
 *   - Crítica  → 3x por semana
 *
 * Modelo de plataformas:
 *   - Cliente pode rodar em mais de uma plataforma (Meta + Google + etc)
 *   - Cada plataforma tem SEU PRÓPRIO status de saúde
 *   - O card mostra o pior status como "geral" e badges individuais
 *     pra cada plataforma
 *   - Verificações são REGISTRADAS POR PLATAFORMA (problema + plano +
 *     qual plataforma cobre)
 *   - Cadência semanal usa o pior status (worst-case) — head pode
 *     distribuir as verificações entre plataformas como achar melhor
 *
 * ⚠️ ESTA TELA AINDA NÃO USA DADOS REAIS DO SUPABASE.
 * É um mock pra revisão visual antes de criar as migrations/tabelas.
 * O state vive só no client e some quando recarrega.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
// Tipos & mock data
// =========================================================

type StatusConta = 'estavel' | 'instavel' | 'critico'
type StatusPlano = 'aberto' | 'em_andamento' | 'concluido'
type Plataforma = 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'youtube_ads'

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

interface PlataformaSaude {
  plataforma: Plataforma
  status: StatusConta
  leads_30d: number
  cpl: number
  verba_gasta: number
  verba_orcamento: number
  tendencia_pct: number
}

interface Verificacao {
  id: string
  data: string // ISO
  plataforma: Plataforma // qual plataforma foi verificada
  problema: string
  plano_acao: string
  status_plano: StatusPlano
  autor: string // mock: nome do head logado
}

interface ContaMock {
  id: string
  nome: string
  nicho: string
  squad: string
  gestor: { nome: string; avatar_url?: string | null }
  /** Saúde por plataforma — cliente pode ter 1 ou várias */
  plataformas: PlataformaSaude[]
  /** Histórico completo de verificações (mais recente primeiro) */
  verificacoes: Verificacao[]
  /**
   * Data ISO de quando a conta entrou no status atual (geral).
   * Usada pra detectar escalonamento automático (instável→crítica em 3 sem;
   * crítica→diretoria em 2 sem).
   * Quando virar dados reais: vira `status_desde` na tabela cliente_saude.
   */
  status_geral_desde: string
}

// =========================================================
// Helpers
// =========================================================

/** Ordem de gravidade: critico > instavel > estavel */
const ordemStatus: Record<StatusConta, number> = { critico: 3, instavel: 2, estavel: 1 }

/** Pior status entre as plataformas (worst-case). */
function statusGeral(c: ContaMock): StatusConta {
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

function verificacoesDaSemana(c: ContaMock): Verificacao[] {
  const seg = inicioDaSemana().getTime()
  return c.verificacoes.filter((v) => new Date(v.data).getTime() >= seg)
}

function ultimaVerificacao(c: ContaMock): Verificacao | null {
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

function estaAtrasada(c: ContaMock): boolean {
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

function avaliarSLA(c: ContaMock): AvaliacaoSLA {
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
// Mock data
// =========================================================

function mockPlat(
  plataforma: Plataforma,
  status: StatusConta,
  leads: number,
  cpl: number,
  gasto: number,
  orcamento: number,
  tendencia: number,
): PlataformaSaude {
  return {
    plataforma,
    status,
    leads_30d: leads,
    cpl,
    verba_gasta: gasto,
    verba_orcamento: orcamento,
    tendencia_pct: tendencia,
  }
}

function mockVerif(
  diasAtras: number,
  plat: Plataforma,
  problema: string,
  plano: string,
  status: StatusPlano = 'em_andamento',
): Verificacao {
  return {
    id: `v${Math.random().toString(36).slice(2, 9)}`,
    data: daysAgo(diasAtras),
    plataforma: plat,
    problema,
    plano_acao: plano,
    status_plano: status,
    autor: 'Lucas Antonio',
  }
}

const MOCK_CONTAS: ContaMock[] = [
  // Cliente com Meta crítica + Google estável → card vira "crítico" no geral
  // Crítica há 15 dias → já caiu na regra "2 sem → notifica diretoria"
  {
    id: 'm1',
    nome: 'Dra. Camila Estética',
    nicho: 'Harmonização Facial',
    squad: 'BlackOps',
    gestor: { nome: 'Lucas Portilho' },
    status_geral_desde: daysAgo(15),
    plataformas: [
      mockPlat('meta_ads', 'critico', 8, 240.5, 3800, 6000, -42),
      mockPlat('google_ads', 'estavel', 14, 95, 1900, 2500, 5),
    ],
    verificacoes: [
      mockVerif(
        2,
        'meta_ads',
        'CPL Meta disparou de R$ 120 pra R$ 240 em 7 dias. Públicos parecidos perdendo performance.',
        'Pausar conjuntos com CPL > R$ 200, testar 3 novos criativos com prova social e lookalike 1%.',
        'em_andamento',
      ),
      mockVerif(
        9,
        'meta_ads',
        'Queda de leads no fim de semana, anúncios em revisão pelo Meta.',
        'Submeter recurso, criar campanha backup com criativos alternativos.',
        'concluido',
      ),
      mockVerif(
        5,
        'google_ads',
        'Search performando bem, mas Performance Max sem entregar.',
        'Manter Search atual, refazer assets do PMax com criativos novos.',
        'concluido',
      ),
    ],
  },
  // Cliente só com Meta crítica
  {
    id: 'm2',
    nome: 'Dr. Henrique Cardio',
    nicho: 'Cardiologia',
    squad: 'BlackSkull',
    gestor: { nome: 'Beatriz Barros' },
    status_geral_desde: daysAgo(6),
    plataformas: [mockPlat('meta_ads', 'critico', 14, 178.2, 4200, 5000, -18)],
    verificacoes: [
      mockVerif(
        3,
        'meta_ads',
        'Conversão da LP caiu de 8% pra 4%, formulário com erro de submit em mobile.',
        'Designer já notificado pra refazer LP. Pausar campanhas até fix.',
        'aberto',
      ),
      mockVerif(
        5,
        'meta_ads',
        'Volume bom mas qualidade dos leads ruim (no-show altíssimo).',
        'Adicionar pergunta de qualificação no formulário + ajustar copy.',
        'em_andamento',
      ),
    ],
  },

  // INSTÁVEIS (4) — variados em plataformas
  {
    id: 'm3',
    nome: 'Clínica Sorrir Mais',
    nicho: 'Odonto',
    squad: 'BlackOps',
    gestor: { nome: 'Lucas Portilho' },
    status_geral_desde: daysAgo(10),
    plataformas: [
      mockPlat('meta_ads', 'instavel', 18, 92, 1400, 1800, -8),
      mockPlat('google_ads', 'estavel', 14, 65, 900, 1200, 3),
    ],
    verificacoes: [
      mockVerif(
        2,
        'meta_ads',
        'Frequência alta em 2 conjuntos (>4), CTR começou a cair.',
        'Subir 2 criativos novos esta semana, pausar os mais antigos.',
        'em_andamento',
      ),
    ],
  },
  {
    id: 'm4',
    nome: 'Dra. Renata Derma',
    nicho: 'Dermatologia',
    squad: 'BlackSkull',
    gestor: { nome: 'Igor Reis' },
    // Instável há 24 dias (>3 sem) — já cai na regra "sugere virar crítica"
    status_geral_desde: daysAgo(24),
    plataformas: [
      mockPlat('google_ads', 'instavel', 22, 120, 2600, 3500, 5),
    ],
    verificacoes: [
      mockVerif(
        4,
        'google_ads',
        'Sem otimização recente, conta no piloto automático.',
        'Briefing com gestor pra revisar palavras-chave e copy. Trazer 2 novos ângulos.',
        'aberto',
      ),
    ],
  },
  {
    id: 'm5',
    nome: 'Dr. Pedro Ortopedia',
    nicho: 'Ortopedia',
    squad: 'BlackOps',
    gestor: { nome: 'Diego Assis' },
    status_geral_desde: daysAgo(5),
    plataformas: [
      mockPlat('meta_ads', 'estavel', 12, 180, 2200, 2500, 2),
      mockPlat('google_ads', 'instavel', 6, 320, 1300, 1500, -10),
    ],
    verificacoes: [
      mockVerif(
        1,
        'google_ads',
        'CPC subindo nos termos principais (ortopedia + cidade).',
        'Adicionar negativas, testar lances manuais nos termos com CPC > R$ 8.',
        'em_andamento',
      ),
    ],
  },
  {
    id: 'm6',
    nome: 'Espaço Bella Vita',
    nicho: 'Estética',
    squad: 'BlackSkull',
    gestor: { nome: 'Beatriz Barros' },
    status_geral_desde: daysAgo(8),
    plataformas: [
      mockPlat('meta_ads', 'instavel', 27, 88, 2200, 2800, 12),
      mockPlat('tiktok_ads', 'instavel', 6, 145, 870, 1000, 25),
    ],
    verificacoes: [
      mockVerif(
        3,
        'meta_ads',
        'Cliente cobrando mais leads, verba não está sendo gasta toda.',
        'Aumentar orçamento diário em 30% e ampliar segmentação geográfica.',
        'em_andamento',
      ),
    ],
  },

  // ESTÁVEIS (10)
  ...Array.from({ length: 10 }).map((_, i) => {
    const nomes = [
      'Dra. Fernanda Ginecologia',
      'Dr. Artur Coluna',
      'Dr. Daniel Sadigursky',
      'Clínica Vita Plena',
      'Dr. Marcelo Plástica',
      'Dra. Violeta Canejo',
      'Clínica Bem Estar',
      'Dr. Rafael Vascular',
      'Dra. Leticia Fabiana',
      'Espaço Saúde Total',
    ]
    const nichos = [
      'Ginecologia',
      'Ortopedia',
      'Ortopedia',
      'Multi',
      'Cirurgia Plástica',
      'Ginecologia',
      'Multi',
      'Vascular',
      'Estética',
      'Multi',
    ]
    const gestores = [
      'Lucas Portilho',
      'Beatriz Barros',
      'Igor Reis',
      'Diego Assis',
      'Lucas Antonio',
    ]
    const squads = ['BlackOps', 'BlackSkull']
    // Mix: 60% só Meta, 30% Meta+Google, 10% só Google
    const r = Math.random()
    const plats: PlataformaSaude[] =
      r < 0.6
        ? [mockPlat('meta_ads', 'estavel',
            Math.floor(Math.random() * 40) + 20,
            Math.floor(Math.random() * 60) + 50,
            Math.floor(Math.random() * 2000) + 2000,
            Math.floor(Math.random() * 1500) + 3500,
            Math.floor(Math.random() * 30) - 5)]
        : r < 0.9
          ? [
              mockPlat('meta_ads', 'estavel',
                Math.floor(Math.random() * 30) + 18,
                Math.floor(Math.random() * 50) + 55,
                Math.floor(Math.random() * 1500) + 1500,
                Math.floor(Math.random() * 1000) + 2500,
                Math.floor(Math.random() * 20)),
              mockPlat('google_ads', 'estavel',
                Math.floor(Math.random() * 20) + 8,
                Math.floor(Math.random() * 80) + 70,
                Math.floor(Math.random() * 1200) + 1000,
                Math.floor(Math.random() * 800) + 1800,
                Math.floor(Math.random() * 25) - 5),
            ]
          : [mockPlat('google_ads', 'estavel',
              Math.floor(Math.random() * 30) + 12,
              Math.floor(Math.random() * 80) + 60,
              Math.floor(Math.random() * 2000) + 2000,
              Math.floor(Math.random() * 1500) + 3000,
              Math.floor(Math.random() * 20))]
    const feita = Math.random() > 0.3
    const verifs: Verificacao[] = feita
      ? [
          mockVerif(
            Math.floor(Math.random() * 4) + 1,
            plats[Math.floor(Math.random() * plats.length)].plataforma,
            'Performance dentro do esperado, CPL e CTR estáveis.',
            'Manter setup atual, sem ação necessária essa semana.',
            'concluido',
          ),
        ]
      : []
    return {
      id: `m${i + 7}`,
      nome: nomes[i],
      nicho: nichos[i],
      squad: squads[i % 2],
      gestor: { nome: gestores[i % gestores.length] },
      // Estáveis há tempos variados (sem regra de escalonamento ativando)
      status_geral_desde: daysAgo(20 + Math.floor(Math.random() * 60)),
      plataformas: plats,
      verificacoes: verifs,
    }
  }),
]

// =========================================================
// Página
// =========================================================

export default function ControleHead() {
  const [contas, setContas] = useState<ContaMock[]>(MOCK_CONTAS)
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
  const [registrarPara, setRegistrarPara] = useState<ContaMock | null>(null)
  // Estado de geração de PDF: 'diario' | 'semanal' | null
  // Bloqueia ambos os botões enquanto um está gerando (pdf() é assíncrono)
  const [gerandoPdf, setGerandoPdf] = useState<'diario' | 'semanal' | null>(null)

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
    const m: Record<StatusConta, ContaMock[]> = { critico: [], instavel: [], estavel: [] }
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

  function registrarVerificacao(
    contaId: string,
    plataforma: Plataforma,
    problema: string,
    plano: string,
  ) {
    setContas((arr) =>
      arr.map((c) =>
        c.id === contaId
          ? {
              ...c,
              verificacoes: [
                {
                  id: `v${Math.random().toString(36).slice(2, 9)}`,
                  data: new Date().toISOString(),
                  plataforma,
                  problema,
                  plano_acao: plano,
                  status_plano: 'aberto' as StatusPlano,
                  autor: 'Você (mock)',
                },
                ...c.verificacoes,
              ],
            }
          : c,
      ),
    )
  }

  function mudarStatusPlataforma(contaId: string, plat: Plataforma, novo: StatusConta) {
    setContas((arr) =>
      arr.map((c) => {
        if (c.id !== contaId) return c
        const plataformasAtualizadas = c.plataformas.map((p) =>
          p.plataforma === plat ? { ...p, status: novo } : p,
        )
        // Reavalia status geral: se mudou, reseta o status_geral_desde
        const statusAntes = statusGeral(c)
        const novaCard = { ...c, plataformas: plataformasAtualizadas }
        const statusDepois = statusGeral(novaCard)
        return statusAntes !== statusDepois
          ? { ...novaCard, status_geral_desde: new Date().toISOString() }
          : novaCard
      }),
    )
  }

  function mudarStatusPlano(contaId: string, verifId: string, novo: StatusPlano) {
    setContas((arr) =>
      arr.map((c) =>
        c.id === contaId
          ? {
              ...c,
              verificacoes: c.verificacoes.map((v) =>
                v.id === verifId ? { ...v, status_plano: novo } : v,
              ),
            }
          : c,
      ),
    )
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
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300"
            >
              <UserPlus size={13} />
              Cadastrar nova conta
            </Link>
          </div>
        }
      />

      {/* Aviso de mock */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div>
          <strong>Versão de revisão · dados fictícios.</strong> Esta tela ainda
          não consulta o banco — é um mock pra você validar o layout, fluxo de
          verificação e os filtros. Quando aprovar, conecto com a base real
          (clientes + tabela de verificações) e ativo o registro persistente.
        </div>
      </div>

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

      {/* Seções por status */}
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
                      onRegistrar={() => setRegistrarPara(c)}
                      onMudarStatusPlataforma={(plat, novo) =>
                        mudarStatusPlataforma(c.id, plat, novo)
                      }
                      onMudarStatusPlano={(verifId, novo) =>
                        mudarStatusPlano(c.id, verifId, novo)
                      }
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

      {/* Modal */}
      <RegistrarVerificacaoModal
        conta={registrarPara}
        onClose={() => setRegistrarPara(null)}
        onSalvar={(plat, problema, plano) => {
          if (!registrarPara) return
          registrarVerificacao(registrarPara.id, plat, problema, plano)
          setRegistrarPara(null)
        }}
      />
    </div>
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
  onRegistrar,
  onMudarStatusPlataforma,
  onMudarStatusPlano,
}: {
  conta: ContaMock
  sla: AvaliacaoSLA
  onRegistrar: () => void
  onMudarStatusPlataforma: (plat: Plataforma, novo: StatusConta) => void
  onMudarStatusPlano: (verifId: string, novo: StatusPlano) => void
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
                onMudar={(novo) => onMudarStatusPlataforma(p.plataforma, novo)}
              />
            ))}
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
  onMudar,
}: {
  plat: PlataformaSaude
  onMudar: (novo: StatusConta) => void
}) {
  const cor = statusCor[plat.status]
  const cplFmt = `R$ ${plat.cpl.toFixed(2).replace('.', ',')}`
  const verbaPct = Math.round((plat.verba_gasta / plat.verba_orcamento) * 100)
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
        <Select
          value={plat.status}
          onChange={(e) => onMudar(e.target.value as StatusConta)}
          className="h-6 w-28 text-[10px]"
          title="Mudar saúde desta plataforma"
        >
          <option value="estavel">Estável</option>
          <option value="instavel">Instável</option>
          <option value="critico">Crítica</option>
        </Select>
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
  conta: ContaMock | null
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
