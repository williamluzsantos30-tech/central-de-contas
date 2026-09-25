/**
 * Plataformas de anúncio (Google Ads, Meta Ads, …) — contrato genérico.
 *
 * Cada plataforma é um ADAPTER (googleAds.ts, metaAds.ts) consumido pelos
 * MESMOS componentes genéricos: AdsPlatformPanel (aba na Ficha),
 * AdsConnectionCard, AdsPerformanceKpis, AdsCampaignsTable e AgencyAdsSettings
 * (Configurações › Integrações). Nova plataforma = novo adapter, zero UI nova.
 *
 * ESTRUTURA + SIMULAÇÃO (mesmo padrão da integração Instagram): nenhuma
 * chamada real de API. Em cada adapter, `getMetrics` é o ÚNICO ponto a trocar
 * pela API real (Google Ads API / Meta Marketing API) — os componentes não
 * mudam. Persistência mock em localStorage (sem migration nesta etapa).
 *
 * Modos de conexão (iguais nas duas plataformas, só muda o nome da conta de
 * agência):
 *   - 'direta'  : o próprio cliente autoriza (OAuth / Login do Facebook) a
 *                 conta de anúncios dele.
 *   - 'agencia' : o tenant (agência) tem uma conta de agência — MCC no Google,
 *                 Business Manager no Meta — com acesso às contas dos clientes;
 *                 o cliente fica elegível sem autorização individual.
 */
import type { LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { TipoOtimizacao } from '@/types/database'

export type AdsPlatformKey = 'google_ads' | 'meta_ads'
export type ModoConexaoAds = 'direta' | 'agencia' | 'nao_conectado'
export type TokenStatusAds = 'valido' | 'expirado' | 'revogado'
export type StatusCampanhaAds = 'ativa' | 'pausada' | 'em_revisao' | 'removida'

export interface AdsConexao {
  /** ID da conta de anúncios (Google "123-456-7890" / Meta "act_123…"). */
  contaId: string
  modo: ModoConexaoAds
  conectadoEm?: string
  ultimaSincronizacao?: string
  tokenStatus?: TokenStatusAds
}

export interface AdsCampanha {
  id: string
  nome: string
  /** Chave do tipo/objetivo — rótulo via adapter.tipoCampanhaLabel. */
  tipo: string
  status: StatusCampanhaAds
  orcamentoDiario: number // R$
  investimentoMes: number // R$
  impressoes: number
  cliques: number
  conversoes: number
}

/** Ação executável numa campanha (via API — simulada nesta etapa). */
export type AcaoCampanha =
  | { tipo: 'pausar' }
  | { tipo: 'reativar' }
  | { tipo: 'orcamento'; percentual: number }

/**
 * Textos das recomendações de desempenho, específicos de cada plataforma
 * (o motor de regras em campaignInsights.ts é genérico).
 */
export interface AdsDicas {
  semConversao: string
  cpaAlto: (tipoCampanha: string) => string
  tipoOtimCpaAlto: TipoOtimizacao
  ctrBaixo: (tipoCampanha: string) => string
  conversaoBaixa: string
  subentrega: (tipoCampanha: string) => string
  tipoOtimSubentrega: TipoOtimizacao
  escalar: string
  /** Só plataformas com frequência (Meta). */
  fadiga?: string
  saudavel: string
}

export interface AdsMetricas {
  clienteId: string
  periodo: string // YYYY-MM
  investimento: number // R$
  impressoes: number
  cliques: number
  ctr: number // %
  cpcMedio: number // R$
  conversoes: number
  cpa: number // R$ (custo por conversão / resultado)
  /** Só Meta Ads (Google não expõe "alcance" no mesmo sentido). */
  alcance?: number
  frequencia?: number
  cpm?: number // R$
  campanhas: AdsCampanha[]
  sincronizadoEm?: string
}

export interface AdsAgencyConfig {
  /** Conta de agência (MCC / Business Manager) configurada pro tenant. */
  conectado: boolean
  contaAgenciaId?: string
  conectadoEm?: string
}

export type FormatoKpi = 'moeda' | 'numero' | 'pct' | 'decimal'

export interface AdsKpiDef {
  key: string
  label: string
  icon: LucideIcon
  formato: FormatoKpi
  /** Direção favorável pra comparação MoM (CPC/CPA/CPM: 'menor'). */
  direcao: 'maior' | 'menor'
  /** Métrica-resultado (conversões) — valor em verde. */
  destaque?: boolean
  valor: (m: AdsMetricas) => number | undefined
}

export interface AdsPlatformTextos {
  modoDiretaLabel: string
  modoAgenciaLabel: string
  botaoDireta: string
  botaoAgencia: string
  /** Nome longo da conta de agência — "Conta Gerenciadora (MCC)" / "Business Manager (BM)". */
  agenciaNome: string
  agenciaSigla: string
  agenciaDefaultId: string
  contaPlaceholder: string
  descricaoIntegracao: string
  descricaoDireta: string
  descricaoAgencia: (nomeCliente: string) => string
  tituloConfig: string
  descricaoConfig: string
  notaApiReal: string
  /** Cabeçalhos da tabela de campanhas. */
  tipoColuna: string
  conversoesColuna: string
  /** "CPA" (Google) / "Custo por resultado" (Meta). */
  cpaLabel: string
}

export interface AdsPlatformCores {
  /** Cor de texto de marca (ícones, ID da conta). */
  texto: string
  /** Fundo da caixa do ícone. */
  fundoIcone: string
  /** Classes do badge da plataforma (borda + fundo + texto). */
  badge: string
}

export interface AdsConnectionStore {
  loadCache: () => Promise<void>
  getState: (clienteId: string) => AdsConexao
  conectarDireta: (clienteId: string, contaId: string) => AdsConexao
  vincularAgencia: (clienteId: string, contaId: string) => AdsConexao
  desconectar: (clienteId: string) => AdsConexao
  simularSincronizacao: (clienteId: string) => AdsConexao
  simularTokenExpirado: (clienteId: string) => AdsConexao
  getAllConnections: () => { clienteId: string; state: AdsConexao }[]
  getAgencyConfig: () => AdsAgencyConfig
  setAgencyConfig: (cfg: AdsAgencyConfig) => void
  /** Executa uma ação na campanha (simulado: grava override em localStorage). */
  aplicarAcaoCampanha: (campanha: AdsCampanha, acao: AcaoCampanha) => void
  /** Aplica as ações já executadas (status/orçamento) sobre as campanhas geradas. */
  comOverrides: (campanhas: AdsCampanha[]) => AdsCampanha[]
}

export interface AdsPlatformAdapter extends AdsConnectionStore {
  key: AdsPlatformKey
  nome: string
  icon: LucideIcon
  cores: AdsPlatformCores
  textos: AdsPlatformTextos
  kpis: AdsKpiDef[]
  dicas: AdsDicas
  tipoCampanhaLabel: (tipo: string) => string
  /** ÚNICO ponto a trocar pela API real. `null` se o cliente não está conectado. */
  getMetrics: (clienteId: string, periodo: string) => AdsMetricas | null
}

// ── Store de conexão (localStorage + cache em memória) ───────────────────────
const NAO_CONECTADO: AdsConexao = { contaId: '', modo: 'nao_conectado' }

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, val: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* indisponível */
  }
}

