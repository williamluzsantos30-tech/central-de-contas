import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Search,
  Film,
  ExternalLink,
  Trash2,
  Calendar,
  Upload,
  X,
  Link as LinkIcon,
  ChevronRight,
  ChevronDown,
  FileText,
  Paperclip,
  Video,
  Pencil,
  User,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { uploadToStorageSafe } from '@/lib/storage'
import { formatDateBR, isDateOverdue } from '@/lib/dates'
import {
  cn,
  statusEdicaoVideoLabel,
  ESTEIRA_EDICAO_VIDEO,
  tipoReferenciaVideoLabel,
} from '@/lib/utils'
import type {
  Cliente,
  EdicaoVideo,
  EdicaoReferencia,
  EdicaoArquivo,
  Profile,
  StatusEdicaoVideo,
  TipoReferenciaVideo,
} from '@/types/database'

// Cor do dot da seção
const statusDot: Record<StatusEdicaoVideo, string> = {
  pendente: 'text-zinc-400',
  em_edicao: 'text-violet-400',
  em_aprovacao: 'text-amber-400',
  em_alteracao: 'text-red-400',
  conclusao: 'text-emerald-400',
}

// Barra colorida lateral do card (esquerda)
const statusBar: Record<StatusEdicaoVideo, string> = {
  pendente: 'bg-zinc-500/70',
  em_edicao: 'bg-violet-500',
  em_aprovacao: 'bg-amber-500',
  em_alteracao: 'bg-red-500',
  conclusao: 'bg-emerald-500',
}

// Cor forte pro pill de status (dropdown estilizado por status)
const statusPill: Record<StatusEdicaoVideo, string> = {
  pendente:
    'border-zinc-500/50 bg-zinc-500/15 text-zinc-200',
  em_edicao:
    'border-violet-500/50 bg-violet-500/20 text-violet-100',
  em_aprovacao:
    'border-amber-500/60 bg-amber-500/25 text-amber-100',
  em_alteracao:
    'border-red-500/70 bg-red-500/30 text-red-100 font-semibold shadow-[0_0_10px_rgba(239,68,68,0.35)]',
  conclusao:
    'border-emerald-500/60 bg-emerald-500/20 text-emerald-100',
}

