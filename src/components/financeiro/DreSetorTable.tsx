/**
 * DreSetorTable — matriz Setor × Categoria de custo/despesa, com Total e % do
 * total por setor, e linha TOTAL destacada. Célula vazia = "—".
 */
import { cn } from '@/lib/utils'
import { CATEGORIAS } from '@/pages/financeiro/mockDespesas'
import { formatBRL } from '@/pages/financeiro/despesasCalculator'
import { CATEGORIA_KEYS, type DreSetorResult } from '@/pages/financeiro/dreSetorCalculator'

const cell = (v: number) => (v > 0 ? formatBRL(v) : '—')

export function DreSetorTable({ data }: { data: DreSetorResult }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
      <table className="w-full text-xs" style={{ minWidth: 860 }}>
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2.5 text-left font-semibold">Setor</th>
            {CATEGORIAS.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-right font-semibold">{c.label}</th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold">Total</th>
            <th className="px-3 py-2.5 text-right font-semibold">% total</th>
          </tr>
        </thead>
        <tbody>
          {data.setores.map((s) => (
            <tr key={s.setor} className={cn('border-b border-border/50 last:border-b-0', s.total === 0 && 'opacity-50')}>
              <td className="px-3 py-2.5 font-medium text-zinc-200">{s.setor}</td>
              {CATEGORIA_KEYS.map((k) => (
                <td key={k} className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{cell(s.porCategoria[k])}</td>
              ))}
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-100">{cell(s.total)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted">{s.pctTotal.toFixed(0)}%</td>
            </tr>
          ))}
          {/* TOTAL */}
          <tr className="border-t-2 border-brand-500/40 bg-brand-500/[0.06]">
            <td className="px-3 py-2.5 font-semibold text-zinc-100">Total (despesas)</td>
            {CATEGORIA_KEYS.map((k) => (
              <td key={k} className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-100">{cell(data.totalPorCategoria[k])}</td>
            ))}
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-100">{cell(data.totalDespesas)}</td>
            <td className="px-3 py-2.5 text-right text-muted">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