/** Aceita dados antigos do Google Ads (modo 'mcc' → 'agencia'). */
function normalizeConn(raw: unknown): AdsConexao | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Omit<Partial<AdsConexao>, 'modo'> & { modo?: string }
  const modo = r.modo === 'mcc' ? 'agencia' : r.modo
  if (modo !== 'direta' && modo !== 'agencia') return null
  return {
    contaId: r.contaId ?? '',
    modo,
    conectadoEm: r.conectadoEm,
    ultimaSincronizacao: r.ultimaSincronizacao,
    tokenStatus: r.tokenStatus,
  }
}

type CampanhaOverride = { status?: StatusCampanhaAds; orcamentoDiario?: number; atualizadoEm: string }

export function createAdsConnectionStore(opts: { connKey: string; agencyKey: string }): AdsConnectionStore {
  let connCache: Record<string, AdsConexao> | null = null
  let agencyCache: AdsAgencyConfig | null = null
  let ovCache: Record<string, CampanhaOverride> | null = null
  const ovKey = `${opts.connKey}-campanhas`
  const nowISO = () => new Date().toISOString()

  function overrides(): Record<string, CampanhaOverride> {
    if (!ovCache) ovCache = readJSON<Record<string, CampanhaOverride>>(ovKey, {})
    return ovCache
  }

  function conns(): Record<string, AdsConexao> {
    if (!connCache) {
      const raw = readJSON<Record<string, unknown>>(opts.connKey, {})
      const map: Record<string, AdsConexao> = {}
      for (const [id, v] of Object.entries(raw)) {
        const c = normalizeConn(v)
        if (c) map[id] = c
      }
      connCache = map
    }
    return connCache
  }
  function persist(clienteId: string, state: AdsConexao) {
    const c = conns()
    c[clienteId] = state
    writeJSON(opts.connKey, c)
  }
  function getState(clienteId: string): AdsConexao {
    return conns()[clienteId] ?? NAO_CONECTADO
  }
  function conectar(clienteId: string, contaId: string, modo: 'direta' | 'agencia'): AdsConexao {
    const s: AdsConexao = {
      contaId: contaId.trim(),
      modo,
      conectadoEm: nowISO(),
      ultimaSincronizacao: nowISO(),
      tokenStatus: 'valido',
    }
    persist(clienteId, s)
    return s
  }
  function getAgencyConfig(): AdsAgencyConfig {
    if (!agencyCache) {
      const raw = readJSON<AdsAgencyConfig & { mccId?: string }>(opts.agencyKey, { conectado: false })
      agencyCache = {
        conectado: !!raw.conectado,
        contaAgenciaId: raw.contaAgenciaId ?? raw.mccId,
        conectadoEm: raw.conectadoEm,
      }
    }
    return agencyCache
  }

  return {
    // localStorage é síncrono — mantém a assinatura async pra futura troca por banco.
    loadCache: () => {
      conns()
      getAgencyConfig()
      return Promise.resolve()
    },
    getState,
    conectarDireta: (clienteId, contaId) => conectar(clienteId, contaId, 'direta'),
    vincularAgencia: (clienteId, contaId) => conectar(clienteId, contaId, 'agencia'),
    desconectar: (clienteId) => {
      const c = conns()
      delete c[clienteId]
      writeJSON(opts.connKey, c)
      return { ...NAO_CONECTADO }
    },
    simularSincronizacao: (clienteId) => {
      const cur = getState(clienteId)
      if (cur.modo === 'nao_conectado') return cur
      const s: AdsConexao = { ...cur, ultimaSincronizacao: nowISO(), tokenStatus: 'valido' }
      persist(clienteId, s)
      return s
    },
    simularTokenExpirado: (clienteId) => {
      const cur = getState(clienteId)
      if (cur.modo === 'nao_conectado') return cur
      const s: AdsConexao = {
        ...cur,
        tokenStatus: 'expirado',
        ultimaSincronizacao: new Date(Date.now() - 9 * 86_400_000).toISOString(),
      }
      persist(clienteId, s)
      return s
    },
    getAllConnections: () =>
      Object.entries(conns())
        .filter(([, s]) => s.modo !== 'nao_conectado')
        .map(([clienteId, state]) => ({ clienteId, state })),
    getAgencyConfig,
    setAgencyConfig: (cfg) => {
      agencyCache = cfg
      writeJSON(opts.agencyKey, cfg)
    },
    aplicarAcaoCampanha: (campanha, acao) => {
      const ov = overrides()
      const atual: CampanhaOverride = { ...(ov[campanha.id] ?? {}), atualizadoEm: nowISO() }
      if (acao.tipo === 'pausar') atual.status = 'pausada'
      else if (acao.tipo === 'reativar') atual.status = 'ativa'
      else atual.orcamentoDiario = Math.max(1, Math.round(campanha.orcamentoDiario * (1 + acao.percentual / 100)))
      ov[campanha.id] = atual
      writeJSON(ovKey, ov)
    },
    comOverrides: (campanhas) => {
      const ov = overrides()
      return campanhas.map((c) => {
        const o = ov[c.id]
        if (!o) return c
        return { ...c, status: o.status ?? c.status, orcamentoDiario: o.orcamentoDiario ?? c.orcamentoDiario }
      })
    },
  }
}

