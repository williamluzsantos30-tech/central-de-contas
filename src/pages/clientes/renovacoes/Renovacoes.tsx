/**
 * Renovações de Contrato — VIEW derivada dos contratos das fichas.
 *
 * Cada linha vem do card "Contrato" da Ficha do cliente (data-fim). Aqui
 * só lemos e calculamos vencimentos — ver ./useRenovacoesData.ts. Preencher
 * o contrato na Ficha reflete aqui automaticamente.
 *
 * Três camadas de leitura, todas com a MESMA escala de urgência
 * (./faixasRenovacao.ts): resumo (MRR em renovação + barra por faixa),
 * mapa (risco × dias) e tabela (vigência, dias, risco).
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar, RefreshCw, X } from 'lucide-react'
import { PageHeader, DataTable, Badge, type Column, type RowTone } from '@/components/ds'
import { cn } from '@/lib/utils'
import { useRenovacoesData, type LinhaRenovacao } from './useRenovacoesData'
import { FAIXA_POR_ID, RISCO_COR, TIPO_CONTRATO_LABEL, faixaDe, fmtBRL0, textoDias, type FaixaId } from './faixasRenovacao'
import { ResumoRenovacoes } from './ResumoRenovacoes'
import { MapaRenovacoes } from './MapaRenovacoes'

const dataCurta = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const STATUS_CONTRATO: Record<string, { label: string; cor: string }> = {
  ativo: { label: 'Ativo', cor: '#16a34a' },
  renovado: { label: 'Renovado', cor: '#8b5cf6' },
  pausado: { label: 'Pausado', cor: '#facc15' },
  encerrado: { label: 'Encerrado', cor: '#c81e1e' },
}

/** Linha inteira tingida só pro que pede ação imediata. */
function prioridade(l: LinhaRenovacao): RowTone | undefined {
  if (l.diasRestantes < 0) return 'danger'
  if (l.diasRestantes <= 7) return 'warning'
  return undefined
}

const npsCor = (n: number) => (n >= 9 ? 'text-green-300' : n >= 7 ? 'text-yellow-300' : 'text-red-300')

const COLUNAS: Column<LinhaRenovacao>[] = [
  {
    key: 'nome',
    header: 'Cliente',
    sortValue: (l) => l.nome,
    render: (l) => (
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand-500/40 bg-brand-500/15 text-[11px] font-bold text-brand-300">
          {l.nome.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <Link to={`/clientes/${l.id}`} className="block truncate font-semibold text-zinc-100 hover:text-brand-300">
            {l.nome}
          </Link>
          <p className="truncate text-[10px] text-muted">
            {[l.nicho, l.contratoTipo ? `Contrato ${TIPO_CONTRATO_LABEL[l.contratoTipo]?.toLowerCase() ?? l.contratoTipo}` : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: 'resp',
    header: 'AM · Squad',
    sortValue: (l) => l.accountManager ?? l.squad,
    render: (l) => (
      <div className="min-w-0">
        <p className="truncate text-zinc-200">{l.accountManager ?? '—'}</p>
        <p className="truncate text-[10px] text-muted">{l.squad ?? 'Sem squad'}</p>
      </div>
    ),
  },
  {
    key: 'mrr',
    header: 'MRR',
    align: 'right',
    sortValue: (l) => l.mrr,
    render: (l) => <span className="font-semibold tabular-nums text-zinc-100">{fmtBRL0(l.mrr)}</span>,
  },
  {
    key: 'vigencia',
    header: 'Vigência',
    sortValue: (l) => l.contratoFim,
    render: (l) => {
      const f = faixaDe(l.diasRestantes)
      return (
        <div className="w-44">
          {l.vigenciaPct != null ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-elev" title={`${Math.round(l.vigenciaPct)}% da vigência decorrida`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, l.vigenciaPct)}%`, background: f.cor }} />
            </div>
          ) : null}
          <p className="mt-1 text-[10px] tabular-nums text-muted">
            {l.contratoInicio ? `${dataCurta(l.contratoInicio)} → ` : 'até '}
            <span className="text-zinc-300">{dataCurta(l.contratoFim)}</span>
          </p>
        </div>
      )
    },
  },
  {
    key: 'dias',
    header: 'Vence em',
    sortValue: (l) => l.diasRestantes,
    render: (l) => {
      const f = faixaDe(l.diasRestantes)
      return (
        <Badge tone={f.tone} className="gap-1.5 tabular-nums">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.cor }} />
          {textoDias(l.diasRestantes)}
        </Badge>
      )
    },
  },
  {
    key: 'status',
    header: 'Contrato',
    sortValue: (l) => l.contratoStatus ?? 'ativo',
    render: (l) => {
      const s = STATUS_CONTRATO[l.contratoStatus ?? 'ativo'] ?? STATUS_CONTRATO.ativo
      return (
        <span className="inline-flex items-center gap-1.5 text-zinc-200">
          <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} />
          {s.label}
        </span>
      )
    },
  },
  {
    key: 'risco',
    header: 'Risco · NPS',
    sortValue: (l) => RISCO_COR[l.semaforo ?? 'verde'].ordem,
    render: (l) => {
      const r = RISCO_COR[l.semaforo ?? 'verde']
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 text-zinc-200">
            <span className="h-2 w-2 rounded-full" style={{ background: r.cor }} />
            {r.label}
          </span>
          {typeof l.nps === 'number' && (
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
              NPS <span className={cn('font-semibold tabular-nums', npsCor(l.nps))}>{l.nps}</span>
            </span>
          )}
        </span>
      )
    },
  },
  {
    key: 'acao',
    header: '',
    align: 'right',
    render: (l) => {
      // Na janela de ação (≤ 30d ou vencido) o botão ganha destaque.
      const urgente = l.diasRestantes <= 30
      return (
        <Link
          to={`/clientes/${l.id}?edit=contrato`}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
            urgente
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'border border-border text-zinc-200 hover:border-brand-500/50 hover:text-brand-300',
          )}
          title="Abrir o contrato do cliente para renovar"
        >
          <RefreshCw size={11} /> Renovar
        </Link>
      )
    },
  },
]

