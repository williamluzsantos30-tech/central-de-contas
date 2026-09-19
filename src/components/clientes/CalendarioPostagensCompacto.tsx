/**
 * Versão CONDENSADA do Calendário de postagens pro topo da lista de Social
 * Media. Mini grade do mês corrente com pontinhos por post + contadores
 * (mês / postados / atrasados / agendados).
 *
 * Fonte dos posts: os `items` já carregados pela lista
 * (producoes_social_media_items) — não há entidade "Postagem" separada. Cada
 * item vem do PLANEJAMENTO (producoes_social_media) e já carrega a data de
 * postagem (`prazo`). Ligamos item → planejamento → cliente pra: (1) escopar
 * o calendário aos clientes DAQUELA operação (os que estão na lista) e (2)
 * mostrar o nome do cliente em cada post.
 *
 * O ponto do calendário é "postado ou não":
 *   - postado   = publicado_em preenchido (foi pro ar de fato)
 *   - atrasado  = não publicado e o prazo já passou
 *   - agendado  = não publicado, prazo hoje/futuro (programado)
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
  startOfDay,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/dates'
import type {
  Cliente,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
} from '@/types/database'

type EstadoPost = 'postado' | 'atrasado' | 'agendado'

const estadoDot: Record<EstadoPost, string> = {
  postado: 'bg-emerald-500',
  atrasado: 'bg-red-500',
  agendado: 'bg-brand-400',
}

const estadoLabel: Record<EstadoPost, string> = {
  postado: 'postado',
  atrasado: 'não postado (prazo passou)',
  agendado: 'agendado',
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type PostDia = {
  id: string
  titulo: string
  cliente: string
  estado: EstadoPost
}

export function CalendarioPostagensCompacto({
  items,
  planejamentos = [],
  clientes = [],
}: {
  items: ItemSocialMedia[]
  /** Planejamentos (producoes_social_media) — liga item → cliente via producao_id. */
  planejamentos?: PlanejamentoSocialMedia[]
  /** Clientes da operação. Quando informado, escopa o calendário a eles. */
  clientes?: Cliente[]
}) {
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

  const planToCliente = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of planejamentos) m.set(p.id, p.cliente_id)
    return m
  }, [planejamentos])

  const clienteNome = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clientes) m.set(c.id, c.nome)
    return m
  }, [clientes])

  const { porDia, stats } = useMemo(() => {
    const hojeIni = startOfDay(hoje)
    const porDia = new Map<string, PostDia[]>()
    let total = 0
    let postados = 0
    let atrasados = 0
    let agendados = 0
    for (const it of items) {
      if (!it.prazo) continue
      const clienteId = planToCliente.get(it.producao_id)
      // Escopa aos clientes da operação quando a lista foi passada.
      if (clientes.length > 0 && (!clienteId || !clienteNome.has(clienteId))) continue
      const d = parseLocalDate(it.prazo)
      if (!d || d < mesInicio || d > mesFim) continue

      const estado: EstadoPost = it.publicado_em
        ? 'postado'
        : d < hojeIni
          ? 'atrasado'
          : 'agendado'
      total++
      if (estado === 'postado') postados++
      else if (estado === 'atrasado') atrasados++
      else agendados++

      const key = format(d, 'yyyy-MM-dd')
      if (!porDia.has(key)) porDia.set(key, [])
      porDia.get(key)!.push({
        id: it.id,
        titulo: it.titulo,
        cliente: (clienteId && clienteNome.get(clienteId)) || 'Cliente',
        estado,
      })
    }
    return { porDia, stats: { total, postados, atrasados, agendados } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, planToCliente, clienteNome, clientes.length])

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
          <span className="inline-flex items-center gap-1 text-emerald-300 tabular-nums" title="Postados (publicado_em preenchido)">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {stats.postados}
          </span>
          <span
            className={cn('inline-flex items-center gap-1 tabular-nums', stats.atrasados > 0 ? 'text-red-300' : 'text-muted')}
            title="Não postados com prazo vencido"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {stats.atrasados}
          </span>
          <span className="inline-flex items-center gap-1 text-brand-200 tabular-nums" title="Agendados (prazo hoje/futuro, ainda não postados)">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> {stats.agendados}
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
                      className={cn('h-1.5 w-1.5 rounded-full', estadoDot[p.estado])}
                      title={`${p.cliente} · ${p.titulo} — ${estadoLabel[p.estado]}`}
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
