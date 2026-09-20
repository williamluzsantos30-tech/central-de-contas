/**
 * Tela "Closer" — calls de vendas e fechamento.
 * Lista leads qualificados recebidos do SDR e registra o resultado da call
 * (fechou → cria Cliente em Onboarding; não fechou → motivo da perda).
 */
import { useMemo, useState } from 'react'
import { Headphones, Handshake, CheckCircle2, Percent } from 'lucide-react'
import {
  PageHeader,
  KPICard,
  PrimaryButton,
  type Column,
  type Tone,
} from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { LeadsTable, ContatoEmpresa, StatusBadge, fmtData, fmtBRL } from '@/components/comercial/LeadsTable'
import { CloseDealModal } from '@/components/comercial/CloseDealModal'
import { useComercial } from './store'
import { pessoaComercialNome, type Lead } from './mockLeads'

const mesAtual = new Date().toISOString().slice(0, 7)

/** Leads que chegaram ao Closer (agendados, em negociação, fechados, ou perdidos na call). */
function chegouNoCloser(l: Lead): boolean {
  if (l.etapaFunil === 'reuniao_agendada' || l.etapaFunil === 'em_negociacao' || l.etapaFunil === 'fechado')
    return true
  if (l.etapaFunil === 'perdido' && l.motivoPerda) return true
  return false
}

function statusView(l: Lead): { label: string; tone: Tone } {
  switch (l.etapaFunil) {
    case 'reuniao_agendada':
      return { label: 'Aguardando call', tone: 'attention' }
    case 'em_negociacao':
      return { label: 'Em negociação', tone: 'info' }
    case 'fechado':
      return { label: 'Fechado', tone: 'success' }
    default:
      return { label: 'Perdido', tone: 'danger' }
  }
}

export default function Closer() {
  const { leads } = useComercial()
  const [q, setQ] = useState('')
  const [leadSel, setLeadSel] = useState<Lead | null>(null)

  const kpis = useMemo(() => {
    const naAgenda = leads.filter((l) => l.etapaFunil === 'reuniao_agendada').length
    const emNegociacao = leads.filter((l) => l.etapaFunil === 'em_negociacao').length
    const fechadosMes = leads.filter(
      (l) => l.etapaFunil === 'fechado' && l.dataFechamento?.slice(0, 7) === mesAtual,
    )
    const totalFechado = fechadosMes.reduce((s, l) => s + (l.valorProposta ?? 0), 0)
    const perdidosCloserMes = leads.filter(
      (l) => l.etapaFunil === 'perdido' && l.motivoPerda && l.dataFechamento?.slice(0, 7) === mesAtual,
    ).length
    const realizadas = fechadosMes.length + perdidosCloserMes
    const taxa = realizadas > 0 ? Math.round((fechadosMes.length / realizadas) * 100) : 0
    return { naAgenda, emNegociacao, fechadosCount: fechadosMes.length, totalFechado, taxa }
  }, [leads])

  const rows = useMemo(() => {
    return leads
      .filter(chegouNoCloser)
      .filter((l) => !q || `${l.nomeContato} ${l.empresa}`.toLowerCase().includes(q.toLowerCase()))
  }, [leads, q])

  const columns: Column<Lead>[] = [
    { key: 'contato', header: 'Contato / Empresa', render: (l) => <ContatoEmpresa lead={l} /> },
    { key: 'sdr', header: 'Qualificado por', render: (l) => pessoaComercialNome(l.sdrId) },
    {
      key: 'reuniao',
      header: 'Data/hora reunião',
      render: (l) => (l.reuniao ? `${fmtData(l.reuniao.data)} · ${l.reuniao.hora}` : '—'),
    },
    { key: 'briefing', header: 'Briefing', render: (l) => <BriefingCell texto={l.briefingQualificacao} /> },
    {
      key: 'status',
      header: 'Status',
      render: (l) => {
        const s = statusView(l)
        return (
          <div className="flex flex-col gap-0.5">
            <StatusBadge label={s.label} tone={s.tone} />
            {l.etapaFunil === 'fechado' && l.valorProposta != null && (
              <span className="text-[10px] text-green-300">{fmtBRL(l.valorProposta)}</span>
            )}
            {l.etapaFunil === 'perdido' && l.motivoPerda && (
              <span className="text-[10px] text-muted">{l.motivoPerda}</span>
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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Reuniões na agenda" value={String(kpis.naAgenda)} icon={<Headphones size={13} />} tone="attention" sub="próximas calls" />
        <KPICard label="Propostas em negociação" value={String(kpis.emNegociacao)} icon={<Handshake size={13} />} tone="info" sub="em aberto" />
        <KPICard label="Fechados no mês" value={`${kpis.fechadosCount} · ${fmtBRL(kpis.totalFechado)}`} icon={<CheckCircle2 size={13} />} tone="success" sub="contagem + R$ no mês" />
        <KPICard label="Taxa de fechamento" value={`${kpis.taxa}%`} icon={<Percent size={13} />} tone={kpis.taxa >= 30 ? 'success' : 'attention'} sub="fechados / calls realizadas" />
      </div>

      <LeadsTable
        columns={columns}
        rows={rows}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar contato ou empresa...' }}
        emptyLabel="Nenhum lead qualificado recebido do SDR."
        minWidth={960}
      />

      <CloseDealModal open={!!leadSel} onClose={() => setLeadSel(null)} lead={leadSel} />
    </div>
  )
}

/** Célula de briefing: preview truncado + expandível. */
function BriefingCell({ texto }: { texto?: string }) {
  const [aberto, setAberto] = useState(false)
  if (!texto) return <span className="text-[11px] text-muted">—</span>
  const curto = texto.length > 90
  return (
    <div className="max-w-[320px] text-[11px] text-muted">
      <p className={aberto ? 'whitespace-pre-wrap' : 'line-clamp-2'}>{texto}</p>
      {curto && (
        <button
          onClick={() => setAberto((v) => !v)}
          className="mt-0.5 text-brand-300 hover:underline"
        >
          {aberto ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </div>
  )
}
