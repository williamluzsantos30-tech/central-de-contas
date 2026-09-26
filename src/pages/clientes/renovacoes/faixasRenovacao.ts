/**
 * Faixas de urgência das renovações — fonte ÚNICA pra barra do resumo, blocos,
 * mapa e pílula de dias da tabela (mesma cor = mesma faixa em toda a tela).
 *
 * Cores validadas (dataviz validate_palette, claro e escuro): separação pra
 * daltonismo e visão normal OK entre vizinhas; o cinza é neutro de propósito
 * ("no radar", sem ação). Contraste baixo do amarelo no tema claro é coberto
 * por rótulo visível + tabela.
 */
import type { Tone } from '@/components/ds'

export type FaixaId = 'vencido' | 'ate15' | 'ate30' | 'ate90' | 'emDia'

export interface Faixa {
  id: FaixaId
  label: string
  /** Descrição curta pro tooltip/bloco. */
  dica: string
  /** Cor da marca (barra, ponto, progresso) — hex, igual nos dois temas. */
  cor: string
  /** Tom do DS pra badges/pílulas. */
  tone: Tone
}

export const FAIXAS: Faixa[] = [
  { id: 'vencido', label: 'Vencidos', dica: 'contrato já venceu', cor: '#c81e1e', tone: 'danger' },
  { id: 'ate15', label: 'Até 15 dias', dica: 'renovar agora', cor: '#f97316', tone: 'warning' },
  { id: 'ate30', label: '16 a 30 dias', dica: 'preparar a renovação', cor: '#facc15', tone: 'attention' },
  { id: 'ate90', label: '31 a 90 dias', dica: 'no radar', cor: '#a1a1aa', tone: 'neutral' },
  { id: 'emDia', label: 'Mais de 90 dias', dica: 'em dia', cor: '#16a34a', tone: 'success' },
]

export const FAIXA_POR_ID = Object.fromEntries(FAIXAS.map((f) => [f.id, f])) as Record<FaixaId, Faixa>

export function faixaDe(dias: number): Faixa {
  if (dias < 0) return FAIXA_POR_ID.vencido
  if (dias <= 15) return FAIXA_POR_ID.ate15
  if (dias <= 30) return FAIXA_POR_ID.ate30
  if (dias <= 90) return FAIXA_POR_ID.ate90
  return FAIXA_POR_ID.emDia
}

/** "Vencido há 3d" / "Vence hoje" / "12d". */
export function textoDias(dias: number): string {
  if (dias < 0) return `Vencido há ${Math.abs(dias)}d`
  if (dias === 0) return 'Vence hoje'
  return `${dias}d`
}

export const RISCO_COR: Record<'vermelho' | 'laranja' | 'amarelo' | 'verde', { label: string; cor: string; ordem: number }> = {
  vermelho: { label: 'Crítico', cor: '#c81e1e', ordem: 0 },
  laranja: { label: 'Risco', cor: '#f97316', ordem: 1 },
  amarelo: { label: 'Atenção', cor: '#facc15', ordem: 2 },
  verde: { label: 'Estável', cor: '#16a34a', ordem: 3 },
}

export const TIPO_CONTRATO_LABEL: Record<string, string> = {
  mensal: 'Mensal',
  '3_meses': '3 meses',
  '6_meses': '6 meses',
  '12_meses': '12 meses',
  anual: 'Anual',
  indefinido: 'Indefinido',
}

export const fmtBRL0 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
