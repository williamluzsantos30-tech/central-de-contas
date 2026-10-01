/** Confirmação do "Restaurar padrões" das tarefas do cliente. */
import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { restaurarTarefasPadrao, type ResultadoRestauracao } from '@/lib/restaurarTarefas'
import type { Cliente } from '@/types/database'

export function RestoreDefaultsModal({
  open,
  cliente,
  onClose,
  onRestaurado,
}: {
  open: boolean
  cliente: Pick<Cliente, 'id' | 'modulos' | 'gestor_id' | 'account_manager_id'>
  onClose: () => void
  onRestaurado: (r: ResultadoRestauracao) => void
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) setErro(null)
  }, [open])

  async function confirmar() {
    setSalvando(true)
    setErro(null)
    try {
      const r = await restaurarTarefasPadrao(cliente)
      onRestaurado(r)
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao restaurar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !salvando && onClose()}
      title="Restaurar as tarefas padrão?"
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={salvando}>
            <RotateCcw size={12} className={salvando ? 'animate-spin' : ''} />
            {salvando ? 'Restaurando…' : 'Confirmar restauração'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-200">
        Tarefas personalizadas deste cliente serão removidas e as padrão voltarão às configurações originais. O histórico de ocorrências será mantido.
      </p>
      <p className="mt-3 text-[11px] text-muted">
        O responsável das tarefas padrão volta a ser o gestor de tráfego do cliente. Tarefas esporádicas não são afetadas.
      </p>
      {erro && <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">Não foi possível restaurar: {erro}</p>}
    </Modal>
  )
}
