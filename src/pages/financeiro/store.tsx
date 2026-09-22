/**
 * Store do módulo FINANCEIRO (despesas).
 *
 * Guarda as despesas (mock em memória) e as mutações. O provider fica ACIMA do
 * Layout (como o ComercialProvider) porque a aba Integrações em Configurações
 * injeta despesas via webhook simulado — então a tela de Despesas e a de
 * Configurações compartilham o mesmo estado.
 *
 * Recorrência: as projeções mensais são calculadas na leitura (despesasDoPeriodo);
 * ao editar/pagar uma projeção, ela é MATERIALIZADA como despesa real (mantém
 * o histórico dos meses passados intacto).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
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

export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const [despesas, setDespesas] = useState<Despesa[]>(MOCK_DESPESAS)
  const [metasFinanceiras, setMetasFinanceiras] = useState<MetasFinanceiras>(METAS_FINANCEIRAS_INICIAL)

  const salvarDespesa = useCallback((d: Despesa) => {
    setDespesas((prev) => {
      // Projeção de recorrência → materializa como despesa real do mês.
      if (d.projecao) {
        const { projecao: _omit, ...rest } = d
        return [{ ...rest, id: `desp-${Date.now()}` }, ...prev]
      }
      if (!d.id) return [{ ...d, id: `desp-${Date.now()}` }, ...prev]
      return prev.some((x) => x.id === d.id) ? prev.map((x) => (x.id === d.id ? d : x)) : [{ ...d }, ...prev]
    })
  }, [])

  const criarDespesa = useCallback((input: NovaDespesaInput) => {
    const nova: Despesa = { ...input, id: `desp-${Date.now()}`, origem: 'manual' }
    setDespesas((prev) => [nova, ...prev])
  }, [])

  const excluirDespesa = useCallback((id: string) => {
    setDespesas((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const receberDespesaExterna = useCallback((d: Despesa) => {
    setDespesas((prev) => [d, ...prev])
  }, [])

  const value = useMemo<FinanceiroCtx>(
    () => ({ despesas, salvarDespesa, criarDespesa, excluirDespesa, receberDespesaExterna, metasFinanceiras, setMetasFinanceiras }),
    [despesas, salvarDespesa, criarDespesa, excluirDespesa, receberDespesaExterna, metasFinanceiras],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFinanceiro(): FinanceiroCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFinanceiro precisa do FinanceiroProvider')
  return c
}
