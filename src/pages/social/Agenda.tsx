import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Image as ImageIcon,
  Film,
  Layers,
  Sparkles,
  AlertCircle,
  Sun,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  ExternalLink,
  Folder,
} from 'lucide-react'
import {
  format,
  parseISO,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Cliente,
  PlanejamentoSocialMedia,
  ItemSocialMedia,
  FormatoSocialMedia,
  StatusSocialMedia,
} from '@/types/database'

interface ItemEnriquecido extends ItemSocialMedia {
  cliente?: Cliente | null
  planejamento?: PlanejamentoSocialMedia | null
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

type GrupoUrgencia = 'atrasadas' | 'hoje' | 'amanha' | 'esta_semana' | 'proximas' | 'sem_prazo'

const grupoLabel: Record<GrupoUrgencia, string> = {
  atrasadas: 'Atrasadas',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  esta_semana: 'Esta semana',
  proximas: 'Próximas',
  sem_prazo: 'Sem prazo definido',
}

const grupoStyle: Record<GrupoUrgencia, { dot: string; text: string }> = {
  atrasadas: { dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]', text: 'text-red-300' },
  hoje: { dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]', text: 'text-amber-300' },
  amanha: { dot: 'bg-orange-400', text: 'text-orange-300' },
  esta_semana: { dot: 'bg-pink-400', text: 'text-pink-300' },
  proximas: { dot: 'bg-zinc-500', text: 'text-zinc-300' },
  sem_prazo: { dot: 'bg-zinc-600', text: 'text-zinc-400' },
}

type Filtro = 'meus' | 'todos'

export default function Agenda() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ItemEnriquecido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('meus')

  async function load() {
    setLoading(true)
    const [iRes, pRes] = await Promise.all([
      supabase.from('producoes_social_media_items').select('*'),
      supabase.from('producoes_social_media').select('*, cliente:clientes(*)'),
    ])
    const allItems = (iRes.data as ItemSocialMedia[]) ?? []
    const planejamentos = (pRes.data as PlanejamentoSocialMedia[]) ?? []
    const planById = new Map(planejamentos.map((p) => [p.id, p]))
    const enriched: ItemEnriquecido[] = allItems.map((it) => ({
      ...it,
      planejamento: planById.get(it.producao_id) ?? null,
      cliente: planById.get(it.producao_id)?.cliente ?? null,
    }))
    setItems(enriched)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!profile) return []
    return items.filter((it) => {
      if (it.status === 'conclusao') return false // foco no que ainda precisa ação
      if (filtro === 'meus') {
        // É meu se eu sou responsável da arte OU do planejamento OU social_media_id do cliente
        const meuResponsavel = it.responsavel_id === profile.id
        const meuPlanejamento = it.planejamento?.responsavel_id === profile.id
        const sousmDoCliente = it.cliente?.social_media_id === profile.id
        if (!meuResponsavel && !meuPlanejamento && !sousmDoCliente) return false
      }
      return true
    })
  }, [items, filtro, profile])

  const grupos = useMemo(() => {
    const today = startOfDay(new Date())
    const out: Record<GrupoUrgencia, ItemEnriquecido[]> = {
      atrasadas: [],
      hoje: [],
      amanha: [],
      esta_semana: [],
      proximas: [],
      sem_prazo: [],
    }
    for (const it of filtered) {
      if (!it.prazo) {
        out.sem_prazo.push(it)
        continue
      }
      const due = startOfDay(parseISO(it.prazo))
      const diff = differenceInCalendarDays(due, today)
      if (diff < 0) out.atrasadas.push(it)
      else if (diff === 0) out.hoje.push(it)
      else if (diff === 1) out.amanha.push(it)
      else if (diff <= 7) out.esta_semana.push(it)
      else out.proximas.push(it)
    }
    // Ordena cada grupo por prazo
    for (const k of Object.keys(out) as GrupoUrgencia[]) {
      out[k].sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))
    }
    return out
  }, [filtered])

  // Stats do topo
  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    const meusTotal = filtered.length
    const concluidasMes = items.filter((it) => {
      if (it.status !== 'conclusao') return false
      if (!it.data_conclusao && !it.updated_at) return false
      const d = startOfDay(parseISO((it.data_conclusao ?? it.updated_at) as string))
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    }).length
    const meusClientes = new Set(filtered.map((it) => it.cliente?.id).filter(Boolean)).size
    return {
      pendentes: meusTotal,
      atrasadas: grupos.atrasadas.length,
      hoje: grupos.hoje.length,
      concluidasMes,
      clientes: meusClientes,
    }
  }, [filtered, grupos, items])

  const ordemGrupos: GrupoUrgencia[] = [
    'atrasadas',
    'hoje',
    'amanha',
    'esta_semana',
    'proximas',
    'sem_prazo',
  ]

  return (
    <div>
      <PageHeader
        title="Minha agenda"
        description={
          profile
            ? `Olá, ${profile.nome.split(' ')[0]}! Aqui está tudo que precisa da sua mão.`
            : 'Postagens organizadas por urgência'
        }
      />

      {/* Filtro pessoal/global */}
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          <button
            onClick={() => setFiltro('meus')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
              filtro === 'meus'
                ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                : 'text-muted hover:text-zinc-200',
            )}
          >
            Apenas meus
          </button>
          <button
            onClick={() => setFiltro('todos')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
              filtro === 'todos'
                ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                : 'text-muted hover:text-zinc-200',
            )}
          >
            Todo o time
          </button>
        </div>
        <Link
          to="/webdesign/social-media"
          className="inline-flex items-center gap-1 text-[11px] text-pink-300 hover:underline"
        >
          <Folder size={12} /> Abrir produção completa
        </Link>
      </div>

      {/* KPIs pessoais */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiSimple
          icon={<Clock size={14} />}
          label="Em aberto"
          value={stats.pendentes}
          tone="brand"
        />
        <KpiSimple
          icon={<AlertCircle size={14} />}
          label="Atrasadas"
          value={stats.atrasadas}
          tone={stats.atrasadas > 0 ? 'danger' : 'neutral'}
        />
        <KpiSimple
          icon={<Sun size={14} />}
          label="Pra hoje"
          value={stats.hoje}
          tone={stats.hoje > 0 ? 'warning' : 'neutral'}
        />
        <KpiSimple
          icon={<CheckCircle2 size={14} />}
          label="Concluí no mês"
          value={stats.concluidasMes}
          tone="success"
        />
        <KpiSimple
          icon={<Folder size={14} />}
          label="Clientes ativos"
          value={stats.clientes}
          tone="info"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Sparkles size={28} className="text-emerald-400/70" />
            <p className="text-sm font-semibold text-zinc-200">Tudo em dia! 🎉</p>
            <p className="text-xs text-muted max-w-md">
              {filtro === 'meus'
                ? 'Você não tem nenhuma arte pendente no momento. Aproveite ou clique em "Todo o time" pra dar uma olhada na agenda da equipe.'
                : 'Nenhuma postagem em aberto no time.'}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {ordemGrupos.map((g) => {
            const grupo = grupos[g]
            if (grupo.length === 0) return null
            return <GrupoSection key={g} grupo={g} items={grupo} />
          })}
        </div>
      )}
    </div>
  )
}