/** Conta dias úteis (seg-sex) entre `start` e hoje. */
function diasUteisDesde(start: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  let days = 0
  while (cur < today) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

/** Conta dias úteis entre 2 datas. */
function diasUteisEntre(start: Date, end: Date): number {
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const target = new Date(end)
  target.setHours(0, 0, 0, 0)
  let days = 0
  while (cur < target) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

// =========================================================
// Página principal
// =========================================================

export default function EdicaoVideo() {
  const [edicoes, setEdicoes] = useState<EdicaoVideo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [responsaveisLista, setResponsaveisLista] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtroCliente, setFiltroCliente] = useState<string>('')
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<StatusEdicaoVideo | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EdicaoVideo | null>(null)

  async function load() {
    setLoading(true)
    const [eRes, cRes, rRes] = await Promise.all([
      supabase
        .from('edicoes_video')
        .select('*, cliente:clientes(*), responsavel:profiles!responsavel_id(*)')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').is('arquivado_em', null).order('nome'),
      supabase
        .from('profiles')
        .select('id, nome, avatar_url')
        .eq('ativo', true)
        .eq('aprovado', true)
        .or('cargo.eq.designer,cargos_extras.cs.{designer}')
        .order('nome'),
    ])
    setEdicoes((eRes.data as EdicaoVideo[]) ?? [])
    setClientes((cRes.data as Cliente[]) ?? [])
    setResponsaveisLista((rRes.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Filtro base — cliente + responsavel + busca. Status fica SEPARADO
  // pra regua de contadores mostrar a contagem "total" independente
  // do filtro de status ativo.
  const filteredBase = useMemo(() => {
    let arr = edicoes
    if (filtroCliente) arr = arr.filter((e) => e.cliente_id === filtroCliente)
    if (filtroResponsavel) {
      arr = arr.filter((e) => {
        if (filtroResponsavel === '__sem__') return !e.responsavel_id
        return e.responsavel_id === filtroResponsavel
      })
    }
    if (q.trim()) {
      const term = q.toLowerCase()
      arr = arr.filter(
        (e) =>
          (e.titulo ?? '').toLowerCase().includes(term) ||
          (e.cliente?.nome ?? '').toLowerCase().includes(term),
      )
    }
    return arr
  }, [edicoes, filtroCliente, filtroResponsavel, q])

  // Contadores por status (com base no filteredBase — sem filtro de status)
  const contadores = useMemo(() => {
    const m = new Map<StatusEdicaoVideo, number>()
    for (const s of ESTEIRA_EDICAO_VIDEO) m.set(s, 0)
    for (const e of filteredBase) m.set(e.status, (m.get(e.status) ?? 0) + 1)
    return m
  }, [filteredBase])

  // Aplica o filtro de status (se ativo) por cima do filteredBase
  const filtered = useMemo(() => {
    if (!filtroStatus) return filteredBase
    return filteredBase.filter((e) => e.status === filtroStatus)
  }, [filteredBase, filtroStatus])

  // Agrupa por cliente_id. Ordem dos grupos: cliente com mais itens
  // estourados primeiro (mais urgente); dentro do grupo por ordem asc.
  const porCliente = useMemo(() => {
    const m = new Map<string, EdicaoVideo[]>()
    for (const e of filtered) {
      const key = e.cliente_id ?? '__sem__'
      const arr = m.get(key) ?? []
      arr.push(e)
      m.set(key, arr)
    }
    // Ordena items dentro do grupo por ordem asc
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    }
    // Ordena grupos: mais estourados primeiro, depois mais items totais
    const grupos = Array.from(m.entries()).map(([clienteId, items]) => {
      const estourados = items.filter(
        (i) => i.status !== 'conclusao' && i.prazo && isDateOverdue(i.prazo),
      ).length
      return { clienteId, items, estourados }
    })
    grupos.sort((a, b) => b.estourados - a.estourados || b.items.length - a.items.length)
    return grupos
  }, [filtered])

  return (
    <div>
      <PageHeader
        title="Edição de Vídeo"
        description={`${edicoes.length} item(ns) · SLA: 2 vídeos a cada 3 dias úteis`}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus size={14} /> Nova edição
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              className="pl-8"
              placeholder="Buscar por título ou cliente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="w-56"
          >
            <option value="">Todos clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select
            value={filtroResponsavel}
            onChange={(e) => setFiltroResponsavel(e.target.value)}
            className="w-56"
          >
            <option value="">Todos responsáveis</option>
            <option value="__sem__">Sem responsável</option>
            {responsaveisLista.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Regua de contadores por status — click filtra a lista abaixo */}
      {!loading && edicoes.length > 0 && (
        <ContadorRegua
          contadores={contadores}
          ativo={filtroStatus}
          onClick={(s) => setFiltroStatus(filtroStatus === s ? '' : s)}
        />
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando...
        </div>
      ) : porCliente.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
          <Film size={28} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-zinc-200">
            {edicoes.length === 0
              ? 'Nenhuma edição na esteira'
              : 'Nenhuma edição pros filtros ativos'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {edicoes.length === 0 ? (
              <>Clique em <span className="text-brand-300">Nova edição</span> para começar.</>
            ) : (
              'Ajuste os filtros pra ver mais itens.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {porCliente.map(({ clienteId, items, estourados }) => (
            <ClienteGrupoCard
              key={clienteId}
              cliente={items[0]?.cliente ?? null}
              items={items}
              estourados={estourados}
              onEdit={(e) => {
                setEditing(e)
                setModalOpen(true)
              }}
              onChanged={load}
            />
          ))}
        </div>
      )}

      <EdicaoVideoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        edicao={editing}
        clientes={clientes}
        onSaved={load}
      />
    </div>
  )
}

/* =========================================================
   Accordion / linha horizontal larga (padrão Projetos)
========================================================= */

/* =========================================================
   Regua de contadores por status (clicavel = filtro)
   ========================================================= */

function ContadorRegua({
  contadores,
  ativo,
  onClick,
}: {
  contadores: Map<StatusEdicaoVideo, number>
  ativo: StatusEdicaoVideo | ''
  onClick: (s: StatusEdicaoVideo) => void
}) {
  return (
    <Card className="mb-3">
      <CardBody className="flex flex-wrap items-center gap-1.5 py-2">
        {ESTEIRA_EDICAO_VIDEO.map((s) => {
          const n = contadores.get(s) ?? 0
          const isAtivo = ativo === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => onClick(s)}
              disabled={n === 0}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                isAtivo
                  ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                  : n === 0
                    ? 'border-border bg-bg-soft text-muted opacity-50 cursor-default'
                    : 'border-border bg-bg-soft text-zinc-300 hover:border-brand-500/40 hover:text-brand-300',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full bg-current', statusDot[s])} />
              <span>{statusEdicaoVideoLabel[s]}</span>
              <span className="tabular-nums opacity-80">{n}</span>
            </button>
          )
        })}
        {ativo && (
          <button
            onClick={() => onClick(ativo)}
            className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted hover:text-zinc-200"
          >
            <X size={10} /> limpar filtro
          </button>
        )}
      </CardBody>
    </Card>
  )
}

/* =========================================================
   Card de cliente com N videos agrupados
   ========================================================= */

