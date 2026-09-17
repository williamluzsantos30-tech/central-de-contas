/**
 * Componentes reutilizáveis da Central Operacional:
 * SectorCard, DocumentListItem, CategorySection, StatusBadge, NewDocumentModal.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Megaphone,
  Wallet,
  Briefcase,
  HeartHandshake,
  Crown,
  Palette,
  Lightbulb,
  FileText,
  BookOpen,
  ClipboardList,
  CalendarDays,
  LayoutTemplate,
  User,
  Clock,
  ArrowRight,
  X,
  FileUp,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import {
  CARGOS,
  CATEGORIAS,
  STATUS_LABEL,
  type Categoria,
  type Documento,
  type Setor,
  type SetorCor,
  type StatusDoc,
} from './mockDocuments'

// ---- ícones por setor / categoria ----
const SETOR_ICON: Record<string, LucideIcon> = {
  Megaphone,
  Wallet,
  Briefcase,
  HeartHandshake,
  Crown,
  Palette,
  Lightbulb,
}
const CATEGORIA_ICON: Record<Categoria, LucideIcon> = {
  Playbooks: BookOpen,
  POPs: ClipboardList,
  'Rituais & Reuniões': CalendarDays,
  Templates: LayoutTemplate,
  'Job Descriptions': Briefcase,
}

// ---- cor/tema por setor (decorativo) ----
const CORES: Record<SetorCor, { iconBg: string; grad: string; border: string }> = {
  violet: { iconBg: 'bg-violet-500', grad: 'from-violet-500/[0.08]', border: 'hover:border-violet-500/40' },
  emerald: { iconBg: 'bg-emerald-500', grad: 'from-emerald-500/[0.08]', border: 'hover:border-emerald-500/40' },
  amber: { iconBg: 'bg-amber-500', grad: 'from-amber-500/[0.08]', border: 'hover:border-amber-500/40' },
  pink: { iconBg: 'bg-pink-500', grad: 'from-pink-500/[0.08]', border: 'hover:border-pink-500/40' },
  indigo: { iconBg: 'bg-indigo-500', grad: 'from-indigo-500/[0.08]', border: 'hover:border-indigo-500/40' },
  cyan: { iconBg: 'bg-cyan-500', grad: 'from-cyan-500/[0.08]', border: 'hover:border-cyan-500/40' },
  fuchsia: { iconBg: 'bg-fuchsia-500', grad: 'from-fuchsia-500/[0.08]', border: 'hover:border-fuchsia-500/40' },
}

/** Data no formato "25 de fev. de 2026". */
export function dataBR(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function StatusBadge({ status }: { status: StatusDoc }) {
  const s = STATUS_LABEL[status]
  return (
    <span className={cn('inline-block rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', s.cls)}>
      {s.label}
    </span>
  )
}

// ============================================================
// SectorCard (Tela 1)
// ============================================================
export function SectorCard({ setor }: { setor: Setor }) {
  const Icon = SETOR_ICON[setor.icon] ?? FileText
  const c = CORES[setor.cor]
  const nDocs = setor.documentos.length
  return (
    <Link
      to={`/central-operacional/${setor.id}`}
      className={cn(
        'group flex flex-col rounded-xl border border-border bg-gradient-to-br to-transparent p-5 transition-colors',
        c.grad,
        c.border,
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className={cn('grid h-11 w-11 place-items-center rounded-xl text-white', c.iconBg)}>
          <Icon size={20} />
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
            Setor
          </span>
          <span className="rounded-full border border-border bg-bg-elev px-2 py-0.5 text-[10px] tabular-nums text-muted">
            {nDocs} {nDocs === 1 ? 'doc' : 'docs'}
          </span>
        </div>
      </div>
      <h3 className="text-base font-bold text-zinc-100">{setor.nome}</h3>
      <p className="mt-1 text-xs text-muted">{setor.descricao}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {setor.cargos.map((c) => (
          <span key={c} className="rounded border border-border bg-bg-elev px-1.5 py-0.5 text-[10px] text-zinc-300">
            {c}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-border/60 pt-3 text-[11px] font-medium text-brand-300 transition-colors group-hover:text-brand-200">
        Ver materiais do setor <ArrowRight size={12} />
      </div>
    </Link>
  )
}

// ============================================================
// DocumentListItem (Tela 3 + aba "Todos os Documentos")
// ============================================================
export function DocumentListItem({
  doc,
  setorId,
  mostrarCategoria = true,
}: {
  doc: Documento
  setorId: string
  mostrarCategoria?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-card px-3 py-2.5 transition-colors hover:border-border/60 hover:bg-bg-soft/40">
      <FileText size={16} className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <Link
          to={`/central-operacional/${setorId}/${doc.id}`}
          className="text-sm font-medium text-sky-300 hover:text-sky-200 hover:underline"
        >
          {doc.titulo}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
          {mostrarCategoria && (
            <span className="rounded border border-border bg-bg-elev px-1.5 py-0.5 text-zinc-300">
              {doc.categoria}
            </span>
          )}
          {doc.cargos.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <User size={10} /> {doc.cargos.join(', ')}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock size={10} /> {dataBR(doc.data)}
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <StatusBadge status={doc.status} />
      </div>
    </div>
  )
}

// ============================================================
// CategorySection (Tela 3)
// ============================================================
export function CategorySection({
  categoria,
  docs,
  setorId,
}: {
  categoria: Categoria
  docs: Documento[]
  setorId: string
}) {
  const Icon = CATEGORIA_ICON[categoria] ?? FileText
  if (docs.length === 0) return null
  return (
    <section className="rounded-xl border border-border bg-bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-brand-300" />
          <h3 className="text-sm font-semibold text-brand-300">{categoria}</h3>
        </div>
        <span className="text-[11px] tabular-nums text-muted">
          {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
        </span>
      </div>
      <div className="space-y-2">
        {docs.map((d) => (
          <DocumentListItem key={d.id} doc={d} setorId={setorId} mostrarCategoria />
        ))}
      </div>
    </section>
  )
}

// ============================================================
// NewDocumentModal (Tela 2)
// ============================================================
export interface NovoDocPayload {
  setorId: string
  titulo: string
  categoria: Categoria
  status: StatusDoc
  cargos: string[]
  conteudo: string
  temPdf: boolean
}

export function NewDocumentModal({
  open,
  onClose,
  setores,
  onCreate,
  docEdit,
  onUpdate,
}: {
  open: boolean
  onClose: () => void
  setores: Setor[]
  onCreate: (p: NovoDocPayload) => void
  docEdit?: { setorId: string; doc: Documento } | null
  onUpdate?: (setorId: string, docId: string, patch: Partial<Omit<Documento, 'id'>>) => void
}) {
  const editando = !!docEdit
  const [setorId, setSetorId] = useState(setores[0]?.id ?? '')
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('Playbooks')
  const [status, setStatus] = useState<StatusDoc>('em_revisao')
  const [cargos, setCargos] = useState<string[]>([])
  const [conteudo, setConteudo] = useState('')
  const [pdfNome, setPdfNome] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Prefill ao abrir (edição) ou zera (novo)
  useEffect(() => {
    if (!open) return
    if (docEdit) {
      setSetorId(docEdit.setorId)
      setTitulo(docEdit.doc.titulo)
      setCategoria(docEdit.doc.categoria)
      setStatus(docEdit.doc.status)
      setCargos(docEdit.doc.cargos)
      setConteudo(docEdit.doc.conteudo ?? '')
      setPdfNome(docEdit.doc.temPdf ? 'documento.pdf' : null)
    } else {
      setSetorId(setores[0]?.id ?? '')
      setTitulo('')
      setCategoria('Playbooks')
      setStatus('em_revisao')
      setCargos([])
      setConteudo('')
      setPdfNome(null)
    }
    setErro(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docEdit])

  if (!open) return null

  function toggleCargo(c: string) {
    setCargos((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  function salvar() {
    if (!titulo.trim()) {
      setErro('Informe um título.')
      return
    }
    if (!setorId) {
      setErro('Escolha o setor.')
      return
    }
    if (editando && docEdit && onUpdate) {
      onUpdate(docEdit.setorId, docEdit.doc.id, {
        titulo: titulo.trim(),
        categoria,
        status,
        cargos,
        conteudo,
        temPdf: !!pdfNome,
      })
    } else {
      onCreate({ setorId, titulo: titulo.trim(), categoria, status, cargos, conteudo, temPdf: !!pdfNome })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">
            {editando ? 'Editar Documento' : 'Novo Documento'}
          </h3>
          <button onClick={onClose} className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200" aria-label="Fechar">
            <X size={14} />
          </button>
        </div>

        {erro && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{erro}</div>
        )}

        <div className="space-y-3">
          <Campo label="Título">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Playbook de Onboarding" />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Setor">
              <Select value={setorId} onChange={(e) => setSetorId(e.target.value)}>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Categoria">
              <Select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>

          <Campo label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusDoc)}>
              <option value="em_revisao">Em revisão</option>
              <option value="oficial">Oficial</option>
            </Select>
          </Campo>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              Cargos Relacionados (opcional)
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {CARGOS.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={cargos.includes(c)}
                    onChange={() => toggleCargo(c)}
                    className="h-3.5 w-3.5 rounded border-border bg-bg-elev accent-brand-500"
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <Campo label="Conteúdo">
            <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Escreva o conteúdo do documento..." className="min-h-[110px]" />
          </Campo>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Anexar PDF (opcional)</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg-elev px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-brand-500/40">
              <FileUp size={13} />
              {pdfNome ?? 'Selecionar PDF'}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPdfNome(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            <p className="mt-1 text-[10px] text-muted">Máximo 20MB</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{editando ? 'Salvar' : 'Criar Documento'}</Button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
