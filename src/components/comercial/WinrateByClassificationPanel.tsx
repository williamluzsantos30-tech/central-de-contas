/**
 * WinrateByClassificationPanel — Funil Tráfego, bloco 3: winrate por
 * classificação (fechados ÷ leads que chegaram ao Closer com call realizada).
 * Um card por classe + barras verticais comparativas + leitura em texto.
 */
import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtBRL } from '@/components/comercial/LeadsTable'
import { insightWinrate, type WinrateClasse } from '@/pages/comercial/trafficFunnelCalculator'
import { COR_CLASSE, TEXTO_CLASSE } from './classificacaoCores'

export function WinrateByClassificationPanel({ dados }: { dados: WinrateClasse[] }) {
  const max = Math.max(1, ...dados.map((d) => d.winrate))
  const insight = insightWinrate(dados)
  const semBase = dados.every((d) => d.chegaram === 0)

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Winrate por classificação</h3>
      <p className="mt-0.5 text-[11px] text-muted">Fechados ÷ leads que chegaram ao Closer com call realizada (sem no-show).</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {dados.map((d) => (
          <div key={d.classe} className="rounded-lg border border-border bg-bg-soft/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_CLASSE[d.classe] }} /> Lead {d.classe}
            </div>
            <p className={cn('mt-1 text-2xl font-bold tabular-nums', d.chegaram ? TEXTO_CLASSE[d.classe] : 'text-muted')}>
              {d.chegaram ? `${d.winrate.toFixed(0)}%` : '—'}
            </p>
            <p className="text-[11px] tabular-nums text-muted">
              {d.fechados} de {d.chegaram} call{d.chegaram === 1 ? '' : 's'}
            </p>
            {d.fechados > 0 && <p className="text-[11px] tabular-nums text-muted">ticket {fmtBRL(d.ticketMedio)}/mês</p>}
          </div>
        ))}
      </div>

      {!semBase && (
        <div className="mt-4 flex h-36 items-end justify-around gap-4 border-b border-border px-4" role="img" aria-label="Winrate por classificação">
          {dados.map((d) => (
            <div key={d.classe} className="flex h-full w-14 flex-col items-center justify-end">
              <span className="mb-1 text-[11px] font-semibold tabular-nums text-zinc-200">{d.chegaram ? `${d.winrate.toFixed(0)}%` : '—'}</span>
              <div
                className="w-full rounded-t-md transition-all"
                style={{ height: `${Math.max(d.winrate > 0 ? 4 : 1, (d.winrate / max) * 100)}%`, background: COR_CLASSE[d.classe], opacity: 0.9 }}
              />
            </div>
          ))}
        </div>
      )}
      {!semBase && (
        <div className="flex justify-around gap-4 px-4 pt-1">
          {dados.map((d) => (
            <span key={d.classe} className="w-14 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
              Lead {d.classe}
            </span>
          ))}
        </div>
      )}

      {semBase ? (
        <p className="mt-4 text-center text-[11px] text-muted">Nenhuma call realizada no período ainda.</p>
      ) : (
        insight && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-[12px] text-brand-100">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-brand-300" />
            <span>{insight}</span>
          </div>
        )
      )}
    </div>
  )
}
