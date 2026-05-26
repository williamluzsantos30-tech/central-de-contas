import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Search,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Palette,
  Sparkles,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
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
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { uploadToStorageSafe, stripBlobUrl, stripBlobUrls, isDeadBlobUrl } from '@/lib/storage'
import { isDateOverdue } from '@/lib/dates'
import { IdentidadeVisualEditor } from '@/components/webdesign/IdentidadeVisualEditor'
import {
  cn,
  relativeDueLabel,
  statusProjetoWebdesignLabel,
  STATUS_PROJETO_WEBDESIGN,
  ESTEIRA_WEBDESIGN,
  tipoProjetoWebdesignLabel,
  TIPOS_PROJETO_WEBDESIGN,
} from '@/lib/utils'
import type {
  Cliente,
  Profile,
  ProjetoWebdesign,
  StatusProjetoWebdesign,
  TipoProjetoWebdesign,
} from '@/types/database'

/** Conta quantos dias úteis passaram desde `start` até hoje. */
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

const statusDot: Record<StatusProjetoWebdesign, string> = {
  copy: 'bg-sky-500',
  aprovacao_copy: 'bg-amber-500',
  design: 'bg-violet-500',
  aprovacao_design: 'bg-amber-500',
  implementacao: 'bg-red-500',
  conclusao: 'bg-emerald-500',
  pausado: 'bg-zinc-500',
}

const statusBar: Record<StatusProjetoWebdesign, string> = {
  copy: 'bg-sky-500',
  aprovacao_copy: 'bg-amber-500',
  design: 'bg-violet-500',
  aprovacao_design: 'bg-amber-500',
  implementacao: 'bg-red-500',
  conclusao: 'bg-emerald-500',
  pausado: 'bg-zinc-600',
}

/**
 * Upload pro Supabase Storage (bucket `webdesign-assets`).
 * Retorna a URL pública do arquivo, ou string vazia se falhar
 * (já alerta o usuário internamente).
 *
 * Pré-req: migration 006-storage rodada.
 */
async function uploadArquivo(file: File, folder = 'projetos/misc'): Promise<string> {
  const url = await uploadToStorageSafe(file, folder, 'webdesign-assets')
  return url ?? ''
}

