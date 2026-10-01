/**
 * Fonte ÚNICA das "tarefas do dia" da operação de Tráfego: o KPI "Tarefas
 * atrasadas", o painel "Tarefas do dia" e os indicadores da tabela de
 * clientes saem todos daqui.
 *
 * Regra por ocorrência (ver lib/ocorrencias.ts):
 *   - Para hoje: ocorrência prevista pra hoje, ainda pendente;
 *   - Atrasadas: esporádicas vencidas + semanais/mensais com a data passada
 *     e o período ainda aberto;
 *   - Diária não feita no dia vira "perdida" (não entra em atrasadas) e
 *     aparece como "⚠ N perdidas" no cliente (últimos 7 dias).
 * Base: clientes ativos (não arquivados), sem churn e fora de onboarding.
 */
import { resumirDoDia, type ItemDoDia, type RegistroOcorrencia, type ResumoDoDia } from '@/lib/ocorrencias'
import type { Cliente, Tarefa } from '@/types/database'

export type TarefasDoDia = ResumoDoDia

/** Base do KPI: clientes ativos, sem churn e FORA de onboarding. */
function baseDaOperacao(clientes: Cliente[]): (clienteId: string) => boolean {
  const baseAtiva = clientes.filter((c) => !c.arquivado_em && c.status !== 'churn')
  const baseIds = new Set(baseAtiva.map((c) => c.id))
  const onboardingIds = new Set(baseAtiva.filter((c) => c.jornada === 'onboarding').map((c) => c.id))
  return (clienteId) => baseIds.has(clienteId) && !onboardingIds.has(clienteId)
}

export function getTarefasDoDia(
  tarefas: Tarefa[],
  registros: Map<string, RegistroOcorrencia[]>,
  clientes: Cliente[],
  hojeISO: string,
  fallbackDesde?: string,
): TarefasDoDia {
  const naBase = baseDaOperacao(clientes)
  return resumirDoDia(
    tarefas.filter((t) => naBase(t.cliente_id)),
    registros,
    hojeISO,
    fallbackDesde,
  )
}

/** Nº de tarefas atrasadas por cliente — pro indicador da tabela de clientes. */
export function contarAtrasadasPorCliente(atrasadas: ItemDoDia[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const i of atrasadas) m.set(i.tarefa.cliente_id, (m.get(i.tarefa.cliente_id) ?? 0) + 1)
  return m
}
