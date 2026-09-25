/**
 * Progresso das Metas Comerciais — reaproveita a MESMA calculadora do funil
 * (calculateMarketingFunnel), extraindo a métrica alvo e comparando com a
 * meta. Metas "menos é melhor" (no-show máximo) usam lógica de limite (mesma
 * ideia de Logo/Rev Churn).
 */
import type { Lead } from './mockLeads'
import type { InvestimentoMarketing } from './mockInvestimentos'
import { calculateMarketingFunnel, periodoMes, periodoSemana, type MarketingFunnel } from './marketingCalculator'
import { metricaInfo, type MetaComercial, type MetricaMeta } from './mockMetasComerciais'
import {
  taxasIdeaisDoEscopo,
  type TaxasConversaoIdeal,
  type TaxasConversaoIdealValores,
} from './mockComercialConfig'

export type StatusMeta = 'success' | 'atencao' | 'critico'

export interface GoalProgress {
  valorAtual: number
  percentual: number // % da meta atingida (ou % do limite consumido, se invertida)
  status: StatusMeta
  invertida: boolean
}

/** Extrai da MarketingFunnel o valor correspondente à métrica da meta. */
export function metricaValor(f: MarketingFunnel, metrica: MetricaMeta): number {
  switch (metrica) {
    case 'investimento': return f.investimento
    case 'leads': return f.leads
    case 'leads_qualificados': return f.qualificados
    case 'reunioes_agendadas': return f.reunioesAgendadas
    case 'reunioes_realizadas': return f.reunioesRealizadas
    case 'reunioes_a_serem': return f.reunioesASerem
    case 'cancelamentos': return f.cancelamentos
    case 'fechamentos': return f.fechamentos
    case 'mrr': return f.mrr
    case 'caixa_recolhido': return f.caixaRecolhido
    case 'contrato_fechado': return f.contratoFechado
  }
}

/**
 * Status/percentual de um valor vs. a meta. Normal: verde ≥100 / laranja
 * 50-99 / vermelho <50. Invertida (menos é melhor): por consumo do limite.
 */
export function statusDeProgresso(
  valorAtual: number,
  valorMeta: number,
  invertida: boolean,
): { percentual: number; status: StatusMeta } {
  if (invertida) {
    const ratio = valorMeta > 0 ? valorAtual / valorMeta : valorAtual > 0 ? Infinity : 0
    return { percentual: ratio * 100, status: ratio <= 0.7 ? 'success' : ratio <= 1 ? 'atencao' : 'critico' }
  }
  const percentual = valorMeta > 0 ? (valorAtual / valorMeta) * 100 : 0
  return { percentual, status: percentual >= 100 ? 'success' : percentual >= 50 ? 'atencao' : 'critico' }
}

/** Funil do escopo da meta (período + canal + responsável). */
function funilDaMeta(meta: MetaComercial, leads: Lead[], investimentos: InvestimentoMarketing[]): MarketingFunnel {
  const periodo = meta.periodicidade === 'mensal' ? periodoMes(meta.periodoReferencia) : periodoSemana(meta.periodoReferencia)
  // Escopo por responsável: filtra os leads do SDR/Closer antes de calcular.
  const base = meta.responsavelId
    ? leads.filter((l) => l.sdrId === meta.responsavelId || l.closerId === meta.responsavelId)
    : leads
  return calculateMarketingFunnel(base, investimentos, periodo, meta.canal)
}

export function calculateGoalProgress(
  meta: MetaComercial,
  leads: Lead[],
  investimentos: InvestimentoMarketing[],
): GoalProgress {
  const f = funilDaMeta(meta, leads, investimentos)
  const valorAtual = metricaValor(f, meta.metrica)
  const invertida = !!metricaInfo(meta.metrica).invertida
  const { percentual, status } = statusDeProgresso(valorAtual, meta.valorMeta, invertida)
  return { valorAtual, percentual, status, invertida }
}

// ── Ideal Recalculado (cascata entre etapas) ────────────────────────────────
/**
 * O "Ideal" de uma etapa vem do REALIZADO da etapa anterior × a taxa ideal —
 * nunca da meta original. Independente do "Realizado vs. Meta": uma etapa
 * pode bater a meta e ainda ficar abaixo do ideal (a anterior subiu a régua).
 */
export type StatusIdeal = 'acima' | 'abaixo'

export interface IdealEtapa {
  /** Math.round(base × taxa). */
  ideal: number
  realizado: number
  status: StatusIdeal
  /** Quanto falta pro ideal (0 se acima). */
  diferenca: number
  /** Realizado da etapa anterior usado como base. */
  base: number
  /** Taxa aplicada (%, já invertida no no-show: 75 = 1 − 25%). */
  taxaAplicada: number
  /** Etapa anterior zerada → não há régua pra comparar. */
  semBase: boolean
}