export default function ProjetosWebdesign() {
  const [projetos, setProjetos] = useState<ProjetoWebdesign[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fResponsavel, setFResponsavel] = useState('')
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const [pRes, cRes, rRes] = await Promise.all([
      supabase
        .from('projetos_webdesign')
        .select('*, cliente:clientes(*), responsavel:profiles(*)')
        .order('updated_at', { ascending: false }),
      supabase.from('clientes').select('*').is('arquivado_em', null).order('nome'),
      supabase
        .from('profiles')
        .select('id, nome, avatar_url')
        .eq('ativo', true)
        .eq('aprovado', true)
        .order('nome'),
    ])
    setProjetos((pRes.data as ProjetoWebdesign[]) ?? [])
    setClientes((cRes.data as Cliente[]) ?? [])
    setResponsaveis((rRes.data as Profile[]) ?? [])
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

  const [novoModalOpen, setNovoModalOpen] = useState(false)

  function abrirNovoProjeto() {
    setNovoModalOpen(true)
  }

  async function criarProjeto(payload: {
    cliente_id: string | null
    titulo: string
    tipo: TipoProjetoWebdesign
  }) {
    const { data, error } = await supabase
      .from('projetos_webdesign')
      .insert({
        cliente_id: payload.cliente_id || null,
        titulo: payload.titulo || null,
        tipo: payload.tipo,
        status: 'copy',
        fotos: [],
      })
      .select()
      .single()
    if (error) {
      alert(`Erro ao criar projeto: ${error.message}`)
      return
    }
    const novo = data as ProjetoWebdesign | null
    await load()
    if (novo?.id) setExpandedId(novo.id)
    setNovoModalOpen(false)
  }

  const filtered = useMemo(() => {
    return projetos.filter((p) => {
      const nomeCliente = p.cliente?.nome ?? ''
      if (q && !nomeCliente.toLowerCase().includes(q.toLowerCase())) return false
      if (fTipo && p.tipo !== fTipo) return false
      if (fCliente && p.cliente_id !== fCliente) return false
      if (fResponsavel) {
        if (fResponsavel === '__sem__' && p.responsavel_id) return false
        if (fResponsavel !== '__sem__' && p.responsavel_id !== fResponsavel) return false
      }
      return true
    })
  }, [projetos, q, fTipo, fCliente, fResponsavel])

  const byStatus = useMemo(() => {
    const m = new Map<StatusProjetoWebdesign, ProjetoWebdesign[]>()
    for (const s of STATUS_PROJETO_WEBDESIGN) m.set(s, [])
    for (const p of filtered) m.get(p.status)?.push(p)
    return m
  }, [filtered])

  const sections: StatusProjetoWebdesign[] = [
    ...ESTEIRA_WEBDESIGN.filter((s) => (byStatus.get(s)?.length ?? 0) > 0),
    ...((byStatus.get('pausado')?.length ?? 0) > 0 ? (['pausado'] as StatusProjetoWebdesign[]) : []),
  ]
  const temProjetos = sections.length > 0

  return (
    <div>
      <PageHeader
        title="Landing page"
        description={`${projetos.length} projeto(s) na esteira de produção`}
        actions={
          <Button onClick={abrirNovoProjeto}>
            <Plus size={14} /> Novo projeto
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
          <Select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="w-48">
            <option value="">Todos tipos</option>
            {TIPOS_PROJETO_WEBDESIGN.map((t) => (
              <option key={t} value={t}>
                {tipoProjetoWebdesignLabel[t]}
              </option>
            ))}
          </Select>
          <Select
            value={fResponsavel}
            onChange={(e) => setFResponsavel(e.target.value)}
            className="w-48"
          >
            <option value="">Todos responsáveis</option>
            <option value="__sem__">Sem responsável</option>
            {responsaveis.map((r) => (
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
      ) : !temProjetos ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
          <p className="text-sm text-zinc-200">Nenhum projeto encontrado</p>
          <p className="mt-1 text-xs text-muted">
            Clique em <span className="text-brand-300">Novo projeto</span> para começar.
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
                    {statusProjetoWebdesignLabel[status]}
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
                      <ProjetoAccordion
                        key={p.id}
                        projeto={p}
                        clientes={clientes}
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

      <NovoProjetoModal
        open={novoModalOpen}
        onClose={() => setNovoModalOpen(false)}
        clientes={clientes}
        onCreate={criarProjeto}
      />
    </div>
  )
}

/* =========================================================
   Accordion row — header compacto + corpo expandido inline
   ========================================================= */

function ProjetoAccordion({
  projeto,
  clientes,
  expanded,
  onToggle,
  onChanged,
  onDeleted,
}: {
  projeto: ProjetoWebdesign
  clientes: Cliente[]
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [editingTitulo, setEditingTitulo] = useState(false)
  const [tituloValue, setTituloValue] = useState(projeto.titulo ?? '')
  const [editingTipo, setEditingTipo] = useState(false)
  const [editingResp, setEditingResp] = useState(false)
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])

  useEffect(() => {
    setTituloValue(projeto.titulo ?? '')
  }, [projeto.titulo])

  useEffect(() => {
    // Só designers podem ser responsáveis por landing pages.
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .or('cargo.eq.designer,cargos_extras.cs.{designer}')
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
  }, [])

  async function updateField(field: string, val: string | null) {
    await supabase.from('projetos_webdesign').update({ [field]: val }).eq('id', projeto.id)
    onChanged()
  }

  // SLA: prazo máximo 10 dias úteis desde a criação do projeto
  const SLA_DIAS_UTEIS = 10
  const diasUsados = diasUteisDesde(new Date(projeto.created_at))
  const concluido = projeto.status === 'conclusao'
  const slaEstourado = !concluido && diasUsados > SLA_DIAS_UTEIS
  const slaPct = Math.min(100, Math.round((diasUsados / SLA_DIAS_UTEIS) * 100))
  const slaBarColor = concluido
    ? 'bg-emerald-500/70'
    : slaEstourado
    ? 'bg-red-500/70'
    : diasUsados >= SLA_DIAS_UTEIS - 2
    ? 'bg-amber-500/70'
    : 'bg-sky-500/70'
  const slaLabelTxt = concluido
    ? `SLA cumprido em ${diasUsados}d`
    : slaEstourado
    ? `SLA estourado · ${diasUsados - SLA_DIAS_UTEIS}d`
    : `${diasUsados}/${SLA_DIAS_UTEIS} dias úteis`

  async function commitTitulo() {
    const novo = tituloValue.trim()
    const current = projeto.titulo ?? ''
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
        <div className={cn('w-1 shrink-0', statusBar[projeto.status])} />
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
              {/* Nome do projeto (texto livre) com pencil */}
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
                        setTituloValue(projeto.titulo ?? '')
                        setEditingTitulo(false)
                      }
                    }}
                    placeholder={projeto.cliente?.nome ?? 'Nome do projeto'}
                    className="w-full min-w-0 rounded-md border border-brand-500 bg-bg-soft px-2 py-0.5 text-sm font-semibold text-zinc-100 focus:outline-none"
                  />
                ) : (
                  <>
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {projeto.titulo || projeto.cliente?.nome || '—'}
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
              {/* Tipo (editável ao clicar) + cliente + nicho + squad */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                {editingTipo ? (
                  <select
                    autoFocus
                    value={projeto.tipo}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      await updateField('tipo', e.target.value)
                      setEditingTipo(false)
                    }}
                    onBlur={() => setEditingTipo(false)}
                    className="h-6 rounded-md border border-brand-500 bg-bg-soft px-1.5 text-[11px] text-zinc-100 focus:outline-none"
                  >
                    {TIPOS_PROJETO_WEBDESIGN.map((t) => (
                      <option key={t} value={t}>
                        {tipoProjetoWebdesignLabel[t]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingTipo(true)
                    }}
                    className="inline-flex items-center rounded-md border border-border bg-bg-soft px-2 py-0.5 text-[11px] text-zinc-300 hover:border-brand-500/40"
                    title="Trocar tipo"
                  >
                    {tipoProjetoWebdesignLabel[projeto.tipo]}
                  </button>
                )}
                {projeto.cliente?.nome && <span>· {projeto.cliente.nome}</span>}
                {projeto.cliente?.nicho && <span>· {projeto.cliente.nicho}</span>}
                {projeto.cliente?.squad && <span>· Squad {projeto.cliente.squad}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <IconBadge
              on={!!projeto.briefing_pdf_url && !isDeadBlobUrl(projeto.briefing_pdf_url)}
              icon={FileText}
              title="Briefing PDF"
            />
            <IconBadge
              on={
                ((projeto.identidade_visual_urls ?? []).filter((u) => !isDeadBlobUrl(u)).length > 0) ||
                (!!projeto.identidade_visual_url && !isDeadBlobUrl(projeto.identidade_visual_url))
              }
              icon={Palette}
              title="Identidade visual"
            />
            <IconBadge
              on={(projeto.fotos ?? []).filter((u) => !isDeadBlobUrl(u)).length > 0}
              icon={ImageIcon}
              title={`${(projeto.fotos ?? []).filter((u) => !isDeadBlobUrl(u)).length} foto(s)`}
            />
            <IconBadge
              on={!!projeto.copy_arquivo_url && !isDeadBlobUrl(projeto.copy_arquivo_url)}
              icon={Sparkles}
              title="Copy"
            />
          </div>

          <div className="flex items-center gap-2">
            {projeto.url_producao && (
              <a
                href={projeto.url_producao}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft px-2 py-1 text-[11px] text-zinc-300 hover:border-brand-500/40 hover:text-brand-300"
                title="Abrir produção"
              >
                <ExternalLink size={10} />
                produção
              </a>
            )}

            <PrazoInline projeto={projeto} onUpdated={onChanged} />

            {/* Responsável editável inline */}
            <div onClick={(e) => e.stopPropagation()}>
              {editingResp ? (
                <select
                  autoFocus
                  value={projeto.responsavel_id ?? ''}
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
                  title={
                    projeto.responsavel?.nome
                      ? `Responsável: ${projeto.responsavel.nome}`
                      : 'Clique para adicionar responsável'
                  }
                >
                  {projeto.responsavel ? (
                    <Avatar
                      name={projeto.responsavel.nome}
                      url={projeto.responsavel.avatar_url}
                      size="sm"
                    />
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
      </div>

      {/* Barra de SLA (10 dias úteis) */}
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
            SLA · prazo máximo {SLA_DIAS_UTEIS} dias úteis
          </span>
          <span
            className={cn(
              'text-[11px] font-semibold',
              concluido
                ? 'text-emerald-400'
                : slaEstourado
                ? 'text-red-400'
                : 'text-zinc-200',
            )}
          >
            {slaLabelTxt}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-5">
          {/* key estável (só id): evita remount/perda de foco a cada save.
              External changes só sincronizam quando o usuário fecha e reabre. */}
          <ProjetoEditor
            key={projeto.id}
            projeto={projeto}
            clientes={clientes}
            onSaved={onChanged}
            onDeleted={onDeleted}
          />
        </div>
      )}
    </div>
  )
}

/* =========================================================
   Conteúdo do accordion (antes era o modal)
   ========================================================= */

function ProjetoEditor({
  projeto,
  onSaved,
  onDeleted,
}: {
  projeto: ProjetoWebdesign
  clientes: Cliente[]
  onSaved: () => void
  onDeleted: () => void
}) {
  const initialForm = useMemo(() => {
    const idsArr = stripBlobUrls(projeto.identidade_visual_urls ?? [])
    const idsLegacySingle = stripBlobUrl(projeto.identidade_visual_url)
    const identidadeVisualUrls =
      idsArr.length > 0 ? idsArr : idsLegacySingle ? [idsLegacySingle] : []
    return {
      status: projeto.status,
      url_producao: stripBlobUrl(projeto.url_producao),
      briefing: projeto.briefing ?? '',
      briefing_pdf_url: stripBlobUrl(projeto.briefing_pdf_url),
      identidade_visual_urls: identidadeVisualUrls,
      fotos: stripBlobUrls(projeto.fotos),
      copy_arquivo_url: stripBlobUrl(projeto.copy_arquivo_url),
      copy_texto: projeto.copy_texto ?? '',
      observacoes: projeto.observacoes ?? '',
    }
  }, [projeto])
  const [form, setForm] = useState(initialForm)
  // Baseline pro save baseado em diff (evita lost-update entre usuários)
  const baselineRef = useRef(initialForm)
  const [novaFoto, setNovaFoto] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [uploadingKind, setUploadingKind] = useState<'briefing' | 'identidade' | 'fotos' | 'copy' | null>(null)
  const firstRenderRef = useRef(true)

  async function handleUploadBriefing(file: File | null) {
    if (!file) return
    setUploadingKind('briefing')
    const url = await uploadArquivo(file, 'projetos/briefings')
    if (url) setForm((f) => ({ ...f, briefing_pdf_url: url }))
    setUploadingKind(null)
  }
  async function handleUploadIdentidade(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingKind('identidade')
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const u = await uploadArquivo(file, 'projetos/identidade')
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
      const u = await uploadArquivo(file, 'projetos/fotos')
      if (u) urls.push(u)
    }
    if (urls.length > 0) setForm((f) => ({ ...f, fotos: [...f.fotos, ...urls] }))
    setUploadingKind(null)
  }
  async function handleUploadCopy(file: File | null) {
    if (!file) return
    setUploadingKind('copy')
    const url = await uploadArquivo(file, 'projetos/copy')
    if (url) setForm((f) => ({ ...f, copy_arquivo_url: url }))
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
    // Diff vs baseline — só envia o que VOCÊ mexeu (não pisa em uploads de outros)
    const base = baselineRef.current
    const payload: Record<string, unknown> = {}
    if (form.status !== base.status) payload.status = form.status
    if (form.url_producao !== base.url_producao)
      payload.url_producao = form.url_producao || null
    if (form.briefing !== base.briefing) payload.briefing = form.briefing || null
    if (form.briefing_pdf_url !== base.briefing_pdf_url)
      payload.briefing_pdf_url = form.briefing_pdf_url || null
    if (
      JSON.stringify(form.identidade_visual_urls) !==
      JSON.stringify(base.identidade_visual_urls)
    ) {
      payload.identidade_visual_urls = form.identidade_visual_urls
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
    await supabase.from('projetos_webdesign').update(payload).eq('id', projeto.id)
    baselineRef.current = { ...form }
    setSaveState('saved')
    onSaved()
    setTimeout(() => setSaveState('idle'), 1500)
  }

  // Auto-save debounced
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
    if (!confirm('Excluir este projeto?')) return
    await supabase.from('projetos_webdesign').delete().eq('id', projeto.id)
    onDeleted()
  }

  return (
    <div className="space-y-5">
      <Section title="Esteira de produção" subtitle="Clique em uma etapa para movimentar o projeto">
        <Stepper status={form.status} onChange={(s) => setForm({ ...form, status: s })} />
      </Section>

      <Field label="URL de produção">
        <Input
          value={form.url_producao}
          onChange={(e) => setForm({ ...form, url_producao: e.target.value })}
          placeholder="https://..."
        />
      </Field>

      <Section
        title="Briefing"
        subtitle="Texto descritivo + upload de PDF ou link"
        icon={FileText}
      >
        <div className="space-y-3">
          <Field label="Texto do briefing">
            <Textarea
              value={form.briefing}
              onChange={(e) => setForm({ ...form, briefing: e.target.value })}
              placeholder="Resumo do que o cliente pediu, público, funcionalidades, referências..."
              className="min-h-[90px]"
            />
          </Field>
          <Field label="PDF do briefing">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={form.briefing_pdf_url}
                onChange={(e) => setForm({ ...form, briefing_pdf_url: e.target.value })}
                placeholder="Cole um link OU clique em Upload ao lado"
                className="flex-1 min-w-[200px]"
              />
              <FileUploadButton
                accept="application/pdf"
                onFile={handleUploadBriefing}
                busy={uploadingKind === 'briefing'}
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
          </Field>
        </div>
      </Section>

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
        title="Fotos do projeto"
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
                    <img
                      src={url}
                      alt={`foto ${i + 1}`}
                      className="h-24 w-full object-cover"
                    />
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
        title="Copy do projeto"
        subtitle="Texto da copy (recebido automaticamente da Criação aprovada) e/ou arquivo"
        icon={Sparkles}
      >
        {/* Texto da copy — vem preenchido quando o projeto foi criado via
            aprovação de uma Copy LP em Criações */}
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
            Texto da copy {projeto.criacao_origem_id && '(vindo da Criação aprovada)'}
          </p>
          <Textarea
            value={form.copy_texto}
            onChange={(e) => setForm({ ...form, copy_texto: e.target.value })}
            placeholder="Cole aqui a copy completa da landing page OU recebida automaticamente da Criação."
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

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="danger" size="sm" onClick={excluir}>
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

/* =========================================================
   Subcomponentes
   ========================================================= */

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
      <Button
        size="sm"
        variant="outline"
        onClick={() => ref.current?.click()}
        disabled={busy}
      >
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
  projeto,
  onUpdated,
}: {
  projeto: ProjetoWebdesign
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(projeto.prazo ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(projeto.prazo ?? '')
  }, [projeto.prazo])

  async function commit(newValue: string) {
    const prazo = newValue || null
    const current = projeto.prazo ?? null
    if (prazo === current) {
      setEditing(false)
      return
    }
    setSaving(true)
    await supabase.from('projetos_webdesign').update({ prazo }).eq('id', projeto.id)
    setSaving(false)
    setEditing(false)
    onUpdated()
  }

  const overdue =
    isDateOverdue(projeto.prazo) &&
    projeto.status !== 'conclusao' &&
    projeto.status !== 'pausado'

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
              setValue(projeto.prazo ?? '')
              setEditing(false)
            }
          }}
          disabled={saving}
          className="h-7 rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
        />
        {projeto.prazo && (
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
        projeto.prazo
          ? overdue
            ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
            : 'border-border bg-bg-soft text-zinc-200 hover:border-brand-500/40'
          : 'border-dashed border-border text-muted hover:border-brand-500/40 hover:text-zinc-200',
      )}
      title={projeto.prazo ? 'Clique para editar prazo' : 'Clique para definir prazo'}
    >
      <Calendar size={10} />
      {projeto.prazo ? relativeDueLabel(projeto.prazo) : 'Definir prazo'}
    </button>
  )
}

