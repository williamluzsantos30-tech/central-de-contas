/**
 * Tela "Closer" — calls de vendas e fechamento.
 * Lista leads qualificados recebidos do SDR e registra o resultado da call
 * (Fechou / Não fechou / No-show+reagenda / Follow-up). Prioriza por SLA e
 * follow-ups vencidos no topo.
 */
import { useMemo, useState } from 'react'
import { Handshake, CheckCircle2, Percent, AlertOctagon, RotateCcw } from 'lucide-react'
import { PageHeader, KPICard, PrimaryButton, type Column, type Tone } from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { LeadsTable, ContatoEmpresa, StatusBadge, fmtData, fmtBRL } from '@/components/comercial/LeadsTable'
import { CloseDealModal } from '@/components/comercial/CloseDealModal'
import { SLABadge } from '@/components/comercial/SLABadge'
import { FollowUpBanner } from '@/components/comercial/FollowUpBanner'
import { SyncStatusBadge } from '@/components/comercial/SyncStatusBadge'
import { useComercial } from './store'
import { pessoaComercialNome, type Lead } from './mockLeads'
import { calculateLeadSLA, slaPrioridade, followupVencido } from './sla'

const mesAtual = new Date().toISOString().slice(0, 7)
const hojeISO = new Date().toISOString().slice(0, 10)

function chegouNoCloser(l: Lead): boolean {
  if (l.etapaFunil === 'reuniao_agendada' || l.etapaFunil === 'em_negociacao' || l.etapaFunil === 'fechado')
    return true
  if (l.etapaFunil === 'perdido' && l.motivoPerda) return true
  return false
}

function statusView(l: Lead): { label: string; tone: Tone } {
  if (l.etapaFunil === 'reuniao_agendada') return { label: 'Aguardando call', tone: 'attention' }
  if (l.etapaFunil === 'em_negociacao') {
    if (l.subStatusNegociacao === 'no_show') return { label: 'No-show', tone: 'warning' }
    if (l.subStatusNegociacao === 'em_followup') return { label: 'Em follow-up', tone: 'info' }
    return { label: 'Em negociação', tone: 'info' }
  }
  if (l.etapaFunil === 'fechado') return { label: 'Fechado', tone: 'success' }
  return { label: 'Perdido', tone: 'danger' }
}

