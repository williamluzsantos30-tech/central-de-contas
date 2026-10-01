import { Drawer } from '@/components/ui/Drawer'
import { TarefaDetalhes } from './TarefaDetalhes'
import type { Tarefa } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  tarefa: Tarefa | null
  onChanged: () => void
}

export function TarefaDrawer({ open, onClose, tarefa, onChanged }: Props) {
  return (
    <Drawer open={open} onClose={onClose} title={tarefa?.nome ?? 'Tarefa'}>
      {tarefa && <TarefaDetalhes tarefa={tarefa} onChanged={onChanged} onExcluida={onClose} />}
    </Drawer>
  )
}