function Stepper({
  status,
  onChange,
}: {
  status: StatusProjetoWebdesign
  onChange: (s: StatusProjetoWebdesign) => void
}) {
  const idx = ESTEIRA_WEBDESIGN.indexOf(status)
  const isOff = status === 'pausado'
  return (
    <div>
      <div className="flex items-center">
        {ESTEIRA_WEBDESIGN.map((s, i) => {
          const done = !isOff && i < idx
          const current = !isOff && i === idx
          return (
            <div key={s} className="flex items-center flex-1">
              <button
                onClick={() => onChange(s)}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full border text-[11px] font-semibold transition-colors shrink-0',
                  done && 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
                  current && 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/30',
                  !done && !current && 'bg-bg-soft border-border text-muted hover:text-zinc-200',
                )}
                title={statusProjetoWebdesignLabel[s]}
              >
                {done ? <Check size={12} /> : i + 1}
              </button>
              {i < ESTEIRA_WEBDESIGN.length - 1 && (
                <div
                  className={cn('h-0.5 flex-1', done ? 'bg-emerald-500/40' : 'bg-border')}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1 text-[10px] uppercase tracking-wider">
        {ESTEIRA_WEBDESIGN.map((s, i) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              'text-center truncate hover:text-zinc-200',
              !isOff && i === idx ? 'text-brand-300 font-semibold' : 'text-muted',
            )}
          >
            {statusProjetoWebdesignLabel[s]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center">
        <button
          onClick={() => onChange(isOff ? 'copy' : 'pausado')}
          className={cn(
            'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
            isOff
              ? 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300'
              : 'border-border text-muted hover:text-zinc-200',
          )}
        >
          {isOff ? '⏸ Pausado — clique para retomar' : '⏸ Pausar projeto'}
        </button>
      </div>
    </div>
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
   Modal: Novo projeto (Landing page)
   ========================================================= */

function NovoProjetoModal({
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
    tipo: TipoProjetoWebdesign
  }) => Promise<void>
}) {
  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoProjetoWebdesign>('landing_page')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClienteId('')
    setTitulo('')
    setTipo('landing_page')
    setError(null)
  }, [open])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onCreate({ cliente_id: clienteId || null, titulo: titulo.trim(), tipo })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo projeto"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Criando...' : 'Criar projeto'}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-muted">
        Cria um projeto vazio na esteira "Copy". Você define copy, identidade visual, prazo e
        detalhes ao expandir o card.
      </p>
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <ProjetoField label="Cliente (opcional)">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">— sem cliente vinculado —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </ProjetoField>
        <ProjetoField label="Tipo *">
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoProjetoWebdesign)}
          >
            {TIPOS_PROJETO_WEBDESIGN.map((t) => (
              <option key={t} value={t}>
                {tipoProjetoWebdesignLabel[t]}
              </option>
            ))}
          </Select>
        </ProjetoField>
        <ProjetoField label="Título (opcional)">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: LP Botox H1 — Dra. Fernanda"
          />
          <p className="mt-1 text-[10px] text-muted">
            Se deixar em branco, mostramos o nome do cliente no card.
          </p>
        </ProjetoField>
      </div>
    </Modal>
  )
}

function ProjetoField({
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