export default function Closer() {
  const { leads, slaConfig, registrarResultado, sincronizarLead } = useComercial()
  const [q, setQ] = useState('')
  const [leadSel, setLeadSel] = useState<Lead | null>(null)

  const kpis = useMemo(() => {
    const naAgenda = leads.filter((l) => l.etapaFunil === 'reuniao_agendada').length
    const emNegociacao = leads.filter((l) => l.etapaFunil === 'em_negociacao').length
    const fechadosMes = leads.filter((l) => l.etapaFunil === 'fechado' && l.dataFechamento?.slice(0, 7) === mesAtual)
    const totalFechado = fechadosMes.reduce((s, l) => s + (l.mrr ?? 0), 0)
    const perdidosCloserMes = leads.filter(
      (l) => l.etapaFunil === 'perdido' && l.motivoPerda && l.dataFechamento?.slice(0, 7) === mesAtual,
    ).length
    const realizadas = fechadosMes.length + perdidosCloserMes
    const taxa = realizadas > 0 ? Math.round((fechadosMes.length / realizadas) * 100) : 0
    const foraSla = leads.filter(chegouNoCloser).filter((l) => calculateLeadSLA(l, slaConfig).status === 'estourado' && calculateLeadSLA(l, slaConfig).aplicavel).length
    const followupsHoje = leads.filter(
      (l) => l.subStatusNegociacao === 'em_followup' && l.dataProximoContato && l.dataProximoContato.slice(0, 10) <= hojeISO,
    ).length
    return { naAgenda, emNegociacao, fechadosCount: fechadosMes.length, totalFechado, taxa, foraSla, followupsHoje }
  }, [leads, slaConfig])

  const rows = useMemo(() => {
    return leads
      .filter(chegouNoCloser)
      .filter((l) => !q || `${l.nomeContato} ${l.empresa}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        // Follow-up vencido primeiro, depois prioridade de SLA.
        const fa = followupVencido(a) ? 0 : 1
        const fb = followupVencido(b) ? 0 : 1
        if (fa !== fb) return fa - fb
        return slaPrioridade(calculateLeadSLA(a, slaConfig)) - slaPrioridade(calculateLeadSLA(b, slaConfig))
      })
  }, [leads, q, slaConfig])

  function desqualificarRecorrente(l: Lead) {
    registrarResultado(l.id, { tipo: 'perdido', motivoPerda: 'No-show recorrente' })
  }

  const columns: Column<Lead>[] = [
    {
      key: 'contato',
      header: 'Contato / Empresa',
      render: (l) => (
        <div className="flex flex-col gap-1">
          <ContatoEmpresa lead={l} />
          <FollowUpBanner lead={l} onDesqualificar={desqualificarRecorrente} />
        </div>
      ),
    },
    { key: 'sdr', header: 'Qualificado por', render: (l) => pessoaComercialNome(l.sdrId) },
    { key: 'reuniao', header: 'Data/hora reunião', render: (l) => (l.reuniao ? `${fmtData(l.reuniao.data)} · ${l.reuniao.hora}` : '—') },
    { key: 'sla', header: 'SLA', render: (l) => <SLABadge sla={calculateLeadSLA(l, slaConfig)} /> },
    { key: 'briefing', header: 'Briefing', render: (l) => <BriefingCell texto={l.briefingQualificacao} /> },
    {
      key: 'status',
      header: 'Status',
      render: (l) => {
        const s = statusView(l)
        return (
          <div className="flex flex-col gap-0.5">
            <StatusBadge label={s.label} tone={s.tone} />
            {l.etapaFunil === 'fechado' && l.mrr != null && (
              <span className="text-[10px] text-green-300">MRR {fmtBRL(l.mrr)}</span>
            )}
            {l.etapaFunil === 'perdido' && l.motivoPerda && <span className="text-[10px] text-muted">{l.motivoPerda}</span>}
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
        l.etapaFunil === 'reuniao_agendada' || l.etapaFunil === 'em_negociacao' ? (
          <PrimaryButton size="sm" onClick={() => setLeadSel(l)}>
            <Handshake size={13} /> Registrar Resultado
          </PrimaryButton>
        ) : (
          <span className="text-[11px] text-muted">—</span>
        ),
    },
  ]

  return (
    <div>
      <Breadcrumb trilha={['Comercial', 'Closer']} />
      <PageHeader title="Closer" description="Calls de vendas e fechamento de propostas" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard label="Reuniões na agenda" value={String(kpis.naAgenda)} icon={<Handshake size={13} />} tone="attention" sub="próximas calls" />
        <KPICard label="Em negociação" value={String(kpis.emNegociacao)} icon={<Handshake size={13} />} tone="info" sub="propostas em aberto" />
        <KPICard label="Fechados no mês" value={`${kpis.fechadosCount} · ${fmtBRL(kpis.totalFechado)}`} icon={<CheckCircle2 size={13} />} tone="success" sub="contagem + R$" />
        <KPICard label="Taxa de fechamento" value={`${kpis.taxa}%`} icon={<Percent size={13} />} tone={kpis.taxa >= 30 ? 'success' : 'attention'} sub="fechados / realizadas" />
        <KPICard label="Follow-ups hoje" value={String(kpis.followupsHoje)} icon={<RotateCcw size={13} />} tone={kpis.followupsHoje > 0 ? 'warning' : 'neutral'} sub="pendentes/vencidos" />
        <KPICard label="Fora do SLA" value={String(kpis.foraSla)} icon={<AlertOctagon size={13} />} tone={kpis.foraSla > 0 ? 'danger' : 'neutral'} sub="calls estouradas" />
      </div>

      <LeadsTable
        columns={columns}
        rows={rows}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar contato ou empresa...' }}
        emptyLabel="Nenhum lead qualificado recebido do SDR."
        minWidth={1080}
      />

      <CloseDealModal open={!!leadSel} onClose={() => setLeadSel(null)} lead={leadSel} />
    </div>
  )
}

function BriefingCell({ texto }: { texto?: string }) {
  const [aberto, setAberto] = useState(false)
  if (!texto) return <span className="text-[11px] text-muted">—</span>
  const curto = texto.length > 90
  return (
    <div className="max-w-[300px] text-[11px] text-muted">
      <p className={aberto ? 'whitespace-pre-wrap' : 'line-clamp-2'}>{texto}</p>
      {curto && (
        <button onClick={() => setAberto((v) => !v)} className="mt-0.5 text-brand-300 hover:underline">
          {aberto ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </div>
  )
}
