/**
 * LeadsTable — tabela de leads do Comercial, sobre o DataTable do DS.
 * Reúne também as células compartilhadas entre as 3 telas do funil
 * (contato/empresa, data, badge de status) pra manter consistência.
 */
import { DataTable, Badge, type Column, type Tone } from '@/components/ds'
import type { Lead } from '@/pages/comercial/mockLeads'

export function LeadsTable({
  columns,
  rows,
  search,
  emptyLabel,
  minWidth,
}: {
  columns: Column<Lead>[]
  rows: Lead[]
  search?: { value: string; onChange: (v: string) => void; placeholder?: string }
  emptyLabel?: string
  minWidth?: number
}) {
  return (
    <DataTable<Lead>
      columns={columns}
      rows={rows}
      rowKey={(l) => l.id}
      search={search}
      emptyLabel={emptyLabel ?? 'Nenhum lead nesta etapa.'}
      minWidth={minWidth ?? 860}
    />
  )
}

/** Célula "CONTATO/EMPRESA" — nome do contato em destaque + empresa abaixo. */
export function ContatoEmpresa({ lead }: { lead: Lead }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs font-semibold text-zinc-100">{lead.nomeContato}</div>
      <div className="truncate text-[11px] text-muted">{lead.empresa}</div>
    </div>
  )
}

/** Badge de status genérico (rótulo + tom já resolvidos pela tela). */
export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <Badge tone={tone}>{label}</Badge>
}

/** dd/mm/aaaa a partir de ISO (ou "—"). */
export function fmtData(iso?: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

/** R$ com 2 casas. */
export function fmtBRL(v?: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
