/**
 * GoogleAdsPerformanceKpis — grade de KPIs de performance do Google Ads na
 * Ficha do Cliente. Comparação MoM automática (período atual vs. anterior).
 * Só renderiza quando há métricas (cliente conectado). Dados via mockGoogleAds.
 */
import { Wallet, Eye, MousePointerClick, Percent, Coins, Target, Receipt, Megaphone } from 'lucide-react'
import { KPICard } from '@/components/ds'
import { formatCurrency } from '@/lib/utils'
import { getGoogleAdsMetrics, periodoAnteriorGA } from './mockGoogleAds'

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n))
const fmtPct = (n: number) => `${n.toFixed(2).replace('.', ',')}%`

export function GoogleAdsPerformanceKpis({ clienteId, periodo }: { clienteId: string; periodo: string }) {
  const atual = getGoogleAdsMetrics(clienteId, periodo)
  if (!atual) return null
  const anterior = getGoogleAdsMetrics(clienteId, periodoAnteriorGA(periodo))

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <Megaphone size={12} className="text-sky-300" />
        Performance · Google Ads
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard
          label="Investimento"
          value={formatCurrency(atual.investimento)}
          icon={<Wallet size={12} className="text-sky-300" />}
          tone="neutral"
          valorAtual={atual.investimento}
          valorAnterior={anterior?.investimento}
          direcaoFavoravel="maior"
        />
        <KPICard
          label="Impressões"
          value={fmtNum(atual.impressoes)}
          icon={<Eye size={12} className="text-sky-300" />}
          tone="neutral"
          valorAtual={atual.impressoes}
          valorAnterior={anterior?.impressoes}
          direcaoFavoravel="maior"
        />
        <KPICard
          label="Cliques"
          value={fmtNum(atual.cliques)}
          icon={<MousePointerClick size={12} className="text-sky-300" />}
          tone="neutral"
          valorAtual={atual.cliques}
          valorAnterior={anterior?.cliques}
          direcaoFavoravel="maior"
        />
        <KPICard
          label="CTR"
          value={fmtPct(atual.ctr)}
          icon={<Percent size={12} className="text-sky-300" />}
          tone="neutral"
          valorAtual={atual.ctr}
          valorAnterior={anterior?.ctr}
          direcaoFavoravel="maior"
        />
        <KPICard
          label="CPC Médio"
          value={formatCurrency(atual.cpcMedio)}
          icon={<Coins size={12} className="text-sky-300" />}
          tone="neutral"
          valorAtual={atual.cpcMedio}
          valorAnterior={anterior?.cpcMedio}
          direcaoFavoravel="menor"
        />
        <KPICard
          label="Conversões"
          value={fmtNum(atual.conversoes)}
          icon={<Target size={12} className="text-emerald-300" />}
          tone="success"
          valorAtual={atual.conversoes}
          valorAnterior={anterior?.conversoes}
          direcaoFavoravel="maior"
        />
        <KPICard
          label="CPA"
          value={formatCurrency(atual.cpa)}
          icon={<Receipt size={12} className="text-sky-300" />}
          tone="neutral"
          valorAtual={atual.cpa}
          valorAnterior={anterior?.cpa}
          direcaoFavoravel="menor"
        />
      </div>
    </section>
  )
}
