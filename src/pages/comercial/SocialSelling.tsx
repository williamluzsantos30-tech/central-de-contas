/**
 * Tela "Social Selling" — topo do funil comercial.
 * Captação/prospecção de leads + envio pro SDR (handoff).
 */
import { useMemo, useState } from 'react'
import { Radio, Send, Users2, Percent, Inbox, Plus } from 'lucide-react'
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
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { LeadsTable, ContatoEmpresa, StatusBadge, fmtData } from '@/components/comercial/LeadsTable'
import { useComercial } from './store'
import {
  EQUIPE_COMERCIAL,
  ORIGENS_LEAD,
  pessoaComercialNome,
  type Lead,
} from './mockLeads'
import { LeadHandoffButton } from '@/components/comercial/LeadHandoffButton'

// Stand-in do usuário logado enquanto o Comercial é mock (no real viria do
// profile/papel). Marina = "eu" pro toggle "Apenas meus".
const MEU_ID = EQUIPE_COMERCIAL.socialSellers[0].id
const mesAtual = new Date().toISOString().slice(0, 7)

function statusView(l: Lead): { label: string; tone: Tone } {
  return l.etapaFunil === 'prospectado'
    ? { label: 'Aguardando envio', tone: 'attention' }
    : { label: 'Enviado à Caixa', tone: 'info' }
}

export default function SocialSelling() {
  const { leads } = useComercial()
  const [escopo, setEscopo] = useState<'meus' | 'todos'>('todos')
  const [fOrigem, setFOrigem] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [q, setQ] = useState('')
  const [novoOpen, setNovoOpen] = useState(false)

  const kpis = useMemo(() => {
    const captadosMes = leads.filter((l) => l.dataCaptacao.slice(0, 7) === mesAtual).length
    const enviadosMes = leads.filter((l) => l.dataEnvioSDR?.slice(0, 7) === mesAtual).length
    const fila = leads.filter((l) => l.etapaFunil === 'prospectado').length
    const taxa = captadosMes > 0 ? Math.round((enviadosMes / captadosMes) * 100) : 0
    return { captadosMes, enviadosMes, fila, taxa }
  }, [leads])

  const rows = useMemo(() => {
    return leads.filter((l) => {
      // Social Selling só enxerga a própria prospecção — não os leads de CRM.
      if (l.origemEntrada === 'crm_externo') return false
      if (escopo === 'meus' && l.socialSellerId !== MEU_ID) return false
      if (fOrigem && l.origem !== fOrigem) return false
      if (fStatus === 'aguardando' && l.etapaFunil !== 'prospectado') return false
      if (fStatus === 'enviado' && l.etapaFunil === 'prospectado') return false
      if (q && !`${l.nomeContato} ${l.empresa}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [leads, escopo, fOrigem, fStatus, q])

  const columns: Column<Lead>[] = [
    { key: 'contato', header: 'Contato / Empresa', render: (l) => <ContatoEmpresa lead={l} /> },
    { key: 'origem', header: 'Origem', render: (l) => <Badge tone="neutral">{l.origem}</Badge> },
    { key: 'resp', header: 'Responsável', render: (l) => pessoaComercialNome(l.socialSellerId) },
    { key: 'data', header: 'Data captação', render: (l) => fmtData(l.dataCaptacao) },
    {
      key: 'status',
      header: 'Status',
      render: (l) => {
        const s = statusView(l)
        return <StatusBadge label={s.label} tone={s.tone} />
      },
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'right',
      render: (l) =>
        l.etapaFunil === 'prospectado' ? (
          <LeadHandoffButton lead={l} />
        ) : (
          <span className="text-[11px] text-muted">Enviado</span>
        ),
    },
  ]

  return (
    <div>
      <Breadcrumb trilha={['Comercial', 'Social Selling']} />
      <PageHeader
        title="Social Selling"
        description="Captação e prospecção ativa de leads"
        actions={
          <PrimaryButton size="sm" onClick={() => setNovoOpen(true)}>
            <Plus size={14} /> Novo Lead
          </PrimaryButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Leads captados (mês)" value={String(kpis.captadosMes)} icon={<Radio size={13} />} tone="accent" sub="captados neste mês" />
        <KPICard label="Enviados para SDR (mês)" value={String(kpis.enviadosMes)} icon={<Send size={13} />} tone="info" sub="handoffs no mês" />
        <KPICard label="Taxa de envio" value={`${kpis.taxa}%`} icon={<Percent size={13} />} tone={kpis.taxa >= 60 ? 'success' : 'attention'} sub="dos captados foram enviados" />
        <KPICard label="Leads na fila" value={String(kpis.fila)} icon={<Inbox size={13} />} tone={kpis.fila > 0 ? 'warning' : 'neutral'} sub="aguardando envio" />
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
          <option value="enviado">Enviado à Caixa</option>
        </Select>
      </div>

      <LeadsTable
        columns={columns}
        rows={rows}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar contato ou empresa...' }}
        emptyLabel="Nenhum lead captado ainda."
      />

      <NovoLeadModal open={novoOpen} onClose={() => setNovoOpen(false)} />
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
