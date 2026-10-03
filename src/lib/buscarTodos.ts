/**
 * O Supabase (PostgREST) devolve NO MÁXIMO 1000 linhas por consulta — o que
 * passa disso é cortado SEM erro. Em tabelas que crescem (artes de social,
 * planejamentos) isso escondia conteúdo: a esteira de Produção listava só as
 * primeiras artes de cada planejamento. Estes helpers buscam em páginas até
 * acabar.
 *
 * `montar(de, ate)` recebe o intervalo e devolve a consulta com `.range(de, ate)`
 * e uma ORDEM ESTÁVEL (termine em `.order('id')`), senão as páginas se repetem.
 */
const PAGINA = 1000
const MAX_PAGINAS = 200

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function buscarTodos<T>(
  montar: (de: number, ate: number) => Resposta<T>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todos: T[] = []
  let de = 0
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const { data, error } = await montar(de, de + PAGINA - 1)
    if (error) return { data: todos, error }
    const linhas = data ?? []
    if (linhas.length === 0) break
    todos.push(...linhas)
    // Avança pelo que veio (não pelo tamanho pedido): funciona mesmo se o
    // limite do servidor for menor que a página.
    de += linhas.length
  }
  return { data: todos, error: null }
}

/**
 * Igual, filtrando por uma lista de ids com `.in()` em lotes — centenas de
 * UUIDs numa consulta só estouram o tamanho da URL.
 */
export async function buscarTodosPorIds<T>(
  ids: string[],
  montar: (lote: string[], de: number, ate: number) => Resposta<T>,
  tamanhoLote = 150,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todos: T[] = []
  for (let i = 0; i < ids.length; i += tamanhoLote) {
    const lote = ids.slice(i, i + tamanhoLote)
    const { data, error } = await buscarTodos<T>((de, ate) => montar(lote, de, ate))
    todos.push(...data)
    if (error) return { data: todos, error }
  }
  return { data: todos, error: null }
}
