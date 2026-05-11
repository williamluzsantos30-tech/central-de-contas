import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Film,
  LayoutGrid,
  X,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { PublicarItemBotao, PublicacaoInfo } from './PublicarItemDialog'
import type {
  Cliente,
  FormatoSocialMedia,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
  StatusSocialMedia,
} from '@/types/database'

interface Props {
  cliente: Cliente
  items: ItemSocialMedia[]
  planejamentos: PlanejamentoSocialMedia[]
  onChanged: () => void
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const formatoMeta: Record<
  FormatoSocialMedia,
  { label: string; icon: React.ComponentType<{ size?: number }>; bg: string; text: string }
> = {
  carrossel: { label: 'Carrossel', icon: LayoutGrid, bg: 'bg-pink-500/15', text: 'text-pink-200' },
  estatico: { label: 'Estático', icon: ImageIcon, bg: 'bg-violet-500/15', text: 'text-violet-200' },
  reel: { label: 'Reel', icon: Film, bg: 'bg-amber-500/15', text: 'text-amber-200' },
  outro: { label: 'Outro', icon: ImageIcon, bg: 'bg-zinc-500/15', text: 'text-zinc-200' },
}

/**
 * Calendário mensal — playbook 3.3 (Execução & Postagens) e 6.1
 * (Rotina diária). Mostra os posts programados num grid 7×N e
 * permite clicar num dia pra ver os detalhes.
 */
export function CalendarioSocialPanel({ cliente, items, planejamentos, onChanged }: Props) {
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [filtroFormato, setFiltroFormato] = useState<FormatoSocialMedia | 'todos'>('todos')
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  // Items filtrados ao mês corrente
  const itemsDoMes = useMemo(() => {
    const m = mesISO.slice(0, 7)
    return items.filter(
      (i) =>
        i.prazo &&
        i.prazo.slice(0, 7) === m &&
        (filtroFormato === 'todos' || i.formato === filtroFormato),
    )
  }, [items, mesISO, filtroFormato])

  // Mapa dia → items
  const itemsPorDia = useMemo(() => {
    const m = new Map<string, ItemSocialMedia[]>()
    for (const it of itemsDoMes) {
      if (!it.prazo) continue
      const d = it.prazo.slice(0, 10)
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(it)
    }
    return m
  }, [itemsDoMes])

  // Gera matriz de dias da semana × linhas (6 semanas no máx)
  const semanas = useMemo(() => buildCalendar(mesISO), [mesISO])

  function shiftMes(delta: number) {
    const [y, m] = mesISO.split('-').map(Number)
    const novaData = new Date(y, m - 1 + delta, 1)
    setMesISO(`${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, '0')}-01`)
  }

  function irPraHoje() {
    const d = new Date()
    setMesISO(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const mesLabel = new Date(mesISO).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  const totais = {
    total: itemsDoMes.length,
    publicados: itemsDoMes.filter((i) => i.status === 'conclusao').length,
    atrasados: itemsDoMes.filter((i) => isAtrasada(i)).length,
  }

  const itemsDoDiaSelecionado = diaSelecionado
    ? (itemsPorDia.get(diaSelecionado) ?? [])
    : []

  return (
    <div className="space-y-4">
      {/* Header: navegação + filtros + KPIs do mês */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMes(-1)}
              className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:border-pink-500/40 hover:text-pink-300"
              title="Mês anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <h2 className="px-3 text-base font-semibold capitalize tabular-nums">{mesLabel}</h2>
            <button
              onClick={() => shiftMes(1)}
              className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:border-pink-500/40 hover:text-pink-300"
              title="Próximo mês"
            >
              <ChevronRight size={14} />
            </button>
            <Button size="sm" variant="ghost" onClick={irPraHoje}>
              hoje
            </Button>
          </div>

          {/* Filtro por formato */}
          <div className="ml-auto flex items-center gap-1">
            <FiltroFormato
              ativo={filtroFormato === 'todos'}
              onClick={() => setFiltroFormato('todos')}
              label="Todos"
            />
            {(['carrossel', 'estatico', 'reel'] as const).map((f) => (
              <FiltroFormato
                key={f}
                ativo={filtroFormato === f}
                onClick={() => setFiltroFormato(f)}
                label={formatoMeta[f].label}
                icon={formatoMeta[f].icon}
              />
            ))}
          </div>

          {/* KPIs */}
          <div className="ml-auto flex items-center gap-2 border-l border-border pl-3">
            <Badge tone="brand">{totais.total} total</Badge>
            <Badge tone="success">
              <CheckCircle2 size={10} className="mr-1 inline" />
              {totais.publicados}
            </Badge>
            {totais.atrasados > 0 && (
              <Badge tone="danger">
                <AlertCircle size={10} className="mr-1 inline" />
                {totais.atrasados}
              </Badge>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Grid */}
      <Card>
        <CardBody className="p-0">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 border-b border-border">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Semanas */}
          <div className="grid grid-cols-7 auto-rows-[minmax(110px,auto)]">
            {semanas.map((semana, si) =>
              semana.map((dia, di) => {
                const dataStr = dia ? formatDateISO(dia) : ''
                const itens = dia ? itemsPorDia.get(dataStr) ?? [] : []
                const isHoje = !!dia && dataStr === todayISO()
                const isMesAtual = !!dia && dia.getMonth() === Number(mesISO.slice(5, 7)) - 1
                return (
                  <DiaCelula
                    key={`${si}-${di}`}
                    data={dia}
                    isHoje={isHoje}
                    isMesAtual={isMesAtual}
                    items={itens}
                    onClick={() => dia && setDiaSelecionado(dataStr)}
                  />
                )
              }),
            )}
          </div>
        </CardBody>
      </Card>

      {/* Drawer/Modal do dia */}
      <Modal
        open={!!diaSelecionado}
        onClose={() => setDiaSelecionado(null)}
        title={
          diaSelecionado
            ? new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })
            : ''
        }
      >
        {itemsDoDiaSelecionado.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum post programado nesse dia.</p>
        ) : (
          <ul className="space-y-2">
            {itemsDoDiaSelecionado.map((it) => (
              <ItemDoDia
                key={it.id}
                item={it}
                cliente={cliente}
                planejamentos={planejamentos}
                onChanged={onChanged}
              />
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function FiltroFormato({
  ativo,
  onClick,
  label,
  icon: Icon,
}: {
  ativo: boolean
  onClick: () => void
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        ativo
          ? 'border-pink-500/40 bg-pink-500/15 text-pink-200'
          : 'border-border bg-bg-soft text-muted hover:text-zinc-200 hover:border-zinc-500',
      )}
    >
      {Icon && <Icon size={10} />}
      {label}
    </button>
  )
}

function DiaCelula({
  data,
  isHoje,
  isMesAtual,
  items,
  onClick,
}: {
  data: Date | null
  isHoje: boolean
  isMesAtual: boolean
  items: ItemSocialMedia[]
  onClick: () => void
}) {
  if (!data) {
    return <div className="border-r border-b border-border bg-bg-soft/30" />
  }

  const visiveis = items.slice(0, 3)
  const restantes = items.length - visiveis.length

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-stretch gap-0.5 border-r border-b border-border p-1.5 text-left transition-colors',
        !isMesAtual && 'opacity-40',
        isHoje && 'bg-pink-500/5 ring-1 ring-pink-500/30',
        items.length > 0 ? 'hover:bg-bg-soft' : 'hover:bg-bg-soft/50',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[11px] font-semibold tabular-nums',
            isHoje
              ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-pink-500 text-white'
              : isMesAtual
              ? 'text-zinc-200'
              : 'text-muted',
          )}
        >
          {data.getDate()}
        </span>
        {items.length > 0 && (
          <span className="text-[9px] tabular-nums text-muted">{items.length}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 mt-0.5">
        {visiveis.map((it) => (
          <PostPill key={it.id} item={it} />
        ))}
        {restantes > 0 && (
          <span className="text-[9px] text-muted">+{restantes}</span>
        )}
      </div>
    </button>
  )
}

function PostPill({ item }: { item: ItemSocialMedia }) {
  const meta = formatoMeta[item.formato]
  const atrasada = isAtrasada(item)
  const concluido = item.status === 'conclusao'

  const cor = concluido
    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
    : atrasada
    ? 'bg-red-500/15 text-red-200 border-red-500/30'
    : `${meta.bg} ${meta.text} border-pink-500/20`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[9px] leading-tight',
        cor,
      )}
      title={`${meta.label} · ${item.titulo}`}
    >
      {concluido ? (
        <CheckCircle2 size={8} className="flex-shrink-0" />
      ) : atrasada ? (
        <AlertCircle size={8} className="flex-shrink-0" />
      ) : (
        <meta.icon size={8} />
      )}
      <span className="truncate">{item.titulo}</span>
    </span>
  )
}

function ItemDoDia({
  item,
  cliente: _cliente,
  planejamentos,
  onChanged,
}: {
  item: ItemSocialMedia
  cliente: Cliente
  planejamentos: PlanejamentoSocialMedia[]
  onChanged: () => void
}) {
  const meta = formatoMeta[item.formato]
  const plano = planejamentos.find((p) => p.id === item.producao_id)
  const atrasada = isAtrasada(item)

  return (
    <li
      className={cn(
        'rounded-lg border bg-bg-soft p-3',
        atrasada ? 'border-red-500/30' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid h-9 w-9 place-items-center rounded-lg border',
            meta.bg,
            meta.text,
            'border-current/30',
          )}
        >
          <meta.icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-zinc-100 text-sm leading-snug">{item.titulo}</p>
            <PublicarItemBotao item={item} onChanged={onChanged} compact />
          </div>
          {item.ideia_conteudo && (
            <p className="mt-1 text-xs text-muted leading-relaxed">{item.ideia_conteudo}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral" className="!text-[9px]">
              {meta.label}
            </Badge>
            <Badge tone={statusTone(item.status)} className="!text-[9px]">
              {item.status.replace(/_/g, ' ')}
            </Badge>
            {atrasada && (
              <Badge tone="danger" className="!text-[9px]">
                atrasado
              </Badge>
            )}
            {plano?.titulo && (
              <span className="text-[10px] text-muted">· {plano.titulo}</span>
            )}
          </div>
          <PublicacaoInfo item={item} />
        </div>
      </div>
    </li>
  )
}

/* ============================================================
   Helpers
   ============================================================ */

/** Constrói matriz de semanas (Dom→Sáb) cobrindo o mês inteiro */
function buildCalendar(mesISO: string): (Date | null)[][] {
  const [y, m] = mesISO.split('-').map(Number)
  const primeiro = new Date(y, m - 1, 1)
  const ultimo = new Date(y, m, 0)
  const diaSemanaInicio = primeiro.getDay() // 0=Dom
  const totalDias = ultimo.getDate()

  // Quantas linhas precisamos (5 ou 6)
  const totalCells = diaSemanaInicio + totalDias
  const linhas = Math.ceil(totalCells / 7)

  const semanas: (Date | null)[][] = []
  let dia = 1
  for (let row = 0; row < linhas; row++) {
    const semana: (Date | null)[] = []
    for (let col = 0; col < 7; col++) {
      const idx = row * 7 + col
      if (idx < diaSemanaInicio || dia > totalDias) {
        semana.push(null)
      } else {
        semana.push(new Date(y, m - 1, dia))
        dia++
      }
    }
    semanas.push(semana)
  }
  return semanas
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function todayISO(): string {
  return formatDateISO(new Date())
}

function isAtrasada(item: ItemSocialMedia): boolean {
  return (
    item.status !== 'conclusao' &&
    !!item.prazo &&
    item.prazo.slice(0, 10) < todayISO()
  )
}

function statusTone(s: StatusSocialMedia): 'success' | 'warning' | 'danger' | 'neutral' | 'brand' {
  switch (s) {
    case 'conclusao':
      return 'success'
    case 'em_aprovacao':
      return 'warning'
    case 'alteracao':
      return 'danger'
    case 'pendente':
      return 'neutral'
    default:
      return 'brand'
  }
}
