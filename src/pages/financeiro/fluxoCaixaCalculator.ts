/**
 * Fluxo de Caixa — regime de CAIXA (quando o dinheiro efetivamente entra/sai),
 * complementar ao DRE (competência). 100% derivado dos dados existentes.
 *
 * ENTRADAS (dinheiro que entra no mês):
 *  - Recebimentos recorrentes = MRR ativo do mês (assume que os clientes pagam
 *    no mês — não há evento de pagamento por parcela no sistema)
 *  - Caixa recolhido = entradas pontuais dos fechamentos (Comercial)
 *
 * SAÍDAS (dinheiro que sai no mês):
 *  - Despesas pagas = despesas cujo PAGAMENTO (dataPagamento; fallback
 *    competência quando "pago" sem data) cai no mês — o diferencial do regime
 *    de caixa vs. DRE (que usa competência)
 *  - Investimento em marketing = mídia paga do mês
 *
 * A PAGAR (previsto) = despesas do mês ainda em aberto (pendentes/atrasadas,
 * incluindo recorrências não confirmadas) — saída futura, fora do caixa realizado.
 */
import { buildChurnMap, mrrAtivoNoMes, type DreInput } from './dreCalculator'
import { despesasDoPeriodo, statusEfetivo } from './despesasCalculator'
import { calculateMarketingFunnel, periodoMes } from '@/pages/comercial/marketingCalculator'
import type { Despesa } from './mockDespesas'

/** Mês (YYYY-MM) em que a despesa impacta o caixa, ou null se ainda não saiu. */
function mesPagamento(d: Despesa): string | null {
  if (d.dataPagamento) return d.dataPagamento.slice(0, 7)
  if (d.status === 'pago') return d.dataCompetencia
  return null
}

export interface FluxoCaixaResult {
  entradasRecorrente: number
  entradasCaixaRecolhido: number
  entradas: number
  saidasDespesasPagas: number
  saidasInvestimento: number
  saidas: number
  fluxoLiquido: number
  aPagarPrevisto: number
}

export function calculateFluxoCaixa(input: DreInput, meses: string[]): FluxoCaixaResult {
  const churns = buildChurnMap(input.clientes, input.eventosChurn)
  const mesesSet = new Set(meses)

  let entradasRecorrente = 0
  let entradasCaixaRecolhido = 0
  let saidasInvestimento = 0
  let aPagarPrevisto = 0

  for (const mes of meses) {
    entradasRecorrente += mrrAtivoNoMes(input.clientes, churns, mes)
    const f = calculateMarketingFunnel(input.leads, input.investimentos, periodoMes(mes))
    entradasCaixaRecolhido += f.caixaRecolhido
    saidasInvestimento += f.investimento
    // A pagar (previsto) = despesas do mês ainda em aberto
    for (const d of despesasDoPeriodo(input.despesas, mes)) {
      if (statusEfetivo(d) !== 'pago') aPagarPrevisto += d.valor
    }
  }

  // Saídas pagas: percorre as despesas REAIS (sem expandir recorrência —
  // projeção não paga não move caixa) e soma o que foi pago dentro do período.
  let saidasDespesasPagas = 0
  for (const d of input.despesas) {
    const mp = mesPagamento(d)
    if (mp && mesesSet.has(mp)) saidasDespesasPagas += d.valor
  }

  const entradas = entradasRecorrente + entradasCaixaRecolhido
  const saidas = saidasDespesasPagas + saidasInvestimento
  return {
    entradasRecorrente,
    entradasCaixaRecolhido,
    entradas,
    saidasDespesasPagas,
    saidasInvestimento,
    saidas,
    fluxoLiquido: entradas - saidas,
    aPagarPrevisto,
  }
}

/** Fluxo líquido de um único mês (atalho). */
export function fluxoLiquidoMes(input: DreInput, mes: string): number {
  return calculateFluxoCaixa(input, [mes]).fluxoLiquido
}

/**
 * Saldo acumulado (base 0) até o mês informado — soma dos fluxos líquidos numa
 * janela de `lookback` meses terminando em `mesInclusivo`. Serve de "saldo
 * inicial/final" corrente, já que não há saldo bancário real no sistema.
 */
export function saldoAcumuladoAte(input: DreInput, mesInclusivo: string, lookback = 36): number {
  const [y, m] = mesInclusivo.split('-').map(Number)
  let saldo = 0
  for (let i = lookback - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    saldo += fluxoLiquidoMes(input, mes)
  }
  return saldo
}
