import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'
import { TarefaDrawer } from '@/components/tarefas/TarefaDrawer'
import { supabase } from '@/lib/supabase'
import { cn, isOverdue, prioridadeLabel, relativeDueLabel, rotaCliente } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Tarefa } from '@/types/database'

type Aba = 'hoje' | 'semana' | 'atrasadas' | 'todas'

export default function MinhasTarefas() {
  const { profile } = useAuth()
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [aba, setAba] = useState<Aba>('hoje')
  const [drawer, setDrawer] = useState<Tarefa | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('tarefas')
      .select('*, cliente:clientes(*), responsavel:profiles(*)')
      .eq('responsavel_id', profile.id)
      .order('data_vencimento', { ascending: true })
    setTarefas((data as Tarefa[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [profile?.id])

  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const filtradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (aba === 'hoje') return t.data_vencimento === today && t.status !== 'concluida'
      if (aba === 'semana')
        return (
          t.data_vencimento &&
          t.data_vencimento >= today &&
          t.data_vencimento <= weekEnd &&
          t.status !== 'concluida'
        )
      if (aba === 'atrasadas')
        return t.data_vencimento && t.data_vencimento < today && t.status !== 'concluida'
      return true
    })
  }, [tarefas, aba, today, weekEnd])

  async function toggle(t: Tarefa) {
    const next = t.status === 'concluida' ? 'pendente' : 'concluida'
    const data_conclusao = next === 'concluida' ? new Date().toISOString() : null
    await supabase.from('tarefas').update({ status: next, data_conclusao }).eq('id', t.id)
    load()
  }

  return (
    <div>
      <PageHeader title="Minhas tarefas" description="Organização pessoal" />

      <div className="mb-5 flex gap-1 border-b border-border">
        {([
          ['hoje', 'Hoje'],
          ['semana', 'Esta semana'],
          ['atrasadas', 'Atrasadas'],
          ['todas', 'Todas'],
        ] as [Aba, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={cn(
              'px-4 py-2 text-sm -mb-px border-b-2',
              aba === key
                ? 'border-brand-500 text-brand-200'
                : 'border-transparent text-muted hover:text-zinc-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted">Carregando...</p>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Nada aqui. 🎉</p>
          ) : (
            filtradas.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft px-3 py-2 hover:bg-bg-elev"
              >
                <input
                  type="checkbox"
                  checked={t.status === 'concluida'}
                  onChange={() => toggle(t)}
                  className="h-4 w-4 accent-brand-500"
                />
                <button
                  onClick={() => setDrawer(t)}
                  className={cn(
                    'flex-1 text-left text-sm',
                    t.status === 'concluida' && 'line-through text-muted',
                  )}
                >
                  <p>{t.nome}</p>
                  {t.cliente && (
                    <Link
                      to={rotaCliente(t.cliente)}
                      className="text-[11px] text-muted hover:text-brand-300"
                    >
                      {t.cliente.nome}
                    </Link>
                  )}
                </button>
                <Badge
                  tone={
                    t.prioridade === 'alta'
                      ? 'danger'
                      : t.prioridade === 'media'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {prioridadeLabel[t.prioridade]}
                </Badge>
                <Badge tone={isOverdue(t.data_vencimento) && t.status !== 'concluida' ? 'danger' : 'brand'}>
                  {relativeDueLabel(t.data_vencimento)}
                </Badge>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <TarefaDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        tarefa={drawer}
        onChanged={load}
      />
    </div>
  )
}
