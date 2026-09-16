/**
 * Renovações de Contrato — VIEW derivada dos contratos das fichas.
 *
 * Cada linha vem do card "Contrato" da Ficha do cliente (data-fim). Aqui
 * só lemos e calculamos vencimentos — ver ./useRenovacoesData.ts. Preencher
 * o contrato na Ficha reflete aqui automaticamente.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  Calendar,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Search,
  ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import type { SemaforoCliente } from '@/types/database'
import { useRenovacoesData, type LinhaRenovacao } from './useRenovacoesData'

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '—'
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

  return (
    <div>
      <nav className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <span className="text-zinc-300">Renovações</span>
      </nav>

      <PageHeader
        title="Renovações de Contrato"
        description="Acompanhe vencimentos e gerencie protocolos de renovação"
      />

      {d.loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : (
        <>
          {/* Cards de alerta */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AlertCard
              icon={<Calendar size={16} />}
              valor={d.kpis.vencendo30}
              label="Vencendo em 30 dias"
              tone="amber"
            />
            <AlertCard
              icon={<AlertTriangle size={16} />}
              valor={d.kpis.vencendo15}
              label="Vencendo em 15 dias"
              tone="orange"
            />
            <AlertCard
              icon={<AlertCircle size={16} />}
              valor={d.kpis.vencendo7}
              label="Vencendo em 7 dias"
              tone="red"
            />
            <AlertCard
              icon={<XCircle size={16} />}
              valor={d.kpis.vencidos}
              label="Contratos vencidos"
              tone="darkred"
            />
          </div>

          {d.vazio ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-bg-soft/30 p-12 text-center">
              <Calendar size={22} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-zinc-200">Nenhum contrato com vencimento cadastrado</p>
              <p className="mt-1 text-[11px] text-muted">
                Preencha o <strong>Contrato</strong> (com data de fim) na Ficha de um cliente e ele
                aparece aqui automaticamente.
              </p>
            </div>
          ) : (
            <>
              {/* Busca */}
              <div className="relative mb-3 mt-4 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-lg border border-border bg-bg-card py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
                />
              </div>

              <RenewalsTable linhas={linhas} />
            </>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// AlertCard
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
    <div className={cn('rounded-xl border border-border border-l-4 bg-bg-card p-4', t.border, t.bg)}>
      <div className={cn('mb-2', t.icon)}>{icon}</div>
      <p className="text-3xl font-bold leading-none tabular-nums text-zinc-100">{valor}</p>
      <p className="mt-1.5 text-[11px] text-muted">{label}</p>
    </div>
  )
}

// ============================================================
// RenewalsTable
// ============================================================
const RISCO: Record<SemaforoCliente, { label: string; cls: string }> = {
  verde: { label: 'Estável', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  amarelo: { label: 'Atenção', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  laranja: { label: 'Risco', cls: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  vermelho: { label: 'Crítico', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
}

const STATUS_CONTRATO: Record<string, { label: string; cls: string }> = {
  ativo: { label: 'Ativo', cls: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300' },
  renovado: { label: 'Renovado', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  encerrado: { label: 'Encerrado', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
  pausado: { label: 'Pausado', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
}

/** Badge de dias restantes: vencido = vermelho; ≤7d = laranja; senão âmbar. */
function diasBadge(dias: number): { texto: string; cls: string } {
  if (dias < 0) {
    return {
      texto: `Vencido há ${Math.abs(dias)}d`,
      cls: 'border-red-500/50 bg-red-500/15 text-red-300',
    }
  }
  if (dias <= 7) return { texto: `${dias}d`, cls: 'border-orange-500/50 bg-orange-500/15 text-orange-300' }
  return { texto: `${dias}d`, cls: 'border-amber-500/50 bg-amber-500/15 text-amber-300' }
}

function RenewalsTable({ linhas }: { linhas: LinhaRenovacao[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
      <table className="w-full min-w-[900px] text-xs">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
            <th className="px-3 py-2.5 text-left font-semibold">Squad</th>
            <th className="px-3 py-2.5 text-left font-semibold">Account Manager</th>
            <th className="px-3 py-2.5 text-left font-semibold">Data Fim</th>
            <th className="px-3 py-2.5 text-left font-semibold">Dias Restantes</th>
            <th className="px-3 py-2.5 text-left font-semibold">Status Contrato</th>
            <th className="px-3 py-2.5 text-left font-semibold">Risco / NPS</th>
            <th className="px-3 py-2.5 text-right font-semibold">Ação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const dias = diasBadge(l.diasRestantes)
            const risco = l.semaforo ? RISCO[l.semaforo] : RISCO.verde
            const status = STATUS_CONTRATO[l.contratoStatus ?? 'ativo'] ?? STATUS_CONTRATO.ativo
            return (
              <tr key={l.id} className="border-b border-border/60 last:border-b-0 transition-colors hover:bg-bg-soft/50">
                <td className="px-4 py-3 font-medium text-zinc-100">{l.nome}</td>
                <td className="px-3 py-3 text-zinc-300">{l.squad ?? '—'}</td>
                <td className="px-3 py-3 text-zinc-300">{l.accountManager ?? '—'}</td>
                <td className="px-3 py-3 tabular-nums text-zinc-300">{dataBR(l.contratoFim)}</td>
                <td className="px-3 py-3">
                  <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums', dias.cls)}>
                    {dias.texto}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium', status.cls)}>
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium', risco.cls)}>
                      {risco.label}
                    </span>
                    {typeof l.nps === 'number' && (
                      <span className="text-[10px] tabular-nums text-muted">NPS {l.nps}</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <Link
                    to={`/clientes/${l.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:border-brand-500/50 hover:text-brand-300"
                    title="Abrir a ficha do cliente para gerenciar o contrato"
                  >
                    Iniciar Protocolo <ArrowRight size={11} />
                  </Link>
                </td>
              </tr>
            )
          })}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted">
                Nenhum cliente encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
