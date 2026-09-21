/** Tabela de Metas Comerciais (por periodicidade) com editar/excluir. */
import { Pencil, Trash2 } from 'lucide-react'
import { weekLabel } from '@/pages/comercial/marketingCalculator'
import { formatMetaValor, metricaLabel, type MetaComercial } from '@/pages/comercial/mockMetasComerciais'
import { useComercial } from '@/pages/comercial/store'
import { escopoLabel } from './GoalProgressCard'

export function MetasComerciaisTable({ metas, onEdit }: { metas: MetaComercial[]; onEdit: (m: MetaComercial) => void }) {
  const { excluirMeta } = useComercial()
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2 font-semibold">Métrica</th>
            <th className="px-3 py-2 font-semibold">Escopo</th>
            <th className="px-3 py-2 font-semibold text-right">Valor meta</th>
            <th className="px-3 py-2 font-semibold">Período</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {metas.map((m) => (
            <tr key={m.id} className="border-b border-border/60 last:border-b-0">
              <td className="px-3 py-2 text-zinc-200">{metricaLabel(m.metrica)}</td>
              <td className="px-3 py-2 text-muted">{escopoLabel(m)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{formatMetaValor(m.metrica, m.valorMeta)}</td>
              <td className="px-3 py-2 text-[11px] capitalize text-muted">
                {m.periodicidade === 'mensal' ? m.periodoReferencia : weekLabel(m.periodoReferencia)}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex gap-1">
                  <button onClick={() => onEdit(m)} className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-brand-300" title="Editar">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => confirm('Excluir esta meta?') && excluirMeta(m.id)}
                    className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-red-300"
                    title="Excluir"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {metas.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-[11px] text-muted">Nenhuma meta cadastrada nesta periodicidade.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
