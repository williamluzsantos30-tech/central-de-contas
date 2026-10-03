/**
 * FONTE ÚNICA do resumo de tráfego de um cliente num período.
 *
 * Lê das MESMAS fontes que renderizam as abas "Google Ads" e "Meta Ads"
 * (`adapter.getMetrics`) — nada de campo manual, cópia ou mock paralelo.
 * Todo bloco de resumo (Funil deste Cliente, Realizado da aba Metas, pacing
 * do cabeçalho e da lista, PDF) consome esta função: se as abas de
 * plataforma mostram R$ 7.061 + R$ 6.273, o resumo mostra R$ 13.334.
 *
 * Regras:
 *   - Derivadas (CTR, CPL, CPA, CAC) recalculadas dos TOTAIS somados —
 *     nunca média das plataformas. Divisão por zero → null (UI: "—").
 *   - Plataforma não conectada contribui com 0 e entra em `plataformasAusentes`.
 *   - "Investimento" é gasto em mídia vindo das plataformas; NUNCA a verba
 *     planejada do cliente.
 *   - Leads = resultados que a plataforma reporta (conversões no Google,
 *     resultados no Meta). Fechamentos (consultas) a plataforma não sabe:
 *     vêm do funil do cliente (aba Metas) via `fechamentos`, e alimentam o CAC.
 */
import { googleAdsAdapter } from '@/components/ads/googleAds'
import { metaAdsAdapter } from '@/components/ads/metaAds'
import { periodoAnteriorAds, type AdsPlatformAdapter } from '@/components/ads/adsPlatform'

export type PlataformaTrafego = 'googleAds' | 'metaAds'
export const PLATAFORMAS_TRAFEGO: PlataformaTrafego[] = ['googleAds', 'metaAds']

export const ADAPTER_TRAFEGO: Record<PlataformaTrafego, AdsPlatformAdapter> = {
  googleAds: googleAdsAdapter,
  metaAds: metaAdsAdapter,
}
export const NOME_PLATAFORMA_TRAFEGO: Record<PlataformaTrafego, string> = { googleAds: 'Google Ads', metaAds: 'Meta Ads' }

export interface MetricasPlataforma {
  conectada: boolean
  sincronizadoEm: string | null
  investimento: number
  impressoes: number
  cliques: number
  /** % (cliques ÷ impressões). */
  ctr: number | null
  /** Resultados reportados pela plataforma. */
  leads: number
  /** Fechamentos (consultas) do funil do cliente; null = não informado. */
  conversoes: number | null
  /** investimento ÷ leads (custo por resultado — o "CPA" das abas de plataforma). */
  cpa: number | null
  cpl: number | null
  /** investimento ÷ conversões (fechamentos). */
  cac: number | null
}

export interface TotaisTrafego {
  investimento: number
  impressoes: number
  cliques: number
  ctr: number | null
  leads: number
  conversoes: number | null
  cpl: number | null
  cac: number | null
}

export interface ResumoTrafegoCliente {
  periodo: { chave: string; inicio: string; fim: string }
  porPlataforma: Record<PlataformaTrafego, MetricasPlataforma>
  total: TotaisTrafego
  comparativoMesAnterior: TotaisTrafego & { variacaoPct: Record<keyof TotaisTrafego, number | null> }
  plataformasAusentes: PlataformaTrafego[]
}

export type Fechamentos = Partial<Record<PlataformaTrafego, number | null>>

const div = (a: number | null, b: number | null) => (a != null && b ? a / b : null)

function intervalo(chave: string) {
  const [y, m] = chave.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return { chave, inicio: `${chave}-01`, fim: `${chave}-${String(ultimo).padStart(2, '0')}` }
}

