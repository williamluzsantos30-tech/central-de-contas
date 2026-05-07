import { cn, initials } from '@/lib/utils'

interface Props {
  name?: string | null
  url?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

export function Avatar({ name, url, size = 'md', className }: Props) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ''}
        className={cn('rounded-full object-cover border border-border', sizes[size], className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-500/20 text-brand-300 font-medium border border-brand-500/30',
        sizes[size],
        className,
      )}
      title={name ?? ''}
    >
      {initials(name)}
    </div>
  )
}
