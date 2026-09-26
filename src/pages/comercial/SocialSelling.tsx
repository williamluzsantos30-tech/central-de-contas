/**
 * Tela "Social Selling" — topo do funil comercial.
 * Captação/prospecção de leads + envio pro SDR (handoff).
 */
import { useMemo, useState } from 'react'
import { Radio, Send, Percent, Inbox, Plus, Mail, MessagesSquare, Archive, AlertTriangle } from 'lucide-react'
import {
  PageHeader,
  KPICard,
  PrimaryButton,
  OutlineButton,
  Modal,
  Input,
  Select,
  Textarea,
  Badge,
  type Column,
  type Tone,
} from '@/components/ds'
import { LeadsTable, ContatoEmpresa, StatusBadge, fmtData } from '@/components/comercial/LeadsTable'
import { ContactAttemptForm } from '@/components/comercial/ContactAttemptForm'
import { AttemptHistoryCard, histAbordagensSocial } from '@/components/comercial/AttemptHistoryCard'
import { useComercial } from './store'
import {
  EQUIPE_COMERCIAL,
  ORIGENS_LEAD,
  pessoaComercialNome,
  type Lead,
} from './mockLeads'
import { LeadHandoffButton } from '@/components/comercial/LeadHandoffButton'
import { SyncStatusBadge } from '@/components/comercial/SyncStatusBadge'

// Stand-in do usuário logado enquanto o Comercial é mock (no real viria do
// profile/papel). Marina = "eu" pro toggle "Apenas meus".
const MEU_ID = EQUIPE_COMERCIAL.socialSellers[0].id
const mesAtual = new Date().toISOString().slice(0, 7)
const hojeISO = new Date().toISOString().slice(0, 10)

/** Próxima abordagem (Social Selling) já venceu? */
function abordagemVencida(l: Lead): boolean {
  return !!l.proximaAbordagem && l.proximaAbordagem.slice(0, 10) <= hojeISO
}

function statusView(l: Lead): { label: string; tone: Tone } {
  if (l.etapaFunil !== 'prospectado') return { label: 'Enviado à Caixa', tone: 'info' }
  if ((l.contadorTentativasSocial ?? 0) > 0) return { label: 'Em abordagem', tone: 'purple' }
  return { label: 'Aguardando envio', tone: 'attention' }
}

