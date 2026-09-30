import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Search,
  ExternalLink,
  Image as ImageIcon,
  Palette,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  Calendar,
  Upload,
  Trash2,
  Pencil,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { differenceInDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { uploadToStorageSafe, stripBlobUrl, stripBlobUrls, isDeadBlobUrl } from '@/lib/storage'
import { isDateOverdue } from '@/lib/dates'
import { useAuth } from '@/contexts/AuthContext'
import { IdentidadeVisualEditor } from '@/components/webdesign/IdentidadeVisualEditor'
import { carregarEquipeSocial, EQUIPE_VAZIA, ResponsavelArte, type EquipeSocial } from './socialMedia/producaoSocial'
import {
  aprovarDesign,
  COR_SLA_CRIATIVO,
  fluxoCriativoVazio,
  registrarEtapa,
  reenviarParaAprovacao,
  reprovarDesign,
  rotuloSlaCriativo,
  SLA_CRIATIVO_DIAS_UTEIS,
  slaDoCriativo,
  storeFluxoCriativo,
  type FluxoCriativo,
} from './criativos/fluxoCriativo'
import { DeleteConfirmModal, DesignApprovalModal, EsteiraCriativo, HistoricoCriativo } from './criativos/ComponentesCriativo'
import {
  cn,
  statusCriativoWebdesignLabel,
  ESTEIRA_CRIATIVOS,
  formatoCriativoLabel,
  FORMATOS_CRIATIVO,
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
  CriativoWebdesign,
  StatusCriativoWebdesign,
  FormatoCriativo,
} from '@/types/database'

const statusDot: Record<StatusCriativoWebdesign, string> = {
  pendente: 'bg-zinc-500',
  design: 'bg-violet-500',
  design_finalizado: 'bg-sky-500',
  aprovacao_design: 'bg-amber-500',
  alteracao: 'bg-red-500',
  conclusao: 'bg-emerald-500',
}

const statusBar: Record<StatusCriativoWebdesign, string> = {
  pendente: 'bg-zinc-600',
  design: 'bg-violet-500',
  design_finalizado: 'bg-sky-500',
  aprovacao_design: 'bg-amber-500',
  alteracao: 'bg-red-500',
  conclusao: 'bg-emerald-500',
}

/**
 * Upload pro Supabase Storage (bucket `webdesign-assets`).
 * Pré-req: migration 006-storage rodada.
 */
async function uploadArquivo(file: File, folder = 'criativos/misc'): Promise<string> {
  const url = await uploadToStorageSafe(file, folder, 'webdesign-assets')
  return url ?? ''
}

export default function CriativosWebdesign() {
  const [criativos, setCriativos] = useState<CriativoWebdesign[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [equipe, setEquipe] = useState<EquipeSocial>(EQUIPE_VAZIA)
  const [fluxos, setFluxos] = useState<Map<string, FluxoCriativo>>(new Map())
  const [q, setQ] = useState('')
  const [fFormato, setFFormato] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fResponsavel, setFResponsavel] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { profile } = useAuth()
  // Aprovação do Design no nível da página: o card remonta ao mudar de seção.
  const [aprovacaoId, setAprovacaoId] = useState<string | null>(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const [pRes, cRes, eq, fl] = await Promise.all([
      supabase
        .from('criativos_webdesign')
        .select('*, cliente:clientes(*), responsavel:profiles(*)')
        .order('updated_at', { ascending: false }),
      supabase.from('clientes').select('*').is('arquivado_em', null).order('nome'),
      // Responsáveis: setor Criativos pelo papel da Equipe Operacional.
      carregarEquipeSocial(),
      storeFluxoCriativo.carregar(),
    ])
    setCriativos((pRes.data as CriativoWebdesign[]) ?? [])
    setClientes((cRes.data as Cliente[]) ?? [])
    setEquipe(eq)
    setFluxos(fl)
    if (!silent) setLoading(false)
  }

  function atualizarFluxo(id: string, f: FluxoCriativo): Promise<void> {
    setFluxos((m) => new Map(m).set(id, f))
    return storeFluxoCriativo.salvar(id, f)
  }

  /** Etapa + fluxo juntos: tela na hora, fluxo gravado, depois status no banco e recarga. */
  async function aplicarEtapa(c: CriativoWebdesign, status: StatusCriativoWebdesign, f: FluxoCriativo) {
    if (status !== c.status) setCriativos((cs) => cs.map((x) => (x.id === c.id ? { ...x, status } : x)))
    await atualizarFluxo(c.id, f)
    if (status !== c.status) {
      await supabase.from('criativos_webdesign').update({ status }).eq('id', c.id)
      load(true)
    }
  }

  const criativoAprov = aprovacaoId ? criativos.find((c) => c.id === aprovacaoId) ?? null : null
  const fluxoAprov = aprovacaoId ? fluxos.get(aprovacaoId) ?? fluxoCriativoVazio() : fluxoCriativoVazio()

  useEffect(() => {
    load()
    // Auto-refresh a cada 30s pra capturar uploads / mudanças feitos
    // por outras pessoas em paralelo (sem flicker de loading).
    const id = setInterval(() => load(true), 30000)
    // Refresh imediato ao voltar pra aba (foco da janela).
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const [novoModalOpen, setNovoModalOpen] = useState(false)

  function abrirNovoCriativo() {
    setNovoModalOpen(true)
  }

  async function criarCriativo(payload: {
    cliente_id: string | null
    titulo: string
    formato: FormatoCriativo
  }) {
    const { data, error } = await supabase
      .from('criativos_webdesign')
      .insert({
        cliente_id: payload.cliente_id || null,
        titulo: payload.titulo || null,
        formato: payload.formato,
        status: 'pendente',
        fotos: [],
      })
      .select()
      .single()
    if (error) {
      alert(`Erro ao criar criativo: ${error.message}`)
      return
    }
    const novo = data as CriativoWebdesign | null
    await load()
    if (novo?.id) setExpandedId(novo.id)
    setNovoModalOpen(false)
  }

  const filtered = useMemo(() => {
    return criativos.filter((p) => {
      const nomeCliente = p.cliente?.nome ?? ''
      if (q && !nomeCliente.toLowerCase().includes(q.toLowerCase())) return false
      if (fFormato && p.formato !== fFormato) return false
      if (fCliente && p.cliente_id !== fCliente) return false
      if (fResponsavel) {
        if (fResponsavel === '__sem__' && p.responsavel_id) return false
        if (fResponsavel !== '__sem__' && p.responsavel_id !== fResponsavel) return false
      }
      return true
    })
  }, [criativos, q, fFormato, fCliente, fResponsavel])

  const byStatus = useMemo(() => {
    const m = new Map<StatusCriativoWebdesign, CriativoWebdesign[]>()
    for (const s of ESTEIRA_CRIATIVOS) m.set(s, [])
    for (const p of filtered) m.get(p.status)?.push(p)
    return m
  }, [filtered])

  const sections = ESTEIRA_CRIATIVOS.filter((s) => (byStatus.get(s)?.length ?? 0) > 0)
  const temCriativos = sections.length > 0

  return (
    <div>
      <PageHeader
        title="Criativos"
        description={`${criativos.length} criativo(s) na esteira de produção`}
        actions={
          <Button onClick={abrirNovoCriativo}>
            <Plus size={14} /> Novo criativo
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome do cliente..."
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
          <Select value={fFormato} onChange={(e) => setFFormato(e.target.value)} className="w-48">
            <option value="">Todos formatos</option>
            {FORMATOS_CRIATIVO.map((f) => (
              <option key={f} value={f}>
                {formatoCriativoLabel[f]}
              </option>
            ))}
          </Select>
          <Select
            value={fResponsavel}
            onChange={(e) => setFResponsavel(e.target.value)}
            className="w-56"
          >
            <option value="">Todos responsáveis</option>
            <option value="__sem__">Sem responsável</option>
            {equipe.opcoes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando...
        </div>
      ) : !temCriativos ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
          <p className="text-sm text-zinc-200">Nenhum criativo encontrado</p>
          <p className="mt-1 text-xs text-muted">
            Clique em <span className="text-brand-300">Novo criativo</span> para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((status) => {
            const items = byStatus.get(status) ?? []
            const isCollapsed = collapsed[status] ?? false
            return (
              <div key={status}>
                <button
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [status]: !(c[status] ?? false) }))
                  }
                  className="mb-2 flex w-full items-center gap-2.5 text-left"
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]',
                      statusDot[status],
                    )}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
                    {statusCriativoWebdesignLabel[status]}
                  </span>
                  <span className="rounded-md bg-bg-elev px-1.5 py-0.5 text-[10px] text-muted">
                    {items.length}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight size={12} className="ml-auto text-muted" />
                  ) : (
                    <ChevronDown size={12} className="ml-auto text-muted" />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-2">
                    {items.map((p) => (
                      <CriativoAccordion
                        key={p.id}
                        criativo={p}
                        clientes={clientes}
                        equipe={equipe}
                        fluxo={fluxos.get(p.id) ?? fluxoCriativoVazio()}
                        onEtapa={(s, f) => aplicarEtapa(p, s, f)}
                        onAprovacao={() => setAprovacaoId(p.id)}
                        expanded={expandedId === p.id}
                        onToggle={() =>
                          setExpandedId((id) => (id === p.id ? null : p.id))
                        }
                        onChanged={() => load(true)}
                        onDeleted={() => {
                          setExpandedId(null)
                          load(true)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && storeFluxoCriativo.noBanco() === false && (
        <p className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-[11px] text-zinc-200">
          Aprovações e histórico dos criativos estão sendo salvos <strong>só neste navegador</strong>. Rode a migration 097
          (<code>criativos_webdesign_fluxo</code>) no Supabase pra compartilhar com a equipe.
        </p>
      )}

      {criativoAprov && (
        <DesignApprovalModal
          open
          onClose={() => setAprovacaoId(null)}
          criativo={criativoAprov}
          arquivoUrl={stripBlobUrl(criativoAprov.url_criativo)}
          fluxo={fluxoAprov}
          meuNome={profile?.nome ?? ''}
          onMoverParaAprovacao={() => void aplicarEtapa(criativoAprov, 'aprovacao_design', registrarEtapa(fluxoAprov, 'aprovacao_design'))}
          onAprovar={(por) => {
            const r = aprovarDesign(fluxoAprov, por, stripBlobUrl(criativoAprov.url_criativo) || null)
            setAprovacaoId(null)
            void aplicarEtapa(criativoAprov, r.status, r.fluxo)
          }}
          onReprovar={(por, motivo) => {
            const r = reprovarDesign(fluxoAprov, por, motivo, stripBlobUrl(criativoAprov.url_criativo) || null)
            setAprovacaoId(null)
            void aplicarEtapa(criativoAprov, r.status, r.fluxo)
          }}
        />
      )}

      <NovoCriativoModal
        open={novoModalOpen}
        onClose={() => setNovoModalOpen(false)}
        clientes={clientes}
        onCreate={criarCriativo}
      />
    </div>
  )
}

function CriativoAccordion({
  criativo,
  clientes,
  expanded,
  onToggle,
  onChanged,
  onDeleted,
  equipe,
  fluxo,
  onEtapa,
  onAprovacao,
}: {
  criativo: CriativoWebdesign
  clientes: Cliente[]
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
  onDeleted: () => void
  equipe: EquipeSocial
  fluxo: FluxoCriativo
  onEtapa: (s: StatusCriativoWebdesign, f: FluxoCriativo) => Promise<void>
  onAprovacao: () => void
}) {
  const [editingTitulo, setEditingTitulo] = useState(false)
  const [tituloValue, setTituloValue] = useState(criativo.titulo ?? '')
  const [editingFormato, setEditingFormato] = useState(false)

  useEffect(() => {
    setTituloValue(criativo.titulo ?? '')
  }, [criativo.titulo])

  async function updateField(field: string, val: string | null) {
    await supabase.from('criativos_webdesign').update({ [field]: val }).eq('id', criativo.id)
    onChanged()
  }

  // SLA: 5 dias úteis desde a criação. Verde < 70% · laranja 70–100% · vermelho estourado.
  const sla = slaDoCriativo(criativo)
  const slaEstourado = sla.nivel === 'estourado'
  const slaPct = sla.pct
  const slaBarColor = COR_SLA_CRIATIVO[sla.nivel].barra
  const slaLabelTxt = rotuloSlaCriativo(sla)

  async function commitTitulo() {
    const novo = tituloValue.trim()
    const current = criativo.titulo ?? ''
    if (novo === current) {
      setEditingTitulo(false)
      return
    }
    await updateField('titulo', novo || null)
    setEditingTitulo(false)
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-bg-card overflow-hidden transition-all',
        expanded
          ? 'border-brand-500/50 shadow-lg shadow-brand-500/5'
          : slaEstourado
            ? 'border-red-500/40 hover:border-red-500/60'
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
        <div className={cn('w-1 shrink-0', statusBar[criativo.status])} />
        <div className="flex flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ChevronRight
              size={14}
              className={cn(
                'shrink-0 text-muted transition-transform',
                expanded && 'rotate-90',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="group flex items-center gap-1.5">
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
                        setTituloValue(criativo.titulo ?? '')
                        setEditingTitulo(false)
                      }
                    }}
                    placeholder={criativo.cliente?.nome ?? 'Nome do criativo'}
                    className="w-full min-w-0 rounded-md border border-brand-500 bg-bg-soft px-2 py-0.5 text-sm font-semibold text-zinc-100 focus:outline-none"
                  />
                ) : (
                  <>
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {criativo.titulo || criativo.cliente?.nome || '—'}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingTitulo(true)
                      }}
                      className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-bg-elev hover:text-brand-300 group-hover:opacity-100"
                      title="Editar nome"
                    >
                      <Pencil size={11} />
                    </button>
                  </>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                {editingFormato ? (
                  <select
                    autoFocus
                    value={criativo.formato}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      await updateField('formato', e.target.value)
                      setEditingFormato(false)
                    }}
                    onBlur={() => setEditingFormato(false)}
                    className="h-6 rounded-md border border-brand-500 bg-bg-soft px-1.5 text-[11px] text-zinc-100 focus:outline-none"
                  >
                    {FORMATOS_CRIATIVO.map((f) => (
                      <option key={f} value={f}>
                        {formatoCriativoLabel[f]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingFormato(true)
                    }}
                    className="inline-flex items-center rounded-md border border-border bg-bg-soft px-2 py-0.5 text-[11px] text-zinc-300 hover:border-brand-500/40"
                    title="Trocar formato"
                  >
                    {formatoCriativoLabel[criativo.formato]}
                  </button>
                )}
                {criativo.cliente?.nome && <span>· {criativo.cliente.nome}</span>}
                {criativo.cliente?.nicho && <span>· {criativo.cliente.nicho}</span>}
                {criativo.cliente?.squad && <span>· Squad {criativo.cliente.squad}</span>}
              </div>
              {criativo.status === 'alteracao' && (
                <p
                  className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-md border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-300"
                  title={fluxo.reprovacao?.motivo}
                >
                  🔄 Em ajuste — reprovado{fluxo.reprovacao ? `: ${fluxo.reprovacao.motivo}` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <IconBadge
              on={
                ((criativo.identidade_visual_urls ?? []).filter((u) => !isDeadBlobUrl(u)).length > 0) ||
                (!!criativo.identidade_visual_url && !isDeadBlobUrl(criativo.identidade_visual_url))
              }
              icon={Palette}
              title="Identidade visual"
            />
            <IconBadge
              on={(criativo.fotos ?? []).filter((u) => !isDeadBlobUrl(u)).length > 0}
              icon={ImageIcon}
              title={`${(criativo.fotos ?? []).filter((u) => !isDeadBlobUrl(u)).length} foto(s)`}
            />
            <IconBadge
              on={!!criativo.copy_texto || (!!criativo.copy_arquivo_url && !isDeadBlobUrl(criativo.copy_arquivo_url))}
              icon={Sparkles}
              title="Copy"
            />
          </div>

          <div className="flex items-center gap-2">
            {criativo.url_criativo && !isDeadBlobUrl(criativo.url_criativo) && (
              <a
                href={criativo.url_criativo}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft px-2 py-1 text-[11px] text-zinc-300 hover:border-brand-500/40 hover:text-brand-300"
                title="Abrir arquivo do criativo"
              >
                <ExternalLink size={10} />
                arquivo
              </a>
            )}

            <PrazoInline criativo={criativo} onUpdated={onChanged} />

            <ResponsavelArte
              responsavelId={criativo.responsavel_id}
              equipe={equipe}
              onEscolher={(id) => void updateField('responsavel_id', id)}
            />
          </div>
        </div>
      </div>

      {/* Barra de SLA (5 dias úteis) */}
      <div>
        <div className="h-1 bg-bg-soft">
          <div className={cn('h-full transition-all', slaBarColor)} style={{ width: `${slaPct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3 bg-bg-soft/30 px-4 py-1.5">
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider',
              slaEstourado ? 'text-red-400 font-semibold' : 'text-muted',
            )}
          >
            SLA · prazo máximo {SLA_CRIATIVO_DIAS_UTEIS} dias úteis
          </span>
          <span
            className={cn('text-[11px] font-semibold tabular-nums', COR_SLA_CRIATIVO[sla.nivel].texto)}
            title={`Prazo: ${sla.prazo.toLocaleDateString('pt-BR')}`}
          >
            {slaLabelTxt}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-5">
          {/* key estável (só id): evita remount/perda de foco a cada save.
              External changes só sincronizam quando o usuário fecha e reabre.
              O diff-save protege contra lost-update entre usuários. */}
          <CriativoEditor
            key={criativo.id}
            criativo={criativo}
            clientes={clientes}
            fluxo={fluxo}
            onEtapa={onEtapa}
            onAprovacao={onAprovacao}
            onSaved={onChanged}
            onDeleted={onDeleted}
          />
        </div>
      )}
    </div>
  )
}

function CriativoEditor({
  criativo,
  fluxo,
  onEtapa,
  onAprovacao,
  onSaved,
  onDeleted,
}: {
  criativo: CriativoWebdesign
  clientes: Cliente[]
  fluxo: FluxoCriativo
  onEtapa: (s: StatusCriativoWebdesign, f: FluxoCriativo) => Promise<void>
  onAprovacao: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  // Ao carregar, blob: URLs viram string vazia — assim o user reupload o arquivo
  // e o save substitui o lixo do banco.
  const initialForm = useMemo(() => {
    // Identidade visual: lê do array novo. Se vazio, usa o campo legado
    // single (compat retroativo) como item único do array.
    const idsArr = stripBlobUrls(criativo.identidade_visual_urls ?? [])
    const idsLegacySingle = stripBlobUrl(criativo.identidade_visual_url)
    const identidadeVisualUrls =
      idsArr.length > 0 ? idsArr : idsLegacySingle ? [idsLegacySingle] : []
    return {
      url_criativo: stripBlobUrl(criativo.url_criativo),
      identidade_visual_urls: identidadeVisualUrls,
      fotos: stripBlobUrls(criativo.fotos),
      copy_arquivo_url: stripBlobUrl(criativo.copy_arquivo_url),
      copy_texto: criativo.copy_texto ?? '',
      observacoes: criativo.observacoes ?? '',
    }
  }, [criativo])
  const [form, setForm] = useState(initialForm)
  // Ref que guarda o "estado de origem" (último valor sincronizado com o banco).
  // O save só envia campos que diferem desse ref, evitando sobrescrever
  // alterações que outras pessoas fizeram em paralelo.
  const baselineRef = useRef(initialForm)
  const [novaFoto, setNovaFoto] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [uploadingKind, setUploadingKind] = useState<'identidade' | 'fotos' | 'criativo' | 'copy' | null>(null)
  const firstRenderRef = useRef(true)

  async function handleUploadCopy(file: File | null) {
    if (!file) return
    setUploadingKind('copy')
    const url = await uploadArquivo(file, 'criativos/copy')
    if (url) setForm((f) => ({ ...f, copy_arquivo_url: url }))
    setUploadingKind(null)
  }
  async function handleUploadIdentidade(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingKind('identidade')
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const u = await uploadArquivo(file, 'criativos/identidade')
      if (u) urls.push(u)
    }
    if (urls.length > 0)
      setForm((f) => ({ ...f, identidade_visual_urls: [...f.identidade_visual_urls, ...urls] }))
    setUploadingKind(null)
  }
  function addIdentidadeUrl(url: string) {
    const u = url.trim()
    if (!u) return
    setForm((f) => ({ ...f, identidade_visual_urls: [...f.identidade_visual_urls, u] }))
  }
  function removeIdentidadeUrl(i: number) {
    setForm((f) => ({
      ...f,
      identidade_visual_urls: f.identidade_visual_urls.filter((_, idx) => idx !== i),
    }))
  }
  async function handleUploadFotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingKind('fotos')
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const u = await uploadArquivo(file, 'criativos/fotos')
      if (u) urls.push(u)
    }
    if (urls.length > 0) setForm((f) => ({ ...f, fotos: [...f.fotos, ...urls] }))
    setUploadingKind(null)
  }
  async function handleUploadCriativo(file: File | null) {
    if (!file) return
    setUploadingKind('criativo')
    const url = await uploadArquivo(file, 'criativos/produzido')
    if (url) setForm((f) => ({ ...f, url_criativo: url }))
    setUploadingKind(null)
  }

  function addFotoUrl() {
    const url = novaFoto.trim()
    if (!url) return
    setForm((f) => ({ ...f, fotos: [...f.fotos, url] }))
    setNovaFoto('')
  }
  function removeFoto(i: number) {
    setForm((f) => ({ ...f, fotos: f.fotos.filter((_, idx) => idx !== i) }))
  }

  async function save() {
    // Diff vs baseline — só manda campos que VOCÊ mexeu.
    // Evita pisar em alterações de outras pessoas (lost-update).
    const base = baselineRef.current
    // Etapa/status não passa por aqui: a esteira grava na hora (com o histórico).
    const payload: Record<string, unknown> = {}
    if (form.url_criativo !== base.url_criativo)
      payload.url_criativo = form.url_criativo || null
    if (
      JSON.stringify(form.identidade_visual_urls) !==
      JSON.stringify(base.identidade_visual_urls)
    ) {
      payload.identidade_visual_urls = form.identidade_visual_urls
      // Limpa o campo single legado pra evitar confusão com a fonte de verdade
      payload.identidade_visual_url = null
    }
    if (JSON.stringify(form.fotos) !== JSON.stringify(base.fotos))
      payload.fotos = form.fotos
    if (form.copy_arquivo_url !== base.copy_arquivo_url)
      payload.copy_arquivo_url = form.copy_arquivo_url || null
    if (form.copy_texto !== base.copy_texto)
      payload.copy_texto = form.copy_texto || null
    if (form.observacoes !== base.observacoes)
      payload.observacoes = form.observacoes || null

    if (Object.keys(payload).length === 0) {
      setSaveState('idle')
      return
    }

    setSaveState('saving')
    await supabase.from('criativos_webdesign').update(payload).eq('id', criativo.id)
    // Atualiza baseline pro estado recém-salvo
    baselineRef.current = { ...form }
    setSaveState('saved')
    onSaved()
    setTimeout(() => setSaveState('idle'), 1500)
  }

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    const timer = setTimeout(() => save(), 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  async function excluir() {
    await supabase.from('criativos_webdesign').delete().eq('id', criativo.id)
    setConfirmarExclusao(false)
    onDeleted()
  }

  return (
    <div className="space-y-5">
      <Section
        title="Esteira de produção"
        subtitle="Clique numa etapa pra mover o criativo. Na Aprovação do Design: aprovado vai pra Conclusão, reprovado vai pra Alteração."
      >
        <EsteiraCriativo
          status={criativo.status}
          fluxo={fluxo}
          onMover={(s) => s !== criativo.status && void onEtapa(s, registrarEtapa(fluxo, s))}
          onAprovacao={onAprovacao}
          onReenviar={() => {
            const r = reenviarParaAprovacao(fluxo)
            void onEtapa(r.status, r.fluxo)
          }}
        />
      </Section>

      <Field label="Arquivo final do criativo">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={form.url_criativo}
            onChange={(e) => setForm({ ...form, url_criativo: e.target.value })}
            placeholder="Cole um link OU clique em Upload ao lado"
            className="flex-1 min-w-[200px]"
          />
          <FileUploadButton
            accept="image/*,video/*,application/pdf"
            onFile={handleUploadCriativo}
            busy={uploadingKind === 'criativo'}
            label="Upload criativo"
          />
          {form.url_criativo && (
            <a
              href={form.url_criativo}
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

      <Section
        title="Identidade visual"
        subtitle="Logo, paleta, manual de marca — pode anexar vários arquivos"
        icon={Palette}
      >
        <IdentidadeVisualEditor
          urls={form.identidade_visual_urls}
          onAdd={addIdentidadeUrl}
          onRemove={removeIdentidadeUrl}
          onUpload={handleUploadIdentidade}
          busy={uploadingKind === 'identidade'}
        />
      </Section>

      <Section
        title="Fotos/referências"
        subtitle="Faça upload de várias imagens ou cole URLs"
        icon={ImageIcon}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={novaFoto}
              onChange={(e) => setNovaFoto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addFotoUrl()
                }
              }}
              placeholder="Cole um URL e Enter, OU use Upload ao lado"
              className="flex-1 min-w-[200px]"
            />
            <Button size="sm" variant="outline" onClick={addFotoUrl} disabled={!novaFoto.trim()}>
              <Plus size={12} /> URL
            </Button>
            <FileUploadButton
              accept="image/*"
              multiple
              onFiles={handleUploadFotos}
              busy={uploadingKind === 'fotos'}
              label="Upload fotos"
            />
          </div>
          {form.fotos.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma foto anexada ainda.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {form.fotos.map((url, i) => (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-lg border border-border bg-bg-soft"
                >
                  {isImageUrl(url) ? (
                    <img src={url} alt={`foto ${i + 1}`} className="h-24 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center text-[10px] text-muted p-2 text-center">
                      <a href={url} target="_blank" rel="noreferrer" className="underline break-all">
                        {url}
                      </a>
                    </div>
                  )}
                  <button
                    onClick={() => removeFoto(i)}
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
      </Section>

      <Section
        title="Copy do criativo"
        subtitle="Cole a copy do criativo manualmente, ou anexe um arquivo"
        icon={Sparkles}
      >
        {/* Criativos antigos criados a partir de uma Criação aprovada mantêm a
            indicação; não há recebimento automático nesta tela. */}
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
            Texto da copy {criativo.criacao_origem_id && '(vindo da Criação aprovada)'}
          </p>
          <Textarea
            value={form.copy_texto}
            onChange={(e) => setForm({ ...form, copy_texto: e.target.value })}
            placeholder="Cole aqui a copy do criativo."
            className="min-h-[200px] font-mono text-[13px] leading-relaxed"
          />
        </div>

        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
          Arquivo de copy (PDF/DOC)
        </p>
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
      </Section>

      <Section title="Observações internas">
        <Textarea
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          placeholder="Anotações do time..."
          className="min-h-[70px]"
        />
      </Section>

      <Section title="Histórico de aprovações" subtitle="Decisões da Aprovação do Design (quem, quando e o motivo quando reprovado)">
        <HistoricoCriativo fluxo={fluxo} />
      </Section>

      <DeleteConfirmModal open={confirmarExclusao} onCancel={() => setConfirmarExclusao(false)} onConfirm={excluir} />

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="danger" size="sm" onClick={() => setConfirmarExclusao(true)}>
          <Trash2 size={12} /> Excluir
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

function IconBadge({
  on,
  icon: Icon,
  title,
}: {
  on: boolean
  icon: React.ComponentType<{ size?: number }>
  title: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'grid h-6 w-6 place-items-center rounded-md border',
        on
          ? 'border-brand-500/40 bg-brand-500/15 text-brand-300'
          : 'border-border bg-bg-soft text-zinc-600',
      )}
    >
      <Icon size={12} />
    </span>
  )
}

function PrazoInline({
  criativo,
  onUpdated,
}: {
  criativo: CriativoWebdesign
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(criativo.prazo ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(criativo.prazo ?? '')
  }, [criativo.prazo])

  async function commit(newValue: string) {
    const prazo = newValue || null
    const current = criativo.prazo ?? null
    if (prazo === current) {
      setEditing(false)
      return
    }
    setSaving(true)
    await supabase.from('criativos_webdesign').update({ prazo }).eq('id', criativo.id)
    setSaving(false)
    setEditing(false)
    onUpdated()
  }

  const overdue = isDateOverdue(criativo.prazo) && criativo.status !== 'conclusao'

  if (editing) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
        <input
          type="date"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setValue(criativo.prazo ?? '')
              setEditing(false)
            }
          }}
          disabled={saving}
          className="h-7 rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
        />
        {criativo.prazo && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              commit('')
            }}
            className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:text-red-400"
            title="Remover prazo"
          >
            <X size={12} />
          </button>
        )}
      </div>
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
        criativo.prazo
          ? overdue
            ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
            : 'border-border bg-bg-soft text-zinc-200 hover:border-brand-500/40'
          : 'border-dashed border-border text-muted hover:border-brand-500/40 hover:text-zinc-200',
      )}
      title={criativo.prazo ? 'Clique para editar prazo' : 'Clique para definir prazo'}
    >
      <Calendar size={10} />
      {criativo.prazo ? prazoLabel(criativo.prazo, !!overdue) : 'Definir prazo'}
    </button>
  )
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ size?: number }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-soft/40 p-4">
      <div className="mb-3 flex items-start gap-2">
        {Icon && (
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-500/15 text-brand-300">
            <Icon size={12} />
          </span>
        )}
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
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

/* =========================================================
   Modal: Novo criativo
   ========================================================= */

function NovoCriativoModal({
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
    formato: FormatoCriativo
  }) => Promise<void>
}) {
  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [formato, setFormato] = useState<FormatoCriativo>('feed_estatico')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClienteId('')
    setTitulo('')
    setFormato('feed_estatico')
    setError(null)
  }, [open])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onCreate({ cliente_id: clienteId || null, titulo: titulo.trim(), formato })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo criativo"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Criando...' : 'Criar criativo'}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-muted">
        Cria um criativo vazio na esteira "Pendente". Você define copy, identidade visual, fotos e
        detalhes ao expandir o card.
      </p>
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <CriativoField label="Cliente (opcional)">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">— sem cliente vinculado —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </CriativoField>
        <CriativoField label="Formato *">
          <Select
            value={formato}
            onChange={(e) => setFormato(e.target.value as FormatoCriativo)}
          >
            {FORMATOS_CRIATIVO.map((f) => (
              <option key={f} value={f}>
                {formatoCriativoLabel[f]}
              </option>
            ))}
          </Select>
        </CriativoField>
        <CriativoField label="Título (opcional)">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Promoção Botox H1 — Dra. Fernanda"
          />
          <p className="mt-1 text-[10px] text-muted">
            Se deixar em branco, mostramos o nome do cliente no card.
          </p>
        </CriativoField>
      </div>
    </Modal>
  )
}

function CriativoField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
