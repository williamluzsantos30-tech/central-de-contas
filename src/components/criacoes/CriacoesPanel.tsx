import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
  Target,
  Film,
  Megaphone,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { uploadToStorageSafe } from '@/lib/storage'
import { downloadCriacaoPDF } from './CriacaoPDF'
import { downloadPlanejamentoTrafegoPDF } from './PlanejamentoTrafegoPDF'
import { PlanejamentoEstruturaForm, planejamentoEstruturaVazia } from './PlanejamentoEstruturaForm'
import type { PlanejamentoEstrutura } from '@/types/database'
import {
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

// Ícone por tipo — usado nos headers de cada Card de seção
const tipoIcone: Record<TipoCriacao, React.ComponentType<{ size?: number; className?: string }>> = {
  copy_lp: FileText,
  planejamento: Target,
  roteiro: Film,
  copy_criativos: Megaphone,
}

export function CriacoesPanel({ cliente }: Props) {
  const [criacoes, setCriacoes] = useState<Criacao[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Criacao | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // Tipo escolhido ao clicar em "+ Adicionar" de cada seção — passado pro modal
  const [tipoCriando, setTipoCriando] = useState<TipoCriacao>('copy_lp')

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

  function abrirNovo(tipo: TipoCriacao) {
    setTipoCriando(tipo)
    setEditing(null)
    setModalOpen(true)
  }

  function abrirEdicao(c: Criacao) {
    setTipoCriando(c.tipo)
    setEditing(c)
    setModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Uma seção (Card) por tipo, todas visíveis ao mesmo tempo —
          mesmo padrão visual do Planejamento Mensal de Social Media. */}
      {TIPOS_CRIACAO.map((tipo) => {
        const itens = criacoes.filter((c) => c.tipo === tipo)
        const Icone = tipoIcone[tipo]
        return (
          <Card key={tipo}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icone size={14} className="text-brand-300" />
                {tipoCriacaoLabel[tipo]} ({itens.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] text-muted md:inline">
                  {tipoCriacaoDescricao[tipo]}
                </span>
                <Button size="sm" variant="outline" onClick={() => abrirNovo(tipo)}>
                  <Plus size={12} /> Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {loading ? (
                <p className="text-xs text-muted">Carregando...</p>
              ) : itens.length === 0 ? (
                <p className="text-xs text-muted">
                  Nenhum{tipo === 'copy_lp' || tipo === 'copy_criativos' ? 'a' : ''}{' '}
                  {tipoCriacaoLabel[tipo].toLowerCase()} ainda. Crie um briefing e gere um rascunho com IA.
                </p>
              ) : (
                <div className="space-y-2">
                  {itens.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => abrirEdicao(c)}
                      className="flex w-full items-start gap-3 rounded-lg border border-border bg-bg-soft p-3 text-left transition-colors hover:bg-bg-elev hover:border-brand-500/40"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{c.titulo}</p>
                          <StatusBadge status={c.status} />
                          {c.enviado_para_producao_em &&
                            (c.tipo === 'copy_lp' || c.tipo === 'copy_criativos') && (
                              <Badge tone="info" className="text-[10px]">
                                enviado p/ webdesign
                              </Badge>
                            )}
                        </div>
                        {c.conteudo ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted whitespace-pre-wrap">
                            {c.conteudo}
                          </p>
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
            </CardBody>
          </Card>
        )
      })}

      <CriacaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cliente={cliente}
        tipo={tipoCriando}
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

/** Exportado pra ser usado na rota /preview/criacoes-panel (com previewMode). */
export function CriacaoModal({
  open,
  onClose,
  cliente,
  tipo,
  criacao,
  onSaved,
  previewMode = false,
}: {
  open: boolean
  onClose: () => void
  cliente: Cliente
  tipo: TipoCriacao
  criacao: Criacao | null
  onSaved: () => void
  /**
   * Quando true, pula chamadas ao Supabase (save / delete / list profiles)
   * e usa stubs locais. Pra preview público sem auth.
   */
  previewMode?: boolean
}) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    titulo: '',
    briefing: '',
    anexos: [] as CriacaoAnexo[],
    conteudo: '',
    status: 'rascunho' as StatusCriacao,
    responsavel_id: profile?.id ?? '',
    planejamento_estrutura: planejamentoEstruturaVazia() as PlanejamentoEstrutura,
  })
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const tipoEfetivo = criacao?.tipo ?? tipo

  useEffect(() => {
    if (!open) return
    if (previewMode) {
      setResponsaveis([])
    } else
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
        anexos: criacao.anexos ?? [],
        conteudo: criacao.conteudo ?? '',
        status: criacao.status,
        responsavel_id: criacao.responsavel_id ?? profile?.id ?? '',
        planejamento_estrutura:
          criacao.planejamento_estrutura ?? planejamentoEstruturaVazia(),
      })
    } else {
      setForm({
        titulo: '',
        briefing: '',
        anexos: [],
        conteudo: '',
        status: 'rascunho',
        responsavel_id: profile?.id ?? '',
        planejamento_estrutura: planejamentoEstruturaVazia(),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, criacao, profile?.id, tipoEfetivo])

  async function save() {
    if (!form.titulo.trim()) return
    if (previewMode) {
      // Preview — não persiste, só fecha
      alert('Preview: salvamento desabilitado.')
      onClose()
      return
    }
    setSaving(true)
    const payload = {
      cliente_id: cliente.id,
      tipo: tipoEfetivo,
      titulo: form.titulo.trim(),
      briefing: form.briefing || null,
      prompt: null, // legado — IA removida do form
      anexos: form.anexos.length > 0 ? form.anexos : null,
      conteudo: form.conteudo || null,
      // Estrutura só faz sentido pro tipo planejamento — salva null pros outros
      planejamento_estrutura:
        tipoEfetivo === 'planejamento' ? form.planejamento_estrutura : null,
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
      if (criacao.tipo === 'planejamento') {
        await downloadPlanejamentoTrafegoPDF({ cliente, criacao })
      } else {
        await downloadCriacaoPDF({ cliente, criacao })
      }
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
    if (previewMode) {
      alert('Preview: exclusão desabilitada.')
      onClose()
      return
    }
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
          <Label>Briefing / Contexto</Label>
          <Textarea
            value={form.briefing}
            onChange={(e) => setForm({ ...form, briefing: e.target.value })}
            placeholder="Descreva público-alvo, dor, diferenciais, tom, objetivos — contexto do que você quer entregar."
            className="min-h-[110px]"
          />
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

        {tipoEfetivo === 'planejamento' ? (
          <PlanejamentoEstruturaForm
            value={form.planejamento_estrutura}
            onChange={(estrutura) =>
              setForm({ ...form, planejamento_estrutura: estrutura })
            }
          />
        ) : (
          <div>
            <Label>Conteúdo</Label>
            <Textarea
              value={form.conteudo}
              onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
              placeholder="Cole aqui o conteúdo (copy / roteiro / etc.)."
              className="min-h-[260px] font-mono text-[13px] leading-relaxed"
            />
          </div>
        )}
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
