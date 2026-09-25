/**
 * MetaCriativosSyncBlock — Configurações › Integrações › Tráfego / Meta Ads:
 * sincronização dos CRIATIVOS da conta de anúncios da própria agência (fonte
 * do "gasto do criativo" no Comercial › Funil Tráfego). Reaproveita o
 * Business Manager conectado no bloco acima. Tudo simulado.
 */
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FlaskConical, TrafficCone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, OutlineButton } from '@/components/ds'
import { fmtDataHoraAds } from '@/components/ads/adsPlatform'
import { simularSincronizacaoCriativos } from '@/pages/comercial/mockMetaAdsData'
import { useEstadoCriativosMeta } from '@/pages/comercial/useEstadoCriativosMeta'

export function MetaCriativosSyncBlock() {
  const estado = useEstadoCriativosMeta()
  const [aviso, setAviso] = useState<{ ok: boolean; mensagem: string } | null>(null)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-500/15 text-orange-300">
            <TrafficCone size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Criativos da agência (Funil Tráfego)</h3>
            <p className="mt-0.5 max-w-xl text-[12px] text-muted">
              Gasto, impressões e cliques por anúncio (ad_id) da conta que capta leads pra agência. Alimenta o ranking de
              criativos em{' '}
              <Link to="/comercial/funil-trafego" className="text-brand-300 underline decoration-dotted">
                Comercial › Funil Tráfego
              </Link>
              . A classificação A/B/C e o criativo de cada lead vêm do CRM (mapeamento acima).
            </p>
          </div>
        </div>
        {!estado.conectado ? (
          <Badge tone="neutral">BM não conectado</Badge>
        ) : estado.sincronizadoEm ? (
          <Badge tone="success">
            <CheckCircle2 size={11} /> Sincronizado
          </Badge>
        ) : (
          <Badge tone="warning">Nunca sincronizado</Badge>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-bg-soft/30 px-3 py-2">
          <dt className="text-muted">Business Manager</dt>
          <dd className="mt-0.5 font-medium text-zinc-200">{estado.conectado ? estado.contaAgenciaId ?? 'Conectado' : '—'}</dd>
        </div>
        <div className="rounded-lg border border-border bg-bg-soft/30 px-3 py-2">
          <dt className="text-muted">Última sincronização de criativos</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-zinc-200">{fmtDataHoraAds(estado.sincronizadoEm)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <OutlineButton size="sm" onClick={() => setAviso(simularSincronizacaoCriativos())}>
          <FlaskConical size={13} /> 🧪 Simular Sincronização de Criativos
        </OutlineButton>
        <span className="text-[11px] text-muted">Na API real: insights com level=ad (spend, impressions, clicks, leads)</span>
      </div>

      {aviso && (
        <div
          className={
            aviso.ok
              ? 'flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200'
              : 'flex items-start gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-200'
          }
        >
          {aviso.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          <span>{aviso.mensagem}</span>
        </div>
      )}
    </div>
  )
}
