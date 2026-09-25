/**
 * CreativeClassificationCrossTable — Funil Tráfego, bloco 4: criativo ×
 * classificação. Mostra o MIX de qualidade que cada criativo traz (A/B/C),
 * o winrate dos leads dele e o custo por lead A — o que separa "criativo que
 * traz volume" de "criativo que traz cliente".
 */
import { Badge } from '@/components/ds'
import { fmtBRL } from '@/components/comercial/LeadsTable'
import { CLASSIFICACOES, type LinhaCruzamento } from '@/pages/comercial/trafficFunnelCalculator'
import { COR_CLASSE, COR_SEM_CLASSE, TEXTO_CLASSE } from './classificacaoCores'

/** Mínimo de leads classificados pra rotular o criativo (evita conclusão com 1 lead). */
const MIN_BASE = 3

function rotulo(l: LinhaCruzamento) {
  const classificados = l.porClasse.A + l.porClasse.B + l.porClasse.C
  if (classificados < MIN_BASE) return null
  if (l.pct.A >= 40) return <Badge tone="success">traz lead A</Badge>
  if (l.pct.C >= 50) return <Badge tone="danger">muito lead C</Badge>
  return null
}

export function CreativeClassificationCrossTable({ linhas }: { linhas: LinhaCruzamento[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Criativos × Classificação</h3>
      <p className="mt-0.5 text-[11px] text-muted">
        Qualidade dos leads de cada criativo. Volume sem lead A não vira cliente — compare o mix, o winrate e o custo por lead A.
      </p>

      {linhas.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted">Nenhum lead com criativo de origem no período.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 820 }}>
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                <th className="px-2 py-2 text-left font-semibold">Criativo</th>
                <th className="px-2 py-2 text-right font-semibold">Leads</th>
                {CLASSIFICACOES.map((c) => (
                  <th key={c} className="px-2 py-2 text-right font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm" style={{ background: COR_CLASSE[c] }} /> {c}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-semibold" title="Sem classificação no CRM">S/ class.</th>
                <th className="w-40 px-2 py-2 text-left font-semibold">Mix</th>
                <th className="px-2 py-2 text-right font-semibold" title="Fechados ÷ calls realizadas">Winrate</th>
                <th className="px-2 py-2 text-right font-semibold" title="Gasto do criativo ÷ leads A">Custo / lead A</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-b border-border/60 last:border-b-0 hover:bg-bg-soft/40">
                  <td className="max-w-[260px] px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-zinc-100" title={l.nomeAnuncio}>{l.nomeAnuncio}</span>
                      {rotulo(l)}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-zinc-100">{l.leads}</td>
                  {CLASSIFICACOES.map((c) => (
                    <td key={c} className="px-2 py-2 text-right tabular-nums">
                      {l.porClasse[c] > 0 ? (
                        <>
                          <span className={`font-semibold ${TEXTO_CLASSE[c]}`}>{l.porClasse[c]}</span>
                          <span className="ml-1 text-[10px] text-muted">{l.pct[c].toFixed(0)}%</span>
                        </>
                      ) : (
                        <span className="text-muted/60">0</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums text-muted">{l.semClassificacao || '—'}</td>
                  <td className="px-2 py-2">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-soft/70" title={CLASSIFICACOES.map((c) => `${c}: ${l.porClasse[c]}`).join(' · ')}>
                      {CLASSIFICACOES.map((c) =>
                        l.porClasse[c] > 0 ? (
                          <div key={c} style={{ width: `${(l.porClasse[c] / l.leads) * 100}%`, background: COR_CLASSE[c] }} />
                        ) : null,
                      )}
                      {l.semClassificacao > 0 && (
                        <div style={{ width: `${(l.semClassificacao / l.leads) * 100}%`, background: COR_SEM_CLASSE }} />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">
                    {l.chegaram ? `${l.winrate.toFixed(0)}%` : '—'}
                    {l.chegaram > 0 && <span className="ml-1 text-[10px] text-muted">({l.fechados}/{l.chegaram})</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{l.custoPorLeadA != null ? fmtBRL(l.custoPorLeadA) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
