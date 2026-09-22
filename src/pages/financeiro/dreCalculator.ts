/**
 * DRE (Demonstração de Resultado) — cálculo 100% derivado dos dados já
 * existentes. NÃO introduz dado novo:
 *  - Receita Competência = MRR ativo dos Clientes (mesma base de Resumo Geral)
 *  - Receita Caixa       = Caixa Recolhido dos Leads fechados (Comercial), via
 *                          calculateMarketingFunnel
 *  - Deduções/Churn      = MRR perdido no período (mesma base de Churns)
 *  - Custos/Despesas      = Despesas por categoria/setor (despesasDoPeriodo)
 *  - CAC                  = Investimento de mídia (calculateMarketingFunnel)
 *
 * Regras de bucket (P&L que reconcilia — nada de dinheiro sumindo):
 *  - CUSTOS DIRETOS (CMV) = custo_fixo + custo_variavel em setores que
 *    "produzem" o serviço (Tráfego, Social Media, Design) + CAC do período.
 *  - DESPESAS OPERACIONAIS = despesa_administrativa + despesa_comercial +
 *    custo_fixo/custo_variavel FORA dos setores operacionais (overhead:
 *    folha administrativa, energia da sede etc.) — assim nenhuma despesa fica
 *    de fora da demonstração.
 *  - DESPESAS FINANCEIRAS = despesa_financeira · IMPOSTOS = impostos.
 */
import type { Despesa } from './mockDespesas'
import { despesasDoPeriodo } from './despesasCalculator'
import type { InvestimentoMarketing } from '@/pages/comercial/mockInvestimentos'
import type { Lead } from '@/pages/comercial/mockLeads'
import { calculateMarketingFunnel, periodoMes } from '@/pages/comercial/marketingCalculator'

/** Setores que entregam o serviço vendido → custos diretos (CMV/CPV). */
export const SETORES_OPERACIONAIS = ['Tráfego', 'Social Media', 'Design']

export type RegimeDRE = 'competencia' | 'caixa'
export type ModoPeriodo = 'mes' | 'trimestre' | 'ano'

// ── Fontes de cliente (subset das colunas usadas) ────────────────────────────
export interface ClienteDRE {
  id: string
  verba_mensal: number | null
  status: string
  arquivado_em: string | null
  data_inicio: string | null
}
export interface EventoChurnDRE {
  cliente_id: string
  criado_em: string
  meta: { data?: string; valor_perdido?: number } | null
}

export interface DreInput {
  clientes: ClienteDRE[]
  eventosChurn: EventoChurnDRE[]
  leads: Lead[]
  investimentos: InvestimentoMarketing[]
  despesas: Despesa[]
}

const mesDe = (iso?: string | null) => (iso ? iso.slice(0, 7) : '')

export type ChurnMap = Map<string, { mes: string; valor: number }>

/** Mapa clienteId → { mes do churn, valor perdido } (último evento; fallback arquivado_em). */
export function buildChurnMap(clientes: ClienteDRE[], eventos: EventoChurnDRE[]): ChurnMap {
  const ultimo = new Map<string, EventoChurnDRE>()
  for (const ev of eventos) {
    const cur = ultimo.get(ev.cliente_id)
    const d = new Date(ev.meta?.data ?? ev.criado_em).getTime()
    const dCur = cur ? new Date(cur.meta?.data ?? cur.criado_em).getTime() : -Infinity
    if (!cur || d >= dCur) ultimo.set(ev.cliente_id, ev)
  }
  const map = new Map<string, { mes: string; valor: number }>()
  for (const c of clientes) {
    const ev = ultimo.get(c.id)
    if (c.status === 'churn' || ev) {
      const dataChurn = ev?.meta?.data ?? c.arquivado_em ?? ''
      const mes = mesDe(dataChurn)
      if (mes) map.set(c.id, { mes, valor: ev?.meta?.valor_perdido ?? c.verba_mensal ?? 0 })
    }
  }
  return map
}

/** MRR ativo em um mês (clientes que já começaram e ainda não haviam dado churn). */
export function mrrAtivoNoMes(clientes: ClienteDRE[], churns: ChurnMap, mes: string): number {
  let total = 0
  for (const c of clientes) {
    const start = mesDe(c.data_inicio)
    if (!start || start > mes) continue // ainda não começou
    const churn = churns.get(c.id)
    if (churn && churn.mes <= mes) continue // já havia dado churn
    total += churn ? churn.valor : c.verba_mensal ?? 0
  }
  return total
}

/** Nº de clientes ativos em um mês (mesmo critério do mrrAtivoNoMes). */
export function contagemAtivosNoMes(clientes: ClienteDRE[], churns: ChurnMap, mes: string): number {
  let n = 0
  for (const c of clientes) {
    const start = mesDe(c.data_inicio)
    if (!start || start > mes) continue
    const churn = churns.get(c.id)
    if (churn && churn.mes <= mes) continue
    n++
  }
  return n
}

/** MRR perdido (churn) no mês. */
export function mrrPerdidoNoMes(churns: ChurnMap, mes: string): number {
  let total = 0
  for (const { mes: m, valor } of churns.values()) if (m === mes) total += valor
  return total
}

