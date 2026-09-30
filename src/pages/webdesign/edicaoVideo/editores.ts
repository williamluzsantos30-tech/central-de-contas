/**
 * Editores de vídeo — quem pode ser responsável por uma edição. A função vem
 * do papel da Equipe Operacional (Designer / Editor de vídeo) ou do cargo
 * legado designer. Sem ninguém com essa função, cai pra equipe ativa inteira
 * (senão não daria pra atribuir ninguém).
 */
import { supabase } from '@/lib/supabase'
import { temCargo } from '@/lib/cargos'
import { buscarProfilesComPapel } from '@/lib/profilesComPapel'
import type { Profile } from '@/types/database'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ehEditorDeVideo(p: Profile): boolean {
  if (temCargo(p, 'designer')) return true
  const n = semAcento(p.papel?.nome ?? '')
  return n.includes('video') || n.includes('editor') || n.includes('edicao')
}

export interface ListaEditores {
  /** Opções do seletor de responsável. */
  pessoas: Profile[]
  /** true quando ninguém tem função de editor e a lista é a equipe toda. */
  equipeToda: boolean
  /** Toda a equipe ativa, pra mostrar nome/foto de qualquer responsável. */
  porId: Map<string, Profile>
}

export const EDITORES_VAZIO: ListaEditores = { pessoas: [], equipeToda: false, porId: new Map() }

export async function carregarEditores(): Promise<ListaEditores> {
  const { data } = await buscarProfilesComPapel((sel) =>
    supabase.from('profiles').select(sel).eq('ativo', true).eq('aprovado', true).order('nome'),
  )
  const editores = data.filter(ehEditorDeVideo)
  const porId = new Map(data.map((p) => [p.id, p]))
  return editores.length ? { pessoas: editores, equipeToda: false, porId } : { pessoas: data, equipeToda: true, porId }
}
