/**
 * Investimento de mídia por período e canal — input MANUAL (não deriva dos
 * leads). Alimenta os cálculos de CPL, CAC, ROAS etc. no painel de Marketing.
 * Mock: guardado no ComercialProvider (estado), seed daqui.
 */
export interface InvestimentoMarketing {
  id: string
  periodo: string // "YYYY-MM"
  canal: string // rótulo canônico: "Meta Ads", "Google Ads", "Indicação"...
  valor: number
}

/** Canais canônicos (base pros selects de investimento/meta por canal). */
export const CANAIS_MARKETING = ['Meta Ads', 'Google Ads', 'Indicação', 'Social Selling', 'Inbound', 'Orgânico']

// Seed: 3+ canais no mês corrente (set/2026) + mês anterior pra comparação.
export const MOCK_INVESTIMENTOS: InvestimentoMarketing[] = [
  { id: 'inv-1', periodo: '2026-09', canal: 'Meta Ads', valor: 5200 },
  { id: 'inv-2', periodo: '2026-09', canal: 'Google Ads', valor: 2756 },
  { id: 'inv-3', periodo: '2026-09', canal: 'Indicação', valor: 0 },
  { id: 'inv-4', periodo: '2026-09', canal: 'Social Selling', valor: 0 },
  // Mês anterior (agosto) — comparação
  { id: 'inv-5', periodo: '2026-08', canal: 'Meta Ads', valor: 4800 },
  { id: 'inv-6', periodo: '2026-08', canal: 'Google Ads', valor: 2400 },
]
