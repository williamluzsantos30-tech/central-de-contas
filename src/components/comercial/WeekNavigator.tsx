/** WeekNavigator — navega entre semanas (segunda→domingo) com rótulo. */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addSemanas, weekLabel } from '@/pages/comercial/marketingCalculator'

export function WeekNavigator({ semanaRef, onChange }: { semanaRef: string; onChange: (ref: string) => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={() => onChange(addSemanas(semanaRef, -1))}
        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-brand-500/40 hover:text-brand-300"
        title="Semana anterior"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="min-w-[220px] text-center text-[11px] capitalize text-zinc-200">{weekLabel(semanaRef)}</span>
      <button
        onClick={() => onChange(addSemanas(semanaRef, 1))}
        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-brand-500/40 hover:text-brand-300"
        title="Próxima semana"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
