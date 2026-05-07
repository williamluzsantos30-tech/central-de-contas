import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-border bg-bg-soft px-3 text-sm text-zinc-100 placeholder:text-muted',
          'transition-[border-color,box-shadow] duration-200',
          'hover:border-border/60',
          'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 focus:shadow-[0_0_0_1px_rgba(249,115,22,0.3)]',
          className,
        )}
        {...rest}
      />
    )
  },
)
