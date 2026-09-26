/**
 * Profiles com o PAPEL operacional embarcado (Configurações › Equipe
 * Operacional define a função de cada pessoa). Com o papel junto, temCargo/
 * temAlgumCargo (lib/cargos) reconhecem quem só tem papel, sem `cargo`.
 *
 * Se o join falhar (migration 083 não rodada, FK com outro nome), cai no
 * select simples — a tela continua funcionando, só sem o papel.
 */
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

export const SELECT_PROFILE_COM_PAPEL = '*, papel:papeis_operacionais!profiles_papel_fk(*)'

type Resultado = { data: unknown; error: unknown }

/**
 * Roda a mesma consulta com e sem o join. Uso:
 *   buscarProfilesComPapel((sel) => supabase.from('profiles').select(sel).eq('ativo', true))
 */
export async function buscarProfilesComPapel(montar: (select: string) => PromiseLike<Resultado>): Promise<{ data: Profile[] }> {
  const comPapel = await montar(SELECT_PROFILE_COM_PAPEL)
  if (!comPapel.error) return { data: (comPapel.data as Profile[]) ?? [] }
  const simples = await montar('*')
  return { data: (simples.data as Profile[]) ?? [] }
}

/** Anexa o papel a UM profile já carregado (ex.: usuário logado). */
export async function comPapel(profile: Profile): Promise<Profile> {
  if (!profile.papel_id || profile.papel) return profile
  const { data, error } = await supabase.from('papeis_operacionais').select('*').eq('id', profile.papel_id).maybeSingle()
  return error || !data ? profile : { ...profile, papel: data as Profile['papel'] }
}
