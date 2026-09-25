/**
 * Meta Ads da PRÓPRIA agência, por criativo (ad_id) — fonte do "gasto do
 * criativo" no Funil Tráfego (Comercial).
 *
 * Diferente da integração Meta Ads por CLIENTE (aba Meta Ads na Ficha,
 * components/ads/metaAds.ts): aqui é a conta de anúncios que capta leads PRA
 * AGÊNCIA. A conexão reaproveita o Business Manager do tenant configurado em
 * Configurações › Integrações (metaAdsAdapter.getAgencyConfig()).
 *
 * ESTRUTURA + SIMULAÇÃO: `getCriativosMetaAds` é o ÚNICO ponto a trocar pela
 * Marketing API real (insights com level=ad: spend, impressions, clicks,
 * actions[lead]). Hoje devolve mock determinístico a partir de
 * criativosReferencia.ts, e só depois de uma sincronização.
 */
import { metaAdsAdapter } from '@/components/ads/metaAds'
import type { PeriodoFiltro } from './marketingCalculator'
import {
  CRIATIVOS_REFERENCIA,
  MES_REFERENCIA_CRIATIVOS,
  gastoNaEscala,
  qualificadosNaEscala,
} from './criativosReferencia'

export interface CriativoMetaAds {
  /** null = não é anúncio (orgânico, ex.: link_in_bio) — sem gasto rastreado. */
  idAnuncioMeta: string | null
  nomeAnuncio: string
  investimento: number | null
  impressoes: number | null
  cliques: number | null
  /** % */
  ctr: number | null
  /** Leads reportados pela própria Meta (Lead Ads / pixel). */
  leadsMeta: number | null
}

export interface EstadoCriativosMeta {
  /** Business Manager do tenant conectado. */
  conectado: boolean
  contaAgenciaId?: string
  /** Última sincronização de criativos (ISO). Sem isso, não há dado. */
  sincronizadoEm?: string
}

const SYNC_KEY = 'meta-criativos-sync'
/** Evento (mesma aba) disparado quando a sincronização de criativos muda. */
export const EVENTO_SYNC_CRIATIVOS = 'meta-criativos-sync'

function lerSync(): { sincronizadoEm?: string } {
  try {
    const raw = window.localStorage.getItem(SYNC_KEY)
    return raw ? (JSON.parse(raw) as { sincronizadoEm?: string }) : {}
  } catch {
    return {}
  }
}

export function estadoCriativosMeta(): EstadoCriativosMeta {
  const bm = metaAdsAdapter.getAgencyConfig()
  return { conectado: bm.conectado, contaAgenciaId: bm.contaAgenciaId, sincronizadoEm: lerSync().sincronizadoEm }
}

// ── Mock determinístico ──────────────────────────────────────────────────────
function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return Math.abs(h)
}
const diasNoMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
/** Fração do mês coberta pelo período (1 = mês inteiro). Rateia intervalos parciais. */
function fracaoDoMes(mes: string, periodo: PeriodoFiltro): number {
  const n = diasNoMes(mes)
  let dentro = 0
  for (let d = 1; d <= n; d++) if (periodo.inPeriodo(`${mes}-${String(d).padStart(2, '0')}`)) dentro++
  return dentro / n
}
/** Variação mês a mês (o mês de referência reproduz o print). */
function fatorMes(mes: string, chave: string): number {
  if (mes === MES_REFERENCIA_CRIATIVOS) return 1
  return 0.55 + (hash(`${mes}|${chave}`) % 70) / 100
}

/**
 * Métricas por criativo no período. ÚNICO ponto a trocar pela Marketing API.
 * Vazio se o Business Manager não estiver conectado ou nunca sincronizado.
 */
export function getCriativosMetaAds(periodo: PeriodoFiltro): CriativoMetaAds[] {
  const est = estadoCriativosMeta()
  if (!est.conectado || !est.sincronizadoEm) return []

  return CRIATIVOS_REFERENCIA.map((c) => {
    if (c.idAnuncioMeta == null || c.gastoRef == null) {
      // Orgânico (link_in_bio): aparece na lista, mas sem nada rastreado pela Meta.
      return { idAnuncioMeta: null, nomeAnuncio: c.nomeAnuncio, investimento: null, impressoes: null, cliques: null, ctr: null, leadsMeta: null }
    }
    let investimento = 0
    let impressoes = 0
    let leadsMeta = 0
    for (const mes of periodo.meses) {
      const frac = fracaoDoMes(mes, periodo)
      if (frac === 0) continue
      const f = fatorMes(mes, c.idAnuncioMeta) * frac
      const gasto = (gastoNaEscala(c) ?? 0) * f
      const cpm = 18 + (hash(`${mes}|${c.idAnuncioMeta}|cpm`) % 17) // R$ 18–34 por mil
      investimento += gasto
      impressoes += (gasto / cpm) * 1000
      leadsMeta += qualificadosNaEscala(c) * 1.6 * f
    }
    const cliques = Math.round((impressoes * c.ctrRef) / 100)
    const imp = Math.round(impressoes)
    return {
      idAnuncioMeta: c.idAnuncioMeta,
      nomeAnuncio: c.nomeAnuncio,
      investimento: Math.round(investimento * 100) / 100,
      impressoes: imp,
      cliques,
      ctr: imp > 0 ? Math.round((cliques / imp) * 10000) / 100 : 0,
      leadsMeta: Math.round(leadsMeta),
    }
  })
}

/** Botão de dev em Configurações › Integrações: "Simular Sincronização de Criativos". */
export function simularSincronizacaoCriativos(): { ok: boolean; mensagem: string } {
  const est = estadoCriativosMeta()
  if (!est.conectado) {
    return { ok: false, mensagem: 'Conecte o Business Manager (bloco Meta Ads acima) antes de sincronizar os criativos.' }
  }
  const agora = new Date().toISOString()
  try {
    window.localStorage.setItem(SYNC_KEY, JSON.stringify({ sincronizadoEm: agora }))
  } catch {
    /* indisponível */
  }
  window.dispatchEvent(new Event(EVENTO_SYNC_CRIATIVOS))
  const pagos = CRIATIVOS_REFERENCIA.filter((c) => c.gastoRef != null).length
  const organicos = CRIATIVOS_REFERENCIA.length - pagos
  return {
    ok: true,
    mensagem: `Sincronizado: ${CRIATIVOS_REFERENCIA.length} criativos (${pagos} com investimento rastreado, ${organicos} sem — ex.: link_in_bio).`,
  }
}
