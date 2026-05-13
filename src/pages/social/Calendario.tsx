import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Image as ImageIcon,
  Film,
  Layers,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isDateOverdue } from '@/lib/dates'
import { temCargo } from '@/lib/cargos'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Cliente,
  PlanejamentoSocialMedia,
  ItemSocialMedia,
  FormatoSocialMedia,
  StatusSocialMedia,
} from '@/types/database'

const formatoIcon: Record<FormatoSocialMedia, React.ComponentType<{ size?: number; className?: string }>> = {
  carrossel: Layers,
  estatico: ImageIcon,
  reel: Film,
  outro: Sparkles,
}

const statusDot: Record<StatusSocialMedia, string> = {
  pendente: 'bg-zinc-500',
  design: 'bg-violet-500',
  design_finalizado: 'bg-sky-500',
  alteracao: 'bg-red-500',
  em_aprovacao: 'bg-amber-500',
  conclusao: 'bg-emerald-500',
}

const statusLabel: Record<StatusSocialMedia, string> = {
  pendente: 'Pendente',
  design: 'Em design',
  design_finalizado: 'Design finalizado',
  alteracao: 'Em alteração',
  em_aprovacao: 'Em aprovação',
  conclusao: 'Concluído',
}

interface ItemComCliente extends ItemSocialMedia {
  cliente?: Cliente | null
  planejamento?: PlanejamentoSocialMedia | null
}

