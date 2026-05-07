import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Drawer({ open, onClose, title, children, className }: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-md border-l border-border bg-bg-card shadow-2xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-bg-elev hover:text-zinc-100">
            <X size={16} />
          </button>
        </div>
        <div className="h-[calc(100%-49px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
