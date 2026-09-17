/**
 * Botões do design system.
 * - PrimaryButton: fundo violet sólido (#7c3aed = brand-600), texto branco.
 *   Reservado a AÇÃO/CTA (nunca pra indicar status).
 * - OutlineButton: borda sutil, fundo transparente, texto claro.
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size
}

export const PrimaryButton = forwardRef<HTMLButtonElement, Props>(function PrimaryButton(
  { className, size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        base,
        sizes[size],
        'border border-brand-500/30 bg-brand-600 text-white hover:bg-brand-500',
        className,
      )}
      {...rest}
    />
  )
})

export const OutlineButton = forwardRef<HTMLButtonElement, Props>(function OutlineButton(
  { className, size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        base,
        sizes[size],
        'border border-border bg-transparent text-zinc-200 hover:border-border/60 hover:bg-bg-elev hover:text-zinc-100',
        className,
      )}
      {...rest}
    />
  )
})
