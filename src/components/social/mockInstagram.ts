/**
 * Integração Instagram (Meta Graph API) — ESTRUTURA + SIMULAÇÃO.
 *
 * Nenhuma chamada real à Meta API é feita aqui: a conexão real depende da
 * aprovação do App pela Meta. Toda a estrutura (dois modos de conexão,
 * métricas automáticas, expiração de token) fica pronta — quando o App for
 * aprovado, basta trocar `getInstagramMetricsForPeriod` por uma chamada real
 * à Graph API, sem mexer nos componentes que a consomem.
 *
 * Persistência da SIMULAÇÃO: localStorage (por navegador), pra o estado de
 * conexão sobreviver a reloads durante a demo. Mesmo espírito mock das
 * integrações de CRM e Financeiro.
 */

export type ModoConexaoInstagram = 'direta' | 'agencia' | 'nao_conectado'
export type TokenStatus = 'valido' | 'expirado' | 'revogado'

/** Estado de conexão do Instagram de um cliente (espelha Cliente.instagram do spec). */
export interface ClienteInstagram {
  handle: string
  modoConexao: ModoConexaoInstagram
  contaConectadaEm?: string // ISO
  ultimaSincronizacao?: string // ISO
  tokenStatus?: TokenStatus // relevante no Modo A (token OAuth expira)
}

/** Métricas puxadas da API (mês a mês) — entidade separada do Cliente. */
export interface MetricasInstagram {
  clienteId: string
  periodo: string // "YYYY-MM"
  postsPublicados: number
  alcanceMedio: number
  seguidores: number
  seguidoresVariacao: number // vs. mês anterior
  engajamentoMedio: number // %
  fonteDado: 'api_instagram' | 'manual'
  sincronizadoEm?: string
}

/** Conexão a nível de AGÊNCIA (Business Manager da Meta) — configurada 1x. */
export interface AgencyInstagramConfig {
  conectado: boolean
  businessManager?: string
  conectadoEm?: string
}

const CONN_KEY = 'ig-conn' // Record<clienteId, ClienteInstagram>
const AGENCY_KEY = 'ig-agency'
const NAO_CONECTADO: ClienteInstagram = { handle: '', modoConexao: 'nao_conectado' }

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
    /* indisponível — segue só em memória do render atual */
  }
}

// ── Estado por cliente ───────────────────────────────────────────────────────
function allConns(): Record<string, ClienteInstagram> {
  return readJSON<Record<string, ClienteInstagram>>(CONN_KEY, {})
}
export function getInstagramState(clienteId: string): ClienteInstagram {
  return allConns()[clienteId] ?? NAO_CONECTADO
}
function setInstagramState(clienteId: string, state: ClienteInstagram) {
  const map = allConns()
  map[clienteId] = state
  writeJSON(CONN_KEY, map)
}

const nowISO = () => new Date().toISOString()

/** Modo A — cliente cede acesso (OAuth simulado). */
export function conectarDireta(clienteId: string, handle: string): ClienteInstagram {
  const s: ClienteInstagram = {
    handle: handle.replace(/^@/, ''),
    modoConexao: 'direta',
    contaConectadaEm: nowISO(),
    ultimaSincronizacao: nowISO(),
    tokenStatus: 'valido',
  }
  setInstagramState(clienteId, s)
  return s
}
/** Modo B — cliente sob o Business Manager da agência. */
export function vincularAgencia(clienteId: string, handle: string): ClienteInstagram {
  const s: ClienteInstagram = {
    handle: handle.replace(/^@/, ''),
    modoConexao: 'agencia',
    contaConectadaEm: nowISO(),
    ultimaSincronizacao: nowISO(),
  }
  setInstagramState(clienteId, s)
  return s
}
export function desconectarInstagram(clienteId: string): ClienteInstagram {
  setInstagramState(clienteId, { ...NAO_CONECTADO })
  return { ...NAO_CONECTADO }
}
/** Simula uma sincronização: atualiza o carimbo de última sync (revalida token). */
export function simularSincronizacao(clienteId: string): ClienteInstagram {
  const cur = getInstagramState(clienteId)
  if (cur.modoConexao === 'nao_conectado') return cur
  const s: ClienteInstagram = { ...cur, ultimaSincronizacao: nowISO(), tokenStatus: cur.modoConexao === 'direta' ? 'valido' : cur.tokenStatus }
  setInstagramState(clienteId, s)
  return s
}
/** Dev/simulação: força o token do Modo A como expirado. */
export function simularTokenExpirado(clienteId: string): ClienteInstagram {
  const cur = getInstagramState(clienteId)
  if (cur.modoConexao !== 'direta') return cur
  // Última sync há 12 dias, token expirado.
  const s: ClienteInstagram = { ...cur, tokenStatus: 'expirado', ultimaSincronizacao: new Date(Date.now() - 12 * 86_400_000).toISOString() }
  setInstagramState(clienteId, s)
  return s
}

