/**
 * Integração Google Ads (Google Ads API) — estado de conexão + métricas.
 *
 * ESTRUTURA + SIMULAÇÃO (mesmo padrão do mockInstagram, porém localStorage-only
 * nesta etapa — sem migration). A conexão REAL com a Google Ads API ainda não
 * existe (depende de OAuth + credenciais de desenvolvedor de CADA tenant do
 * SaaS): `getGoogleAdsMetrics` devolve mock determinístico — é o único ponto a
 * trocar pela API real, sem alterar os componentes consumidores.
 *
 * Dois modos de conexão (a Google Ads API exige OAuth + conta Manager/MCC OU
 * acesso direto à conta de anúncios):
 *   - 'direta' : o próprio cliente autoriza via OAuth a conta de anúncios dele.
 *   - 'mcc'    : a agência (tenant) tem uma conta gerenciadora (MCC) com acesso
 *                a múltiplas contas; o cliente fica elegível sem autorização
 *                individual.
 *
 * Leitura SÍNCRONA (localStorage) via um cache em memória. `loadGoogleAdsCache`
 * existe pra manter simetria de API com o Instagram (no-op resolvido aqui).
 */

export type ModoConexaoGoogleAds = 'direta' | 'mcc' | 'nao_conectado'
export type TokenStatusGA = 'valido' | 'expirado' | 'revogado'

export interface GoogleAdsConexao {
  /** ID da conta de anúncios (formato Google: "123-456-7890"). */
  contaId: string
  modo: ModoConexaoGoogleAds
  conectadoEm?: string
  ultimaSincronizacao?: string
  tokenStatus?: TokenStatusGA
}

export type StatusCampanha = 'ativa' | 'pausada' | 'removida' | 'em_revisao'
export type TipoCampanha = 'pesquisa' | 'display' | 'pmax' | 'shopping' | 'video'

export interface CampanhaGoogleAds {
  id: string
  nome: string
  tipo: TipoCampanha
  status: StatusCampanha
  /** Orçamento diário em R$. */
  orcamentoDiario: number
  /** Investimento acumulado no mês em R$. */
  investimentoMes: number
  cliques: number
  conversoes: number
}

export interface MetricasGoogleAds {
  clienteId: string
  periodo: string // YYYY-MM
  investimento: number // R$
  impressoes: number
  cliques: number
  ctr: number // %
  cpcMedio: number // R$
  conversoes: number
  cpa: number // R$ (custo por conversão)
  campanhas: CampanhaGoogleAds[]
  fonteDado: 'api_google_ads'
  sincronizadoEm?: string
}

export interface AgencyGoogleAdsConfig {
  /** MCC (conta gerenciadora) configurado pro tenant. */
  conectado: boolean
  mccId?: string
  conectadoEm?: string
}

const CONN_KEY = 'gads-conn'
const AGENCY_KEY = 'gads-agency'
const NAO_CONECTADO: GoogleAdsConexao = { contaId: '', modo: 'nao_conectado' }

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

// ── Cache em memória (fonte síncrona pros componentes) ───────────────────────
let connCache: Record<string, GoogleAdsConexao> | null = null
let agencyCache: AgencyGoogleAdsConfig | null = null

function conns(): Record<string, GoogleAdsConexao> {
  if (!connCache) connCache = readJSON<Record<string, GoogleAdsConexao>>(CONN_KEY, {})
  return connCache
}
const nowISO = () => new Date().toISOString()

function persistConn(clienteId: string, state: GoogleAdsConexao) {
  const c = conns()
  c[clienteId] = state
  connCache = c
  writeJSON(CONN_KEY, c)
}
function removeConn(clienteId: string) {
  const c = conns()
  delete c[clienteId]
  connCache = c
  writeJSON(CONN_KEY, c)
}

/** Simetria de API com o Instagram (localStorage é síncrono → resolve na hora). */
export function loadGoogleAdsCache(): Promise<void> {
  conns()
  getAgencyGoogleAdsConfig()
  return Promise.resolve()
}

// ── Estado por cliente (leitura síncrona) ────────────────────────────────────
export function getGoogleAdsState(clienteId: string): GoogleAdsConexao {
  return conns()[clienteId] ?? NAO_CONECTADO
}
export function conectarDireta(clienteId: string, contaId: string): GoogleAdsConexao {
  const s: GoogleAdsConexao = {
    contaId: contaId.trim(),
    modo: 'direta',
    conectadoEm: nowISO(),
    ultimaSincronizacao: nowISO(),
    tokenStatus: 'valido',
  }
  persistConn(clienteId, s)
  return s
}
export function vincularMcc(clienteId: string, contaId: string): GoogleAdsConexao {
  const s: GoogleAdsConexao = {
    contaId: contaId.trim(),
    modo: 'mcc',
    conectadoEm: nowISO(),
    ultimaSincronizacao: nowISO(),
    tokenStatus: 'valido',
  }
  persistConn(clienteId, s)
  return s
}
export function desconectarGoogleAds(clienteId: string): GoogleAdsConexao {
  removeConn(clienteId)
  return { ...NAO_CONECTADO }
}
export function simularSincronizacaoGA(clienteId: string): GoogleAdsConexao {
  const cur = getGoogleAdsState(clienteId)
  if (cur.modo === 'nao_conectado') return cur
  const s: GoogleAdsConexao = { ...cur, ultimaSincronizacao: nowISO(), tokenStatus: 'valido' }
  persistConn(clienteId, s)
  return s
}
export function simularTokenExpiradoGA(clienteId: string): GoogleAdsConexao {
  const cur = getGoogleAdsState(clienteId)
  if (cur.modo === 'nao_conectado') return cur
  const s: GoogleAdsConexao = {
    ...cur,
    tokenStatus: 'expirado',
    ultimaSincronizacao: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  }
  persistConn(clienteId, s)
  return s
}
export function getAllGoogleAdsConnections(): { clienteId: string; state: GoogleAdsConexao }[] {
  return Object.entries(conns())
    .filter(([, s]) => s.modo !== 'nao_conectado')
    .map(([clienteId, state]) => ({ clienteId, state }))
}

