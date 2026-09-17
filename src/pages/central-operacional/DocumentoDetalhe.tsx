/**
 * Central Operacional — Leitor do Documento (Tela 4).
 * Abre ao clicar no título do documento. Renderiza o conteúdo (markdown
 * leve) + ações Baixar PDF / Editar / Excluir.
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Pencil, Trash2, User, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCentral } from './store'
import { NewDocumentModal, StatusBadge } from './components'

function dataLonga(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DocumentoDetalhe() {
  const { setorId, docId } = useParams()
  const { setores, updateDocumento, removeDocumento } = useCentral()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const setor = setores.find((s) => s.id === setorId)
  const doc = setor?.documentos.find((d) => d.id === docId)

  if (!setor || !doc) {
    return (
      <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-zinc-200">Documento não encontrado.</p>
        <Link to="/central-operacional" className="mt-2 inline-block text-xs text-brand-300 hover:text-brand-200">
          ← Voltar à Central Operacional
        </Link>
      </div>
    )
  }

  function excluir() {
    if (!setor || !doc) return
    removeDocumento(setor.id, doc.id)
    navigate(`/central-operacional/${setor.id}`)
  }

  return (
    <div>
      {/* Ações */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          to={`/central-operacional/${setor.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-zinc-100"
        >
          <ArrowLeft size={15} /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300"
          >
            <Printer size={13} /> Baixar PDF
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300"
          >
            <Pencil size={13} /> Editar
          </button>
          <button
            onClick={() => setConfirmDel(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
          >
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>

      {/* Cabeçalho do documento */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-zinc-100">{doc.titulo}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded border border-border bg-bg-elev px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            {doc.categoria}
          </span>
          <StatusBadge status={doc.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          {doc.cargos.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <User size={11} /> {doc.cargos.join(', ')}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock size={11} /> Atualizado em {dataLonga(doc.data)}
          </span>
        </div>
      </div>

      {/* Conteúdo */}
      <article className="mt-5 max-w-3xl">
        {doc.conteudo && doc.conteudo.trim() ? (
          renderConteudo(doc.conteudo)
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-10 text-center">
            <p className="text-sm text-muted">Este documento ainda não tem conteúdo.</p>
            <button
              onClick={() => setEditOpen(true)}
              className="mt-2 text-xs text-brand-300 hover:text-brand-200"
            >
              Clique em Editar para adicionar
            </button>
          </div>
        )}
      </article>

      {/* Modal de edição */}
      <NewDocumentModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        setores={setores}
        onCreate={() => {}}
        docEdit={{ setorId: setor.id, doc }}
        onUpdate={updateDocumento}
      />

      {/* Confirmar exclusão */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setConfirmDel(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-300" />
              <h3 className="text-sm font-semibold text-zinc-100">Excluir documento</h3>
            </div>
            <p className="mb-4 text-[11px] text-muted">
              Excluir <strong className="text-zinc-200">{doc.titulo}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDel(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-bg-elev"
              >
                Cancelar
              </button>
              <button
                onClick={excluir}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/25"
              >
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Renderizador de markdown leve (headings, listas, tabela, citação, bold)
// ============================================================
function inline(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold text-zinc-100">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

function renderTabela(rows: string[], key: number) {
  const cells = rows.map((r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
  const body = cells.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === ''))
  if (body.length === 0) return null
  const header = body[0]
  const dataRows = body.slice(1)
  return (
    <div key={key} className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className="border border-border bg-bg-elev px-2.5 py-1.5 text-left font-semibold text-zinc-200">
                {inline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className="border border-border px-2.5 py-1.5 align-top text-zinc-300">
                  {inline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderConteudo(texto: string): React.ReactNode[] {
  const linhas = texto.replace(/\r/g, '').split('\n')
  const out: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < linhas.length) {
    const t = linhas[i].trim()
    if (t === '') {
      i++
      continue
    }
    if (/^-{3,}$/.test(t)) {
      out.push(<hr key={key++} className="my-4 border-border" />)
      i++
      continue
    }
    if (t.startsWith('|')) {
      const rows: string[] = []
      while (i < linhas.length && linhas[i].trim().startsWith('|')) {
        rows.push(linhas[i].trim())
        i++
      }
      const tbl = renderTabela(rows, key++)
      if (tbl) out.push(tbl)
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(t)
    if (h) {
      const lvl = h[1].length
      const cls =
        lvl <= 2
          ? 'mt-6 mb-2 text-lg font-bold text-zinc-100'
          : lvl === 3
            ? 'mt-4 mb-1.5 text-sm font-semibold text-zinc-100'
            : 'mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted'
      out.push(
        <p key={key++} className={cls}>
          {inline(h[2])}
        </p>,
      )
      i++
      continue
    }
    if (t.startsWith('>')) {
      out.push(
        <blockquote
          key={key++}
          className="my-3 rounded-r-lg border-l-2 border-amber-500/60 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-100"
        >
          {inline(t.replace(/^>\s?/, ''))}
        </blockquote>,
      )
      i++
      continue
    }
    const li = /^(\d+\.|[-*])\s+(.*)$/.exec(t)
    if (li) {
      const ordered = /^\d+\./.test(t)
      const items: string[] = []
      while (i < linhas.length) {
        const m = /^(\d+\.|[-*])\s+(.*)$/.exec(linhas[i].trim())
        if (!m) break
        items.push(m[2])
        i++
      }
      out.push(
        ordered ? (
          <ol key={key++} className="my-2 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
            {items.map((it, ix) => (
              <li key={ix}>{inline(it)}</li>
            ))}
          </ol>
        ) : (
          <ul key={key++} className="my-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {items.map((it, ix) => (
              <li key={ix}>{inline(it)}</li>
            ))}
          </ul>
        ),
      )
      continue
    }
    out.push(
      <p key={key++} className={cn('my-2 text-sm leading-relaxed text-zinc-300')}>
        {inline(t)}
      </p>,
    )
    i++
  }
  return out
}
