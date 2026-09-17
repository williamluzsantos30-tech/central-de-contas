/**
 * Store da Gestão de Flags — colaboradores + flags em estado compartilhado
 * entre a lista e o detalhe. Registrar uma flag reflete nos dois (contadores
 * e KPIs são derivados). Provider fica acima das rotas /flags (App.tsx).
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  AMARELA_VALIDADE_DIAS,
  COLABORADORES_INICIAIS,
  maisDias,
  type Colaborador,
  type StatusFlag,
  type TipoFlag,
} from './mockFlags'

export interface NovaFlag {
  tipo: TipoFlag
  categoria: string
  motivo: string
  descricao?: string
}

interface FlagsCtx {
  colaboradores: Colaborador[]
  registrarFlag: (colabId: string, nova: NovaFlag) => void
  reverterFlag: (colabId: string, flagId: string) => void
}

const Ctx = createContext<FlagsCtx | null>(null)

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(COLABORADORES_INICIAIS)

  const registrarFlag = useCallback((colabId: string, nova: NovaFlag) => {
    const criadaEm = new Date().toISOString()
    setColaboradores((prev) =>
      prev.map((c) =>
        c.id === colabId
          ? {
              ...c,
              flags: [
                {
                  id: `flag-${Date.now()}`,
                  tipo: nova.tipo,
                  categoria: nova.categoria,
                  motivo: nova.motivo,
                  descricao: nova.descricao,
                  criadaEm,
                  expiraEm: nova.tipo === 'amarela' ? maisDias(criadaEm, AMARELA_VALIDADE_DIAS) : null,
                  status: 'ativa' as StatusFlag,
                },
                ...c.flags,
              ],
            }
          : c,
      ),
    )
  }, [])

  const reverterFlag = useCallback((colabId: string, flagId: string) => {
    setColaboradores((prev) =>
      prev.map((c) =>
        c.id === colabId
          ? { ...c, flags: c.flags.map((f) => (f.id === flagId ? { ...f, status: 'revertida' as StatusFlag } : f)) }
          : c,
      ),
    )
  }, [])

  return (
    <Ctx.Provider value={{ colaboradores, registrarFlag, reverterFlag }}>{children}</Ctx.Provider>
  )
}

export function useFlags(): FlagsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFlags precisa do FlagsProvider')
  return c
}
