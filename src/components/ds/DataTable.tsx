/**
 * DataTable — tabela genérica do design system.
 * Cabeçalho em faixa (uppercase cinza), linhas com divisória fina + hover
 * sutil, busca local opcional acima. Colunas configuráveis com render custom.
 *
 * - Ordenação: coluna com `sortValue` vira ordenável (clique no cabeçalho
 *   alterna ↑/↓; vazios sempre no fim). `defaultSort` define a inicial.
 * - Prioridade: `rowTone` tinge a LINHA INTEIRA (fundo + filete à esquerda)
 *   — pro que exige ação (vencido, fora do SLA, crítico). O normal fica
 *   neutro, sem badge colorido em toda célula.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'
export type RowTone = 'danger' | 'warning' | 'attention' | 'info' | 'success'

export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Render custom da célula. Sem isso, tenta row[key]. */
  render?: (row: T) => ReactNode
  /** Valor usado pra ordenar — torna a coluna ordenável. */
  sortValue?: (row: T) => string | number | null | undefined
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Busca local: controla o input acima da tabela. */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string }
  emptyLabel?: string
  minWidth?: number
  className?: string
  /** Ordenação inicial (coluna precisa ter `sortValue`). */
  defaultSort?: { key: string; dir: SortDir }
  /** Tinge a linha inteira pela prioridade (undefined = neutra). */
  rowTone?: (row: T) => RowTone | undefined
}

const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
const justifyCls = { left: 'justify-start', right: 'justify-end', center: 'justify-center' } as const

/** Classes da linha tingida — exportadas pra tabelas em grid (ex.: Onboarding). */
export const ROW_TONE: Record<RowTone, string> = {
  danger: 'bg-red-500/[0.06] shadow-[inset_3px_0_0_0_rgba(239,68,68,0.75)] hover:bg-red-500/[0.1]',
  warning: 'bg-orange-500/[0.05] shadow-[inset_3px_0_0_0_rgba(249,115,22,0.7)] hover:bg-orange-500/[0.09]',
  attention: 'bg-yellow-500/[0.05] shadow-[inset_3px_0_0_0_rgba(234,179,8,0.7)] hover:bg-yellow-500/[0.09]',
  info: 'bg-blue-500/[0.05] shadow-[inset_3px_0_0_0_rgba(59,130,246,0.7)] hover:bg-blue-500/[0.09]',
  success: 'bg-green-500/[0.05] shadow-[inset_3px_0_0_0_rgba(34,197,94,0.7)] hover:bg-green-500/[0.09]',
}

const vazio = (v: unknown) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v))

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  search,
  emptyLabel = 'Nenhum registro.',
  minWidth = 720,
  className,
  defaultSort,
  rowTone,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(defaultSort ?? null)

  const ordenadas = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!sort || !col?.sortValue) return rows
    const get = col.sortValue
    const sinal = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      // Vazios sempre no fim, qualquer que seja a direção.
      if (vazio(va) && vazio(vb)) return 0
      if (vazio(va)) return 1
      if (vazio(vb)) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal
      return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base', numeric: true }) * sinal
    })
  }, [rows, columns, sort])

  function alternar(c: Column<T>) {
    if (!c.sortValue) return
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' }))
  }

  return (
    <div className={className}>
      {search && (
        <div className="relative mb-3 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Buscar...'}
            className="w-full rounded-lg border border-border bg-bg-card py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
        <table className="w-full text-xs" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-border bg-bg-soft/60 text-[10px] uppercase tracking-wider text-muted">
              {columns.map((c) => {
                const ativa = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    aria-sort={ativa ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('whitespace-nowrap px-3 py-2.5 font-semibold', alignCls[c.align ?? 'left'])}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => alternar(c)}
                        className={cn(
                          'inline-flex w-full items-center gap-1 uppercase tracking-wider transition-colors hover:text-zinc-200',
                          justifyCls[c.align ?? 'left'],
                          ativa && 'text-zinc-200',
                        )}
                        title="Ordenar"
                      >
                        {c.header}
                        {ativa ? (
                          sort!.dir === 'asc' ? <ArrowUp size={11} className="text-brand-300" /> : <ArrowDown size={11} className="text-brand-300" />
                        ) : (
                          <ChevronsUpDown size={11} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((row) => {
              const tone = rowTone?.(row)
              return (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border/60 transition-colors last:border-b-0',
                    tone ? ROW_TONE[tone] : onRowClick ? 'hover:bg-bg-soft/60' : 'hover:bg-bg-soft/40',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-3', alignCls[c.align ?? 'left'], c.className)}>
                      {c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-xs text-muted">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
