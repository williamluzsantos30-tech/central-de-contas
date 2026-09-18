/**
 * Resumo operacional no topo da lista de clientes de TRÁFEGO: KPIs (verba sob
 * gestão, tarefas atrasadas, ativos com problema) + "Minhas tarefas de hoje".
 * Os KPIs são derivados da base FILTRADA passada em `clientes`; ativos/tarefas
 * são carregados aqui. Reaproveita o visual do Dashboard.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleDollarSign, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, isOverdue, relativeDueLabel, rotaCliente } from '@/lib/utils'
import type { Ativo, Cliente, Tarefa } from '@/types/database'

export function ResumoClientesKpi({ clientes }: { clientes: Cliente[] }) {
  const { profile } = useAuth()
  const [ativos, setAtivos] = useState<Pick<Ativo, 'cliente_id' | 'status'>[]>([])
  const [atrasadasRaw, setAtrasadasRaw] = useState<{ cliente_id: string }[]>([])
  const [minhasTarefas, setMinhasTarefas] = useState<Tarefa[]>([])

  useEffect(() => {
    let cancel = false
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const [aRes, atrRes, minRes] = await Promise.all([
        supabase.from('ativos').select('cliente_id, status'),
        supabase.from('tarefas').select('cliente_id').lt('data_vencimento', today).neq('status', 'concluida'),
        profile
          ? supabase
              .from('tarefas')
              .select('*, cliente:clientes(*), responsavel:profiles(*)')
              .eq('responsavel_id', profile.id)
              .eq('data_vencimento', today)
              .neq('status', 'concluida')
              .order('prioridade', { ascending: false })
          : Promise.resolve({ data: [] as Tarefa[] }),
      ])
      if (cancel) return
      setAtivos((aRes.data as Pick<Ativo, 'cliente_id' | 'status'>[]) ?? [])
      setAtrasadasRaw((atrRes.data as { cliente_id: string }[]) ?? [])
      setMinhasTarefas(
        ((minRes.data as Tarefa[]) ?? []).filter(
          (t) => t.cliente?.status !== 'churn' && !t.cliente?.arquivado_em,
        ),
      )
    }
    load()
    const id = setInterval(load, 60000)
    return () => {
      cancel = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const kpis = useMemo(() => {
    const baseAtiva = clientes.filter((c) => !c.arquivado_em)
    const baseIds = new Set(baseAtiva.map((c) => c.id))
    const onboardingIds = new Set(
      baseAtiva.filter((c) => c.jornada === 'onboarding').map((c) => c.id),
    )
    const verba = baseAtiva.reduce(
      (s, c) => s + ((c.verba_google ?? 0) + (c.verba_meta ?? 0) || (c.verba_mensal ?? 0)),
      0,
    )
    const ativosProblema = ativos.filter(
      (a) => a.status === 'com_problema' && baseIds.has(a.cliente_id),
    ).length
    const atrasadas = atrasadasRaw.filter(
      (t) => baseIds.has(t.cliente_id) && !onboardingIds.has(t.cliente_id),
    ).length
    return { verba, atrasadas, ativosProblema }
  }, [clientes, ativos, atrasadasRaw])

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
          value={kpis.atrasadas.toString()}
          tone={kpis.atrasadas > 0 ? 'danger' : 'neutral'}
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
          <CardTitle>Minhas tarefas de hoje</CardTitle>
          <Link to="/minhas-tarefas" className="text-xs text-brand-300 hover:underline">
            ver todas
          </Link>
        </CardHeader>
        <CardBody className="max-h-[260px] space-y-2 overflow-y-auto">
          {minhasTarefas.length === 0 ? (
            <EmptyState title="Nenhuma tarefa para hoje" description="Você está em dia 🎉" />
          ) : (
            minhasTarefas.map((t) => (
              <Link
                key={t.id}
                to={rotaCliente({ id: t.cliente_id, modulos: t.cliente?.modulos })}
                className="flex items-center justify-between rounded-lg border border-border bg-bg-soft px-3 py-2 hover:bg-bg-elev"
              >
                <div>
                  <p className="text-sm font-medium">{t.nome}</p>
                  <p className="text-xs text-muted">{t.cliente?.nome}</p>
                </div>
                <Badge tone={isOverdue(t.data_vencimento) ? 'danger' : 'brand'}>
                  {relativeDueLabel(t.data_vencimento)}
                </Badge>
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    </>
  )
}

/** KPI card — mesmo visual do Dashboard (glow no hover, ícone em caixa). */
function Kpi({
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
