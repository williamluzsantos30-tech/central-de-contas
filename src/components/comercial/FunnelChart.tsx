/**
 * FunnelChart — funil horizontal decrescente. Cada etapa mostra a contagem
 * absoluta + a % de conversão em relação à etapa anterior.
 */
export interface FunnelEtapa {
  label: string
  count: number
  /** % de conversão vs. etapa anterior (null na primeira). */
  convPct: number | null
}

export function FunnelChart({ etapas }: { etapas: FunnelEtapa[] }) {
  const max = Math.max(1, ...etapas.map((e) => e.count))
  return (
    <div className="space-y-2">
      {etapas.map((e, i) => {
        const w = Math.max(6, (e.count / max) * 100)
        return (
          <div key={e.label} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-right text-[11px] text-muted">{e.label}</div>
            <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-bg-soft/40">
              <div
                className="flex h-full items-center rounded-md bg-gradient-to-r from-brand-600 to-brand-500 px-2"
                style={{ width: `${w}%` }}
              >
                <span className="text-xs font-semibold tabular-nums text-white">{e.count}</span>
              </div>
            </div>
            <div className="w-16 shrink-0 text-[11px] tabular-nums text-muted">
              {e.convPct == null ? '—' : `${e.convPct.toFixed(0)}%`}
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1">
        <div className="w-40 shrink-0" />
        <div className="flex-1" />
        <div className="w-16 shrink-0 text-[9px] uppercase tracking-wider text-muted">conversão</div>
      </div>
    </div>
  )
}
