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

/** Base do KPI: clientes ativos, sem churn e FORA de onboarding. */
function baseDaOperacao(clientes: Cliente[]): (clienteId: string) => boolean {
  const baseAtiva = clientes.filter((c) => !c.arquivado_em && c.status !== 'churn')
  const baseIds = new Set(baseAtiva.map((c) => c.id))
  const onboardingIds = new Set(
    baseAtiva.filter((c) => c.jornada === 'onboarding').map((c) => c.id),
  )
  return (clienteId) => baseIds.has(clienteId) && !onboardingIds.has(clienteId)
}

export function getTarefasDoDia(
  tarefas: Tarefa[],
  clientes: Cliente[],
  hojeISO: string,
): TarefasDoDia {
  // Mesma base do KPI: clientes ativos, sem churn, e onboarding é excluído.
  const naBase = baseDaOperacao(clientes)

  const atrasadas: Tarefa[] = []
  const hoje: Tarefa[] = []
  for (const t of tarefas) {
    if (t.status === 'concluida') continue
    if (!t.data_vencimento) continue
    if (!naBase(t.cliente_id)) continue
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

export interface PrazoTarefas {
  /** Concluídas até o vencimento. */
  noPrazo: number
  /** Concluídas depois do vencimento OU vencidas e não concluídas (atrasadas). */
  foraDoPrazo: number
  /** Não concluídas e ainda dentro do prazo (não contam no %). */
  pendentes: number
}

/**
 * Pontualidade das tarefas com vencimento em [desdeISO, hojeISO] — mesma base
 * e mesma regra de "atrasada" do KPI acima (prazo < hoje e não concluída),
 * mais as concluídas depois do prazo (data_conclusao > data_vencimento).
 * Usado na Performance da Equipe (Gestor de Tráfego: % tarefas no prazo).
 */
export function classificarPrazoTarefas(
  tarefas: Tarefa[],
  clientes: Cliente[],
  hojeISO: string,
  desdeISO: string | null,
): PrazoTarefas {
  const naBase = baseDaOperacao(clientes)
  const r: PrazoTarefas = { noPrazo: 0, foraDoPrazo: 0, pendentes: 0 }
  for (const t of tarefas) {
    if (!t.data_vencimento || !naBase(t.cliente_id)) continue
    const venc = t.data_vencimento.slice(0, 10)
    if (venc > hojeISO || (desdeISO && venc < desdeISO)) continue
    if (t.status === 'concluida') {
      const concl = t.data_conclusao?.slice(0, 10)
      if (concl && concl > venc) r.foraDoPrazo++
      else r.noPrazo++
    } else if (venc < hojeISO) r.foraDoPrazo++
    else r.pendentes++
  }
  return r
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
