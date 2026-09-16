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

export interface LinhaRenovacao {
  id: string
  nome: string
  squad: string | null
  accountManager: string | null
  contratoFim: string // 'YYYY-MM-DD'
  diasRestantes: number // negativo = vencido
  contratoStatus: string | null
  semaforo: SemaforoCliente | null
  nps: number | null
}

export interface RenovacoesKpis {
  vencendo30: number
  vencendo15: number
  vencendo7: number
  vencidos: number
}

export interface RenovacoesData {
  loading: boolean
  vazio: boolean
  kpis: RenovacoesKpis
  linhas: LinhaRenovacao[]
  reload: () => void
}

/** Dias entre hoje e a data-fim do contrato (negativo = já venceu). */
function diasAte(fimISO: string): number {
  const fim = new Date(fimISO + 'T12:00:00')
  if (isNaN(fim.getTime())) return 0
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((fim.getTime() - hoje.getTime()) / 86_400_000)
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

  const derived = useMemo(() => {
    const nomeProfile = new Map(profiles.map((p) => [p.id, p.nome]))

    // Só clientes ativos (não churn/arquivados) COM contrato de data-fim.
    const linhas: LinhaRenovacao[] = clientes
      .filter((c) => c.contrato_fim && c.status !== 'churn' && !c.arquivado_em)
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        squad: c.squad,
        accountManager: c.account_manager_id ? nomeProfile.get(c.account_manager_id) ?? null : null,
        contratoFim: (c.contrato_fim as string).slice(0, 10),
        diasRestantes: diasAte((c.contrato_fim as string).slice(0, 10)),
        contratoStatus: c.contrato_status ?? 'ativo',
        semaforo: c.semaforo,
        nps: typeof c.nps === 'number' ? c.nps : null,
      }))
      // Mais urgente primeiro: vencidos (dias negativos) no topo
      .sort((a, b) => a.diasRestantes - b.diasRestantes)

    // Buckets aninhados (7 ⊂ 15 ⊂ 30), vencidos à parte
    const kpis: RenovacoesKpis = {
      vencendo30: linhas.filter((l) => l.diasRestantes >= 0 && l.diasRestantes <= 30).length,
      vencendo15: linhas.filter((l) => l.diasRestantes >= 0 && l.diasRestantes <= 15).length,
      vencendo7: linhas.filter((l) => l.diasRestantes >= 0 && l.diasRestantes <= 7).length,
      vencidos: linhas.filter((l) => l.diasRestantes < 0).length,
    }

    return { linhas, kpis, vazio: linhas.length === 0 }
  }, [clientes, profiles])

  if (loading) {
    return {
      loading: true,
      vazio: false,
      kpis: { vencendo30: 0, vencendo15: 0, vencendo7: 0, vencidos: 0 },
      linhas: [],
      reload: load,
    }
  }
  return { loading: false, ...derived, reload: load }
}
