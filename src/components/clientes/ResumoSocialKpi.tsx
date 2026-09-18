/**
 * Resumo operacional no topo da lista de clientes de SOCIAL MEDIA:
 *  - KPIs: Tarefas atrasadas + Clientes com problema de setup (perfil
 *    incompleto: foto/bio/destaques/contato não 'ok').
 *  - "Minhas tarefas de hoje" (tarefas do dia do usuário logado).
 * KPIs derivados da base FILTRADA passada em `clientes`.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kpi } from '@/components/clientes/ResumoClientesKpi'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isOverdue, relativeDueLabel, rotaCliente } from '@/lib/utils'
import type { Cliente, Tarefa } from '@/types/database'

interface SetupRow {
  cliente_id: string
  foto_status: string
  bio_status: string
  destaques_status: string
  contato_status: string
}

export function ResumoSocialKpi({ clientes }: { clientes: Cliente[] }) {
  const { profile } = useAuth()
  const [minhasTarefas, setMinhasTarefas] = useState<Tarefa[]>([])
  const [atrasadasRaw, setAtrasadasRaw] = useState<{ cliente_id: string }[]>([])
  const [setups, setSetups] = useState<SetupRow[]>([])

  useEffect(() => {
    let cancel = false
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const [minRes, atrRes, setupRes] = await Promise.all([
        profile
          ? supabase
              .from('tarefas')
              .select('*, cliente:clientes(*), responsavel:profiles(*)')
              .eq('responsavel_id', profile.id)
              .eq('data_vencimento', today)
              .neq('status', 'concluida')
              .order('prioridade', { ascending: false })
          : Promise.resolve({ data: [] as Tarefa[] }),
        supabase.from('tarefas').select('cliente_id').lt('data_vencimento', today).neq('status', 'concluida'),
        supabase
          .from('cliente_perfil_setup')
          .select('cliente_id, foto_status, bio_status, destaques_status, contato_status'),
      ])
      if (cancel) return
      setMinhasTarefas(
        ((minRes.data as Tarefa[]) ?? []).filter(
          (t) => t.cliente?.status !== 'churn' && !t.cliente?.arquivado_em,
        ),
      )
      setAtrasadasRaw((atrRes.data as { cliente_id: string }[]) ?? [])
      setSetups((setupRes.data as SetupRow[]) ?? [])
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
    // Onboarding social = fase de estabilização — tarefas atrasadas não contam.
    const onboardingIds = new Set(
      baseAtiva.filter((c) => c.jornada_social === 'onboarding').map((c) => c.id),
    )
    const atrasadas = atrasadasRaw.filter(
      (t) => baseIds.has(t.cliente_id) && !onboardingIds.has(t.cliente_id),
    ).length
    const setupOk = new Map(
      setups.map((s) => [
        s.cliente_id,
        s.foto_status === 'ok' &&
          s.bio_status === 'ok' &&
          s.destaques_status === 'ok' &&
          s.contato_status === 'ok',
      ]),
    )
    // Sem linha de setup = incompleto (problema).
    const setupProblema = baseAtiva.filter((c) => !(setupOk.get(c.id) ?? false)).length
    return { atrasadas, setupProblema }
  }, [clientes, atrasadasRaw, setups])

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Tarefas atrasadas"
          value={kpis.atrasadas.toString()}
          tone={kpis.atrasadas > 0 ? 'danger' : 'neutral'}
        />
        <Kpi
          icon={<Sparkles size={16} />}
          label="Clientes com problema de setup"
          value={kpis.setupProblema.toString()}
          tone={kpis.setupProblema > 0 ? 'danger' : 'neutral'}
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
