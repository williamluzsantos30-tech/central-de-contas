/**
 * LTV:CAC — derivado 100% dos dados já existentes, reusando o que os módulos
 * anteriores já calculam:
 *  - Ticket médio / clientes ativos / churn → Clientes (helpers do dreCalculator)
 *  - Margem bruta % → calculateDRE (competência)
 *  - Investimento e nº de fechamentos → calculateMarketingFunnel (Comercial)
 *
 * Fórmulas (padrão SaaS):
 *  - Ticket médio (ARPA) = MRR ativo ÷ nº de clientes ativos (fim do período)
 *  - Churn mensal (logo) = média mensal de (churns ÷ base ativa) no período
 *  - Lifetime (meses)    = 1 ÷ churn mensal (limitado; fallback tempo observado)
 *  - LTV                 = Ticket médio × Margem bruta % × Lifetime
 *  - CAC                 = Investimento de mídia ÷ novos clientes (fechamentos)
 *  - LTV:CAC             = LTV ÷ CAC   ·   Payback = CAC ÷ (Ticket × Margem bruta)
 */
import {
  buildChurnMap,
  calculateDRE,
  churnsCountNoMes,
  contagemAtivosNoMes,
  mrrAtivoNoMes,
  type DreInput,
} from './dreCalculator'
import { calculateMarketingFunnel, periodoMes } from '@/pages/comercial/marketingCalculator'

const LIFETIME_MAX = 60 // teto pra não explodir quando churn ~ 0

export interface LtvCacResult {
  ticketMedio: number
  clientesAtivos: number
  churnMensalPct: number // %
  lifetimeMeses: number
  margemBrutaPct: number // %
  ltv: number
  investimento: number
  novosClientes: number
  cac: number
  ratio: number // LTV ÷ CAC
  paybackMeses: number
}

export function calculateLtvCac(input: DreInput, meses: string[]): LtvCacResult {
  const churns = buildChurnMap(input.clientes, input.eventosChurn)
  const anchor = meses[meses.length - 1]

  // Ticket médio e base ativa no fim do período
  const clientesAtivos = contagemAtivosNoMes(input.clientes, churns, anchor)
  const mrrAtivo = mrrAtivoNoMes(input.clientes, churns, anchor)
  const ticketMedio = clientesAtivos > 0 ? mrrAtivo / clientesAtivos : 0

  // Churn mensal médio (logo churn) ao longo do período
  let somaChurnPct = 0
  for (const m of meses) {
    const churnsMes = churnsCountNoMes(churns, m)
    const ativosMes = contagemAtivosNoMes(input.clientes, churns, m)
    const base = ativosMes + churnsMes
    somaChurnPct += base > 0 ? churnsMes / base : 0
  }
  const churnMensalFrac = meses.length > 0 ? somaChurnPct / meses.length : 0
  const lifetimeMeses = churnMensalFrac > 0 ? Math.min(LIFETIME_MAX, 1 / churnMensalFrac) : LIFETIME_MAX

  // Margem bruta (competência) do período
  const margemBrutaFrac = calculateDRE(input, meses, 'competencia').margemBrutaPct / 100

  const ltv = ticketMedio * margemBrutaFrac * lifetimeMeses

  // Investimento e novos clientes (fechamentos) pelo funil do Comercial
  let investimento = 0
  let novosClientes = 0
  for (const m of meses) {
    const f = calculateMarketingFunnel(input.leads, input.investimentos, periodoMes(m))
    investimento += f.investimento
    novosClientes += f.fechamentos
  }
  const cac = novosClientes > 0 ? investimento / novosClientes : 0
  const ratio = cac > 0 ? ltv / cac : 0
  const margemMensal = ticketMedio * margemBrutaFrac
  const paybackMeses = margemMensal > 0 ? cac / margemMensal : 0

  return {
    ticketMedio,
    clientesAtivos,
    churnMensalPct: churnMensalFrac * 100,
    lifetimeMeses,
    margemBrutaPct: margemBrutaFrac * 100,
    ltv,
    investimento,
    novosClientes,
    cac,
    ratio,
    paybackMeses,
  }
}