// ── Helpers de mock determinístico ───────────────────────────────────────────
export function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return Math.abs(h)
}
/**
 * Hash com boa dispersão (djb2 + finalizador do murmur3). O `hash` puro espalha
 * mal strings que diferem só no fim ("…ctr0" / "…ctr1" davam quase o mesmo
 * valor) — usado nos fatores por campanha pra elas variarem de verdade.
 * (Métricas da conta seguem com `hash`, pra não mudar os números já exibidos.)
 */
export function seed(str: string): number {
  let h = hash(str)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}
export function ranged(seed: number, min: number, max: number): number {
  const r = (seed % 1000) / 1000
  return Math.round(min + r * (max - min))
}

export interface TemplateCampanha {
  nome: string
  tipo: string
}

/** Rateia `total` proporcionalmente aos pesos (inteiros; soma bate com o total). */
function ratear(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((s, w) => s + w, 0)
  if (soma <= 0) return pesos.map(() => 0)
  const partes = pesos.map((w) => Math.floor((total * w) / soma))
  let resto = total - partes.reduce((s, v) => s + v, 0)
  for (let i = 0; resto > 0 && pesos.length > 0; i = (i + 1) % pesos.length) {
    if (pesos[i] > 0) {
      partes[i]++
      resto--
    }
  }
  return partes
}

