/**
 * Store da Gestão de Flags.
 *
 * Os COLABORADORES NÃO são uma lista própria — vêm 100% da fonte central de
 * Membros da Equipe (Configurações > Equipe Operacional). Cada colaborador =
 * um profile real, com CARGO = papel operacional e SQUAD = squad principal.
 * Só ativos entram na listagem/select; inativos ficam acessíveis no detalhe.
 *
 * As FLAGS são dado próprio do módulo — guardadas por `id` do colaborador
 * (profiles.id), nunca duplicando nome/cargo/squad. (Em memória por ora;
 * quando houver tabela de flags no banco, troca-se só a persistência.)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import {
  AMARELA_VALIDADE_DIAS,
  maisDias,
  type Colaborador,
  type Flag,
  type StatusFlag,
  type TipoFlag,
} from './mockFlags'

export interface NovaFlag {
  tipo: TipoFlag
  categoria: string
  motivo: string
  descricao?: string
}

interface MembroRow {
  id: string
  nome: string
  ativo: boolean
  papel?: { nome: string } | null
  squad?: { nome: string } | null
}

interface FlagsCtx {
  /** Todos os membros (ativos + inativos) mapeados p/ Colaborador. A lista e o
   *  select filtram por `ativo`; o detalhe encontra inativos por id. */
  colaboradores: Colaborador[]
  /** Fontes centrais pros filtros da página. */
  squadsAtivos: string[]
  cargos: string[]
  registrarFlag: (colabId: string, nova: NovaFlag) => void
  reverterFlag: (colabId: string, flagId: string) => void
}

const Ctx = createContext<FlagsCtx | null>(null)

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [membros, setMembros] = useState<MembroRow[]>([])
  const [squadsAtivos, setSquadsAtivos] = useState<string[]>([])
  const [cargos, setCargos] = useState<string[]>([])
  // Flags por colaborador (dado próprio do módulo, referenciado pelo id real).
  const [flagsPorColab, setFlagsPorColab] = useState<Record<string, Flag[]>>({})

  useEffect(() => {
    let cancel = false
    async function load() {
      const [mRes, sRes, pRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nome, ativo, papel:papeis_operacionais!profiles_papel_fk(nome), squad:squads!profiles_squad_fk(nome)')
          .order('nome'),
        supabase.from('squads').select('nome').eq('ativo', true).order('nome'),
        supabase.from('papeis_operacionais').select('nome').order('nome'),
      ])
      if (cancel) return
      setMembros((mRes.data as unknown as MembroRow[]) ?? [])
      setSquadsAtivos(((sRes.data as { nome: string }[]) ?? []).map((s) => s.nome))
      setCargos(((pRes.data as { nome: string }[]) ?? []).map((p) => p.nome))
    }
    load()
    return () => {
      cancel = true
    }
  }, [])

  const colaboradores = useMemo<Colaborador[]>(
    () =>
      membros.map((m) => ({
        id: m.id,
        nome: m.nome,
        cargo: m.papel?.nome ?? '—',
        squad: m.squad?.nome ?? null,
        ativo: m.ativo,
        flags: flagsPorColab[m.id] ?? [],
      })),
    [membros, flagsPorColab],
  )

  const registrarFlag = useCallback((colabId: string, nova: NovaFlag) => {
    const criadaEm = new Date().toISOString()
    const nueva: Flag = {
      id: `flag-${Date.now()}`,
      tipo: nova.tipo,
      categoria: nova.categoria,
      motivo: nova.motivo,
      descricao: nova.descricao,
      criadaEm,
      expiraEm: nova.tipo === 'amarela' ? maisDias(criadaEm, AMARELA_VALIDADE_DIAS) : null,
      status: 'ativa' as StatusFlag,
    }
    setFlagsPorColab((prev) => ({ ...prev, [colabId]: [nueva, ...(prev[colabId] ?? [])] }))
  }, [])

  const reverterFlag = useCallback((colabId: string, flagId: string) => {
    setFlagsPorColab((prev) => ({
      ...prev,
      [colabId]: (prev[colabId] ?? []).map((f) =>
        f.id === flagId ? { ...f, status: 'revertida' as StatusFlag } : f,
      ),
    }))
  }, [])

  return (
    <Ctx.Provider value={{ colaboradores, squadsAtivos, cargos, registrarFlag, reverterFlag }}>
      {children}
    </Ctx.Provider>
  )
}

export function useFlags(): FlagsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFlags precisa do FlagsProvider')
  return c
}
