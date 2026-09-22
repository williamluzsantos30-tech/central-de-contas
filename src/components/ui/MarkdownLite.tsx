/**
 * MarkdownLite — renderizador de markdown leve (mesmo dialeto usado nos
 * documentos da Central Operacional): headings (#..####), listas (- * 1.),
 * tabela (|...|), citação (>), régua (---) e **negrito** inline.
 * Sem dependência externa.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

function inline(s: string): ReactNode[] {
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

export function renderMarkdownLite(texto: string): ReactNode[] {
  const linhas = texto.replace(/\r/g, '').split('\n')
  const out: ReactNode[] = []
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
        <blockquote key={key++} className="my-3 rounded-r-lg border-l-2 border-amber-500/60 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-100">
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

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{renderMarkdownLite(text)}</div>
}
