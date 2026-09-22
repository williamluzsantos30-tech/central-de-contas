/**
 * Store do módulo FINANCEIRO (despesas + metas).
 *
 * PERSISTÊNCIA (migration 089): `despesas_financeiras` (colunas flat) e
 * `financeiro_config` (metas em JSONB). FALLBACK: se as tabelas ainda não
 * existirem, roda no mock em memória (não quebra). Na 1ª carga com o banco
 * vazio, faz BOOTSTRAP do mock (grava e passa a persistir). O estado local é a
 * fonte pro render; cada mutação atualiza o estado E grava no banco (quando
 * disponível).
 *
 * O provider fica ACIMA do Layout (como o ComercialProvider) porque a aba
 * Integrações em Configurações injeta despesas via webhook simulado — então a
 * tela de Despesas e a de Configurações compartilham o mesmo estado.
 *
 * Recorrência: as projeções mensais são calculadas na leitura (despesasDoPeriodo);
 * ao editar/pagar uma projeção, ela é MATERIALIZADA como despesa real (mantém
 * o histórico dos meses passados intacto).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_DESPESAS, type Despesa } from './mockDespesas'

/** Metas financeiras usadas pra colorir os KPIs de margem do DRE. */
export interface MetasFinanceiras {
  margemBrutaAlvo: number
  margemLiquidaAlvo: number
}
export const METAS_FINANCEIRAS_INICIAL: MetasFinanceiras = { margemBrutaAlvo: 60, margemLiquidaAlvo: 20 }

export interface NovaDespesaInput {
  descricao: string
  categoria: Despesa['categoria']
  setor?: string
  valor: number
  tipoRecorrencia: Despesa['tipoRecorrencia']
  dataCompetencia: string
  dataPagamento?: string
  status: Despesa['status']
  fornecedor?: string
  observacao?: string
  repetirAte?: string | null
}

interface FinanceiroCtx {
  despesas: Despesa[]
  carregando: boolean
  /** Cria/edita/materializa. Se `d.projecao`, vira uma despesa real; se `d.id`
   *  existe, atualiza; senão insere. */
  salvarDespesa: (d: Despesa) => void
  criarDespesa: (input: NovaDespesaInput) => void
  excluirDespesa: (id: string) => void
  /** Recebe uma despesa de integração externa (webhook simulado). */
  receberDespesaExterna: (d: Despesa) => void
  metasFinanceiras: MetasFinanceiras
  setMetasFinanceiras: (m: MetasFinanceiras) => void
}

const Ctx = createContext<FinanceiroCtx | null>(null)

// ── Mappers Despesa ↔ linha do banco ────────────────────────────────────────
type DespesaRow = {
  id: string
  descricao: string
  categoria: string
  setor: string | null
  valor: number
  tipo_recorrencia: string
  data_competencia: string
  data_pagamento: string | null
  status: string
  fornecedor: string | null
  observacao: string | null
  origem: string
  origem_detalhe: Despesa['origemDetalhe'] | null
  repetir_ate: string | null
  recorrencia_modelo_id: string | null
}

function despesaToRow(d: Despesa): DespesaRow {
  return {
    id: d.id,
    descricao: d.descricao,
    categoria: d.categoria,
    setor: d.setor ?? null,
    valor: d.valor,
    tipo_recorrencia: d.tipoRecorrencia,
    data_competencia: d.dataCompetencia,
    data_pagamento: d.dataPagamento ?? null,
    status: d.status,
    fornecedor: d.fornecedor ?? null,
    observacao: d.observacao ?? null,
    origem: d.origem,
    origem_detalhe: d.origemDetalhe ?? null,
    repetir_ate: d.repetirAte ?? null,
    recorrencia_modelo_id: d.recorrenciaModeloId ?? null,
  }
}
function rowToDespesa(r: DespesaRow): Despesa {
  return {
    id: r.id,
    descricao: r.descricao,
    categoria: r.categoria as Despesa['categoria'],
    setor: r.setor ?? undefined,
    valor: Number(r.valor),
    tipoRecorrencia: r.tipo_recorrencia as Despesa['tipoRecorrencia'],
    dataCompetencia: r.data_competencia,
    dataPagamento: r.data_pagamento ?? undefined,
    status: r.status as Despesa['status'],
    fornecedor: r.fornecedor ?? undefined,
    observacao: r.observacao ?? undefined,
    origem: r.origem as Despesa['origem'],
    origemDetalhe: r.origem_detalhe ?? undefined,
    repetirAte: r.repetir_ate,
    recorrenciaModeloId: r.recorrencia_modelo_id ?? undefined,
  }
}

