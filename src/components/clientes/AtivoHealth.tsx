import type { Ativo } from '@/types/database'
import { cn, statusAtivoColor, statusAtivoLabel, tipoAtivoLabel, TIPOS_ATIVO } from '@/lib/utils'

export function AtivoHealth({ ativos }: { ativos: Ativo[] }) {
  const byTipo = new Map(ativos.map((a) => [a.tipo, a]))
  return (
    <div className="flex items-center gap-1.5">
      {TIPOS_ATIVO.map((tipo) => {
        const a = byTipo.get(tipo)
        const color = a ? statusAtivoColor[a.status] : 'bg-zinc-700'
        const label = `${tipoAtivoLabel[tipo]}: ${a ? statusAtivoLabel[a.status] : 'Não iniciado'}`
        return <span key={tipo} className={cn('h-2.5 w-2.5 rounded-full', color)} title={label} />
      })}
    </div>
  )
}