export default function SocialSelling() {
  const { leads, slaConfig, arquivarLead, sincronizarLead } = useComercial()
  const [escopo, setEscopo] = useState<'meus' | 'todos'>('todos')
  const [fOrigem, setFOrigem] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [q, setQ] = useState('')
  const [novoOpen, setNovoOpen] = useState(false)
  const [verArquivados, setVerArquivados] = useState(false)
  const [tentativaLead, setTentativaLead] = useState<Lead | null>(null)
  const [histLead, setHistLead] = useState<Lead | null>(null)

  const kpis = useMemo(() => {
    const ativos = leads.filter((l) => l.origemEntrada !== 'crm_externo' && !l.arquivado)
    const captadosMes = ativos.filter((l) => l.dataCaptacao.slice(0, 7) === mesAtual).length
    const enviadosMes = leads.filter((l) => l.dataEnvioSDR?.slice(0, 7) === mesAtual).length
    const aguardando = ativos.filter((l) => l.etapaFunil === 'prospectado' && (l.contadorTentativasSocial ?? 0) === 0).length
    const emAbordagem = ativos.filter((l) => l.etapaFunil === 'prospectado' && (l.contadorTentativasSocial ?? 0) > 0).length
    const taxa = captadosMes > 0 ? Math.round((enviadosMes / captadosMes) * 100) : 0
    return { captadosMes, enviadosMes, aguardando, emAbordagem, taxa }
  }, [leads])

  const rows = useMemo(() => {
    return leads
      .filter((l) => {
        // Social Selling só enxerga a própria prospecção — não os leads de CRM.
        if (l.origemEntrada === 'crm_externo') return false
        if (verArquivados ? !l.arquivado : !!l.arquivado) return false
        if (escopo === 'meus' && l.socialSellerId !== MEU_ID) return false
        if (fOrigem && l.origem !== fOrigem) return false
        if (fStatus === 'aguardando' && !(l.etapaFunil === 'prospectado' && (l.contadorTentativasSocial ?? 0) === 0)) return false
        if (fStatus === 'abordagem' && !(l.etapaFunil === 'prospectado' && (l.contadorTentativasSocial ?? 0) > 0)) return false
        if (fStatus === 'enviado' && l.etapaFunil === 'prospectado') return false
        if (q && !`${l.nomeContato} ${l.empresa}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      })
      .sort((a, b) => (abordagemVencida(a) ? 0 : 1) - (abordagemVencida(b) ? 0 : 1))
  }, [leads, escopo, fOrigem, fStatus, q, verArquivados])

  const columns: Column<Lead>[] = [
    { key: 'contato', header: 'Contato / Empresa', render: (l) => <ContatoEmpresa lead={l} /> },
    { key: 'origem', header: 'Origem', render: (l) => <Badge tone="neutral">{l.origem}</Badge> },
    { key: 'resp', header: 'Responsável', render: (l) => pessoaComercialNome(l.socialSellerId) },
    { key: 'data', header: 'Data captação', render: (l) => fmtData(l.dataCaptacao) },
    {
      key: 'followup',
      header: 'Abordagem',
      render: (l) => (
        <FollowupCell lead={l} limite={slaConfig.limiteTentativasAbordagem} onHistorico={() => setHistLead(l)} onArquivar={() => arquivarLead(l.id)} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => {
        const s = statusView(l)
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge label={s.label} tone={s.tone} />
            <SyncStatusBadge lead={l} onRetry={() => sincronizarLead(l.id)} />
          </div>
        )
      },
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'right',
      render: (l) =>
        l.arquivado ? (
          <span className="text-[11px] text-muted">Arquivado</span>
        ) : l.etapaFunil === 'prospectado' ? (
          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
            <OutlineButton size="sm" onClick={() => setTentativaLead(l)}>
              <Mail size={13} /> Registrar Tentativa
            </OutlineButton>
            <LeadHandoffButton lead={l} />
          </div>
        ) : (
          <span className="text-[11px] text-muted">Enviado</span>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Social Selling"
        description="Captação e prospecção ativa de leads"
        actions={
          <PrimaryButton size="sm" onClick={() => setNovoOpen(true)}>
            <Plus size={14} /> Novo Lead
          </PrimaryButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard label="Leads captados (mês)" value={String(kpis.captadosMes)} icon={<Radio size={13} />} tone="accent" sub="captados neste mês" />
        <KPICard label="Enviados para SDR (mês)" value={String(kpis.enviadosMes)} icon={<Send size={13} />} tone="info" sub="handoffs no mês" />
        <KPICard label="Taxa de envio" value={`${kpis.taxa}%`} icon={<Percent size={13} />} tone={kpis.taxa >= 60 ? 'success' : 'attention'} sub="dos captados foram enviados" />
        <KPICard label="Leads na fila" value={String(kpis.aguardando)} icon={<Inbox size={13} />} tone={kpis.aguardando > 0 ? 'warning' : 'neutral'} sub="aguardando 1ª abordagem" />
        <KPICard label="Em abordagem" value={String(kpis.emAbordagem)} icon={<MessagesSquare size={13} />} tone={kpis.emAbordagem > 0 ? 'purple' : 'neutral'} sub="aguardando resposta" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          {(['meus', 'todos'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setEscopo(k)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                escopo === k ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200'
              }`}
            >
              {k === 'meus' ? 'Apenas meus' : 'Todo o time'}
            </button>
          ))}
        </div>
        <Select value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} className="w-40">
          <option value="">Todas origens</option>
          {ORIGENS_LEAD.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-40">
          <option value="">Todos status</option>
          <option value="aguardando">Aguardando envio</option>
          <option value="abordagem">Em abordagem</option>
          <option value="enviado">Enviado à Caixa</option>
        </Select>
        <button
          type="button"
          onClick={() => setVerArquivados((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
            verArquivados
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-border bg-bg-soft text-muted hover:text-zinc-200'
          }`}
        >
          <Archive size={13} /> {verArquivados ? 'Voltar aos ativos' : 'Ver arquivados'}
        </button>
      </div>

      <LeadsTable
        columns={columns}
        rows={rows}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar contato ou empresa...' }}
        emptyLabel={verArquivados ? 'Nenhuma prospecção arquivada.' : 'Nenhum lead captado ainda.'}
        minWidth={1040}
      />

      <NovoLeadModal open={novoOpen} onClose={() => setNovoOpen(false)} />
      <ContactAttemptForm open={!!tentativaLead} onClose={() => setTentativaLead(null)} leadId={tentativaLead?.id ?? ''} contexto="social" />
      <Modal open={!!histLead} onClose={() => setHistLead(null)} title={`Abordagens · ${histLead?.nomeContato ?? ''}`}>
        {histLead && <AttemptHistoryCard itens={histAbordagensSocial(histLead)} titulo="Histórico de abordagens" />}
      </Modal>
    </div>
  )
}

/** Célula de abordagem: nº de tentativas (abre histórico) + próxima + aviso de descarte. */
function FollowupCell({
  lead,
  limite,
  onHistorico,
  onArquivar,
}: {
  lead: Lead
  limite: number
  onHistorico: () => void
  onArquivar: () => void
}) {
  const n = lead.contadorTentativasSocial ?? 0
  if (n === 0 && !lead.proximaAbordagem) return <span className="text-[11px] text-muted">—</span>
  const vencida = abordagemVencida(lead)
  const noLimite = n >= limite && lead.etapaFunil === 'prospectado' && !lead.arquivado
  return (
    <div className="flex flex-col gap-0.5 text-[11px]">
      {n > 0 && (
        <button onClick={onHistorico} className="w-fit text-brand-300 hover:underline">
          {n} tentativa{n > 1 ? 's' : ''}
        </button>
      )}
      {lead.proximaAbordagem && (
        <span className={vencida ? 'text-red-300' : 'text-muted'}>
          {vencida ? 'retorno vencido' : 'retornar'} · {fmtData(lead.proximaAbordagem)}
        </span>
      )}
      {noLimite && (
        <span className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-orange-300">
          <AlertTriangle size={10} /> {n}ª sem resposta
          <button onClick={onArquivar} className="rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 font-medium hover:bg-orange-500/20">
            Arquivar
          </button>
        </span>
      )}
    </div>
  )
}

function NovoLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { criarLead } = useComercial()
  const [nomeContato, setNomeContato] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [origem, setOrigem] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function reset() {
    setNomeContato('')
    setEmpresa('')
    setTelefone('')
    setEmail('')
    setOrigem('')
    setObservacao('')
    setErro(null)
  }

  function salvar() {
    if (!nomeContato.trim() || !empresa.trim() || !telefone.trim() || !origem) {
      setErro('Preencha os campos obrigatórios (*).')
      return
    }
    criarLead({
      nomeContato,
      empresa,
      telefone,
      email: email || undefined,
      origem,
      observacaoCaptacao: observacao || undefined,
      socialSellerId: MEU_ID,
    })
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Lead"
      footer={
        <div className="flex items-center justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar}>Cadastrar lead</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nome do contato *">
            <Input value={nomeContato} onChange={(e) => setNomeContato(e.target.value)} placeholder="Dr. ..." />
          </Campo>
          <Campo label="Empresa *">
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Clínica ..." />
          </Campo>
          <Campo label="Telefone *">
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 90000-0000" />
          </Campo>
          <Campo label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="—" />
          </Campo>
        </div>
        <Campo label="Origem *">
          <Select value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Selecione</option>
            {ORIGENS_LEAD.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Observação">
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Contexto da captação..." />
        </Campo>
        {erro && <p className="text-xs text-red-300">{erro}</p>}
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
