/**
 * Modal de criar/editar um VÍDEO, em 3 seções:
 *   Informações (sempre visível) · Briefing & Referências · Entrega.
 * A Entrega abre sozinha quando o vídeo está em aprovação/concluído e é onde
 * o vídeo final pode ser vinculado a uma postagem do Calendário (a mídia vai
 * pro post automaticamente). Excluir pede confirmação.
 *
 * Anexos (arquivos, links, referências, vídeo final) são gravados no ato em
 * vídeos já existentes, pra não sumirem se a pessoa fechar sem salvar.
 */
import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  Link as LinkIcon,
  PackageCheck,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { uploadToStorageSafe } from '@/lib/storage'
import { calculateSLADeadline, formatDateBR } from '@/lib/dates'
import { cn, statusEdicaoVideoLabel, ESTEIRA_EDICAO_VIDEO, tipoReferenciaVideoLabel } from '@/lib/utils'
import { getPostPub, setPostMedia } from '@/components/social/mockPosts'
import type {
  Cliente,
  EdicaoArquivo,
  EdicaoReferencia,
  EdicaoVideo,
  ItemSocialMedia,
  StatusEdicaoVideo,
  TipoReferenciaVideo,
} from '@/types/database'
import { LOTE_EDICAO_PADRAO, type ConfigLote } from './lotes'
import { carregarEditores, EDITORES_VAZIO, type ListaEditores } from './editores'
import { dataCurta } from './estilos'

interface Form {
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
  descricao_alteracao: string
  social_media_item_id: string
}

const FORM_VAZIO: Form = {
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
  descricao_alteracao: '',
  social_media_item_id: '',
}

const entregaEmFoco = (s: StatusEdicaoVideo) => s === 'em_aprovacao' || s === 'conclusao'

