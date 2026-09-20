/**
 * Tela "Caixa de Entrada" — hub unificado do topo do funil.
 * Recebe leads do CRM externo (via webhook) e da prospecção ativa
 * (Social Selling). Qualquer SDR disponível "puxa" um lead e inicia o
 * atendimento — não há triagem/atribuição antes disso.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, PhoneCall, Plug, Radio } from 'lucide-react'
import { PageHeader, KPICard, PrimaryButton, Badge, type Column, type Tone } from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { LeadsTable, ContatoEmpresa, StatusBadge, fmtData } from '@/components/comercial/LeadsTable'
import { useComercial } from './store'
import { EQUIPE_COMERCIAL, pessoaComercialNome, type Lead } from './mockLeads'

const mesAtual = new Date().toISOString().slice(0, 7)
const hojeISO = new Date().toISOString().slice(0, 10)
// Stand-in do SDR logado enquanto o Comercial é mock.
const MEU_SDR_ID = EQUIPE_COMERCIAL.sdrs[0].id

function naCaixa(l: Lead): boolean {
  return l.etapaFunil === 'caixa_entrada' || l.etapaFunil === 'em_qualificacao'
}

function statusView(l: Lead): { label: string; tone: Tone } {
  return l.etapaFunil === 'caixa_entrada'
    ? { label: 'Não contatado', tone: 'attention' }
    : { label: 'Em atendimento SDR', tone: 'info' }
}

function OrigemCell({ lead }: { lead: Lead }) {
  if (lead.origemEntrada === 'crm_externo') {
    return <Badge tone="accent">🔌 CRM · {lead.crmProvider ?? 'CRM'}</Badge>
  }
  return <Badge tone="purple">📡 Social Selling</Badge>
}

export default function CaixaEntrada() {
  const { leads, iniciarAtendimento } = useComercial()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const kpis = useMemo(() => {
    const naCaixaLeads = leads.filter(naCaixa)
    const hoje = naCaixaLeads.filter((l) => l.dataEntrada === hojeISO).length
    const fila = leads.filter((l) => l.etapaFunil === 'caixa_entrada').length
    const viaCrm = leads.filter(
      (l) => l.origemEntrada === 'crm_externo' && l.dataEntrada?.slice(0, 7) === mesAtual,
    ).length
    const viaSocial = leads.filter(
      (l) => l.origemEntrada === 'social_selling' && l.dataEntrada?.slice(0, 7) === mesAtual,
    ).length
    return { hoje, fila, viaCrm, viaSocial }
  }, [leads])

  const rows = useMemo(() => {
    return leads
      .filter(naCaixa)
      .filter((l) => !q || `${l.nomeContato} ${l.empresa}`.toLowerCase().includes(q.toLowerCase()))
  }, [leads, q])

  function iniciar(l: Lead) {
    iniciarAtendimento(l.id, MEU_SDR_ID)
    navigate(`/comercial/sdr/qualificar/${l.id}`)
  }

  const columns: Column<Lead>[] = [
    { key: 'contato', header: 'Contato', render: (l) => <ContatoEmpresa lead={l} /> },
    { key: 'origem', header: 'Origem', render: (l) => <OrigemCell lead={l} /> },
    { key: 'canal', header: 'Canal / Fonte original', render: (l) => l.canalOriginal ?? l.origem ?? '—' },
    { key: 'data', header: 'Data recebimento', render: (l) => fmtData(l.dataEntrada ?? l.dataCaptacao) },
    {
      key: 'captacao',
      header: 'Responsável captação',
      render: (l) => (l.origemEntrada === 'social_selling' ? pessoaComercialNome(l.socialSellerId) : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => {
        const s = statusView(l)
        return (
          <div className="flex flex-col gap-0.5">
            <StatusBadge label={s.label} tone={s.tone} />
            {l.etapaFunil === 'em_qualificacao' && (
              <span className="text-[10px] text-muted">SDR: {pessoaComercialNome(l.sdrId)}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'right',
      render: (l) =>
        l.etapaFunil === 'caixa_entrada' ? (
          <PrimaryButton size="sm" onClick={() => iniciar(l)}>
            <PhoneCall size={13} /> Iniciar Atendimento
          </PrimaryButton>
        ) : (
          <span className="text-[11px] text-muted">Em atendimento</span>
        ),
    },
  ]

  return (
    <div>
      <Breadcrumb trilha={['Comercial', 'Caixa de Entrada']} />
      <PageHeader
        title="Caixa de Entrada"
        description="Leads recebidos via CRM e prospecção ativa, aguardando contato do SDR"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Leads hoje" value={String(kpis.hoje)} icon={<Inbox size={13} />} tone="accent" sub="chegaram hoje" />
        <KPICard label="Leads na fila" value={String(kpis.fila)} icon={<PhoneCall size={13} />} tone={kpis.fila > 0 ? 'warning' : 'neutral'} sub="não contatados" />
        <KPICard label="Via CRM (mês)" value={String(kpis.viaCrm)} icon={<Plug size={13} />} tone="info" sub="webhook do CRM" />
        <KPICard label="Via Social Selling (mês)" value={String(kpis.viaSocial)} icon={<Radio size={13} />} tone="purple" sub="prospecção ativa" />
      </div>

      <LeadsTable
        columns={columns}
        rows={rows}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar contato ou empresa...' }}
        emptyLabel="Caixa vazia — nenhum lead aguardando."
        minWidth={960}
      />
    </div>
  )
}
