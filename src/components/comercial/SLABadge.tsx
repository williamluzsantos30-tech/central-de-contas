/** Badge de SLA: cor por status + tempo decorrido na etapa. */
import { Clock } from 'lucide-react'
import { Badge, type Tone } from '@/components/ds'
import type { SlaResultado } from '@/pages/comercial/sla'

const tomPorStatus: Record<string, Tone> = {
  no_prazo: 'success',
  atencao: 'warning',
  estourado: 'danger',
}
const rotulo: Record<string, string> = {
  no_prazo: 'No prazo',
  atencao: 'Atenção',
  estourado: 'Estourado',
}

export function SLABadge({ sla }: { sla: SlaResultado }) {
  if (!sla.aplicavel) return <span className="text-[11px] text-muted">—</span>
  return (
    <Badge tone={tomPorStatus[sla.status]}>
      <Clock size={10} /> {sla.label} · {rotulo[sla.status]}
    </Badge>
  )
}
