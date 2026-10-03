import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Eye, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { CallAlinhamentoCell } from '@/components/clientes/CallAlinhamentoCell'
import { ResumoClientesKpi } from '@/components/clientes/ResumoClientesKpi'
import { BudgetPacingCompact } from '@/components/trafego/TrafegoUI'
import { supabase } from '@/lib/supabase'
import {
  CONTRATO_INFO,
  SAUDE_INFO,
  contratoDoCliente,
  pacingDoCliente,
  saudeDaConta,
  type Contrato,
} from '@/lib/trafegoCliente'
import { temAlgumCargo, temCargo } from '@/lib/cargos'
import { buscarProfilesComPapel } from '@/lib/profilesComPapel'
import {
  cn,
  formatCurrency,
  formatDate,
  JORNADAS_CLIENTE,
  jornadaClienteLabel,
  monthKey,
  tipoClienteLabel,
} from '@/lib/utils'
import { getTarefasDoDia, contarAtrasadasPorCliente } from '@/lib/tarefasDoDia'
import { addDias, hojeISO, segundaDaSemana, type RegistroOcorrencia } from '@/lib/ocorrencias'
import { carregarRegistros, desdeFallback } from '@/lib/ocorrenciasStore'
import { useSquads } from '@/hooks/useSquads'
import { useAuth } from '@/contexts/AuthContext'
import type { Cliente, Profile, Tarefa } from '@/types/database'

/** Mesmas cores da Saúde no cabeçalho do cliente. */
const SAUDE_CLS: Record<keyof typeof SAUDE_INFO, string> = {
  estavel: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  atencao: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  critico: 'border-red-500/40 bg-red-500/10 text-red-300',
}

