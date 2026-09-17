/**
 * Badge/pill semântico — fundo translúcido + texto saturado da mesma cor.
 * Usado pra status, categorias e tags de cargo.
 */
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { badgeTone, type Tone } from './tones'

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ tone = 'neutral', className, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
        badgeTone[tone],
        className,
      )}
      {...rest}
    />
  )
}
