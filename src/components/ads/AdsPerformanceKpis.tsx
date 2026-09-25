/**
 * AdsPerformanceKpis — grade de KPIs de performance de uma plataforma de
 * anúncios, com comparação automática vs. mês anterior. Os KPIs exibidos vêm
 * do adapter (Google: CPC/CPA…; Meta: Alcance/CPM/Custo por resultado…).
 * Só renderiza quando há métricas (cliente conectado).
 */
import { KPICard } from '@/components/ds'
import { cn } from '@/lib/utils'
import { formatKpi, periodoAnteriorAds, type AdsPlatformAdapter } from './adsPlatform'

export function AdsPerformanceKpis({
  adapter,
  clienteId,
  periodo,
}: {
  adapter: AdsPlatformAdapter
  clienteId: string
  periodo: string
}) {
  const atual = adapter.getMetrics(clienteId, periodo)
  if (!atual) return null
  const anterior = adapter.getMetrics(clienteId, periodoAnteriorAds(periodo))
  const Icon = adapter.icon

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <Icon size={12} className={adapter.cores.texto} />
        Performance do mês · {adapter.nome}
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {adapter.kpis.map((k) => {
          const v = k.valor(atual)
          if (v == null) return null
          const KpiIcon = k.icon
          return (
            <KPICard
              key={k.key}
              label={k.label}
              value={formatKpi(v, k.formato)}
              icon={<KpiIcon size={12} className={cn(k.destaque ? 'text-emerald-300' : adapter.cores.texto)} />}
              tone={k.destaque ? 'success' : 'neutral'}
              valorAtual={v}
              valorAnterior={anterior ? k.valor(anterior) : undefined}
              direcaoFavoravel={k.direcao}
            />
          )
        })}
      </div>
    </section>
  )
}
