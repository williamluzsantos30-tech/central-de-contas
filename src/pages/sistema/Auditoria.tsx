/**
 * Sistema › Auditoria — log de exclusões de tarefas (migration 031). Veio da
 * aba Auditoria do Admin (26/09/2026). Só admin.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'
import type { Tarefa } from '@/types/database'

export default function Auditoria() {
  return (
    <div>
      <PageHeader title="Auditoria" description="Registro de tarefas excluídas — quem, quando e o quê" />
      <AuditoriaTab />
    </div>
  )
}

/* =========================================================
   Tab: Auditoria — log de exclusões de tarefas
   ========================================================= */

interface TarefaLogRow {
  id: string
  acao: string
  tarefa_id: string
  tarefa_data: Record<string, unknown>
  ator_user_id: string | null
  ator_nome: string | null
  ator_email: string | null
  cliente_id: string | null
  created_at: string
}

function AuditoriaTab() {
  const [logs, setLogs] = useState<TarefaLogRow[]>([])
  const [clientes, setClientes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtroAtor, setFiltroAtor] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    Promise.all([
      supabase
        .from('tarefas_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('clientes').select('id, nome'),
    ]).then(([logsRes, cliRes]) => {
      if (cancelado) return
      setLogs((logsRes.data as TarefaLogRow[]) ?? [])
      const mapa: Record<string, string> = {}
      for (const c of (cliRes.data as Array<{ id: string; nome: string }> | null) ?? []) {
        mapa[c.id] = c.nome
      }
      setClientes(mapa)
      setLoading(false)
    })
    return () => {
      cancelado = true
    }
  }, [])

  const atoresUnicos = useMemo(() => {
    const set = new Map<string, string>()
    for (const l of logs) {
      if (l.ator_user_id) set.set(l.ator_user_id, l.ator_nome ?? l.ator_email ?? 'Sem nome')
    }
    return Array.from(set, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    )
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filtroAtor && l.ator_user_id !== filtroAtor) return false
      if (filtroCliente && l.cliente_id !== filtroCliente) return false
      return true
    })
  }, [logs, filtroAtor, filtroCliente])

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <p className="text-sm text-zinc-100">
            <strong>Auditoria de exclusões</strong> · todas as exclusões de tarefas ficam
            registradas com snapshot completo da tarefa + quem deletou.
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Mostrando os últimos 500 registros. Logs novos aparecem no topo.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <Select
            value={filtroAtor}
            onChange={(e) => setFiltroAtor(e.target.value)}
            className="w-56"
          >
            <option value="">Todos os autores</option>
            {atoresUnicos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
          <Select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="w-56"
          >
            <option value="">Todos os clientes</option>
            {Object.entries(clientes).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </Select>
          <span className="ml-auto text-[11px] text-muted">
            {filtered.length} de {logs.length} registros
          </span>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nenhuma exclusão registrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-soft">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2.5">Quando</th>
                    <th className="px-3 py-2.5">Quem excluiu</th>
                    <th className="px-3 py-2.5">Tarefa</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const isOpen = expanded === l.id
                    const nomeTarefa =
                      (l.tarefa_data?.nome as string | undefined) ?? '(sem nome)'
                    const clienteNome = l.cliente_id
                      ? clientes[l.cliente_id] ?? '—'
                      : '—'
                    return (
                      <React.Fragment key={l.id}>
                        <tr className="border-t border-border hover:bg-bg-soft/40">
                          <td className="px-3 py-2 text-[12px] text-muted">
                            {formatDateTime(l.created_at)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="text-sm text-zinc-100">
                                {l.ator_nome ?? '—'}
                              </span>
                              {l.ator_email && (
                                <span className="text-[10px] text-muted">{l.ator_email}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-zinc-200">
                            <Badge tone="danger" className="mr-1.5 text-[9px]">
                              excluída
                            </Badge>
                            {nomeTarefa}
                          </td>
                          <td className="px-3 py-2 text-[12px] text-zinc-300">
                            {clienteNome}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => setExpanded(isOpen ? null : l.id)}
                              className="text-[11px] text-brand-300 hover:underline"
                            >
                              {isOpen ? 'Fechar' : 'Ver snapshot'}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-t border-border bg-bg-soft/30">
                            <td colSpan={5} className="px-3 py-3">
                              <pre className="overflow-x-auto rounded-md bg-bg-elev p-3 text-[10px] leading-relaxed text-zinc-200">
                                {JSON.stringify(l.tarefa_data, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
