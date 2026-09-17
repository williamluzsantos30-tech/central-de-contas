/**
 * FormField — label (uppercase pequeno) acima do controle, com marca de
 * obrigatório (*) e hint opcional. Envolve Input/Select/Textarea do sistema.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  required?: boolean
  hint?: ReactNode
  children: ReactNode
  className?: string
}

export function FormField({ label, required, hint, children, className }: Props) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
        {required && <span className="ml-0.5 text-brand-400">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] text-muted">{hint}</span>}
    </label>
  )
}
