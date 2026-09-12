import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white border border-brand-400/30 shadow-[0_4px_14px_-4px_rgba(124,58,237,0.45)] hover:shadow-[0_6px_22px_-4px_rgba(124,58,237,0.6)] hover:brightness-110',
  secondary:
    'bg-bg-elev hover:bg-zinc-800 text-zinc-100 border border-border hover:border-border/60',
  ghost: 'hover:bg-bg-elev text-zinc-300 border border-transparent',
  danger:
    'bg-danger hover:bg-red-600 text-white border border-red-400/30 shadow-[0_4px_14px_-4px_rgba(239,68,68,0.5)]',
  outline:
    'border border-border hover:border-border/60 hover:bg-bg-elev text-zinc-200 hover:text-zinc-100',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-all duration-200 ease-out',
        'active:scale-[0.97]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
})