/** Etapas com etapa anterior no funil (Leads Qualificados é a 1ª — sem ideal). */
export type MetricaComIdeal = 'reunioes_agendadas' | 'reunioes_realizadas' | 'fechamentos'
export const METRICAS_COM_IDEAL: MetricaComIdeal[] = ['reunioes_agendadas', 'reunioes_realizadas', 'fechamentos']

export type IdealCascade = Record<MetricaComIdeal, IdealEtapa>

function etapa(base: number, taxaPct: number, realizado: number): IdealEtapa {
  const ideal = Math.round(base * (taxaPct / 100))
  return {
    ideal,
    realizado,
    status: realizado >= ideal ? 'acima' : 'abaixo',
    diferenca: Math.max(0, ideal - realizado),
    base,
    taxaAplicada: taxaPct,
    semBase: base <= 0,
  }
}

/**
 * Cascata do Ideal Recalculado:
 *   Agendadas  = Qualificados × SDR%
 *   Realizadas = Agendadas que já ACONTECERAM × (1 − No-show%)
 *   Fechamentos = Realizadas × Closer%
 * `reunioesASerem` (agendadas futuras) sai da base das Realizadas: reunião que
 * ainda não chegou não pode ser cobrada como no-show.
 */
export function calculateIdealCascade(
  leadsQualificados: number,
  reunioesAgendadas: number,
  reunioesRealizadas: number,
  fechamentos: number,
  taxasIdeais: TaxasConversaoIdealValores,
  reunioesASerem = 0,
): IdealCascade {
  return {
    reunioes_agendadas: etapa(leadsQualificados, taxasIdeais.sdr, reunioesAgendadas),
    reunioes_realizadas: etapa(Math.max(0, reunioesAgendadas - reunioesASerem), 100 - taxasIdeais.noShow, reunioesRealizadas),
    fechamentos: etapa(reunioesRealizadas, taxasIdeais.closer, fechamentos),
  }
}

/** Cascata a partir de um funil já calculado. */
export function idealCascadeDoFunil(f: MarketingFunnel, taxasIdeais: TaxasConversaoIdealValores): IdealCascade {
  return calculateIdealCascade(f.qualificados, f.reunioesAgendadas, f.reunioesRealizadas, f.fechamentos, taxasIdeais, f.reunioesASerem)
}

/** Textos da conta de cada etapa: curto (no card) e por extenso (tooltip). */
export function contaDoIdeal(metrica: MetricaComIdeal, e: IdealEtapa, reunioesASerem = 0): { curta: string; extenso: string } {
  const pct = (n: number) => `${Number(n.toFixed(1)).toLocaleString('pt-BR')}%`
  const curta = `${e.base} × ${pct(e.taxaAplicada)}`
  if (metrica === 'reunioes_agendadas') {
    return { curta, extenso: `${e.base} leads qualificados × ${pct(e.taxaAplicada)} (taxa ideal SDR) = ${e.ideal}` }
  }
  if (metrica === 'reunioes_realizadas') {
    const fora = reunioesASerem > 0 ? ` — ${reunioesASerem} agendada(s) ainda por acontecer fora da conta` : ''
    return {
      curta,
      extenso: `${e.base} reuniões agendadas já ocorridas × ${pct(e.taxaAplicada)} (1 − no-show ideal de ${pct(100 - e.taxaAplicada)}) = ${e.ideal}${fora}`,
    }
  }
  return { curta, extenso: `${e.base} reuniões realizadas × ${pct(e.taxaAplicada)} (taxa ideal Closer) = ${e.ideal}` }
}

/**
 * Ideal Recalculado de uma meta segmentada (canal/responsável): funil do
 * escopo + taxas com a sobrescrita do escopo. null se a métrica não tem
 * etapa anterior.
 */
export function idealDaMeta(
  meta: MetaComercial,
  leads: Lead[],
  investimentos: InvestimentoMarketing[],
  taxas: TaxasConversaoIdeal,
): { etapa: IdealEtapa; conta: { curta: string; extenso: string } } | null {
  if (!(METRICAS_COM_IDEAL as string[]).includes(meta.metrica)) return null
  const metrica = meta.metrica as MetricaComIdeal
  const f = funilDaMeta(meta, leads, investimentos)
  const t = taxasIdeaisDoEscopo(taxas, { canal: meta.canal, responsavelId: meta.responsavelId })
  const etapa = idealCascadeDoFunil(f, t)[metrica]
  return { etapa, conta: contaDoIdeal(metrica, etapa, f.reunioesASerem) }
}
