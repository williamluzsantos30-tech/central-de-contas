/**
 * Tela "SDR" — qualificação de leads recebidos do Social Selling.
 * Lista a fila e abre a tela "Cadastrar lead qualificado".
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, CheckCircle2, CalendarClock, Percent } from 'lucide-react'
import {
  PageHeader,
  KPICard,
  PrimaryButton,
  Badge,
  type Column,
  type Tone,
} from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { LeadsTable, ContatoEmpresa, StatusBadge, fmtData } from '@/components/comercial/LeadsTable'
import { useComercial } from './store'
import { pessoaComercialNome, type Lead } from './mockLeads'

const mesAtual = new Date().toISOString().slice(0, 7)

/** Leads que chegaram ao SDR (em qualificação, agendados, ou desqualificados). */
function chegouNoSdr(l: Lead): boolean {
  if (l.etapaFunil === 'em_qualificacao' || l.etapaFunil === 'reuniao_agendada') return true
  if (l.etapaFunil === 'perdido' && l.motivoDesqualificacao) return true
  return false
}

function statusView(l: Lead): { label: string; tone: Tone } {
  if (l.etapaFunil === 'em_qualificacao') return { label: 'Em qualificação', tone: 'info' }
  if (l.etapaFunil === 'reuniao_agendada') return { label: 'Reunião agendada', tone: 'accent' }
  return { label: 'Desqualificado', tone: 'danger' }
}

export default function SDR() {
  const { leads } = useComercial()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const kpis = useMemo(() => {
    const recebidos = leads.filter((l) => !!l.sdrId)
    const emQualificacao = leads.filter((l) => l.etapaFunil === 'em_qualificacao').length
    const qualificadosMes = leads.filter(
      (l) => l.qualificado && l.dataEnvioCloser?.slice(0, 7) === mesAtual,
    ).length
    const reunioesMes = leads.filter((l) => l.dataReuniaoAgendada?.slice(0, 7) === mesAtual).length
    const qualificadosTotal = recebidos.filter((l) => l.qualificado).length
    const taxa = recebidos.length > 0 ? Math.round((qualificadosTotal / recebidos.length) * 100) : 0
    return { emQualificacao, qualificadosMes, reunioesMes, taxa }
  }, [leads])

  const rows = useMemo(() => {
    return leads
      .filter(chegouNoSdr)
      .filter((l) => !q || `${l.nomeContato} ${l.empresa}`.toLowerCase().includes(q.toLowerCase()))
  }, [leads, q])

  const columns: Column<Lead>[] = [
    { key: 'contato', header: 'Contato / Empresa', render: (l) => <ContatoEmpresa lead={l} /> },
    { key: 'origem', header: 'Origem', render: (l) => <Badge tone="neutral">{l.origem}</Badge> },
    { key: 'enviado', header: 'Enviado por', render: (l) => pessoaComercialNome(l.socialSellerId) },
    { key: 'recebimento', header: 'Data recebimento', render: (l) => fmtData(l.dataEnvioSDR) },
    {
      key: 'status',
      header: 'Status',
      render: (l) => {
        const s = statusView(l)
        return (
          <div className="flex flex-col gap-0.5">
            <StatusBadge label={s.label} tone={s.tone} />
            {l.etapaFunil === 'reuniao_agendada' && l.reuniao && (
              <span className="text-[10px] text-muted">
                {fmtData(l.reuniao.data)} · {l.reuniao.hora}
              </span>
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
        l.etapaFunil === 'em_qualificacao' ? (
          <PrimaryButton size="sm" onClick={() => navigate(`/comercial/sdr/qualificar/${l.id}`)}>
            <Target size={13} /> Qualificar Lead
          </PrimaryButton>
        ) : l.etapaFunil === 'reuniao_agendada' ? (
          <span className="text-[11px] text-muted">
            Closer: {pessoaComercialNome(l.closerId)}
          </span>
        ) : (
          <span className="text-[11px] text-muted">—</span>
        ),
    },
  ]

  return (
    <div>
      <Breadcrumb trilha={['Comercial', 'SDR']} />
      <PageHeader title="SDR" description="Qualificação de leads e agendamento de reuniões" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Leads em qualificação" value={String(kpis.emQualificacao)} icon={<Target size={13} />} tone={kpis.emQualificacao > 0 ? 'warning' : 'neutral'} sub="fila atual" />
        <KPICard label="Qualificados no mês" value={String(kpis.qualificadosMes)} icon={<CheckCircle2 size={13} />} tone="success" sub="SQLs no mês" />
        <KPICard label="Reuniões agendadas (mês)" value={String(kpis.reunioesMes)} icon={<CalendarClock size={13} />} tone="info" sub="agendadas no mês" />
        <KPICard label="Taxa de qualificação" value={`${kpis.taxa}%`} icon={<Percent size={13} />} tone={kpis.taxa >= 50 ? 'success' : 'attention'} sub="qualificados / recebidos" />
      </div>

      <LeadsTable
        columns={columns}
        rows={rows}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar contato ou empresa...' }}
        emptyLabel="Nenhum lead recebido do Social Selling."
      />
    </div>
  )
}
