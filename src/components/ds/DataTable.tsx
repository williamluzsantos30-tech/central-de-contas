/**
 * DataTable — tabela genérica do design system.
 * Header uppercase cinza, linhas com divisória fina + hover sutil,
 * busca local opcional acima. Colunas configuráveis com render custom.
 */
import { type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Render custom da célula. Sem isso, tenta row[key]. */
  render?: (row: T) => ReactNode
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
}

const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  search,
  emptyLabel = 'Nenhum registro.',
  minWidth = 720,
  className,
}: Props<T>) {
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
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-3 py-2.5 font-semibold', alignCls[c.align ?? 'left'])}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border/60 transition-colors last:border-b-0',
                  onRowClick ? 'cursor-pointer hover:bg-bg-soft/60' : 'hover:bg-bg-soft/40',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-3', alignCls[c.align ?? 'left'], c.className)}>
                    {c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
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
