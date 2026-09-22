/**
 * DRE por Setor — custos e despesas segmentados por setor (centro de custo).
 * Decisão do usuário: NÃO ratear receita por setor. A receita/margem fica só
 * no consolidado da empresa; cada setor mostra quanto consome, por categoria.
 *
 * 100% derivado: despesas (têm `setor` e `categoria`) + receita líquida do DRE
 * (competência) pro "% da receita" + investimento de mídia (CAC) mostrado à
 * parte, pois não é alocável a um setor.
 */
import { CATEGORIAS, SETORES_DESPESA, type CategoriaDespesa } from './mockDespesas'
import { despesasDoPeriodo } from './despesasCalculator'
import { calculateDRE, type DreInput } from './dreCalculator'
import { calculateMarketingFunnel, periodoMes } from '@/pages/comercial/marketingCalculator'

export const CATEGORIA_KEYS = CATEGORIAS.map((c) => c.key)

function zeroCategorias(): Record<CategoriaDespesa, number> {
  return {
    custo_fixo: 0,
    custo_variavel: 0,
    despesa_administrativa: 0,
    despesa_comercial: 0,
    impostos: 0,
    despesa_financeira: 0,
  }
}

export interface SetorLinha {
  setor: string
  porCategoria: Record<CategoriaDespesa, number>
  total: number
  pctTotal: number // % do custo total da empresa (só despesas)
  pctReceita: number // custo do setor ÷ receita líquida
}

export interface DreSetorResult {
  setores: SetorLinha[]
  totalPorCategoria: Record<CategoriaDespesa, number>
  totalDespesas: number
  investimentoCac: number
  custoTotalEmpresa: number // despesas + CAC
  receitaLiquida: number
  resultado: number // receita líquida − custo total
}

export function calculateDreSetor(input: DreInput, meses: string[]): DreSetorResult {
  const porSetor = new Map<string, Record<CategoriaDespesa, number>>()
  for (const s of SETORES_DESPESA) porSetor.set(s, zeroCategorias())
  const totalPorCategoria = zeroCategorias()

  let investimentoCac = 0
  for (const mes of meses) {
    investimentoCac += calculateMarketingFunnel(input.leads, input.investimentos, periodoMes(mes)).investimento
    for (const d of despesasDoPeriodo(input.despesas, mes)) {
      const setor = d.setor || 'Geral'
      if (!porSetor.has(setor)) porSetor.set(setor, zeroCategorias())
      porSetor.get(setor)![d.categoria] += d.valor
      totalPorCategoria[d.categoria] += d.valor
    }
  }

  const totalDespesas = CATEGORIA_KEYS.reduce((s, k) => s + totalPorCategoria[k], 0)
  const receitaLiquida = calculateDRE(input, meses, 'competencia').receitaLiquida

  const setores: SetorLinha[] = [...porSetor.entries()].map(([setor, porCategoria]) => {
    const total = CATEGORIA_KEYS.reduce((s, k) => s + porCategoria[k], 0)
    return {
      setor,
      porCategoria,
      total,
      pctTotal: totalDespesas > 0 ? (total / totalDespesas) * 100 : 0,
      pctReceita: receitaLiquida !== 0 ? (total / receitaLiquida) * 100 : 0,
    }
  })
  // Ordena por custo (maior primeiro); setores zerados vão pro fim.
  setores.sort((a, b) => b.total - a.total)

  const custoTotalEmpresa = totalDespesas + investimentoCac
  return {
    setores,
    totalPorCategoria,
    totalDespesas,
    investimentoCac,
    custoTotalEmpresa,
    receitaLiquida,
    resultado: receitaLiquida - custoTotalEmpresa,
  }
}
