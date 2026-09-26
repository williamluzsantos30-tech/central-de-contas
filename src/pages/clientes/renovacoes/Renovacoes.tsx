/**
 * Renovações de Contrato — VIEW derivada dos contratos das fichas.
 *
 * Cada linha vem do card "Contrato" da Ficha do cliente (data-fim). Aqui
 * só lemos e calculamos vencimentos — ver ./useRenovacoesData.ts. Preencher
 * o contrato na Ficha reflete aqui automaticamente.
 *
 * UI em cima do design system (@/components/ds): DataTable + Badge.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, AlertTriangle, AlertCircle, XCircle, RefreshCw } from 'lucide-react'
import { PageHeader, DataTable, Badge, type Column, type RowTone, type Tone } from '@/components/ds'
import { cn } from '@/lib/utils'
import type { SemaforoCliente } from '@/types/database'
import { useRenovacoesData, type LinhaRenovacao } from './useRenovacoesData'

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '—'
}

const RISCO: Record<SemaforoCliente, { label: string; tone: Tone }> = {
  verde: { label: 'Estável', tone: 'success' },
  amarelo: { label: 'Atenção', tone: 'attention' },
  laranja: { label: 'Risco', tone: 'warning' },
  vermelho: { label: 'Crítico', tone: 'danger' },
}
/** Pra ordenar do mais grave pro mais tranquilo. */
const ORDEM_RISCO: Record<SemaforoCliente, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3 }
const STATUS_CONTRATO: Record<string, { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'neutral' },
  renovado: { label: 'Renovado', tone: 'success' },
  encerrado: { label: 'Encerrado', tone: 'danger' },
  pausado: { label: 'Pausado', tone: 'warning' },
}

/**
 * Escala de urgência dos dias restantes: vencido/≤7d vermelho, ≤15d laranja,
 * ≤30d amarelo; acima disso é neutro (sem cor — não é alerta).
 */
function diasBadge(dias: number): { texto: string; tone: Tone | null } {
  if (dias < 0) return { texto: `Vencido há ${Math.abs(dias)}d`, tone: 'danger' }
  if (dias <= 7) return { texto: `${dias}d`, tone: 'danger' }
  if (dias <= 15) return { texto: `${dias}d`, tone: 'warning' }
  if (dias <= 30) return { texto: `${dias}d`, tone: 'attention' }
  return { texto: `${dias}d`, tone: null }
}

/** Linha inteira tingida só pro que pede ação imediata. */
function prioridade(l: LinhaRenovacao): RowTone | undefined {
  if (l.diasRestantes < 0) return 'danger'
  if (l.diasRestantes <= 7) return 'warning'
  return undefined
}

