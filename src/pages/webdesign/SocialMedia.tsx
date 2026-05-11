import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Search,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  Upload,
  Trash2,
  FolderOpen,
  Pencil,
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
import { uploadToStorageSafe, stripBlobUrl, stripBlobUrls, isDeadBlobUrl } from '@/lib/storage'
import { differenceInDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  cn,
  statusSocialMediaLabel,
  ESTEIRA_SOCIAL_MEDIA,
  formatoSocialMediaLabel,
  FORMATOS_SOCIAL_MEDIA,
} from '@/lib/utils'

/** Label de prazo: atrasada → "Atrasada Nd", caso contrário → "dd/MM". */
function prazoLabel(dateISO: string | null | undefined, overdue: boolean): string {
  if (!dateISO) return 'Sem prazo'
  try {
    const d = parseISO(dateISO)
    if (overdue) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const days = differenceInDays(today, d)
      return `Atrasada ${Math.max(1, days)}d`
    }
    return format(d, 'dd/MM', { locale: ptBR })
  } catch {
    return '—'
  }
}
import type {
  Cliente,
  Profile,
  PlanejamentoSocialMedia,
  ItemSocialMedia,
  StatusSocialMedia,
  FormatoSocialMedia,
} from '@/types/database'

const statusTone: Record<StatusSocialMedia, 'neutral' | 'warning' | 'success' | 'info' | 'brand' | 'danger'> = {
  pendente: 'neutral',
  design: 'brand',
  design_finalizado: 'info',
  alteracao: 'warning',
  em_aprovacao: 'warning',
  conclusao: 'success',
}

const statusDot: Record<StatusSocialMedia, string> = {
  pendente: 'bg-zinc-500',
  design: 'bg-violet-500',
  design_finalizado: 'bg-sky-500',
  alteracao: 'bg-red-500',
  em_aprovacao: 'bg-amber-500',
  conclusao: 'bg-emerald-500',
}

/** Cores customizadas por formato — todos no tom stone (cinza-bege) */
const formatoBadgeClass: Record<FormatoSocialMedia, string> = {
  carrossel: 'bg-stone-500/20 text-stone-300 border-stone-500/40',
  estatico: 'bg-stone-500/20 text-stone-300 border-stone-500/40',
  reel: 'bg-stone-500/20 text-stone-300 border-stone-500/40',
  outro: 'bg-stone-500/20 text-stone-300 border-stone-500/40',
}

/**
 * Upload pro Supabase Storage (bucket `webdesign-assets`).
 * Pré-req: migration 006-storage rodada.
 */
async function uploadArquivo(file: File, folder = 'social/misc'): Promise<string> {
  const url = await uploadToStorageSafe(file, folder, 'webdesign-assets')
  return url ?? ''
}

