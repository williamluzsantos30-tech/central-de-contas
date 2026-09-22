/**
 * FluxoCaixaTable — demonstrativo de fluxo de caixa do período:
 * Saldo inicial → Entradas (detalhe + subtotal) → Saídas (detalhe + subtotal)
 * → Fluxo líquido → Saldo final. Verde/vermelho por natureza.
 */
import { cn } from '@/lib/utils'
import { formatBRL } from '@/pages/financeiro/despesasCalculator'
import type { FluxoCaixaResult } from '@/pages/financeiro/fluxoCaixaCalculator'

export function FluxoCaixaTable({ fc, saldoInicial }: { fc: FluxoCaixaResult; saldoInicial: number }) {
  const saldoFinal = saldoInicial + fc.fluxoLiquido
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
      <table className="w-full text-xs" style={{ minWidth: 480 }}>
        <tbody>
          <Linha label="Saldo inicial" valor={saldoInicial} tipo="saldo" />

          <Grupo label="(+) Entradas" />
          <Linha label="Recebimentos recorrentes (MRR)" valor={fc.entradasRecorrente} tipo="entrada" indent />
          <Linha label="Caixa recolhido (fechamentos)" valor={fc.entradasCaixaRecolhido} tipo="entrada" indent />
          <Linha label="(=) Total de entradas" valor={fc.entradas} tipo="subtotal-entrada" />

          <Grupo label="(−) Saídas" />
          <Linha label="Despesas pagas" valor={fc.saidasDespesasPagas} tipo="saida" indent neg />
          <Linha label="Investimento em marketing" valor={fc.saidasInvestimento} tipo="saida" indent neg />
          <Linha label="(=) Total de saídas" valor={fc.saidas} tipo="subtotal-saida" neg />

          <Linha label="(=) Fluxo líquido do período" valor={fc.fluxoLiquido} tipo="fluxo" />
          <Linha label="(=) Saldo final" valor={saldoFinal} tipo="saldo-final" />
        </tbody>
      </table>
    </div>
  )
}

type Tipo = 'saldo' | 'entrada' | 'saida' | 'subtotal-entrada' | 'subtotal-saida' | 'fluxo' | 'saldo-final'

function Grupo({ label }: { label: string }) {
  return (
    <tr className="border-t border-border/70 bg-bg-soft/30">
      <td colSpan={2} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</td>
    </tr>
  )
}

function Linha({ label, valor, tipo, indent, neg }: { label: string; valor: number; tipo: Tipo; indent?: boolean; neg?: boolean }) {
  const subtotal = tipo.startsWith('subtotal') || tipo === 'fluxo' || tipo === 'saldo-final'
  const destaque = tipo === 'fluxo' || tipo === 'saldo-final'
  const corValor =
    tipo === 'entrada' || tipo === 'subtotal-entrada'
      ? 'text-green-300'
      : tipo === 'saida' || tipo === 'subtotal-saida'
        ? 'text-red-300'
        : valor < 0
          ? 'text-red-400'
          : 'text-zinc-100'
  const texto = neg ? `− ${formatBRL(Math.abs(valor))}` : formatBRL(valor)
  return (
    <tr
      className={cn(
        'border-b border-border/50 last:border-b-0',
        subtotal && 'bg-bg-soft/40',
        tipo === 'saldo-final' && 'border-t-2 border-brand-500/40 bg-brand-500/[0.06]',
        tipo === 'fluxo' && 'border-t border-border/70',
      )}
    >
      <td className={cn('px-4 py-2.5', indent && 'pl-8', subtotal || destaque ? 'font-semibold text-zinc-100' : 'text-zinc-300')}>{label}</td>
      <td className={cn('px-4 py-2.5 text-right tabular-nums', subtotal && 'font-semibold', corValor)}>{texto}</td>
    </tr>
  )
}
