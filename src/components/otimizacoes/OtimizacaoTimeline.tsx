import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { formatDate, plataformaLabel, tipoOtimizacaoLabel } from '@/lib/utils'
import type { Otimizacao } from '@/types/database'

export function OtimizacaoTimeline({ otimizacoes }: { otimizacoes: Otimizacao[] }) {
  if (otimizacoes.length === 0) {
    return <p className="text-sm text-muted">Nenhuma otimização registrada.</p>
  }
  return (
    <ol className="relative space-y-6 border-l border-border pl-5">
      {otimizacoes.map((o) => (
        <li key={o.id} className="relative">
          <span className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full border border-border bg-bg-card">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          </span>
          <div className="rounded-xl border border-border bg-bg-soft p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar
                  name={o.responsavel?.nome}
                  url={o.responsavel?.avatar_url ?? null}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium">{o.responsavel?.nome ?? 'Anônimo'}</p>
                  <p className="text-[11px] text-muted">{formatDate(o.data_otimizacao)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge tone="info">{plataformaLabel[o.plataforma]}</Badge>
                <Badge tone="brand">{tipoOtimizacaoLabel[o.tipo]}</Badge>
              </div>
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap">{o.descricao}</p>
            {o.resultado && (
              <p className="mt-2 border-l-2 border-brand-500/40 pl-3 text-xs text-zinc-300 whitespace-pre-wrap">
                <span className="font-medium text-brand-300">Resultado: </span>
                {o.resultado}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
