/**
 * CampaignsTable — tabela das campanhas de Google Ads do cliente no período.
 * Contadores por status no topo. Somente leitura (as campanhas vêm da API);
 * a ação por linha é um placeholder de detalhe. Empty state quando não há
 * conexão. Dados via mockGoogleAds.
 */
import { Megaphone, Eye } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import {
  getGoogleAdsMetrics,
  statusCampanhaLabel,
  tipoCampanhaLabel,
  type StatusCampanha,
} from './mockGoogleAds'

const statusTone: Record<StatusCampanha, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ativa: 'success',
  pausada: 'neutral',
  em_revisao: 'warning',
  removida: 'danger',
}

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n))

export function CampaignsTable({ clienteId, periodo }: { clienteId: string; periodo: string }) {
  const metrics = getGoogleAdsMetrics(clienteId, periodo)
  const campanhas = metrics?.campanhas ?? []

  if (!metrics) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-bg-soft/30 px-4 py-8 text-center">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/10 text-sky-300">
              <Megaphone size={17} />
            </div>
            <p className="text-xs text-muted">
              Conecte o Google Ads para popular as campanhas automaticamente.
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  const ativas = campanhas.filter((c) => c.status === 'ativa').length
  const pausadas = campanhas.filter((c) => c.status === 'pausada').length
  const emRevisao = campanhas.filter((c) => c.status === 'em_revisao').length

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ativas {ativas}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Pausadas {pausadas}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="inline-flex items-center gap-1 text-yellow-300">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> Em revisão {emRevisao}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold">Plataforma</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Orç. diário</th>
                <th className="px-3 py-2 text-right font-semibold">Investimento no mês</th>
                <th className="px-3 py-2 text-right font-semibold">Cliques</th>
                <th className="px-3 py-2 text-right font-semibold">Conversões</th>
                <th className="px-3 py-2 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => (
                <tr key={c.id} className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-bg-soft/40">
                  <td className="px-3 py-2 text-zinc-200">{c.nome}</td>
                  <td className="px-3 py-2">
                    <Badge tone="info">
                      <Megaphone size={10} /> Google Ads
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted">{tipoCampanhaLabel[c.tipo]}</td>
                  <td className="px-3 py-2">
                    <Badge tone={statusTone[c.status]}>{statusCampanhaLabel[c.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{formatCurrency(c.orcamentoDiario)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{formatCurrency(c.investimentoMes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{fmtNum(c.cliques)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-300">{fmtNum(c.conversoes)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="rounded p-1.5 text-muted transition-colors hover:bg-bg-elev hover:text-sky-300"
                      title="Ver detalhe da campanha (em breve)"
                      aria-label="Ver detalhe da campanha"
                    >
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  )
}
