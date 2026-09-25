/**
 * CompactMonthCalendar — grade do mês corrente com CHIPS de conteúdo por dia
 * (não bolinhas). Colapsável, aberta por padrão. Escopada aos clientes já
 * filtrados na página.
 *
 * Cada célula mostra até 2 mini-chips "{nome curto} · {formato}", com cor de
 * fundo por estado (publicado/agendado/atrasado). Mais posts → "+N" que abre a
 * lista completa do dia (PostTaskCard) numa expansão abaixo da grade.
 * Dia com ≥1 post atrasado ganha borda vermelha na célula inteira.
 */
import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PostTaskCard } from '@/components/social/PostTaskCard'
import { getPostsForDateRange, nomeCurtoCliente, type EstadoPost, type PostView } from '@/lib/socialPosts'
import { cn } from '@/lib/utils'
import type { Cliente, FormatoSocialMedia, ItemSocialMedia, PlanejamentoSocialMedia } from '@/types/database'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const formatoCurto: Record<FormatoSocialMedia, string> = {
  carrossel: 'Carrossel',
  estatico: 'Estático',
  reel: 'Reel',
  outro: 'Outro',
}

const chipPorEstado: Record<EstadoPost, string> = {
  publicado: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100',
  agendado: 'border-brand-500/40 bg-brand-500/20 text-brand-100',
  atrasado: 'border-red-500/50 bg-red-500/25 text-red-100',
}

const dotPorEstado: Record<EstadoPost, string> = {
  publicado: 'bg-emerald-500',
  agendado: 'bg-brand-400',
  atrasado: 'bg-red-500',
}

export function CompactMonthCalendar({
  items,
  planejamentos,
  clientes,
  onChanged,
}: {
  items: ItemSocialMedia[]
  planejamentos: PlanejamentoSocialMedia[]
  clientes: Cliente[]
  onChanged: () => void
}) {
  const [aberto, setAberto] = useState(true)
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  const hoje = new Date()
  const mesInicio = startOfMonth(hoje)
  const mesFim = endOfMonth(hoje)

  const dias = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(mesInicio, { weekStartsOn: 0 }),
        end: endOfWeek(mesFim, { weekStartsOn: 0 }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format(mesInicio, 'yyyy-MM')],
  )

  const { porDia, stats } = useMemo(() => {
    const posts = getPostsForDateRange(items, planejamentos, clientes, mesInicio, mesFim)
    const porDia = new Map<string, PostView[]>()
    let publicados = 0
    let atrasados = 0
    let agendados = 0
    for (const p of posts) {
      if (p.estado === 'publicado') publicados++
      else if (p.estado === 'atrasado') atrasados++
      else agendados++
      const key = format(p.prazoDate, 'yyyy-MM-dd')
      if (!porDia.has(key)) porDia.set(key, [])
      porDia.get(key)!.push(p)
    }
    for (const arr of porDia.values()) arr.sort((a, b) => a.clienteNome.localeCompare(b.clienteNome))
    return { porDia, stats: { total: posts.length, publicados, atrasados, agendados } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, planejamentos, clientes])

  const postsDoDia = diaSelecionado ? (porDia.get(diaSelecionado) ?? []) : []

  return (
    <div className="mb-4 rounded-xl border border-border bg-bg-card p-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            size={14}
            className={cn('text-muted transition-transform duration-200', aberto ? 'rotate-0' : '-rotate-90')}
          />
          <CalendarDays size={14} className="text-brand-300" />
          <span className="text-sm font-semibold text-zinc-100">📅 Ver mês completo</span>
          <span className="text-[11px] capitalize text-muted">
            {format(hoje, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-muted">
            Mês <strong className="tabular-nums text-zinc-200">{stats.total}</strong>
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums text-emerald-300" title="Publicados">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {stats.publicados}
          </span>
          <span
            className={cn('inline-flex items-center gap-1 tabular-nums', stats.atrasados > 0 ? 'text-red-300' : 'text-muted')}
            title="Atrasados (prazo vencido, não publicados)"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {stats.atrasados}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums text-brand-200" title="Agendados">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> {stats.agendados}
          </span>
        </div>
      </button>

      {aberto && (
        <div className="mt-4">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] uppercase tracking-wider text-muted">
            {DIAS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map((dia) => {
              const key = format(dia, 'yyyy-MM-dd')
              const posts = porDia.get(key) ?? []
              const foraMes = !isSameMonth(dia, hoje)
              const temAtrasado = posts.some((p) => p.estado === 'atrasado')
              const extras = posts.length - 2
              const clicavel = posts.length > 0
              return (
                <div
                  key={key}
                  onClick={clicavel ? () => setDiaSelecionado((d) => (d === key ? null : key)) : undefined}
                  className={cn(
                    'flex min-h-[64px] flex-col rounded-md border p-1 transition-colors',
                    foraMes ? 'border-border/40 opacity-40' : 'border-border/60 bg-bg-soft/30',
                    temAtrasado && !foraMes && 'border-red-500/60 bg-red-500/[0.05]',
                    isToday(dia) && 'ring-1 ring-brand-500/50',
                    diaSelecionado === key && 'ring-1 ring-brand-500/70',
                    clicavel && 'cursor-pointer hover:border-brand-500/40',
                  )}
                >
                  <div className="mb-0.5 text-[10px] tabular-nums text-muted">{format(dia, 'd')}</div>
                  {posts.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {posts.slice(0, 2).map((p) => (
                        <span
                          key={p.id}
                          title={`${p.clienteNome} · ${formatoCurto[p.formato]} — ${p.estado}`}
                          className={cn(
                            'flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[9px] font-medium leading-none',
                            chipPorEstado[p.estado],
                          )}
                        >
                          <span className={cn('h-1 w-1 shrink-0 rounded-full', dotPorEstado[p.estado])} />
                          <span className="truncate">
                            {nomeCurtoCliente(p.clienteNome)} · {formatoCurto[p.formato]}
                          </span>
                        </span>
                      ))}
                      {extras > 0 && (
                        <span className="rounded px-1 text-[9px] font-medium text-brand-300 hover:underline">
                          +{extras}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {diaSelecionado && postsDoDia.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-bg-soft/40 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {format(new Date(diaSelecionado + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                {' · '}
                {postsDoDia.length} {postsDoDia.length === 1 ? 'post' : 'posts'}
              </p>
              <div className="space-y-2">
                {postsDoDia.map((p) => (
                  <PostTaskCard key={p.id} post={p} onChanged={onChanged} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
