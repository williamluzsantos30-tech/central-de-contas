/**
 * Resumo operacional no topo da lista de clientes de TRÁFEGO: KPIs (verba sob
 * gestão, tarefas atrasadas, ativos com problema) + painel "Tarefas do dia".
 *
 * O KPI "Tarefas atrasadas" e o painel consomem a MESMA fonte (`tarefasDoDia`,
 * calculada no pai via getTarefasDoDia): se o KPI diz "4", o grupo
 * "Atrasadas" do painel mostra exatamente essas 4.
 */
import { useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { TodayTasksPanel } from '@/components/tarefas/TodayTasksPanel'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { TarefasDoDia } from '@/lib/tarefasDoDia'
import type { Ativo, Cliente } from '@/types/database'

export function ResumoClientesKpi({
  clientes,
  tarefasDoDia,
  hoje,
  onTarefasChanged,
}: {
  clientes: Cliente[]
  /** Fonte única (para hoje + atrasadas + perdidas) — mesma do KPI e da tabela. */
  tarefasDoDia: TarefasDoDia
  hoje: string
  onTarefasChanged: () => Promise<void> | void
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

  const { atrasadas, perdidasSemana } = tarefasDoDia

  const kpis = useMemo(() => {
    const baseAtiva = clientes.filter((c) => !c.arquivado_em)
    const baseIds = new Set(baseAtiva.map((c) => c.id))
    const verba = baseAtiva.reduce(
      // Verba de MÍDIA sob gestão (Google + Meta) — o fee da agência (verba_mensal) não entra.
      (s, c) => s + (c.verba_google ?? 0) + (c.verba_meta ?? 0),
      0,
    )
    const ativosProblema = ativos.filter(
      (a) => a.status === 'com_problema' && baseIds.has(a.cliente_id),
    ).length
    return { verba, ativosProblema }
  }, [clientes, ativos])

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          icon={<CircleDollarSign size={16} />}
          label="Verba de mídia sob gestão"
          value={formatCurrency(kpis.verba)}
          tone="success"
        />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Tarefas atrasadas"
          value={atrasadas.length.toString()}
          tone={atrasadas.length > 0 ? 'danger' : 'neutral'}
          sub={`${perdidasSemana} ${perdidasSemana === 1 ? 'perdida' : 'perdidas'} na semana`}
          subTitle="Ocorrências de tarefas recorrentes não feitas no período (últimos 7 dias)"
        />
        <Kpi
          icon={<ShieldAlert size={16} />}
          label="Ativos com problema"
          value={kpis.ativosProblema.toString()}
          tone={kpis.ativosProblema > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <TodayTasksPanel resumo={tarefasDoDia} hoje={hoje} onChanged={onTarefasChanged} />
    </>
  )
}

/** KPI card — mesmo visual do Dashboard (glow no hover, ícone em caixa). */
export function Kpi({
  icon,
  label,
  value,
  tone = 'neutral',
  sub,
  subTitle,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'neutral' | 'danger' | 'success'
  sub?: string
  subTitle?: string
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
          {sub && (
            <p className="mt-1 text-[11px] text-muted" title={subTitle}>
              {sub}
            </p>
          )}
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