/**
 * Campanhas mock coerentes com a conta: 3–5 campanhas de templates distintos
 * (nome bate com o tipo), que SOMAM os totais da conta (investimento,
 * impressões, cliques, conversões). CTR, taxa de conversão e ritmo de gasto
 * variam por campanha — é o que dá material pro diagnóstico de desempenho.
 */
export function gerarCampanhasMock(args: {
  clienteId: string
  periodo: string
  base: number
  totais: { investimento: number; impressoes: number; cliques: number; conversoes: number }
  templates: readonly TemplateCampanha[]
}): AdsCampanha[] {
  const { clienteId, periodo, base, totais, templates } = args
  const n = Math.min(templates.length, 3 + (base % 3))
  const escolhidos = templates
    .map((t, i) => ({ t, k: seed(`${base}tpl${i}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((x) => x.t)

  const pesoGasto = escolhidos.map((_, i) => 1 + (seed(`${base}w${i}`) % 5))
  const fatorCtr = escolhidos.map((_, i) => 0.55 + (seed(`${base}ctr${i}`) % 100) / 100) // 0,55–1,54
  const fatorConv = escolhidos.map((_, i) =>
    seed(`${base}z${i}`) % 11 === 0 ? 0 : 0.35 + (seed(`${base}cv${i}`) % 130) / 100, // 0 ou 0,35–1,64
  )

  const investimento = ratear(totais.investimento, pesoGasto)
  const impressoes = ratear(totais.impressoes, pesoGasto)
  const cliques = ratear(totais.cliques, impressoes.map((imp, i) => imp * fatorCtr[i]))
  const conversoes = ratear(totais.conversoes, cliques.map((cl, i) => cl * fatorConv[i]))
  const dias = diasDecorridosNoPeriodo(periodo)

  return escolhidos.map((tpl, i) => {
    const roll = seed(`${base}camp${i}`) % 10
    const status: StatusCampanhaAds =
      roll < 6 ? 'ativa' : roll < 8 ? 'pausada' : roll < 9 ? 'em_revisao' : 'removida'
    // Ritmo de entrega 45%–102% do orçamento → orçamento diário coerente com o gasto.
    const utilizacao = 0.45 + (seed(`${base}u${i}`) % 58) / 100
    return {
      id: `${clienteId}-${periodo}-camp${i}`,
      nome: tpl.nome,
      tipo: tpl.tipo,
      status,
      orcamentoDiario: Math.max(20, Math.round(investimento[i] / (dias * utilizacao))),
      investimentoMes: investimento[i],
      impressoes: impressoes[i],
      cliques: cliques[i],
      conversoes: conversoes[i],
    }
  })
}

/** Dias já decorridos do período (mês corrente = dia de hoje; passado = mês inteiro). */
export function diasDecorridosNoPeriodo(periodo: string): number {
  const [y, m] = periodo.slice(0, 7).split('-').map(Number)
  const hoje = new Date()
  if (hoje.getFullYear() === y && hoje.getMonth() + 1 === m) return Math.max(1, hoje.getDate())
  return new Date(y, m, 0).getDate()
}

// ── Helpers de período e exibição ────────────────────────────────────────────
export function periodoAtualAds(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function periodoAnteriorAds(periodo: string): string {
  const [y, m] = periodo.slice(0, 7).split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function fmtDataHoraAds(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
export function diasAtrasAds(iso?: string): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}
export function formatKpi(valor: number, formato: FormatoKpi): string {
  switch (formato) {
    case 'moeda':
      return formatCurrency(valor)
    case 'pct':
      return `${valor.toFixed(2).replace('.', ',')}%`
    case 'decimal':
      return valor.toFixed(2).replace('.', ',')
    default:
      return new Intl.NumberFormat('pt-BR').format(Math.round(valor))
  }
}

export const statusCampanhaLabel: Record<StatusCampanhaAds, string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  em_revisao: 'Em revisão',
  removida: 'Removida',
}
export const statusCampanhaTone: Record<StatusCampanhaAds, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ativa: 'success',
  pausada: 'neutral',
  em_revisao: 'warning',
  removida: 'danger',
}
export const tokenStatusLabel: Record<TokenStatusAds, string> = {
  valido: 'Válido',
  expirado: 'Expirado',
  revogado: 'Revogado',
}
export function modoConexaoLabel(adapter: AdsPlatformAdapter, modo: ModoConexaoAds): string {
  if (modo === 'direta') return adapter.textos.modoDiretaLabel
  if (modo === 'agencia') return adapter.textos.modoAgenciaLabel
  return 'Não conectado'
}
