import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  FileText,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { uploadToStorageSafe } from '@/lib/storage'
import { generateWithAI } from '@/lib/ai'
import { promptDefault, promptDefaultDescricao } from '@/lib/ai-prompts'
import { downloadCriacaoPDF } from './CriacaoPDF'
import {
  cn,
  formatDateTime,
  statusCriacaoLabel,
  tipoCriacaoDescricao,
  tipoCriacaoLabel,
  TIPOS_CRIACAO,
} from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Cliente,
  Criacao,
  CriacaoAnexo,
  Profile,
  StatusCriacao,
  TipoCriacao,
} from '@/types/database'

interface Props {
  cliente: Cliente
}

export function CriacoesPanel({ cliente }: Props) {
  const [ativo, setAtivo] = useState<TipoCriacao>('copy_lp')
  const [criacoes, setCriacoes] = useState<Criacao[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Criacao | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('criacoes')
      .select('*, responsavel:profiles(*)')
      .eq('cliente_id', cliente.id)
      .order('updated_at', { ascending: false })
    setCriacoes((data as Criacao[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [cliente.id])

  const porTipo = useMemo(() => criacoes.filter((c) => c.tipo === ativo), [criacoes, ativo])

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {TIPOS_CRIACAO.map((t) => {
          const count = criacoes.filter((c) => c.tipo === t).length
          return (
            <button
              key={t}
              onClick={() => setAtivo(t)}
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-colors',
                ativo === t
                  ? 'border-brand-500/60 bg-brand-500/10'
                  : 'border-border bg-bg-card hover:bg-bg-elev',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{tipoCriacaoLabel[t]}</span>
                <Badge tone={ativo === t ? 'brand' : 'neutral'}>{count}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted line-clamp-1">
                {tipoCriacaoDescricao[t]}
              </p>
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{tipoCriacaoLabel[ativo]}</h3>
          <p className="text-xs text-muted">{tipoCriacaoDescricao[ativo]}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          <Plus size={14} /> Nova {tipoCriacaoLabel[ativo].toLowerCase()}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : porTipo.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={24} />}
          title={`Nenhuma ${tipoCriacaoLabel[ativo].toLowerCase()} ainda`}
          description="Crie um briefing e gere um rascunho inicial com IA."
          action={
            <Button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
            >
              <Sparkles size={14} /> Nova com IA
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {porTipo.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setEditing(c)
                setModalOpen(true)
              }}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-bg-soft p-4 text-left transition-colors hover:bg-bg-elev"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{c.titulo}</p>
                  <StatusBadge status={c.status} />
                  {c.enviado_para_producao_em && (c.tipo === 'copy_lp' || c.tipo === 'copy_criativos') && (
                    <Badge tone="info" className="text-[10px]">
                      enviado p/ webdesign
                    </Badge>
                  )}
                </div>
                {c.conteudo ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted whitespace-pre-wrap">{c.conteudo}</p>
                ) : c.briefing ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted italic">
                    Briefing: {c.briefing}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted italic">Sem conteúdo ainda.</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                  <span>Atualizado em {formatDateTime(c.updated_at)}</span>
                </div>
              </div>
              {c.responsavel && <Avatar name={c.responsavel.nome} size="sm" />}
            </button>
          ))}
        </div>
      )}

      <CriacaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cliente={cliente}
        tipo={ativo}
        criacao={editing}
        onSaved={load}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: StatusCriacao }) {
  const toneMap: Record<StatusCriacao, 'neutral' | 'warning' | 'success' | 'info'> = {
    rascunho: 'neutral',
    em_revisao: 'warning',
    aprovado: 'success',
    publicado: 'info',
  }
  return <Badge tone={toneMap[status]}>{statusCriacaoLabel[status]}</Badge>
}

