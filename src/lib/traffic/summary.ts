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
 *     resultados no Meta). O que a plataforma NÃO sabe — leads qualificados,
 *     consultas (fechamentos), procedimentos, ticket — vem do funil do cliente
 *     registrado na aba Metas (`funil`) e alimenta CAC, faturamento e ROAS.
 *     (O módulo Comercial NÃO é fonte disso: lá são os leads da própria
 *     agência; o `clienteId` de um lead é o negócio que virou cliente.)
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
  /** Leads qualificados registrados no funil do cliente; null = não informado. */
  leadsQualificados: number | null
  /** Fechamentos = Nº de consultas do funil do cliente; null = não informado. */
  conversoes: number | null
  /** (consultas × ticket consulta) + (procedimentos × ticket procedimento). */
  faturamento: number | null
  roas: number | null
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
  leadsQualificados: number | null
  /** Fechamentos (Nº de consultas). */
  conversoes: number | null
  cpl: number | null
  cac: number | null
  faturamento: number | null
  roas: number | null
}

export interface ResumoTrafegoCliente {
  periodo: { chave: string; inicio: string; fim: string }
  porPlataforma: Record<PlataformaTrafego, MetricasPlataforma>
  total: TotaisTrafego
  comparativoMesAnterior: TotaisTrafego & { variacaoPct: Record<keyof TotaisTrafego, number | null> }
  plataformasAusentes: PlataformaTrafego[]
}

/** Funil depois do clique, registrado pelo time na aba Metas (Realizado). */
export interface FunilRegistrado {
  leadsQualificados?: number | null
  consultas?: number | null
  procedimentos?: number | null
  ticketConsulta?: number | null
  ticketProcedimento?: number | null
}
export type FunilPorPlataforma = Partial<Record<PlataformaTrafego, FunilRegistrado>>

const div = (a: number | null, b: number | null) => (a != null && b ? a / b : null)

function intervalo(chave: string) {
  const [y, m] = chave.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return { chave, inicio: `${chave}-01`, fim: `${chave}-${String(ultimo).padStart(2, '0')}` }
}

function faturamentoDoFunil(f: FunilRegistrado | undefined): number | null {
  const c = f?.consultas != null && f.ticketConsulta != null ? f.consultas * f.ticketConsulta : null
  const pr = f?.procedimentos != null && f.ticketProcedimento != null ? f.procedimentos * f.ticketProcedimento : null
  return c == null && pr == null ? null : (c ?? 0) + (pr ?? 0)
}

function metricasDaPlataforma(p: PlataformaTrafego, clienteId: string, chave: string, funil?: FunilRegistrado): MetricasPlataforma {
  const m = ADAPTER_TRAFEGO[p].getMetrics(clienteId, chave)
  const investimento = m?.investimento ?? 0
  const leads = m?.conversoes ?? 0
  const conversoes = funil?.consultas ?? null
  const faturamento = faturamentoDoFunil(funil)
  return {
    conectada: !!m,
    sincronizadoEm: m?.sincronizadoEm ?? null,
    investimento,
    impressoes: m?.impressoes ?? 0,
    cliques: m?.cliques ?? 0,
    ctr: m && m.impressoes ? (m.cliques / m.impressoes) * 100 : null,
    leads,
    leadsQualificados: funil?.leadsQualificados ?? null,
    conversoes,
    faturamento,
    roas: div(faturamento, investimento),
    cpa: div(investimento, leads),
    cpl: div(investimento, leads),
    cac: div(investimento, conversoes),
  }
}

/** Soma que distingue "não informado" (todos null) de zero. */
function somaInformada(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) : null
}

function totais(por: Record<PlataformaTrafego, MetricasPlataforma>): TotaisTrafego {
  const ps = PLATAFORMAS_TRAFEGO.map((p) => por[p])
  const soma = (k: 'investimento' | 'impressoes' | 'cliques' | 'leads') => ps.reduce((s, x) => s + x[k], 0)
  const investimento = soma('investimento')
  const impressoes = soma('impressoes')
  const cliques = soma('cliques')
  const leads = soma('leads')
  const conversoes = somaInformada(ps.map((x) => x.conversoes))
  const faturamento = somaInformada(ps.map((x) => x.faturamento))
  return {
    investimento,
    impressoes,
    cliques,
    ctr: impressoes ? (cliques / impressoes) * 100 : null,
    leads,
    leadsQualificados: somaInformada(ps.map((x) => x.leadsQualificados)),
    conversoes,
    cpl: div(investimento, leads),
    cac: div(investimento, conversoes),
    faturamento,
    roas: div(faturamento, investimento),
  }
}

const variacao = (atual: number | null, anterior: number | null) => (atual != null && anterior ? ((atual - anterior) / anterior) * 100 : null)

/**
 * `periodo` = 'YYYY-MM' (ou 'YYYY-MM-DD', usa o mês). `funil` = funil registrado
 * por plataforma no período (Realizado da aba Metas); `funilAnterior` idem pro
 * mês anterior (só pro comparativo).
 */
export function getClientTrafficSummary(
  clienteId: string,
  periodo: string,
  opcoes: { funil?: FunilPorPlataforma; funilAnterior?: FunilPorPlataforma } = {},
): ResumoTrafegoCliente {
  const chave = periodo.slice(0, 7)
  const anterior = periodoAnteriorAds(chave)
  const por = {
    googleAds: metricasDaPlataforma('googleAds', clienteId, chave, opcoes.funil?.googleAds),
    metaAds: metricasDaPlataforma('metaAds', clienteId, chave, opcoes.funil?.metaAds),
  }
  const porAnt = {
    googleAds: metricasDaPlataforma('googleAds', clienteId, anterior, opcoes.funilAnterior?.googleAds),
    metaAds: metricasDaPlataforma('metaAds', clienteId, anterior, opcoes.funilAnterior?.metaAds),
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

type RealizadoFunil = {
  mensagens_qualificadas?: number | null
  numero_consultas?: number | null
  numero_procedimentos?: number | null
  tm_consulta?: number | null
  tm_procedimento?: number | null
}

/** Funil de UMA plataforma a partir do Realizado da aba Metas. */
export function funilDoRealizadoPlataforma(r: RealizadoFunil | null | undefined): FunilRegistrado {
  return {
    leadsQualificados: r?.mensagens_qualificadas ?? null,
    consultas: r?.numero_consultas ?? null,
    procedimentos: r?.numero_procedimentos ?? null,
    ticketConsulta: r?.tm_consulta ?? null,
    ticketProcedimento: r?.tm_procedimento ?? null,
  }
}

/** Funil das duas plataformas a partir do Realizado (`{ google, meta }`) da aba Metas. */
export function funilDoRealizado(
  realizado: Partial<Record<'google' | 'meta', RealizadoFunil | null | undefined>> | null | undefined,
): FunilPorPlataforma {
  return { googleAds: funilDoRealizadoPlataforma(realizado?.google), metaAds: funilDoRealizadoPlataforma(realizado?.meta) }
}

/** Rótulo "Mês de AAAA" de um período. */
export function rotuloPeriodo(periodo: string): string {
  const [y, m] = periodo.slice(0, 7).split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
