/**
 * Comercial › Funil Tráfego — relação entre os criativos da Meta Ads (gasto
 * por anúncio) e a QUALIDADE/CONVERSÃO dos leads que cada um trouxe, usando a
 * classificação A/B/C que chega pronta do CRM externo.
 *
 * Blocos: ranking de criativos por qualificados · distribuição A/B/C ·
 * winrate por classificação · criativos × classificação. Tudo derivado da
 * mesma entidade Lead (store do Comercial) + mock Meta Ads por criativo.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react'
import { PageHeader, KPICard, Select, OutlineButton } from '@/components/ds'
import { fmtBRL } from '@/components/comercial/LeadsTable'
import { CreativeRankingTable } from '@/components/comercial/CreativeRankingTable'
import { ClassificationDistributionChart } from '@/components/comercial/ClassificationDistributionChart'
import { WinrateByClassificationPanel } from '@/components/comercial/WinrateByClassificationPanel'
import { CreativeClassificationCrossTable } from '@/components/comercial/CreativeClassificationCrossTable'
import { fmtDataHoraAds } from '@/components/ads/adsPlatform'
import { useComercial } from './store'
import { periodoMes, periodoRange } from './marketingCalculator'
import { getCriativosMetaAds, simularSincronizacaoCriativos } from './mockMetaAdsData'
import { calculateTrafficFunnel } from './trafficFunnelCalculator'
import { useEstadoCriativosMeta } from './useEstadoCriativosMeta'

const CANAIS = ['Meta Ads', 'Google Ads'] as const
const inputCls = 'rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs text-zinc-100'

export default function FunilTrafego() {
  const { leads } = useComercial()
  const estadoMeta = useEstadoCriativosMeta()
  const [tipoPeriodo, setTipoPeriodo] = useState<'mes' | 'custom'>('mes')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [canal, setCanal] = useState('')

  const filtro = useMemo(
    () => (tipoPeriodo === 'custom' && (de || ate) ? periodoRange(de, ate) : periodoMes(mes)),
    [tipoPeriodo, mes, de, ate],
  )
  // estadoMeta nas deps: re-lê o mock quando o BM conecta ou sincroniza.
  const criativos = useMemo(() => getCriativosMetaAds(filtro), [filtro, estadoMeta])
  const f = useMemo(() => calculateTrafficFunnel(leads, criativos, filtro, canal || undefined), [leads, criativos, filtro, canal])

  const pctA = f.distribuicao.pct.A

  return (
    <div>
      <PageHeader
        title="Funil Tráfego"
        description="Performance de criativos Meta Ads e qualidade dos leads gerados"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tipoPeriodo} onChange={(e) => setTipoPeriodo(e.target.value as 'mes' | 'custom')} className="w-32">
              <option value="mes">Por mês</option>
              <option value="custom">Intervalo</option>
            </Select>
            {tipoPeriodo === 'custom' ? (
              <>
                <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} aria-label="De" />
                <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} aria-label="Até" />
              </>
            ) : (
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputCls} aria-label="Mês" />
            )}
            <Select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-40">
              <option value="">Todos os canais</option>
              {CANAIS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <StatusMeta estado={estadoMeta} />

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Leads de tráfego" value={String(f.totais.leadsComCriativo)} tone="accent" sub="com criativo de origem" />
        <KPICard label="Qualificados" value={String(f.totais.qualificados)} tone="info" sub="SDR + Closer" />
        <KPICard
          label="Custo por qualificado"
          value={f.totais.custoPorQualificado > 0 ? fmtBRL(f.totais.custoPorQualificado) : '—'}
          tone="neutral"
          sub={f.totais.gasto > 0 ? `${fmtBRL(f.totais.gasto)} rastreado na Meta` : 'sem gasto rastreado'}
        />
        <KPICard
          label="Leads A"
          value={f.distribuicao.classificados ? `${pctA.toFixed(0)}%` : '—'}
          tone={!f.distribuicao.classificados ? 'neutral' : pctA >= 35 ? 'success' : pctA >= 20 ? 'warning' : 'danger'}
          sub={`${f.distribuicao.A} de ${f.distribuicao.classificados} classificados`}
        />
      </div>

      <div className="space-y-4">
        <CreativeRankingTable linhas={f.ranking} totais={f.totais} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ClassificationDistributionChart dist={f.distribuicao} />
          <WinrateByClassificationPanel dados={f.winrate} />
        </div>
        <CreativeClassificationCrossTable linhas={f.cruzamento} />
      </div>
    </div>
  )
}

/** Faixa de status da Meta Ads: sem BM / sem sincronização / sincronizado. */
function StatusMeta({ estado }: { estado: ReturnType<typeof useEstadoCriativosMeta> }) {
  const [erro, setErro] = useState<string | null>(null)

  if (estado.conectado && estado.sincronizadoEm) {
    return (
      <p className="mb-4 flex items-center gap-1.5 text-[11px] text-muted">
        <CheckCircle2 size={12} className="text-green-400" />
        Meta Ads sincronizada em {fmtDataHoraAds(estado.sincronizadoEm)}
        {estado.contaAgenciaId ? ` · ${estado.contaAgenciaId}` : ''}
      </p>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-200">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          {estado.conectado
            ? 'Criativos da Meta Ads ainda não sincronizados — o gasto por criativo aparece como "—".'
            : 'Business Manager da Meta não conectado — o gasto por criativo aparece como "—". Leads, classificação e winrate seguem normais (vêm do CRM).'}
          {erro && <span className="mt-1 block text-orange-100">{erro}</span>}
        </span>
      </div>
      {estado.conectado ? (
        <OutlineButton
          size="sm"
          onClick={() => {
            const r = simularSincronizacaoCriativos()
            setErro(r.ok ? null : r.mensagem)
          }}
        >
          <FlaskConical size={13} /> 🧪 Simular sincronização
        </OutlineButton>
      ) : (
        <Link
          to="/configuracoes?aba=integracoes"
          className="rounded-md border border-orange-500/40 px-2.5 py-1 text-[11px] font-medium text-orange-100 hover:bg-orange-500/15"
        >
          Conectar em Configurações › Integrações
        </Link>
      )}
    </div>
  )
}