/** Nº de churns (logo churn) no mês. */
export function churnsCountNoMes(churns: ChurnMap, mes: string): number {
  let n = 0
  for (const { mes: m } of churns.values()) if (m === mes) n++
  return n
}

export interface DreResult {
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  custosDiretosDespesas: number
  cac: number
  custosDiretos: number
  margemBruta: number
  margemBrutaPct: number
  despesasOperacionais: number
  ebitda: number
  despesasFinanceiras: number
  impostos: number
  lucroLiquido: number
  margemLiquidaPct: number
}

/** DRE consolidada sobre `meses` (1 mês, trimestre ou ano), no regime dado. */
export function calculateDRE(input: DreInput, meses: string[], regime: RegimeDRE): DreResult {
  const churns = buildChurnMap(input.clientes, input.eventosChurn)

  let receitaBruta = 0
  let deducoes = 0
  let custosDiretosDespesas = 0
  let cac = 0
  let despesasOperacionais = 0
  let despesasFinanceiras = 0
  let impostos = 0

  for (const mes of meses) {
    // Receita
    if (regime === 'competencia') {
      receitaBruta += mrrAtivoNoMes(input.clientes, churns, mes)
    } else {
      receitaBruta += calculateMarketingFunnel(input.leads, input.investimentos, periodoMes(mes)).caixaRecolhido
    }
    // Deduções (churn)
    deducoes += mrrPerdidoNoMes(churns, mes)
    // CAC = investimento de mídia do mês
    cac += calculateMarketingFunnel(input.leads, input.investimentos, periodoMes(mes)).investimento
    // Despesas do mês (com recorrências expandidas), segmentadas
    for (const d of despesasDoPeriodo(input.despesas, mes)) {
      const ehCusto = d.categoria === 'custo_fixo' || d.categoria === 'custo_variavel'
      const setorOperacional = SETORES_OPERACIONAIS.includes(d.setor || '')
      if (ehCusto && setorOperacional) custosDiretosDespesas += d.valor
      else if (ehCusto) despesasOperacionais += d.valor // custo fixo/variável de overhead
      else if (d.categoria === 'despesa_administrativa' || d.categoria === 'despesa_comercial') despesasOperacionais += d.valor
      else if (d.categoria === 'despesa_financeira') despesasFinanceiras += d.valor
      else if (d.categoria === 'impostos') impostos += d.valor
    }
  }

  const receitaLiquida = receitaBruta - deducoes
  const custosDiretos = custosDiretosDespesas + cac
  const margemBruta = receitaLiquida - custosDiretos
  const margemBrutaPct = receitaLiquida !== 0 ? (margemBruta / receitaLiquida) * 100 : 0
  const ebitda = margemBruta - despesasOperacionais
  const lucroLiquido = ebitda - despesasFinanceiras - impostos
  const margemLiquidaPct = receitaLiquida !== 0 ? (lucroLiquido / receitaLiquida) * 100 : 0

  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    custosDiretosDespesas,
    cac,
    custosDiretos,
    margemBruta,
    margemBrutaPct,
    despesasOperacionais,
    ebitda,
    despesasFinanceiras,
    impostos,
    lucroLiquido,
    margemLiquidaPct,
  }
}

// ── Período (mês/trimestre/ano) ──────────────────────────────────────────────
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/** Meses "YYYY-MM" cobertos pelo período que contém `ref` no modo dado. */
export function mesesDoPeriodo(ref: string, modo: ModoPeriodo): string[] {
  const [y, m] = ref.split('-').map(Number)
  if (modo === 'mes') return [ref]
  if (modo === 'ano') return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`)
  // trimestre: bloco de 3 meses que contém m
  const qStart = Math.floor((m - 1) / 3) * 3 + 1
  return [0, 1, 2].map((i) => `${y}-${String(qStart + i).padStart(2, '0')}`)
}

/** `ref` do período imediatamente anterior (mês/trimestre/ano). */
export function refAnterior(ref: string, modo: ModoPeriodo): string {
  const [y, m] = ref.split('-').map(Number)
  const passo = modo === 'mes' ? 1 : modo === 'trimestre' ? 3 : 12
  const d = new Date(y, m - 1 - passo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** `ref` deslocada em `delta` unidades do modo (pra navegação ◀ ▶). */
export function shiftRef(ref: string, modo: ModoPeriodo, delta: number): string {
  const [y, m] = ref.split('-').map(Number)
  const passo = (modo === 'mes' ? 1 : modo === 'trimestre' ? 3 : 12) * delta
  const d = new Date(y, m - 1 + passo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function labelPeriodo(ref: string, modo: ModoPeriodo): string {
  const [y, m] = ref.split('-').map(Number)
  if (modo === 'ano') return String(y)
  if (modo === 'trimestre') return `${Math.floor((m - 1) / 3) + 1}º Tri ${y}`
  return `${MESES_PT[m - 1]} ${y}`
}

/** Últimos `n` meses (inclui `refMes`) — pro gráfico de evolução. */
export function ultimosMeses(refMes: string, n: number): string[] {
  const [y, m] = refMes.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export function labelMesCurto(mesISO: string): string {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const [y, m] = mesISO.split('-').map(Number)
  return `${meses[m - 1]}/${String(y).slice(2)}`
}