export default function Renovacoes() {
  const d = useRenovacoesData()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [faixa, setFaixa] = useState<FaixaId | null>(null)

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return d.linhas.filter(
      (l) =>
        (!faixa || l.faixa === faixa) &&
        (!q ||
          l.nome.toLowerCase().includes(q) ||
          (l.squad ?? '').toLowerCase().includes(q) ||
          (l.accountManager ?? '').toLowerCase().includes(q)),
    )
  }, [busca, faixa, d.linhas])

  return (
    <div>
      <PageHeader title="Renovações de Contrato" description="Acompanhe vencimentos, receita em jogo e priorize quem renovar primeiro" />

      {d.loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">Carregando…</div>
      ) : d.vazio ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-12 text-center">
          <Calendar size={22} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-zinc-200">Nenhum contrato com vencimento cadastrado</p>
          <p className="mt-1 text-[11px] text-muted">
            Preencha o <strong>Contrato</strong> (com data de fim) na Ficha de um cliente e ele aparece aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ResumoRenovacoes resumo={d.resumo} filtro={faixa} onFiltro={setFaixa} />
          <MapaRenovacoes linhas={d.linhas} onAbrir={(id) => navigate(`/clientes/${id}?edit=contrato`)} />

          <section>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">Contratos</h3>
              <span className="text-[11px] tabular-nums text-muted">
                {linhas.length} de {d.linhas.length}
              </span>
              {faixa && (
                <button
                  type="button"
                  onClick={() => setFaixa(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 text-[11px] text-brand-200 hover:bg-brand-500/20"
                  title="Limpar filtro de faixa"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: FAIXA_POR_ID[faixa].cor }} />
                  {FAIXA_POR_ID[faixa].label}
                  <X size={11} />
                </button>
              )}
            </div>
            <DataTable
              columns={COLUNAS}
              rows={linhas}
              rowKey={(l) => l.id}
              rowTone={prioridade}
              defaultSort={{ key: 'dias', dir: 'asc' }}
              minWidth={1000}
              search={{ value: busca, onChange: setBusca, placeholder: 'Buscar cliente, squad ou AM...' }}
              emptyLabel="Nenhum contrato nesse filtro."
            />
          </section>
        </div>
      )}
    </div>
  )
}
