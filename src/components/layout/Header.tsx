import { LogOut, FlaskConical } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { userRoleLabel } from '@/lib/utils'
import { isDemoMode } from '@/lib/supabase'

export function Header() {
  const { profile, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-bg-soft/70 px-6 backdrop-blur-xl">
      <div>
        {isDemoMode && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-300 shadow-[0_0_10px_-2px_rgba(234,179,8,0.3)]">
            <FlaskConical size={12} className="animate-pulse" />
            Modo DEMO — dados fictícios
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2 rounded-lg border border-transparent px-1 transition-colors hover:border-border">
            <Avatar name={profile.nome} url={profile.avatar_url} size="sm" />
            <div className="hidden text-right md:block">
              <p className="text-xs font-medium leading-tight">{profile.nome}</p>
              <p className="text-[10px] text-muted leading-tight">
                {userRoleLabel[profile.role]}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="rounded-md p-2 text-muted transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
          title="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
