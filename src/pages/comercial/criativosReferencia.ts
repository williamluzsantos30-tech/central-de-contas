/**
 * Criativos de referência do Funil Tráfego (Meta Ads da PRÓPRIA agência),
 * com os números do print de referência (ranking de leads qualificados,
 * mês de referência 2026-09).
 *
 * Fonte única pro mock de gasto (mockMetaAdsData) e pros leads de exemplo
 * (mockLeads) — assim ranking, custo por qualificado e winrate batem.
 *
 * ESCALA_MOCK: fração do volume do print usada nos leads de exemplo. O print
 * tem 161 qualificados; gerar todos poluiria as filas do Comercial (Closer,
 * Caixa, KPIs). Com 0.25 o ranking mantém a ORDEM, os nomes e o CUSTO POR
 * QUALIFICADO do print. Mude pra 1 pra reproduzir os números exatos.
 *
 * Sem imports de propósito (evita ciclo mockLeads ↔ mockMetaAdsData).
 */
export const ESCALA_MOCK: number = 0.25

/** Mês a que os números do print se referem. */
export const MES_REFERENCIA_CRIATIVOS = '2026-09'

export interface CriativoReferencia {
  /** ID do anúncio na Meta (ad_id). null = sem anúncio (orgânico). */
  idAnuncioMeta: string | null
  nomeAnuncio: string
  /** Qualificados no print. */
  qualificadosRef: number
  /** Gasto do criativo no print (R$). null = sem investimento rastreado. */
  gastoRef: number | null
  /** CTR típico do criativo (%), pro mock de impressões/cliques. */
  ctrRef: number
}

export const CRIATIVOS_REFERENCIA: CriativoReferencia[] = [
  { idAnuncioMeta: '120211470119', nomeAnuncio: 'Ad119 - Review 40 consultas', qualificadosRef: 100, gastoRef: 10204.43, ctrRef: 1.9 },
  { idAnuncioMeta: '120211470134', nomeAnuncio: 'Ad134 - Tráfego P Médico Sem Bullets', qualificadosRef: 29, gastoRef: 2539.71, ctrRef: 1.4 },
  { idAnuncioMeta: null, nomeAnuncio: 'link_in_bio', qualificadosRef: 14, gastoRef: null, ctrRef: 0 },
  { idAnuncioMeta: '120211470137', nomeAnuncio: 'Ad137 - Nina Tela Dividida', qualificadosRef: 11, gastoRef: 692.76, ctrRef: 2.3 },
  { idAnuncioMeta: '120211470091', nomeAnuncio: 'Ad91 - Noele Rerformulado', qualificadosRef: 6, gastoRef: 570.65, ctrRef: 1.1 },
  { idAnuncioMeta: '120211470117', nomeAnuncio: 'Ad117 - Review 42k', qualificadosRef: 1, gastoRef: 10.66, ctrRef: 0.8 },
]

/** Qualificados de cada criativo nos leads de exemplo (na escala do mock). */
export function qualificadosNaEscala(c: CriativoReferencia): number {
  return Math.max(1, Math.round(c.qualificadosRef * ESCALA_MOCK))
}

/**
 * Gasto do criativo no mês de referência, na escala do mock. Mantém o CUSTO
 * POR QUALIFICADO do print (gastoRef ÷ qualificadosRef) mesmo com a escala.
 */
export function gastoNaEscala(c: CriativoReferencia): number | null {
  if (c.gastoRef == null) return null
  if (ESCALA_MOCK === 1) return c.gastoRef
  const cpq = c.gastoRef / c.qualificadosRef
  return Math.round(cpq * qualificadosNaEscala(c) * 100) / 100
}
