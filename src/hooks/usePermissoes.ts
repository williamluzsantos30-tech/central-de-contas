import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Permissões conhecidas (espelham a coluna permissoes[] dos papéis, seed da
 * migration 083). Use estas constantes ao chamar `can(...)` pra evitar typo.
 */
export const PERM = {
  visualizar: 'Visualizar clientes',
  editarStatus: 'Editar status',
  registrarNps: 'Registrar NPS',
  registrarExpansao: 'Registrar expansão',
  registrarChurn: 'Registrar churn',
  apenasLeitura: 'Apenas leitura',
  // Acessos de setor operacional (labels = moduloLabel em @/lib/cargos).
  // Definem tanto a sidebar (Webdesign/Social) quanto quais abas operacionais
  // aparecem na Ficha do cliente (Tráfego/Social).
  opTrafego: 'Operacional Tráfego',
  opWebdesign: 'Operacional Webdesign',
  opSocial: 'Operacional Social Media',
} as const

/**
 * Resolve as permissões do usuário logado a partir do seu papel operacional
 * (`profiles.papel_id` → `papeis_operacionais.permissoes`).
 *
 * Regras de `can(perm)`:
 *  - admin (profile.role === 'admin') → libera tudo (bypass)
 *  - usuário SEM papel atribuído → não restringe (fase de rollout — evita
 *    trancar quem ainda não recebeu papel). A trava real é a RLS (fase 3).
 *  - enquanto carrega o papel → não esconde nada
 *  - com papel carregado → só o que estiver em `permissoes`
 *
 * Observação: isto é trava de INTERFACE (UX), não segurança. A segurança de
 * verdade vem das políticas RLS no banco.
 */
export function usePermissoes() {
  const { profile } = useAuth()
  const bypass = profile?.role === 'admin'
  const temPapel = !!profile?.papel_id
  const [permissoes, setPermissoes] = useState<string[] | null>(null)
  const [papelNome, setPapelNome] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    async function load() {
      if (!profile?.papel_id) {
        setPermissoes(null)
        setPapelNome(null)
        return
      }
      const { data } = await supabase
        .from('papeis_operacionais')
        .select('nome, permissoes')
        .eq('id', profile.papel_id)
        .maybeSingle()
      if (cancel) return
      const row = data as { nome: string; permissoes: string[] } | null
      setPapelNome(row?.nome ?? null)
      setPermissoes(row?.permissoes ?? [])
    }
    load()
    return () => {
      cancel = true
    }
  }, [profile?.papel_id])

  function can(perm: string): boolean {
    if (bypass) return true
    if (!temPapel) return true
    if (permissoes === null) return true
    return permissoes.includes(perm)
  }

  return {
    can,
    bypass,
    temPapel,
    papelNome,
    permissoes: permissoes ?? [],
    carregando: temPapel && permissoes === null,
  }
}
