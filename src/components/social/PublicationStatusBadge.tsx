import { Bot, Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { StatusPublicacao } from './mockPosts'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/**
 * Badge do status de publicação de um post. Semântica de cor do projeto:
 * azul (info) = automação/API · verde (success) = sucesso · vermelho (danger)
 * = falha · âmbar (warning) = fluxo manual/atenção · neutro = pendente.
 */
const META: Record<
  StatusPublicacao,
  { tone: Tone; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; spin?: boolean }
> = {
  pendente: { tone: 'neutral', label: 'Pendente', Icon: Clock },
  agendado_manual: { tone: 'warning', label: 'Agendado (manual)', Icon: Clock },
  publicado_manual: { tone: 'success', label: 'Publicado (manual)', Icon: CheckCircle2 },
  agendado_api: { tone: 'info', label: 'Agendado via API', Icon: Bot },
  processando: { tone: 'info', label: 'Publicando…', Icon: Loader2, spin: true },
  publicado_api: { tone: 'success', label: 'Publicado via API', Icon: CheckCircle2 },
  falha_publicacao: { tone: 'danger', label: 'Falha na publicação', Icon: AlertTriangle },
}

export function PublicationStatusBadge({
  status,
  className,
}: {
  status: StatusPublicacao
  className?: string
}) {
  const m = META[status]
  return (
    <Badge
      tone={m.tone}
      className={cn(status === 'processando' && 'animate-pulse', className)}
      title={m.label}
    >
      <m.Icon size={11} className={m.spin ? 'animate-spin' : undefined} />
      {m.label}
    </Badge>
  )
}