function CriacaoModal({
  open,
  onClose,
  cliente,
  tipo,
  criacao,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  cliente: Cliente
  tipo: TipoCriacao
  criacao: Criacao | null
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    titulo: '',
    briefing: '',
    prompt: '',
    anexos: [] as CriacaoAnexo[],
    conteudo: '',
    status: 'rascunho' as StatusCriacao,
    responsavel_id: profile?.id ?? '',
  })
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const tipoEfetivo = criacao?.tipo ?? tipo

  useEffect(() => {
    if (!open) return
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
    if (criacao) {
      setForm({
        titulo: criacao.titulo,
        briefing: criacao.briefing ?? '',
        // Se a criação salva não tem prompt customizado, sugere o default do tipo
        prompt: criacao.prompt ?? promptDefault[criacao.tipo] ?? '',
        anexos: criacao.anexos ?? [],
        conteudo: criacao.conteudo ?? '',
        status: criacao.status,
        responsavel_id: criacao.responsavel_id ?? profile?.id ?? '',
      })
      // Sempre mostra o prompt expandido pra editar antes de gerar
      setPromptOpen(true)
    } else {
      setForm({
        titulo: '',
        briefing: '',
        // Pré-preenche o prompt com o default do tipo selecionado
        prompt: promptDefault[tipoEfetivo] ?? '',
        anexos: [],
        conteudo: '',
        status: 'rascunho',
        responsavel_id: profile?.id ?? '',
      })
      setPromptOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, criacao, profile?.id, tipoEfetivo])

  async function gerar() {
    setGenerating(true)
    const conteudo = await generateWithAI({
      tipo: tipoEfetivo,
      briefing: form.briefing,
      prompt: form.prompt,
      anexos: form.anexos,
      cliente: { nome: cliente.nome, nicho: cliente.nicho, plataformas: cliente.plataformas },
    })
    setForm((f) => ({ ...f, conteudo }))
    setGenerating(false)
  }

  async function save() {
    if (!form.titulo.trim()) return
    setSaving(true)
    const payload = {
      cliente_id: cliente.id,
      tipo: tipoEfetivo,
      titulo: form.titulo.trim(),
      briefing: form.briefing || null,
      prompt: form.prompt || null,
      anexos: form.anexos.length > 0 ? form.anexos : null,
      conteudo: form.conteudo || null,
      status: form.status,
      responsavel_id: form.responsavel_id || null,
    }

    // Detecta promoção pra "aprovado" (statusAntes != aprovado e statusNovo = aprovado)
    const statusAntes = criacao?.status ?? null
    const promovendoParaAprovado =
      form.status === 'aprovado' && statusAntes !== 'aprovado'
    const jaFoiEnviado = !!criacao?.enviado_para_producao_em

    let criacaoId = criacao?.id ?? null

    if (criacao) {
      await supabase.from('criacoes').update(payload).eq('id', criacao.id)
    } else {
      const { data } = await supabase
        .from('criacoes')
        .insert(payload)
        .select('id')
        .single()
      criacaoId = (data as { id: string } | null)?.id ?? null
    }

    // Auto-flow: copy_lp aprovada → cria ProjetoWebdesign (landing page)
    //           copy_criativos aprovada → cria CriativoWebdesign
    // Só dispara uma vez por criação (controle via enviado_para_producao_em)
    if (
      criacaoId &&
      promovendoParaAprovado &&
      !jaFoiEnviado &&
      (tipoEfetivo === 'copy_lp' || tipoEfetivo === 'copy_criativos')
    ) {
      try {
        if (tipoEfetivo === 'copy_lp') {
          // Copy já aprovada → pula a etapa de aprovação da copy, vai direto pra design
          await supabase.from('projetos_webdesign').insert({
            cliente_id: cliente.id,
            titulo: form.titulo.trim(),
            tipo: 'landing_page',
            status: 'design',
            briefing: form.briefing || null,
            copy_texto: form.conteudo || null,
            criacao_origem_id: criacaoId,
            identidade_visual_urls: [],
            fotos: [],
          })
        } else {
          // copy_criativos → cria criativo aguardando design (status pendente)
          await supabase.from('criativos_webdesign').insert({
            cliente_id: cliente.id,
            titulo: form.titulo.trim(),
            formato: 'feed_estatico',
            status: 'pendente',
            copy_texto: form.conteudo || null,
            criacao_origem_id: criacaoId,
            identidade_visual_urls: [],
            fotos: [],
          })
        }
        // Marca a criação como já enviada pra produção (evita duplicar)
        await supabase
          .from('criacoes')
          .update({ enviado_para_producao_em: new Date().toISOString() })
          .eq('id', criacaoId)
        alert(
          tipoEfetivo === 'copy_lp'
            ? '✓ Copy aprovada! Landing page criada no operacional de Webdesign.'
            : '✓ Copy aprovada! Criativo criado no operacional de Webdesign.',
        )
      } catch (e) {
        console.error('Falha ao promover criacao pra producao:', e)
        alert('A copy foi salva, mas não consegui criar o item no Webdesign. Verifique o operacional.')
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  async function baixarPDF() {
    if (!criacao) return
    try {
      await downloadCriacaoPDF({ cliente, criacao })
    } catch (e) {
      console.error('Falha ao gerar PDF:', e)
      alert('Não consegui gerar o PDF. Tenta de novo.')
    }
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    const novos: CriacaoAnexo[] = []
    for (const file of Array.from(files)) {
      // Sobe pro bucket criacoes-anexos e guarda a URL pública.
      // Antes salvava como data URL inline no banco — explodia o
      // tamanho da row e podia até estourar o limite do payload.
      const url = await uploadToStorageSafe(file, 'anexos', 'criacoes-anexos')
      if (!url) continue // upload falhou — alerta já foi mostrado
      novos.push({ nome: file.name, tamanho: file.size, tipo: file.type, url })
    }
    if (novos.length > 0) {
      setForm((f) => ({ ...f, anexos: [...f.anexos, ...novos] }))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeAnexo(idx: number) {
    setForm((f) => ({ ...f, anexos: f.anexos.filter((_, i) => i !== idx) }))
  }

  async function excluir() {
    if (!criacao) return
    if (!confirm('Excluir esta criação?')) return
    await supabase.from('criacoes').delete().eq('id', criacao.id)
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-3xl"
      title={
        criacao
          ? `Editar ${tipoCriacaoLabel[tipoEfetivo]}`
          : `Nova ${tipoCriacaoLabel[tipoEfetivo]}`
      }
      footer={
        <div className="flex items-center justify-between">
          {criacao ? (
            <Button variant="danger" size="sm" onClick={excluir}>
              <Trash2 size={14} /> Excluir
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            {criacao && (
              <Button variant="secondary" onClick={baixarPDF} disabled={saving}>
                <FileText size={14} /> Baixar PDF
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !form.titulo.trim()}>
              {saving ? 'Salvando...' : criacao ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Título</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder={`Ex.: ${tipoCriacaoLabel[tipoEfetivo]} — ${cliente.nome}`}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StatusCriacao })}
            >
              <option value="rascunho">Rascunho</option>
              <option value="em_revisao">Em revisão</option>
              <option value="aprovado">Aprovado</option>
              <option value="publicado">Publicado</option>
            </Select>
            {(tipoEfetivo === 'copy_lp' || tipoEfetivo === 'copy_criativos') &&
              !criacao?.enviado_para_producao_em && (
                <p className="mt-1 text-[10px] text-amber-300">
                  Ao marcar como <strong>Aprovado</strong>, esse item vai
                  automaticamente pra produção no Webdesign.
                </p>
              )}
            {criacao?.enviado_para_producao_em && (
              <p className="mt-1 text-[10px] text-emerald-300">
                ✓ Já foi enviado pra produção em{' '}
                {formatDateTime(criacao.enviado_para_producao_em)}.
              </p>
            )}
          </div>
        </div>

        <div>
          <Label>Responsável</Label>
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
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Briefing / Input para a IA</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={gerar}
              disabled={generating || (!form.briefing.trim() && !form.prompt.trim())}
            >
              <Sparkles size={14} className={generating ? 'animate-pulse' : ''} />
              {generating ? 'Gerando...' : 'Gerar com IA'}
            </Button>
          </div>
          <Textarea
            value={form.briefing}
            onChange={(e) => setForm({ ...form, briefing: e.target.value })}
            placeholder="Descreva público-alvo, dor, diferenciais, tom, objetivos — tudo que a IA precisa saber para gerar."
            className="min-h-[110px]"
          />
        </div>

        {/* Prompt da IA (colapsável, vem pré-preenchido) */}
        <div className="rounded-lg border border-border bg-bg-soft">
          <button
            type="button"
            onClick={() => setPromptOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <Sparkles size={12} className="text-brand-300" />
              Instruções para a IA (prompt)
              <Badge tone="brand" className="text-[10px] normal-case">
                pré-pronto
              </Badge>
            </span>
            <ChevronDown
              size={14}
              className={cn('text-muted transition-transform', promptOpen && 'rotate-180')}
            />
          </button>
          {promptOpen && (
            <div className="border-t border-border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted">
                  Já vem com um prompt otimizado para{' '}
                  <span className="text-zinc-300">{tipoCriacaoLabel[tipoEfetivo].toLowerCase()}</span>
                  : {promptDefaultDescricao[tipoEfetivo]}. Edite à vontade.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, prompt: promptDefault[tipoEfetivo] ?? '' }))
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted transition-colors hover:border-border/60 hover:text-zinc-100"
                  title="Restaurar prompt padrão"
                >
                  ↻ Restaurar padrão
                </button>
              </div>
              <Textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Diga para a IA COMO você quer que ela trabalhe."
                className="min-h-[200px] font-mono text-[12.5px] leading-relaxed"
              />
              <p className="mt-1 text-[11px] text-muted">
                A IA vai usar este prompt + briefing + arquivos anexados para gerar o conteúdo.
              </p>
            </div>
          )}
        </div>

        {/* Upload de arquivos de referência */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Arquivos de referência</Label>
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
          {form.anexos.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-bg-soft px-3 py-5 text-center text-xs text-muted">
              <Paperclip size={14} className="mx-auto mb-1 opacity-60" />
              Nenhum anexo. Envie PDFs, imagens, prints, briefings prontos — o que for útil para a
              IA entender o contexto.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {form.anexos.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-soft px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText size={14} className="shrink-0 text-brand-300" />
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
                    onClick={() => removeAnexo(i)}
                    className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-300"
                    title="Remover anexo"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <Label>Conteúdo gerado</Label>
          <Textarea
            value={form.conteudo}
            onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
            placeholder="Aqui aparecerá o rascunho gerado. Edite livremente até ficar do seu jeito."
            className="min-h-[260px] font-mono text-[13px] leading-relaxed"
          />
        </div>
      </div>
    </Modal>
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
