import type { ReactNode } from 'react'
import { usePermissoes } from '@/hooks/usePermissoes'

/**
 * Guarda de rota por permissão do papel operacional. Enquanto o papel
 * carrega, não bloqueia (evita flash de "sem permissão"). Admin e usuários
 * sem papel passam (regra de rollout do usePermissoes). É trava de UX — a
 * segurança real vem da RLS.
 */
export function RequirePermissao({ perm, children }: { perm: string; children: ReactNode }) {
  const { can, carregando } = usePermissoes()

  if (carregando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
        Carregando...
      </div>
    )
  }

  if (!can(perm)) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-bg-soft/30 p-12 text-center">
        <p className="text-sm text-zinc-200">Sem permissão</p>
        <p className="mt-1 text-[11px] text-muted">
          Seu papel operacional não tem acesso a esta área.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
