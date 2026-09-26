import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Image as ImageIcon,
  Film,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trophy,
} from 'lucide-react'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Cliente,
  PlanejamentoSocialMedia,
  ItemSocialMedia,
  FormatoSocialMedia,
} from '@/types/database'

interface ClienteStats {
  cliente: Cliente
  totalArtes: number
  concluidas: number
  pendentes: number
  atrasadas: number
  taxaConclusao: number // 0..100
  porFormato: Record<FormatoSocialMedia, number>
  variacaoVsMesAnterior: number | null // %
}

const formatoIcon: Record<FormatoSocialMedia, React.ComponentType<{ size?: number; className?: string }>> = {
  carrossel: Layers,
  estatico: ImageIcon,
  reel: Film,
  outro: Sparkles,
}

const formatoLabel: Record<FormatoSocialMedia, string> = {
  carrossel: 'Carrossel',
  estatico: 'Estático',
  reel: 'Reel',
  outro: 'Outro',
}

/**
 * Página própria em Operacional › Execução › Métricas Social (/social/metricas,
 * só admin). `embedded=true` esconde o PageHeader se for embutida em outra tela.
 */
export default function MetricasSocialMedia({ embedded = false }: { embedded?: boolean } = {}) {
  const { profile } = useAuth()
  const [items, setItems] = useState<ItemSocialMedia[]>([])
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoSocialMedia[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'mes_atual' | 'mes_anterior' | 'tres_meses'>('mes_atual')

  async function load() {
    setLoading(true)
    const [iRes, pRes, cRes] = await Promise.all([
      supabase.from('producoes_social_media_items').select('*'),
      supabase.from('producoes_social_media').select('*'),
      supabase.from('clientes').select('*').eq('status', 'ativo').order('nome'),
    ])
    setItems((iRes.data as ItemSocialMedia[]) ?? [])
    setPlanejamentos((pRes.data as PlanejamentoSocialMedia[]) ?? [])
    setClientes((cRes.data as Cliente[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const range = useMemo(() => {
    const now = new Date()
    if (periodo === 'mes_atual') {
      return { start: startOfMonth(now), end: endOfMonth(now), label: 'Este mês' }
    }
    if (periodo === 'mes_anterior') {
      const m = subMonths(now, 1)
      return { start: startOfMonth(m), end: endOfMonth(m), label: 'Mês anterior' }
    }
    // tres_meses
    return {
      start: startOfMonth(subMonths(now, 2)),
      end: endOfMonth(now),
      label: 'Últimos 3 meses',
    }
  }, [periodo])

  // Plano → cliente lookup
  const planById = useMemo(() => new Map(planejamentos.map((p) => [p.id, p])), [planejamentos])

  function itemCliente(it: ItemSocialMedia): Cliente | undefined {
    const planId = it.producao_id
    const plan = planById.get(planId)
    if (!plan) return
    return clientes.find((c) => c.id === plan.cliente_id)
  }

  // Filtra items pelo range
  function inRange(it: ItemSocialMedia, r: { start: Date; end: Date }) {
    if (!it.prazo) return false
    const d = parseISO(it.prazo)
    return d >= r.start && d <= r.end
  }

  const stats = useMemo<ClienteStats[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)

    // Items do mês anterior pra calcular variação
    const prev = (() => {
      const now = new Date()
      const ref = periodo === 'mes_anterior' ? subMonths(now, 2) : subMonths(now, 1)
      return { start: startOfMonth(ref), end: endOfMonth(ref) }
    })()

    return clientes
      .map<ClienteStats>((c) => {
        const itensCliente = items.filter((it) => {
          const cl = itemCliente(it)
          return cl?.id === c.id
        })
        const itensPeriodo = itensCliente.filter((it) => inRange(it, range))
        const itensAnterior = itensCliente.filter((it) => inRange(it, prev))

        const total = itensPeriodo.length
        const concluidas = itensPeriodo.filter((i) => i.status === 'conclusao').length
        const atrasadas = itensPeriodo.filter(
          (i) => i.status !== 'conclusao' && i.prazo && i.prazo.slice(0, 10) < todayStr,
        ).length
        const pendentes = total - concluidas - atrasadas

        const porFormato: Record<FormatoSocialMedia, number> = {
          carrossel: 0,
          estatico: 0,
          reel: 0,
          outro: 0,
        }
        for (const it of itensPeriodo) porFormato[it.formato]++

        const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0
        const totalAnterior = itensAnterior.length
        const variacao =
          totalAnterior > 0 ? Math.round(((total - totalAnterior) / totalAnterior) * 100) : null

        return {
          cliente: c,
          totalArtes: total,
          concluidas,
          pendentes,
          atrasadas,
          taxaConclusao,
          porFormato,
          variacaoVsMesAnterior: variacao,
        }
      })
      .filter((s) => s.totalArtes > 0)
      .sort((a, b) => b.totalArtes - a.totalArtes || b.concluidas - a.concluidas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, planejamentos, clientes, periodo])

  // Minhas métricas (do usuário logado)
  const minhasMetricas = useMemo(() => {
    if (!profile) return null
    const todayStr = new Date().toISOString().slice(0, 10)
    const meusItens = items.filter((it) => {
      // Item meu se eu sou o responsável OU sou o social_media do cliente
      const meuResp = it.responsavel_id === profile.id
      const plan = planById.get(it.producao_id)
      const cliente = clientes.find((c) => c.id === plan?.cliente_id)
      const sousm = cliente?.social_media_id === profile.id
      const meuPlan = plan?.responsavel_id === profile.id
      if (!(meuResp || sousm || meuPlan)) return false
      return inRange(it, range)
    })
    const total = meusItens.length
    const concluidas = meusItens.filter((it) => it.status === 'conclusao').length
    const atrasadas = meusItens.filter(
      (it) =>
        it.status !== 'conclusao' && it.prazo && it.prazo.slice(0, 10) < todayStr,
    ).length
    const pendentes = total - concluidas - atrasadas
    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0
    const meusClientes = new Set(
      meusItens.map((it) => {
        const plan = planById.get(it.producao_id)
        return plan?.cliente_id
      }).filter(Boolean),
    ).size
    return { total, concluidas, atrasadas, pendentes, taxa, clientes: meusClientes }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, items, planById, clientes, range])

  // Métricas agregadas do time
  const teamKpis = useMemo(() => {
    const totalArtes = stats.reduce((s, c) => s + c.totalArtes, 0)
    const totalConcluidas = stats.reduce((s, c) => s + c.concluidas, 0)
    const totalAtrasadas = stats.reduce((s, c) => s + c.atrasadas, 0)
    const taxa = totalArtes > 0 ? Math.round((totalConcluidas / totalArtes) * 100) : 0
    const totalCarrossel = stats.reduce((s, c) => s + c.porFormato.carrossel, 0)
    const totalEstatico = stats.reduce((s, c) => s + c.porFormato.estatico, 0)
    const totalReel = stats.reduce((s, c) => s + c.porFormato.reel, 0)
    const totalOutro = stats.reduce((s, c) => s + c.porFormato.outro, 0)
    const top = stats[0]
    return {
      totalArtes,
      totalConcluidas,
      totalAtrasadas,
      taxa,
      totalCarrossel,
      totalEstatico,
      totalReel,
      totalOutro,
      top,
    }
  }, [stats])

  if (loading) return <p className="text-sm text-muted">Carregando...</p>

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Métricas Social Media"
          description={`${range.label.toLowerCase()} · ${teamKpis.totalArtes} artes · ${stats.length} clientes ativos`}
        />
      )}

      {/* Filtro de período */}
      <div className="mb-4 flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          {(
            [
              ['mes_atual', 'Este mês'],
              ['mes_anterior', 'Mês anterior'],
              ['tres_meses', 'Últimos 3 meses'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriodo(k)}
              className={cn(
                'px-3 py-1 text-[11px] font-medium rounded-md transition-colors',
                periodo === k
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Minha performance — destaque pessoal */}
      {minhasMetricas && minhasMetricas.total > 0 && (
        <Card className="mb-5 overflow-hidden">
          <div className="relative bg-gradient-to-r from-pink-500/10 via-pink-500/5 to-transparent p-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-pink-500/15 blur-3xl"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={profile?.nome ?? '?'} url={profile?.avatar_url ?? null} size="lg" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-300">
                    Sua performance · {range.label.toLowerCase()}
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold text-zinc-100">
                    {profile?.nome ?? 'Você'}
                  </h2>
                  <p className="text-[11px] text-muted">
                    Acompanhamento de {minhasMetricas.clientes}{' '}
                    {minhasMetricas.clientes === 1 ? 'cliente' : 'clientes'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Artes" value={minhasMetricas.total} tone="brand" />
                <MiniStat
                  label="Concluídas"
                  value={`${minhasMetricas.taxa}%`}
                  tone="success"
                  hint={`${minhasMetricas.concluidas}/${minhasMetricas.total}`}
                />
                <MiniStat
                  label="Pendentes"
                  value={minhasMetricas.pendentes}
                  tone="neutral"
                />
                <MiniStat
                  label="Atrasadas"
                  value={minhasMetricas.atrasadas}
                  tone={minhasMetricas.atrasadas > 0 ? 'danger' : 'success'}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* KPIs do time */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<ImageIcon size={15} />}
          label="Artes no período"
          value={teamKpis.totalArtes.toString()}
          tone="brand"
        />
        <KpiCard
          icon={<CheckCircle2 size={15} />}
          label="Taxa de conclusão"
          value={`${teamKpis.taxa}%`}
          subtitle={`${teamKpis.totalConcluidas} concluídas`}
          tone={teamKpis.taxa >= 75 ? 'success' : teamKpis.taxa >= 50 ? 'warning' : 'danger'}
        />
        <KpiCard
          icon={<AlertCircle size={15} />}
          label="Atrasadas"
          value={teamKpis.totalAtrasadas.toString()}
          tone={teamKpis.totalAtrasadas > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          icon={<Trophy size={15} />}
          label="Cliente destaque"
          value={teamKpis.top?.cliente.nome.split(' ')[0] ?? '—'}
          subtitle={teamKpis.top ? `${teamKpis.top.totalArtes} artes` : ''}
          tone="info"
        />
      </div>

      {/* Distribuição por formato */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border bg-bg-soft/40 px-5 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-pink-500/40 bg-pink-500/15 text-pink-300">
            <Layers size={15} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-100">Distribuição por formato</h3>
            <p className="text-[11px] text-muted">Quantas artes de cada tipo foram produzidas</p>
          </div>
        </div>
        <CardBody>
          {teamKpis.totalArtes === 0 ? (
            <p className="text-xs text-muted text-center py-4">
              Sem produções no período selecionado.
            </p>
          ) : (
            <div className="space-y-2">
              {(
                [
                  ['carrossel', teamKpis.totalCarrossel],
                  ['estatico', teamKpis.totalEstatico],
                  ['reel', teamKpis.totalReel],
                  ['outro', teamKpis.totalOutro],
                ] as [FormatoSocialMedia, number][]
              ).map(([f, n]) => {
                const Icon = formatoIcon[f]
                const pct = Math.round((n / teamKpis.totalArtes) * 100)
                return (
                  <div key={f}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-300">
                        <Icon size={12} className="text-pink-300" />
                        {formatoLabel[f]}
                      </span>
                      <span className="text-muted tabular-nums">
                        {n} {n === 1 ? 'arte' : 'artes'} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-elev">
                      <div
                        className="h-full rounded-full bg-pink-500/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Ranking por cliente */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border bg-bg-soft/40 px-5 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-pink-500/40 bg-pink-500/15 text-pink-300">
            <Trophy size={15} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-100">Performance por cliente</h3>
            <p className="text-[11px] text-muted">Ordenado pelo volume de artes produzidas</p>
          </div>
        </div>
        <CardBody className="p-3 space-y-2.5">
          {stats.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">
              Nenhum cliente com produção no período.
            </p>
          ) : (
            stats.map((s, idx) => <ClienteRow key={s.cliente.id} stats={s} rank={idx + 1} />)
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function ClienteRow({ stats, rank }: { stats: ClienteStats; rank: number }) {
  const { cliente, totalArtes, concluidas, atrasadas, taxaConclusao, porFormato, variacaoVsMesAnterior } =
    stats

  const corTaxa =
    taxaConclusao >= 80
      ? 'text-emerald-300'
      : taxaConclusao >= 60
      ? 'text-lime-300'
      : taxaConclusao >= 40
      ? 'text-amber-300'
      : 'text-red-300'
  const barColor =
    taxaConclusao >= 80
      ? 'bg-emerald-400'
      : taxaConclusao >= 60
      ? 'bg-lime-400'
      : taxaConclusao >= 40
      ? 'bg-amber-400'
      : 'bg-red-400'

  return (
    <Link
      to={`/social/clientes/${cliente.id}`}
      className="block rounded-xl border border-border bg-bg-soft/40 p-4 transition-colors hover:bg-bg-soft/70"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold shrink-0',
            rank === 1
              ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
              : rank === 2
              ? 'border-zinc-400/70 bg-zinc-500/30 text-zinc-100'
              : rank === 3
              ? 'border-orange-400/70 bg-orange-700/30 text-orange-200'
              : 'border-border bg-bg-elev text-muted',
          )}
        >
          {rank}
        </span>
        <Avatar name={cliente.nome} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{cliente.nome}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
            {cliente.squad && <span>Squad {cliente.squad}</span>}
            {cliente.nicho && <span>· {cliente.nicho}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-1 justify-end">
            <span className="text-xl font-bold tabular-nums text-zinc-100">{totalArtes}</span>
            <span className="text-[11px] text-muted">artes</span>
          </div>
          {variacaoVsMesAnterior !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[10px]',
                variacaoVsMesAnterior > 0
                  ? 'text-emerald-400'
                  : variacaoVsMesAnterior < 0
                  ? 'text-red-400'
                  : 'text-muted',
              )}
            >
              {variacaoVsMesAnterior > 0 ? (
                <TrendingUp size={10} />
              ) : variacaoVsMesAnterior < 0 ? (
                <TrendingDown size={10} />
              ) : (
                <Minus size={10} />
              )}
              {variacaoVsMesAnterior > 0 ? '+' : ''}
              {variacaoVsMesAnterior}%
            </span>
          )}
        </div>
      </div>

      {/* Barra de conclusão */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
          <span>Conclusão</span>
          <span className={cn('font-semibold tabular-nums', corTaxa)}>
            {concluidas}/{totalArtes} · {taxaConclusao}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-elev">
          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${taxaConclusao}%` }} />
        </div>
      </div>

      {/* Mini stats */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Pill
          icon={<CheckCircle2 size={11} className="text-emerald-400" />}
          label="Concluídas"
          value={concluidas}
        />
        <Pill icon={<Clock size={11} className="text-zinc-400" />} label="Pendentes" value={stats.pendentes} />
        <Pill
          icon={<AlertCircle size={11} className="text-red-400" />}
          label="Atrasadas"
          value={atrasadas}
          highlight={atrasadas > 0 ? 'danger' : undefined}
        />
        <Pill
          icon={<Layers size={11} className="text-pink-300" />}
          label="Formatos"
          value={
            (porFormato.carrossel > 0 ? 1 : 0) +
            (porFormato.estatico > 0 ? 1 : 0) +
            (porFormato.reel > 0 ? 1 : 0) +
            (porFormato.outro > 0 ? 1 : 0)
          }
        />
      </div>

      {/* Distribuição de formatos */}
      {totalArtes > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
          {(Object.entries(porFormato) as [FormatoSocialMedia, number][]).map(([f, n]) => {
            if (n === 0) return null
            const Icon = formatoIcon[f]
            return (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft/60 px-1.5 py-0.5 text-zinc-300"
              >
                <Icon size={10} className="text-pink-300/80" />
                {n} {formatoLabel[f].toLowerCase()}
              </span>
            )
          })}
        </div>
      )}
    </Link>
  )
}

function Pill({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  highlight?: 'danger'
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5',
        highlight === 'danger' ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-bg-soft/60',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-muted">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          'text-xs font-semibold tabular-nums',
          highlight === 'danger' ? 'text-red-300' : 'text-zinc-100',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: number | string
  tone: 'brand' | 'success' | 'danger' | 'neutral'
  hint?: string
}) {
  const colors: Record<typeof tone, string> = {
    brand: 'text-pink-200',
    success: 'text-emerald-300',
    danger: 'text-red-300',
    neutral: 'text-zinc-100',
  } as const
  return (
    <div className="rounded-lg border border-border bg-bg-soft/60 px-3 py-2 min-w-[90px]">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', colors[tone])}>{value}</p>
      {hint && <p className="text-[9px] text-muted">{hint}</p>}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const styles: Record<typeof tone, { box: string; iconBox: string; text: string }> = {
    brand: {
      box: 'border-pink-500/30',
      iconBox: 'border-pink-500/40 bg-pink-500/10 text-pink-300',
      text: 'text-pink-200',
    },
    success: {
      box: 'border-emerald-500/30',
      iconBox: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      text: 'text-emerald-300',
    },
    warning: {
      box: 'border-amber-500/30',
      iconBox: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      text: 'text-amber-300',
    },
    danger: {
      box: 'border-red-500/30',
      iconBox: 'border-red-500/40 bg-red-500/10 text-red-300',
      text: 'text-red-300',
    },
    info: {
      box: 'border-sky-500/30',
      iconBox: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
      text: 'text-sky-300',
    },
  } as const
  const s = styles[tone]
  return (
    <Card className={cn('overflow-hidden', s.box)}>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums truncate', s.text)}>{value}</p>
          {subtitle && <p className="mt-0.5 text-[10px] text-muted truncate">{subtitle}</p>}
        </div>
        <div className={cn('shrink-0 grid h-9 w-9 place-items-center rounded-lg border', s.iconBox)}>
          {icon}
        </div>
      </CardBody>
    </Card>
  )
}
