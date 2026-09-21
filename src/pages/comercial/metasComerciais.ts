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
    case 'leads': return f.leads
    case 'leads_qualificados': return f.qualificados
    case 'reunioes_agendadas': return f.reunioesAgendadas
    case 'reunioes_realizadas': return f.reunioesRealizadas
    case 'fechamentos': return f.fechamentos
    case 'mrr': return f.mrr
    case 'caixa_recolhido': return f.caixaRecolhido
    case 'contrato_fechado': return f.contratoFechado
    case 'taxa_agendamento': return f.taxaAgendamento
    case 'taxa_conversao': return f.txConversao
    case 'no_show_max': return f.noShowPct
  }
}

export function calculateGoalProgress(
  meta: MetaComercial,
  leads: Lead[],
  investimentos: InvestimentoMarketing[],
): GoalProgress {
  const periodo = meta.periodicidade === 'mensal' ? periodoMes(meta.periodoReferencia) : periodoSemana(meta.periodoReferencia)
  // Escopo por responsável: filtra os leads do SDR/Closer antes de calcular.
  const base = meta.responsavelId
    ? leads.filter((l) => l.sdrId === meta.responsavelId || l.closerId === meta.responsavelId)
    : leads
  const f = calculateMarketingFunnel(base, investimentos, periodo, meta.canal)
  const valorAtual = metricaValor(f, meta.metrica)
  const invertida = !!metricaInfo(meta.metrica).invertida

  if (invertida) {
    // Meta = limite máximo. Quanto do limite foi consumido.
    const ratio = meta.valorMeta > 0 ? valorAtual / meta.valorMeta : valorAtual > 0 ? Infinity : 0
    const status: StatusMeta = ratio <= 0.7 ? 'success' : ratio <= 1 ? 'atencao' : 'critico'
    return { valorAtual, percentual: ratio * 100, status, invertida }
  }

  const percentual = meta.valorMeta > 0 ? (valorAtual / meta.valorMeta) * 100 : 0
  const status: StatusMeta = percentual >= 100 ? 'success' : percentual >= 50 ? 'atencao' : 'critico'
  return { valorAtual, percentual, status, invertida }
}
