import { useState } from 'react'
import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, Sun, Moon, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  loadCargoPermissoes,
  cargosDoProfile,
  temAlgumCargo,
  moduloLabel,
  type Modulo,
} from '@/lib/cargos'
import { useTheme } from '@/hooks/useTheme'
import { usePermissoes } from '@/hooks/usePermissoes'
import {
  SIDEBAR_NAV,
  SIDEBAR_SISTEMA,
  type NavNode,
  type NavItem as NavItemDef,
  type NavFolder,
} from './sidebarConfig'

export function Sidebar() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { can, permissoes } = usePermissoes()
  const { theme, toggle: toggleTheme } = useTheme()

  // Estado de expandir/recolher por pasta (todas abertas por padrão).
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}
    const walk = (nodes: NavNode[]) =>
      nodes.forEach((n) => {
        if (n.kind === 'folder') {
          o[n.key] = n.defaultOpen ?? true
          walk(n.children)
        }
      })
    walk([...SIDEBAR_NAV, ...SIDEBAR_SISTEMA])
    return o
  })

  // Permissões por módulo (admins veem tudo), pra gating dos itens de Execução.
  const [allowedModulos, setAllowedModulos] = useState<Set<Modulo>>(() => new Set())
  useEffect(() => {
    if (!profile) return
    if (isAdmin) {
      setAllowedModulos(new Set<Modulo>(['trafego', 'webdesign', 'social_media', 'admin']))
      return
    }
    const perms = loadCargoPermissoes()
    const cargos = cargosDoProfile(profile)
    const list = new Set<Modulo>()
    for (const c of cargos) {
      for (const m of perms[c] ?? []) list.add(m)
    }
    setAllowedModulos(list)
  }, [profile, isAdmin])

  // Papel-first: se o papel do usuário carrega acessos operacionais, ele manda;
  // senão cai no modelo antigo por cargo (cargoPermissoes).
  const MODULOS_OPERACIONAIS: Modulo[] = ['trafego', 'webdesign', 'social_media']
  const papelDefineModulos = MODULOS_OPERACIONAIS.some((m) => permissoes.includes(moduloLabel[m]))
  function canAccessModulo(m: Modulo) {
    if (isAdmin) return true
    if (papelDefineModulos) return permissoes.includes(moduloLabel[m])
    return allowedModulos.has(m)
  }

  function itemVisivel(it: NavItemDef): boolean {
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

  function renderNodes(nodes: NavNode[], depth: number) {
    return nodes.filter(nodeVisivel).map((n) =>
      n.kind === 'item' ? (
        <NavLinkItem key={n.to} item={n} depth={depth} />
      ) : (
        <FolderNode
          key={n.key}
          folder={n}
          depth={depth}
          expanded={!!open[n.key]}
          onToggle={() => setOpen((o) => ({ ...o, [n.key]: !o[n.key] }))}
          renderChildren={() => renderNodes(n.children, depth + 1)}
        />
      ),
    )
  }

  return (
    <aside className="theme-dark fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border/80 bg-bg-soft/95 backdrop-blur-sm">
      <div className="flex h-16 shrink-0 items-center border-b border-border/80 bg-black px-5">
        <div className="flex items-baseline">
          <span className="text-2xl font-serif font-semibold tracking-tight text-zinc-100">domus</span>
          <span className="text-2xl font-serif font-semibold tracking-tight text-brand-400">.agn</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">{renderNodes(SIDEBAR_NAV, 0)}</nav>

      {/* Sistema — fixo no rodapé, fora de Operacional. */}
      <div className="shrink-0 border-t border-border/80 p-2">{renderNodes(SIDEBAR_SISTEMA, 0)}</div>

      <div className="shrink-0 border-t border-border/80 p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <div className="flex items-center gap-2">
            <Settings2 size={14} />
            v0.1.0
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-elev text-zinc-300 transition-colors hover:bg-bg-soft hover:text-brand-300"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>
    </aside>
  )
}

function FolderNode({
  folder,
  depth,
  expanded,
  onToggle,
  renderChildren,
}: {
  folder: NavFolder
  depth: number
  expanded: boolean
  onToggle: () => void
  renderChildren: () => React.ReactNode
}) {
  const Icon = folder.icon
  return (
    <div className={cn(depth === 0 && 'pt-1')}>
      <button
        onClick={onToggle}
        style={{ paddingLeft: 12 + depth * 12 }}
        className="flex w-full items-center justify-between rounded-md py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-muted transition-colors hover:text-zinc-200"
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon size={12} />}
          {folder.label}
        </span>
        <span className={cn('transition-transform duration-200', expanded ? 'rotate-0' : '-rotate-90')}>
          <ChevronDown size={12} />
        </span>
      </button>
      {expanded && <div className="mt-1 space-y-0.5 animate-fade-in">{renderChildren()}</div>}
    </div>
  )
}

function NavLinkItem({ item, depth }: { item: NavItemDef; depth: number }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      style={{ paddingLeft: 12 + depth * 12 }}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2 rounded-lg py-2 pr-3 text-sm',
          'transition-all duration-200 ease-out',
          isActive
            ? 'bg-brand-500/15 text-brand-200 shadow-[inset_2px_0_0_0_#7c3aed]'
            : 'text-zinc-300 hover:bg-bg-elev hover:text-zinc-100 hover:translate-x-0.5',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            className={cn(
              'shrink-0 transition-transform duration-200',
              isActive ? 'text-brand-400' : 'group-hover:scale-110 group-hover:text-zinc-100',
            )}
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}
