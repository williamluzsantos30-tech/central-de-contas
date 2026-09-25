/**
 * PostTaskCard — card de linha de uma postagem (demanda do dia).
 * Usado no painel "Hoje e Amanhã" e na expansão do dia no calendário.
 *
 * Mostra: avatar + nome do cliente, badge de formato, badge de estado
 * (Publicado/Atrasado/Agendado), título truncado e ações rápidas à direita
 * (marcar como publicado + abrir o post pra edição).
 */
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { PublicarItemBotao } from '@/components/social/PublicarItemDialog'
import { cn, formatoSocialMediaLabel } from '@/lib/utils'
import type { EstadoPost, PostView } from '@/lib/socialPosts'

const estadoMeta: Record<
  EstadoPost,
  { tone: 'success' | 'danger' | 'brand'; label: string }
> = {
  publicado: { tone: 'success', label: 'Publicado' },
  atrasado: { tone: 'danger', label: 'Atrasado' },
  agendado: { tone: 'brand', label: 'Agendado' },
}

const borderPorEstado: Record<EstadoPost, string> = {
  publicado: 'border-border hover:border-emerald-500/40',
  atrasado: 'border-red-500/60 bg-red-500/[0.04] hover:border-red-500/80',
  agendado: 'border-border hover:border-brand-500/40',
}

export function PostTaskCard({
  post,
  onChanged,
}: {
  post: PostView
  onChanged: () => void
}) {
  const meta = estadoMeta[post.estado]
  const horario =
    !post.item.publicado_em && post.item.programado_em
      ? new Date(post.item.programado_em).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-150',
        borderPorEstado[post.estado],
      )}
    >
      <Avatar name={post.clienteNome} size="sm" className="shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-zinc-100">
            {post.clienteNome}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" className="!text-[10px]">
            {formatoSocialMediaLabel[post.formato]}
          </Badge>
          <Badge tone={meta.tone} className="!text-[10px]">
            {meta.label}
          </Badge>
          {horario && (
            <span className="text-[10px] tabular-nums text-muted">agendado {horario}</span>
          )}
        </div>
        {post.titulo && (
          <p className="mt-0.5 truncate text-[11px] text-muted">{post.titulo}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <PublicarItemBotao item={post.item} onChanged={onChanged} compact />
        <Link
          to={`/social/clientes/${post.clienteId}?aba=operacional-social`}
          className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
          title="Abrir post pra edição"
          aria-label="Abrir post pra edição"
        >
          <Pencil size={13} />
        </Link>
      </div>
    </div>
  )
}
