import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

const tones: Record<Tone, string> = {
  neutral: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  warning: 'bg-yellow-500/25 text-yellow-200 border-yellow-500/60',
  danger: 'bg-red-500/10 text-red-300 border-red-500/30',
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  brand: 'bg-brand-500/10 text-brand-300 border-brand-500/30',
}

export function Badge({ tone = 'neutral', className, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
        'transition-all duration-200',
        tones[tone],
        className,
      )}
      {...rest}
    />
  )
}
