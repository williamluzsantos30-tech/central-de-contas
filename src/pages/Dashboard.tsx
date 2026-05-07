import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CircleDollarSign, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { AtivoHealth } from '@/components/clientes/AtivoHealth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, isOverdue, relativeDueLabel } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Ativo, Cliente, Tarefa } from '@/types/database'

interface ClienteAtencao extends Cliente {
  ativosProblema: number
  tarefasAtrasadas: number
  ativos: Ativo[]
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [kpis, setKpis] = useState({ clientes: 0, verba: 0, atrasadas: 0, ativosProblema: 0 })
  const [minhasTarefas, setMinhasTarefas] = useState<Tarefa[]>([])
  const [atencao, setAtencao] = useState<ClienteAtencao[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    const [clientesRes, tarefasAtrasadasRes, ativosProblemaRes, minhasRes, todosClientesRes, todosAtivosRes, todasTarefasRes] =
      await Promise.all([
        supabase.from('clientes').select('verba_mensal, verba_google, verba_meta').eq('status', 'ativo'),
        supabase
          .from('tarefas')
          .select('id', { count: 'exact', head: true })
          .lt('data_vencimento', today)
          .neq('status', 'concluida'),
        supabase
          .from('ativos')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'com_problema'),
        supabase
          .from('tarefas')
          .select('*, cliente:clientes(*), responsavel:profiles(*)')
          .eq('responsavel_id', profile?.id ?? '')
          .eq('data_vencimento', today)
          .neq('status', 'concluida')
          .order('prioridade', { ascending: false }),
        supabase.from('clientes').select('*').eq('status', 'ativo').order('nome'),
        supabase.from('ativos').select('*'),
        supabase
          .from('tarefas')
          .select('cliente_id')
          .lt('data_vencimento', today)
          .neq('status', 'concluida'),
      ])

    const clientes = (clientesRes.data ?? []) as {
      verba_mensal: number | null
      verba_google: number | null
      verba_meta: number | null
    }[]
    const verba = clientes.reduce(
      (s, c) => s + ((c.verba_google ?? 0) + (c.verba_meta ?? 0) || (c.verba_mensal ?? 0)),
      0,
    )

    setKpis({
      clientes: clientes.length,
      verba,
      atrasadas: tarefasAtrasadasRes.count ?? 0,
      ativosProblema: ativosProblemaRes.count ?? 0,
    })
    setMinhasTarefas((minhasRes.data as Tarefa[]) ?? [])

    const ativos = (todosAtivosRes.data as Ativo[]) ?? []
    const atrasadasPorCliente = new Map<string, number>()
    for (const t of (todasTarefasRes.data as { cliente_id: string }[]) ?? []) {
      atrasadasPorCliente.set(t.cliente_id, (atrasadasPorCliente.get(t.cliente_id) ?? 0) + 1)
    }

    const lista: ClienteAtencao[] = (todosClientesRes.data as Cliente[]).map((c) => {
      const clienteAtivos = ativos.filter((a) => a.cliente_id === c.id)
      return {
        ...c,
        ativos: clienteAtivos,
        ativosProblema: clienteAtivos.filter((a) => a.status === 'com_problema').length,
        tarefasAtrasadas: atrasadasPorCliente.get(c.id) ?? 0,
      }
    })
    setAtencao(
      lista
        .filter((c) => c.ativosProblema > 0 || c.tarefasAtrasadas > 0)
        .sort((a, b) => b.tarefasAtrasadas + b.ativosProblema - (a.tarefasAtrasadas + a.ativosProblema))
        .slice(0, 8),
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [profile?.id])

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral da operação" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Users size={16} />} label="Clientes ativos" value={kpis.clientes.toString()} />
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Minhas tarefas de hoje</CardTitle>
            <Link to="/minhas-tarefas" className="text-xs text-brand-300 hover:underline">
              ver todas
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : minhasTarefas.length === 0 ? (
              <EmptyState title="Nenhuma tarefa para hoje" description="Você está em dia 🎉" />
            ) : (
              minhasTarefas.map((t) => (
                <Link
                  key={t.id}
                  to={`/clientes/${t.cliente_id}`}
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

        <Card>
          <CardHeader>
            <CardTitle>Clientes que precisam de atenção</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : atencao.length === 0 ? (
              <EmptyState title="Tudo em dia" description="Nenhum cliente com alerta." />
            ) : (
              atencao.map((c) => (
                <Link
                  key={c.id}
                  to={`/clientes/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-soft px-3 py-2 hover:bg-bg-elev"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={c.nome} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{c.nome}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.tarefasAtrasadas > 0 && (
                          <Badge tone="danger">{c.tarefasAtrasadas} atrasada(s)</Badge>
                        )}
                        {c.ativosProblema > 0 && (
                          <Badge tone="warning">{c.ativosProblema} ativo(s)</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <AtivoHealth ativos={c.ativos} />
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

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
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 group-hover/kpi:border-emerald-500/60 group-hover/kpi:shadow-[0_0_20px_-4px_rgba(16,185,129,0.6)]'
      : 'border-brand-500/30 bg-brand-500/10 text-brand-300 group-hover/kpi:border-brand-500/60 group-hover/kpi:shadow-[0_0_20px_-4px_rgba(249,115,22,0.6)]'
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