function ClienteGrupoCard({
  cliente,
  items,
  estourados,
  onEdit,
  onChanged,
}: {
  cliente: Cliente | null
  items: EdicaoVideo[]
  estourados: number
  onEdit: (e: EdicaoVideo) => void
  onChanged: () => void
}) {
  return (
    <Card className="overflow-hidden">
      {/* Header do grupo */}
      <div className="flex items-center justify-between border-b border-border bg-bg-soft/40 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {cliente?.nome ?? 'Sem cliente'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {[cliente?.nicho, cliente?.squad && `Squad ${cliente.squad}`]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
          {estourados > 0 && (
            <span className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
              ⚠ {estourados}/{items.length} estourado{estourados > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[11px] text-muted">
            {items.length} vídeo{items.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {/* Lista compacta */}
      <div className="divide-y divide-border/60">
        {items.map((it) => (
          <LinhaVideo key={it.id} edicao={it} onEdit={() => onEdit(it)} onChanged={onChanged} />
        ))}
      </div>
      {/* Adicionar rapido — cliente ja definido pelo grupo */}
      {cliente && (
        <AdicionarVideoRapido
          cliente={cliente}
          onCreated={onChanged}
          onOpenFull={onEdit}
        />
      )}
    </Card>
  )
}

/* =========================================================
   Mini-form pra criar video ja com cliente definido pelo grupo
   ========================================================= */

function AdicionarVideoRapido({
  cliente,
  onCreated,
  onOpenFull,
}: {
  cliente: Cliente
  onCreated: () => void
  onOpenFull: (e: EdicaoVideo) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [responsavelId, setResponsavelId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!expanded || responsaveis.length > 0) return
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .or('cargo.eq.designer,cargos_extras.cs.{designer}')
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
  }, [expanded, responsaveis.length])

  async function criar(abrirDetalhesAoTerminar: boolean) {
    if (!titulo.trim()) {
      alert('Informe um título.')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('edicoes_video')
      .insert({
        cliente_id: cliente.id,
        titulo: titulo.trim(),
        status: 'pendente',
        responsavel_id: responsavelId || null,
      })
      .select('*, cliente:clientes(*), responsavel:profiles!responsavel_id(*)')
      .single()
    setSaving(false)
    if (error) {
      alert('Erro ao criar: ' + error.message)
      return
    }
    // Reset e recarrega
    setTitulo('')
    setResponsavelId('')
    setExpanded(false)
    onCreated()
    // Se pediu abrir o modal completo, faz isso agora (ex: pra briefing/refs)
    if (abrirDetalhesAoTerminar && data) {
      onOpenFull(data as EdicaoVideo)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-border py-2 text-[11px] text-muted transition-colors hover:bg-bg-soft/30 hover:text-brand-300"
      >
        <Plus size={12} />
        Adicionar vídeo pra {cliente.nome}
      </button>
    )
  }

  return (
    <div className="border-t border-border bg-bg-soft/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !saving) {
              e.preventDefault()
              criar(false)
            } else if (e.key === 'Escape') {
              setExpanded(false)
              setTitulo('')
            }
          }}
          placeholder="Título do vídeo (ex: Corte podcast episódio 12)"
          className="h-8 flex-1 min-w-[220px] text-sm"
        />
        <Select
          value={responsavelId}
          onChange={(e) => setResponsavelId(e.target.value)}
          className="h-8 w-40 text-[11px]"
        >
          <option value="">Sem editor</option>
          {responsaveis.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={() => criar(false)} disabled={saving || !titulo.trim()}>
          {saving ? '...' : 'Criar'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => criar(true)}
          disabled={saving || !titulo.trim()}
          title="Cria e abre pra preencher briefing / refs / arquivos"
        >
          Criar e detalhar
        </Button>
        <button
          onClick={() => {
            setExpanded(false)
            setTitulo('')
          }}
          className="grid h-7 w-7 place-items-center rounded text-muted hover:text-zinc-200"
          title="Cancelar"
        >
          <X size={12} />
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-muted">
        Enter cria · Esc cancela · "Criar e detalhar" cria e abre pra colocar briefing/refs/arquivos
      </p>
    </div>
  )
}

/* =========================================================
   Linha compacta de 1 video
   ========================================================= */

function LinhaVideo({
  edicao,
  onEdit,
  onChanged,
}: {
  edicao: EdicaoVideo
  onEdit: () => void
  onChanged: () => void
}) {
  const concluido = edicao.status === 'conclusao'
  const estourado = !concluido && edicao.prazo ? isDateOverdue(edicao.prazo) : false

  async function mudarStatus(novo: StatusEdicaoVideo) {
    if (novo === edicao.status) return
    await supabase.from('edicoes_video').update({ status: novo }).eq('id', edicao.id)
    onChanged()
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-bg-soft/40',
      )}
    >
      {/* Barra colorida lateral do status — mais grossa e sombreada pra
          bater o olho e ja saber o status */}
      <span
        className={cn(
          'absolute left-0 top-1 bottom-1 w-1 rounded-r',
          statusBar[edicao.status],
        )}
      />

      {/* Ordem + titulo */}
      <div className="min-w-0 flex-1 cursor-pointer pl-2" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className="rounded bg-bg-elev px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
            #{edicao.ordem ?? 0}
          </span>
          <p className="truncate text-sm text-zinc-100">
            {edicao.titulo || 'Sem título'}
          </p>
          {edicao.video_final_url && (
            <a
              href={edicao.video_final_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-muted hover:text-brand-300"
              title="Abrir vídeo final"
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {/* Status pill colorido (dropdown estilizado) — cor forte pra bater o olho */}
      <div className="relative">
        <select
          value={edicao.status}
          onChange={(e) => mudarStatus(e.target.value as StatusEdicaoVideo)}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'h-7 cursor-pointer appearance-none rounded-md border pl-2.5 pr-6 text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500/40',
            statusPill[edicao.status],
          )}
          title="Mover de etapa"
        >
          {ESTEIRA_EDICAO_VIDEO.map((s) => (
            <option key={s} value={s} className="bg-bg-card text-zinc-100">
              {statusEdicaoVideoLabel[s]}
            </option>
          ))}
        </select>
        {/* Setinha custom (appearance-none esconde a padrao) */}
        <ChevronDown
          size={11}
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 opacity-70"
        />
      </div>

      {/* Prazo */}
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] tabular-nums',
          concluido
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : estourado
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : 'border-border bg-bg-soft text-zinc-300',
        )}
        title={estourado ? 'Prazo estourado' : 'Prazo'}
      >
        <Calendar size={10} />
        {edicao.prazo ? formatDateBR(edicao.prazo) : '—'}
        {estourado && <span>⚠</span>}
      </span>

      {/* Responsavel */}
      {edicao.responsavel ? (
        <Avatar
          name={edicao.responsavel.nome}
          url={edicao.responsavel.avatar_url}
          size="sm"
        />
      ) : (
        <span
          className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-border text-muted"
          title="Sem responsável"
        >
          <User size={11} />
        </span>
      )}

      {/* Editar */}
      <button
        onClick={onEdit}
        className="rounded p-1 text-muted opacity-0 transition-opacity hover:bg-bg-elev hover:text-brand-300 group-hover:opacity-100"
        title="Editar detalhes"
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

