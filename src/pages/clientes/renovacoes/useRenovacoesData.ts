/**
 * useRenovacoesData — "Renovações de Contrato" é uma VIEW derivada.
 *
 * NÃO existe tabela de renovações. Cada linha vem do CONTRATO cadastrado
 * na Ficha do cliente (clientes.contrato_fim / contrato_status / …, escrito
 * pelo card "Contrato" da Ficha). Aqui a gente lê os clientes que têm
 * contrato com data-fim e calcula os vencimentos.
 *
 * Fluxo: Ficha do cliente → card Contrato (data fim) → esta tabela recalcula
 * DATA FIM e DIAS RESTANTES automaticamente.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Profile, SemaforoCliente } from '@/types/database'
import { FAIXAS, faixaDe, type FaixaId } from './faixasRenovacao'

export interface LinhaRenovacao {
  id: string
  nome: string
  nicho: string | null
  squad: string | null
  accountManager: string | null
  /** Ticket mensal do cliente (MRR em jogo na renovação). */
  mrr: number
  contratoInicio: string | null // 'YYYY-MM-DD'
  contratoFim: string // 'YYYY-MM-DD'
  contratoTipo: string | null
  diasRestantes: number // negativo = vencido
  /** % da vigência já decorrida (0–100); null sem data de início. */
  vigenciaPct: number | null
  faixa: FaixaId
  contratoStatus: string | null
  semaforo: SemaforoCliente | null
  nps: number | null
}

export interface ResumoRenovacoes {
  /** Todos os contratos com data-fim (a "carteira"). */
  carteira: { qtd: number; mrr: number }
  /** Vencidos + vencendo em até 90 dias. */
  janela90: { qtd: number; mrr: number }
  porFaixa: Record<FaixaId, { qtd: number; mrr: number }>
}

export interface RenovacoesData {
  loading: boolean
  vazio: boolean
  resumo: ResumoRenovacoes
  linhas: LinhaRenovacao[]
  reload: () => void
}

/** Dias entre hoje e a data (negativo = já passou). */
function diasAte(iso: string, hoje: Date): number {
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return 0
  const h = new Date(hoje)
  h.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - h.getTime()) / 86_400_000)
}

const RESUMO_ZERO = (): ResumoRenovacoes => ({
  carteira: { qtd: 0, mrr: 0 },
  janela90: { qtd: 0, mrr: 0 },
  porFaixa: Object.fromEntries(FAIXAS.map((f) => [f.id, { qtd: 0, mrr: 0 }])) as ResumoRenovacoes['porFaixa'],
})

/** Cálculo puro (testável): linhas + resumo por faixa. */
export function calcularRenovacoes(
  clientes: Cliente[],
  profiles: Pick<Profile, 'id' | 'nome'>[],
  hoje = new Date(),
): { linhas: LinhaRenovacao[]; resumo: ResumoRenovacoes } {
  const nomeProfile = new Map(profiles.map((p) => [p.id, p.nome]))

  // Só clientes ativos (não churn/arquivados) COM contrato de data-fim.
  const linhas: LinhaRenovacao[] = clientes
    .filter((c) => c.contrato_fim && c.status !== 'churn' && !c.arquivado_em)
    .map((c) => {
      const fim = (c.contrato_fim as string).slice(0, 10)
      const inicio = c.contrato_inicio ? c.contrato_inicio.slice(0, 10) : null
      const diasRestantes = diasAte(fim, hoje)
      let vigenciaPct: number | null = null
      if (inicio) {
        const total = diasAte(fim, hoje) - diasAte(inicio, hoje)
        const decorrido = -diasAte(inicio, hoje)
        vigenciaPct = total > 0 ? Math.min(100, Math.max(0, (decorrido / total) * 100)) : null
      }
      return {
        id: c.id,
        nome: c.nome,
        nicho: c.nicho ?? null,
        squad: c.squad,
        accountManager: c.account_manager_id ? nomeProfile.get(c.account_manager_id) ?? null : null,
        mrr: c.verba_mensal ?? 0,
        contratoInicio: inicio,
        contratoFim: fim,
        contratoTipo: c.contrato_tipo ?? null,
        diasRestantes,
        vigenciaPct,
        faixa: faixaDe(diasRestantes).id,
        contratoStatus: c.contrato_status ?? 'ativo',
        semaforo: c.semaforo,
        nps: typeof c.nps === 'number' ? c.nps : null,
      }
    })
    // Mais urgente primeiro: vencidos (dias negativos) no topo
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  const resumo = RESUMO_ZERO()
  for (const l of linhas) {
    resumo.carteira.qtd++
    resumo.carteira.mrr += l.mrr
    resumo.porFaixa[l.faixa].qtd++
    resumo.porFaixa[l.faixa].mrr += l.mrr
    if (l.diasRestantes <= 90) {
      resumo.janela90.qtd++
      resumo.janela90.mrr += l.mrr
    }
  }
  return { linhas, resumo }
}

export function useRenovacoesData(): RenovacoesData {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [cRes, pRes] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('profiles').select('id, nome'),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setProfiles((pRes.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const derived = useMemo(() => calcularRenovacoes(clientes, profiles), [clientes, profiles])

  if (loading) return { loading: true, vazio: false, resumo: RESUMO_ZERO(), linhas: [], reload: load }
  return { loading: false, vazio: derived.linhas.length === 0, ...derived, reload: load }
}
