/**
 * Metas Comerciais/Marketing — alvos mensais e semanais para as métricas do
 * funil, com escopo Geral / por Canal / por Responsável. O progresso é
 * calculado dos mesmos Leads (via calculateMarketingFunnel) — ver
 * metasComerciais.ts.
 */
import { weekRefOf } from './marketingCalculator'

export type Periodicidade = 'semanal' | 'mensal'

export type MetricaMeta =
  | 'leads'
  | 'leads_qualificados'
  | 'reunioes_agendadas'
  | 'reunioes_realizadas'
  | 'fechamentos'
  | 'mrr'
  | 'caixa_recolhido'
  | 'contrato_fechado'
  | 'taxa_agendamento'
  | 'taxa_conversao'
  | 'no_show_max'

export interface MetaComercial {
  id: string
  periodicidade: Periodicidade
  metrica: MetricaMeta
  canal?: string // opcional — meta geral ou de um canal específico
  responsavelId?: string // opcional — meta da operação ou de um SDR/Closer
  valorMeta: number
  periodoReferencia: string // "YYYY-MM" (mensal) ou data da 2ª-feira (semanal)
}

export type FormatoMetrica = 'num' | 'brl' | 'pct'

export const METRICAS_META: {
  key: MetricaMeta
  label: string
  formato: FormatoMetrica
  /** true quando "menos é melhor" (meta = limite máximo). */
  invertida?: boolean
}[] = [
  { key: 'leads', label: 'Leads', formato: 'num' },
  { key: 'leads_qualificados', label: 'Leads Qualificados', formato: 'num' },
  { key: 'reunioes_agendadas', label: 'Reuniões Agendadas', formato: 'num' },
  { key: 'reunioes_realizadas', label: 'Reuniões Realizadas', formato: 'num' },
  { key: 'fechamentos', label: 'Fechamentos', formato: 'num' },
  { key: 'mrr', label: 'MRR', formato: 'brl' },
  { key: 'caixa_recolhido', label: 'Caixa Recolhido', formato: 'brl' },
  { key: 'contrato_fechado', label: 'Contrato Fechado', formato: 'brl' },
  { key: 'taxa_agendamento', label: 'Taxa de Agendamento', formato: 'pct' },
  { key: 'taxa_conversao', label: 'Taxa de Conversão', formato: 'pct' },
  { key: 'no_show_max', label: 'No-show Máximo', formato: 'pct', invertida: true },
]

export function metricaInfo(metrica: MetricaMeta) {
  return METRICAS_META.find((m) => m.key === metrica) ?? METRICAS_META[0]
}

export function metricaLabel(metrica: MetricaMeta): string {
  return metricaInfo(metrica).label
}

/** Formata um valor conforme o tipo da métrica (número, R$ ou %). */
export function formatMetaValor(metrica: MetricaMeta, valor: number): string {
  const { formato } = metricaInfo(metrica)
  if (formato === 'brl') return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  if (formato === 'pct') return `${valor.toFixed(0)}%`
  return String(Math.round(valor))
}

// Seed: geral mensal, geral semanal, por canal, por responsável.
export const MOCK_METAS_COMERCIAIS: MetaComercial[] = [
  { id: 'meta-1', periodicidade: 'mensal', metrica: 'leads', valorMeta: 200, periodoReferencia: '2026-09' },
  { id: 'meta-2', periodicidade: 'mensal', metrica: 'fechamentos', canal: 'Meta Ads', valorMeta: 6, periodoReferencia: '2026-09' },
  { id: 'meta-3', periodicidade: 'mensal', metrica: 'mrr', valorMeta: 30000, periodoReferencia: '2026-09' },
  { id: 'meta-4', periodicidade: 'semanal', metrica: 'leads', valorMeta: 50, periodoReferencia: weekRefOf() },
  { id: 'meta-5', periodicidade: 'semanal', metrica: 'reunioes_agendadas', responsavelId: 'sdr-1', valorMeta: 15, periodoReferencia: weekRefOf() },
]
