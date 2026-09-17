/**
 * Store da Central Operacional — mantém os setores + documentos em estado
 * compartilhado entre a Overview e o Detalhe do Setor, pra que "Novo
 * Documento" apareça na lista e a contagem do card suba automaticamente.
 *
 * Provider fica acima das rotas /central-operacional (ver App.tsx), então
 * o estado sobrevive à navegação entre as telas.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { SETORES_INICIAIS, type Documento, type Setor } from './mockDocuments'

interface CentralCtx {
  setores: Setor[]
  addDocumento: (setorId: string, novo: Omit<Documento, 'id'>) => void
  updateDocumento: (setorId: string, docId: string, patch: Partial<Omit<Documento, 'id'>>) => void
  removeDocumento: (setorId: string, docId: string) => void
}

const Ctx = createContext<CentralCtx | null>(null)

export function CentralOperacionalProvider({ children }: { children: ReactNode }) {
  const [setores, setSetores] = useState<Setor[]>(SETORES_INICIAIS)

  const addDocumento = useCallback((setorId: string, novo: Omit<Documento, 'id'>) => {
    setSetores((prev) =>
      prev.map((s) =>
        s.id === setorId
          ? { ...s, documentos: [{ ...novo, id: `doc-${Date.now()}` }, ...s.documentos] }
          : s,
      ),
    )
  }, [])

  const updateDocumento = useCallback(
    (setorId: string, docId: string, patch: Partial<Omit<Documento, 'id'>>) => {
      setSetores((prev) =>
        prev.map((s) =>
          s.id === setorId
            ? { ...s, documentos: s.documentos.map((d) => (d.id === docId ? { ...d, ...patch } : d)) }
            : s,
        ),
      )
    },
    [],
  )

  const removeDocumento = useCallback((setorId: string, docId: string) => {
    setSetores((prev) =>
      prev.map((s) =>
        s.id === setorId ? { ...s, documentos: s.documentos.filter((d) => d.id !== docId) } : s,
      ),
    )
  }, [])

  return (
    <Ctx.Provider value={{ setores, addDocumento, updateDocumento, removeDocumento }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCentral(): CentralCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCentral precisa do CentralOperacionalProvider')
  return c
}