/** Adiciona N dias úteis (seg-sex) a uma data. */
function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Calcula prazo da próxima arte respeitando a cadência (3 artes a cada 3 dias úteis). */
function proximoPrazo(items: ItemSocialMedia[]): string {
  const byPrazo = new Map<string, number>()
  for (const it of items) {
    if (it.prazo) byPrazo.set(it.prazo, (byPrazo.get(it.prazo) ?? 0) + 1)
  }
  const sorted = Array.from(byPrazo.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  // encontra primeiro batch com menos de 3 artes
  for (const [prazo, count] of sorted) {
    if (count < 3) return prazo
  }

  // todos cheios — cria novo batch 3 dias úteis após o último
  if (sorted.length > 0) {
    const last = sorted[sorted.length - 1][0]
    const lastDate = new Date(last + 'T00:00:00')
    return toISODate(addBusinessDays(lastDate, 3))
  }

  // nenhum item ainda — começa 3 dias úteis a partir de hoje
  return toISODate(addBusinessDays(new Date(), 3))
}

export default function SocialMedia() {
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoSocialMedia[]>([])
  const [items, setItems] = useState<ItemSocialMedia[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [q, setQ] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const [pRes, iRes, cRes] = await Promise.all([
      supabase
        .from('producoes_social_media')
        .select('*, cliente:clientes(*), responsavel:profiles(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('producoes_social_media_items')
        // Explicita FK porque a tabela tem 2 relações com profiles
        // (responsavel_id + publicado_por). Sem isso, Supabase devolve PGRST201.
        .select('*, responsavel:profiles!responsavel_id(*)')
        .order('ordem', { ascending: true }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setPlanejamentos((pRes.data as PlanejamentoSocialMedia[]) ?? [])
    setItems((iRes.data as ItemSocialMedia[]) ?? [])
    setClientes((cRes.data as Cliente[]) ?? [])
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    load()
    // Auto-refresh a cada 30s pra capturar uploads / mudanças feitos
    // por outras pessoas em paralelo (sem flicker de loading).
    const id = setInterval(() => load(true), 30000)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const [novoPlanModalOpen, setNovoPlanModalOpen] = useState(false)

  function abrirNovoPlanejamento() {
    setNovoPlanModalOpen(true)
  }

  async function criarPlanejamentoVazio(payload: {
    cliente_id: string | null
    titulo: string
    mes_referencia: string
    prazo: string | null
  }) {
    const { data, error } = await supabase
      .from('producoes_social_media')
      .insert({
        cliente_id: payload.cliente_id || null,
        titulo: payload.titulo,
        mes_referencia: payload.mes_referencia,
        prazo: payload.prazo,
      })
      .select()
      .single()
    if (error) {
      alert(`Erro ao criar planejamento: ${error.message}`)
      return
    }
    const novo = data as PlanejamentoSocialMedia | null
    await load()
    if (novo?.id) {
      setExpandedPlans((s) => new Set(s).add(novo.id))
    }
    setNovoPlanModalOpen(false)
  }

  const filtered = useMemo(() => {
    return planejamentos.filter((p) => {
      if (fCliente && p.cliente_id !== fCliente) return false
      if (q) {
        const hay = `${p.titulo} ${p.cliente?.nome ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [planejamentos, q, fCliente])

  const itemsByPlan = useMemo(() => {
    const m = new Map<string, ItemSocialMedia[]>()
    for (const i of items) {
      const arr = m.get(i.producao_id) ?? []
      arr.push(i)
      m.set(i.producao_id, arr)
    }
    return m
  }, [items])

  // Separa em ativos (em andamento) e concluídos (todas as artes em 'conclusao')
  const { ativos, concluidos } = useMemo(() => {
    const a: PlanejamentoSocialMedia[] = []
    const c: PlanejamentoSocialMedia[] = []
    for (const p of filtered) {
      const its = itemsByPlan.get(p.id) ?? []
      const completed = its.length > 0 && its.every((i) => i.status === 'conclusao')
      ;(completed ? c : a).push(p)
    }
    return { ativos: a, concluidos: c }
  }, [filtered, itemsByPlan])

  const [showConcluidos, setShowConcluidos] = useState(false)

  return (
    <div>
      <PageHeader
        title="Produção Social Media"
        description={`${planejamentos.length} planejamento(s) · ${items.length} art${items.length === 1 ? 'e' : 'es'} no mês`}
        actions={
          <Button onClick={abrirNovoPlanejamento}>
            <Plus size={14} /> Novo planejamento
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por cliente ou título do planejamento..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={fCliente} onChange={(e) => setFCliente(e.target.value)} className="w-56">
            <option value="">Todos clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
          <p className="text-sm text-zinc-200">Nenhum planejamento encontrado</p>
          <p className="mt-1 text-xs text-muted">
            Clique em <span className="text-brand-300">Novo planejamento</span> para começar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Planejamentos em andamento (esteira) */}
          {ativos.length === 0 && concluidos.length > 0 && (
            <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-6 text-center">
              <p className="text-sm text-zinc-300">Tudo concluído por aqui 🎉</p>
              <p className="mt-1 text-xs text-muted">
                Os planejamentos finalizados estão na seção abaixo.
              </p>
            </div>
          )}
          {ativos.map((p) => (
            <PlanejamentoCard
              key={p.id}
              planejamento={p}
              items={itemsByPlan.get(p.id) ?? []}
              clientes={clientes}
              expanded={expandedPlans.has(p.id)}
              expandedItemId={expandedItemId}
              onToggle={() => {
                setExpandedPlans((s) => {
                  const n = new Set(s)
                  if (n.has(p.id)) n.delete(p.id)
                  else n.add(p.id)
                  return n
                })
              }}
              onItemToggle={(itemId) =>
                setExpandedItemId((cur) => (cur === itemId ? null : itemId))
              }
              onChanged={() => load(true)}
            />
          ))}

          {/* Concluídos — seção colapsável que "desce" os finalizados */}
          {concluidos.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowConcluidos((v) => !v)}
                className="group flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-soft/40 px-4 py-2.5 transition-colors hover:bg-bg-soft/70"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                    Concluídos
                  </span>
                  <Badge tone="success" className="text-[10px]">
                    {concluidos.length}
                  </Badge>
                  <span className="text-[11px] text-muted">
                    Planejamentos com 100% das artes finalizadas
                  </span>
                </span>
                <ChevronDown
                  size={14}
                  className={cn(
                    'text-muted transition-transform duration-200',
                    showConcluidos && 'rotate-180',
                  )}
                />
              </button>
              {showConcluidos && (
                <div className="mt-3 flex flex-col gap-3 animate-fade-in">
                  {concluidos.map((p) => (
                    <PlanejamentoCard
                      key={p.id}
                      planejamento={p}
                      items={itemsByPlan.get(p.id) ?? []}
                      clientes={clientes}
                      expanded={expandedPlans.has(p.id)}
                      expandedItemId={expandedItemId}
                      onToggle={() => {
                        setExpandedPlans((s) => {
                          const n = new Set(s)
                          if (n.has(p.id)) n.delete(p.id)
                          else n.add(p.id)
                          return n
                        })
                      }}
                      onItemToggle={(itemId) =>
                        setExpandedItemId((cur) => (cur === itemId ? null : itemId))
                      }
                      onChanged={() => load(true)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <NovoPlanejamentoModal
        open={novoPlanModalOpen}
        onClose={() => setNovoPlanModalOpen(false)}
        clientes={clientes}
        onCreate={criarPlanejamentoVazio}
      />
    </div>
  )
}

/* =========================================================
   Card do planejamento — acordeão nível 1
   ========================================================= */

function PlanejamentoCard({
  planejamento,
  items,
  clientes,
  expanded,
  expandedItemId,
  onToggle,
  onItemToggle,
  onChanged,
}: {
  planejamento: PlanejamentoSocialMedia
  items: ItemSocialMedia[]
  clientes: Cliente[]
  expanded: boolean
  expandedItemId: string | null
  onToggle: () => void
  onItemToggle: (itemId: string) => void
  onChanged: () => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(planejamento.titulo)
  const [editingResp, setEditingResp] = useState(false)
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])

  useEffect(() => {
    setTitleValue(planejamento.titulo)
  }, [planejamento.titulo])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .eq('cargo', 'designer')
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
  }, [])

  async function commitTitle() {
    const novo = titleValue.trim()
    if (!novo || novo === planejamento.titulo) {
      setTitleValue(planejamento.titulo)
      setEditingTitle(false)
      return
    }
    await supabase
      .from('producoes_social_media')
      .update({ titulo: novo })
      .eq('id', planejamento.id)
    setEditingTitle(false)
    onChanged()
  }

  async function updateResponsavel(val: string) {
    await supabase
      .from('producoes_social_media')
      .update({ responsavel_id: val || null })
      .eq('id', planejamento.id)
    setEditingResp(false)
    onChanged()
  }

  const counts = useMemo(() => {
    const c: Record<StatusSocialMedia, number> = {
      pendente: 0,
      design: 0,
      design_finalizado: 0,
      alteracao: 0,
      em_aprovacao: 0,
      conclusao: 0,
    }
    for (const i of items) c[i.status]++
    return c
  }, [items])

  const progressPct = items.length === 0 ? 0 : Math.round((counts.conclusao / items.length) * 100)

  // SLA: prazo máximo de 16 dias a partir da criação do planejamento
  const SLA_DIAS = 16
  const startMs = new Date(planejamento.created_at).getTime()
  const diasUsados = Math.max(
    0,
    Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24)),
  )
  const allDone = items.length > 0 && counts.conclusao === items.length
  const slaEstourado = !allDone && diasUsados > SLA_DIAS
  const slaPct = Math.min(100, Math.round((diasUsados / SLA_DIAS) * 100))
  const slaBarColor = allDone
    ? 'bg-emerald-500/70'
    : slaEstourado
    ? 'bg-red-500/70'
    : diasUsados >= 12
    ? 'bg-amber-500/70'
    : 'bg-sky-500/70'
  const slaLabel = allDone
    ? `SLA cumprido em ${diasUsados}d`
    : slaEstourado
    ? `SLA estourado · +${diasUsados - SLA_DIAS}d`
    : `${diasUsados}/${SLA_DIAS} dias`

  async function excluir() {
    if (!confirm(`Excluir o planejamento "${planejamento.titulo}" e todos os items?`)) return
    await supabase.from('producoes_social_media').delete().eq('id', planejamento.id)
    onChanged()
  }

  async function addItem() {
    const prazo = proximoPrazo(items)
    const { error } = await supabase.from('producoes_social_media_items').insert({
      producao_id: planejamento.id,
      formato: 'estatico',
      titulo: 'Nova arte',
      status: 'pendente',
      prazo,
      ordem: items.length + 1,
      artes_prontas: [],
    })
    if (error) {
      alert(`Erro ao criar arte: ${error.message}`)
      return
    }
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
          'flex cursor-pointer items-center gap-3 px-4 py-3',
          expanded ? 'bg-bg-soft/40' : 'hover:bg-bg-soft/40',
        )}
      >
        <ChevronRight
          size={14}
          className={cn('shrink-0 text-muted transition-transform', expanded && 'rotate-90')}
        />
        <FolderOpen size={16} className="shrink-0 text-brand-300" />
        <div className="min-w-0 flex-1">
          <div className="group flex items-center gap-1.5">
            {editingTitle ? (
              <input
                type="text"
                autoFocus
                value={titleValue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                  if (e.key === 'Escape') {
                    setTitleValue(planejamento.titulo)
                    setEditingTitle(false)
                  }
                }}
                className="w-full min-w-0 rounded-md border border-brand-500 bg-bg-soft px-2 py-0.5 text-sm font-semibold text-zinc-100 focus:outline-none"
              />
            ) : (
              <>
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {planejamento.titulo}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingTitle(true)
                  }}
                  className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-bg-elev hover:text-brand-300 group-hover:opacity-100"
                  title="Editar título"
                >
                  <Pencil size={11} />
                </button>
              </>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <Badge tone="brand">
              {items.length} {items.length === 1 ? 'arte' : 'artes'}
            </Badge>
            <Badge tone={progressPct === 100 ? 'success' : 'neutral'}>{progressPct}% concluído</Badge>
            {planejamento.cliente?.nome && <span>· {planejamento.cliente.nome}</span>}
            {planejamento.cliente?.squad && <span>· Squad {planejamento.cliente.squad}</span>}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1">
          {ESTEIRA_SOCIAL_MEDIA.map((s) =>
            counts[s] > 0 ? (
              <span
                key={s}
                title={`${statusSocialMediaLabel[s]}: ${counts[s]}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-soft px-2 py-0.5 text-[10px] text-zinc-300"
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[s])} />
                {counts[s]}
              </span>
            ) : null,
          )}
        </div>

        <div className="flex items-center gap-2">
          <PrazoInlinePlanejamento planejamento={planejamento} onUpdated={onChanged} />
          <div onClick={(e) => e.stopPropagation()}>
            {editingResp ? (
              <select
                autoFocus
                value={planejamento.responsavel_id ?? ''}
                onChange={(e) => updateResponsavel(e.target.value)}
                onBlur={() => setEditingResp(false)}
                className="h-7 rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
              >
                <option value="">—</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setEditingResp(true)}
                className="grid h-6 w-6 place-items-center rounded-full transition-all hover:ring-2 hover:ring-brand-500/40"
                title={
                  planejamento.responsavel?.nome
                    ? `Responsável: ${planejamento.responsavel.nome}`
                    : 'Clique para adicionar responsável'
                }
              >
                {planejamento.responsavel ? (
                  <Avatar name={planejamento.responsavel.nome} size="sm" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-border text-muted">
                    <User size={10} />
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Barra de SLA (prazo máximo 16 dias) */}
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
            SLA · prazo máximo 16 dias
          </span>
          <span
            className={cn(
              'text-[11px] font-semibold',
              allDone
                ? 'text-emerald-400'
                : slaEstourado
                ? 'text-red-400'
                : 'text-zinc-200',
            )}
          >
            {slaLabel}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {/* Barra superior com observações + excluir */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-bg-soft/30 px-4 py-2.5">
            {planejamento.observacoes ? (
              <p className="text-[11px] text-muted italic flex-1">{planejamento.observacoes}</p>
            ) : (
              <span className="text-[11px] text-muted italic">Sem observações.</span>
            )}
            <button
              onClick={excluir}
              className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:underline"
            >
              <Trash2 size={10} /> Excluir planejamento
            </button>
          </div>

          {/* Briefing do planejamento */}
          <BriefingPanel planejamento={planejamento} onChanged={onChanged} />

          {/* Identidade Visual do planejamento (logo, paleta, manual de marca) */}
          <IdentidadeVisualPanel planejamento={planejamento} onChanged={onChanged} />

          {/* Fotos / Referências do planejamento (compartilhadas entre todas as artes) */}
          <ReferenciasPanel planejamento={planejamento} onChanged={onChanged} />

          {/* Lista de items */}
          <div className="divide-y divide-border">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted italic">
                Nenhuma arte adicionada.
              </p>
            ) : (
              items.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  expanded={expandedItemId === it.id}
                  onToggle={() => onItemToggle(it.id)}
                  onChanged={onChanged}
                />
              ))
            )}
          </div>

          <div className="border-t border-border p-3">
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus size={12} /> Nova arte
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   Painel de briefing do planejamento
   ========================================================= */

function BriefingPanel({
  planejamento,
  onChanged,
}: {
  planejamento: PlanejamentoSocialMedia
  onChanged: () => void
}) {
  const [form, setForm] = useState({
    briefing_pdf_url: planejamento.briefing_pdf_url ?? '',
  })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [uploading, setUploading] = useState(false)
  const firstRenderRef = useRef(true)

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    const timer = setTimeout(async () => {
      setSaveState('saving')
      await supabase
        .from('producoes_social_media')
        .update({
          briefing_pdf_url: form.briefing_pdf_url || null,
        })
        .eq('id', planejamento.id)
      setSaveState('saved')
      onChanged()
      setTimeout(() => setSaveState('idle'), 1500)
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  async function handleUpload(file: File | null) {
    if (!file) return
    setUploading(true)
    const url = await uploadArquivo(file, 'social/briefings')
    if (url) setForm((f) => ({ ...f, briefing_pdf_url: url }))
    setUploading(false)
  }

  return (
    <div className="border-b border-border bg-bg-soft/20 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <FileText size={14} className="text-brand-300" />
        <h4 className="text-sm font-semibold">Briefing</h4>
        <span className="text-[11px] text-muted">— briefing do planejamento (cliente)</span>
        <span
          className={cn(
            'ml-auto text-[11px] transition-opacity',
            saveState === 'saving' && 'text-muted opacity-100',
            saveState === 'saved' && 'text-emerald-400 opacity-100',
            saveState === 'idle' && 'opacity-0',
          )}
        >
          {saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? '✓ Salvo' : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={form.briefing_pdf_url}
          onChange={(e) => setForm({ ...form, briefing_pdf_url: e.target.value })}
          placeholder="Link do PDF do briefing (Drive, Dropbox...) OU use Upload ao lado"
          className="flex-1 min-w-[200px]"
        />
        <FileUploadButton
          accept="application/pdf,.doc,.docx"
          onFile={handleUpload}
          busy={uploading}
          label="Upload PDF"
        />
        {form.briefing_pdf_url && (
          <a
            href={form.briefing_pdf_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs text-zinc-200 hover:bg-bg-elev"
          >
            <ExternalLink size={12} />
            Abrir
          </a>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   Painel de referências do planejamento (compartilhado)
   ========================================================= */

function ReferenciasPanel({
  planejamento,
  onChanged,
}: {
  planejamento: PlanejamentoSocialMedia
  onChanged: () => void
}) {
  const [refs, setRefs] = useState<string[]>([...(planejamento.referencias ?? [])])
  const [novaUrl, setNovaUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const firstRenderRef = useRef(true)

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    const timer = setTimeout(async () => {
      setSaveState('saving')
      await supabase
        .from('producoes_social_media')
        .update({ referencias: refs })
        .eq('id', planejamento.id)
      setSaveState('saved')
      onChanged()
      setTimeout(() => setSaveState('idle'), 1500)
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const u = await uploadArquivo(file, 'social/referencias')
      if (u) urls.push(u)
    }
    if (urls.length > 0) setRefs((r) => [...r, ...urls])
    setUploading(false)
  }

  function addUrl() {
    const url = novaUrl.trim()
    if (!url) return
    setRefs((r) => [...r, url])
    setNovaUrl('')
  }
  function removeRef(i: number) {
    setRefs((r) => r.filter((_, idx) => idx !== i))
  }

  return (
    <div className="border-b border-border bg-bg-soft/20 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <ImageIcon size={14} className="text-brand-300" />
        <h4 className="text-sm font-semibold">Fotos / Referências</h4>
        <span className="text-[11px] text-muted">— compartilhadas em todas as artes</span>
        <span
          className={cn(
            'ml-auto text-[11px] transition-opacity',
            saveState === 'saving' && 'text-muted opacity-100',
            saveState === 'saved' && 'text-emerald-400 opacity-100',
            saveState === 'idle' && 'opacity-0',
          )}
        >
          {saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? '✓ Salvo' : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={novaUrl}
          onChange={(e) => setNovaUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addUrl()
            }
          }}
          placeholder="Cole um URL e Enter, OU use Upload ao lado"
          className="flex-1 min-w-[200px]"
        />
        <Button size="sm" variant="outline" onClick={addUrl} disabled={!novaUrl.trim()}>
          <Plus size={12} /> URL
        </Button>
        <FileUploadButton
          accept="image/*"
          multiple
          onFiles={handleUpload}
          busy={uploading}
          label="Upload fotos"
        />
      </div>
      {refs.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6 lg:grid-cols-8">
          {refs.map((url, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-lg border border-border bg-bg-soft"
            >
              {isImageUrl(url) ? (
                <img src={url} alt={`ref ${i + 1}`} className="h-16 w-full object-cover" />
              ) : (
                <div className="flex h-16 items-center justify-center text-[10px] text-muted p-2 text-center">
                  <a href={url} target="_blank" rel="noreferrer" className="underline break-all">
                    {url}
                  </a>
                </div>
              )}
              <button
                onClick={() => removeRef(i)}
                className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remover"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* =========================================================
   Painel de Identidade Visual do planejamento (compartilhada)
   ========================================================= */

function IdentidadeVisualPanel({
  planejamento,
  onChanged,
}: {
  planejamento: PlanejamentoSocialMedia
  onChanged: () => void
}) {
  const [urls, setUrls] = useState<string[]>([...(planejamento.identidade_visual_urls ?? [])])
  const [novaUrl, setNovaUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const firstRenderRef = useRef(true)

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    const timer = setTimeout(async () => {
      setSaveState('saving')
      await supabase
        .from('producoes_social_media')
        .update({ identidade_visual_urls: urls })
        .eq('id', planejamento.id)
      setSaveState('saved')
      onChanged()
      setTimeout(() => setSaveState('idle'), 1500)
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const novos: string[] = []
    for (const file of Array.from(files)) {
      const u = await uploadArquivo(file, 'social/identidade')
      if (u) novos.push(u)
    }
    if (novos.length > 0) setUrls((u) => [...u, ...novos])
    setUploading(false)
  }
  function addUrl() {
    const u = novaUrl.trim()
    if (!u) return
    setUrls((arr) => [...arr, u])
    setNovaUrl('')
  }
  function removeUrl(i: number) {
    setUrls((arr) => arr.filter((_, idx) => idx !== i))
  }

  return (
    <div className="border-b border-border bg-bg-soft/20 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <ImageIcon size={14} className="text-brand-300" />
        <h4 className="text-sm font-semibold">Identidade visual</h4>
        <span className="text-[11px] text-muted">
          — logo, paleta, manual de marca
        </span>
        <span
          className={cn(
            'ml-auto text-[11px] transition-opacity',
            saveState === 'saving' && 'text-muted opacity-100',
            saveState === 'saved' && 'text-emerald-400 opacity-100',
            saveState === 'idle' && 'opacity-0',
          )}
        >
          {saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? '✓ Salvo' : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={novaUrl}
          onChange={(e) => setNovaUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addUrl()
            }
          }}
          placeholder="Cole um URL e Enter, OU use Upload ao lado"
          className="flex-1 min-w-[200px]"
        />
        <Button size="sm" variant="outline" onClick={addUrl} disabled={!novaUrl.trim()}>
          <Plus size={12} /> URL
        </Button>
        <FileUploadButton
          accept="image/*,application/pdf"
          multiple
          onFiles={handleUpload}
          busy={uploading}
          label="Upload"
        />
      </div>
      {urls.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="group relative overflow-hidden rounded-lg border border-border bg-bg-soft"
            >
              {isImageUrl(url) ? (
                <img
                  src={url}
                  alt={`identidade ${i + 1}`}
                  className="h-20 w-full object-cover"
                />
              ) : (
                <div className="flex h-20 items-center justify-center px-2 text-center text-[10px] text-muted">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline hover:text-zinc-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {url.length > 30 ? `${url.slice(0, 25)}...` : url}
                  </a>
                </div>
              )}
              <button
                onClick={() => removeUrl(i)}
                className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remover"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* =========================================================
   Editor de dados do planejamento
   ========================================================= */

function PlanejamentoEditor({
  planejamento,
  clientes,
  onSaved,
}: {
  planejamento: PlanejamentoSocialMedia
  clientes: Cliente[]
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    cliente_id: planejamento.cliente_id,
    titulo: planejamento.titulo,
    mes_referencia: planejamento.mes_referencia ?? '',
    responsavel_id: planejamento.responsavel_id ?? '',
    prazo: planejamento.prazo ?? '',
    observacoes: planejamento.observacoes ?? '',
  })
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const firstRenderRef = useRef(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .eq('cargo', 'designer')
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
  }, [])

  async function save() {
    setSaveState('saving')
    await supabase
      .from('producoes_social_media')
      .update({
        cliente_id: form.cliente_id,
        titulo: form.titulo,
        mes_referencia: form.mes_referencia || null,
        responsavel_id: form.responsavel_id || null,
        prazo: form.prazo || null,
        observacoes: form.observacoes || null,
      })
      .eq('id', planejamento.id)
    setSaveState('saved')
    onSaved()
    setTimeout(() => setSaveState('idle'), 1500)
  }

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    const timer = setTimeout(() => {
      save()
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-bg-card p-3">
      <Field label="Título" full>
        <Input
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
        />
      </Field>
      <Field label="Cliente">
        <Select
          value={form.cliente_id}
          onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
        >
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mês de referência">
        <Input
          type="month"
          value={form.mes_referencia.slice(0, 7)}
          onChange={(e) =>
            setForm({ ...form, mes_referencia: e.target.value ? e.target.value + '-01' : '' })
          }
        />
      </Field>
      <Field label="Responsável">
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
      <Field label="Prazo do planejamento">
        <Input
          type="date"
          value={form.prazo}
          onChange={(e) => setForm({ ...form, prazo: e.target.value })}
        />
      </Field>
      <Field label="Observações" full>
        <Textarea
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          className="min-h-[60px]"
        />
      </Field>
      <div className="col-span-2 flex justify-end">
        <span
          className={cn(
            'text-[11px] transition-opacity',
            saveState === 'saving' && 'text-muted opacity-100',
            saveState === 'saved' && 'text-emerald-400 opacity-100',
            saveState === 'idle' && 'opacity-0',
          )}
        >
          {saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? '✓ Salvo' : ''}
        </span>
      </div>
    </div>
  )
}

/* =========================================================
   Linha de item (copy) — acordeão nível 2
   ========================================================= */

function ItemRow({
  item,
  expanded,
  onToggle,
  onChanged,
}: {
  item: ItemSocialMedia
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [editingTitulo, setEditingTitulo] = useState(false)
  const [tituloValue, setTituloValue] = useState(item.titulo)
  const [editingFormato, setEditingFormato] = useState(false)
  const [editingResp, setEditingResp] = useState(false)
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])

  useEffect(() => {
    setTituloValue(item.titulo)
  }, [item.titulo])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .eq('cargo', 'designer')
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
  }, [])

  async function updateField(field: string, val: unknown) {
    await supabase.from('producoes_social_media_items').update({ [field]: val }).eq('id', item.id)
    onChanged()
  }

  async function commitTitulo() {
    const novo = tituloValue.trim()
    if (!novo || novo === item.titulo) {
      setTituloValue(item.titulo)
      setEditingTitulo(false)
      return
    }
    await updateField('titulo', novo)
    setEditingTitulo(false)
  }

  async function mudarStatus(s: StatusSocialMedia) {
    await updateField('status', s)
  }

  return (
    <div className={cn(expanded && 'bg-bg-soft/30')}>
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-bg-soft/50"
      >
        <ChevronRight
          size={12}
          className={cn('shrink-0 text-muted transition-transform', expanded && 'rotate-90')}
        />
        <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDot[item.status])} />
        <div className="min-w-0 flex-1">
          <div className="group flex items-center gap-2">
            {editingFormato ? (
              <select
                autoFocus
                value={item.formato}
                onClick={(e) => e.stopPropagation()}
                onChange={async (e) => {
                  await updateField('formato', e.target.value)
                  setEditingFormato(false)
                }}
                onBlur={() => setEditingFormato(false)}
                className="h-6 shrink-0 rounded-md border border-brand-500 bg-bg-soft px-1.5 text-[10px] uppercase text-zinc-100 focus:outline-none"
              >
                {FORMATOS_SOCIAL_MEDIA.map((f) => (
                  <option key={f} value={f}>
                    {formatoSocialMediaLabel[f]}
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingFormato(true)
                }}
                className="shrink-0"
                title="Trocar formato"
              >
                <Badge className={formatoBadgeClass[item.formato]}>
                  {formatoSocialMediaLabel[item.formato].toUpperCase()}
                </Badge>
              </button>
            )}
            {editingTitulo ? (
              <input
                type="text"
                autoFocus
                value={tituloValue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTituloValue(e.target.value)}
                onBlur={commitTitulo}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                  if (e.key === 'Escape') {
                    setTituloValue(item.titulo)
                    setEditingTitulo(false)
                  }
                }}
                className="min-w-0 flex-1 rounded-md border border-brand-500 bg-bg-soft px-2 py-0.5 text-sm text-zinc-100 focus:outline-none"
              />
            ) : (
              <>
                <p className="truncate text-sm text-zinc-100">{item.titulo}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingTitulo(true)
                  }}
                  className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-bg-elev hover:text-brand-300 group-hover:opacity-100"
                  title="Editar nome"
                >
                  <Pencil size={10} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(item.copy_texto || item.copy_arquivo_url) && (
            <span
              className="grid h-5 w-5 place-items-center rounded-md border border-brand-500/40 bg-brand-500/15 text-brand-300"
              title="Tem copy"
            >
              <Sparkles size={10} />
            </span>
          )}
          {(item.artes_prontas ?? []).length > 0 && (
            <span
              className="grid h-5 w-5 place-items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              title={`${item.artes_prontas.length} arte(s) pronta(s)`}
            >
              <ImageIcon size={10} />
            </span>
          )}
        </div>

        <PrazoInlineItem item={item} onUpdated={onChanged} />

        <Select
          value={item.status}
          onChange={(e) => mudarStatus(e.target.value as StatusSocialMedia)}
          onClick={(e) => e.stopPropagation()}
          className="w-40 h-7 text-[11px]"
        >
          {ESTEIRA_SOCIAL_MEDIA.map((s) => (
            <option key={s} value={s}>
              {statusSocialMediaLabel[s]}
            </option>
          ))}
        </Select>

        <div onClick={(e) => e.stopPropagation()}>
          {editingResp ? (
            <select
              autoFocus
              value={item.responsavel_id ?? ''}
              onChange={async (e) => {
                await updateField('responsavel_id', e.target.value || null)
                setEditingResp(false)
              }}
              onBlur={() => setEditingResp(false)}
              className="h-7 rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
            >
              <option value="">—</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingResp(true)}
              className="grid h-6 w-6 place-items-center rounded-full transition-all hover:ring-2 hover:ring-brand-500/40"
              title="Clique para mudar o responsável"
            >
              {item.responsavel ? (
                <Avatar name={item.responsavel.nome} size="sm" />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-border text-muted">
                  <User size={10} />
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-bg-soft/50 px-4 py-4">
          {/* key estável (só id): evita remount + perda de foco a cada save.
              External changes só sincronizam quando o usuário fecha e reabre
              o accordion. O diff-save protege contra lost-update entre usuários. */}
          <ItemEditor key={item.id} item={item} onChanged={onChanged} />
        </div>
      )}
    </div>
  )
}

/* =========================================================
   Editor do item (copy individual)
   ========================================================= */

function ItemEditor({ item, onChanged }: { item: ItemSocialMedia; onChanged: () => void }) {
  const initialForm = useMemo(
    () => ({
      copy_texto: item.copy_texto ?? '',
      copy_arquivo_url: stripBlobUrl(item.copy_arquivo_url),
      artes_prontas: stripBlobUrls(item.artes_prontas),
      observacoes: item.observacoes ?? '',
    }),
    [item],
  )
  const [form, setForm] = useState(initialForm)
  // Baseline pro save baseado em diff (evita lost-update entre usuários)
  const baselineRef = useRef(initialForm)
  const [novaArte, setNovaArte] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [uploadingKind, setUploadingKind] = useState<'copy' | 'artes' | null>(null)
  const firstRenderRef = useRef(true)

  async function save() {
    // Diff vs baseline — só envia o que VOCÊ mexeu
    const base = baselineRef.current
    const payload: Record<string, unknown> = {}
    if (form.copy_texto !== base.copy_texto) payload.copy_texto = form.copy_texto || null
    if (form.copy_arquivo_url !== base.copy_arquivo_url)
      payload.copy_arquivo_url = form.copy_arquivo_url || null
    if (JSON.stringify(form.artes_prontas) !== JSON.stringify(base.artes_prontas))
      payload.artes_prontas = form.artes_prontas
    if (form.observacoes !== base.observacoes)
      payload.observacoes = form.observacoes || null

    if (Object.keys(payload).length === 0) {
      setSaveState('idle')
      return
    }

    setSaveState('saving')
    await supabase
      .from('producoes_social_media_items')
      .update(payload)
      .eq('id', item.id)
    baselineRef.current = { ...form }
    setSaveState('saved')
    onChanged()
    setTimeout(() => setSaveState('idle'), 1500)
  }

  // Auto-save com debounce de 600ms a cada mudança em `form`
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    const timer = setTimeout(() => {
      save()
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  async function excluir() {
    if (!confirm('Excluir esta arte?')) return
    await supabase.from('producoes_social_media_items').delete().eq('id', item.id)
    onChanged()
  }

  async function handleUploadCopy(file: File | null) {
    if (!file) return
    setUploadingKind('copy')
    const url = await uploadArquivo(file, 'social/copy')
    if (url) setForm((f) => ({ ...f, copy_arquivo_url: url }))
    setUploadingKind(null)
  }
  async function handleUploadArtes(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingKind('artes')
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const u = await uploadArquivo(file, 'social/artes')
      if (u) urls.push(u)
    }
    if (urls.length > 0) setForm((f) => ({ ...f, artes_prontas: [...f.artes_prontas, ...urls] }))
    setUploadingKind(null)
  }

  function addArteUrl() {
    const url = novaArte.trim()
    if (!url) return
    setForm((f) => ({ ...f, artes_prontas: [...f.artes_prontas, url] }))
    setNovaArte('')
  }
  function removeArte(i: number) {
    setForm((f) => ({ ...f, artes_prontas: f.artes_prontas.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-brand-300" />
          <h4 className="text-sm font-semibold">Copy</h4>
        </div>
        <div className="space-y-3">
          <Field label="Texto da copy">
            <Textarea
              value={form.copy_texto}
              onChange={(e) => setForm({ ...form, copy_texto: e.target.value })}
              placeholder="Slide 1:&#10;...&#10;&#10;Slide 2:&#10;..."
              className="min-h-[140px] font-mono text-[13px] leading-relaxed"
            />
          </Field>
          <Field label="Arquivo de copy">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={form.copy_arquivo_url}
                onChange={(e) => setForm({ ...form, copy_arquivo_url: e.target.value })}
                placeholder="Cole um link OU clique em Upload ao lado"
                className="flex-1 min-w-[200px]"
              />
              <FileUploadButton
                accept="application/pdf,.doc,.docx,.txt,.md"
                onFile={handleUploadCopy}
                busy={uploadingKind === 'copy'}
                label="Upload arquivo"
              />
              {form.copy_arquivo_url && (
                <a
                  href={form.copy_arquivo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs text-zinc-200 hover:bg-bg-elev"
                >
                  <ExternalLink size={12} />
                  Abrir
                </a>
              )}
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-300" />
          <h4 className="text-sm font-semibold text-emerald-200">Artes prontas</h4>
          <span className="text-[11px] text-muted">— material final para entrega</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={novaArte}
            onChange={(e) => setNovaArte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addArteUrl()
              }
            }}
            placeholder="Cole um URL e Enter, OU use Upload ao lado"
            className="flex-1 min-w-[200px]"
          />
          <Button size="sm" variant="outline" onClick={addArteUrl} disabled={!novaArte.trim()}>
            <Plus size={12} /> URL
          </Button>
          <FileUploadButton
            accept="image/*,video/*,application/pdf"
            multiple
            onFiles={handleUploadArtes}
            busy={uploadingKind === 'artes'}
            label="Upload artes"
          />
        </div>
        {form.artes_prontas.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {form.artes_prontas.map((url, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-lg border border-emerald-500/30 bg-bg-soft"
              >
                {isImageUrl(url) ? (
                  <img src={url} alt={`arte ${i + 1}`} className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center text-[10px] text-muted p-2 text-center">
                    <a href={url} target="_blank" rel="noreferrer" className="underline break-all">
                      {url}
                    </a>
                  </div>
                )}
                <button
                  onClick={() => removeArte(i)}
                  className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="Remover"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Observações">
        <Textarea
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          placeholder="Anotações do time..."
          className="min-h-[60px]"
        />
      </Field>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <Button variant="danger" size="sm" onClick={excluir}>
          <Trash2 size={12} /> Excluir arte
        </Button>
        <span
          className={cn(
            'text-[11px] transition-opacity',
            saveState === 'saving' && 'text-muted opacity-100',
            saveState === 'saved' && 'text-emerald-400 opacity-100',
            saveState === 'idle' && 'opacity-0',
          )}
        >
          {saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? '✓ Salvo' : ''}
        </span>
      </div>
    </div>
  )
}

/* =========================================================
   Subcomponentes
   ========================================================= */

function PrazoInlineItem({
  item,
  onUpdated,
}: {
  item: ItemSocialMedia
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.prazo ?? '')

  useEffect(() => {
    setValue(item.prazo ?? '')
  }, [item.prazo])

  async function commit(newValue: string) {
    const prazo = newValue || null
    const current = item.prazo ?? null
    if (prazo === current) {
      setEditing(false)
      return
    }
    await supabase.from('producoes_social_media_items').update({ prazo }).eq('id', item.id)
    setEditing(false)
    onUpdated()
  }

  const overdue =
    item.prazo && new Date(item.prazo) < new Date() && item.status !== 'conclusao'

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-7 rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
      />
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] whitespace-nowrap transition-colors',
        item.prazo
          ? overdue
            ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
            : 'border-border bg-bg-soft text-zinc-200 hover:border-brand-500/40'
          : 'border-dashed border-border text-muted hover:border-brand-500/40 hover:text-zinc-200',
      )}
      title={item.prazo ? 'Clique para editar prazo' : 'Clique para definir prazo'}
    >
      <Calendar size={10} />
      {item.prazo ? prazoLabel(item.prazo, !!overdue) : 'Prazo'}
    </button>
  )
}

function PrazoInlinePlanejamento({
  planejamento,
  onUpdated,
}: {
  planejamento: PlanejamentoSocialMedia
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(planejamento.prazo ?? '')

  useEffect(() => {
    setValue(planejamento.prazo ?? '')
  }, [planejamento.prazo])

  async function commit(newValue: string) {
    const prazo = newValue || null
    const current = planejamento.prazo ?? null
    if (prazo === current) {
      setEditing(false)
      return
    }
    await supabase.from('producoes_social_media').update({ prazo }).eq('id', planejamento.id)
    setEditing(false)
    onUpdated()
  }

  const overdue =
    planejamento.prazo && new Date(planejamento.prazo) < new Date()

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-7 rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
      />
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors',
        planejamento.prazo
          ? overdue
            ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
            : 'border-border bg-bg-soft text-zinc-200 hover:border-brand-500/40'
          : 'border-dashed border-border text-muted hover:border-brand-500/40 hover:text-zinc-200',
      )}
    >
      <Calendar size={10} />
      {planejamento.prazo ? prazoLabel(planejamento.prazo, !!overdue) : 'Definir prazo'}
    </button>
  )
}

function FileUploadButton({
  accept,
  multiple,
  onFile,
  onFiles,
  busy,
  label,
}: {
  accept: string
  multiple?: boolean
  onFile?: (file: File | null) => void
  onFiles?: (files: FileList | null) => void
  busy?: boolean
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (multiple && onFiles) onFiles(e.target.files)
          else if (onFile) onFile(e.target.files?.[0] ?? null)
          if (ref.current) ref.current.value = ''
        }}
      />
      <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
        <Upload size={12} className={busy ? 'animate-pulse' : ''} />
        {busy ? 'Enviando...' : label}
      </Button>
    </>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={cn('flex flex-col gap-1.5', full && 'col-span-2')}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

function isImageUrl(url: string): boolean {
  return (
    /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url) ||
    /images\.unsplash\.com/i.test(url) ||
    url.startsWith('blob:')
  )
}

void statusTone

/* =========================================================
   Modal: Novo planejamento (cria vazio, sem auto-gerar artes)
   ========================================================= */

function NovoPlanejamentoModal({
  open,
  onClose,
  clientes,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  clientes: Cliente[]
  onCreate: (payload: {
    cliente_id: string | null
    titulo: string
    mes_referencia: string
    prazo: string | null
  }) => Promise<void>
}) {
  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [prazo, setPrazo] = useState('')
  const [tituloEditado, setTituloEditado] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-preenche título: usa nome do cliente se houver, senão "PLANEJAMENTO MES/ANO"
  useEffect(() => {
    if (!open) return
    if (tituloEditado) return
    try {
      const d = parseISO(mes)
      const mesLabel = format(d, 'MMM/yy', { locale: ptBR })
        .toUpperCase()
        .replace('.', '')
      const cliente = clientes.find((c) => c.id === clienteId)
      if (cliente) {
        setTitulo(`[${cliente.nome.toUpperCase()}] PLANEJAMENTO ${mesLabel}`)
      } else {
        setTitulo(`PLANEJAMENTO ${mesLabel}`)
      }
    } catch {
      /* noop */
    }
  }, [open, clienteId, mes, clientes, tituloEditado])

  // Reset ao abrir
  useEffect(() => {
    if (!open) return
    setClienteId('')
    setTitulo('')
    setMes(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    })
    setPrazo('')
    setTituloEditado(false)
    setError(null)
  }, [open])

  async function save() {
    if (!titulo.trim()) return setError('Título é obrigatório')
    if (!mes) return setError('Mês de referência é obrigatório')
    setSaving(true)
    setError(null)
    try {
      await onCreate({
        cliente_id: clienteId || null,
        titulo: titulo.trim(),
        mes_referencia: mes,
        prazo: prazo || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo planejamento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Criando...' : 'Criar planejamento'}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-muted">
        Cria um planejamento vazio. Use o botão{' '}
        <span className="text-zinc-300">+ Nova arte</span> dentro dele para cadastrar cada postagem
        manualmente.
      </p>
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <Field label="Cliente (opcional)">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">— sem cliente vinculado —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês de referência *">
            <Input
              type="month"
              value={mes.slice(0, 7)}
              onChange={(e) => {
                const v = e.target.value
                setMes(v ? v + '-01' : '')
              }}
            />
          </Field>
          <Field label="Prazo final (opcional)">
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </Field>
        </div>
        <Field label="Título *">
          <Input
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              setTituloEditado(true)
            }}
            placeholder="Ex: [CLIENTE] PLANEJAMENTO ABR/26"
          />
          {!tituloEditado && (
            <p className="mt-1 text-[10px] text-muted">
              Título sugerido automaticamente a partir do cliente e do mês. Você pode editá-lo.
            </p>
          )}
        </Field>
      </div>
    </Modal>
  )
}
