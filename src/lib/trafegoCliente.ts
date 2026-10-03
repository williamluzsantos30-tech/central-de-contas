/**
 * Tráfego · cliente — pacing de verba (investido lido do resumo de tráfego)
 * e os dois conceitos de status separados:
 * CONTRATO (Ativo/Pausado/Encerrado) e SAÚDE DA CONTA (Estável/Atenção/Crítico).
 */
import { getClientTrafficSummary, NOME_PLATAFORMA_TRAFEGO, PLATAFORMAS_TRAFEGO } from '@/lib/traffic/summary'
import type { Tone } from '@/components/ds'
import type { Cliente } from '@/types/database'

// ── Pacing ──────────────────────────────────────────────────────────────────

export type NivelPacing = 'no_ritmo' | 'abaixo' | 'acima' | 'estourado' | 'sem_dado'

export interface PacingVerba {
  investido: number
  verba: number
  /** investido ÷ verba (0–∞) em %. */
  pct: number
  /** Projeção de fim de mês = investido ÷ dias decorridos × dias do mês. */
  projecao: number
  projecaoPct: number
  nivel: NivelPacing
  rotulo: string
}

const brl0 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * Verde: projeção 80–100% da verba. Laranja: projeção 100–110% OU abaixo de
 * 80% ("Abaixo do ritmo"). Vermelho: investido já passou da verba ("Verba
 * estourada") OU projeção acima de 110%.
 */
export function calculateBudgetPacing(investido: number | null, verba: number | null, data: Date = new Date()): PacingVerba {
  const v = verba ?? 0
  const inv = investido ?? 0
  if (!v || investido == null) {
    return { investido: inv, verba: v, pct: 0, projecao: 0, projecaoPct: 0, nivel: 'sem_dado', rotulo: !v ? 'Sem verba definida' : 'Sem investimento sincronizado' }
  }
  const diasNoMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate()
  const decorridos = Math.max(1, data.getDate())
  const projecao = (inv / decorridos) * diasNoMes
  const projecaoPct = (projecao / v) * 100
  const pct = (inv / v) * 100
  let nivel: NivelPacing
  let rotulo: string
  if (inv > v) {
    nivel = 'estourado'
    rotulo = 'Verba estourada'
  } else if (projecaoPct > 110) {
    nivel = 'estourado'
    rotulo = `Projeção: ${brl0(projecao)}`
  } else if (projecaoPct > 100) {
    nivel = 'acima'
    rotulo = `Projeção: ${brl0(projecao)}`
  } else if (projecaoPct < 80) {
    nivel = 'abaixo'
    rotulo = 'Abaixo do ritmo'
  } else {
    nivel = 'no_ritmo'
    rotulo = 'No ritmo'
  }
  return { investido: inv, verba: v, pct, projecao, projecaoPct, nivel, rotulo }
}

export const COR_PACING: Record<NivelPacing, { barra: string; texto: string; tone: Tone }> = {
  no_ritmo: { barra: 'bg-emerald-500', texto: 'text-emerald-400', tone: 'success' },
  abaixo: { barra: 'bg-orange-500', texto: 'text-orange-400', tone: 'warning' },
  acima: { barra: 'bg-orange-500', texto: 'text-orange-400', tone: 'warning' },
  estourado: { barra: 'bg-red-500', texto: 'text-red-400', tone: 'danger' },
  sem_dado: { barra: 'bg-zinc-500/50', texto: 'text-muted', tone: 'neutral' },
}

// ── Pacing a partir do resumo de tráfego ────────────────────────────────────

/**
 * Pacing do cliente no período (Google + Meta). O investido vem SÓ de
 * getClientTrafficSummary — mesma fonte das abas de plataforma, do Funil e
 * da aba Metas. A verba (planejado) é só a régua da comparação.
 * Mês passado: compara o gasto final (sem projeção).
 */
export function pacingDoCliente(c: Pick<Cliente, 'id' | 'verba_google' | 'verba_meta' | 'verba_mensal'>, periodo: string) {
  const resumo = getClientTrafficSummary(c.id, periodo)
  const nenhumaConectada = resumo.plataformasAusentes.length === PLATAFORMAS_TRAFEGO.length
  const verbaTotal = (c.verba_google ?? 0) + (c.verba_meta ?? 0) || c.verba_mensal
  const [y, m] = periodo.slice(0, 7).split('-').map(Number)
  const hoje = new Date()
  const ehMesAtual = hoje.getFullYear() === y && hoje.getMonth() + 1 === m
  const referencia = ehMesAtual ? hoje : new Date(y, m, 0)
  const pacing = calculateBudgetPacing(nenhumaConectada ? null : resumo.total.investimento, verbaTotal, referencia)
  const conectadas = PLATAFORMAS_TRAFEGO.filter((p) => resumo.porPlataforma[p].conectada)
  const origem =
    conectadas.length === 0 ? undefined : conectadas.length === 2 ? 'via integrações' : `via ${NOME_PLATAFORMA_TRAFEGO[conectadas[0]]}`
  return { resumo, verbaTotal, pacing, origem }
}

// ── Status: contrato × saúde da conta ───────────────────────────────────────

export type Contrato = 'ativo' | 'pausado' | 'encerrado'
export type Saude = 'estavel' | 'atencao' | 'critico'

export function contratoDoCliente(c: Pick<Cliente, 'status'>): Contrato {
  if (c.status === 'pausado') return 'pausado'
  if (c.status === 'churn') return 'encerrado'
  return 'ativo'
}

/** Crítico vem do Controle do Head (saúde das contas); Atenção também quando o cliente foi marcado em atenção. */
export function saudeDaConta(c: Pick<Cliente, 'status' | 'status_saude_geral'>): Saude {
  if (c.status_saude_geral === 'critico') return 'critico'
  if (c.status === 'atencao' || c.status_saude_geral === 'instavel') return 'atencao'
  return 'estavel'
}

export const CONTRATO_INFO: Record<Contrato, { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'success' },
  pausado: { label: 'Pausado', tone: 'neutral' },
  encerrado: { label: 'Encerrado', tone: 'danger' },
}

export const SAUDE_INFO: Record<Saude, { label: string; tone: Tone }> = {
  estavel: { label: 'Estável', tone: 'success' },
  atencao: { label: 'Atenção', tone: 'attention' },
  critico: { label: 'Crítico', tone: 'danger' },
}

// ── Rótulos de métricas ─────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  investimento: 'Investimento',
  valor_diario: 'Valor diário',
  cliques: 'Cliques',
  custo_mensagem: 'Custo por mensagem',
  mensagens: 'Mensagens',
  mensagens_qualificadas: 'Mensagens qualificadas',
  custo_mensagem_qualificada: 'Custo por mens. qualificada',
  numero_consultas: 'Nº de consultas',
  tm_consulta: 'Ticket médio (consulta)',
  taxa_consulta: 'Taxa de conversão (consultas)',
  numero_procedimentos: 'Nº de procedimentos',
  tm_procedimento: 'Ticket médio (procedimento)',
  taxa_procedimento: 'Taxa de conversão (procedimentos)',
  faturamento: 'Faturamento',
  roas: 'ROAS',
  cac: 'CAC',
}

/** Rótulo amigável de uma métrica (nunca mostra o slug interno). */
export function getMetricLabel(slug: string): string {
  if (METRIC_LABELS[slug]) return METRIC_LABELS[slug]
  const s = slug.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