export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const [despesas, setDespesas] = useState<Despesa[]>(MOCK_DESPESAS)
  const [metasFinanceiras, setMetasFinanceirasState] = useState<MetasFinanceiras>(METAS_FINANCEIRAS_INICIAL)
  const [carregando, setCarregando] = useState(true)
  // true quando as tabelas existem (persiste); false = fallback mock em memória.
  const modoBanco = useRef(false)

  // ── Carga inicial: banco → estado, ou bootstrap do mock, ou fallback ──────
  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const { data: cfg, error } = await supabase.from('financeiro_config').select('*').eq('id', 'default').maybeSingle()
        if (error) throw error // tabela não existe → catch (mock)
        modoBanco.current = true
        if (!cfg) {
          // Banco fresco → bootstrap do mock (upsert = idempotente).
          await Promise.all([
            supabase.from('despesas_financeiras').upsert(MOCK_DESPESAS.map(despesaToRow)),
            supabase.from('financeiro_config').upsert({ id: 'default', metas: METAS_FINANCEIRAS_INICIAL }),
          ])
          // estado já está com o mock (init) — nada a trocar
        } else {
          const dRes = await supabase.from('despesas_financeiras').select('*')
          if (cancel) return
          setDespesas(((dRes.data as DespesaRow[]) ?? []).map(rowToDespesa))
          setMetasFinanceirasState({ ...METAS_FINANCEIRAS_INICIAL, ...((cfg.metas as Partial<MetasFinanceiras>) ?? {}) })
        }
      } catch {
        modoBanco.current = false // migration 089 não rodada → mock em memória
      } finally {
        if (!cancel) setCarregando(false)
      }
    }
    load()
    return () => {
      cancel = true
    }
  }, [])

  // ── Persistência (só quando o banco está disponível) ──────────────────────
  const persistDespesa = useCallback((d: Despesa) => {
    if (!modoBanco.current) return
    void supabase.from('despesas_financeiras').upsert(despesaToRow(d)).then(({ error }) => {
      if (error) console.warn('[financeiro] persistDespesa', error.message)
    })
  }, [])
  const removerDespesaBanco = useCallback((id: string) => {
    if (!modoBanco.current) return
    void supabase.from('despesas_financeiras').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[financeiro] excluirDespesa', error.message)
    })
  }, [])

  const salvarDespesa = useCallback((d: Despesa) => {
    // Decide o registro final (materializa projeção / gera id) antes de gravar.
    let saved: Despesa
    if (d.projecao) {
      const { projecao: _omit, ...rest } = d
      saved = { ...rest, id: `desp-${Date.now()}` }
    } else if (!d.id) {
      saved = { ...d, id: `desp-${Date.now()}` }
    } else {
      saved = d
    }
    setDespesas((prev) => (prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev]))
    persistDespesa(saved)
  }, [persistDespesa])

  const criarDespesa = useCallback((input: NovaDespesaInput) => {
    const nova: Despesa = { ...input, id: `desp-${Date.now()}`, origem: 'manual' }
    setDespesas((prev) => [nova, ...prev])
    persistDespesa(nova)
  }, [persistDespesa])

  const excluirDespesa = useCallback((id: string) => {
    setDespesas((prev) => prev.filter((d) => d.id !== id))
    removerDespesaBanco(id)
  }, [removerDespesaBanco])

  const receberDespesaExterna = useCallback((d: Despesa) => {
    setDespesas((prev) => [d, ...prev])
    persistDespesa(d)
  }, [persistDespesa])

  const setMetasFinanceiras = useCallback((m: MetasFinanceiras) => {
    setMetasFinanceirasState(m)
    if (modoBanco.current) {
      void supabase.from('financeiro_config').upsert({ id: 'default', metas: m }).then(({ error }) => {
        if (error) console.warn('[financeiro] setMetasFinanceiras', error.message)
      })
    }
  }, [])

  const value = useMemo<FinanceiroCtx>(
    () => ({ despesas, carregando, salvarDespesa, criarDespesa, excluirDespesa, receberDespesaExterna, metasFinanceiras, setMetasFinanceiras }),
    [despesas, carregando, salvarDespesa, criarDespesa, excluirDespesa, receberDespesaExterna, metasFinanceiras, setMetasFinanceiras],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFinanceiro(): FinanceiroCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFinanceiro precisa do FinanceiroProvider')
  return c
}
