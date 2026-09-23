/**
 * Sugestão de responsável (Gestor de Tráfego / Social Media) a partir do
 * squad do cliente.
 *
 * O vínculo Squad → Membro (Squad Principal do profile) NÃO é o mesmo que
 * Cliente → Responsável (gestor_id / social_media_id). Esta util fecha o gap:
 * dado o squad de um cliente, sugere o membro daquela função vinculado ao
 * squad — mas só quando há EXATAMENTE UM (evita atribuição ambígua).
 */
import { temFuncao } from '@/lib/cargos'
import type { Profile } from '@/types/database'

export type CargoResponsavel = 'gestor_trafego' | 'social_media'

/**
 * Retorna o id do único membro ativo que exerce a função (por cargo OU Papel —
 * ver temFuncao) cujo Squad Principal (`squad_id`) é o squad dado. `null` se
 * não houver exatamente 1. Requer `papel` embarcado nos profiles pra pegar
 * quem foi vinculado só pelo Papel.
 */
export function suggestResponsavelBySquad(
  profiles: Profile[],
  squadId: string | null | undefined,
  cargo: CargoResponsavel,
): string | null {
  if (!squadId) return null
  const cands = profiles.filter((p) => p.squad_id === squadId && temFuncao(p, cargo))
  return cands.length === 1 ? cands[0].id : null
}
