import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  CircleDollarSign,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
  Palette,
  LayoutGrid,
  Film,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { AtivoHealth } from '@/components/clientes/AtivoHealth'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, isOverdue, relativeDueLabel, rotaCliente } from '@/lib/utils'
import { formatDateBR } from '@/lib/dates'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Ativo,
  Cliente,
  CriativoWebdesign,
  ItemSocialMedia,
  Profile,
  ProjetoWebdesign,
  Tarefa,
} from '@/types/database'

interface ClienteAtencao extends Cliente {
  ativosProblema: number
  tarefasAtrasadas: number
  ativos: Ativo[]
}

/**
 * Define o "escopo" de dados que cada cargo enxerga no Dashboard.
 * - global: vê tudo (admin, diretoria, head)
 * - cliente: vê só clientes onde é responsável (gestor_trafego, account_manager)
 * - social: vê só clientes SM onde é responsável + KPIs específicos de posts
 * - designer: vê só projetos/criativos/items onde é responsável (sem cliente vinculado)
 */
type Escopo =
  | { tipo: 'global'; titulo: string }
  | {
      tipo: 'cliente'
      titulo: string
      field: 'gestor_id' | 'account_manager_id'
    }
  | { tipo: 'social'; titulo: string }
  | { tipo: 'designer'; titulo: string }

function detectarEscopo(profile: Profile | null): Escopo {
  if (!profile) return { tipo: 'global', titulo: 'Visão geral da operação' }
  if (profile.role === 'admin')
    return { tipo: 'global', titulo: 'Visão geral da operação · admin' }
  switch (profile.cargo) {
    case 'gestor_trafego':
      return { tipo: 'cliente', titulo: 'Sua carteira de tráfego', field: 'gestor_id' }
    case 'account_manager':
      return {
        tipo: 'cliente',
        titulo: 'Seus clientes',
        field: 'account_manager_id',
      }
    case 'social_media':
      return { tipo: 'social', titulo: 'Sua operação de Social Media' }
    case 'designer':
      return { tipo: 'designer', titulo: 'Seus projetos de design' }
    case 'diretoria':
    case 'head':
      return { tipo: 'global', titulo: 'Visão geral da operação' }
    default:
      return { tipo: 'global', titulo: 'Visão geral da operação' }
  }
}

export default function Dashboard() {
  const { profile } = useAuth()
  const escopo = useMemo(() => detectarEscopo(profile), [profile])

  return (
    <div>
      <PageHeader title="Dashboard" description={escopo.titulo} />
      {escopo.tipo === 'designer' ? (
        <DashboardDesigner profile={profile} />
      ) : escopo.tipo === 'social' ? (
        <DashboardSocialMedia profile={profile} />
      ) : (
        <DashboardCliente profile={profile} escopo={escopo} />
      )}
    </div>
  )
}

/* =========================================================
   Variante: Global / Cliente-based
   (admin, diretoria, head, gestor_trafego, account_manager)
   ========================================================= */

