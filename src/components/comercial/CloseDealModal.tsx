/**
 * CloseDealModal — "Registrar resultado da call" (Closer).
 * Mostra o briefing (readonly) + BANT recebidos do SDR, e registra o
 * desfecho: se FECHOU, coleta Valor da Proposta, Ticket Mensal, Squad e
 * Tipo de Serviço e cria o Cliente real (Onboarding) via store; se NÃO
 * fechou, registra o motivo da perda.
 */
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Modal, PrimaryButton, OutlineButton, Input, Select, Badge } from '@/components/ds'
import { TIPOS_CLIENTE, tipoClienteLabel } from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { MOTIVOS_PERDA, type Lead } from '@/pages/comercial/mockLeads'
import { useComercial } from '@/pages/comercial/store'
import { fmtBRL } from './LeadsTable'

export function CloseDealModal({
  open,
  onClose,
  lead,
}: {
  open: boolean
  onClose: () => void
  lead: Lead | null
}) {
  const { registrarResultado } = useComercial()
  const { nomes: squadsAtivos } = useSquads()
  const [fechou, setFechou] = useState<boolean | null>(null)
  const [valorProposta, setValorProposta] = useState('')
  const [ticketMensal, setTicketMensal] = useState('')
  const [squad, setSquad] = useState('')
  const [tipoServico, setTipoServico] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function reset() {
    setFechou(null)
    setValorProposta('')
    setTicketMensal('')
    setSquad('')
    setTipoServico('')
    setMotivoPerda('')
    setErro(null)
  }

  function fechar() {
    reset()
    onClose()
  }

  async function salvar() {
    if (!lead) return
    setErro(null)
    if (fechou === null) {
      setErro('Selecione o resultado da call.')
      return
    }
    if (fechou) {
      const vp = Number(valorProposta)
      const tm = Number(ticketMensal)
      if (!vp || vp <= 0) return setErro('Informe o valor da proposta.')
      if (!tm || tm <= 0) return setErro('Informe o ticket mensal (vai pro cadastro do Cliente).')
      if (!squad) return setErro('Selecione a squad.')
      if (!tipoServico) return setErro('Selecione o tipo de serviço.')
      setSalvando(true)
      try {
        await registrarResultado(lead.id, {
          fechou: true,
          valorProposta: vp,
          ticketMensal: tm,
          squad,
          tipoServico,
        })
        fechar()
      } catch (e) {
        setErro('Falha ao criar o Cliente: ' + ((e as Error)?.message ?? 'erro desconhecido'))
      } finally {
        setSalvando(false)
      }
    } else {
      if (!motivoPerda) return setErro('Selecione o motivo da perda.')
      setSalvando(true)
      try {
        await registrarResultado(lead.id, { fechou: false, motivoPerda })
        fechar()
      } catch (e) {
        setErro((e as Error)?.message ?? 'Falha ao registrar.')
      } finally {
        setSalvando(false)
      }
    }
  }

  if (!lead) return null

  return (
    <Modal
      open={open}
      onClose={fechar}
      title={`Registrar resultado · ${lead.empresa}`}
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">
            {fechou === true && 'Ao salvar, cria o Cliente em Onboarding.'}
          </span>
          <div className="flex items-center gap-2">
            <OutlineButton size="sm" onClick={fechar} disabled={salvando}>
              Cancelar
            </OutlineButton>
            <PrimaryButton size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Briefing recebido do SDR (readonly) */}
        <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">
            Briefing do SDR
          </div>
          <p className="whitespace-pre-wrap text-xs text-zinc-200">
            {lead.briefingQualificacao || lead.resumoConversa || 'Sem briefing registrado.'}
          </p>
          {lead.bant && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted">
              <span><strong className="text-zinc-300">B</strong> · {lead.bant.orcamento || '—'}</span>
              <span><strong className="text-zinc-300">A</strong> · {lead.bant.autoridade || '—'}</span>
              <span><strong className="text-zinc-300">N</strong> · {lead.bant.necessidade || '—'}</span>
              <span><strong className="text-zinc-300">T</strong> · {lead.bant.tempoUrgencia || '—'}</span>
              <span>Invest. alinhado · {fmtBRL(lead.bant.investimentoMensal)}</span>
              {lead.bant.classificacaoLead && (
                <span>Classificação · <Badge tone="accent">{lead.bant.classificacaoLead}</Badge></span>
              )}
            </div>
          )}
        </div>

        {/* Resultado */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFechou(true)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              fechou === true
                ? 'border-green-500/50 bg-green-500/15 text-green-200'
                : 'border-border text-muted hover:text-zinc-200'
            }`}
          >
            <CheckCircle2 size={15} /> Fechou
          </button>
          <button
            type="button"
            onClick={() => setFechou(false)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              fechou === false
                ? 'border-red-500/50 bg-red-500/15 text-red-200'
                : 'border-border text-muted hover:text-zinc-200'
            }`}
          >
            <XCircle size={15} /> Não fechou
          </button>
        </div>

        {fechou === true && (
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor da proposta (R$)">
              <Input type="number" min={0} value={valorProposta} onChange={(e) => setValorProposta(e.target.value)} placeholder="4200" />
            </Campo>
            <Campo label="Ticket mensal (R$)">
              <Input type="number" min={0} value={ticketMensal} onChange={(e) => setTicketMensal(e.target.value)} placeholder="2500" />
            </Campo>
            <Campo label="Squad">
              <Select value={squad} onChange={(e) => setSquad(e.target.value)}>
                <option value="">Selecione</option>
                {squadsAtivos.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Campo>
            <Campo label="Tipo de serviço">
              <Select value={tipoServico} onChange={(e) => setTipoServico(e.target.value)}>
                <option value="">Selecione</option>
                {TIPOS_CLIENTE.map((t) => (
                  <option key={t} value={t}>{tipoClienteLabel[t]}</option>
                ))}
              </Select>
            </Campo>
          </div>
        )}

        {fechou === false && (
          <Campo label="Motivo da perda">
            <Select value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)}>
              <option value="">Selecione</option>
              {MOTIVOS_PERDA.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Campo>
        )}

        {erro && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{erro}</span>
          </div>
        )}
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
