/**
 * Store genérico de "fluxo" (JSON por registro) pras esteiras de Webdesign:
 * uma tabela `<tabela>(<coluna_id> uuid pk, dados jsonb, updated_at)`. Se a
 * tabela ainda não existe no banco (migration não rodada), cai no
 * localStorage e avisa — a tela funciona, só não é compartilhada.
 */
import { supabase } from '@/lib/supabase'

export interface FluxoStore<T> {
  carregar: () => Promise<Map<string, T>>
  salvar: (id: string, dados: T) => Promise<void>
  /** true = banco; false = só no navegador; null = ainda não sabe. */
  noBanco: () => boolean | null
}

export function criarFluxoStore<T>(tabela: string, colunaId: string, chaveLocal: string, normalizar: (raw: unknown) => T): FluxoStore<T> {
  let modoBanco: boolean | null = null

  const lerLocal = (): Record<string, unknown> => {
    try {
      return JSON.parse(window.localStorage.getItem(chaveLocal) ?? '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }

  return {
    noBanco: () => modoBanco,
    async carregar() {
      const { data, error } = await supabase.from(tabela).select(`${colunaId}, dados`)
      if (!error) {
        modoBanco = true
        return new Map(((data as unknown as Record<string, unknown>[]) ?? []).map((r) => [r[colunaId] as string, normalizar(r.dados)]))
      }
      modoBanco = false
      return new Map(Object.entries(lerLocal()).map(([id, d]) => [id, normalizar(d)]))
    },
    async salvar(id, dados) {
      if (modoBanco !== false) {
        const { error } = await supabase
          .from(tabela)
          .upsert({ [colunaId]: id, dados, updated_at: new Date().toISOString() }, { onConflict: colunaId })
        if (!error) {
          modoBanco = true
          return
        }
        modoBanco = false
      }
      try {
        const todos = lerLocal()
        todos[id] = dados
        window.localStorage.setItem(chaveLocal, JSON.stringify(todos))
      } catch {
        /* storage indisponível */
      }
    },
  }
}
