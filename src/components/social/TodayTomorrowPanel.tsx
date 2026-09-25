/**
 * TodayTomorrowPanel — destaque das demandas de postagem dos próximos 2 dias.
 *
 * Ordem: Atrasadas (qualquer dia anterior, não publicadas) no topo, depois
 * duas colunas Hoje / Amanhã. Escopado aos clientes já filtrados na página.
 */
import { useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { PostTaskCard } from '@/components/social/PostTaskCard'
import { getPostsForDateRange, startOfToday, type PostView } from '@/lib/socialPosts'
import type { Cliente, ItemSocialMedia, PlanejamentoSocialMedia } from '@/types/database'

function formatarDia(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

/** Ordena por estado (atrasado > agendado > publicado) e depois por cliente. */
function ordenarPosts(posts: PostView[]): PostView[] {
  const peso: Record<PostView['estado'], number> = { atrasado: 0, agendado: 1, publicado: 2 }
  return [...posts].sort(
    (a, b) => peso[a.estado] - peso[b.estado] || a.clienteNome.localeCompare(b.clienteNome),
  )
}

export function TodayTomorrowPanel({
  items,
  planejamentos,
  clientes,
  onChanged,
}: {
  items: ItemSocialMedia[]
  planejamentos: PlanejamentoSocialMedia[]
  clientes: Cliente[]
  onChanged: () => void
}) {
  const { atrasadas, hoje, amanha, hojeDate, amanhaDate } = useMemo(() => {
    const inicioHoje = startOfToday()
    const fimHoje = new Date(inicioHoje)
    const inicioAmanha = new Date(inicioHoje)
    inicioAmanha.setDate(inicioAmanha.getDate() + 1)

    // Atrasadas: qualquer prazo anterior a hoje, não publicado.
    const inicioPassado = new Date(inicioHoje)
    inicioPassado.setFullYear(inicioPassado.getFullYear() - 5)
    const fimPassado = new Date(inicioHoje)
    fimPassado.setDate(fimPassado.getDate() - 1)

    const atrasadas = getPostsForDateRange(items, planejamentos, clientes, inicioPassado, fimPassado)
      .filter((p) => p.estado === 'atrasado')
    const hoje = getPostsForDateRange(items, planejamentos, clientes, inicioHoje, fimHoje)
    const amanha = getPostsForDateRange(items, planejamentos, clientes, inicioAmanha, inicioAmanha)

    return {
      atrasadas: ordenarPosts(atrasadas),
      hoje: ordenarPosts(hoje),
      amanha: ordenarPosts(amanha),
      hojeDate: inicioHoje,
      amanhaDate: inicioAmanha,
    }
  }, [items, planejamentos, clientes])

  const vazioGlobal = atrasadas.length === 0 && hoje.length === 0 && amanha.length === 0

  return (
    <div className="mb-4 rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">📋 Hoje e Amanhã</h3>
        <p className="text-[11px] text-muted">Demandas de postagem para os próximos 2 dias</p>
      </div>

      {vazioGlobal ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border py-8 text-center">
          <CheckCircle2 size={18} className="text-emerald-400/70" />
          <p className="text-xs text-muted">Nenhuma postagem para hoje ou amanhã 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {atrasadas.length > 0 && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/[0.04] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                ⚠ Atrasadas · {atrasadas.length}
              </p>
              <div className="space-y-2">
                {atrasadas.map((p) => (
                  <PostTaskCard key={p.id} post={p} onChanged={onChanged} />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <ColunaDia titulo="Hoje" data={hojeDate} posts={hoje} onChanged={onChanged} />
            <ColunaDia titulo="Amanhã" data={amanhaDate} posts={amanha} onChanged={onChanged} />
          </div>
        </div>
      )}
    </div>
  )
}

function ColunaDia({
  titulo,
  data,
  posts,
  onChanged,
}: {
  titulo: string
  data: Date
  posts: PostView[]
  onChanged: () => void
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {titulo} — <span className="text-zinc-300">{formatarDia(data)}</span>
      </p>
      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted">
          Nada pra {titulo.toLowerCase()}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <PostTaskCard key={p.id} post={p} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  )
}
