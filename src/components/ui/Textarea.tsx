import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-[80px] w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm text-zinc-100 placeholder:text-muted',
          'transition-[border-color,box-shadow] duration-200',
          'hover:border-border/60',
          'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15',
          className,
        )}
        {...rest}
      />
    )
  },
)