export function VideoEditModal({
  open,
  onClose,
  edicao,
  clientes,
  onSaved,
  previewMode = false,
  editores: editoresProp,
  vinculadosEmOutros,
  cfg = LOTE_EDICAO_PADRAO,
}: {
  open: boolean
  onClose: () => void
  edicao: EdicaoVideo | null
  clientes: Cliente[]
  onSaved: () => void
  previewMode?: boolean
  editores?: ListaEditores
  /** Postagens já vinculadas a OUTROS vídeos (não podem ser escolhidas). */
  vinculadosEmOutros?: Set<string>
  cfg?: ConfigLote
}) {
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [secoes, setSecoes] = useState({ briefing: true, entrega: false })
  const [editoresProprios, setEditoresProprios] = useState<ListaEditores>(EDITORES_VAZIO)
  const editores = editoresProp ?? editoresProprios
  const [saving, setSaving] = useState(false)
  const [uploadingFinal, setUploadingFinal] = useState(false)
  const [uploadingArquivos, setUploadingArquivos] = useState(false)
  const [novoArquivoUrl, setNovoArquivoUrl] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const videoFinalInputRef = useRef<HTMLInputElement | null>(null)
  // Inicializa uma vez por abertura (o pai pode refazer a lista com o modal aberto).
  const inicializadoPara = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      inicializadoPara.current = null
      return
    }
    if (!editoresProp && !previewMode && editoresProprios.pessoas.length === 0) carregarEditores().then(setEditoresProprios)
    const chave = edicao?.id ?? 'new'
    if (inicializadoPara.current === chave) return
    inicializadoPara.current = chave
    const f: Form = edicao
      ? {
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
          descricao_alteracao: edicao.descricao_alteracao ?? '',
          social_media_item_id: edicao.social_media_item_id ?? '',
        }
      : FORM_VAZIO
    setForm(f)
    const foco = entregaEmFoco(f.status) || !!f.video_final_url
    setSecoes({ briefing: !edicao || !foco, entrega: foco })
    setConfirmarExclusao(false)
  }, [open, edicao, previewMode, editoresProp, editoresProprios.pessoas.length])

  // Mudou pra "em aprovação"/"concluído" → a Entrega vem pra frente.
  function mudarStatus(s: StatusEdicaoVideo) {
    setForm((f) => ({ ...f, status: s }))
    if (entregaEmFoco(s)) setSecoes((x) => ({ ...x, entrega: true }))
  }

  async function persistPatch(patch: Record<string, unknown>) {
    if (!edicao?.id || previewMode) return
    await supabase.from('edicoes_video').update(patch).eq('id', edicao.id)
  }

  async function save() {
    if (!form.cliente_id) {
      alert('Selecione um cliente.')
      return
    }
    if (previewMode) {
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
      descricao_alteracao: form.descricao_alteracao || null,
      social_media_item_id: form.social_media_item_id || null,
    }
    const { error } = edicao
      ? await supabase.from('edicoes_video').update(payload).eq('id', edicao.id)
      : await supabase.from('edicoes_video').insert(payload)
    if (error) {
      setSaving(false)
      alert('Erro ao salvar: ' + error.message)
      return
    }
    await sincronizarPostagem(edicao, payload.social_media_item_id, payload.video_final_url)
    setSaving(false)
    onSaved()
    onClose()
  }

  async function excluir() {
    if (!edicao || previewMode) return
    await supabase.from('edicoes_video').delete().eq('id', edicao.id)
    setConfirmarExclusao(false)
    onSaved()
    onClose()
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0 || previewMode) return
    setUploadingArquivos(true)
    try {
      const novos: EdicaoArquivo[] = []
      for (const file of Array.from(files)) {
        const url = await uploadToStorageSafe(file, 'edicao-video', 'webdesign-assets')
        if (url) novos.push({ nome: file.name, tamanho: file.size, tipo: file.type, url })
      }
      if (novos.length > 0) {
        const arquivos = [...form.arquivos, ...novos]
        setForm((f) => ({ ...f, arquivos }))
        await persistPatch({ arquivos })
      }
    } finally {
      setUploadingArquivos(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function addLinkArquivo() {
    const url = novoArquivoUrl.trim()
    if (!url) return
    const arquivos = [...form.arquivos, { nome: nomeDoLink(url), tamanho: 0, tipo: tipoDoLink(url), url }]
    setForm((f) => ({ ...f, arquivos }))
    setNovoArquivoUrl('')
    void persistPatch({ arquivos })
  }

  async function onVideoFinalSelected(files: FileList | null) {
    const file = files?.[0]
    if (!file || previewMode) return
    setUploadingFinal(true)
    try {
      const url = await uploadToStorageSafe(file, 'edicao-video-final', 'webdesign-assets')
      if (url) {
        setForm((f) => ({ ...f, video_final_url: url }))
        await persistPatch({ video_final_url: url })
      }
    } finally {
      setUploadingFinal(false)
      if (videoFinalInputRef.current) videoFinalInputRef.current.value = ''
    }
  }

  const prazoSeAprovar = calculateSLADeadline(new Date(), cfg.slaDiasUteis)
  const prazoAtual = form.aprovado_em ? calculateSLADeadline(form.aprovado_em, cfg.slaDiasUteis) : null
  const uploading = uploadingArquivos || uploadingFinal
  const nArquivos = form.referencias.length + form.arquivos.length

  return (
    <>
      <Modal
        open={open && !confirmarExclusao}
        onClose={onClose}
        className="max-w-3xl"
        title={edicao ? 'Editar vídeo' : 'Novo vídeo'}
        footer={
          <div className="flex items-center justify-between gap-2">
            {edicao ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmarExclusao(true)} disabled={previewMode}>
                <Trash2 size={14} /> Excluir
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              {uploading && <span className="text-[11px] text-amber-300">Aguarde o upload terminar</span>}
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || uploading}>
                {saving ? 'Salvando...' : edicao ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Alteração pedida pelo cliente — no topo pra ninguém perder */}
          {form.status === 'em_alteracao' && (
            <div className="rounded-xl border-2 border-red-500/60 bg-red-500/5 p-4">
              <p className="mb-2 text-sm font-semibold text-red-200">⚠ Descrição da alteração <span className="text-[11px] font-normal text-red-300/80">— o que o cliente pediu pra mudar</span></p>
              <Textarea
                autoFocus={!form.descricao_alteracao}
                value={form.descricao_alteracao}
                onChange={(e) => {
                  const val = e.target.value
                  setForm((f) => ({ ...f, descricao_alteracao: val }))
                  void persistPatch({ descricao_alteracao: val || null })
                }}
                placeholder="Ex.: Cortar o início (0–8s). Ajustar o áudio no 1:20. Trocar a capa."
                className="min-h-[80px] border-red-500/30 bg-bg-soft text-sm focus:border-red-500/60"
              />
            </div>
          )}

          {/* ── Informações ─────────────────────────────── */}
          <section className="rounded-xl border border-border bg-bg-soft/30 p-4">
            <TituloSecao icon={Info} titulo="Informações" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Cliente">
                <Select value={form.cliente_id} onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))} disabled={!!edicao}>
                  <option value="">—</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status do vídeo">
                <Select value={form.status} onChange={(e) => mudarStatus(e.target.value as StatusEdicaoVideo)}>
                  {ESTEIRA_EDICAO_VIDEO.map((s) => (
                    <option key={s} value={s}>
                      {statusEdicaoVideoLabel[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Título">
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex.: Reel — Antes e Depois Camila"
                />
              </Field>
              <Field label="Responsável (editor)">
                <Select value={form.responsavel_id} onChange={(e) => setForm((f) => ({ ...f, responsavel_id: e.target.value }))}>
                  <option value="">Sem responsável</option>
                  {editores.pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Select>
                {editores.equipeToda && (
                  <p className="mt-1 text-[10px] text-muted">Ninguém com papel de editor/designer na Equipe Operacional — mostrando a equipe toda.</p>
                )}
              </Field>
            </div>

            {/* Aprovação do cliente = início do SLA */}
            <div className={cn('mt-4 rounded-lg border p-3', form.aprovado_em ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-bg-card')}>
              {form.aprovado_em ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs text-zinc-100">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Aprovado em {formatDateBR(form.aprovado_em)} — Prazo: <strong>{prazoAtual ? dataCurta(prazoAtual) : '—'}</strong>
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, aprovado_em: null }))}>
                    Desfazer aprovação
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    O SLA começa quando o cliente aprova o vídeo pra edição: prazo = aprovação + {cfg.slaDiasUteis} dias úteis
                    {' '}(aprovando hoje: <span className="text-zinc-200">{dataCurta(prazoSeAprovar)}</span>).
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, aprovado_em: new Date().toISOString() }))}>
                    <CheckCircle2 size={13} /> Marcar como aprovado
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* ── Briefing & Referências ──────────────────── */}
          <SecaoColapsavel
            icon={FileText}
            titulo="Briefing & Referências"
            resumo={[form.briefing.trim() ? 'briefing preenchido' : 'sem briefing', nArquivos ? `${nArquivos} anexo(s)` : null].filter(Boolean).join(' · ')}
            aberta={secoes.briefing}
            onToggle={() => setSecoes((s) => ({ ...s, briefing: !s.briefing }))}
          >
            <Field label="Briefing / Contexto">
              <Textarea
                value={form.briefing}
                onChange={(e) => setForm((f) => ({ ...f, briefing: e.target.value }))}
                placeholder="Objetivo do vídeo, formato, tom, duração, peças-chave..."
                className="min-h-[90px]"
              />
            </Field>
            <ReferenciasField
              values={form.referencias}
              onChange={(referencias) => {
                setForm((f) => ({ ...f, referencias }))
                void persistPatch({ referencias })
              }}
            />
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label>Arquivos brutos / referências</Label>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingArquivos || previewMode}>
                  <Upload size={13} /> {uploadingArquivos ? 'Enviando...' : 'Adicionar arquivos'}
                </Button>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => onFilesSelected(e.target.files)} />
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
                  placeholder="Ou cole um link do Drive/YouTube/Vimeo (pasta de brutos etc.)"
                />
                <Button size="sm" variant="outline" onClick={addLinkArquivo} disabled={!novoArquivoUrl.trim()}>
                  <LinkIcon size={13} /> Adicionar link
                </Button>
              </div>
              {form.arquivos.length > 0 && (
                <ul className="space-y-1.5">
                  {form.arquivos.map((a, i) => {
                    const isLink = a.tamanho === 0
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-soft px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {isLink && <Badge tone="neutral" className="shrink-0 text-[9px] uppercase">{a.tipo}</Badge>}
                          <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-xs text-zinc-200 hover:text-brand-300 hover:underline" title={isLink ? a.url : a.nome}>
                            {isLink ? a.url : a.nome}
                          </a>
                          {!isLink && <span className="shrink-0 text-[11px] text-muted">{formatBytes(a.tamanho)}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const arquivos = form.arquivos.filter((_, idx) => idx !== i)
                            setForm((f) => ({ ...f, arquivos }))
                            void persistPatch({ arquivos })
                          }}
                          className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
                          aria-label="Remover arquivo"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </SecaoColapsavel>

          {/* ── Entrega ─────────────────────────────────── */}
          <SecaoColapsavel
            icon={PackageCheck}
            titulo="Entrega"
            resumo={[form.video_final_url ? 'vídeo final anexado' : 'sem vídeo final', form.social_media_item_id ? 'vinculado ao Calendário' : null].filter(Boolean).join(' · ')}
            aberta={secoes.entrega}
            onToggle={() => setSecoes((s) => ({ ...s, entrega: !s.entrega }))}
          >
            <Field label="Vídeo final entregue">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={form.video_final_url}
                  onChange={(e) => setForm((f) => ({ ...f, video_final_url: e.target.value }))}
                  placeholder="Cole o link (Drive, Vimeo, YouTube) ou faça upload"
                />
                <Button size="sm" variant="outline" onClick={() => videoFinalInputRef.current?.click()} disabled={uploadingFinal || previewMode}>
                  <Upload size={13} /> {uploadingFinal ? 'Enviando...' : 'Upload'}
                </Button>
                <input ref={videoFinalInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => onVideoFinalSelected(e.target.files)} />
              </div>
              {form.video_final_url && (
                <a href={form.video_final_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-brand-300 hover:underline">
                  <ExternalLink size={11} /> Abrir vídeo final
                </a>
              )}
              <p className="mt-1 text-[10px] text-muted">Arquivos grandes (acima de 50 MB): prefira o link do Drive/Vimeo.</p>
            </Field>

            {form.cliente_id && !previewMode && (
              <LinkToPostSelector
                clienteId={form.cliente_id}
                itemId={form.social_media_item_id || null}
                temVideoFinal={!!form.video_final_url.trim()}
                bloqueados={vinculadosEmOutros}
                onChange={(id) => setForm((f) => ({ ...f, social_media_item_id: id ?? '' }))}
              />
            )}

            <Field label="Observações internas">
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Notas internas (não vão pro cliente)."
                className="min-h-[60px]"
              />
            </Field>
          </SecaoColapsavel>
        </div>
      </Modal>

      <DeleteConfirmModal
        open={open && confirmarExclusao}
        titulo={edicao?.titulo ?? null}
        onCancel={() => setConfirmarExclusao(false)}
        onConfirm={excluir}
      />
    </>
  )
}

/* ─── Vincular à postagem do Calendário ─────────────────────────────────── */

/**
 * Leva o vídeo final pra postagem vinculada: grava a mídia (midiaFinal) no
 * post e o link do Drive no item, se ainda vazio. Ao trocar/desfazer o
 * vínculo, tira do post antigo a mídia que tinha vindo deste vídeo.
 */
async function sincronizarPostagem(antes: EdicaoVideo | null, novoItemId: string | null, videoUrl: string | null) {
  const antigoId = antes?.social_media_item_id ?? null
  if (antigoId && antigoId !== novoItemId) {
    const pub = getPostPub(antigoId)
    if (pub.midiaFinal?.urls.some((u) => u === antes?.video_final_url || u === videoUrl)) setPostMedia(antigoId, undefined, pub.legendaFinal)
  }
  if (novoItemId && videoUrl) {
    const pub = getPostPub(novoItemId)
    setPostMedia(novoItemId, { urls: [videoUrl], tipoArquivo: 'video' }, pub.legendaFinal)
    await supabase.from('producoes_social_media_items').update({ link_drive_video: videoUrl }).eq('id', novoItemId).is('link_drive_video', null)
  }
}

const FORMATO_LABEL: Record<string, string> = { reel: 'Reel', carrossel: 'Carrossel', estatico: 'Estático', outro: 'Outro' }

function LinkToPostSelector({
  clienteId,
  itemId,
  temVideoFinal,
  bloqueados,
  onChange,
}: {
  clienteId: string
  itemId: string | null
  temVideoFinal: boolean
  bloqueados?: Set<string>
  onChange: (id: string | null) => void
}) {
  const [itens, setItens] = useState<ItemSocialMedia[] | null>(null)

  useEffect(() => {
    let vivo = true
    setItens(null)
    ;(async () => {
      const { data: planos } = await supabase.from('producoes_social_media').select('id').eq('cliente_id', clienteId)
      const ids = ((planos as { id: string }[]) ?? []).map((p) => p.id)
      if (!ids.length) {
        if (vivo) setItens([])
        return
      }
      const { data } = await supabase.from('producoes_social_media_items').select('*').in('producao_id', ids)
      if (vivo) setItens((data as ItemSocialMedia[]) ?? [])
    })()
    return () => {
      vivo = false
    }
  }, [clienteId])

  const atual = itens?.find((i) => i.id === itemId) ?? null
  // Pendentes de mídia: não publicados, formato de vídeo, sem mídia final e
  // sem outro vídeo vinculado. O vínculo atual sempre aparece.
  const opcoes = (itens ?? [])
    .filter(
      (i) =>
        i.id === itemId ||
        (!i.publicado_em &&
          (i.formato === 'reel' || i.formato === 'outro') &&
          !(getPostPub(i.id).midiaFinal?.urls.length) &&
          !bloqueados?.has(i.id)),
    )
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))

  const rotulo = (i: ItemSocialMedia) => `${i.prazo ? formatDateBR(i.prazo) : 'sem data'} · ${i.titulo} (${FORMATO_LABEL[i.formato] ?? i.formato})`

  return (
    <div className="rounded-lg border border-border bg-bg-card p-3">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        <CalendarDays size={12} /> Vincular a uma postagem do Calendário <span className="normal-case tracking-normal">(opcional)</span>
      </p>
      {!temVideoFinal ? (
        <p className="text-xs text-muted">
          {atual
            ? <>Vinculado a <span className="text-zinc-200">{rotulo(atual)}</span>. A mídia vai pro post assim que o vídeo final for anexado.</>
            : 'Anexe o vídeo final acima pra poder vinculá-lo a uma postagem.'}
        </p>
      ) : itens === null ? (
        <p className="text-xs text-muted">Carregando postagens…</p>
      ) : opcoes.length === 0 ? (
        <p className="text-xs text-muted">Nenhuma postagem de vídeo pendente de mídia pra este cliente.</p>
      ) : (
        <>
          <Select value={itemId ?? ''} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">Não vincular</option>
            {opcoes.map((i) => (
              <option key={i.id} value={i.id}>
                {rotulo(i)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-[10px] text-muted">
            Ao salvar, o vídeo final vira a mídia dessa postagem no Calendário (pronta pra publicar no Instagram).
          </p>
        </>
      )}
    </div>
  )
}

/* ─── Confirmação de exclusão ───────────────────────────────────────────── */

export function DeleteConfirmModal({
  open,
  titulo,
  onCancel,
  onConfirm,
}: {
  open: boolean
  titulo: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const [excluindo, setExcluindo] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Excluir vídeo"
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={excluindo}
            onClick={async () => {
              setExcluindo(true)
              await onConfirm()
              setExcluindo(false)
            }}
          >
            <Trash2 size={14} /> {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-100">Excluir este vídeo? Esta ação não pode ser desfeita.</p>
      {titulo && <p className="mt-1 text-xs text-muted">“{titulo}”</p>}
    </Modal>
  )
}

/* ─── Peças do formulário ───────────────────────────────────────────────── */

function TituloSecao({ icon: Icon, titulo }: { icon: typeof Info; titulo: string }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
      <Icon size={13} className="text-brand-300" /> {titulo}
    </p>
  )
}

function SecaoColapsavel({
  icon: Icon,
  titulo,
  resumo,
  aberta,
  onToggle,
  children,
}: {
  icon: typeof Info
  titulo: string
  resumo: string
  aberta: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-soft/30">
      <button type="button" onClick={onToggle} aria-expanded={aberta} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Icon size={13} className="text-brand-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-200">{titulo}</span>
        <span className="truncate text-[11px] text-muted">· {resumo}</span>
        <ChevronDown size={14} className={cn('ml-auto shrink-0 text-muted transition-transform', aberta && 'rotate-180')} />
      </button>
      {aberta && <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">{children}</div>}
    </section>
  )
}

function ReferenciasField({ values, onChange }: { values: EdicaoReferencia[]; onChange: (next: EdicaoReferencia[]) => void }) {
  const [url, setUrl] = useState('')
  const [descricao, setDescricao] = useState('')
  function add() {
    const u = url.trim()
    if (!u) return
    onChange([...values, { tipo: tipoDoLink(u), url: u, descricao: descricao.trim() || null }])
    setUrl('')
    setDescricao('')
  }
  return (
    <div>
      <Label>Referências (Drive, YouTube, links)</Label>
      {values.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {values.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-soft px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Badge tone="neutral" className="shrink-0 text-[9px]">{tipoReferenciaVideoLabel[r.tipo]}</Badge>
                <a href={r.url} target="_blank" rel="noreferrer" className="truncate text-xs text-brand-300 hover:underline" title={r.url}>
                  {r.descricao || r.url}
                </a>
              </div>
              <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300" aria-label="Remover referência">
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
          placeholder="Cole o URL (Drive, YouTube, Vimeo ou link)"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!url.trim()} aria-label="Adicionar referência">
          <Plus size={11} />
        </Button>
      </div>
      <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição opcional (ex.: pasta com os brutos)" className="mt-2 text-xs" />
    </div>
  )
}

function tipoDoLink(url: string): TipoReferenciaVideo {
  const low = url.toLowerCase()
  if (low.includes('drive.google')) return 'drive'
  if (low.includes('youtube.com') || low.includes('youtu.be')) return 'youtube'
  if (low.includes('vimeo.com')) return 'vimeo'
  return 'link'
}

function nomeDoLink(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('drive.google')) return 'Google Drive'
    if (u.hostname.includes('youtu')) return 'YouTube'
    if (u.hostname.includes('vimeo')) return 'Vimeo'
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted">{children}</span>
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
