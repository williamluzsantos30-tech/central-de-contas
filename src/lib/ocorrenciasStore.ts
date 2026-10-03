/**
 * Persistência das ocorrências de tarefa (tabela `tarefa_ocorrencias`,
 * migration 098) + ações de concluir/desfazer/observar. Sem a tabela no
 * banco, cai no localStorage (funciona, mas só neste navegador).
 *
 * Também mantém os campos legados de `tarefas` (data_conclusao e
 * data_vencimento = próxima ocorrência) pra "Minhas tarefas" e os outros
 * painéis que ainda leem o vencimento continuarem coerentes.
 */
import { supabase } from '@/lib/supabase'
import { buscarTodos, buscarTodosPorIds } from '@/lib/buscarTodos'
import {
  hojeISO,
  modeloDaTarefa,
  ocorrenciaSeguinte,
  type OcorrenciaTarefa,
  type RegistroOcorrencia,
  type StatusOcorrencia,
} from '@/lib/ocorrencias'
import type { Tarefa } from '@/types/database'

const TABELA = 'tarefa_ocorrencias'
const CHAVE_LOCAL = 'tarefa-ocorrencias-local'
const CHAVE_DESDE = 'tarefa-ocorrencias-desde-local'
const COLUNAS = 'id, tarefa_id, data_prevista, status, concluida_em, concluida_por, observacao'

let modoBanco: boolean | null = null

/** true = banco; false = só neste navegador; null = ainda não sabe. */
export const ocorrenciasNoBanco = () => modoBanco

/**
 * Sem a migration 098 não há `tarefas.ocorrencias_desde`: conta ocorrências a
 * partir do primeiro uso neste navegador (senão todo o passado viraria "perdida").
 */
export function desdeFallback(): string | undefined {
  if (modoBanco !== false) return undefined
  try {
    const salvo = window.localStorage.getItem(CHAVE_DESDE)
    if (salvo) return salvo
    const hoje = hojeISO()
    window.localStorage.setItem(CHAVE_DESDE, hoje)
    return hoje
  } catch {
    return hojeISO()
  }
}

type MapaLocal = Record<string, RegistroOcorrencia>
const chave = (tarefaId: string, data: string) => `${tarefaId}|${data.slice(0, 10)}`

function lerLocal(): MapaLocal {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_LOCAL) ?? '{}') as MapaLocal
  } catch {
    return {}
  }
}
function gravarLocal(m: MapaLocal) {
  try {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(m))
  } catch {
    /* storage indisponível */
  }
}

function agrupar(regs: RegistroOcorrencia[]): Map<string, RegistroOcorrencia[]> {
  const m = new Map<string, RegistroOcorrencia[]>()
  for (const r of regs) {
    const lista = m.get(r.tarefa_id) ?? []
    lista.push({ ...r, data_prevista: r.data_prevista.slice(0, 10) })
    m.set(r.tarefa_id, lista)
  }
  return m
}

/**
 * Registros por tarefa. `tarefaIds` = só essas (tela do cliente); sem ele,
 * todas as da agência a partir de `desde` (lista de clientes) — paginado,
 * porque o Supabase devolve no máximo 1000 linhas por chamada.
 */
export async function carregarRegistros(filtro: { tarefaIds?: string[]; desde?: string }): Promise<Map<string, RegistroOcorrencia[]>> {
  if (filtro.tarefaIds && filtro.tarefaIds.length === 0) return new Map()
  const consulta = (de: number, ate: number, ids?: string[]) => {
    let q = supabase.from(TABELA).select(COLUNAS)
    if (ids) q = q.in('tarefa_id', ids)
    if (filtro.desde) q = q.gte('data_prevista', filtro.desde)
    // Ordem estável (id no desempate) — senão as páginas se repetem.
    return q.order('data_prevista', { ascending: true }).order('id').range(de, ate)
  }
  const { data, error } = filtro.tarefaIds
    ? await buscarTodosPorIds<RegistroOcorrencia>(filtro.tarefaIds, (lote, de, ate) => consulta(de, ate, lote))
    : await buscarTodos<RegistroOcorrencia>((de, ate) => consulta(de, ate))
  if (error) {
    modoBanco = false
    const ids = filtro.tarefaIds ? new Set(filtro.tarefaIds) : null
    return agrupar(Object.values(lerLocal()).filter((r) => (!ids || ids.has(r.tarefa_id)) && (!filtro.desde || r.data_prevista >= filtro.desde)))
  }
  modoBanco = true
  return agrupar(data)
}

