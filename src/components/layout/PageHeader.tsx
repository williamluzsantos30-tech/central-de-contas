import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 animate-fade-in">
      <div className="relative">
        <span aria-hidden className="absolute -left-3 top-1.5 h-6 w-0.5 rounded-full bg-brand-500" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
