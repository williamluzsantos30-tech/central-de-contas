/**
 * TopPostsRanking — "🏆 Melhores Posts do Mês" (Top 3 por taxa de engajamento).
 * Consome MetricasInstagram.posts (mock por ora). Thumbnail com placeholder
 * quando não há imagem.
 */
import { Trophy, Image as ImageIcon, Heart, MessageCircle, Bookmark, Eye, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostInstagram, TipoPost } from './mockInstagram'

const TIPO_LABEL: Record<TipoPost, string> = { reels: 'Reels', carrossel: 'Carrossel', feed: 'Feed', stories: 'Stories' }
const TIPO_CLS: Record<TipoPost, string> = {
  reels: 'border-pink-500/40 bg-pink-500/10 text-pink-200',
  carrossel: 'border-brand-500/40 bg-brand-500/10 text-brand-200',
  feed: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  stories: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
}
const RANK = ['🥇 1º', '🥈 2º', '🥉 3º']

function fmtData(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function TopPostsRanking({ posts, onVerTodos }: { posts: PostInstagram[]; onVerTodos?: () => void }) {
  const top = [...posts].sort((a, b) => b.taxaEngajamento - a.taxaEngajamento).slice(0, 3)

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-amber-300" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Melhores Posts do Mês</h3>
            <p className="text-[11px] text-muted">Ranqueados por engajamento</p>
          </div>
        </div>
        <button
          onClick={onVerTodos}
          className="inline-flex items-center gap-0.5 text-[11px] text-brand-300 transition-colors hover:text-brand-200"
          title="Listagem completa (em breve)"
        >
          Ver todos os posts do mês <ChevronRight size={12} />
        </button>
      </div>

      {top.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">Sem posts no período.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {top.map((post, i) => (
            <PostCard key={post.id} post={post} rank={RANK[i]} />
          ))}
        </div>
      )}
    </div>
  )
}

function PostCard({ post, rank }: { post: PostInstagram; rank: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-soft/40">
      {/* Thumbnail (placeholder quando não há imagem) */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-bg-elev to-bg-soft">
        {post.thumbnailUrl ? (
          <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted/40">
            <ImageIcon size={28} />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          {rank}
        </span>
        <span className={cn('absolute right-2 top-2 rounded-md border px-1.5 py-0.5 text-[9px] font-medium', TIPO_CLS[post.tipo])}>
          {TIPO_LABEL[post.tipo]}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">{fmtData(post.dataPublicacao)}</span>
          <span className="text-sm font-bold tabular-nums text-emerald-300">{post.taxaEngajamento.toFixed(1)}%</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-300">
          <Metric icon={<Eye size={11} />} valor={post.alcance.toLocaleString('pt-BR')} label="alcance" />
          <Metric icon={<Heart size={11} />} valor={post.curtidas.toLocaleString('pt-BR')} label="curtidas" />
          <Metric icon={<MessageCircle size={11} />} valor={post.comentarios.toLocaleString('pt-BR')} label="coment." />
          <Metric icon={<Bookmark size={11} />} valor={post.salvamentos.toLocaleString('pt-BR')} label="salvos" />
        </div>
      </div>
    </div>
  )
}

function Metric({ icon, valor, label }: { icon: React.ReactNode; valor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted">{icon}</span>
      <span className="font-semibold tabular-nums">{valor}</span>
      <span className="text-muted">{label}</span>
    </span>
  )
}
