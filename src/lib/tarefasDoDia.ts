/**
 * Fonte ÚNICA de verdade das "tarefas do dia" da operação de Tráfego.
 *
 * Antes, o KPI "Tarefas atrasadas" e o painel "Minhas tarefas de hoje" usavam
 * queries/regras diferentes (KPI = vencidas de qualquer responsável; painel =
 * só as MINHAS com vencimento HOJE), o que gerava a contradição de "KPI 4 +
 * painel vazio". Agora os dois consomem exatamente esta função.
 *
 * Regra (mesma do KPI original): clientes ativos (não arquivados), fora de
 * onboarding e não-churn; tarefa não concluída com prazo <= hoje. Atrasada =
 * prazo < hoje; de hoje = prazo === hoje.
 */
import type { Cliente, Tarefa } from '@/types/database'

export interface TarefasDoDia {
  /** Prazo vencido (< hoje) e não concluída. Mais antiga primeiro. */
  atrasadas: Tarefa[]
  /** Prazo é exatamente hoje e não concluída. */
  hoje: Tarefa[]
}

export function getTarefasDoDia(
  tarefas: Tarefa[],
  clientes: Cliente[],
  hojeISO: string,
): TarefasDoDia {
  // Mesma base do KPI: clientes ativos, sem churn, e onboarding é excluído.
  const baseAtiva = clientes.filter((c) => !c.arquivado_em && c.status !== 'churn')
  const baseIds = new Set(baseAtiva.map((c) => c.id))
  const onboardingIds = new Set(
    baseAtiva.filter((c) => c.jornada === 'onboarding').map((c) => c.id),
  )

  const atrasadas: Tarefa[] = []
  const hoje: Tarefa[] = []
  for (const t of tarefas) {
    if (t.status === 'concluida') continue
    if (!t.data_vencimento) continue
    if (!baseIds.has(t.cliente_id) || onboardingIds.has(t.cliente_id)) continue
    const venc = t.data_vencimento.slice(0, 10)
    if (venc < hojeISO) atrasadas.push(t)
    else if (venc === hojeISO) hoje.push(t)
  }

  // Atrasadas: mais antiga primeiro (prioridade visual no topo).
  atrasadas.sort((a, b) =>
    (a.data_vencimento ?? '') < (b.data_vencimento ?? '')
      ? -1
      : (a.data_vencimento ?? '') > (b.data_vencimento ?? '')
        ? 1
        : 0,
  )
  return { atrasadas, hoje }
}

/** Nº de tarefas atrasadas por cliente — pro indicador da tabela de clientes. */
export function contarAtrasadasPorCliente(atrasadas: Tarefa[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of atrasadas) m.set(t.cliente_id, (m.get(t.cliente_id) ?? 0) + 1)
  return m
}

/** Rótulo "Vencida há N dia(s)" (hoje local) pra um prazo ISO 'YYYY-MM-DD'. */
export function vencidaHaLabel(dateISO: string, agora: Date = new Date()): string {
  const alvo = new Date(dateISO.slice(0, 10) + 'T00:00:00')
  const hoje = new Date(agora)
  hoje.setHours(0, 0, 0, 0)
  const dias = Math.round((hoje.getTime() - alvo.getTime()) / 86400000)
  if (dias <= 0) return 'Vence hoje'
  return `Vencida há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}
