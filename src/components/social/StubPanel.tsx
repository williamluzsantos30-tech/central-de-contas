import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Construction } from 'lucide-react'

interface Props {
  titulo: string
  descricao: string
  proximaSprint: string
}

/**
 * Stub usado nas tabs ainda não implementadas (Planejamento mensal,
 * Calendário detalhado, Métricas, Banco de ideias). Mostra a forma
 * final + sprint prevista.
 */
export function StubPanel({ titulo, descricao, proximaSprint }: Props) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
        <Construction size={36} className="text-muted" />
        <h2 className="text-lg font-semibold text-zinc-100">{titulo}</h2>
        <p className="max-w-md text-sm text-muted">{descricao}</p>
        <Badge tone="brand">Próxima sprint: {proximaSprint}</Badge>
      </CardBody>
    </Card>
  )
}