export function EdicaoAccordion({
  edicao,
  clientes: _clientes,
  expanded,
  onToggle,
  onClick,
  onChanged,
  previewMode = false,
}: {
  edicao: EdicaoVideo
  clientes: Cliente[]
  expanded: boolean
  onToggle: () => void
  onClick: () => void
  onChanged: () => void
  previewMode?: boolean
}) {
  void _clientes // não usado nessa versão simples — futuro: edit inline de cliente

  // SLA: do aprovado_em (ou created_at) até o prazo (calculado pelo banco)
  const ref = edicao.aprovado_em ?? edicao.created_at
  const refDate = new Date(ref)
  const diasUsados = diasUteisDesde(refDate)
  const prazoDate = edicao.prazo ? new Date(edicao.prazo + 'T12:00:00') : null
  const totalSla = prazoDate ? diasUteisEntre(refDate, prazoDate) : 3
  const concluido = edicao.status === 'conclusao'
  const slaEstourado =
    !concluido && edicao.prazo ? isDateOverdue(edicao.prazo) : false
  const slaPct = Math.min(100, Math.round((diasUsados / Math.max(1, totalSla)) * 100))
  const slaBarColor = concluido
    ? 'bg-emerald-500/70'
    : slaEstourado
    ? 'bg-red-500/70'
    : diasUsados >= totalSla - 1
    ? 'bg-amber-500/70'
    : 'bg-sky-500/70'
  const slaLabelTxt = concluido
    ? `SLA cumprido`
    : slaEstourado
    ? `SLA estourado`
    : `${diasUsados}/${totalSla} dias úteis`

  // Counts de assets
  const refCount = (edicao.referencias ?? []).length
  const arqCount = (edicao.arquivos ?? []).length
  const temBriefing = !!edicao.briefing && edicao.briefing.trim().length > 0
  const temVideoFinal = !!edicao.video_final_url

  function go(e: React.MouseEvent) {
    e.stopPropagation()
    onClick()
  }

  // Mudança rápida de status direto pelo dropdown no card.
  async function mudarStatus(novoStatus: StatusEdicaoVideo) {
    if (novoStatus === edicao.status) return
    if (previewMode) {
      alert('Preview: mudança de status desabilitada.')
      return
    }
    await supabase
      .from('edicoes_video')
      .update({ status: novoStatus })
      .eq('id', edicao.id)
    onChanged()
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-bg-card overflow-hidden transition-all',
        expanded
          ? 'border-brand-500/50 shadow-lg shadow-brand-500/5'
          : 'border-border hover:border-brand-500/30',
      )}
    >
      <div
        onClick={onToggle}
        className={cn(
          'relative flex cursor-pointer items-stretch transition-colors',
          expanded ? 'bg-bg-soft/40' : 'hover:bg-bg-soft/40',
        )}
      >
        {/* Barra colorida lateral */}
        <div className={cn('w-1 shrink-0', statusBar[edicao.status])} />

        <div className="flex flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
          {/* Lado esquerdo: chevron + título + meta */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ChevronRight
              size={14}
              className={cn(
                'shrink-0 text-muted transition-transform',
                expanded && 'rotate-90',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {edicao.titulo || edicao.cliente?.nome || 'Sem título'}
                </p>
                <button
                  onClick={go}
                  className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-bg-elev hover:text-brand-300 group-hover:opacity-100"
                  title="Editar"
                >
                  <Pencil size={11} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                <span className="inline-flex items-center rounded-md border border-border bg-bg-soft px-2 py-0.5 text-[11px] text-zinc-300">
                  Edição de vídeo
                </span>
                {edicao.cliente?.nome && <span>· {edicao.cliente.nome}</span>}
                {edicao.cliente?.nicho && <span>· {edicao.cliente.nicho}</span>}
                {edicao.cliente?.squad && <span>· Squad {edicao.cliente.squad}</span>}
              </div>
            </div>
          </div>

          {/* Ícones de assets */}
          <div className="flex items-center gap-1.5">
            <IconBadge on={temBriefing} icon={FileText} title="Briefing preenchido" />
            <IconBadge
              on={refCount > 0}
              icon={LinkIcon}
              title={`${refCount} referência(s)`}
            />
            <IconBadge
              on={arqCount > 0}
              icon={Paperclip}
              title={`${arqCount} arquivo(s)`}
            />
            <IconBadge on={temVideoFinal} icon={Video} title="Vídeo final entregue" />
          </div>

          {/* Direita: status, prazo, responsável */}
          <div className="flex items-center gap-2">
            {edicao.video_final_url && (
              <a
                href={edicao.video_final_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft px-2 py-1 text-[11px] text-zinc-300 hover:border-brand-500/40 hover:text-brand-300"
                title="Abrir vídeo final"
              >
                <ExternalLink size={10} />
                vídeo
              </a>
            )}
            {/* Mover de etapa direto sem abrir modal */}
            <Select
              value={edicao.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => mudarStatus(e.target.value as StatusEdicaoVideo)}
              className="h-7 w-36 text-[11px]"
              title="Mover de etapa"
            >
              {ESTEIRA_EDICAO_VIDEO.map((s) => (
                <option key={s} value={s}>
                  {statusEdicaoVideoLabel[s]}
                </option>
              ))}
            </Select>
            <PrazoBadge prazo={edicao.prazo} concluido={concluido} />
            {edicao.responsavel ? (
              <Avatar
                name={edicao.responsavel.nome}
                url={edicao.responsavel.avatar_url}
                size="sm"
              />
            ) : (
              <span
                className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-border text-muted"
                title="Sem responsável"
              >
                <User size={12} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de SLA */}
      <div>
        <div className="h-1 bg-bg-soft">
          <div
            className={cn('h-full transition-all', slaBarColor)}
            style={{ width: `${slaPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 bg-bg-soft/30 px-4 py-1.5">
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider',
              slaEstourado ? 'text-red-400 font-semibold' : 'text-muted',
            )}
          >
            SLA · lote 2 vídeos × 3 dias úteis
          </span>
          <span
            className={cn(
              'text-[11px] font-semibold',
              concluido ? 'text-emerald-400' : slaEstourado ? 'text-red-400' : 'text-zinc-200',
            )}
          >
            {slaLabelTxt}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-5">
          <ExpandedDetails edicao={edicao} onEdit={onClick} />
        </div>
      )}
    </div>
  )
}

function IconBadge({
  on,
  icon: Icon,
  title,
}: {
  on: boolean
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md border',
        on
          ? 'border-brand-500/40 bg-brand-500/15 text-brand-300'
          : 'border-border bg-bg-soft text-muted',
      )}
    >
      <Icon size={12} />
    </span>
  )
}

function PrazoBadge({
  prazo,
  concluido,
}: {
  prazo: string | null
  concluido: boolean
}) {
  if (!prazo) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-bg-soft px-2 py-1 text-[11px] text-muted">
        <Calendar size={10} /> Sem prazo
      </span>
    )
  }
  const atrasada = !concluido && isDateOverdue(prazo)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] whitespace-nowrap',
        atrasada
          ? 'border-red-500/40 bg-red-500/10 text-red-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      )}
    >
      <Calendar size={10} />
      {formatDateBR(prazo)}
    </span>
  )
}

function ExpandedDetails({
  edicao,
  onEdit,
}: {
  edicao: EdicaoVideo
  onEdit: () => void
}) {
  return (
    <div className="space-y-3 text-sm">
      {edicao.briefing && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Briefing</p>
          <p className="whitespace-pre-wrap text-xs text-zinc-200 leading-relaxed">
            {edicao.briefing}
          </p>
        </div>
      )}
      {(edicao.referencias ?? []).length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            Referências ({edicao.referencias.length})
          </p>
          <ul className="space-y-1">
            {edicao.referencias.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <Badge tone="neutral" className="text-[9px]">
                  {tipoReferenciaVideoLabel[r.tipo]}
                </Badge>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-brand-300 hover:underline"
                >
                  {r.descricao || r.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(edicao.arquivos ?? []).length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            Arquivos brutos ({edicao.arquivos.length})
          </p>
          <ul className="space-y-1">
            {edicao.arquivos.map((a, i) => (
              <li key={i} className="text-xs">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-200 hover:text-brand-300 hover:underline"
                >
                  {a.nome}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {edicao.observacoes && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            Observações
          </p>
          <p className="whitespace-pre-wrap text-xs text-muted">{edicao.observacoes}</p>
        </div>
      )}
      <div className="pt-1">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil size={12} /> Editar detalhes
        </Button>
      </div>
    </div>
  )
}

/* =========================================================
   Modal de criar/editar (mantido)
========================================================= */

export function EdicaoVideoModal({
  open,
  onClose,
  edicao,
  clientes,
  onSaved,
  previewMode = false,
}: {
  open: boolean
  onClose: () => void
  edicao: EdicaoVideo | null
  clientes: Cliente[]
  onSaved: () => void
  previewMode?: boolean
}) {
  const [form, setForm] = useState<{
    cliente_id: string
    titulo: string
    status: StatusEdicaoVideo
    responsavel_id: string
    aprovado_em: string | null
    briefing: string
    referencias: EdicaoReferencia[]
    arquivos: EdicaoArquivo[]
    video_final_url: string
    observacoes: string
  }>({
    cliente_id: '',
    titulo: '',
    status: 'pendente',
    responsavel_id: '',
    aprovado_em: null,
    briefing: '',
    referencias: [],
    arquivos: [],
    video_final_url: '',
    observacoes: '',
  })
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingFinal, setUploadingFinal] = useState(false)
  const [uploadingArquivos, setUploadingArquivos] = useState(false)
  const [novoArquivoUrl, setNovoArquivoUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const videoFinalInputRef = useRef<HTMLInputElement | null>(null)

  /** Detecta o "tipo" do link pra rotular o item (Drive/YouTube/Vimeo/Link). */
  function detectTipoLink(url: string): string {
    const low = url.toLowerCase()
    if (low.includes('drive.google')) return 'drive'
    if (low.includes('youtube.com') || low.includes('youtu.be')) return 'youtube'
    if (low.includes('vimeo.com')) return 'vimeo'
    return 'link'
  }

  /** Extrai um "nome amigável" do URL pra exibir na lista. */
  function nomeDoLink(url: string): string {
    try {
      const u = new URL(url)
      // Pra Drive folder/file mostra o host + um sufixo curto
      if (u.hostname.includes('drive.google')) return 'Google Drive'
      if (u.hostname.includes('youtu')) return 'YouTube'
      if (u.hostname.includes('vimeo')) return 'Vimeo'
      return u.hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }

  function addLinkArquivo() {
    const url = novoArquivoUrl.trim()
    if (!url) return
    setForm((f) => ({
      ...f,
      arquivos: [
        ...f.arquivos,
        { nome: nomeDoLink(url), tamanho: 0, tipo: detectTipoLink(url), url },
      ],
    }))
    setNovoArquivoUrl('')
  }

  useEffect(() => {
    if (!open) return
    if (previewMode) {
      setResponsaveis([])
    } else {
      supabase
        .from('profiles')
        .select('*')
        .eq('ativo', true)
        .eq('aprovado', true)
        .or('cargo.eq.designer,cargos_extras.cs.{designer}')
        .order('nome')
        .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
    }

    if (edicao) {
      setForm({
        cliente_id: edicao.cliente_id,
        titulo: edicao.titulo ?? '',
        status: edicao.status,
        responsavel_id: edicao.responsavel_id ?? '',
        aprovado_em: edicao.aprovado_em,
        briefing: edicao.briefing ?? '',
        referencias: edicao.referencias ?? [],
        arquivos: edicao.arquivos ?? [],
        video_final_url: edicao.video_final_url ?? '',
        observacoes: edicao.observacoes ?? '',
      })
    } else {
      setForm({
        cliente_id: '',
        titulo: '',
        status: 'pendente',
        responsavel_id: '',
        aprovado_em: null,
        briefing: '',
        referencias: [],
        arquivos: [],
        video_final_url: '',
        observacoes: '',
      })
    }
  }, [open, edicao, previewMode])

  async function save() {
    if (!form.cliente_id) {
      alert('Selecione um cliente.')
      return
    }
    if (previewMode) {
      alert('Preview: salvamento desabilitado.')
      onClose()
      return
    }
    setSaving(true)
    const payload = {
      cliente_id: form.cliente_id,
      titulo: form.titulo.trim() || null,
      status: form.status,
      responsavel_id: form.responsavel_id || null,
      aprovado_em: form.aprovado_em,
      briefing: form.briefing || null,
      referencias: form.referencias,
      arquivos: form.arquivos,
      video_final_url: form.video_final_url.trim() || null,
      observacoes: form.observacoes || null,
    }
    if (edicao) {
      await supabase.from('edicoes_video').update(payload).eq('id', edicao.id)
    } else {
      await supabase.from('edicoes_video').insert(payload)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  async function excluir() {
    if (!edicao) return
    if (!confirm('Excluir essa edição de vídeo?')) return
    if (previewMode) {
      alert('Preview: exclusão desabilitada.')
      onClose()
      return
    }
    await supabase.from('edicoes_video').delete().eq('id', edicao.id)
    onSaved()
    onClose()
  }

  function toggleAprovado() {
    setForm({
      ...form,
      aprovado_em: form.aprovado_em ? null : new Date().toISOString(),
    })
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    if (previewMode) {
      alert('Preview: upload desabilitado.')
      return
    }
    setUploadingArquivos(true)
    try {
      const novos: EdicaoArquivo[] = []
      for (const file of Array.from(files)) {
        const url = await uploadToStorageSafe(file, 'edicao-video', 'webdesign-assets')
        if (!url) continue
        novos.push({ nome: file.name, tamanho: file.size, tipo: file.type, url })
      }
      if (novos.length > 0) {
        setForm((f) => ({ ...f, arquivos: [...f.arquivos, ...novos] }))
      }
    } finally {
      setUploadingArquivos(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function onVideoFinalSelected(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (previewMode) {
      alert('Preview: upload desabilitado.')
      return
    }
    setUploadingFinal(true)
    try {
      const url = await uploadToStorageSafe(file, 'edicao-video-final', 'webdesign-assets')
      if (url) setForm((f) => ({ ...f, video_final_url: url }))
    } finally {
      setUploadingFinal(false)
      if (videoFinalInputRef.current) videoFinalInputRef.current.value = ''
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-3xl"
      title={edicao ? 'Editar edição de vídeo' : 'Nova edição de vídeo'}
      footer={
        <div className="flex items-center justify-between">
          {edicao ? (
            <Button variant="danger" size="sm" onClick={excluir}>
              <Trash2 size={14} /> Excluir
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            {(uploadingArquivos || uploadingFinal) && (
              <span className="text-[11px] text-amber-300">
                ⚠ Aguarde upload terminar antes de salvar
              </span>
            )}
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={saving || uploadingArquivos || uploadingFinal}
              title={
                uploadingArquivos || uploadingFinal
                  ? 'Aguarde upload terminar'
                  : undefined
              }
            >
              {saving ? 'Salvando...' : edicao ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente">
            <Select
              value={form.cliente_id}
              onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
              disabled={!!edicao}
            >
              <option value="">—</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as StatusEdicaoVideo })
              }
            >
              {ESTEIRA_EDICAO_VIDEO.map((s) => (
                <option key={s} value={s}>
                  {statusEdicaoVideoLabel[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Título">
          <Input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex.: Reel — Antes e Depois Camila"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsável (editor)">
            <Select
              value={form.responsavel_id}
              onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
            >
              <option value="">—</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Aprovado pelo cliente">
            <button
              type="button"
              onClick={toggleAprovado}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors',
                form.aprovado_em
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-border bg-bg-soft text-muted hover:border-brand-500/40 hover:text-zinc-200',
              )}
            >
              {form.aprovado_em ? (
                <>✓ Aprovado em {formatDateBR(form.aprovado_em)}</>
              ) : (
                <>○ Marcar como aprovado</>
              )}
            </button>
            <p className="mt-1 text-[10px] text-muted">
              Define o ponto de partida do prazo (lote 2 vídeos × 3 dias úteis).
            </p>
          </Field>
        </div>

        <Field label="Briefing / Contexto">
          <Textarea
            value={form.briefing}
            onChange={(e) => setForm({ ...form, briefing: e.target.value })}
            placeholder="Descreva o objetivo do vídeo, formato, tom, duração estimada, peças-chave..."
            className="min-h-[90px]"
          />
        </Field>

        <ReferenciasField
          values={form.referencias}
          onChange={(referencias) => setForm({ ...form, referencias })}
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Arquivos brutos / referências</Label>
            <div className="flex items-center gap-2">
              {uploadingArquivos && (
                <span className="text-[11px] text-amber-300">Enviando...</span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingArquivos}
              >
                <Upload size={13} /> Adicionar arquivos
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
          {/* Adicionar link (Drive/YouTube/Vimeo) — fica logo acima da lista,
              evita ter que subir o arquivo quando o cliente entrega via Drive. */}
          <div className="mb-1.5 grid grid-cols-[1fr_auto] gap-2">
            <Input
              value={novoArquivoUrl}
              onChange={(e) => setNovoArquivoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLinkArquivo()
                }
              }}
              placeholder="Cole um link do Drive/YouTube/Vimeo (pasta de brutos, etc)"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addLinkArquivo}
              disabled={!novoArquivoUrl.trim()}
            >
              <LinkIcon size={13} /> Adicionar link
            </Button>
          </div>
          {form.arquivos.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-bg-soft px-3 py-4 text-center text-xs text-muted">
              Suba briefings, prints, áudios de referência, transcrições — o que ajudar
              o editor. Ou cole um link do Drive acima.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {form.arquivos.map((a, i) => {
                const isLink = a.tamanho === 0
                return (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-soft px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isLink && (
                      <Badge tone="neutral" className="shrink-0 text-[9px] uppercase">
                        {a.tipo}
                      </Badge>
                    )}
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs text-zinc-200 hover:text-brand-300 hover:underline"
                      title={isLink ? a.url : a.nome}
                    >
                      {isLink ? a.url : a.nome}
                    </a>
                    {!isLink && (
                      <span className="shrink-0 text-[11px] text-muted">
                        {formatBytes(a.tamanho)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        arquivos: f.arquivos.filter((_, idx) => idx !== i),
                      }))
                    }
                    className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
                  >
                    <X size={13} />
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </div>

        <Field label="Vídeo final entregue">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              value={form.video_final_url}
              onChange={(e) => setForm({ ...form, video_final_url: e.target.value })}
              placeholder="Cole o link (Drive, Vimeo, YouTube) OU use upload ao lado"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => videoFinalInputRef.current?.click()}
              disabled={uploadingFinal}
            >
              <Upload size={13} /> {uploadingFinal ? 'Enviando...' : 'Upload'}
            </Button>
            <input
              ref={videoFinalInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => onVideoFinalSelected(e.target.files)}
            />
          </div>
          {form.video_final_url && (
            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
              <a
                href={form.video_final_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand-300 hover:underline"
              >
                <ExternalLink size={11} /> Abrir vídeo final
              </a>
              <button
                type="button"
                onClick={() => setForm({ ...form, video_final_url: '' })}
                className="text-muted hover:text-red-300"
                title="Remover"
              >
                <X size={11} />
              </button>
            </div>
          )}
          <p className="mt-1 text-[10px] text-muted">
            Pra arquivos grandes (acima de 50MB) prefira o link do Drive/Vimeo.
          </p>
        </Field>

        <Field label="Observações">
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            placeholder="Notas internas (não vai pro cliente)."
            className="min-h-[60px]"
          />
        </Field>
      </div>
    </Modal>
  )
}

/* =========================================================
   Campo de Referências (chips de links) — type auto-detect
========================================================= */

function ReferenciasField({
  values,
  onChange,
}: {
  values: EdicaoReferencia[]
  onChange: (next: EdicaoReferencia[]) => void
}) {
  const [url, setUrl] = useState('')
  const [descricao, setDescricao] = useState('')

  function detectTipo(u: string): TipoReferenciaVideo {
    const low = u.toLowerCase()
    if (low.includes('drive.google')) return 'drive'
    if (low.includes('youtube.com') || low.includes('youtu.be')) return 'youtube'
    if (low.includes('vimeo.com')) return 'vimeo'
    return 'link'
  }

  function add() {
    const u = url.trim()
    if (!u) return
    onChange([
      ...values,
      { tipo: detectTipo(u), url: u, descricao: descricao.trim() || null },
    ])
    setUrl('')
    setDescricao('')
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <Label>Referências (Drive, YouTube, links)</Label>
      {values.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {values.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-soft px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge tone="neutral" className="text-[9px] shrink-0">
                  {tipoReferenciaVideoLabel[r.tipo]}
                </Badge>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs text-brand-300 hover:underline"
                  title={r.url}
                >
                  {r.descricao || r.url}
                </a>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Cole o URL (Drive, YouTube, Vimeo ou link genérico)"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!url.trim()}>
          <Plus size={11} />
        </Button>
      </div>
      <Input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição opcional (ex.: 'Pasta com brutos da gravação')"
        className="mt-2 text-xs"
      />
      <p className="mt-1 text-[10px] text-muted">
        O tipo é detectado automaticamente pela URL.
      </p>
    </div>
  )
}

/* =========================================================
   Utils inline
========================================================= */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  )
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
