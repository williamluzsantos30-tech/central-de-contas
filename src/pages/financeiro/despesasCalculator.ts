/**
 * Cálculos do módulo Financeiro (despesas).
 *
 * `calculateExpensesSummary` é a função-base que os KPI cards da tela Despesas
 * consomem — e que os módulos futuros (DRE, Margens, DRE por Setor…) vão
 * reutilizar. Toda a lógica de período/recorrência/filtro fica aqui pra que
 * "o que aparece na tabela" e "o que os KPIs somam" venham da MESMA fonte.
 */
import type {
  CategoriaDespesa,
  Despesa,
  OrigemDespesa,
  StatusDespesa,
} from './mockDespesas'

// ── Período ("YYYY-MM") ──────────────────────────────────────────────────────
const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function mesAtualISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Desloca o período em `delta` meses (ex.: shiftPeriodo('2026-09', -1) → '2026-08'). */
export function shiftPeriodo(periodo: string, delta: number): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "2026-09" → "Setembro 2026". */
export function formatMesAno(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  return `${MESES_PT[m - 1]} ${y}`
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Status efetivo ───────────────────────────────────────────────────────────
/**
 * Status considerando o vencimento: uma despesa "pendente" cuja competência já
 * passou e que não tem pagamento vira "atrasado" automaticamente (o campo cru
 * segue "pendente"; a UI mostra o efetivo).
 */
export function statusEfetivo(d: Despesa, hojeMes = mesAtualISO()): StatusDespesa {
  if (d.status === 'pendente' && !d.dataPagamento && d.dataCompetencia < hojeMes) return 'atrasado'
  return d.status
}

// ── Recorrência ──────────────────────────────────────────────────────────────
/**
 * Gera as projeções de recorrência para um período: para cada despesa-modelo
 * (mensal_fixa/variavel) ativa no mês que ainda NÃO tem lançamento
 * materializado, cria uma projeção "Pendente" (valor herdado do modelo).
 * Materializar/editar meses passados não é afetado — o histórico é preservado.
 */
function projecoesDoPeriodo(todas: Despesa[], periodo: string): Despesa[] {
  const modelos = todas.filter((d) => d.tipoRecorrencia !== 'unica' && !d.recorrenciaModeloId)
  const proj: Despesa[] = []
  for (const m of modelos) {
    if (m.dataCompetencia >= periodo) continue // ainda não começou, ou é o próprio mês do modelo
    if (m.repetirAte && periodo > m.repetirAte) continue // recorrência encerrada
    const jaMaterializada = todas.some((d) => d.recorrenciaModeloId === m.id && d.dataCompetencia === periodo)
    if (jaMaterializada) continue
    proj.push({
      ...m,
      id: `${m.id}__${periodo}`,
      dataCompetencia: periodo,
      dataPagamento: undefined,
      status: 'pendente',
      recorrenciaModeloId: m.id,
      projecao: true,
    })
  }
  return proj
}

export interface ExpenseFilters {
  categoria?: CategoriaDespesa | ''
  setor?: string
  status?: StatusDespesa | ''
  origem?: OrigemDespesa | ''
  busca?: string
}

function aplicaFiltros(lista: Despesa[], f?: ExpenseFilters): Despesa[] {
  if (!f) return lista
  return lista.filter((d) => {
    if (f.categoria && d.categoria !== f.categoria) return false
    if (f.setor && (d.setor || 'Geral') !== f.setor) return false
    if (f.status && statusEfetivo(d) !== f.status) return false
    if (f.origem && d.origem !== f.origem) return false
    if (f.busca) {
      const q = f.busca.toLowerCase()
      if (!`${d.descricao} ${d.fornecedor ?? ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })
}

/** Despesas efetivas de um período (reais do mês + projeções de recorrência), já filtradas. */
export function despesasDoPeriodo(todas: Despesa[], periodo: string, filtros?: ExpenseFilters): Despesa[] {
  const reais = todas.filter((d) => d.dataCompetencia === periodo)
  const lista = [...reais, ...projecoesDoPeriodo(todas, periodo)]
  const ordem: Record<StatusDespesa, number> = { atrasado: 0, pendente: 1, pago: 2 }
  return aplicaFiltros(lista, filtros).sort((a, b) => {
    const s = ordem[statusEfetivo(a)] - ordem[statusEfetivo(b)]
    return s !== 0 ? s : b.valor - a.valor
  })
}

// ── Resumo (KPIs) ────────────────────────────────────────────────────────────
export interface ExpensesSummary {
  total: number
  fixas: number
  variaveis: number
  pendentesValor: number
  pendentesCount: number
  atrasadasValor: number
  atrasadasCount: number
  aberto: number // pendentes + atrasadas (R$)
  abertoCount: number
  porCategoria: Record<CategoriaDespesa, number>
  porSetor: Record<string, number>
  lancamentos: number
}

/**
 * Totais do período pros KPI cards. Reutilizável pelos módulos financeiros
 * futuros (o DRE consome esta mesma função).
 */
export function calculateExpensesSummary(
  todas: Despesa[],
  periodo: string,
  filtros?: ExpenseFilters,
): ExpensesSummary {
  const lista = despesasDoPeriodo(todas, periodo, filtros)
  const s: ExpensesSummary = {
    total: 0,
    fixas: 0,
    variaveis: 0,
    pendentesValor: 0,
    pendentesCount: 0,
    atrasadasValor: 0,
    atrasadasCount: 0,
    aberto: 0,
    abertoCount: 0,
    porCategoria: {
      custo_fixo: 0,
      custo_variavel: 0,
      despesa_administrativa: 0,
      despesa_comercial: 0,
      impostos: 0,
      despesa_financeira: 0,
    },
    porSetor: {},
    lancamentos: lista.length,
  }
  for (const d of lista) {
    s.total += d.valor
    if (d.tipoRecorrencia === 'mensal_fixa') s.fixas += d.valor
    if (d.categoria === 'custo_variavel' || d.tipoRecorrencia === 'mensal_variavel' || d.tipoRecorrencia === 'unica') {
      s.variaveis += d.valor
    }
    const st = statusEfetivo(d)
    if (st === 'pendente') {
      s.pendentesValor += d.valor
      s.pendentesCount += 1
    } else if (st === 'atrasado') {
      s.atrasadasValor += d.valor
      s.atrasadasCount += 1
    }
    s.porCategoria[d.categoria] += d.valor
    const setor = d.setor || 'Geral'
    s.porSetor[setor] = (s.porSetor[setor] ?? 0) + d.valor
  }
  s.aberto = s.pendentesValor + s.atrasadasValor
  s.abertoCount = s.pendentesCount + s.atrasadasCount
  return s
}
