/**
 * GlobalHeader — barra superior full-width: wordmark "domus.agn" à esquerda
 * (serif "domus" branco + "agn" violet) e bloco de perfil à direita
 * (avatar violet com inicial + nome/cargo + sair).
 *
 * Componente de chrome pronto pra adoção no Layout. Auto-suficiente: lê o
 * usuário do AuthContext.
 */
import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { userRoleLabel } from '@/lib/utils'

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={className}>
      <span className="font-serif text-xl font-semibold tracking-tight text-zinc-100">domus</span>
      <span className="font-serif text-xl font-semibold italic tracking-tight text-brand-400">.agn</span>
    </div>
  )
}

export function GlobalHeader() {
  const { profile, signOut } = useAuth()
  const inicial = (profile?.nome ?? '?').trim().charAt(0).toUpperCase()

  return (
    <header className="theme-dark sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-bg px-5">
      <Wordmark />

      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {inicial}
            </span>
            <div className="hidden leading-tight md:block">
              <p className="text-xs font-semibold text-zinc-100">{profile.nome}</p>
              <p className="text-[10px] text-muted">{userRoleLabel[profile.role]}</p>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          title="Sair"
          aria-label="Sair"
          className="rounded-md p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