function metricasDaPlataforma(p: PlataformaTrafego, clienteId: string, chave: string, fechamentos?: number | null): MetricasPlataforma {
  const m = ADAPTER_TRAFEGO[p].getMetrics(clienteId, chave)
  const investimento = m?.investimento ?? 0
  const leads = m?.conversoes ?? 0
  const conversoes = fechamentos ?? null
  return {
    conectada: !!m,
    sincronizadoEm: m?.sincronizadoEm ?? null,
    investimento,
    impressoes: m?.impressoes ?? 0,
    cliques: m?.cliques ?? 0,
    ctr: m && m.impressoes ? (m.cliques / m.impressoes) * 100 : null,
    leads,
    conversoes,
    cpa: div(investimento, leads),
    cpl: div(investimento, leads),
    cac: div(investimento, conversoes),
  }
}

function totais(por: Record<PlataformaTrafego, MetricasPlataforma>): TotaisTrafego {
  const ps = PLATAFORMAS_TRAFEGO.map((p) => por[p])
  const soma = (k: 'investimento' | 'impressoes' | 'cliques' | 'leads') => ps.reduce((s, x) => s + x[k], 0)
  const investimento = soma('investimento')
  const impressoes = soma('impressoes')
  const cliques = soma('cliques')
  const leads = soma('leads')
  const informadas = ps.filter((x) => x.conversoes != null)
  const conversoes = informadas.length ? informadas.reduce((s, x) => s + (x.conversoes ?? 0), 0) : null
  return {
    investimento,
    impressoes,
    cliques,
    ctr: impressoes ? (cliques / impressoes) * 100 : null,
    leads,
    conversoes,
    cpl: div(investimento, leads),
    cac: div(investimento, conversoes),
  }
}

const variacao = (atual: number | null, anterior: number | null) => (atual != null && anterior ? ((atual - anterior) / anterior) * 100 : null)

/**
 * `periodo` = 'YYYY-MM' (ou 'YYYY-MM-DD', usa o mês). `fechamentos` = consultas
 * por plataforma no período (do funil da aba Metas); `fechamentosAnterior` idem
 * pro mês anterior (só pro comparativo).
 */
export function getClientTrafficSummary(
  clienteId: string,
  periodo: string,
  opcoes: { fechamentos?: Fechamentos; fechamentosAnterior?: Fechamentos } = {},
): ResumoTrafegoCliente {
  const chave = periodo.slice(0, 7)
  const anterior = periodoAnteriorAds(chave)
  const por = {
    googleAds: metricasDaPlataforma('googleAds', clienteId, chave, opcoes.fechamentos?.googleAds),
    metaAds: metricasDaPlataforma('metaAds', clienteId, chave, opcoes.fechamentos?.metaAds),
  }
  const porAnt = {
    googleAds: metricasDaPlataforma('googleAds', clienteId, anterior, opcoes.fechamentosAnterior?.googleAds),
    metaAds: metricasDaPlataforma('metaAds', clienteId, anterior, opcoes.fechamentosAnterior?.metaAds),
  }
  const total = totais(por)
  const totalAnt = totais(porAnt)
  const chaves = Object.keys(total) as (keyof TotaisTrafego)[]
  return {
    periodo: intervalo(chave),
    porPlataforma: por,
    total,
    comparativoMesAnterior: {
      ...totalAnt,
      variacaoPct: Object.fromEntries(chaves.map((k) => [k, variacao(total[k], totalAnt[k])])) as Record<keyof TotaisTrafego, number | null>,
    },
    plataformasAusentes: PLATAFORMAS_TRAFEGO.filter((p) => !por[p].conectada),
  }
}

/** Chave das metas (JSON `{ google, meta }`) ↔ plataforma do resumo. */
export const CHAVE_METAS: Record<PlataformaTrafego, 'google' | 'meta'> = { googleAds: 'google', metaAds: 'meta' }

/** Fechamentos (Nº de consultas do Realizado da aba Metas) no formato do resumo. */
export function fechamentosDoRealizado(
  realizado: Partial<Record<'google' | 'meta', { numero_consultas?: number | null } | null | undefined>> | null | undefined,
): Fechamentos {
  return {
    googleAds: realizado?.google?.numero_consultas ?? null,
    metaAds: realizado?.meta?.numero_consultas ?? null,
  }
}

/** Rótulo "Mês de AAAA" de um período. */
export function rotuloPeriodo(periodo: string): string {
  const [y, m] = periodo.slice(0, 7).split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
