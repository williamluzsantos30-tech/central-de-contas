/**
 * Linha "Ideal Recalculado" dos cards de meta do Comercial — camada EXTRA,
 * separada do "Realizado vs. Meta": o ideal vem do realizado da etapa
 * anterior × taxa ideal (calculateIdealCascade). Um card pode estar dentro da
 * meta e abaixo do ideal ao mesmo tempo — por isso a borda tracejada e o
 * rótulo próprio.
 */
import { cn } from '@/lib/utils'
import type { StatusIdeal } from '@/pages/comercial/metasComerciais'

export function IdealRecalculadoLinha({
  idealRecalculado,
  statusIdeal,
  realizado,
  semBase,
  conta,
  explicacao,
  className,
}: {
  idealRecalculado: number
  statusIdeal: StatusIdeal
  realizado: number
  /** Etapa anterior zerada: sem régua. */
  semBase?: boolean
  /** Conta curta ao lado do valor (ex.: "100 × 30%"). */
  conta?: string
  /** Tooltip com a conta por extenso (ex.: "100 qualificados × 30% (taxa ideal SDR)"). */
  explicacao?: string
  className?: string
}) {
  const diferenca = Math.max(0, idealRecalculado - realizado)
  // Laranja perto do ideal (≥ 80%), vermelho longe.
  const longe = idealRecalculado > 0 && realizado / idealRecalculado < 0.8

  return (
    <div className={cn('mt-2 border-t border-dashed border-border pt-1.5 text-[10px] leading-snug', className)} title={explicacao}>
      <p className="text-muted">
        💡 Ideal com base no realizado anterior:{' '}
        <span className="font-semibold tabular-nums text-zinc-200">{semBase ? '—' : idealRecalculado}</span>
        {conta && !semBase && <span className="tabular-nums text-muted"> · {conta}</span>}
      </p>
      {semBase ? (
        <p className="text-muted">Etapa anterior sem realizado no período.</p>
      ) : statusIdeal === 'acima' ? (
        <p className="font-medium text-green-300">✅ Acima do ideal</p>
      ) : (
        <p className={cn('font-medium', longe ? 'text-red-300' : 'text-orange-300')}>
          ⚠ Abaixo do ideal — {diferenca} a menos que o esperado
        </p>
      )}
    </div>
  )
}
