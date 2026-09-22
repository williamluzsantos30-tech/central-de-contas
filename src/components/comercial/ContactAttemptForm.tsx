/**
 * ContactAttemptForm — registra uma tentativa, genérico por `contexto`:
 *  - 'sdr'    → tentativa de CONTATO (follow-up pré-qualificação do SDR)
 *  - 'social' → tentativa de ABORDAGEM (prospecção do Social Selling)
 * Mesma estrutura visual; muda rótulos, opções e a ação no store.
 */
import { useEffect, useState } from 'react'
import { Modal, PrimaryButton, OutlineButton, Input, Select, Textarea } from '@/components/ds'
import {
  RESULTADO_TENTATIVA_OPCOES,
  TIPOS_ABORDAGEM_OPCOES,
  type ResultadoTentativa,
  type TipoAbordagemSocial,
} from '@/pages/comercial/mockLeads'
import { useComercial } from '@/pages/comercial/store'

export function ContactAttemptForm({
  open,
  onClose,
  leadId,
  contexto = 'sdr',
}: {
  open: boolean
  onClose: () => void
  leadId: string
  contexto?: 'sdr' | 'social'
}) {
  const { registrarTentativa, registrarAbordagemSocial } = useComercial()
  const social = contexto === 'social'
  const opcoes = social ? TIPOS_ABORDAGEM_OPCOES : RESULTADO_TENTATIVA_OPCOES

  const [tipo, setTipo] = useState<string>(opcoes[0].key)
  const [observacao, setObservacao] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')

  useEffect(() => {
    if (open) {
      setTipo(opcoes[0].key)
      setObservacao('')
      setData('')
      setHora('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function salvar() {
    if (social) {
      registrarAbordagemSocial(leadId, {
        tipo: tipo as TipoAbordagemSocial,
        observacao,
        proximaAbordagem: data || undefined,
      })
    } else {
      registrarTentativa(leadId, {
        resultado: tipo as ResultadoTentativa,
        observacao,
        proximoContato: data ? `${data}T${hora || '09:00'}` : undefined,
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={social ? 'Registrar tentativa de abordagem' : 'Registrar tentativa de contato'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar}>Salvar tentativa</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={social ? 'Tipo de abordagem' : 'Resultado do contato'}>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {opcoes.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Observação (opcional)">
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder={social ? 'Ex.: respondeu perguntando preço, reforçar amanhã' : 'Contexto da tentativa...'} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label={social ? 'Próxima abordagem — data' : 'Próximo contato — data'}>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          {!social && (
            <Campo label="Hora">
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </Campo>
          )}
        </div>
        <p className="text-[10px] text-muted">
          {social
            ? 'O lead continua na prospecção — isso só registra a abordagem e agenda o retorno.'
            : 'O lead continua em qualificação — isso só registra a tentativa e agenda o retorno.'}
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