export default function Renovacoes() {
  const d = useRenovacoesData()
  const [busca, setBusca] = useState('')

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return d.linhas
    return d.linhas.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        (l.squad ?? '').toLowerCase().includes(q) ||
        (l.accountManager ?? '').toLowerCase().includes(q),
    )
  }, [busca, d.linhas])

  const columns: Column<LinhaRenovacao>[] = [
    {
      key: 'nome',
      header: 'Cliente',
      sortValue: (l) => l.nome,
      render: (l) => <span className="font-medium text-zinc-100">{l.nome}</span>,
    },
    { key: 'squad', header: 'Squad', sortValue: (l) => l.squad, render: (l) => <span className="text-zinc-300">{l.squad ?? '—'}</span> },
    {
      key: 'am',
      header: 'Account Manager',
      sortValue: (l) => l.accountManager,
      render: (l) => <span className="text-zinc-300">{l.accountManager ?? '—'}</span>,
    },
    {
      key: 'fim',
      header: 'Data Fim',
      sortValue: (l) => l.contratoFim,
      render: (l) => <span className="tabular-nums text-zinc-300">{dataBR(l.contratoFim)}</span>,
    },
    {
      key: 'dias',
      header: 'Dias Restantes',
      sortValue: (l) => l.diasRestantes,
      render: (l) => {
        const b = diasBadge(l.diasRestantes)
        return b.tone ? (
          <Badge tone={b.tone} className="tabular-nums">{b.texto}</Badge>
        ) : (
          <span className="tabular-nums text-zinc-300">{b.texto}</span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status Contrato',
      sortValue: (l) => l.contratoStatus ?? 'ativo',
      render: (l) => {
        const s = STATUS_CONTRATO[l.contratoStatus ?? 'ativo'] ?? STATUS_CONTRATO.ativo
        // "Ativo" é o normal → texto; só as exceções ganham badge.
        return s.tone === 'neutral' ? <span className="text-zinc-300">{s.label}</span> : <Badge tone={s.tone}>{s.label}</Badge>
      },
    },
    {
      key: 'risco',
      header: 'Risco / NPS',
      sortValue: (l) => ORDEM_RISCO[l.semaforo ?? 'verde'],
      render: (l) => {
        const r = l.semaforo ? RISCO[l.semaforo] : RISCO.verde
        return (
          <span className="inline-flex items-center gap-1.5">
            {r.tone === 'success' ? <span className="text-zinc-300">{r.label}</span> : <Badge tone={r.tone}>{r.label}</Badge>}
            {typeof l.nps === 'number' && <span className="text-[10px] tabular-nums text-muted">NPS {l.nps}</span>}
          </span>
        )
      },
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'right',
      render: (l) => (
        <Link
          to={`/clientes/${l.id}?edit=contrato`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:border-brand-500/50 hover:text-brand-300"
          title="Abrir o contrato do cliente para atualizar"
        >
          <RefreshCw size={11} /> Renovação
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Renovações de Contrato"
        description="Acompanhe vencimentos e gerencie protocolos de renovação"
      />

      {d.loading ? (
        <div className="rounded-lg border border-border bg-bg-card p-12 text-center text-sm text-muted">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AlertCard icon={<Calendar size={16} />} valor={d.kpis.vencendo30} label="Vencendo em 30 dias" tone="amber" />
            <AlertCard icon={<AlertTriangle size={16} />} valor={d.kpis.vencendo15} label="Vencendo em 15 dias" tone="orange" />
            <AlertCard icon={<AlertCircle size={16} />} valor={d.kpis.vencendo7} label="Vencendo em 7 dias" tone="red" />
            <AlertCard icon={<XCircle size={16} />} valor={d.kpis.vencidos} label="Contratos vencidos" tone="darkred" />
          </div>

          {d.vazio ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-bg-soft/30 p-12 text-center">
              <Calendar size={22} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-zinc-200">Nenhum contrato com vencimento cadastrado</p>
              <p className="mt-1 text-[11px] text-muted">
                Preencha o <strong>Contrato</strong> (com data de fim) na Ficha de um cliente e ele aparece aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <DataTable
                columns={columns}
                rows={linhas}
                rowKey={(l) => l.id}
                rowTone={prioridade}
                defaultSort={{ key: 'dias', dir: 'asc' }}
                minWidth={900}
                search={{ value: busca, onChange: setBusca, placeholder: 'Buscar cliente...' }}
                emptyLabel="Nenhum cliente encontrado."
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// AlertCard — cartão de alerta com borda esquerda colorida (severidade).
// Específico de Renovações (o DS ainda não tem equivalente).
// ============================================================
const ALERT_TONE = {
  amber: { border: 'border-l-amber-500', icon: 'text-amber-300', bg: 'bg-amber-500/[0.04]' },
  orange: { border: 'border-l-orange-500', icon: 'text-orange-300', bg: 'bg-orange-500/[0.05]' },
  red: { border: 'border-l-red-500', icon: 'text-red-300', bg: 'bg-red-500/[0.05]' },
  darkred: { border: 'border-l-red-700', icon: 'text-red-400', bg: 'bg-red-700/[0.08]' },
} as const

function AlertCard({
  icon,
  valor,
  label,
  tone,
}: {
  icon: React.ReactNode
  valor: number
  label: string
  tone: keyof typeof ALERT_TONE
}) {
  const t = ALERT_TONE[tone]
  return (
    <div className={cn('rounded-lg border border-border border-l-4 bg-bg-card p-4', t.border, t.bg)}>
      <div className={cn('mb-2', t.icon)}>{icon}</div>
      <p className="text-3xl font-bold leading-none tabular-nums text-zinc-100">{valor}</p>
      <p className="mt-1.5 text-[11px] text-muted">{label}</p>
    </div>
  )
}
