/**
 * Resumo operacional no topo da lista de clientes de TRÁFEGO: KPIs (verba sob
 * gestão, tarefas atrasadas, ativos com problema) + painel "Tarefas do dia".
 *
 * O KPI "Tarefas atrasadas" e o painel consomem a MESMA fonte (`tarefasDoDia`,
 * calculada no pai via getTarefasDoDia) — nunca mais duas lógicas separadas.
 * Se o KPI diz "4", a seção "⚠ Atrasadas" mostra exatamente essas 4.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleDollarSign, AlertTriangle, ShieldAlert, Clock } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, rotaCliente } from '@/lib/utils'
import { vencidaHaLabel, type TarefasDoDia } from '@/lib/tarefasDoDia'
import type { Ativo, Cliente, Tarefa } from '@/types/database'

export function ResumoClientesKpi({
  clientes,
  tarefasDoDia,
}: {
  clientes: Cliente[]
  /** Fonte única (atrasadas + de hoje) — mesma do KPI e da tabela. */
  tarefasDoDia: TarefasDoDia
}) {
  const [ativos, setAtivos] = useState<Pick<Ativo, 'cliente_id' | 'status'>[]>([])

  useEffect(() => {
    let cancel = false
    async function load() {
      const aRes = await supabase.from('ativos').select('cliente_id, status')
      if (cancel) return
      setAtivos((aRes.data as Pick<Ativo, 'cliente_id' | 'status'>[]) ?? [])
    }
    load()
    const id = setInterval(load, 60000)
    return () => {
      cancel = true
      clearInterval(id)
    }
  }, [])

  const { atrasadas, hoje } = tarefasDoDia

  const kpis = useMemo(() => {
    const baseAtiva = clientes.filter((c) => !c.arquivado_em)
    const baseIds = new Set(baseAtiva.map((c) => c.id))
    const verba = baseAtiva.reduce(
      (s, c) => s + ((c.verba_google ?? 0) + (c.verba_meta ?? 0) || (c.verba_mensal ?? 0)),
      0,
    )
    const ativosProblema = ativos.filter(
      (a) => a.status === 'com_problema' && baseIds.has(a.cliente_id),
    ).length
    return { verba, ativosProblema }
  }, [clientes, ativos])

  const vazio = atrasadas.length === 0 && hoje.length === 0

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          icon={<CircleDollarSign size={16} />}
          label="Verba sob gestão"
          value={formatCurrency(kpis.verba)}
          tone="success"
        />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Tarefas atrasadas"
          value={atrasadas.length.toString()}
          tone={atrasadas.length > 0 ? 'danger' : 'neutral'}
        />
        <Kpi
          icon={<ShieldAlert size={16} />}
          label="Ativos com problema"
          value={kpis.ativosProblema.toString()}
          tone={kpis.ativosProblema > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Tarefas do dia</CardTitle>
          <Link to="/minhas-tarefas" className="text-xs text-brand-300 hover:underline">
            ver todas
          </Link>
        </CardHeader>
        <CardBody className="max-h-[320px] space-y-3 overflow-y-auto">
          {vazio ? (
            <EmptyState title="Nenhuma tarefa pra hoje" description="Você está em dia 🎉" />
          ) : (
            <>
              {/* Atrasadas primeiro (destaque vermelho) — mesma lógica dos
                  outros painéis do sistema. */}
              {atrasadas.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-300">
                    <AlertTriangle size={12} /> Atrasadas · {atrasadas.length}
                  </p>
                  {atrasadas.map((t) => (
                    <TarefaLinha key={t.id} tarefa={t} atrasada />
                  ))}
                </div>
              )}
              {hoje.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <Clock size={12} /> Hoje · {hoje.length}
                  </p>
                  {hoje.map((t) => (
                    <TarefaLinha key={t.id} tarefa={t} />
                  ))}
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </>
  )
}

/** Linha de tarefa no painel. Atrasada = destaque vermelho + "Vencida há Nd". */
function TarefaLinha({ tarefa: t, atrasada = false }: { tarefa: Tarefa; atrasada?: boolean }) {
  return (
    <Link
      to={rotaCliente({ id: t.cliente_id, modulos: t.cliente?.modulos })}
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
        atrasada
          ? 'border-red-500/40 bg-red-500/[0.05] hover:bg-red-500/[0.09]'
          : 'border-border bg-bg-soft hover:bg-bg-elev',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{t.nome}</p>
        <p className="truncate text-xs text-muted">{t.cliente?.nome ?? '—'}</p>
      </div>
      <Badge tone={atrasada ? 'danger' : 'brand'} className="shrink-0">
        {atrasada && t.data_vencimento ? vencidaHaLabel(t.data_vencimento) : 'Hoje'}
      </Badge>
    </Link>
  )
}

/** KPI card — mesmo visual do Dashboard (glow no hover, ícone em caixa). */
export function Kpi({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'neutral' | 'danger' | 'success'
}) {
  const valueColor =
    tone === 'danger' ? 'text-red-400' : tone === 'success' ? 'text-emerald-300' : 'text-zinc-100'
  const iconBox =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 group-hover/kpi:border-emerald-500/60'
      : 'border-brand-500/30 bg-brand-500/10 text-brand-300 group-hover/kpi:border-brand-500/60'
  const glowColor =
    tone === 'success' ? 'bg-emerald-500/10' : tone === 'danger' ? 'bg-red-500/10' : 'bg-brand-500/10'
  return (
    <Card className="group/kpi overflow-hidden transition-transform duration-300 hover:-translate-y-0.5">
      <CardBody className="relative flex items-start justify-between">
        <span
          aria-hidden
          className={`pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full ${glowColor} blur-3xl opacity-0 transition-opacity duration-500 group-hover/kpi:opacity-100`}
        />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
        </div>
        <div
          className={`relative grid h-10 w-10 place-items-center rounded-xl border transition-all duration-300 group-hover/kpi:scale-110 ${iconBox}`}
        >
          {icon}
        </div>
      </CardBody>
    </Card>
  )
}
