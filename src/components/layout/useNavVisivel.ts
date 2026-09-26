/**
 * Quais itens do menu o usuário vê (admin, permissão de papel, módulo
 * operacional, cargo). Compartilhado entre o menu lateral e a busca ⌘K —
 * a busca nunca oferece uma página que o menu esconde.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { loadCargoPermissoes, cargosDoProfile, temAlgumCargo, moduloLabel, type Modulo } from '@/lib/cargos'
import { usePermissoes } from '@/hooks/usePermissoes'
import type { NavItem, NavNode } from './sidebarConfig'

// Papel-first: se o papel do usuário carrega acessos operacionais, ele manda;
// senão cai no modelo antigo por cargo (cargoPermissoes).
const MODULOS_OPERACIONAIS: Modulo[] = ['trafego', 'webdesign', 'social_media']

export function useNavVisivel() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { can, permissoes } = usePermissoes()

  // Permissões por módulo (admins veem tudo), pra gating dos itens de Execução.
  const [allowedModulos, setAllowedModulos] = useState<Set<Modulo>>(() => new Set())
  useEffect(() => {
    if (!profile) return
    if (isAdmin) {
      setAllowedModulos(new Set<Modulo>(['trafego', 'webdesign', 'social_media', 'admin']))
      return
    }
    const perms = loadCargoPermissoes()
    const list = new Set<Modulo>()
    for (const c of cargosDoProfile(profile)) {
      for (const m of perms[c] ?? []) list.add(m)
    }
    setAllowedModulos(list)
  }, [profile, isAdmin])

  const papelDefineModulos = MODULOS_OPERACIONAIS.some((m) => permissoes.includes(moduloLabel[m]))
  function canAccessModulo(m: Modulo) {
    if (isAdmin) return true
    if (papelDefineModulos) return permissoes.includes(moduloLabel[m])
    return allowedModulos.has(m)
  }

  function itemVisivel(it: NavItem): boolean {
    if (it.adminOnly && !isAdmin) return false
    if (it.perm && !can(it.perm)) return false
    if (it.modulo && !canAccessModulo(it.modulo)) return false
    if (it.cargosPermitidos && it.cargosPermitidos.length > 0) {
      if (!isAdmin && !temAlgumCargo(profile, it.cargosPermitidos)) return false
    }
    return true
  }
  function nodeVisivel(n: NavNode): boolean {
    return n.kind === 'item' ? itemVisivel(n) : n.children.some(nodeVisivel)
  }

  return { itemVisivel, nodeVisivel }
}