export default function ClientesTrafego() {
  const { profile } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [gestores, setGestores] = useState<Profile[]>([])
  // Tarefas ativas + ocorrências gravadas — fonte única do KPI "Tarefas
  // atrasadas", do painel "Tarefas do dia" e dos indicadores da tabela.
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [registros, setRegistros] = useState<Map<string, RegistroOcorrencia[]>>(new Map())
  const { nomes: squadsAtivos } = useSquads()
  const [q, setQ] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fGestor, setFGestor] = useState('')
  const [fContrato, setFContrato] = useState<Contrato | ''>('')
  const [fJornada, setFJornada] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)

  // Cargos operacionais começam vendo só "os meus". Diretoria/head/admin veem todos.
  const cargoOperacional = temAlgumCargo(profile, ['gestor_trafego', 'account_manager'])
  // Qualquer usuario aprovado edita a call de alinhamento (migration 057).
  // Quem faz a call sabe melhor quando ela foi/quando remarcar.
  const podeEditarCall = !!profile
  const isAdmin = profile?.role === 'admin'
  const [escopo, setEscopo] = useState<'meus' | 'todos'>(
    !isAdmin && cargoOperacional ? 'meus' : 'todos',
  )

  /**
   * `silent=true` = nao dispara o placeholder "Carregando..." — usa a
   * ultima leitura como fundo e substitui em background quando chega a
   * nova. Sem isso, o refresh de 60s piscava a tabela toda uma vez por
   * minuto.
   */
  async function load(silent = false) {
    if (!silent) setLoading(true)
    const hoje = hojeISO()
    // Janela das ocorrências: perdidas dos últimos 7 dias + semana e mês em aberto.
    const desde = [addDias(hoje, -8), segundaDaSemana(hoje), `${hoje.slice(0, 7)}-01`].sort()[0]
    const [cRes, gRes, tRes, regs] = await Promise.all([
      supabase
        .from('clientes')
        .select(
          '*, gestor:profiles!gestor_id(*), account_manager:profiles!account_manager_id(*), social_media:profiles!social_media_id(*)',
        )
        // Operação Tráfego = clientes com um Gestor de Tráfego vinculado.
        // A criação/edição do vínculo é feita só no modal da página Clientes.
        .not('gestor_id', 'is', null)
        .order('nome'),
      // Filtro "Todos gestores": quem é Gestor de Tráfego pelo papel
      // (Equipe Operacional) ou pelo cargo legado.
      buscarProfilesComPapel((sel) =>
        supabase.from('profiles').select(sel).eq('ativo', true).eq('aprovado', true).order('nome'),
      ),
      // Tarefas ativas (recorrentes = modelo; esporádicas em aberto).
      supabase
        .from('tarefas')
        .select('*, cliente:clientes(*), template:task_templates(*)')
        .in('status', ['pendente', 'em_andamento']),
      carregarRegistros({ desde }),
    ])
    setRegistros(regs)
    setClientes((cRes.data as Cliente[]) ?? [])
    setGestores(gRes.data.filter((p) => temCargo(p, 'gestor_trafego')))
    setTarefas((tRes.data as Tarefa[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Refresh a cada 60s em background — silent=true nao pisca o loading
    const id = setInterval(() => load(true), 60000)
    return () => clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      // Arquivados (churn) ficam ocultos — têm aba própria (Churns).
      if (c.arquivado_em) return false
      if (q && !c.nome.toLowerCase().includes(q.toLowerCase())) return false
      if (fSquad && c.squad !== fSquad) return false
      if (fGestor && c.gestor_id !== fGestor) return false
      if (fContrato && contratoDoCliente(c) !== fContrato) return false
      if (fJornada && c.jornada !== fJornada) return false
      // Apenas meus = sou gestor de tráfego OU account manager OU social media do cliente
      if (escopo === 'meus' && profile) {
        const eMeu =
          c.gestor_id === profile.id ||
          c.account_manager_id === profile.id ||
          c.social_media_id === profile.id
        if (!eMeu) return false
      }
      return true
    })
  }, [clientes, q, fSquad, fGestor, fContrato, fJornada, escopo, profile])

  // Fonte única: KPI "Tarefas atrasadas", painel "Tarefas do dia" e o
  // indicador da tabela saem TODOS daqui — escopados aos clientes filtrados.
  const hoje = hojeISO()
  const tarefasDoDia = useMemo(
    () => getTarefasDoDia(tarefas, registros, filtered, hoje, desdeFallback()),
    [tarefas, registros, filtered, hoje],
  )
  const atrasadasPorCliente = useMemo(
    () => contarAtrasadasPorCliente(tarefasDoDia.atrasadas),
    [tarefasDoDia],
  )

  return (
    <div>
      <PageHeader
        title="Clientes · Tráfego"
        description={`${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'} com gestor de tráfego`}
      />

      {/* Resumo operacional (KPIs verba/tarefas/ativos + painel "Tarefas do dia").
          KPI e painel consomem a mesma fonte (tarefasDoDia). */}
      <ResumoClientesKpi
        clientes={filtered}
        tarefasDoDia={tarefasDoDia}
        hoje={hoje}
        onTarefasChanged={() => load(true)}
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          {/* Toggle Apenas meus / Todo o time */}
          <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
            <button
              onClick={() => setEscopo('meus')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                escopo === 'meus'
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              Apenas meus
            </button>
            <button
              onClick={() => setEscopo('todos')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                escopo === 'todos'
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              Todo o time
            </button>
          </div>

          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={fSquad} onChange={(e) => setFSquad(e.target.value)} className="w-36">
            <option value="">Todas squads</option>
            {squadsAtivos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={fGestor} onChange={(e) => setFGestor(e.target.value)} className="w-44">
            <option value="">Todos gestores</option>
            {gestores.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
          <Select
            value={fContrato}
            onChange={(e) => setFContrato(e.target.value as Contrato | '')}
            className="w-40"
            title="Situação do contrato"
          >
            <option value="">Todos contratos</option>
            {(Object.keys(CONTRATO_INFO) as Contrato[]).map((k) => (
              <option key={k} value={k}>
                Contrato {CONTRATO_INFO[k].label.toLowerCase()}
              </option>
            ))}
          </Select>
          <Select value={fJornada} onChange={(e) => setFJornada(e.target.value)} className="w-40">
            <option value="">Todas jornadas</option>
            {JORNADAS_CLIENTE.map((j) => (
              <option key={j} value={j}>
                {jornadaClienteLabel[j]}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-soft">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Squad</th>
                  <th className="px-3 py-2.5">Account Manager</th>
                  <th className="px-3 py-2.5">Gestor de Tráfego</th>
                  <th className="px-3 py-2.5">Verba</th>
                  <th className="px-3 py-2.5" title="Saúde da conta — o contrato fica no filtro acima">
                    Saúde
                  </th>
                  <th className="px-3 py-2.5">Jornada</th>
                  <th className="px-3 py-2.5">Call alinhamento</th>
                  <th className="px-3 py-2.5">Última atualização</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const nAtrasadas = atrasadasPorCliente.get(c.id) ?? 0
                    const nPerdidas = tarefasDoDia.perdidasPorCliente.get(c.id) ?? 0
                    const { pacing, verbaTotal } = pacingDoCliente(c, monthKey())
                    const saude = saudeDaConta(c)
                    const contrato = contratoDoCliente(c)
                    return (
                    <tr key={c.id} className="border-t border-border hover:bg-bg-soft">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/clientes/${c.id}?aba=operacional-trafego`}
                            className="text-sm font-medium text-zinc-100 hover:text-brand-300"
                          >
                            {c.nome}
                          </Link>
                          {nAtrasadas > 0 && (
                            <Badge
                              tone="danger"
                              className="shrink-0"
                              title={`${nAtrasadas} tarefa(s) atrasada(s) neste cliente`}
                            >
                              <AlertTriangle size={10} className="mr-0.5" />
                              {nAtrasadas} atrasada{nAtrasadas > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {nPerdidas > 0 && (
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-orange-500/50 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-300"
                              title={`${nPerdidas} ocorrência(s) de tarefas recorrentes não feitas nos últimos 7 dias`}
                            >
                              ⚠ {nPerdidas} perdida{nPerdidas > 1 ? 's' : ''}
                            </span>
                          )}
                          {c.tipo && (
                            <Badge tone="neutral" className="shrink-0">
                              {tipoClienteLabel[c.tipo]}
                            </Badge>
                          )}
                        </div>
                        {c.nicho && <p className="text-[11px] text-muted">{c.nicho}</p>}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">{c.squad ?? '—'}</td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {c.account_manager?.nome ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {c.gestor?.nome ?? '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium tabular-nums text-emerald-300">{formatCurrency(verbaTotal)}</p>
                        <BudgetPacingCompact pacing={pacing} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium',
                            SAUDE_CLS[saude],
                          )}
                        >
                          {SAUDE_INFO[saude].label}
                        </span>
                        {/* Contrato não-ativo aparece como nota — sem virar outro "status". */}
                        {contrato !== 'ativo' && (
                          <p className="mt-0.5 text-[10px] text-muted">Contrato {CONTRATO_INFO[contrato].label.toLowerCase()}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {c.jornada ? jornadaClienteLabel[c.jornada] : '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <CallAlinhamentoCell
                          clienteId={c.id}
                          clienteNome={c.nome}
                          proxima={c.proxima_call_alinhamento}
                          ultima={c.ultima_call_alinhamento}
                          gcalEventId={c.gcal_event_id}
                          podeEditar={podeEditarCall}
                          onChanged={load}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted whitespace-nowrap">
                        {formatDate(c.updated_at)}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => {
                              setEditing(c)
                              setFormOpen(true)
                            }}
                            className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-brand-300"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <Link
                            to={`/clientes/${c.id}?aba=operacional-trafego`}
                            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
                            title="Abrir detalhes"
                          >
                            <Eye size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <ClienteForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        cliente={editing}
        onSaved={load}
      />
    </div>
  )
}

function statusTone(status: Cliente['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ativo':
      return 'success'
    case 'atencao':
      return 'warning'
    case 'pausado':
      return 'neutral'
    case 'churn':
      return 'danger'
  }
}
