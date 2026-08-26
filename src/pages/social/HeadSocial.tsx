/**
 * Painel do Head · Social Media
 * -----------------------------
 * Central de acao pro coordenador. 3 blocos focados em cobranca / envio /
 * relacionamento:
 *
 *   1. AGUARDANDO APROVACAO
 *      Items em status='em_aprovacao'. Ordenados por dias aguardando
 *      (mais antigos primeiro = mais urgentes). Serve pra cobrar cliente.
 *
 *   2. PRONTAS PRA PUBLICAR / ENVIAR
 *      Items com arte pronta (design_finalizado ou conclusao) e prazo
 *      futuro que ainda nao foram publicados. Serve pra enviar/agendar.
 *
 *   3. RELACIONAMENTO
 *      Alertas: clientes com call vencida, muitos posts atrasados no mes,
 *      setup incompleto. Serve pra planejar contato ativo.
 *
 * Filtro opcional no topo: por social media responsavel do cliente.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  Clock,
  Send,
  Users,
  Calendar as CalendarIcon,
  PhoneCall,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatDateBR, parseLocalDate } from '@/lib/dates'
import type {
  Cliente,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
  Profile,
  ClientePerfilSetup,
} from '@/types/database'

interface ClienteLite {
  id: string
  nome: string
  status: string
  social_media_id: string | null
  social_media?: Profile | null
  proxima_call_alinhamento: string | null
  ultima_call_alinhamento: string | null
}

interface ItemComCliente extends ItemSocialMedia {
  cliente_id: string
  cliente_nome: string
}

export default function HeadSocial() {
  const [clientes, setClientes] = useState<ClienteLite[]>([])
  const [items, setItems] = useState<ItemComCliente[]>([])
  const [setups, setSetups] = useState<Map<string, ClientePerfilSetup>>(new Map())
  const [socialMedias, setSocialMedias] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroSM, setFiltroSM] = useState<string>('')

  async function load() {
    setLoading(true)

    const [cRes, pRes, iRes, sRes, smRes] = await Promise.all([
      supabase
        .from('clientes')
        .select(
          'id, nome, status, social_media_id, proxima_call_alinhamento, ultima_call_alinhamento, social_media:profiles!social_media_id(*)',
        )
        .contains('modulos', ['social_media'])
        .in('status', ['ativo', 'atencao'])
        .is('arquivado_em', null),
      supabase
        .from('producoes_social_media')
        .select('id, cliente_id'),
      supabase
        .from('producoes_social_media_items')
        .select('*'),
      supabase
        .from('cliente_perfil_setup')
        .select('*'),
      supabase
        .from('profiles')
        .select('*')
        .eq('ativo', true)
        .eq('aprovado', true)
        .or('cargo.eq.social_media,cargos_extras.cs.{social_media}')
        .order('nome'),
    ])

    const clientesArr = (cRes.data as ClienteLite[]) ?? []
    const planos = (pRes.data as PlanejamentoSocialMedia[]) ?? []
    const itemsRaw = (iRes.data as ItemSocialMedia[]) ?? []
    const setupsArr = (sRes.data as ClientePerfilSetup[]) ?? []
    const smArr = (smRes.data as Profile[]) ?? []

    // Mapa producao_id -> cliente_id/nome
    const planoIdToCliente = new Map<string, { id: string; nome: string }>()
    const clienteById = new Map(clientesArr.map((c) => [c.id, c]))
    for (const p of planos) {
      const c = clienteById.get(p.cliente_id)
      if (c) planoIdToCliente.set(p.id, { id: c.id, nome: c.nome })
    }

    // Enriquece items com cliente
    const itemsEnriched: ItemComCliente[] = itemsRaw
      .map((it) => {
        const c = planoIdToCliente.get(it.producao_id)
        if (!c) return null
        return { ...it, cliente_id: c.id, cliente_nome: c.nome }
      })
      .filter((x): x is ItemComCliente => x !== null)

    setClientes(clientesArr)
    setItems(itemsEnriched)
    setSetups(new Map(setupsArr.map((s) => [s.cliente_id, s])))
    setSocialMedias(smArr)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // ============ Filtro por social media responsavel ============
  const clientesFiltrados = useMemo(() => {
    if (!filtroSM) return clientes
    return clientes.filter((c) => c.social_media_id === filtroSM)
  }, [clientes, filtroSM])

  const clienteIdsPermitidos = useMemo(
    () => new Set(clientesFiltrados.map((c) => c.id)),
    [clientesFiltrados],
  )

  const itemsFiltrados = useMemo(
    () => items.filter((it) => clienteIdsPermitidos.has(it.cliente_id)),
    [items, clienteIdsPermitidos],
  )

  // ============ 1) Aguardando aprovacao ============
  const aguardandoAprovacao = useMemo(() => {
    return itemsFiltrados
      .filter((it) => it.status === 'em_aprovacao')
      .map((it) => {
        // Dias em em_aprovacao — usamos updated_at como proxy (data em que
        // status mudou pra em_aprovacao, assumindo que a mudanca foi
        // proxima da ultima atualizacao).
        const ms = new Date(it.updated_at).getTime()
        const dias = Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)))
        return { it, dias }
      })
      .sort((a, b) => b.dias - a.dias)
  }, [itemsFiltrados])

  // ============ 2) Prontas pra publicar/enviar ============
  const prontas = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    return itemsFiltrados
      .filter(
        (it) =>
          (it.status === 'design_finalizado' || it.status === 'conclusao') &&
          !it.publicado_em &&
          it.prazo &&
          it.prazo.slice(0, 10) >= todayStr,
      )
      .map((it) => {
        const prazoDate = parseLocalDate(it.prazo ?? '')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diasAteAr = prazoDate
          ? Math.floor((prazoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null
        return { it, diasAteAr }
      })
      .sort((a, b) => (a.diasAteAr ?? 999) - (b.diasAteAr ?? 999))
  }, [itemsFiltrados])

  // ============ 3) Relacionamento ============
  const relacionamento = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const mesCorrente = hoje.slice(0, 7)

    // Call vencida ou sem agenda
    const callAtrasada = clientesFiltrados
      .map((c) => {
        const proxima = c.proxima_call_alinhamento
        if (!proxima) return { cliente: c, tipo: 'sem_agenda' as const, dias: null as number | null }
        if (proxima < hoje) {
          const ms = new Date(proxima + 'T12:00:00').getTime()
          const dias = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24))
          return { cliente: c, tipo: 'vencida' as const, dias }
        }
        return null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1))

    // Clientes com muitos atrasados no mes corrente (2+)
    const atrasadosPorCliente = new Map<string, number>()
    for (const it of itemsFiltrados) {
      if (!it.prazo) continue
      if (it.prazo.slice(0, 7) !== mesCorrente) continue
      if (it.status === 'conclusao' && it.publicado_em) continue
      if (it.prazo.slice(0, 10) < hoje && !it.publicado_em) {
        atrasadosPorCliente.set(it.cliente_id, (atrasadosPorCliente.get(it.cliente_id) ?? 0) + 1)
      }
    }
    const muitosAtrasados = clientesFiltrados
      .map((c) => ({ cliente: c, count: atrasadosPorCliente.get(c.id) ?? 0 }))
      .filter((x) => x.count >= 2)
      .sort((a, b) => b.count - a.count)

    // Setup incompleto (algum dos 4 nao esta 'ok')
    const setupIncompleto = clientesFiltrados
      .map((c) => {
        const s = setups.get(c.id)
        if (!s) return { cliente: c, faltando: 4 } // sem setup nenhum
        const pendentes = [
          s.foto_status,
          s.bio_status,
          s.destaques_status,
          s.contato_status,
        ].filter((v) => v !== 'ok').length
        return pendentes > 0 ? { cliente: c, faltando: pendentes } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.faltando - a.faltando)

    return { callAtrasada, muitosAtrasados, setupIncompleto }
  }, [clientesFiltrados, itemsFiltrados, setups])

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Painel do Head · Social Media"
          description="Cobrança, envio e relacionamento com o cliente"
        />
        <Card>
          <CardBody className="p-12 text-center text-sm text-muted">
            Carregando...
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Painel do Head · Social Media"
        description="Cobrança, envio e relacionamento com o cliente"
        actions={
          <Select
            value={filtroSM}
            onChange={(e) => setFiltroSM(e.target.value)}
            className="min-w-[200px]"
          >
            <option value="">Todos social media</option>
            {socialMedias.map((sm) => (
              <option key={sm.id} value={sm.id}>
                {sm.nome}
              </option>
            ))}
          </Select>
        }
      />

      {/* KPIs no topo */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Kpi
          icon={<Clock size={18} />}
          label="Aguardando aprovação"
          value={aguardandoAprovacao.length.toString()}
          tone={aguardandoAprovacao.length > 0 ? 'warning' : 'muted'}
        />
        <Kpi
          icon={<Send size={18} />}
          label="Prontas pra publicar"
          value={prontas.length.toString()}
          tone={prontas.length > 0 ? 'brand' : 'muted'}
        />
        <Kpi
          icon={<PhoneCall size={18} />}
          label="Calls vencidas / sem agenda"
          value={relacionamento.callAtrasada.length.toString()}
          tone={relacionamento.callAtrasada.length > 0 ? 'danger' : 'muted'}
        />
        <Kpi
          icon={<Users size={18} />}
          label="Clientes acompanhados"
          value={clientesFiltrados.length.toString()}
          tone="muted"
        />
      </div>

      {/* 1) Aguardando aprovacao */}
      <SecaoCard
        icon={<Clock size={16} className="text-amber-300" />}
        titulo="Aguardando aprovação do cliente"
        subtitulo="Items em em_aprovacao — ordenados por dias esperando"
        count={aguardandoAprovacao.length}
        emptyMsg="Nenhum item aguardando aprovação agora."
      >
        {aguardandoAprovacao.map(({ it, dias }) => (
          <LinhaItem
            key={it.id}
            clienteId={it.cliente_id}
            clienteNome={it.cliente_nome}
            titulo={it.titulo}
            formato={it.formato}
            direita={
              <Badge tone={dias >= 5 ? 'danger' : dias >= 3 ? 'warning' : 'neutral'}>
                {dias === 0 ? 'hoje' : `${dias}d aguardando`}
              </Badge>
            }
          />
        ))}
      </SecaoCard>

      {/* 2) Prontas pra publicar */}
      <SecaoCard
        icon={<Send size={16} className="text-brand-300" />}
        titulo="Prontas pra publicar / enviar"
        subtitulo="Arte finalizada, prazo futuro, ainda não publicada"
        count={prontas.length}
        emptyMsg="Nenhuma arte pronta esperando publicação."
      >
        {prontas.map(({ it, diasAteAr }) => (
          <LinhaItem
            key={it.id}
            clienteId={it.cliente_id}
            clienteNome={it.cliente_nome}
            titulo={it.titulo}
            formato={it.formato}
            direita={
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted">
                  <CalendarIcon size={10} className="mr-1 inline" />
                  {it.prazo ? formatDateBR(it.prazo) : '—'}
                </span>
                <Badge
                  tone={
                    diasAteAr === null
                      ? 'neutral'
                      : diasAteAr <= 1
                        ? 'danger'
                        : diasAteAr <= 3
                          ? 'warning'
                          : 'brand'
                  }
                >
                  {diasAteAr === null
                    ? 'sem prazo'
                    : diasAteAr === 0
                      ? 'hoje'
                      : diasAteAr === 1
                        ? 'amanhã'
                        : `em ${diasAteAr}d`}
                </Badge>
              </div>
            }
          />
        ))}
      </SecaoCard>

      {/* 3) Relacionamento — 3 sub-cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SubSecaoCard
          icon={<PhoneCall size={14} className="text-red-300" />}
          titulo="Calls vencidas / sem agenda"
          count={relacionamento.callAtrasada.length}
          emptyMsg="Todas as calls em dia."
        >
          {relacionamento.callAtrasada.slice(0, 10).map(({ cliente, tipo, dias }) => (
            <LinhaCliente
              key={cliente.id}
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              direita={
                tipo === 'sem_agenda' ? (
                  <Badge tone="neutral" className="!text-[9px]">
                    sem agenda
                  </Badge>
                ) : (
                  <Badge tone="danger" className="!text-[9px]">
                    {dias}d atrasada
                  </Badge>
                )
              }
            />
          ))}
        </SubSecaoCard>

        <SubSecaoCard
          icon={<AlertCircle size={14} className="text-amber-300" />}
          titulo="Muitos posts atrasados no mês"
          count={relacionamento.muitosAtrasados.length}
          emptyMsg="Ninguém com backlog no mês."
        >
          {relacionamento.muitosAtrasados.slice(0, 10).map(({ cliente, count }) => (
            <LinhaCliente
              key={cliente.id}
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              direita={
                <Badge tone="warning" className="!text-[9px]">
                  {count} atrasados
                </Badge>
              }
            />
          ))}
        </SubSecaoCard>

        <SubSecaoCard
          icon={<Sparkles size={14} className="text-violet-300" />}
          titulo="Setup do perfil incompleto"
          count={relacionamento.setupIncompleto.length}
          emptyMsg="Todos setups completos."
        >
          {relacionamento.setupIncompleto.slice(0, 10).map(({ cliente, faltando }) => (
            <LinhaCliente
              key={cliente.id}
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              direita={
                <Badge tone="neutral" className="!text-[9px]">
                  {faltando}/4 faltam
                </Badge>
              }
            />
          ))}
        </SubSecaoCard>
      </div>
    </div>
  )
}

/* =========================================================
   Sub-componentes
   ========================================================= */

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'brand' | 'warning' | 'danger' | 'muted'
}) {
  const toneClass = {
    brand: 'border-brand-500/30 bg-brand-500/10 text-brand-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-red-500/30 bg-red-500/10 text-red-200',
    muted: 'border-border bg-bg-soft text-zinc-300',
  }[tone]
  return (
    <div className={cn('rounded-xl border p-3', toneClass)}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function SecaoCard({
  icon,
  titulo,
  subtitulo,
  count,
  emptyMsg,
  children,
}: {
  icon: React.ReactNode
  titulo: string
  subtitulo: string
  count: number
  emptyMsg: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-zinc-100">{titulo}</h3>
          <Badge tone={count > 0 ? 'brand' : 'neutral'}>{count}</Badge>
        </div>
        <p className="mt-0.5 text-[11px] text-muted">{subtitulo}</p>
      </div>
      <CardBody className="p-0">
        {count === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{emptyMsg}</p>
        ) : (
          <ul className="divide-y divide-border/60">{children}</ul>
        )}
      </CardBody>
    </Card>
  )
}

function SubSecaoCard({
  icon,
  titulo,
  count,
  emptyMsg,
  children,
}: {
  icon: React.ReactNode
  titulo: string
  count: number
  emptyMsg: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="flex-1 text-xs font-semibold text-zinc-100">{titulo}</h4>
          <Badge tone={count > 0 ? 'brand' : 'neutral'} className="!text-[9px]">
            {count}
          </Badge>
        </div>
      </div>
      <CardBody className="p-0">
        {count === 0 ? (
          <p className="p-4 text-center text-[11px] text-muted">{emptyMsg}</p>
        ) : (
          <ul className="divide-y divide-border/60">{children}</ul>
        )}
      </CardBody>
    </Card>
  )
}

function LinhaItem({
  clienteId,
  clienteNome,
  titulo,
  formato,
  direita,
}: {
  clienteId: string
  clienteNome: string
  titulo: string
  formato: string
  direita: React.ReactNode
}) {
  return (
    <li>
      <Link
        to={`/social/clientes/${clienteId}`}
        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-bg-soft/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-100">{titulo || 'Sem título'}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {clienteNome} · <span className="uppercase">{formato}</span>
          </p>
        </div>
        {direita}
        <ChevronRight size={13} className="shrink-0 text-muted" />
      </Link>
    </li>
  )
}

function LinhaCliente({
  clienteId,
  clienteNome,
  direita,
}: {
  clienteId: string
  clienteNome: string
  direita: React.ReactNode
}) {
  return (
    <li>
      <Link
        to={`/social/clientes/${clienteId}`}
        className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-bg-soft/50"
      >
        <span className="min-w-0 flex-1 truncate text-xs text-zinc-100">{clienteNome}</span>
        {direita}
      </Link>
    </li>
  )
}

// Re-export pra evitar `Activity` nao usado no lint (usado no icon do menu)
void Activity