// ── Config de agência (MCC) ──────────────────────────────────────────────────
export function getAgencyGoogleAdsConfig(): AgencyGoogleAdsConfig {
  if (!agencyCache) agencyCache = readJSON<AgencyGoogleAdsConfig>(AGENCY_KEY, { conectado: false })
  return agencyCache
}
export function setAgencyGoogleAdsConfig(cfg: AgencyGoogleAdsConfig) {
  agencyCache = cfg
  writeJSON(AGENCY_KEY, cfg)
}

// ── Métricas (mock determinístico) ───────────────────────────────────────────
function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return Math.abs(h)
}
function ranged(seed: number, min: number, max: number): number {
  const r = (seed % 1000) / 1000
  return Math.round(min + r * (max - min))
}

const TIPOS_CAMPANHA: TipoCampanha[] = ['pesquisa', 'display', 'pmax', 'shopping', 'video']
const NOMES_CAMPANHA = [
  'Pesquisa · Marca',
  'Pesquisa · Concorrentes',
  'PMax · Conversões',
  'Display · Remarketing',
  'Shopping · Catálogo',
  'Vídeo · Awareness',
]

function gerarCampanhas(clienteId: string, p: string, base: number, investimentoTotal: number): CampanhaGoogleAds[] {
  const n = 3 + (base % 3) // 3–5 campanhas
  const pesos = Array.from({ length: n }, (_, i) => 1 + (hash(`${base}w${i}`) % 5))
  const somaPesos = pesos.reduce((s, w) => s + w, 0)
  return Array.from({ length: n }, (_, i) => {
    const cs = hash(`${base}camp${i}`)
    const statusRoll = cs % 10
    const status: StatusCampanha =
      statusRoll < 6 ? 'ativa' : statusRoll < 8 ? 'pausada' : statusRoll < 9 ? 'em_revisao' : 'removida'
    const investimentoMes = Math.round((investimentoTotal * pesos[i]) / somaPesos)
    const cliques = ranged(hash(`${cs}cl`), 40, 2200)
    const conversoes = ranged(hash(`${cs}cv`), 0, Math.max(2, Math.round(cliques * 0.08)))
    return {
      id: `${clienteId}-${p}-camp${i}`,
      nome: NOMES_CAMPANHA[cs % NOMES_CAMPANHA.length],
      tipo: TIPOS_CAMPANHA[cs % TIPOS_CAMPANHA.length],
      status,
      orcamentoDiario: ranged(hash(`${cs}orc`), 30, 400),
      investimentoMes,
      cliques,
      conversoes,
    }
  })
}

/**
 * Métricas do período pra um cliente conectado. `null` se não conectado.
 * Determinístico por (clienteId, período) — o mesmo mês sempre gera os mesmos
 * números. É o ÚNICO ponto a trocar pela chamada real à Google Ads API.
 */
export function getGoogleAdsMetrics(clienteId: string, periodo: string): MetricasGoogleAds | null {
  const state = getGoogleAdsState(clienteId)
  if (state.modo === 'nao_conectado') return null
  const p = periodo.slice(0, 7)
  const base = hash(`${clienteId}|${p}`)

  const investimento = ranged(hash(`${base}inv`), 1800, 24000)
  const impressoes = ranged(hash(`${base}imp`), 40000, 900000)
  const cliques = ranged(hash(`${base}cli`), 400, 22000)
  const ctr = impressoes > 0 ? Math.round((cliques / impressoes) * 10000) / 100 : 0
  const cpcMedio = cliques > 0 ? Math.round((investimento / cliques) * 100) / 100 : 0
  const conversoes = ranged(hash(`${base}cv`), 8, Math.max(16, Math.round(cliques * 0.06)))
  const cpa = conversoes > 0 ? Math.round((investimento / conversoes) * 100) / 100 : 0

  return {
    clienteId,
    periodo: p,
    investimento,
    impressoes,
    cliques,
    ctr,
    cpcMedio,
    conversoes,
    cpa,
    campanhas: gerarCampanhas(clienteId, p, base, investimento),
    fonteDado: 'api_google_ads',
    sincronizadoEm: state.ultimaSincronizacao,
  }
}

/** Período YYYY-MM anterior a um dado 'YYYY-MM' (pra comparação MoM). */
export function periodoAnteriorGA(periodo: string): string {
  const [y, m] = periodo.slice(0, 7).split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Helpers de exibição ──────────────────────────────────────────────────────
export function fmtDataHoraGA(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
export function diasAtrasGA(iso?: string): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export const modoConexaoGaLabel: Record<ModoConexaoGoogleAds, string> = {
  direta: 'Conexão Direta',
  mcc: 'Via Conta Gerenciadora (MCC)',
  nao_conectado: 'Não conectado',
}
export const tokenStatusGaLabel: Record<TokenStatusGA, string> = {
  valido: 'Válido',
  expirado: 'Expirado',
  revogado: 'Revogado',
}
export const statusCampanhaLabel: Record<StatusCampanha, string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  em_revisao: 'Em revisão',
  removida: 'Removida',
}
export const tipoCampanhaLabel: Record<TipoCampanha, string> = {
  pesquisa: 'Pesquisa',
  display: 'Display',
  pmax: 'Performance Max',
  shopping: 'Shopping',
  video: 'Vídeo',
}
