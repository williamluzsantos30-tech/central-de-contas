/**
 * FilterBar — barra de filtros padrão: ícone + label "FILTROS" + pills.
 * FilterPill — <select> estilizado como pill (fundo escuro, chevron).
 */
import type { ReactNode } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-soft/40 px-3 py-2', className)}>
      <div className="mr-1 flex items-center gap-1.5 border-r border-border pr-2">
        <SlidersHorizontal size={13} className="text-muted" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Filtros</span>
      </div>
      {children}
    </div>
  )
}

export interface FilterOption {
  value: string
  label: string
}

export function FilterPill({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: FilterOption[]
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-md border border-border bg-bg-elev py-1.5 pl-3 pr-8 text-xs font-medium text-zinc-100 transition-colors hover:border-brand-500/40 focus:border-brand-500/60 focus:outline-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  )
}
