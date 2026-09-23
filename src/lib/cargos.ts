import type { Profile } from '@/types/database'

export type Cargo =
  | 'gestor_trafego'
  | 'account_manager'
  | 'designer'
  | 'social_media'
  | 'diretoria'
  | 'head'

/**
 * True se o profile tem esse cargo, considerando tanto o cargo principal
 * quanto os cargos_extras. Use sempre isso ao invés de `profile.cargo === X`,
 * senão pessoas com cargo duplo (ex.: designer + social_media) ficam invisíveis
 * pros dropdowns da segunda função.
 */
export function temCargo(profile: Pick<Profile, 'cargo' | 'cargos_extras'> | null | undefined, cargo: Cargo): boolean {
  if (!profile) return false
  if (profile.cargo === cargo) return true
  return Array.isArray(profile.cargos_extras) && profile.cargos_extras.includes(cargo)
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * True se o membro exerce a FUNÇÃO, considerando o `cargo`/`cargos_extras`
 * E TAMBÉM o Papel operacional (papeis_operacionais, campo `papel.nome`) —
 * porque em Membros da Equipe o vínculo é feito pelo PAPEL (papel_id), não
 * pelo cargo. Sem isso, um membro com Papel "Gestor de Tráfego" mas sem o
 * cargo enum fica invisível pros dropdowns/atribuições.
 *
 * Requer que o profile venha com `papel` embarcado (join papeis_operacionais)
 * pra o match por papel funcionar; senão cai só no cargo.
 */
export function temFuncao(
  profile: Pick<Profile, 'cargo' | 'cargos_extras' | 'papel'> | null | undefined,
  funcao: 'gestor_trafego' | 'social_media' | 'account_manager',
): boolean {
  if (!profile) return false
  if (temCargo(profile, funcao)) return true
  const nome = profile.papel?.nome ? semAcento(profile.papel.nome) : ''
  if (!nome) return false
  if (funcao === 'gestor_trafego') return nome.includes('trafego')
  if (funcao === 'social_media') return nome.includes('social')
  return nome.includes('account') || nome.includes('conta')
}

/** True se tem QUALQUER um dos cargos passados (designer OU social_media etc). */
export function temAlgumCargo(profile: Pick<Profile, 'cargo' | 'cargos_extras'> | null | undefined, cargos: Cargo[]): boolean {
  return cargos.some((c) => temCargo(profile, c))
}

/** Lista todos os cargos do profile (principal + extras), deduplicado. */
export function cargosDoProfile(profile: Pick<Profile, 'cargo' | 'cargos_extras'> | null | undefined): Cargo[] {
  if (!profile) return []
  const set = new Set<Cargo>()
  if (profile.cargo) set.add(profile.cargo)
  for (const c of profile.cargos_extras ?? []) set.add(c)
  return Array.from(set)
}

export const CARGOS: Cargo[] = [
  'gestor_trafego',
  'account_manager',
  'designer',
  'social_media',
  'diretoria',
  'head',
]

export const cargoLabel: Record<Cargo, string> = {
  gestor_trafego: 'Gestor de Tráfego',
  account_manager: 'Account Manager',
  designer: 'Designer',
  social_media: 'Social Media',
  diretoria: 'Diretoria',
  head: 'Head',
}

export const cargoDescricao: Record<Cargo, string> = {
  gestor_trafego: 'Roda campanhas em Google Ads e Meta Ads.',
  account_manager: 'Atende o cliente, acompanha entregas e SLA.',
  designer: 'Produz peças de criativos e landing pages.',
  social_media: 'Cria planejamento e artes do feed do cliente.',
  diretoria: 'Visão completa da operação. Acesso total.',
  head: 'Lidera squads de tráfego e webdesign.',
}

/** Módulos do app que podem ser concedidos por cargo */
export type Modulo = 'trafego' | 'webdesign' | 'social_media' | 'admin'

export const MODULOS: Modulo[] = ['trafego', 'webdesign', 'social_media', 'admin']

export const moduloLabel: Record<Modulo, string> = {
  trafego: 'Operacional Tráfego',
  webdesign: 'Operacional Webdesign',
  social_media: 'Operacional Social Media',
  admin: 'Admin',
}

export const moduloDescricao: Record<Modulo, string> = {
  trafego: 'Clientes, tarefas, métricas, leads, otimizações.',
  webdesign: 'Landing pages, criativos e produção de social media.',
  social_media: 'Calendário editorial e métricas de redes sociais.',
  admin: 'Gerenciar acessos, equipe e configurações do sistema.',
}

/** Permissões padrão por cargo conforme regra do produto */
export const cargoPermissoesDefault: Record<Cargo, Modulo[]> = {
  gestor_trafego: ['trafego', 'webdesign'],
  account_manager: ['trafego', 'webdesign', 'social_media'],
  designer: ['webdesign', 'social_media'],
  social_media: ['webdesign', 'social_media'],
  diretoria: ['trafego', 'webdesign', 'social_media', 'admin'],
  head: ['trafego', 'webdesign', 'social_media'],
}

const STORAGE_KEY = 'movmed-cargo-permissoes-v1'

/** Lê permissões persistidas (ou usa default) */
export function loadCargoPermissoes(): Record<Cargo, Modulo[]> {
  if (typeof window === 'undefined') return { ...cargoPermissoesDefault }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...cargoPermissoesDefault }
    const parsed = JSON.parse(raw) as Partial<Record<Cargo, Modulo[]>>
    const result = { ...cargoPermissoesDefault }
    for (const c of CARGOS) {
      if (Array.isArray(parsed[c])) result[c] = parsed[c] as Modulo[]
    }
    return result
  } catch {
    return { ...cargoPermissoesDefault }
  }
}

export function saveCargoPermissoes(perms: Record<Cargo, Modulo[]>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(perms))
  } catch {
    /* noop */
  }
}

/** Reset ao default */
export function resetCargoPermissoes(): Record<Cargo, Modulo[]> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* noop */
    }
  }
  return { ...cargoPermissoesDefault }
}
