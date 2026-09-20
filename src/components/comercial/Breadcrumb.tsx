/** Breadcrumb simples do Comercial: "Comercial › Social Selling". */
import { ChevronRight } from 'lucide-react'

export function Breadcrumb({ trilha }: { trilha: string[] }) {
  return (
    <nav className="mb-2 flex items-center gap-1 text-[11px] text-muted" aria-label="breadcrumb">
      {trilha.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} className="opacity-50" />}
          <span className={i === trilha.length - 1 ? 'text-zinc-300' : ''}>{item}</span>
        </span>
      ))}
    </nav>
  )
}
