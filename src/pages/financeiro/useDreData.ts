/**
 * useDreData — monta o DreInput da DRE a partir das fontes já existentes:
 *  - Clientes + eventos de churn (Supabase, mesma base de Churns/Resumo Geral)
 *  - Leads + investimentos (ComercialProvider — caixa recolhido e CAC)
 *  - Despesas (FinanceiroProvider)
 *
 * A DRE não tem dados próprios; este hook só reúne o que já existe.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useComercial } from '@/pages/comercial/store'
import { useFinanceiro } from './store'
import type { ClienteDRE, DreInput, EventoChurnDRE } from './dreCalculator'

export function useDreData(): { loading: boolean; input: DreInput } {
  const { leads, investimentos } = useComercial()
  const { despesas } = useFinanceiro()
  const [clientes, setClientes] = useState<ClienteDRE[]>([])
  const [eventosChurn, setEventosChurn] = useState<EventoChurnDRE[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    async function load() {
      const [cRes, eRes] = await Promise.all([
        supabase.from('clientes').select('id, verba_mensal, status, arquivado_em, data_inicio'),
        supabase.from('cliente_eventos').select('cliente_id, criado_em, meta').eq('tipo', 'churn'),
      ])
      if (cancel) return
      setClientes((cRes.data as ClienteDRE[]) ?? [])
      setEventosChurn((eRes.data as EventoChurnDRE[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancel = true
    }
  }, [])

  return { loading, input: { clientes, eventosChurn, leads, investimentos, despesas } }
}