/** Todas as conexões ativas (pra a tabela de monitoramento em Configurações). */
export function getAllInstagramConnections(): { clienteId: string; state: ClienteInstagram }[] {
  return Object.entries(allConns())
    .filter(([, s]) => s.modoConexao !== 'nao_conectado')
    .map(([clienteId, state]) => ({ clienteId, state }))
}

// ── Config de agência ────────────────────────────────────────────────────────
export function getAgencyConfig(): AgencyInstagramConfig {
  return readJSON<AgencyInstagramConfig>(AGENCY_KEY, { conectado: false })
}
export function setAgencyConfig(cfg: AgencyInstagramConfig) {
  writeJSON(AGENCY_KEY, cfg)
}

// ── Métricas (mock determinístico por cliente+período) ───────────────────────
/** Hash simples e estável (djb2) pra gerar métricas plausíveis e reproduzíveis. */
function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return Math.abs(h)
}
function ranged(seed: number, min: number, max: number): number {
  const r = (seed % 1000) / 1000
  return Math.round(min + r * (max - min))
}

/**
 * Fonte ÚNICA das métricas automáticas. Hoje devolve mock; no futuro, troca
 * por uma chamada real à Graph API — sem alterar os componentes que consomem.
 * Retorna null quando o cliente não está conectado.
 */
export function getInstagramMetricsForPeriod(clienteId: string, periodo: string): MetricasInstagram | null {
  const state = getInstagramState(clienteId)
  if (state.modoConexao === 'nao_conectado') return null
  const p = periodo.slice(0, 7)
  const base = hash(`${clienteId}|${p}`)
  const seguidores = ranged(base, 4200, 52000)
  const seguidoresVariacao = ranged(hash(`${base}v`), -180, 1600)
  return {
    clienteId,
    periodo: p,
    postsPublicados: ranged(hash(`${base}posts`), 8, 22),
    alcanceMedio: ranged(hash(`${base}alc`), 2200, 16000),
    seguidores,
    seguidoresVariacao,
    engajamentoMedio: Math.round(ranged(hash(`${base}eng`), 180, 820)) / 100, // 1.80–8.20%
    fonteDado: 'api_instagram',
    sincronizadoEm: state.ultimaSincronizacao,
  }
}

// ── Helpers de exibição ──────────────────────────────────────────────────────
export function fmtHora(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function fmtDataHora(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${fmtHora(iso)}`
}
/** "há N dias" (pra sync desatualizada). */
export function diasAtras(iso?: string): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}
export const modoConexaoLabel: Record<ModoConexaoInstagram, string> = {
  direta: 'Conexão Direta',
  agencia: 'Via Agência',
  nao_conectado: 'Não conectado',
}
export const tokenStatusLabel: Record<TokenStatus, string> = {
  valido: 'Válido',
  expirado: 'Expirado',
  revogado: 'Revogado',
}
