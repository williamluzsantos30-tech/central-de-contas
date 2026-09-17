import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Pencil, Eye, Download, CircleDollarSign, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import SocialClientes from '@/pages/social/Clientes'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { temAlgumCargo } from '@/lib/cargos'
import {
  cn,
  formatCurrency,
  formatDate,
  isOverdue,
  JORNADAS_CLIENTE,
  jornadaClienteLabel,
  relativeDueLabel,
  rotaCliente,
  tipoClienteLabel,
} from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { useAuth } from '@/contexts/AuthContext'
import type { Ativo, Cliente, Profile, Tarefa } from '@/types/database'

// Meses de casa inteiros — o mes em curso conta (entrou hoje = 1).
// Usado como "LT" (lifetime months) na tabela. Mesma regra da Ficha.
function mesesCasa(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44))) + 1
}

// Segmento da lista única. 'todos' = base inteira (colunas essenciais);
// 'trafego'/'social' = a visão rica daquele setor.
type Setor = 'todos' | 'trafego' | 'social'

export default function Clientes() {
  const { profile } = useAuth()
  // Segmento vem da URL (?setor=) — permite deep-link (ex: redirect de
  // /social/clientes → /clientes?setor=social). Default: Todos (a lista é
  // única, não pertence mais a um módulo).
  const [searchParams, setSearchParams] = useSearchParams()
  const setorParam = searchParams.get('setor')
  const setor: Setor = setorParam === 'social' ? 'social' : setorParam === 'trafego' ? 'trafego' : 'todos'
  function setSetor(s: Setor) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('setor', s)
        return next
      },
      { replace: true },
    )
  }
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [gestores, setGestores] = useState<Profile[]>([])
  const { nomes: squadsAtivos } = useSquads()
  const [q, setQ] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fGestor, setFGestor] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fJornada, setFJornada] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  // Dados operacionais pros KPIs reaproveitados do Dashboard
  const [ativos, setAtivos] = useState<Pick<Ativo, 'cliente_id' | 'status'>[]>([])
  const [atrasadasRaw, setAtrasadasRaw] = useState<{ cliente_id: string }[]>([])
  const [minhasTarefas, setMinhasTarefas] = useState<Tarefa[]>([])

  // Cargos operacionais começam vendo só "os meus". Diretoria/head/admin veem todos.
  const cargoOperacional = temAlgumCargo(profile, ['gestor_trafego', 'account_manager'])
  // Qualquer usuario aprovado edita a call de alinhamento (migration 057).
  // Quem faz a call sabe melhor quando ela foi/quando remarcar.
  const podeEditarCall = !!profile
  const isAdmin = profile?.role === 'admin'
  const podeVerArquivados =
    isAdmin || temAlgumCargo(profile, ['diretoria', 'head'])
  const [escopo, setEscopo] = useState<'meus' | 'todos'>(
    !isAdmin && cargoOperacional ? 'meus' : 'todos',
  )
  // Por padrão esconde arquivados (churn). Admin pode ligar.
  const [mostrarArquivados, setMostrarArquivados] = useState(false)

  /**
   * `silent=true` = nao dispara o placeholder "Carregando..." — usa a
   * ultima leitura como fundo e substitui em background quando chega a
   * nova. Sem isso, o refresh de 60s piscava a tabela toda uma vez por
   * minuto.
   */
  async function load(silent = false) {
    if (!silent) setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [cRes, gRes, ativosRes, atrasadasRes, minhasRes] = await Promise.all([
      // Lista única — carrega TODA a base. O segmento (Todos/Tráfego/Social)
      // filtra por módulo no cliente, em memória.
      supabase
        .from('clientes')
        .select(
          '*, gestor:profiles!gestor_id(*), account_manager:profiles!account_manager_id(*), social_media:profiles!social_media_id(*)',
        )
        .order('nome'),
      // Filtro "Todos gestores" só lista cargo gestor_trafego
      supabase
        .from('profiles')
        .select('*')
        .eq('ativo', true)
        .eq('aprovado', true)
        .eq('cargo', 'gestor_trafego')
        .order('nome'),
      // Ativos — só cliente_id + status pra contar os "com problema" por base
      supabase.from('ativos').select('cliente_id, status'),
      // Tarefas atrasadas (vencidas, não concluídas) — só cliente_id pra contar
      supabase.from('tarefas').select('cliente_id').lt('data_vencimento', today).neq('status', 'concluida'),
      // Minhas tarefas de hoje — pessoais, do usuário logado
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
    setClientes((cRes.data as Cliente[]) ?? [])
    setGestores((gRes.data as Profile[]) ?? [])
    setAtivos((ativosRes.data as Pick<Ativo, 'cliente_id' | 'status'>[]) ?? [])
    setAtrasadasRaw((atrasadasRes.data as { cliente_id: string }[]) ?? [])
    // Descarta tarefas cujo cliente está em churn/arquivado (igual ao Dashboard)
    setMinhasTarefas(
      ((minhasRes.data as Tarefa[]) ?? []).filter(
        (t) => t.cliente?.status !== 'churn' && !t.cliente?.arquivado_em,
      ),
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Refresh a cada 60s em background — silent=true nao pisca o loading
    const id = setInterval(() => load(true), 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      // Segmento: 'trafego' só clientes do módulo trafego; 'todos' = base inteira.
      // (o segmento 'social' é renderizado por outro componente.)
      const mods = c.modulos ?? ['trafego']
      if (setor === 'trafego' && !mods.includes('trafego')) return false
      // Arquivados (churn) ficam ocultos por padrão. Toggle mostra apenas eles.
      const eArquivado = !!c.arquivado_em
      if (mostrarArquivados && !eArquivado) return false
      if (!mostrarArquivados && eArquivado) return false
      if (q && !c.nome.toLowerCase().includes(q.toLowerCase())) return false
      if (fSquad && c.squad !== fSquad) return false
      if (fGestor && c.gestor_id !== fGestor) return false
      if (fStatus && c.status !== fStatus) return false
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
  }, [clientes, setor, q, fSquad, fGestor, fStatus, fJornada, escopo, profile, mostrarArquivados])

  // KPIs operacionais derivados da base FILTRADA (só ativos; churn/arquivado
  // ficam fora). Reaproveita as métricas do Dashboard — verba sob gestão,
  // tarefas atrasadas e ativos com problema — agora reagindo aos filtros da lista.
  const kpis = useMemo(() => {
    const baseAtiva = filtered.filter((c) => !c.arquivado_em)
    const baseIds = new Set(baseAtiva.map((c) => c.id))
    // Onboarding é fase de estabilização — tarefas atrasadas não contam (mesma
    // regra do Dashboard).
    const onboardingIds = new Set(
      baseAtiva.filter((c) => c.jornada === 'onboarding').map((c) => c.id),
    )
    // Verba sob gestão = verba de mídia (google + meta), com fallback pro ticket.
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
  }, [filtered, ativos, atrasadasRaw])

  return (
    <div>
      <PageHeader
        title={mostrarArquivados ? 'Clientes arquivados' : 'Lista de Clientes'}
        description={mostrarArquivados ? 'Arquivados (churn)' : 'Clientes ativos na base'}
        actions={
          setor === 'social' ? undefined : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => alert('Exportação em breve')}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-2 text-xs font-medium text-zinc-200 hover:border-brand-500/40 hover:text-brand-300"
              >
                <Download size={12} /> Exportar
              </button>
              <Button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus size={14} /> Novo cliente
              </Button>
            </div>
          )
        }
      />

      {/* Segmento da lista única: Todos · Tráfego · Social Media */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
        {(
          [
            ['todos', 'Todos'],
            ['trafego', 'Tráfego'],
            ['social', 'Social Media'],
          ] as [Setor, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSetor(key)}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-[11px] font-medium transition-colors',
              setor === key ? 'bg-bg-elev text-brand-200 shadow-sm' : 'text-muted hover:text-zinc-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {setor === 'social' ? (
        <SocialClientes embedded />
      ) : (
        <>
      {/* Resumo operacional — reaproveita os KPIs do Dashboard (verba sob
          gestão, tarefas atrasadas, ativos com problema) + Minhas tarefas de
          hoje. Os 3 KPIs seguem os filtros aplicados na lista. */}
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
          {loading ? (
            <p className="text-sm text-muted">Carregando...</p>
          ) : minhasTarefas.length === 0 ? (
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

      {/* Filter row — chips estilo ClickUp */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Toggle Meus/Time como pill segmentada */}
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          <button
            onClick={() => setEscopo('meus')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
              escopo === 'meus'
                ? 'bg-bg-elev text-zinc-100'
                : 'text-muted hover:text-zinc-200',
            )}
          >
            Apenas meus
          </button>
          <button
            onClick={() => setEscopo('todos')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
              escopo === 'todos' ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200',
            )}
          >
            Todo o time
          </button>
        </div>
        <ChipSelect
          value={fSquad}
          onChange={setFSquad}
          placeholder="Todas as Squads"
          options={squadsAtivos.map((s) => ({ value: s, label: s }))}
        />
        <ChipSelect
          value={fGestor}
          onChange={setFGestor}
          placeholder="Todos os Gestores"
          options={gestores.map((g) => ({ value: g.id, label: g.nome }))}
        />
        <ChipSelect
          value={fStatus}
          onChange={setFStatus}
          placeholder="Todos os Status"
          options={[
            { value: 'ativo', label: 'Ativo' },
            { value: 'atencao', label: 'Atenção' },
            { value: 'pausado', label: 'Pausado' },
            { value: 'churn', label: 'Churn' },
          ]}
        />
        <ChipSelect
          value={fJornada}
          onChange={setFJornada}
          placeholder="Todas as Jornadas"
          options={JORNADAS_CLIENTE.map((j) => ({ value: j, label: jornadaClienteLabel[j] }))}
        />
        {podeVerArquivados && (
          <button
            type="button"
            onClick={() => setMostrarArquivados((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors',
              mostrarArquivados
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                : 'border-border bg-bg-soft text-muted hover:border-amber-500/40 hover:text-amber-200',
            )}
          >
            {mostrarArquivados ? 'Voltar pra ativos' : 'Ver arquivados'}
          </button>
        )}
      </div>

      {/* Search row */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full rounded-lg border border-border bg-bg-soft/40 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabela — 'todos' usa colunas essenciais; 'trafego' a visão rica */}
      {setor === 'todos' ? (
        <TabelaTodos
          clientes={filtered}
          loading={loading}
          onEditar={(c) => {
            setEditing(c)
            setFormOpen(true)
          }}
        />
      ) : (
        <TabelaTrafego
          clientes={filtered}
          loading={loading}
          onEditar={(c) => {
            setEditing(c)
            setFormOpen(true)
          }}
        />
      )}
        </>
      )}

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

// ============================================================
// Componentes auxiliares
// ============================================================

/** Selos dos serviços que o cliente atende (Tráfego / Social). */
function ServicoBadges({ modulos }: { modulos: Cliente['modulos'] }) {
  const mods = modulos ?? ['trafego']
  return (
    <span className="inline-flex gap-1">
      {mods.includes('trafego') && (
        <span className="inline-flex items-center rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-200">
          Tráfego
        </span>
      )}
      {mods.includes('social_media') && (
        <span className="inline-flex items-center rounded border border-pink-500/40 bg-pink-500/10 px-1.5 py-0.5 text-[9px] font-medium text-pink-200">
          Social
        </span>
      )}
    </span>
  )
}

/** Tabela rica do setor Tráfego (Ticket/LT/NPS/Semáforo). */
function TabelaTrafego({
  clientes,
  loading,
  onEditar,
}: {
  clientes: Cliente[]
  loading: boolean
  onEditar: (c: Cliente) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-3 py-3 font-semibold">Squad</th>
              <th className="px-3 py-3 font-semibold">Account Manager</th>
              <th className="px-3 py-3 font-semibold">Social Media</th>
              <th className="px-3 py-3 font-semibold text-right">Ticket Mensal</th>
              <th className="px-3 py-3 font-semibold text-right">LT</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Jornada</th>
              <th className="px-3 py-3 font-semibold text-right">NPS</th>
              <th className="px-3 py-3 font-semibold">Semáforo</th>
              <th className="px-3 py-3 font-semibold">Última Atualização</th>
              <th className="px-3 py-3 text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-xs text-muted">
                  Carregando…
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-xs text-muted italic">
                  Nenhum cliente encontrado com esses filtros.
                </td>
              </tr>
            ) : (
              clientes.map((c) => <ClienteRow key={c.id} cliente={c} onEditar={() => onEditar(c)} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Tabela enxuta do segmento "Todos" — colunas essenciais + selos de serviço. */
function TabelaTodos({
  clientes,
  loading,
  onEditar,
}: {
  clientes: Cliente[]
  loading: boolean
  onEditar: (c: Cliente) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-3 py-3 font-semibold">Serviços</th>
              <th className="px-3 py-3 font-semibold">Squad</th>
              <th className="px-3 py-3 font-semibold">Account Manager</th>
              <th className="px-3 py-3 font-semibold text-right">Ticket Mensal</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Última Atualização</th>
              <th className="px-3 py-3 text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-xs text-muted">
                  Carregando…
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-xs text-muted italic">
                  Nenhum cliente encontrado com esses filtros.
                </td>
              </tr>
            ) : (
              clientes.map((c) => <ClienteRowTodos key={c.id} cliente={c} onEditar={() => onEditar(c)} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Linha enxuta do segmento "Todos". */
function ClienteRowTodos({ cliente: c, onEditar }: { cliente: Cliente; onEditar: () => void }) {
  const situacao = situacaoCliente(c)
  return (
    <tr className="border-b border-border/60 last:border-b-0 hover:bg-bg-soft/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <AvatarInicial nome={c.nome} cor="brand" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                to={`/clientes/${c.id}`}
                className="text-xs font-semibold text-zinc-100 hover:text-brand-300 truncate"
              >
                {c.nome}
              </Link>
              {c.tipo && (
                <span className="inline-flex items-center rounded border border-border bg-bg-elev px-1.5 py-0.5 text-[9px] font-medium text-zinc-300">
                  {tipoClienteLabel[c.tipo]}
                </span>
              )}
            </div>
            {c.nicho && <p className="text-[10px] text-muted truncate">{c.nicho}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <ServicoBadges modulos={c.modulos} />
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-zinc-200">{c.squad ?? '—'}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        {c.account_manager?.nome ? (
          <div className="flex items-center gap-1.5">
            <AvatarInicial nome={c.account_manager.nome} cor="violet" size="xs" />
            <span className="text-zinc-200">{c.account_manager.nome}</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-right font-semibold tabular-nums text-emerald-300">
        {formatCurrency(c.verba_mensal ?? 0)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium',
            situacao.cls,
          )}
        >
          {situacao.label}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-[10px] text-muted tabular-nums">
        {formatDate(c.updated_at)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-right">
        <div className="inline-flex gap-0.5">
          <button
            onClick={onEditar}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
            title="Editar"
          >
            <Pencil size={12} />
          </button>
          <Link
            to={`/clientes/${c.id}`}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
            title="Abrir Ficha"
          >
            <Eye size={12} />
          </Link>
        </div>
      </td>
    </tr>
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

/** Chip select ClickUp-like — usa <select> nativo estilizado com
 *  chevron custom via SVG data-uri. */
function ChipSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none rounded-md border border-border bg-bg-soft pl-3 pr-8 py-1.5 text-[11px] font-medium text-zinc-100 hover:border-brand-500/40 focus:border-brand-500/60 focus:outline-none transition-colors"
      style={{
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 16 16\' fill=\'none\'%3E%3Cpath d=\'M4 6l4 4 4-4\' stroke=\'%23a1a1aa\' stroke-width=\'1.5\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Situação do cliente pro chip da coluna STATUS. Cliente em onboarding
 * ganha destaque azul (fase de entrada); fora disso, mapeia o status:
 * estável (verde), atenção (amarelo), pausado (cinza), churn (vermelho).
 */
function situacaoCliente(c: Cliente): { label: string; cls: string } {
  if (c.jornada === 'onboarding') {
    return { label: 'Onboarding', cls: 'border-sky-500/50 bg-sky-500/15 text-sky-200' }
  }
  const map: Record<Cliente['status'], { label: string; cls: string }> = {
    ativo: { label: 'Estável', cls: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' },
    atencao: { label: 'Atenção', cls: 'border-amber-500/50 bg-amber-500/15 text-amber-200' },
    pausado: { label: 'Pausado', cls: 'border-zinc-500/50 bg-zinc-500/15 text-zinc-200' },
    churn: { label: 'Churn', cls: 'border-red-500/50 bg-red-500/15 text-red-200' },
  }
  return map[c.status]
}

/** Avatar circular com iniciais — usado no cliente e no AM/Social. */
function AvatarInicial({
  nome,
  cor = 'brand',
  size = 'sm',
}: {
  nome: string | null | undefined
  cor?: 'brand' | 'zinc' | 'emerald' | 'violet' | 'pink'
  size?: 'sm' | 'xs'
}) {
  if (!nome) return <span className="text-muted">—</span>
  const inic = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  const corCls = {
    brand: 'bg-brand-500/15 border-brand-500/40 text-brand-300',
    zinc: 'bg-zinc-500/15 border-zinc-500/40 text-zinc-300',
    emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    violet: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
    pink: 'bg-pink-500/15 border-pink-500/40 text-pink-300',
  }[cor]
  const sizeCls = size === 'xs' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-semibold tabular-nums',
        corCls,
        sizeCls,
      )}
      title={nome}
    >
      {inic}
    </span>
  )
}

/** Linha da tabela — extraída pra manter o map limpo. */
function ClienteRow({
  cliente: c,
  onEditar,
}: {
  cliente: Cliente
  onEditar: () => void
}) {
  const lt = mesesCasa(c.data_inicio)
  const situacao = situacaoCliente(c)
  const semaforoCor = {
    verde: 'bg-emerald-400',
    amarelo: 'bg-amber-400',
    laranja: 'bg-orange-400',
    vermelho: 'bg-red-400',
  }[c.semaforo ?? 'verde']
  const semaforoLabel = {
    verde: 'Estável',
    amarelo: 'Atenção',
    laranja: 'Risco',
    vermelho: 'Crítico',
  }[c.semaforo ?? 'verde']

  return (
    <tr className="border-b border-border/60 last:border-b-0 hover:bg-bg-soft/40 transition-colors">
      {/* Cliente */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <AvatarInicial nome={c.nome} cor="brand" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                to={`/clientes/${c.id}`}
                className="text-xs font-semibold text-zinc-100 hover:text-brand-300 truncate"
              >
                {c.nome}
              </Link>
              {c.tipo && (
                <span className="inline-flex items-center rounded border border-border bg-bg-elev px-1.5 py-0.5 text-[9px] font-medium text-zinc-300">
                  {tipoClienteLabel[c.tipo]}
                </span>
              )}
            </div>
            {c.nicho && <p className="text-[10px] text-muted truncate">{c.nicho}</p>}
          </div>
        </div>
      </td>

      {/* Squad */}
      <td className="px-3 py-3 whitespace-nowrap text-zinc-200">{c.squad ?? '—'}</td>

      {/* AM */}
      <td className="px-3 py-3 whitespace-nowrap">
        {c.account_manager?.nome ? (
          <div className="flex items-center gap-1.5">
            <AvatarInicial nome={c.account_manager.nome} cor="violet" size="xs" />
            <span className="text-zinc-200">{c.account_manager.nome}</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>

      {/* Social Media */}
      <td className="px-3 py-3 whitespace-nowrap">
        {c.social_media?.nome ? (
          <div className="flex items-center gap-1.5">
            <AvatarInicial nome={c.social_media.nome} cor="pink" size="xs" />
            <span className="text-zinc-200">{c.social_media.nome}</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>

      {/* Ticket Mensal */}
      <td className="px-3 py-3 whitespace-nowrap text-right font-semibold tabular-nums text-emerald-300">
        {formatCurrency(c.verba_mensal ?? 0)}
      </td>

      {/* LT — lifetime months */}
      <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-zinc-200">
        {lt}m
      </td>

      {/* Status — situação (Onboarding azul / Estável verde / Atenção amarelo) */}
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium',
            situacao.cls,
          )}
        >
          {situacao.label}
        </span>
      </td>

      {/* Jornada */}
      <td className="px-3 py-3 whitespace-nowrap text-zinc-200">
        {c.jornada ? jornadaClienteLabel[c.jornada] : '—'}
      </td>

      {/* NPS */}
      <td className="px-3 py-3 whitespace-nowrap text-right">
        {typeof c.nps === 'number' ? (
          <span
            className={cn(
              'font-semibold tabular-nums',
              c.nps >= 9 ? 'text-emerald-300' : c.nps >= 7 ? 'text-amber-300' : 'text-red-300',
            )}
          >
            {c.nps}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>

      {/* Semáforo — dot só */}
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={cn('inline-block h-2 w-2 rounded-full', semaforoCor)}
          title={semaforoLabel}
        />
      </td>

      {/* Última atualização */}
      <td className="px-3 py-3 whitespace-nowrap text-[10px] text-muted tabular-nums">
        {formatDate(c.updated_at)}
      </td>

      {/* Ações — hover only */}
      <td className="px-3 py-3 whitespace-nowrap text-right">
        <div className="inline-flex gap-0.5">
          <button
            onClick={onEditar}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
            title="Editar"
          >
            <Pencil size={12} />
          </button>
          <Link
            to={`/clientes/${c.id}`}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
            title="Abrir Ficha"
          >
            <Eye size={12} />
          </Link>
        </div>
      </td>
    </tr>
  )
}

