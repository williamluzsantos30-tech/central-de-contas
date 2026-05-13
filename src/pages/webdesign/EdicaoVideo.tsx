import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Search,
  Film,
  ExternalLink,
  Trash2,
  Calendar,
  User,
  Upload,
  X,
  Link as LinkIcon,
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

// Cor do dot do status na coluna
const statusDot: Record<StatusEdicaoVideo, string> = {
  pendente: 'bg-zinc-500',
  em_edicao: 'bg-sky-500',
  em_aprovacao: 'bg-amber-500',
  em_alteracao: 'bg-orange-500',
  conclusao: 'bg-emerald-500',
}

// Tom do badge de status
const statusTone: Record<
  StatusEdicaoVideo,
  'neutral' | 'info' | 'warning' | 'danger' | 'success'
> = {
  pendente: 'neutral',
  em_edicao: 'info',
  em_aprovacao: 'warning',
  em_alteracao: 'danger',
  conclusao: 'success',
}

export default function EdicaoVideo() {
  const [edicoes, setEdicoes] = useState<EdicaoVideo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtroCliente, setFiltroCliente] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EdicaoVideo | null>(null)

  async function load() {
    setLoading(true)
    const [eRes, cRes] = await Promise.all([
      supabase
        .from('edicoes_video')
        .select('*, cliente:clientes(*), responsavel:profiles!responsavel_id(*)')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setEdicoes((eRes.data as EdicaoVideo[]) ?? [])
    setClientes((cRes.data as Cliente[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let arr = edicoes
    if (filtroCliente) arr = arr.filter((e) => e.cliente_id === filtroCliente)
    if (q.trim()) {
      const term = q.toLowerCase()
      arr = arr.filter(
        (e) =>
          (e.titulo ?? '').toLowerCase().includes(term) ||
          (e.cliente?.nome ?? '').toLowerCase().includes(term),
      )
    }
    return arr
  }, [edicoes, filtroCliente, q])

  const porStatus = useMemo(() => {
    const map = new Map<StatusEdicaoVideo, EdicaoVideo[]>()
    for (const s of ESTEIRA_EDICAO_VIDEO) map.set(s, [])
    for (const e of filtered) {
      const arr = map.get(e.status) ?? []
      arr.push(e)
      map.set(e.status, arr)
    }
    return map
  }, [filtered])

  function abrirNovo() {
    setEditing(null)
    setModalOpen(true)
  }

  function abrirEdicao(e: EdicaoVideo) {
    setEditing(e)
    setModalOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Edição de Vídeo"
        description={`Esteira de produção de vídeo · SLA: 2 vídeos a cada 3 dias úteis · ${edicoes.length} item(ns)`}
        actions={
          <Button onClick={abrirNovo}>
            <Plus size={14} /> Nova edição
          </Button>
        }
      />

      {/* Filtros */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título ou cliente..."
              className="pl-9"
            />
          </div>
          <Select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="w-56"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        // Esteira horizontal com scroll
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-2" style={{ minWidth: 'fit-content' }}>
            {ESTEIRA_EDICAO_VIDEO.map((status) => {
              const items = porStatus.get(status) ?? []
              return (
                <div
                  key={status}
                  className="flex-shrink-0 w-[280px] rounded-xl border border-border bg-bg-soft/40"
                >
                  {/* Header da coluna */}
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', statusDot[status])} />
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-zinc-200">
                        {statusEdicaoVideoLabel[status]}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted">{items.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 p-2 min-h-[120px]">
                    {items.length === 0 ? (
                      <p className="px-2 py-4 text-center text-[11px] text-muted">
                        —
                      </p>
                    ) : (
                      items.map((e) => (
                        <EdicaoCard
                          key={e.id}
                          edicao={e}
                          onClick={() => abrirEdicao(e)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
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
   Card de uma edição na esteira
========================================================= */

function EdicaoCard({
  edicao,
  onClick,
}: {
  edicao: EdicaoVideo
  onClick: () => void
}) {
  const atrasada =
    edicao.status !== 'conclusao' && isDateOverdue(edicao.prazo)
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border bg-bg-card p-3 text-left transition-colors hover:bg-bg-elev',
        atrasada
          ? 'border-red-500/40 hover:border-red-500/60'
          : 'border-border hover:border-brand-500/40',
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="flex-1 truncate text-sm font-medium text-zinc-100">
          {edicao.titulo || 'Sem título'}
        </span>
        {edicao.responsavel && (
          <Avatar
            name={edicao.responsavel.nome}
            url={edicao.responsavel.avatar_url}
            size="sm"
          />
        )}
      </div>
      {edicao.cliente && (
        <p className="mb-2 truncate text-[11px] text-muted">{edicao.cliente.nome}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        {edicao.prazo ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]',
              atrasada
                ? 'border border-red-500/40 bg-red-500/10 text-red-300'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-200',
            )}
          >
            <Calendar size={9} />
            {formatDateBR(edicao.prazo)}
          </span>
        ) : (
          <span className="text-[10px] text-muted">Sem prazo</span>
        )}
        <Badge tone={statusTone[edicao.status]} className="text-[9px]">
          {statusEdicaoVideoLabel[edicao.status]}
        </Badge>
      </div>
    </button>
  )
}

/* =========================================================
   Modal de criar/editar
========================================================= */

function EdicaoVideoModal({
  open,
  onClose,
  edicao,
  clientes,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  edicao: EdicaoVideo | null
  clientes: Cliente[]
  onSaved: () => void
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    // Carrega designers (incluindo cargos_extras)
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .or('cargo.eq.designer,cargos_extras.cs.{designer}')
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))

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
  }, [open, edicao])

  async function save() {
    if (!form.cliente_id) {
      alert('Selecione um cliente.')
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
    const novos: EdicaoArquivo[] = []
    for (const file of Array.from(files)) {
      const url = await uploadToStorageSafe(file, 'edicao-video', 'webdesign-assets')
      if (!url) continue
      novos.push({ nome: file.name, tamanho: file.size, tipo: file.type, url })
    }
    if (novos.length > 0) {
      setForm((f) => ({ ...f, arquivos: [...f.arquivos, ...novos] }))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : edicao ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cliente + Status */}
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

        {/* Título */}
        <Field label="Título">
          <Input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex.: Reel — Antes e Depois Camila"
          />
        </Field>

        {/* Responsável + Aprovação */}
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

        {/* Briefing */}
        <Field label="Briefing / Contexto">
          <Textarea
            value={form.briefing}
            onChange={(e) => setForm({ ...form, briefing: e.target.value })}
            placeholder="Descreva o objetivo do vídeo, formato, tom, duração estimada, peças-chave..."
            className="min-h-[90px]"
          />
        </Field>

        {/* Referências (links) */}
        <ReferenciasField
          values={form.referencias}
          onChange={(referencias) => setForm({ ...form, referencias })}
        />

        {/* Arquivos brutos */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Arquivos brutos / referências</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} /> Adicionar arquivos
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
          {form.arquivos.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-bg-soft px-3 py-4 text-center text-xs text-muted">
              Suba briefings, prints, áudios de referência, transcrições — o que ajudar
              o editor.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {form.arquivos.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-soft px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs text-zinc-200 hover:text-brand-300 hover:underline"
                      title={a.nome}
                    >
                      {a.nome}
                    </a>
                    <span className="shrink-0 text-[11px] text-muted">
                      {formatBytes(a.tamanho)}
                    </span>
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
              ))}
            </ul>
          )}
        </div>

        {/* Vídeo final entregue */}
        <Field label="Vídeo final entregue (URL)">
          <Input
            value={form.video_final_url}
            onChange={(e) => setForm({ ...form, video_final_url: e.target.value })}
            placeholder="Cole o link do vídeo finalizado (Drive, Vimeo, etc.)"
          />
          {form.video_final_url && (
            <a
              href={form.video_final_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-brand-300 hover:underline"
            >
              <ExternalLink size={11} /> Abrir vídeo final
            </a>
          )}
        </Field>

        {/* Observações */}
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
   Campo de Referências (chips de links)
========================================================= */

function ReferenciasField({
  values,
  onChange,
}: {
  values: EdicaoReferencia[]
  onChange: (next: EdicaoReferencia[]) => void
}) {
  const [tipo, setTipo] = useState<TipoReferenciaVideo>('drive')
  const [url, setUrl] = useState('')
  const [descricao, setDescricao] = useState('')

  function add() {
    const u = url.trim()
    if (!u) return
    onChange([...values, { tipo, url: u, descricao: descricao.trim() || null }])
    setUrl('')
    setDescricao('')
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }

  function detectTipo(u: string): TipoReferenciaVideo {
    const low = u.toLowerCase()
    if (low.includes('drive.google')) return 'drive'
    if (low.includes('youtube.com') || low.includes('youtu.be')) return 'youtube'
    if (low.includes('vimeo.com')) return 'vimeo'
    return 'link'
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
      <div className="grid grid-cols-[110px_1fr_auto] gap-2">
        <Select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoReferenciaVideo)}
        >
          <option value="drive">Drive</option>
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="link">Link</option>
        </Select>
        <Input
          value={url}
          onChange={(e) => {
            const v = e.target.value
            setUrl(v)
            if (v.startsWith('http')) setTipo(detectTipo(v))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Cole o URL (Drive, YouTube...)"
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

// Ícones não usados — reservados pra extensões futuras
void Film
void LinkIcon
void User
