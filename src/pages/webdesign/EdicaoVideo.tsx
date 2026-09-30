/**
 * Execução › Edição de Vídeo.
 *
 * Um card por LOTE (até 2 vídeos de um cliente, SLA de 3 dias úteis); dentro,
 * uma linha por VÍDEO com status, responsável e SLA próprios. O SLA de cada
 * vídeo só começa quando o cliente aprova. Regras em ./edicaoVideo/lotes.ts.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Clapperboard, Film, Hourglass, Plus, Search, X } from 'lucide-react'
import { FilterBar, FilterPill, KPICard, PageHeader } from '@/components/ds'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { cn, statusEdicaoVideoLabel, ESTEIRA_EDICAO_VIDEO } from '@/lib/utils'
import type { Cliente, EdicaoVideo, StatusEdicaoVideo } from '@/types/database'
import { LOTE_EDICAO_PADRAO, montarLotes, type EstadoSLA, type LoteEdicao, type VideoEdicao } from './edicaoVideo/lotes'
import { carregarEditores, EDITORES_VAZIO, type ListaEditores } from './edicaoVideo/editores'
import { VideoLoteCard } from './edicaoVideo/VideoLoteCard'
import { VideoEditModal } from './edicaoVideo/VideoEditModal'
import { statusDot } from './edicaoVideo/estilos'

// Usados pela página de preview (/preview/edicao-video).
export { VideoEditModal as EdicaoVideoModal } from './edicaoVideo/VideoEditModal'
export { EdicaoAccordion } from './edicaoVideo/EdicaoAccordion'

const FILTRO_SLA: { value: Exclude<EstadoSLA, 'concluido'>; label: string }[] = [
  { value: 'no_prazo', label: 'No prazo' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'aguardando', label: 'Aguardando aprovação' },
]

export default function EdicaoVideo() {
  const [edicoes, setEdicoes] = useState<EdicaoVideo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editores, setEditores] = useState<ListaEditores>(EDITORES_VAZIO)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroSla, setFiltroSla] = useState<EstadoSLA | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<StatusEdicaoVideo | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EdicaoVideo | null>(null)
  const [showConcluidos, setShowConcluidos] = useState(false)

  async function load() {
    const [eRes, cRes, eds] = await Promise.all([
      supabase.from('edicoes_video').select('*, cliente:clientes(*)').order('created_at', { ascending: true }),
      supabase.from('clientes').select('*').is('arquivado_em', null).order('nome'),
      carregarEditores(),
    ])
    setEdicoes((eRes.data as EdicaoVideo[]) ?? [])
    setClientes((cRes.data as Cliente[]) ?? [])
    setEditores(eds)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const lotes = useMemo(
    () => montarLotes(edicoes, new Map(clientes.map((c) => [c.id, c])), LOTE_EDICAO_PADRAO),
    [edicoes, clientes],
  )

  // Filtros de base (cliente, responsável, busca) valem pra tudo; status e SLA
  // ficam de fora das contagens pra régua/KPIs mostrarem o total real.
  const passaBase = (l: LoteEdicao, v: VideoEdicao) => {
    if (filtroCliente && l.clienteId !== filtroCliente) return false
    if (filtroResponsavel === '__sem__' ? !!v.edicao.responsavel_id : filtroResponsavel && v.edicao.responsavel_id !== filtroResponsavel) return false
    const t = q.trim().toLowerCase()
    return !t || (v.edicao.titulo ?? '').toLowerCase().includes(t) || (l.cliente?.nome ?? '').toLowerCase().includes(t)
  }
  const base = lotes.flatMap((l) => l.videos.filter((v) => passaBase(l, v)))

  const contadores = new Map<StatusEdicaoVideo, number>(ESTEIRA_EDICAO_VIDEO.map((s) => [s, 0]))
  for (const v of base) if (!filtroSla || v.sla.estado === filtroSla) contadores.set(v.edicao.status, (contadores.get(v.edicao.status) ?? 0) + 1)
  const atrasados = base.filter((v) => v.sla.estado === 'atrasado').length
  const aguardando = base.filter((v) => v.sla.estado === 'aguardando').length
  const emAberto = base.filter((v) => v.sla.estado !== 'concluido').length

  const visiveis = lotes
    .map((lote) => ({
      lote,
      videos: lote.videos.filter(
        (v) => passaBase(lote, v) && (!filtroStatus || v.edicao.status === filtroStatus) && (!filtroSla || v.sla.estado === filtroSla),
      ),
    }))
    .filter((x) => x.videos.length > 0)

  // Ativos: cliente com mais atrasos primeiro; lotes do mesmo cliente juntos, em ordem.
  const atrasosDoCliente = new Map<string, number>()
  for (const { lote } of visiveis) atrasosDoCliente.set(lote.clienteId, (atrasosDoCliente.get(lote.clienteId) ?? 0) + lote.atrasados)
  const ativos = visiveis
    .filter((x) => !x.lote.concluido)
    .sort(
      (a, b) =>
        (atrasosDoCliente.get(b.lote.clienteId) ?? 0) - (atrasosDoCliente.get(a.lote.clienteId) ?? 0) ||
        (a.lote.cliente?.nome ?? '').localeCompare(b.lote.cliente?.nome ?? '') ||
        a.lote.numero - b.lote.numero,
    )
  const ultimaAtualizacao = (l: LoteEdicao) => Math.max(...l.videos.map((v) => new Date(v.edicao.updated_at).getTime()))
  const concluidos = visiveis.filter((x) => x.lote.concluido).sort((a, b) => ultimaAtualizacao(b.lote) - ultimaAtualizacao(a.lote))

  // Postagens já vinculadas a algum vídeo (o modal não deixa repetir).
  const vinculadosEmOutros = useMemo(
    () => new Set(edicoes.filter((e) => e.social_media_item_id && e.id !== editing?.id).map((e) => e.social_media_item_id!)),
    [edicoes, editing],
  )

  const abrir = (e: EdicaoVideo | null) => {
    setEditing(e)
    setModalOpen(true)
  }
  const temFiltro = !!(q || filtroCliente || filtroResponsavel || filtroSla || filtroStatus)

  return (
    <div>
      <PageHeader
        title="Edição de Vídeo"
        description={`SLA: lote de ${LOTE_EDICAO_PADRAO.tamanhoLote} vídeos a cada ${LOTE_EDICAO_PADRAO.slaDiasUteis} dias úteis, contados da aprovação do cliente`}
        actions={
          <Button onClick={() => abrir(null)}>
            <Plus size={14} /> Novo vídeo
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPICard icon={<Clapperboard size={13} />} label="Vídeos em aberto" value={String(emAberto)} sub="em todos os lotes" />
        <KPICard
          icon={<Hourglass size={13} />}
          label="Aguardando aprovação"
          value={String(aguardando)}
          sub="SLA ainda não iniciado"
        />
        <KPICard
          icon={<AlertTriangle size={13} />}
          label="Vídeos atrasados"
          value={String(atrasados)}
          tone={atrasados > 0 ? 'danger' : 'neutral'}
          sub={atrasados > 0 ? 'prazo vencido e não concluído' : 'nenhum vídeo fora do prazo'}
        />
      </div>

      <FilterBar className="mb-3">
        <div className="relative min-w-48 flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="h-8 pl-8 text-xs" placeholder="Buscar por título ou cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FilterPill
          value={filtroCliente}
          onChange={setFiltroCliente}
          placeholder="Todos clientes"
          options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
        />
        <FilterPill
          value={filtroResponsavel}
          onChange={setFiltroResponsavel}
          placeholder="Todos responsáveis"
          options={[{ value: '__sem__', label: 'Sem responsável' }, ...editores.pessoas.map((p) => ({ value: p.id, label: p.nome }))]}
        />
        <FilterPill value={filtroSla} onChange={(v) => setFiltroSla(v as EstadoSLA | '')} placeholder="Todos os status de SLA" options={FILTRO_SLA} />
        {temFiltro && (
          <button
            onClick={() => {
              setQ('')
              setFiltroCliente('')
              setFiltroResponsavel('')
              setFiltroSla('')
              setFiltroStatus('')
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-zinc-200"
          >
            <X size={11} /> limpar
          </button>
        )}
      </FilterBar>

      {/* Régua: contagem por VÍDEO (todos os lotes) — clique filtra */}
      {!loading && edicoes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg-card px-3 py-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted" title="Cada vídeo conta 1, somando todos os lotes — diferente do 'X de Y vídeos no lote' de cada card">
            Vídeos por etapa
          </span>
          {ESTEIRA_EDICAO_VIDEO.map((s) => {
            const n = contadores.get(s) ?? 0
            const ativo = filtroStatus === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFiltroStatus(ativo ? '' : s)}
                disabled={n === 0 && !ativo}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  ativo
                    ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                    : n === 0
                      ? 'cursor-default border-border bg-bg-soft text-muted opacity-50'
                      : 'border-border bg-bg-soft text-zinc-300 hover:border-brand-500/40',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full bg-current', statusDot[s])} />
                {statusEdicaoVideoLabel[s]}
                <span className="tabular-nums opacity-80">{n}</span>
              </button>
            )
          })}
          <span className="ml-auto text-[10px] text-muted">contagem por vídeo, somando todos os lotes</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">Carregando...</div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
          <Film size={28} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-zinc-200">{edicoes.length === 0 ? 'Nenhum vídeo na esteira' : 'Nenhum vídeo pros filtros ativos'}</p>
          <p className="mt-1 text-xs text-muted">
            {edicoes.length === 0 ? 'Clique em "Novo vídeo" para começar.' : 'Ajuste os filtros pra ver mais vídeos.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ativos.map(({ lote, videos }) => (
            <VideoLoteCard key={lote.id} lote={lote} videos={videos} editores={editores} onEdit={abrir} onChanged={load} />
          ))}

          {concluidos.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowConcluidos((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-soft/40 px-4 py-2.5 transition-colors hover:bg-bg-soft/70"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-200">Lotes concluídos</span>
                  <span className="text-[11px] tabular-nums text-muted">{concluidos.length}</span>
                  <span className="text-[11px] text-muted">· todos os vídeos do lote finalizados</span>
                </span>
                <ChevronDown size={14} className={cn('text-muted transition-transform', showConcluidos && 'rotate-180')} />
              </button>
              {showConcluidos && (
                <div className="mt-3 space-y-3">
                  {concluidos.map(({ lote, videos }) => (
                    <VideoLoteCard key={lote.id} lote={lote} videos={videos} editores={editores} onEdit={abrir} onChanged={load} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <VideoEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        edicao={editing}
        clientes={clientes}
        onSaved={load}
        editores={editores}
        vinculadosEmOutros={vinculadosEmOutros}
      />
    </div>
  )
}