function GrupoSection({ grupo, items }: { grupo: GrupoUrgencia; items: ItemEnriquecido[] }) {
  const style = grupoStyle[grupo]
  const Icon =
    grupo === 'atrasadas'
      ? AlertCircle
      : grupo === 'hoje'
      ? Sun
      : grupo === 'amanha'
      ? CalendarDays
      : grupo === 'esta_semana'
      ? CalendarRange
      : grupo === 'proximas'
      ? CalendarRange
      : Clock
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft/40 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={cn('h-2 w-2 rounded-full shrink-0', style.dot)} />
          <Icon size={14} className={style.text} />
          <h3 className={cn('text-[12px] font-bold uppercase tracking-widest', style.text)}>
            {grupoLabel[grupo]}
          </h3>
          <Badge tone="neutral" className="text-[10px]">
            {items.length}
          </Badge>
        </div>
      </div>
      <CardBody className="p-3 space-y-2">
        {items.map((it) => (
          <ItemRow key={it.id} item={it} grupo={grupo} />
        ))}
      </CardBody>
    </Card>
  )
}

function ItemRow({ item, grupo }: { item: ItemEnriquecido; grupo: GrupoUrgencia }) {
  const FormatoIcon = formatoIcon[item.formato]
  const prazoStr = (() => {
    if (!item.prazo) return '—'
    const d = parseISO(item.prazo)
    if (grupo === 'hoje') return 'Hoje'
    if (grupo === 'amanha') return 'Amanhã'
    if (grupo === 'atrasadas') {
      const days = differenceInCalendarDays(startOfDay(new Date()), startOfDay(d))
      return `Atrasada ${days}d`
    }
    return format(d, "EEE, d 'de' MMM", { locale: ptBR })
  })()

  return (
    <Link
      to={`/webdesign/social-media`}
      className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5 transition-colors hover:bg-bg-soft/70"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pink-500/30 bg-pink-500/10 text-pink-300">
        <FormatoIcon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-100 truncate">{item.titulo}</p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          {item.cliente?.nome && (
            <span className="truncate text-zinc-300">{item.cliente.nome}</span>
          )}
          <span>·</span>
          <span>{formatoLabel[item.formato]}</span>
          {item.cliente?.squad && (
            <>
              <span>·</span>
              <span>Squad {item.cliente.squad}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone="neutral" className="text-[10px] inline-flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[item.status])} />
          {statusLabel[item.status]}
        </Badge>
        <span
          className={cn(
            'text-[11px] tabular-nums',
            grupo === 'atrasadas'
              ? 'text-red-300 font-semibold'
              : grupo === 'hoje'
              ? 'text-amber-300 font-semibold'
              : 'text-muted',
          )}
        >
          {prazoStr}
        </span>
        <ExternalLink size={11} className="text-muted/60 group-hover:text-pink-300" />
      </div>
    </Link>
  )
}

function KpiSimple({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
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
    neutral: {
      box: 'border-border',
      iconBox: 'border-border bg-bg-elev text-zinc-300',
      text: 'text-zinc-100',
    },
  } as const
  const s = styles[tone]
  return (
    <Card className={cn('overflow-hidden', s.box)}>
      <CardBody className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums', s.text)}>{value}</p>
        </div>
        <div className={cn('shrink-0 grid h-8 w-8 place-items-center rounded-lg border', s.iconBox)}>
          {icon}
        </div>
      </CardBody>
    </Card>
  )
}
