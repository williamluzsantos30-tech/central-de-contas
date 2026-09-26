import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Sun, Moon, Camera, LogOut } from 'lucide-react'
import { cn, userRoleLabel } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { useTheme } from '@/hooks/useTheme'
import { EditarFotoPerfilModal } from './EditarFotoPerfilModal'
import { useNavVisivel } from './useNavVisivel'
import { itemAtivoDaRota } from './navTrail'
import {
  SIDEBAR_NAV,
  SIDEBAR_SISTEMA,
  type NavNode,
  type NavItem as NavItemDef,
  type NavFolder,
} from './sidebarConfig'

export function Sidebar() {
  const { profile, signOut, refreshProfile } = useAuth()
  const { nodeVisivel } = useNavVisivel()
  const { theme, toggle: toggleTheme } = useTheme()
  const [editFotoOpen, setEditFotoOpen] = useState(false)
  const ativoTo = itemAtivoDaRota(useLocation().pathname)

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

  function renderNodes(nodes: NavNode[], depth: number) {
    return nodes.filter(nodeVisivel).map((n) =>
      n.kind === 'item' ? (
        <NavLinkItem key={n.to} item={n} depth={depth} ativo={n.to === ativoTo} />
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
      <div className="flex h-14 shrink-0 items-center border-b border-border/80 bg-black px-5">
        <div className="flex items-baseline">
          <span className="text-2xl font-serif font-semibold tracking-tight text-zinc-100">domus</span>
          <span className="text-2xl font-serif font-semibold tracking-tight text-brand-400">.agn</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">{renderNodes(SIDEBAR_NAV, 0)}</nav>

      {/* Sistema — fixo no rodapé, fora de Operacional. */}
      <div className="shrink-0 border-t border-border/80 p-2">{renderNodes(SIDEBAR_SISTEMA, 0)}</div>

      {/* Usuário + tema + sair (rodapé, como no padrão de apps de gestão). */}
      <div className="shrink-0 border-t border-border/80 p-2">
        <div className="flex items-center gap-1">
          {profile ? (
            <button
              onClick={() => setEditFotoOpen(true)}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-bg-elev"
              title="Trocar foto de perfil"
            >
              <span className="relative shrink-0">
                <Avatar name={profile.nome} url={profile.avatar_url} size="md" />
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera size={10} className="text-white" />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-zinc-100">{profile.nome}</span>
                <span className="block truncate text-[10px] text-muted">{userRoleLabel[profile.role]} · v0.1.0</span>
              </span>
            </button>
          ) : (
            <span className="flex-1 px-2 text-[10px] text-muted">v0.1.0</span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {profile && (
        <EditarFotoPerfilModal open={editFotoOpen} onClose={() => setEditFotoOpen(false)} profile={profile} onSaved={refreshProfile} />
      )}
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

function NavLinkItem({ item, depth, ativo }: { item: NavItemDef; depth: number; ativo: boolean }) {
  const Icon = item.icon
  // Ativo = só o item mais específico da rota (ver itemAtivoDaRota).
  return (
    <Link
      to={item.to}
      aria-current={ativo ? 'page' : undefined}
      style={{ paddingLeft: 12 + depth * 12 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg py-2 pr-3 text-sm',
        'transition-all duration-200 ease-out',
        ativo
          ? 'bg-brand-500/15 text-brand-200 shadow-[inset_2px_0_0_0_#7c3aed]'
          : 'text-zinc-300 hover:bg-bg-elev hover:text-zinc-100 hover:translate-x-0.5',
      )}
    >
      <Icon
        size={16}
        className={cn(
          'shrink-0 transition-transform duration-200',
          ativo ? 'text-brand-400' : 'group-hover:scale-110 group-hover:text-zinc-100',
        )}
      />
      <span>{item.label}</span>
    </Link>
  )
}
