import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-border bg-bg-soft px-3 text-sm text-zinc-100',
          'transition-[border-color,box-shadow] duration-200',
          'hover:border-border/60',
          'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    )
  },
)
