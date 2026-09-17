import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Settings2,
  ShieldCheck,
  Megaphone,
  ChevronDown,
  Palette,
  LayoutGrid,
  Sparkles,
  Share2,
  CalendarDays,
  Film,
  Sun,
  Moon,
  Activity,
  TrendingUp,
  UserPlus,
  UserMinus,
  FileClock,
  BookOpen,
  Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  loadCargoPermissoes,
  cargosDoProfile,
  temAlgumCargo,
  type Cargo,
  type Modulo,
} from '@/lib/cargos'
import { useTheme } from '@/hooks/useTheme'
import { usePermissoes, PERM } from '@/hooks/usePermissoes'

type Item = {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  end?: boolean
  adminOnly?: boolean
  /** Se preenchido, o item só aparece pra quem tem QUALQUER um desses cargos */
  cargosPermitidos?: Cargo[]
  /** Se preenchido, o item só aparece pra quem tem essa permissão de papel */
  perm?: string
}

type Group =
  | { kind: 'item'; item: Item }
  | {
      kind: 'folder'
      key: string
      label: string
      icon: React.ComponentType<{ size?: number }>
      items: Item[]
      defaultOpen?: boolean
      modulo?: Modulo
    }

const nav: Group[] = [
  { kind: 'item', item: { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true } },
  // Lista de clientes é universal — não pertence mais a um "módulo". As
  // operações (tráfego/social) aparecem por cliente, conforme o serviço
  // contratado, dentro da ficha.
  { kind: 'item', item: { to: '/clientes', label: 'Clientes', icon: Users, perm: PERM.visualizar } },
  {
    kind: 'folder',
    key: 'operacional',
    label: 'Operacional',
    icon: TrendingUp,
    defaultOpen: true,
    // Sem modulo — visao executiva e' meta-modulo, cruza tudo
    items: [
      { to: '/operacional/visao', label: 'Visão Executiva', icon: TrendingUp },
      { to: '/clientes/onboarding', label: 'Onboarding', icon: UserPlus },
      { to: '/clientes/churns', label: 'Churns', icon: UserMinus },
      { to: '/clientes/renovacoes', label: 'Renovações', icon: FileClock },
    ],
  },
  {
    kind: 'folder',
    key: 'trafego',
    label: 'Tráfego',
    icon: Megaphone,
    defaultOpen: true,
    modulo: 'trafego',
    items: [
      {
        to: '/trafego/controle-head',
        label: 'Controle do Head',
        icon: Activity,
        cargosPermitidos: ['head', 'diretoria'],
      },
    ],
  },
  {
    kind: 'folder',
    key: 'webdesign',
    label: 'Webdesign',
    icon: Palette,
    defaultOpen: true,
    modulo: 'webdesign',
    items: [
      { to: '/webdesign/projetos', label: 'Landing page', icon: LayoutGrid },
      { to: '/webdesign/criativos', label: 'Criativos', icon: Sparkles },
      { to: '/webdesign/edicao-video', label: 'Edição de vídeo', icon: Film },
      { to: '/webdesign/social-media', label: 'Produção social media', icon: Share2 },
    ],
  },
  {
    kind: 'folder',
    key: 'social_media',
    label: 'Social Media',
    icon: Share2,
    defaultOpen: true,
    modulo: 'social_media',
    items: [
      // Clientes de Social Media agora vivem na lista única (Tráfego > Clientes,
      // aba "Social Media"). Aqui fica só a operação de conteúdo.
      { to: '/social/calendario', label: 'Calendário de postagens', icon: CalendarDays },
    ],
  },
  { kind: 'item', item: { to: '/central-operacional', label: 'Central Operacional', icon: BookOpen } },
  { kind: 'item', item: { to: '/flags', label: 'Flags (Performance)', icon: Flag } },
  { kind: 'item', item: { to: '/configuracoes', label: 'Configurações', icon: Settings2 } },
  { kind: 'item', item: { to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true } },
]

export function Sidebar() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { can } = usePermissoes()
  const { theme, toggle: toggleTheme } = useTheme()
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      nav
        .filter((g): g is Extract<Group, { kind: 'folder' }> => g.kind === 'folder')
        .map((g) => [g.key, g.defaultOpen ?? true]),
    ),
  )

  // Permissões por módulo, conforme cargo do usuário (admins veem tudo)
  const [allowedModulos, setAllowedModulos] = useState<Set<Modulo>>(() => new Set())
  useEffect(() => {
    if (!profile) return
    if (isAdmin) {
      setAllowedModulos(new Set<Modulo>(['trafego', 'webdesign', 'social_media', 'admin']))
      return
    }
    const perms = loadCargoPermissoes()
    // Soma os módulos do cargo principal + cargos_extras
    const cargos = cargosDoProfile(profile)
    const list = new Set<Modulo>()
    for (const c of cargos) {
      for (const m of perms[c] ?? []) list.add(m)
    }
    setAllowedModulos(list)
  }, [profile, isAdmin])

  function canAccessModulo(m: Modulo) {
    return allowedModulos.has(m)
  }

  return (
    <aside className="theme-dark fixed inset-y-0 left-0 z-30 w-60 border-r border-border/80 bg-bg-soft/95 backdrop-blur-sm">
      <div className="flex h-16 items-center border-b border-border/80 bg-black px-5">
        {/* Wordmark temporario — substituir por SVG proprio quando o logo
            estiver pronto. "domus" em branco frio, ".agn" em violet
            (o herói da paleta contemporaneo tech). */}
        <div className="flex items-baseline">
          <span className="text-2xl font-serif font-semibold tracking-tight text-zinc-100">
            domus
          </span>
          <span className="text-2xl font-serif font-semibold tracking-tight text-brand-400">
            .agn
          </span>
        </div>
      </div>
      <nav className="p-2 space-y-1">
        {nav.map((g, i) => {
          if (g.kind === 'item') {
            if (g.item.adminOnly && !isAdmin) return null
            if (g.item.perm && !can(g.item.perm)) return null
            return <NavItem key={g.item.to} {...g.item} />
          }
          // Folder: bloqueia se o cargo não tem acesso a esse módulo
          if (g.modulo && !canAccessModulo(g.modulo)) return null
          const visibleItems = g.items.filter((it) => {
            if (it.adminOnly && !isAdmin) return false
            if (it.perm && !can(it.perm)) return false
            if (it.cargosPermitidos && it.cargosPermitidos.length > 0) {
              // Admin sempre vê; demais só se tem algum dos cargos permitidos
              if (!isAdmin && !temAlgumCargo(profile, it.cargosPermitidos)) return false
            }
            return true
          })
          if (visibleItems.length === 0) return null
          const expanded = open[g.key]
          return (
            <div key={g.key} className={cn(i > 0 && 'pt-2')}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted transition-colors hover:text-zinc-200"
              >
                <span className="flex items-center gap-1.5">
                  <g.icon size={12} />
                  {g.label}
                </span>
                <span className={cn('transition-transform duration-200', expanded ? 'rotate-0' : '-rotate-90')}>
                  <ChevronDown size={12} />
                </span>
              </button>
              {expanded && (
                <div className="mt-1 space-y-0.5 animate-fade-in">
                  {visibleItems.map((it) => (
                    <NavItem key={it.to} {...it} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="absolute inset-x-0 bottom-0 border-t border-border/80 p-3">
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

function NavItem({ to, label, icon: Icon, end }: Item) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
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
              'transition-transform duration-200',
              isActive ? 'text-brand-400' : 'group-hover:scale-110 group-hover:text-zinc-100',
            )}
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
