/**
 * Tela "Cadastrar lead qualificado" (SDR).
 * Substitui o modal simples de qualificação: painel completo de cadastro
 * estruturado (dados do lead + reunião + resumo + BANT). Ao salvar, o lead
 * avança pra "reunião agendada" e é liberado pro Closer com o briefing.
 * A qualificação BANT é obrigatória pra entregar um SQL válido.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, AlertTriangle, ArrowLeft, Ban, Phone } from 'lucide-react'
import {
  PageHeader,
  PrimaryButton,
  OutlineButton,
  Modal,
  Input,
  Select,
  Textarea,
  Badge,
} from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { ContactAttemptForm } from '@/components/comercial/ContactAttemptForm'
import { AttemptHistoryCard, histTentativasSdr } from '@/components/comercial/AttemptHistoryCard'
import { LeadCard } from '@/components/comercial/LeadCard'
import { useComercial } from './store'
import {
  AUTORIDADE_OPCOES,
  CANAIS_AQUISICAO,
  CLASSIFICACAO_OPCOES,
  EQUIPE_COMERCIAL,
  TEMPO_URGENCIA_OPCOES,
  bantCompleto,
} from './mockLeads'

export default function CadastrarLeadQualificado() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { leads, slaConfig, qualificarLead, desqualificarLead } = useComercial()
  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id])

  // Dados do lead
  const [nomeMedico, setNomeMedico] = useState(lead?.nomeMedico ?? lead?.nomeContato ?? '')
  const [especialidade, setEspecialidade] = useState(lead?.especialidade ?? '')
  const [instagram, setInstagram] = useState(lead?.instagram ?? '')
  const [site, setSite] = useState(lead?.site ?? '')
  const [canalAquisicao, setCanalAquisicao] = useState(lead?.canalAquisicao ?? lead?.origem ?? '')
  // Reunião
  const [data, setData] = useState(lead?.reuniao?.data ?? '')
  const [hora, setHora] = useState(lead?.reuniao?.hora ?? '')
  const [closerId, setCloserId] = useState(lead?.reuniao?.closerId ?? '')
  const [linkCall, setLinkCall] = useState(lead?.reuniao?.linkCall ?? '')
  const [resumoConversa, setResumoConversa] = useState(lead?.resumoConversa ?? '')
  // BANT
  const [orcamento, setOrcamento] = useState(lead?.bant?.orcamento ?? '')
  const [autoridade, setAutoridade] = useState(lead?.bant?.autoridade ?? '')
  const [necessidade, setNecessidade] = useState(lead?.bant?.necessidade ?? '')
  const [tempoUrgencia, setTempoUrgencia] = useState(lead?.bant?.tempoUrgencia ?? '')
  const [investimentoMensal, setInvestimentoMensal] = useState(
    lead?.bant?.investimentoMensal != null ? String(lead.bant.investimentoMensal) : '',
  )
  const [classificacaoLead, setClassificacaoLead] = useState(lead?.bant?.classificacaoLead ?? '')

  const [erro, setErro] = useState<string | null>(null)
  const [desqOpen, setDesqOpen] = useState(false)
  const [desqMotivoInicial, setDesqMotivoInicial] = useState('')
  const [tentativaOpen, setTentativaOpen] = useState(false)

  if (!lead) {
    return (
      <div>
        <Breadcrumb trilha={['Comercial', 'SDR', 'Cadastrar lead qualificado']} />
        <div className="rounded-lg border border-border bg-bg-card p-8 text-center text-sm text-muted">
          Lead não encontrado.
          <div className="mt-3">
            <OutlineButton size="sm" onClick={() => navigate('/comercial/sdr')}>
              <ArrowLeft size={13} /> Voltar para o SDR
            </OutlineButton>
          </div>
        </div>
      </div>
    )
  }

  const bant = {
    orcamento,
    autoridade,
    necessidade,
    tempoUrgencia,
    investimentoMensal: investimentoMensal === '' ? null : Number(investimentoMensal),
    classificacaoLead,
  }

  function salvarEEnviar() {
    setErro(null)
    if (!bantCompleto(bant)) {
      setErro('Preencha TODOS os campos da Qualificação BANT — é o padrão obrigatório pra entregar um SQL.')
      return
    }
    if (!data || !hora || !closerId) {
      setErro('Informe data, hora e o Closer responsável pela reunião.')
      return
    }
    qualificarLead(lead!.id, {
      nomeMedico,
      especialidade,
      instagram,
      site,
      canalAquisicao,
      reuniao: { data, hora, linkCall, closerId },
      resumoConversa,
      bant,
    })
    navigate('/comercial/sdr')
  }

  const jaQualificado = lead.etapaFunil !== 'em_qualificacao'

  return (
    <div>
      <Breadcrumb trilha={['Comercial', 'SDR', 'Cadastrar lead qualificado']} />
      <PageHeader
        title="Cadastrar lead qualificado"
        description="SDR · envia direto para o Briefing pré-call"
        actions={
          <OutlineButton size="sm" onClick={() => navigate('/comercial/sdr')}>
            <ArrowLeft size={13} /> Voltar
          </OutlineButton>
        }
      />

      {jaQualificado && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-200">
          <AlertTriangle size={14} /> Este lead já saiu da fila de qualificação (etapa atual:{' '}
          <Badge tone="neutral">{lead.etapaFunil}</Badge>). As alterações vão sobrescrever o cadastro.
        </div>
      )}

      {(lead.contadorTentativas ?? 0) >= slaConfig.limiteTentativasContato && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-200">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} /> {lead.contadorTentativas}ª tentativa sem sucesso — considere desqualificar este lead.
          </span>
          <button
            type="button"
            onClick={() => {
              setDesqMotivoInicial(`Sem retorno após ${lead.contadorTentativas} tentativas`)
              setDesqOpen(true)
            }}
            className="shrink-0 rounded border border-orange-500/50 bg-orange-500/15 px-2 py-1 font-medium hover:bg-orange-500/25"
          >
            Desqualificar
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Painel lateral — Dados Originais do CRM (contexto, só leitura) */}
        <div className="lg:col-span-1">
          <LeadCard lead={lead} secoes={['originais']} />
        </div>

        {/* Coluna central — Dados do lead */}
        <div className="space-y-4 lg:col-span-2">
          <Card titulo="Dados do lead">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nome do médico">
                <Input value={nomeMedico} onChange={(e) => setNomeMedico(e.target.value)} placeholder="Dr. ..." />
              </Campo>
              <Campo label="Especialidade">
                <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Psiquiatria" />
              </Campo>
              <Campo label="Instagram">
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
              </Campo>
              <Campo label="Site (se tiver)">
                <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="—" />
              </Campo>
            </div>
            <div className="mt-3">
              <Campo label="Canal de aquisição">
                <Select value={canalAquisicao} onChange={(e) => setCanalAquisicao(e.target.value)}>
                  <option value="">Selecione</option>
                  {CANAIS_AQUISICAO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
                <p className="mt-1 text-[10px] text-muted">Pré-preenchido com a origem do Social Selling; editável.</p>
              </Campo>
            </div>

            {/* Sub-card reunião */}
            <div className="mt-4 rounded-lg border border-border bg-bg-soft/50 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                <CalendarClock size={13} className="text-brand-300" /> Reunião agendada
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Campo label="Data">
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </Campo>
                <Campo label="Hora">
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </Campo>
                <Campo label="Closer responsável">
                  <Select value={closerId} onChange={(e) => setCloserId(e.target.value)}>
                    <option value="">Selecione</option>
                    {EQUIPE_COMERCIAL.closers.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </Select>
                </Campo>
              </div>
              <div className="mt-3">
                <Campo label="Link da call">
                  <Input value={linkCall} onChange={(e) => setLinkCall(e.target.value)} placeholder="https://meet.google.com/..." />
                </Campo>
              </div>
            </div>

            <div className="mt-4">
              <Campo label="Resumo da conversa com o cliente">
                <Textarea
                  value={resumoConversa}
                  onChange={(e) => setResumoConversa(e.target.value)}
                  rows={5}
                  placeholder="Situação e dor atual, o que deseja, faturamento, alinhamentos..."
                />
                <p className="mt-1 text-[10px] text-muted">Será exibido para o Closer no briefing pré-call.</p>
              </Campo>
            </div>
          </Card>
        </div>

        {/* Coluna direita — BANT */}
        <div className="space-y-4">
          <Card titulo="Qualificação BANT" subtitulo="Padrão obrigatório para entregar SQL">
            <div className="space-y-3">
              <Campo label="B — Orçamento">
                <Input value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="Disponibilidade de crédito" />
              </Campo>
              <Campo label="A — Autoridade">
                <Select value={autoridade} onChange={(e) => setAutoridade(e.target.value)}>
                  <option value="">Selecione</option>
                  {AUTORIDADE_OPCOES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="N — Necessidade">
                <Input value={necessidade} onChange={(e) => setNecessidade(e.target.value)} placeholder="Qual produto foi conduzido?" />
              </Campo>
              <Campo label="T — Tempo / Urgência">
                <Select value={tempoUrgencia} onChange={(e) => setTempoUrgencia(e.target.value)}>
                  <option value="">Selecione</option>
                  {TEMPO_URGENCIA_OPCOES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Investimento mensal alinhado (R$)">
                <Input type="number" min={0} value={investimentoMensal} onChange={(e) => setInvestimentoMensal(e.target.value)} placeholder="1800" />
              </Campo>
              <Campo label="Classificação do lead">
                <Select value={classificacaoLead} onChange={(e) => setClassificacaoLead(e.target.value)}>
                  <option value="">Selecione</option>
                  {CLASSIFICACAO_OPCOES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              </Campo>
            </div>
          </Card>
        </div>
      </div>

      {(lead.tentativasContato?.length ?? 0) > 0 && (
        <div className="mt-4">
          <AttemptHistoryCard itens={histTentativasSdr(lead)} />
        </div>
      )}

      {erro && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{erro}</span>
        </div>
      )}

      {/* Rodapé de ações */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <OutlineButton size="sm" onClick={() => { setDesqMotivoInicial(''); setDesqOpen(true) }}>
            <Ban size={13} /> Desqualificar
          </OutlineButton>
          <OutlineButton size="sm" onClick={() => setTentativaOpen(true)}>
            <Phone size={13} /> Registrar Tentativa
          </OutlineButton>
        </div>
        <PrimaryButton onClick={salvarEEnviar}>Salvar e Enviar para Closer</PrimaryButton>
      </div>

      <DesqualificarModal
        open={desqOpen}
        onClose={() => setDesqOpen(false)}
        motivoInicial={desqMotivoInicial}
        onConfirm={(motivo) => {
          desqualificarLead(lead!.id, motivo)
          navigate('/comercial/sdr')
        }}
      />

      <ContactAttemptForm open={tentativaOpen} onClose={() => setTentativaOpen(false)} leadId={lead!.id} />
    </div>
  )
}

function DesqualificarModal({
  open,
  onClose,
  onConfirm,
  motivoInicial = '',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => void
  motivoInicial?: string
}) {
  const [motivo, setMotivo] = useState(motivoInicial)
  useEffect(() => {
    if (open) setMotivo(motivoInicial)
  }, [open, motivoInicial])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Desqualificar lead"
      footer={
        <div className="flex items-center justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton
            size="sm"
            onClick={() => motivo.trim() && onConfirm(motivo.trim())}
            className="!bg-red-600 hover:!bg-red-500 !border-red-500/30"
          >
            Desqualificar
          </PrimaryButton>
        </div>
      }
    >
      <Campo label="Motivo da desqualificação">
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: fora do ICP, sem orçamento, não é decisor..." />
      </Campo>
    </Modal>
  )
}

function Card({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">{titulo}</h3>
        {subtitulo && <p className="text-[11px] text-muted">{subtitulo}</p>}
      </div>
      {children}
    </div>
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
