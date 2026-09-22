/**
 * ContactAttemptForm — registra uma tentativa de contato do SDR (follow-up
 * pré-qualificação). Mantém o lead em "em_qualificacao"; só guarda o
 * resultado + agenda o próximo contato.
 */
import { useEffect, useState } from 'react'
import { Modal, PrimaryButton, OutlineButton, Input, Select, Textarea } from '@/components/ds'
import { RESULTADO_TENTATIVA_OPCOES, type ResultadoTentativa } from '@/pages/comercial/mockLeads'
import { useComercial } from '@/pages/comercial/store'

export function ContactAttemptForm({
  open,
  onClose,
  leadId,
}: {
  open: boolean
  onClose: () => void
  leadId: string
}) {
  const { registrarTentativa } = useComercial()
  const [resultado, setResultado] = useState<ResultadoTentativa>('nao_atendeu')
  const [observacao, setObservacao] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')

  useEffect(() => {
    if (open) {
      setResultado('nao_atendeu')
      setObservacao('')
      setData('')
      setHora('')
    }
  }, [open])

  function salvar() {
    const proximoContato = data ? `${data}T${hora || '09:00'}` : undefined
    registrarTentativa(leadId, { resultado, observacao, proximoContato })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar tentativa de contato"
      footer={
        <div className="flex items-center justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar}>Salvar tentativa</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Resultado do contato">
          <Select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoTentativa)}>
            {RESULTADO_TENTATIVA_OPCOES.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Observação (opcional)">
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Contexto da tentativa..." />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Próximo contato — data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo label="Hora">
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Campo>
        </div>
        <p className="text-[10px] text-muted">
          O lead continua em qualificação — isso só registra a tentativa e agenda o retorno.
        </p>
      </div>
    </Modal>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{label}</label>
      {children}
    </div>
  )
}
