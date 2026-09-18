/**
 * Versão CONDENSADA do Calendário de postagens pro topo da lista de Social
 * Media. Mini grade do mês corrente com pontinhos coloridos por status +
 * contadores (mês / concluídas / atrasadas). Reaproveita os `items` já
 * carregados pela lista (producoes_social_media_items).
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
  parseISO,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { ItemSocialMedia, StatusSocialMedia } from '@/types/database'

const statusDot: Record<StatusSocialMedia, string> = {
  pendente: 'bg-zinc-500',
  design: 'bg-violet-500',
  design_finalizado: 'bg-sky-500',
  alteracao: 'bg-red-500',
  em_aprovacao: 'bg-amber-500',
  conclusao: 'bg-emerald-500',
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CalendarioPostagensCompacto({ items }: { items: ItemSocialMedia[] }) {
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
    const porDia = new Map<string, ItemSocialMedia[]>()
    const noMes: ItemSocialMedia[] = []
    for (const it of items) {
      if (!it.prazo) continue
      const d = parseISO(it.prazo)
      if (d < mesInicio || d > mesFim) continue
      noMes.push(it)
      const key = it.prazo.slice(0, 10)
      if (!porDia.has(key)) porDia.set(key, [])
      porDia.get(key)!.push(it)
    }
    const hojeIni = startOfDay(hoje)
    const stats = {
      total: noMes.length,
      concluidos: noMes.filter((it) => it.status === 'conclusao').length,
      atrasados: noMes.filter(
        (it) => it.status !== 'conclusao' && it.prazo && isBefore(parseISO(it.prazo), hojeIni),
      ).length,
    }
    return { porDia, stats }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  return (
    <div className="mb-4 rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-brand-300" />
          <h3 className="text-sm font-semibold text-zinc-100">Calendário de postagens</h3>
          <span className="text-[11px] capitalize text-muted">
            {format(hoje, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-muted">
            Mês <strong className="text-zinc-200 tabular-nums">{stats.total}</strong>
          </span>
          <span className="text-emerald-300 tabular-nums">✓ {stats.concluidos}</span>
          <span className={cn('tabular-nums', stats.atrasados > 0 ? 'text-red-300' : 'text-muted')}>
            ⚠ {stats.atrasados}
          </span>
          <Link to="/social/calendario" className="text-brand-300 hover:underline">
            abrir
          </Link>
        </div>
      </div>

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
          return (
            <div
              key={key}
              className={cn(
                'min-h-[42px] rounded-md border border-border/60 p-1',
                foraMes ? 'opacity-40' : 'bg-bg-soft/30',
                isToday(dia) && 'ring-1 ring-brand-500/50',
              )}
            >
              <div className="text-[10px] tabular-nums text-muted">{format(dia, 'd')}</div>
              {posts.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {posts.slice(0, 6).map((p) => (
                    <span
                      key={p.id}
                      className={cn('h-1.5 w-1.5 rounded-full', statusDot[p.status])}
                      title={p.titulo}
                    />
                  ))}
                  {posts.length > 6 && (
                    <span className="text-[8px] leading-none text-muted">+{posts.length - 6}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
