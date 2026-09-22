/**
 * DRETable — demonstrativo de resultado hierárquico, com colunas
 * Competência e Caixa lado a lado. Linhas de subtotal (Margem Bruta, EBITDA,
 * Lucro Líquido) em destaque; deduções/custos em vermelho e com sinal
 * negativo; comparação ▲/▼ vs. período anterior por coluna.
 */
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calculatePeriodComparison } from '@/components/ds/KPICard'
import { formatBRL } from '@/pages/financeiro/despesasCalculator'
import type { DreResult } from '@/pages/financeiro/dreCalculator'

type Dir = 'maior' | 'menor'
type Tipo = 'receita' | 'deducao' | 'subtotal' | 'despesa' | 'total'

interface LinhaDef {
  key: keyof DreResult
  label: string
  nivel: 0 | 1
  tipo: Tipo
  dir: Dir
  neg?: boolean // exibe com sinal negativo (deduções/custos)
  pctKey?: keyof DreResult // linha de margem: mostra o % embaixo
  detalhe?: string
}

const LINHAS: LinhaDef[] = [
  { key: 'receitaBruta', label: '(+) Receita Bruta', nivel: 0, tipo: 'receita', dir: 'maior' },
  { key: 'deducoes', label: '(−) Deduções / Churn', nivel: 1, tipo: 'deducao', dir: 'menor', neg: true },
  { key: 'receitaLiquida', label: '(=) Receita Líquida', nivel: 0, tipo: 'subtotal', dir: 'maior' },
  { key: 'custosDiretos', label: '(−) Custos Diretos (CMV/CPV)', nivel: 1, tipo: 'despesa', dir: 'menor', neg: true, detalhe: 'custos operacionais + CAC' },
  { key: 'margemBruta', label: '(=) Margem Bruta', nivel: 0, tipo: 'subtotal', dir: 'maior', pctKey: 'margemBrutaPct' },
  { key: 'despesasOperacionais', label: '(−) Despesas Operacionais / Adm.', nivel: 1, tipo: 'despesa', dir: 'menor', neg: true },
  { key: 'ebitda', label: '(=) EBITDA', nivel: 0, tipo: 'subtotal', dir: 'maior' },
  { key: 'despesasFinanceiras', label: '(−) Despesas Financeiras', nivel: 1, tipo: 'despesa', dir: 'menor', neg: true },
  { key: 'impostos', label: '(−) Impostos', nivel: 1, tipo: 'despesa', dir: 'menor', neg: true },
  { key: 'lucroLiquido', label: '(=) Lucro Líquido', nivel: 0, tipo: 'total', dir: 'maior', pctKey: 'margemLiquidaPct' },
]

function ComparBadge({ atual, anterior, dir }: { atual: number; anterior: number; dir: Dir }) {
  const c = calculatePeriodComparison(atual, anterior, dir)
  if (!c.temDadoAnterior) return null
  const zero = Math.abs(c.percentual) < 0.05
  const Icon = zero ? Minus : c.percentual > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex items-center gap-0.5 rounded border px-1 py-px text-[9px] font-semibold tabular-nums align-middle',
        zero ? 'border-border text-muted' : c.favoravel ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-red-500/40 bg-red-500/10 text-red-300',
      )}
      title="vs. período anterior"
    >
      <Icon size={9} />
      {c.percentual > 0 ? '+' : ''}
      {c.percentual.toFixed(0)}%
    </span>
  )
}

function Valor({ v, neg, tipo }: { v: number; neg?: boolean; tipo: Tipo }) {
  const perda = tipo === 'deducao' || tipo === 'despesa'
  const negativoResultado = (tipo === 'subtotal' || tipo === 'total') && v < 0
  const texto = neg ? `− ${formatBRL(Math.abs(v))}` : formatBRL(v)
  return (
    <span className={cn('tabular-nums', perda ? 'text-red-300' : negativoResultado ? 'text-red-400' : 'text-zinc-100')}>{texto}</span>
  )
}

export function DRETable({
  comp,
  caixa,
  compAnterior,
  caixaAnterior,
}: {
  comp: DreResult
  caixa: DreResult
  compAnterior: DreResult
  caixaAnterior: DreResult
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
      <table className="w-full text-xs" style={{ minWidth: 640 }}>
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 text-left font-semibold">Demonstrativo</th>
            <th className="px-4 py-2.5 text-right font-semibold">Competência</th>
            <th className="px-4 py-2.5 text-right font-semibold">Caixa</th>
          </tr>
        </thead>
        <tbody>
          {LINHAS.map((l) => {
            const subtotal = l.tipo === 'subtotal' || l.tipo === 'total'
            return (
              <tr
                key={l.key}
                className={cn(
                  'border-b border-border/50 last:border-b-0',
                  subtotal && 'bg-bg-soft/40',
                  l.tipo === 'subtotal' && 'border-t border-border/70',
                  l.tipo === 'total' && 'border-t-2 border-brand-500/40 bg-brand-500/[0.06]',
                )}
              >
                <td className={cn('px-4 py-2.5', l.nivel === 1 && 'pl-8', subtotal ? 'font-semibold text-zinc-100' : 'text-zinc-300')}>
                  {l.label}
                  {l.detalhe && <span className="ml-2 text-[10px] font-normal normal-case text-muted">({l.detalhe})</span>}
                </td>
                <td className={cn('px-4 py-2.5 text-right', subtotal && 'font-semibold')}>
                  <Valor v={comp[l.key] as number} neg={l.neg} tipo={l.tipo} />
                  <ComparBadge atual={comp[l.key] as number} anterior={compAnterior[l.key] as number} dir={l.dir} />
                  {l.pctKey && (
                    <div className="mt-0.5 text-[10px] text-brand-300">{(comp[l.pctKey] as number).toFixed(1)}%</div>
                  )}
                </td>
                <td className={cn('px-4 py-2.5 text-right', subtotal && 'font-semibold')}>
                  <Valor v={caixa[l.key] as number} neg={l.neg} tipo={l.tipo} />
                  <ComparBadge atual={caixa[l.key] as number} anterior={caixaAnterior[l.key] as number} dir={l.dir} />
                  {l.pctKey && (
                    <div className="mt-0.5 text-[10px] text-brand-300">{(caixa[l.pctKey] as number).toFixed(1)}%</div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
