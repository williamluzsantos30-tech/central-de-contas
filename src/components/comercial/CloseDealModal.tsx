/**
 * CloseDealModal — "Registrar resultado da call" (Closer).
 * 4 desfechos: Fechou (cria Cliente), Não fechou (motivo), No-show
 * (incrementa contador + reagenda) e Em follow-up (proposta enviada,
 * aguardando retorno, com data do próximo contato). Reabrir o card mostra o
 * histórico de follow-ups anteriores.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, CalendarX, RotateCcw } from 'lucide-react'
import { Modal, PrimaryButton, OutlineButton, Input, Select, Textarea, Badge } from '@/components/ds'
import { TIPOS_CLIENTE, tipoClienteLabel } from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { MOTIVOS_PERDA, type Lead } from '@/pages/comercial/mockLeads'
import { useComercial } from '@/pages/comercial/store'
import { fmtBRL, fmtData } from './LeadsTable'

type Resultado = 'fechou' | 'perdido' | 'no_show' | 'followup'

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
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [valorProposta, setValorProposta] = useState('')
  const [ticketMensal, setTicketMensal] = useState('')
  const [squad, setSquad] = useState('')
  const [tipoServico, setTipoServico] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('')
  const [novaData, setNovaData] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [dataProximoContato, setDataProximoContato] = useState('')
  const [obsFollowup, setObsFollowup] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setResultado(null)
      setValorProposta('')
      setTicketMensal('')
      setSquad('')
      setTipoServico('')
      setMotivoPerda('')
      setNovaData('')
      setNovaHora('')
      setDataProximoContato('')
      setObsFollowup('')
      setErro(null)
    }
  }, [open, lead?.id])

  if (!lead) return null

  async function salvar() {
    if (!lead) return
    setErro(null)
    try {
      if (resultado === 'fechou') {
        const vp = Number(valorProposta)
        const tm = Number(ticketMensal)
        if (!vp || vp <= 0) return setErro('Informe o valor da proposta.')
        if (!tm || tm <= 0) return setErro('Informe o ticket mensal (vai pro cadastro do Cliente).')
        if (!squad) return setErro('Selecione a squad.')
        if (!tipoServico) return setErro('Selecione o tipo de serviço.')
        setSalvando(true)
        await registrarResultado(lead.id, { tipo: 'fechou', valorProposta: vp, ticketMensal: tm, squad, tipoServico })
      } else if (resultado === 'perdido') {
        if (!motivoPerda) return setErro('Selecione o motivo da perda.')
        setSalvando(true)
        await registrarResultado(lead.id, { tipo: 'perdido', motivoPerda })
      } else if (resultado === 'no_show') {
        if (!novaData || !novaHora) return setErro('Informe a nova data e hora da reunião.')
        setSalvando(true)
        await registrarResultado(lead.id, { tipo: 'no_show', novaData, novaHora })
      } else if (resultado === 'followup') {
        if (!dataProximoContato) return setErro('Informe a data do próximo contato.')
        setSalvando(true)
        await registrarResultado(lead.id, { tipo: 'followup', dataProximoContato, observacao: obsFollowup.trim() })
      } else {
        return setErro('Selecione o resultado da call.')
      }
      onClose()
    } catch (e) {
      setErro('Falha ao salvar: ' + ((e as Error)?.message ?? 'erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  const noShowCount = lead.contadorNoShow ?? 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar resultado · ${lead.empresa}`}
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">
            {resultado === 'fechou' && 'Ao salvar, cria o Cliente em Onboarding.'}
            {resultado === 'no_show' && 'Reagenda mantendo o mesmo Closer e briefing.'}
          </span>
          <div className="flex items-center gap-2">
            <OutlineButton size="sm" onClick={onClose} disabled={salvando}>Cancelar</OutlineButton>
            <PrimaryButton size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {noShowCount >= 2 && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-2.5 text-xs text-orange-200">
            <AlertTriangle size={14} /> {noShowCount}º no-show — considere desqualificar (No-show recorrente).
          </div>
        )}

        {/* Briefing + BANT (readonly) */}
        <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">Briefing do SDR</div>
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
              {lead.bant.classificacaoLead && <span>Classificação · <Badge tone="accent">{lead.bant.classificacaoLead}</Badge></span>}
            </div>
          )}
        </div>

        {/* Histórico de follow-ups */}
        {lead.historicoFollowups && lead.historicoFollowups.length > 0 && (
          <div className="rounded-lg border border-border bg-bg-card p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
              <RotateCcw size={12} /> Histórico de follow-ups ({lead.historicoFollowups.length})
            </div>
            <ul className="space-y-1">
              {lead.historicoFollowups.map((h, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-muted">
                  <span className="shrink-0 tabular-nums text-zinc-400">{fmtData(h.data)}</span>
                  <span className="text-zinc-300">{h.observacao}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Escolha do resultado */}
        <div className="grid grid-cols-2 gap-2">
          <Opcao ativo={resultado === 'fechou'} onClick={() => setResultado('fechou')} tone="green" icon={<CheckCircle2 size={15} />} label="Fechou" />
          <Opcao ativo={resultado === 'perdido'} onClick={() => setResultado('perdido')} tone="red" icon={<XCircle size={15} />} label="Não fechou" />
          <Opcao ativo={resultado === 'no_show'} onClick={() => setResultado('no_show')} tone="orange" icon={<CalendarX size={15} />} label="No-show (não compareceu)" />
          <Opcao ativo={resultado === 'followup'} onClick={() => setResultado('followup')} tone="blue" icon={<RotateCcw size={15} />} label="Em follow-up" />
        </div>

        {resultado === 'fechou' && (
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor da proposta (R$)"><Input type="number" min={0} value={valorProposta} onChange={(e) => setValorProposta(e.target.value)} placeholder="4200" /></Campo>
            <Campo label="Ticket mensal (R$)"><Input type="number" min={0} value={ticketMensal} onChange={(e) => setTicketMensal(e.target.value)} placeholder="2500" /></Campo>
            <Campo label="Squad">
              <Select value={squad} onChange={(e) => setSquad(e.target.value)}>
                <option value="">Selecione</option>
                {squadsAtivos.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Campo>
            <Campo label="Tipo de serviço">
              <Select value={tipoServico} onChange={(e) => setTipoServico(e.target.value)}>
                <option value="">Selecione</option>
                {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{tipoClienteLabel[t]}</option>)}
              </Select>
            </Campo>
          </div>
        )}

        {resultado === 'perdido' && (
          <Campo label="Motivo da perda">
            <Select value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)}>
              <option value="">Selecione</option>
              {MOTIVOS_PERDA.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Campo>
        )}

        {resultado === 'no_show' && (
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nova data da reunião"><Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} /></Campo>
            <Campo label="Nova hora"><Input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} /></Campo>
          </div>
        )}

        {resultado === 'followup' && (
          <div className="space-y-3">
            <Campo label="Data do próximo contato"><Input type="date" value={dataProximoContato} onChange={(e) => setDataProximoContato(e.target.value)} /></Campo>
            <Campo label="Observação do follow-up">
              <Textarea value={obsFollowup} onChange={(e) => setObsFollowup(e.target.value)} rows={3} placeholder="O que foi combinado, objeção levantada, etc." />
            </Campo>
          </div>
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

function Opcao({
  ativo,
  onClick,
  tone,
  icon,
  label,
}: {
  ativo: boolean
  onClick: () => void
  tone: 'green' | 'red' | 'orange' | 'blue'
  icon: React.ReactNode
  label: string
}) {
  const on: Record<string, string> = {
    green: 'border-green-500/50 bg-green-500/15 text-green-200',
    red: 'border-red-500/50 bg-red-500/15 text-red-200',
    orange: 'border-orange-500/50 bg-orange-500/15 text-orange-200',
    blue: 'border-blue-500/50 bg-blue-500/15 text-blue-200',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
        ativo ? on[tone] : 'border-border text-muted hover:text-zinc-200'
      }`}
    >
      {icon} {label}
    </button>
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
