/**
 * AdsCampaignsTable — campanhas de uma plataforma de anúncios no período, com
 * contadores por status e um indicador de saúde por campanha (pior severidade
 * do diagnóstico). O "olho" (ou clique na linha) abre o CampaignDetailModal:
 * diagnóstico + ações pra melhorar o desempenho. Genérico via adapter.
 */
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'
import {
  formatKpi,
  statusCampanhaLabel,
  statusCampanhaTone,
  type AdsPlatformAdapter,
  type StatusCampanhaAds,
} from './adsPlatform'
import { diagnosticarCampanha, severidadeCampanha, type Severidade } from './campaignInsights'
import { CampaignDetailModal } from './CampaignDetailModal'

const saudeCor: Record<Severidade, string> = {
  critico: 'bg-red-400',
  atencao: 'bg-amber-400',
  oportunidade: 'bg-emerald-400',
}
const saudeTexto: Record<Severidade, string> = {
  critico: 'Precisa de ação',
  atencao: 'Pontos de atenção',
  oportunidade: 'Oportunidades',
}

export function AdsCampaignsTable({
  adapter,
  clienteId,
  periodo,
  onChanged,
  onOtimizacaoRegistrada,
}: {
  adapter: AdsPlatformAdapter
  clienteId: string
  periodo: string
  onChanged?: () => void
  onOtimizacaoRegistrada?: () => void
}) {
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const metrics = adapter.getMetrics(clienteId, periodo)
  const Icon = adapter.icon

  if (!metrics) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-bg-soft/30 px-4 py-8 text-center">
            <div className={cn('grid h-9 w-9 place-items-center rounded-lg', adapter.cores.fundoIcone, adapter.cores.texto)}>
              <Icon size={17} />
            </div>
            <p className="text-xs text-muted">Conecte o {adapter.nome} para popular as campanhas automaticamente.</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  const campanhas = metrics.campanhas
  const conta = (s: StatusCampanhaAds) => campanhas.filter((c) => c.status === s).length

  return (
    <>
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ativas {conta('ativa')}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Pausadas {conta('pausada')}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="inline-flex items-center gap-1 text-yellow-300">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> Em revisão {conta('em_revisao')}
          </span>
          <span className="ml-auto text-[10px]">Clique no olho pra ver o diagnóstico e as ações de cada campanha</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-semibold">Nome da campanha</th>
                <th className="px-3 py-2 font-semibold">Plataforma</th>
                <th className="px-3 py-2 font-semibold">{adapter.textos.tipoColuna}</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Orç. diário</th>
                <th className="px-3 py-2 text-right font-semibold">Investimento no mês</th>
                <th className="px-3 py-2 text-right font-semibold">Cliques</th>
                <th className="px-3 py-2 text-right font-semibold">{adapter.textos.conversoesColuna}</th>
                <th className="px-3 py-2 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => {
                const recs = diagnosticarCampanha(adapter, c, metrics, periodo)
                const sev = severidadeCampanha(recs)
                const acionaveis = recs.filter((r) => r.severidade !== 'oportunidade').length
                return (
                  <tr
                    key={c.id}
                    onClick={() => setAbertaId(c.id)}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-bg-soft/40"
                  >
                    <td className="px-3 py-2 text-zinc-200">{c.nome}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium',
                          adapter.cores.badge,
                        )}
                      >
                        <Icon size={10} /> {adapter.nome}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{adapter.tipoCampanhaLabel(c.tipo)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={statusCampanhaTone[c.status]}>{statusCampanhaLabel[c.status]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{formatCurrency(c.orcamentoDiario)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{formatCurrency(c.investimentoMes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{formatKpi(c.cliques, 'numero')}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-300">{formatKpi(c.conversoes, 'numero')}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAbertaId(c.id)
                        }}
                        className="inline-flex items-center gap-1.5 rounded p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-zinc-100"
                        title={sev ? `${saudeTexto[sev]} — ver diagnóstico e ações` : 'Ver diagnóstico e ações'}
                        aria-label="Ver diagnóstico e ações da campanha"
                      >
                        {sev && (
                          <span className="inline-flex items-center gap-1">
                            <span className={cn('h-1.5 w-1.5 rounded-full', saudeCor[sev])} />
                            {acionaveis > 0 && <span className="text-[10px] font-semibold tabular-nums">{acionaveis}</span>}
                          </span>
                        )}
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>

    {abertaId && (
      <CampaignDetailModal
        adapter={adapter}
        clienteId={clienteId}
        campanhaId={abertaId}
        periodo={periodo}
        onClose={() => setAbertaId(null)}
        onChanged={() => onChanged?.()}
        onOtimizacaoRegistrada={onOtimizacaoRegistrada}
      />
    )}
    </>
  )
}
