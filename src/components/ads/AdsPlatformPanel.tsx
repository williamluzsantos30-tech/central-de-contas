/**
 * AdsPlatformPanel — conteúdo de uma aba de plataforma de anúncios na Ficha do
 * Cliente (Operacional Tráfego › "Google Ads" / "Meta Ads"): card de conexão,
 * KPIs de performance do mês (com comparação MoM) e tabela de campanhas.
 *
 * Mesmo componente pras duas plataformas — muda só o adapter.
 */
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { AdsConnectionCard } from './AdsConnectionCard'
import { AdsPerformanceKpis } from './AdsPerformanceKpis'
import { AdsCampaignsTable } from './AdsCampaignsTable'
import { periodoAtualAds, type AdsPlatformAdapter } from './adsPlatform'

export function AdsPlatformPanel({
  adapter,
  clienteId,
  nomeCliente,
}: {
  adapter: AdsPlatformAdapter
  clienteId: string
  nomeCliente: string
}) {
  // Re-render após conectar/sincronizar/desconectar (o mock é lido no render).
  const [, setNonce] = useState(0)
  const bump = () => setNonce((n) => n + 1)
  const periodo = periodoAtualAds()

  useEffect(() => {
    adapter.loadCache().then(bump)
  }, [adapter])

  const conectado = adapter.getMetrics(clienteId, periodo) != null
  const Icon = adapter.icon

  return (
    <div className="space-y-5">
      <AdsConnectionCard adapter={adapter} clienteId={clienteId} nomeCliente={nomeCliente} onChanged={bump} />

      {conectado ? (
        <>
          <AdsPerformanceKpis adapter={adapter} clienteId={clienteId} periodo={periodo} />
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              <Icon size={12} className={adapter.cores.texto} />
              Campanhas · {adapter.nome}
            </h3>
            <AdsCampaignsTable adapter={adapter} clienteId={clienteId} periodo={periodo} />
          </section>
        </>
      ) : (
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border border-dashed border-border bg-bg-soft/30 px-4 py-4 text-[12px] text-muted',
          )}
        >
          <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', adapter.cores.fundoIcone, adapter.cores.texto)}>
            <Icon size={15} />
          </div>
          Conecte o {adapter.nome} para ver a performance e as campanhas deste cliente automaticamente.
        </div>
      )}
    </div>
  )
}
