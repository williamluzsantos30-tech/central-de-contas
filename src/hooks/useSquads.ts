import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Squad } from '@/types/database'

/**
 * Hook que carrega squads (somente ativos) do banco.
 * Usado em todos os formulários e filtros que precisam listar squads.
 *
 * Retorna a lista de Squad e também `nomes` (string[]) compatível com o
 * antigo `SQUADS` constante para uso simples em selects.
 */
export function useSquads({ apenasAtivos = true }: { apenasAtivos?: boolean } = {}) {
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const query = supabase.from('squads').select('*').order('nome')
      const { data } = await query.then(
        (r) => r,
        () => ({ data: [], error: null } as const), // resiliente: se a tabela não existir
      )
      if (cancelled) return
      const all = (data as Squad[] | null) ?? []
      setSquads(apenasAtivos ? all.filter((s) => s.ativo) : all)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [apenasAtivos])

  return {
    squads,
    nomes: squads.map((s) => s.nome),
    loading,
  }
}