function DashboardCliente({
  profile,
  escopo,
}: {
  profile: Profile | null
  escopo: { tipo: 'global'; titulo: string } | { tipo: 'cliente'; titulo: string; field: 'gestor_id' | 'account_manager_id' }
}) {
  const [kpis, setKpis] = useState({ clientes: 0, verba: 0, atrasadas: 0, ativosProblema: 0 })
  const [minhasTarefas, setMinhasTarefas] = useState<Tarefa[]>([])
  const [atencao, setAtencao] = useState<ClienteAtencao[]>([])
  const [tabAtencao, setTabAtencao] = useState<'trafego' | 'social'>('trafego')
  const [loading, setLoading] = useState(true)

  const clienteFilterField = escopo.tipo === 'cliente' ? escopo.field : null
  const ehGlobal = escopo.tipo === 'global'

  async function load() {
    if (!profile) return
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    // Constrói query base de clientes ativos (com escopo)
    let clientesAtivosQ = supabase
      .from('clientes')
      .select('id, nome, status, gestor_id, account_manager_id, social_media_id, verba_mensal, verba_google, verba_meta, modulos')
      .eq('status', 'ativo')
    if (clienteFilterField) {
      clientesAtivosQ = clientesAtivosQ.eq(clienteFilterField, profile.id)
    }

    // Tarefas atrasadas: globais (admin) ou minhas (gestor/AM)
    let tarefasAtrasadasQ = supabase
      .from('tarefas')
      .select('id', { count: 'exact', head: true })
      .lt('data_vencimento', today)
      .neq('status', 'concluida')
    if (!ehGlobal) tarefasAtrasadasQ = tarefasAtrasadasQ.eq('responsavel_id', profile.id)

    // Tarefas atrasadas com cliente_id (pra atencao por cliente)
    let tarefasAtrasadasComClienteQ = supabase
      .from('tarefas')
      .select('cliente_id')
      .lt('data_vencimento', today)
      .neq('status', 'concluida')
    if (!ehGlobal) tarefasAtrasadasComClienteQ = tarefasAtrasadasComClienteQ.eq('responsavel_id', profile.id)

    const [
      clientesRes,
      tarefasAtrasadasRes,
      minhasRes,
      todosClientesRes,
      todosAtivosRes,
      tarefasAtrasadasComClienteRes,
    ] = await Promise.all([
      clientesAtivosQ,
      tarefasAtrasadasQ,
      // "Minhas tarefas de hoje" — sempre filtra por mim (faz sentido pra todos cargos)
      supabase
        .from('tarefas')
        .select('*, cliente:clientes(*), responsavel:profiles(*)')
        .eq('responsavel_id', profile.id)
        .eq('data_vencimento', today)
        .neq('status', 'concluida')
        .order('prioridade', { ascending: false }),
      // Lista de todos clientes (pra calcular atenção) — também respeita escopo
      (() => {
        let q = supabase.from('clientes').select('*').eq('status', 'ativo').order('nome')
        if (clienteFilterField) q = q.eq(clienteFilterField, profile.id)
        return q
      })(),
      supabase.from('ativos').select('*'),
      tarefasAtrasadasComClienteQ,
    ])

    const clientesData = (clientesRes.data ?? []) as Cliente[]
    const verba = clientesData.reduce(
      (s, c) => s + ((c.verba_google ?? 0) + (c.verba_meta ?? 0) || (c.verba_mensal ?? 0)),
      0,
    )

    const todosClientes = (todosClientesRes.data as Cliente[]) ?? []
    const clienteIdsDoEscopo = new Set(todosClientes.map((c) => c.id))
    const ativos = (todosAtivosRes.data as Ativo[]) ?? []
    // Filtra ativos com problema só dos clientes do escopo
    const ativosProblema = ehGlobal
      ? ativos.filter((a) => a.status === 'com_problema').length
      : ativos.filter((a) => a.status === 'com_problema' && clienteIdsDoEscopo.has(a.cliente_id)).length

    // Clientes de Trafego em onboarding — suas tarefas atrasadas nao contam
    // no KPI (fase de estabilizacao). Social Media nao tem essa regra.
    const trafegoOnboardingIds = new Set(
      todosClientes
        .filter(
          (c) =>
            (c.modulos ?? ['trafego']).includes('trafego') &&
            c.jornada === 'onboarding',
        )
        .map((c) => c.id),
    )
    const atrasadasComCliente =
      (tarefasAtrasadasComClienteRes.data as { cliente_id: string | null }[]) ?? []
    const atrasadasOnboardingTrafego = atrasadasComCliente.filter(
      (t) => t.cliente_id && trafegoOnboardingIds.has(t.cliente_id),
    ).length
    const atrasadasAjustadas = Math.max(
      0,
      (tarefasAtrasadasRes.count ?? 0) - atrasadasOnboardingTrafego,
    )

    setKpis({
      clientes: clientesData.length,
      verba,
      atrasadas: atrasadasAjustadas,
      ativosProblema,
    })
    setMinhasTarefas((minhasRes.data as Tarefa[]) ?? [])

    const atrasadasPorCliente = new Map<string, number>()
    for (const t of atrasadasComCliente) {
      if (!t.cliente_id) continue
      atrasadasPorCliente.set(t.cliente_id, (atrasadasPorCliente.get(t.cliente_id) ?? 0) + 1)
    }

    const lista: ClienteAtencao[] = todosClientes.map((c) => {
      const clienteAtivos = ativos.filter((a) => a.cliente_id === c.id)
      return {
        ...c,
        ativos: clienteAtivos,
        ativosProblema: clienteAtivos.filter((a) => a.status === 'com_problema').length,
        tarefasAtrasadas: atrasadasPorCliente.get(c.id) ?? 0,
      }
    })
    // Lista bruta (sem slice) — vai ser dividida por modulo na render
    setAtencao(
      lista
        .filter((c) => c.ativosProblema > 0 || c.tarefasAtrasadas > 0)
        .sort((a, b) => b.tarefasAtrasadas + b.ativosProblema - (a.tarefasAtrasadas + a.ativosProblema)),
    )
    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, escopo.tipo, clienteFilterField])

  const labelClientes = ehGlobal ? 'Clientes ativos' : 'Meus clientes ativos'
  const labelVerba = ehGlobal ? 'Verba sob gestão' : 'Verba sob gestão (meus)'
  const labelAtrasadas = ehGlobal ? 'Tarefas atrasadas' : 'Minhas tarefas atrasadas'
  const labelAtivos = ehGlobal ? 'Ativos com problema' : 'Ativos problema (meus)'

  // Divide atencao por modulo (legado sem modulos = trafego).
  // Trafego: clientes em jornada onboarding nao contam (fase de estabilizacao).
  const atencaoTrafego = useMemo(
    () =>
      atencao
        .filter((c) => (c.modulos ?? ['trafego']).includes('trafego'))
        .filter((c) => c.jornada !== 'onboarding')
        .slice(0, 8),
    [atencao],
  )
  const atencaoSocial = useMemo(
    () => atencao.filter((c) => (c.modulos ?? []).includes('social_media')).slice(0, 8),
    [atencao],
  )
  const listaVisivel = tabAtencao === 'trafego' ? atencaoTrafego : atencaoSocial

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Users size={16} />} label={labelClientes} value={kpis.clientes.toString()} />
        <Kpi
          icon={<CircleDollarSign size={16} />}
          label={labelVerba}
          value={formatCurrency(kpis.verba)}
          tone="success"
        />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label={labelAtrasadas}
          value={kpis.atrasadas.toString()}
          tone={kpis.atrasadas > 0 ? 'danger' : 'neutral'}
        />
        <Kpi
          icon={<ShieldAlert size={16} />}
          label={labelAtivos}
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

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {ehGlobal ? 'Clientes que precisam de atenção' : 'Meus clientes que precisam de atenção'}
              </CardTitle>
              <div className="inline-flex rounded-md border border-border bg-bg-soft p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTabAtencao('trafego')}
                  className={cn(
                    'rounded px-2.5 py-1 transition-colors',
                    tabAtencao === 'trafego'
                      ? 'bg-brand-500/20 text-brand-200'
                      : 'text-muted hover:text-zinc-200',
                  )}
                >
                  Tráfego
                  {atencaoTrafego.length > 0 && (
                    <span className="ml-1.5 rounded bg-bg-elev px-1 py-0.5 text-[10px] text-zinc-300">
                      {atencaoTrafego.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTabAtencao('social')}
                  className={cn(
                    'rounded px-2.5 py-1 transition-colors',
                    tabAtencao === 'social'
                      ? 'bg-brand-500/20 text-brand-200'
                      : 'text-muted hover:text-zinc-200',
                  )}
                >
                  Social Media
                  {atencaoSocial.length > 0 && (
                    <span className="ml-1.5 rounded bg-bg-elev px-1 py-0.5 text-[10px] text-zinc-300">
                      {atencaoSocial.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : listaVisivel.length === 0 ? (
              <EmptyState
                title="Tudo em dia"
                description={
                  tabAtencao === 'trafego'
                    ? 'Nenhum cliente de Tráfego com alerta.'
                    : 'Nenhum cliente de Social Media com alerta.'
                }
              />
            ) : (
              listaVisivel.map((c) => (
                <Link
                  key={c.id}
                  to={rotaCliente(c)}
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
    </>
  )
}

/* =========================================================
   Variante: Social Media
   ========================================================= */

function DashboardSocialMedia({ profile }: { profile: Profile | null }) {
  const [kpis, setKpis] = useState({
    clientes: 0,
    postagensMes: 0,
    atrasados: 0,
    setupIncompleto: 0,
  })
  const [proximos, setProximos] = useState<(ItemSocialMedia & { cliente_nome?: string })[]>([])
  const [clientesAtencao, setClientesAtencao] = useState<
    Array<{ id: string; nome: string; postagensAtrasadas: number; setupOk: boolean }>
  >([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!profile) return
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = `${today.slice(0, 7)}-01`
    const monthEnd = `${today.slice(0, 7)}-31`
    const seteDias = new Date()
    seteDias.setDate(seteDias.getDate() + 7)
    const seteDiasStr = seteDias.toISOString().slice(0, 10)

    // Meus clientes SM (com social_media_id = me)
    const { data: meusClientes } = await supabase
      .from('clientes')
      .select('id, nome')
      .contains('modulos', ['social_media'])
      .eq('social_media_id', profile.id)
      .eq('status', 'ativo')
    const meusClientesArr = (meusClientes as Array<{ id: string; nome: string }>) ?? []
    const meusIds = meusClientesArr.map((c) => c.id)
    const nomesPorId = new Map(meusClientesArr.map((c) => [c.id, c.nome]))

    if (meusIds.length === 0) {
      setKpis({ clientes: 0, postagensMes: 0, atrasados: 0, setupIncompleto: 0 })
      setProximos([])
      setClientesAtencao([])
      setLoading(false)
      return
    }

    const [planosRes, setupRes] = await Promise.all([
      supabase.from('producoes_social_media').select('id, cliente_id').in('cliente_id', meusIds),
      supabase
        .from('cliente_perfil_setup')
        .select('cliente_id, foto_status, bio_status, destaques_status, contato_status')
        .in('cliente_id', meusIds),
    ])
    const planos = (planosRes.data as Array<{ id: string; cliente_id: string }>) ?? []
    const planoIdToCliente = new Map(planos.map((p) => [p.id, p.cliente_id]))
    const planoIds = planos.map((p) => p.id)

    let itemsDoMes: ItemSocialMedia[] = []
    let proximosArr: ItemSocialMedia[] = []
    if (planoIds.length > 0) {
      const { data: items } = await supabase
        .from('producoes_social_media_items')
        .select('*')
        .in('producao_id', planoIds)
      const itemsArr = (items as ItemSocialMedia[]) ?? []
      itemsDoMes = itemsArr.filter(
        (i) => i.prazo && i.prazo.slice(0, 10) >= monthStart && i.prazo.slice(0, 10) <= monthEnd,
      )
      proximosArr = itemsArr
        .filter(
          (i) =>
            i.prazo &&
            i.prazo.slice(0, 10) >= today &&
            i.prazo.slice(0, 10) <= seteDiasStr &&
            i.status !== 'conclusao',
        )
        .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))
        .slice(0, 8)
    }

    const atrasados = itemsDoMes.filter(
      (i) => i.status !== 'conclusao' && i.prazo && i.prazo.slice(0, 10) < today,
    )

    const setups = (setupRes.data as Array<{
      cliente_id: string
      foto_status: string
      bio_status: string
      destaques_status: string
      contato_status: string
    }>) ?? []
    const setupOkPorCliente = new Map(
      setups.map((s) => [
        s.cliente_id,
        s.foto_status === 'ok' && s.bio_status === 'ok' && s.destaques_status === 'ok' && s.contato_status === 'ok',
      ]),
    )
    const setupIncompleto = meusIds.filter((id) => !(setupOkPorCliente.get(id) ?? false)).length

    setKpis({
      clientes: meusIds.length,
      postagensMes: itemsDoMes.length,
      atrasados: atrasados.length,
      setupIncompleto,
    })
    setProximos(
      proximosArr.map((p) => {
        const cliId = planoIdToCliente.get(p.producao_id)
        return { ...p, cliente_nome: cliId ? nomesPorId.get(cliId) : undefined }
      }),
    )

    // Atenção: clientes com posts atrasados OU setup incompleto
    const atrasadasPorCliente = new Map<string, number>()
    for (const a of atrasados) {
      const cliId = planoIdToCliente.get(a.producao_id)
      if (cliId) atrasadasPorCliente.set(cliId, (atrasadasPorCliente.get(cliId) ?? 0) + 1)
    }
    const atencao = meusClientesArr
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        postagensAtrasadas: atrasadasPorCliente.get(c.id) ?? 0,
        setupOk: setupOkPorCliente.get(c.id) ?? false,
      }))
      .filter((c) => c.postagensAtrasadas > 0 || !c.setupOk)
      .sort((a, b) => b.postagensAtrasadas - a.postagensAtrasadas)
      .slice(0, 8)
    setClientesAtencao(atencao)
    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Users size={16} />} label="Meus clientes SM" value={kpis.clientes.toString()} />
        <Kpi
          icon={<ImageIcon size={16} />}
          label="Posts do mês"
          value={kpis.postagensMes.toString()}
          tone="success"
        />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Posts atrasados"
          value={kpis.atrasados.toString()}
          tone={kpis.atrasados > 0 ? 'danger' : 'neutral'}
        />
        <Kpi
          icon={<Sparkles size={16} />}
          label="Setup incompleto"
          value={kpis.setupIncompleto.toString()}
          tone={kpis.setupIncompleto > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximos 7 dias</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : proximos.length === 0 ? (
              <EmptyState title="Nada programado" description="Sem posts nos próximos 7 dias." />
            ) : (
              proximos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-soft px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{p.titulo}</p>
                    <p className="text-xs text-muted">
                      {p.cliente_nome} · {p.formato}
                    </p>
                  </div>
                  <Badge tone={isOverdue(p.prazo ?? '') ? 'danger' : 'brand'}>
                    {relativeDueLabel(p.prazo)}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meus clientes que precisam de atenção</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : clientesAtencao.length === 0 ? (
              <EmptyState title="Tudo em dia" description="Posts no prazo e perfis OK." />
            ) : (
              clientesAtencao.map((c) => (
                <Link
                  key={c.id}
                  to={`/social/clientes/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-soft px-3 py-2 hover:bg-bg-elev"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={c.nome} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{c.nome}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.postagensAtrasadas > 0 && (
                          <Badge tone="danger">
                            {c.postagensAtrasadas} post{c.postagensAtrasadas > 1 ? 's' : ''} atrasado
                            {c.postagensAtrasadas > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {!c.setupOk && <Badge tone="warning">setup incompleto</Badge>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

/* =========================================================
   Variante: Designer
   ========================================================= */

function DashboardDesigner({ profile }: { profile: Profile | null }) {
  const [kpis, setKpis] = useState({
    projetos: 0,
    criativos: 0,
    itensSm: 0,
    tarefasAtrasadas: 0,
  })
  const [meusItens, setMeusItens] = useState<{
    projetos: ProjetoWebdesign[]
    criativos: CriativoWebdesign[]
    items: ItemSocialMedia[]
  }>({ projetos: [], criativos: [], items: [] })
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!profile) return
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    const [projRes, criRes, itemsRes, tarefasRes] = await Promise.all([
      supabase
        .from('projetos_webdesign')
        .select('*, cliente:clientes(*)')
        .eq('responsavel_id', profile.id)
        .neq('status', 'conclusao')
        .order('prazo', { ascending: true }),
      supabase
        .from('criativos_webdesign')
        .select('*, cliente:clientes(*)')
        .eq('responsavel_id', profile.id)
        .neq('status', 'conclusao')
        .order('prazo', { ascending: true }),
      supabase
        .from('producoes_social_media_items')
        .select('*')
        .eq('responsavel_id', profile.id)
        .neq('status', 'conclusao')
        .order('prazo', { ascending: true }),
      supabase
        .from('tarefas')
        .select('id', { count: 'exact', head: true })
        .eq('responsavel_id', profile.id)
        .lt('data_vencimento', today)
        .neq('status', 'concluida'),
    ])

    const projetos = (projRes.data as ProjetoWebdesign[]) ?? []
    const criativos = (criRes.data as CriativoWebdesign[]) ?? []
    const items = (itemsRes.data as ItemSocialMedia[]) ?? []

    setKpis({
      projetos: projetos.length,
      criativos: criativos.length,
      itensSm: items.length,
      tarefasAtrasadas: tarefasRes.count ?? 0,
    })
    setMeusItens({ projetos, criativos, items })
    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Junta projetos+criativos+items em uma lista de "trabalhos abertos" ordenada por prazo
  const trabalhos = useMemo(() => {
    type Trabalho = {
      id: string
      tipo: 'projeto' | 'criativo' | 'item'
      titulo: string
      contexto: string
      prazo: string | null
      status: string
      url: string
    }
    const out: Trabalho[] = []
    for (const p of meusItens.projetos) {
      out.push({
        id: p.id,
        tipo: 'projeto',
        titulo: p.titulo ?? 'Projeto sem título',
        contexto: p.cliente?.nome ?? '—',
        prazo: p.prazo,
        status: p.status,
        url: `/webdesign/projetos`,
      })
    }
    for (const c of meusItens.criativos) {
      out.push({
        id: c.id,
        tipo: 'criativo',
        titulo: c.titulo ?? 'Criativo sem título',
        contexto: c.cliente?.nome ?? '—',
        prazo: c.prazo,
        status: c.status,
        url: `/webdesign/criativos`,
      })
    }
    for (const i of meusItens.items) {
      out.push({
        id: i.id,
        tipo: 'item',
        titulo: i.titulo,
        contexto: `${i.formato}`,
        prazo: i.prazo,
        status: i.status,
        url: `/webdesign/social-media`,
      })
    }
    return out
      .sort((a, b) => (a.prazo ?? '9').localeCompare(b.prazo ?? '9'))
      .slice(0, 10)
  }, [meusItens])

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<LayoutGrid size={16} />}
          label="Projetos abertos"
          value={kpis.projetos.toString()}
        />
        <Kpi
          icon={<Palette size={16} />}
          label="Criativos em andamento"
          value={kpis.criativos.toString()}
          tone="success"
        />
        <Kpi icon={<Film size={16} />} label="Posts atribuídos" value={kpis.itensSm.toString()} />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Tarefas atrasadas"
          value={kpis.tarefasAtrasadas.toString()}
          tone={kpis.tarefasAtrasadas > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Meus trabalhos abertos</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : trabalhos.length === 0 ? (
              <EmptyState title="Nada na fila" description="Nenhum trabalho atribuído a você." />
            ) : (
              trabalhos.map((t) => (
                <Link
                  key={`${t.tipo}-${t.id}`}
                  to={t.url}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-soft px-3 py-2 hover:bg-bg-elev"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {t.tipo === 'projeto' && <LayoutGrid size={14} className="text-amber-300" />}
                    {t.tipo === 'criativo' && <Palette size={14} className="text-pink-300" />}
                    {t.tipo === 'item' && <Film size={14} className="text-violet-300" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.titulo}</p>
                      <p className="text-xs text-muted">{t.contexto}</p>
                    </div>
                  </div>
                  <Badge tone={t.prazo && isOverdue(t.prazo) ? 'danger' : 'brand'}>
                    {t.prazo ? relativeDueLabel(t.prazo) : 'sem prazo'}
                  </Badge>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos prazos</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : trabalhos.filter((t) => t.prazo).length === 0 ? (
              <EmptyState title="Sem prazos" description="Nenhum trabalho com data definida." />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trabalhos
                  .filter((t) => t.prazo)
                  .slice(0, 6)
                  .map((t) => (
                    <div
                      key={`pr-${t.tipo}-${t.id}`}
                      className="rounded-lg border border-border bg-bg-soft p-2 text-center"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        {t.tipo}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatDateBR(t.prazo)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10px] text-muted">{t.titulo}</p>
                    </div>
                  ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

/* =========================================================
   Sub-componente: Kpi card
   ========================================================= */

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

// CheckCircle2 import retained even if unused, in case future variants use it
void CheckCircle2
