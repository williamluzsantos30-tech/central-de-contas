/**
 * LeadHandoffButton — ação "Enviar para SDR" do Social Selling.
 * Abre um modal de confirmação com seleção do SDR responsável
 * (ou distribuição automática round-robin simples).
 */
import { useState } from 'react'
import { Send } from 'lucide-react'
import { Modal, PrimaryButton, OutlineButton, Select } from '@/components/ds'
import { EQUIPE_COMERCIAL, type Lead } from '@/pages/comercial/mockLeads'
import { useComercial } from '@/pages/comercial/store'

export function LeadHandoffButton({ lead }: { lead: Lead }) {
  const { enviarParaSDR } = useComercial()
  const [open, setOpen] = useState(false)
  const [sdrId, setSdrId] = useState('auto')
  const [enviando, setEnviando] = useState(false)

  const sdrs = EQUIPE_COMERCIAL.sdrs

  function confirmar() {
    setEnviando(true)
    // Distribuição automática: escolhe um SDR de forma simples (round-robin
    // por hash do id do lead) quando o usuário não seleciona ninguém.
    const escolhido =
      sdrId === 'auto'
        ? sdrs[Math.abs(hash(lead.id)) % sdrs.length]?.id ?? sdrs[0].id
        : sdrId
    enviarParaSDR(lead.id, escolhido)
    setEnviando(false)
    setOpen(false)
  }

  return (
    <>
      <PrimaryButton size="sm" onClick={() => setOpen(true)}>
        <Send size={13} /> Enviar para SDR
      </PrimaryButton>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enviar lead para o SDR"
        footer={
          <div className="flex items-center justify-end gap-2">
            <OutlineButton size="sm" onClick={() => setOpen(false)} disabled={enviando}>
              Cancelar
            </OutlineButton>
            <PrimaryButton size="sm" onClick={confirmar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Confirmar envio'}
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            <span className="font-medium text-zinc-200">{lead.nomeContato}</span> · {lead.empresa} vai
            para a fila de qualificação do SDR.
          </p>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
              SDR responsável
            </label>
            <Select value={sdrId} onChange={(e) => setSdrId(e.target.value)}>
              <option value="auto">Distribuição automática</option>
              {sdrs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>
    </>
  )
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}
