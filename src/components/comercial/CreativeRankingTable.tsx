/**
 * CreativeRankingTable — Funil Tráfego, bloco 1: ranking de criativos por
 * leads qualificados, com gasto do criativo (Meta Ads) e custo por
 * qualificado. Barra laranja sob o nome = proporção do líder.
 */
import { fmtBRL } from '@/components/comercial/LeadsTable'
import type { LinhaRankingCriativo } from '@/pages/comercial/trafficFunnelCalculator'

export function CreativeRankingTable({
  linhas,
  totais,
}: {
  linhas: LinhaRankingCriativo[]
  totais?: { qualificados: number; gasto: number; custoPorQualificado: number }
}) {
  const max = Math.max(1, ...linhas.map((l) => l.qualificados))

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Ranking de criativos — leads qualificados</h3>
      <p className="mt-0.5 text-[11px] text-muted">
        Apenas criativos que trouxeram pelo menos 1 lead qualificado (SDR + Closer MOV).
      </p>

      {linhas.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted">Nenhum criativo trouxe lead qualificado no período.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 560 }}>
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                <th className="w-8 px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Criativo</th>
                <th className="px-2 py-2 text-right font-semibold">Qualificados</th>
                <th className="px-2 py-2 text-right font-semibold">Gasto do criativo</th>
                <th className="px-2 py-2 text-right font-semibold">Custo por qualificado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.chave} className="border-b border-border/60 last:border-b-0 hover:bg-bg-soft/40">
                  <td className="px-2 py-2.5 align-top tabular-nums text-muted">{i + 1}</td>
                  <td className="px-2 py-2.5">
                    <p
                      className="truncate font-medium text-zinc-100"
                      title={[
                        l.nomeAnuncio,
                        l.idAnuncioMeta ? `ad_id ${l.idAnuncioMeta}` : 'sem anúncio (orgânico)',
                        `${l.leads} lead(s) no total`,
                        l.ctr != null ? `CTR ${l.ctr.toFixed(2).replace('.', ',')}%` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {l.nomeAnuncio}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-bg-soft/70">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${(l.qualificados / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right align-top text-sm font-semibold tabular-nums text-zinc-100">{l.qualificados}</td>
                  <td className="px-2 py-2.5 text-right align-top tabular-nums text-zinc-300">{l.gasto != null ? fmtBRL(l.gasto) : '—'}</td>
                  <td className="px-2 py-2.5 text-right align-top tabular-nums text-zinc-300">
                    {l.custoPorQualificado != null ? fmtBRL(l.custoPorQualificado) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {totais && (
              <tfoot>
                <tr className="border-t-2 border-border bg-bg-soft/40 font-semibold">
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 text-zinc-100">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-100">{totais.qualificados}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-100">{totais.gasto > 0 ? fmtBRL(totais.gasto) : '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-100" title="Gasto rastreado ÷ qualificados dos criativos com gasto">
                    {totais.custoPorQualificado > 0 ? fmtBRL(totais.custoPorQualificado) : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
