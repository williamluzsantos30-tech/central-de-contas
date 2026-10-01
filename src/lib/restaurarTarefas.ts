/**
 * "Restaurar padrões" das tarefas de um cliente:
 *   1. tarefas RECORRENTES personalizadas (sem template) são desativadas
 *      (status 'cancelada') — somem da lista, o histórico de ocorrências fica;
 *   2. cada tarefa padrão volta à configuração do template (nome, descrição,
 *      frequência, prioridade, dia) e ao responsável padrão do cliente
 *      (gestor de tráfego > account manager); duplicadas são desativadas;
 *   3. templates ativos que faltam são criados.
 * Esporádicas não são tocadas. Nada é apagado.
 */
import { supabase } from '@/lib/supabase'
import { hojeISO, modeloDaTarefa, ocorrenciaAtual } from '@/lib/ocorrencias'
import { ocorrenciasNoBanco } from '@/lib/ocorrenciasStore'
import type { Cliente, TaskTemplate, Tarefa } from '@/types/database'

export interface ResultadoRestauracao {
  restauradas: number
  criadas: number
  removidas: number
}

const ativa = (t: Pick<Tarefa, 'status'>) => t.status === 'pendente' || t.status === 'em_andamento'

export async function restaurarTarefasPadrao(cliente: Pick<Cliente, 'id' | 'modulos' | 'gestor_id' | 'account_manager_id'>): Promise<ResultadoRestauracao> {
  const [tplRes, tRes] = await Promise.all([
    supabase.from('task_templates').select('*').eq('ativo', true),
    supabase.from('tarefas').select('*').eq('cliente_id', cliente.id),
  ])
  if (tplRes.error) throw new Error(tplRes.error.message)
  if (tRes.error) throw new Error(tRes.error.message)

  const modulosCliente = cliente.modulos?.length ? cliente.modulos : ['trafego']
  const templates = ((tplRes.data as TaskTemplate[]) ?? []).filter(
    (tt) => tt.frequencia !== 'esporadica' && (tt.modulos?.length ? tt.modulos : ['trafego']).some((m) => modulosCliente.includes(m)),
  )
  const tarefas = (tRes.data as Tarefa[]) ?? []
  const responsavel = cliente.gestor_id ?? cliente.account_manager_id ?? null
  // Colunas da migration 098 só vão no payload quando ela já rodou.
  const comColunas098 = ocorrenciasNoBanco() === true
  const hoje = hojeISO()
  const r: ResultadoRestauracao = { restauradas: 0, criadas: 0, removidas: 0 }

  async function desativar(ids: string[]) {
    if (ids.length === 0) return
    const { error } = await supabase.from('tarefas').update({ status: 'cancelada' }).in('id', ids)
    if (error) throw new Error(error.message)
    r.removidas += ids.length
  }

  const idsTemplates = new Set(templates.map((tt) => tt.id))
  // 1) personalizadas recorrentes + padrão de templates que saíram/mudaram de módulo
  await desativar(
    tarefas
      .filter((t) => t.frequencia !== 'esporadica' && ativa(t) && (!t.template_id || !idsTemplates.has(t.template_id)))
      .map((t) => t.id),
  )

  // 2) e 3) cada template: reaproveita a tarefa existente (ativa primeiro) ou cria
  for (const tt of templates) {
    const doTemplate = tarefas
      .filter((t) => t.template_id === tt.id)
      .sort((a, b) => Number(ativa(b)) - Number(ativa(a)) || (a.updated_at < b.updated_at ? 1 : -1))
    const alvo = doTemplate[0]
    const original = {
      nome: tt.nome,
      descricao: tt.descricao,
      frequencia: tt.frequencia,
      prioridade: tt.prioridade,
      responsavel_id: responsavel,
      status: 'pendente' as const,
      ...(comColunas098 ? { dia_referencia: null } : {}),
    }
    // Reativada: conta ocorrências a partir de hoje (o período desativado não vira "perdida").
    const reativar = alvo && !ativa(alvo) && comColunas098 ? { ocorrencias_desde: hoje } : {}
    const base = { ...(alvo ?? { id: 'novo', cliente_id: cliente.id, template_id: tt.id, created_at: `${hoje}T00:00:00`, data_vencimento: null }), ...original, template: tt } as Tarefa
    const vencimento = ocorrenciaAtual(modeloDaTarefa({ ...base, ocorrencias_desde: alvo ? (reativar.ocorrencias_desde ?? alvo.ocorrencias_desde) : hoje }), [], hoje)?.dataPrevista ?? null

    if (alvo) {
      const { error } = await supabase
        .from('tarefas')
        .update({ ...original, ...reativar, data_vencimento: vencimento })
        .eq('id', alvo.id)
      if (error) throw new Error(error.message)
      r.restauradas++
      await desativar(doTemplate.slice(1).filter(ativa).map((t) => t.id))
    } else {
      const { error } = await supabase.from('tarefas').insert({
        cliente_id: cliente.id,
        template_id: tt.id,
        ...original,
        data_vencimento: vencimento,
        ...(comColunas098 ? { ocorrencias_desde: hoje } : {}),
      })
      if (error) throw new Error(error.message)
      r.criadas++
    }
  }
  return r
}
