/**
 * DespesasTable — tabela de despesas (wrapper do DataTable do DS).
 * Badges coloridos por categoria/recorrência/status, badge de origem
 * (manual × integração) e ações (editar / excluir). Excluir fica desabilitado
 * pra despesas de origem "integração externa" (fonte de verdade é a ferramenta).
 */
import { PenLine, Plug, Pencil, Trash2, Repeat } from 'lucide-react'
import { Badge, DataTable, type Column } from '@/components/ds'
import { cn } from '@/lib/utils'
import {
  categoriaInfo,
  recorrenciaInfo,
  statusInfo,
  type Despesa,
} from '@/pages/financeiro/mockDespesas'
import { formatBRL, statusEfetivo } from '@/pages/financeiro/despesasCalculator'

function compActa(periodo: string): string {
  const [y, m] = periodo.split('-')
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[Number(m) - 1]}/${y}`
}

export function DespesasTable({
  rows,
  search,
  onEdit,
  onExcluir,
  emptyLabel,
}: {
  rows: Despesa[]
  search?: { value: string; onChange: (v: string) => void; placeholder?: string }
  onEdit: (d: Despesa) => void
  onExcluir: (d: Despesa) => void
  emptyLabel?: string
}) {
  const columns: Column<Despesa>[] = [
    {
      key: 'descricao',
      header: 'Descrição',
      render: (d) => (
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 font-medium text-zinc-100">
            {d.descricao}
            {d.projecao && (
              <span className="inline-flex items-center gap-0.5 rounded border border-border px-1 py-px text-[9px] uppercase tracking-wide text-muted" title="Lançamento previsto pela recorrência (ainda não confirmado)">
                <Repeat size={8} /> prevista
              </span>
            )}
          </span>
          {d.fornecedor && <span className="text-[11px] text-muted">{d.fornecedor}</span>}
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: (d) => {
        const c = categoriaInfo(d.categoria)
        return <Badge tone={c.tone}>{c.label}</Badge>
      },
    },
    { key: 'setor', header: 'Setor', render: (d) => <span className="text-zinc-300">{d.setor || 'Geral'}</span> },
    { key: 'valor', header: 'Valor', align: 'right', render: (d) => <span className="font-semibold tabular-nums text-zinc-100">{formatBRL(d.valor)}</span> },
    {
      key: 'recorrencia',
      header: 'Recorrência',
      render: (d) => {
        const r = recorrenciaInfo(d.tipoRecorrencia)
        return <Badge tone={r.tone}>{r.label}</Badge>
      },
    },
    { key: 'competencia', header: 'Competência', render: (d) => <span className="tabular-nums text-zinc-300">{compActa(d.dataCompetencia)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (d) => {
        const s = statusInfo(statusEfetivo(d))
        return <Badge tone={s.tone}>{s.label}</Badge>
      },
    },
    {
      key: 'origem',
      header: 'Origem',
      render: (d) =>
        d.origem === 'integracao_externa' ? (
          <Badge tone="info" title={d.origemDetalhe ? `ID externo: ${d.origemDetalhe.idExterno}` : undefined}>
            <Plug size={10} /> {d.origemDetalhe?.provedor ?? 'Integração'}
          </Badge>
        ) : (
          <Badge tone="neutral">
            <PenLine size={10} /> Manual
          </Badge>
        ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (d) => {
        const bloqueado = d.origem === 'integracao_externa'
        return (
          <div className="inline-flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(d)}
              className="rounded p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
              title={bloqueado ? 'Editar categoria/setor (metadados internos)' : 'Editar'}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => !bloqueado && onExcluir(d)}
              disabled={bloqueado}
              className={cn(
                'rounded p-1.5 transition-colors',
                bloqueado
                  ? 'cursor-not-allowed text-muted/40'
                  : 'text-muted hover:bg-bg-elev hover:text-red-300',
              )}
              title={bloqueado ? 'Despesa de integração: gerencie na ferramenta de origem' : 'Excluir'}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(d) => d.id}
      search={search}
      emptyLabel={emptyLabel ?? 'Nenhuma despesa neste período.'}
      minWidth={1040}
    />
  )
}