async function gravar(reg: RegistroOcorrencia): Promise<void> {
  if (modoBanco !== false) {
    const { id: _id, ...linha } = reg
    const { error } = await supabase.from(TABELA).upsert({ ...linha, updated_at: new Date().toISOString() }, { onConflict: 'tarefa_id,data_prevista' })
    if (!error) {
      modoBanco = true
      return
    }
    if (modoBanco === true) throw new Error(error.message)
    modoBanco = false
  }
  const m = lerLocal()
  m[chave(reg.tarefa_id, reg.data_prevista)] = reg
  gravarLocal(m)
}

async function apagar(tarefaId: string, data: string): Promise<void> {
  if (modoBanco !== false) {
    const { error } = await supabase.from(TABELA).delete().eq('tarefa_id', tarefaId).eq('data_prevista', data)
    if (!error) {
      modoBanco = true
      return
    }
    if (modoBanco === true) throw new Error(error.message)
    modoBanco = false
  }
  const m = lerLocal()
  delete m[chave(tarefaId, data)]
  gravarLocal(m)
}

function registroDe(tarefaId: string, oc: OcorrenciaTarefa, status: StatusOcorrencia, extra: Partial<RegistroOcorrencia> = {}): RegistroOcorrencia {
  return {
    tarefa_id: tarefaId,
    data_prevista: oc.dataPrevista,
    status,
    concluida_em: oc.concluidaEm ?? null,
    concluida_por: oc.concluidaPor ?? null,
    observacao: oc.observacao ?? null,
    ...extra,
  }
}

/** Conclui SÓ esta ocorrência (quem e quando) e avança o vencimento legado. */
export async function concluirOcorrencia(tarefa: Tarefa, oc: OcorrenciaTarefa, usuarioId: string | null): Promise<void> {
  const agora = new Date().toISOString()
  await gravar(registroDe(tarefa.id, oc, 'feita', { concluida_em: agora, concluida_por: usuarioId }))
  const legado =
    tarefa.frequencia === 'esporadica'
      ? { status: 'concluida', data_conclusao: agora }
      : { data_conclusao: agora, data_vencimento: ocorrenciaSeguinte(modeloDaTarefa(tarefa), oc.dataPrevista)?.dataPrevista ?? tarefa.data_vencimento }
  const { error } = await supabase.from('tarefas').update(legado).eq('id', tarefa.id)
  if (error) throw new Error(error.message)
}

/** Volta a ocorrência pra pendente (mantém a observação, se houver). */
export async function desfazerOcorrencia(tarefa: Tarefa, oc: OcorrenciaTarefa): Promise<void> {
  if (oc.observacao) await gravar(registroDe(tarefa.id, oc, 'pendente', { concluida_em: null, concluida_por: null }))
  else await apagar(tarefa.id, oc.dataPrevista)
  const legado = tarefa.frequencia === 'esporadica' ? { status: 'pendente', data_conclusao: null } : { data_vencimento: oc.dataPrevista }
  const { error } = await supabase.from('tarefas').update(legado).eq('id', tarefa.id)
  if (error) throw new Error(error.message)
}

/** Observação numa ocorrência (feita, perdida ou em aberto). */
export async function salvarObservacao(tarefaId: string, oc: OcorrenciaTarefa, observacao: string): Promise<void> {
  const texto = observacao.trim() || null
  if (!texto && oc.status !== 'feita') return apagar(tarefaId, oc.dataPrevista)
  await gravar(registroDe(tarefaId, oc, oc.status === 'feita' ? 'feita' : 'pendente', { observacao: texto }))
}