export default function CalendarioPostagens() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ItemComCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState<Date>(new Date())
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusSocialMedia>('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [escopo, setEscopo] = useState<'meus' | 'todos'>(
    temCargo(profile, 'social_media') ? 'meus' : 'todos',
  )

  async function load() {
    setLoading(true)
    const [iRes, pRes, cRes] = await Promise.all([
      supabase.from('producoes_social_media_items').select('*'),
      supabase.from('producoes_social_media').select('*, cliente:clientes(*)'),
      supabase.from('clientes').select('*').eq('status', 'ativo').order('nome'),
    ])
    const allItems = (iRes.data as ItemSocialMedia[]) ?? []
    const planejamentos = (pRes.data as PlanejamentoSocialMedia[]) ?? []
    const planById = new Map(planejamentos.map((p) => [p.id, p]))
    const enriched: ItemComCliente[] = allItems.map((it) => ({
      ...it,
      planejamento: planById.get(it.producao_id) ?? null,
      cliente: planById.get(it.producao_id)?.cliente ?? null,
    }))
    setItems(enriched)
    setClientes((cRes.data as Cliente[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filtroCliente && it.cliente?.id !== filtroCliente) return false
      if (filtroStatus && it.status !== filtroStatus) return false
      if (escopo === 'meus' && profile) {
        const meu =
          it.responsavel_id === profile.id ||
          it.planejamento?.responsavel_id === profile.id ||
          it.cliente?.social_media_id === profile.id
        if (!meu) return false
      }
      return true
    })
  }, [items, filtroCliente, filtroStatus, escopo, profile])

  const itemsByDay = useMemo(() => {
    const m = new Map<string, ItemComCliente[]>()
    for (const it of filtered) {
      if (!it.prazo) continue
      const key = it.prazo.slice(0, 10)
      const arr = m.get(key) ?? []
      arr.push(it)
      m.set(key, arr)
    }
    return m
  }, [filtered])

  // Grade do calendário: começa no domingo da semana do dia 1, termina no sábado da última semana
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
    const days: Date[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
    return days
  }, [cursor])

  const monthStats = useMemo(() => {
    const start = startOfMonth(cursor)
    const end = endOfMonth(cursor)
    const noMes = filtered.filter((it) => {
      if (!it.prazo) return false
      const d = parseISO(it.prazo)
      return d >= start && d <= end
    })
    return {
      total: noMes.length,
      concluidos: noMes.filter((it) => it.status === 'conclusao').length,
      atrasados: noMes.filter(
        (it) => it.status !== 'conclusao' && isDateOverdue(it.prazo),
      ).length,
      clientes: new Set(noMes.map((it) => it.cliente?.id).filter(Boolean)).size,
    }
  }, [filtered, cursor])

  const itemsDoDiaSelecionado = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, 'yyyy-MM-dd')
    return itemsByDay.get(key) ?? []
  }, [itemsByDay, selectedDate])

  function shiftMonth(delta: number) {
    setCursor((c) => (delta > 0 ? addMonths(c, 1) : subMonths(c, 1)))
    setSelectedDate(null)
  }

  return (
    <div>
      <PageHeader
        title="Calendário de postagens"
        description="Visão consolidada do feed do mês — todos os clientes, todos os formatos."
      />

      {/* Header + filtros */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          {/* Navegador de mês */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
              title="Mês anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft px-4 py-1.5 text-sm">
              <CalendarDays size={14} className="text-pink-300" />
              <span className="font-semibold text-zinc-100 capitalize">
                {format(cursor, 'MMMM yyyy', { locale: ptBR })}
              </span>
              {!isSameMonth(cursor, new Date()) && (
                <button
                  onClick={() => setCursor(new Date())}
                  className="text-[11px] text-pink-300 hover:underline"
                >
                  hoje
                </button>
              )}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
              title="Próximo mês"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Escopo: meus / todos */}
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
            <Select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="w-56"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <Select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as StatusSocialMedia | '')}
              className="w-44"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="design">Em design</option>
              <option value="design_finalizado">Design finalizado</option>
              <option value="alteracao">Em alteração</option>
              <option value="em_aprovacao">Em aprovação</option>
              <option value="conclusao">Concluído</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* KPIs do mês */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiSimple label="Postagens no mês" value={monthStats.total} tone="brand" />
        <KpiSimple
          label="Concluídas"
          value={monthStats.concluidos}
          tone="success"
          hint={
            monthStats.total > 0
              ? `${Math.round((monthStats.concluidos / monthStats.total) * 100)}% do total`
              : undefined
          }
        />
        <KpiSimple label="Atrasadas" value={monthStats.atrasados} tone="danger" />
        <KpiSimple label="Clientes ativos" value={monthStats.clientes} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* Calendário */}
        <Card>
          <CardBody className="p-3">
            {/* Cabeçalho dos dias da semana */}
            <div className="mb-2 grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className="px-1.5 py-1 text-center">
                  {d}
                </div>
              ))}
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-muted">Carregando...</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dayItems = itemsByDay.get(key) ?? []
                  const inMonth = isSameMonth(day, cursor)
                  const isCurrentDay = isToday(day)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)

                  return (
                    <button
                      key={key}
                      onClick={() =>
                        setSelectedDate((cur) => (cur && isSameDay(cur, day) ? null : day))
                      }
                      className={cn(
                        'group relative flex min-h-[78px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors',
                        inMonth
                          ? 'border-border bg-bg-soft/30 hover:bg-bg-soft/70'
                          : 'border-transparent bg-transparent text-muted/50 hover:bg-bg-soft/30',
                        isSelected && 'ring-2 ring-pink-500/60 border-pink-500/40',
                        isCurrentDay && 'bg-pink-500/5',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[11px] font-semibold tabular-nums',
                          isCurrentDay
                            ? 'text-pink-300'
                            : inMonth
                            ? 'text-zinc-300'
                            : 'text-muted/40',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      <div className="flex flex-1 flex-wrap content-start gap-0.5">
                        {dayItems.slice(0, 4).map((it) => {
                          const FormatoIcon = formatoIcon[it.formato]
                          return (
                            <span
                              key={it.id}
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-sm border px-1 py-0.5 text-[9px] leading-none',
                                'border-border bg-bg-elev/80 text-zinc-300',
                              )}
                              title={`${it.cliente?.nome ?? '—'}: ${it.titulo}`}
                            >
                              <span
                                className={cn('h-1 w-1 rounded-full', statusDot[it.status])}
                              />
                              <FormatoIcon size={8} className="opacity-70" />
                            </span>
                          )
                        })}
                        {dayItems.length > 4 && (
                          <span className="text-[9px] font-semibold text-muted">
                            +{dayItems.length - 4}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Painel lateral — detalhe do dia selecionado */}
        <div className="space-y-3">
          <Card>
            <CardBody className="space-y-3 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {selectedDate ? 'Postagens do dia' : 'Selecione um dia'}
                </p>
                <p className="mt-1 text-base font-semibold capitalize text-zinc-100">
                  {selectedDate
                    ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })
                    : 'Clique em uma data no calendário'}
                </p>
              </div>

              {selectedDate && itemsDoDiaSelecionado.length === 0 && (
                <div className="rounded-md border border-dashed border-border bg-bg-soft/40 p-4 text-center text-xs text-muted">
                  Nenhuma postagem agendada para este dia.
                </div>
              )}

              {selectedDate &&
                itemsDoDiaSelecionado.map((it) => {
                  const FormatoIcon = formatoIcon[it.formato]
                  const overdue = it.status !== 'conclusao' && isDateOverdue(it.prazo)
                  return (
                    <Link
                      key={it.id}
                      to={`/webdesign/social-media`}
                      className="flex items-start gap-3 rounded-lg border border-border bg-bg-soft/40 p-3 transition-colors hover:bg-bg-soft/70"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pink-500/30 bg-pink-500/10 text-pink-300">
                        <FormatoIcon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100 line-clamp-2">
                          {it.titulo}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted truncate">
                          {it.cliente?.nome ?? '—'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Badge
                            tone="neutral"
                            className="text-[10px] inline-flex items-center gap-1"
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[it.status])} />
                            {statusLabel[it.status]}
                          </Badge>
                          {overdue && (
                            <Badge tone="danger" className="text-[10px] inline-flex items-center gap-1">
                              <AlertCircle size={10} /> Atrasada
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
            </CardBody>
          </Card>

          {/* Legenda */}
          <Card>
            <CardBody className="space-y-2 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Legenda
              </p>
              <div className="space-y-1.5">
                {(
                  [
                    'pendente',
                    'design',
                    'design_finalizado',
                    'em_aprovacao',
                    'alteracao',
                    'conclusao',
                  ] as StatusSocialMedia[]
                ).map((s) => (
                  <div key={s} className="flex items-center gap-2 text-[11px] text-zinc-300">
                    <span className={cn('h-2 w-2 rounded-full', statusDot[s])} />
                    {statusLabel[s]}
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-border pt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Layers size={10} /> Carrossel
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <ImageIcon size={10} /> Estático
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Film size={10} /> Reel
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Sparkles size={10} /> Outro
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function KpiSimple({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: number | string
  tone: 'brand' | 'success' | 'danger' | 'info'
  hint?: string
}) {
  const colors: Record<typeof tone, string> = {
    brand: 'text-zinc-100',
    success: 'text-emerald-300',
    danger: 'text-red-300',
    info: 'text-sky-300',
  } as const
  return (
    <Card>
      <CardBody>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</p>
        <p className={cn('mt-2 text-2xl font-bold tabular-nums', colors[tone])}>{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-muted">{hint}</p>}
      </CardBody>
    </Card>
  )
}
