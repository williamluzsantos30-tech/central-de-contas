/**
 * Integração Instagram (Meta Graph API) — estado de conexão + métricas.
 *
 * PERSISTÊNCIA (migration 092): `cliente_instagram` (conexão por cliente),
 * `instagram_config` (agência) e `instagram_metricas` (histórico). FALLBACK:
 * se as tabelas não existirem, usa localStorage (não quebra).
 *
 * A conexão REAL com a Meta ainda não existe (depende da aprovação do App):
 * `getInstagramMetricsForPeriod` devolve mock determinístico — é o único ponto
 * a trocar pela Graph API real. Snapshots do mock são gravados em
 * `instagram_metricas` a cada sincronização, formando o histórico.
 *
 * Os componentes leem de forma SÍNCRONA (getInstagramState/getAgencyConfig):
 * um cache em memória é populado por `loadInstagramCache()` (chamado no mount);
 * as escritas atualizam o cache e persistem async no banco (ou localStorage).
 */
import { supabase } from '@/lib/supabase'

export type ModoConexaoInstagram = 'direta' | 'agencia' | 'nao_conectado'
export type TokenStatus = 'valido' | 'expirado' | 'revogado'

export interface ClienteInstagram {
  handle: string
  modoConexao: ModoConexaoInstagram
  contaConectadaEm?: string
  ultimaSincronizacao?: string
  tokenStatus?: TokenStatus
}
export type TipoPost = 'reels' | 'carrossel' | 'feed' | 'stories'
export interface PostInstagram {
  id: string
  tipo: TipoPost
  dataPublicacao: string // "YYYY-MM-DD"
  thumbnailUrl?: string
  alcance: number
  curtidas: number
  comentarios: number
  salvamentos: number
  taxaEngajamento: number // % = (curtidas+comentarios+salvamentos)/alcance
}

export interface MetricasInstagram {
  clienteId: string
  periodo: string
  postsPublicados: number
  alcanceMedio: number
  seguidores: number
  seguidoresVariacao: number
  engajamentoMedio: number
  posts: PostInstagram[]
  fonteDado: 'api_instagram' | 'manual'
  sincronizadoEm?: string
}
export interface AgencyInstagramConfig {
  conectado: boolean
  businessManager?: string
  conectadoEm?: string
}

const CONN_KEY = 'ig-conn'
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
    /* indisponível */
  }
}

// ── Cache em memória (fonte síncrona pros componentes) ───────────────────────
let connCache: Record<string, ClienteInstagram> | null = null
let agencyCache: AgencyInstagramConfig | null = null
let modoBanco = true
let loadPromise: Promise<void> | null = null

type ConnRow = {
  cliente_id: string
  handle: string
  modo_conexao: string
  conta_conectada_em: string | null
  ultima_sincronizacao: string | null
  token_status: string | null
}
const rowToConn = (r: ConnRow): ClienteInstagram => ({
  handle: r.handle,
  modoConexao: r.modo_conexao as ModoConexaoInstagram,
  contaConectadaEm: r.conta_conectada_em ?? undefined,
  ultimaSincronizacao: r.ultima_sincronizacao ?? undefined,
  tokenStatus: (r.token_status as TokenStatus) ?? undefined,
})
const connToRow = (clienteId: string, s: ClienteInstagram) => ({
  cliente_id: clienteId,
  handle: s.handle,
  modo_conexao: s.modoConexao,
  conta_conectada_em: s.contaConectadaEm ?? null,
  ultima_sincronizacao: s.ultimaSincronizacao ?? null,
  token_status: s.tokenStatus ?? null,
})

/** Carrega conexões + config no cache. 1x (idempotente). Fallback localStorage. */
export function loadInstagramCache(force = false): Promise<void> {
  if (loadPromise && !force) return loadPromise
  loadPromise = (async () => {
    try {
      const [cRes, cfgRes] = await Promise.all([
        supabase.from('cliente_instagram').select('*'),
        supabase.from('instagram_config').select('*').eq('id', 'default').maybeSingle(),
      ])
      if (cRes.error || cfgRes.error) throw cRes.error ?? cfgRes.error
      modoBanco = true
      const map: Record<string, ClienteInstagram> = {}
      for (const r of (cRes.data as ConnRow[]) ?? []) map[r.cliente_id] = rowToConn(r)
      connCache = map
      agencyCache = cfgRes.data
        ? {
            conectado: !!(cfgRes.data as { conectado: boolean }).conectado,
            businessManager: (cfgRes.data as { business_manager: string | null }).business_manager ?? undefined,
            conectadoEm: (cfgRes.data as { conectado_em: string | null }).conectado_em ?? undefined,
          }
        : { conectado: false }
    } catch {
      modoBanco = false
      connCache = readJSON<Record<string, ClienteInstagram>>(CONN_KEY, {})
      agencyCache = readJSON<AgencyInstagramConfig>(AGENCY_KEY, { conectado: false })
    }
  })()
  return loadPromise
}

function conns(): Record<string, ClienteInstagram> {
  return connCache ?? readJSON<Record<string, ClienteInstagram>>(CONN_KEY, {})
}

const nowISO = () => new Date().toISOString()

function persistConn(clienteId: string, state: ClienteInstagram) {
  const c = conns()
  c[clienteId] = state
  connCache = c
  if (modoBanco) {
    void supabase.from('cliente_instagram').upsert(connToRow(clienteId, state)).then(({ error }) => {
      if (error) console.warn('[instagram] persistConn', error.message)
    })
  } else {
    writeJSON(CONN_KEY, c)
  }
  // snapshot das métricas do período corrente (histórico)
  void persistMetricasSnapshot(clienteId)
}
function removeConn(clienteId: string) {
  const c = conns()
  delete c[clienteId]
  connCache = c
  if (modoBanco) {
    void supabase.from('cliente_instagram').delete().eq('cliente_id', clienteId).then(({ error }) => {
      if (error) console.warn('[instagram] removeConn', error.message)
    })
  } else {
    writeJSON(CONN_KEY, c)
  }
}

// ── Estado por cliente (leitura síncrona) ────────────────────────────────────
export function getInstagramState(clienteId: string): ClienteInstagram {
  return conns()[clienteId] ?? NAO_CONECTADO
}
export function conectarDireta(clienteId: string, handle: string): ClienteInstagram {
  const s: ClienteInstagram = { handle: handle.replace(/^@/, ''), modoConexao: 'direta', contaConectadaEm: nowISO(), ultimaSincronizacao: nowISO(), tokenStatus: 'valido' }
  persistConn(clienteId, s)
  return s
}
export function vincularAgencia(clienteId: string, handle: string): ClienteInstagram {
  const s: ClienteInstagram = { handle: handle.replace(/^@/, ''), modoConexao: 'agencia', contaConectadaEm: nowISO(), ultimaSincronizacao: nowISO() }
  persistConn(clienteId, s)
  return s
}
export function desconectarInstagram(clienteId: string): ClienteInstagram {
  removeConn(clienteId)
  return { ...NAO_CONECTADO }
}
export function simularSincronizacao(clienteId: string): ClienteInstagram {
  const cur = getInstagramState(clienteId)
  if (cur.modoConexao === 'nao_conectado') return cur
  const s: ClienteInstagram = { ...cur, ultimaSincronizacao: nowISO(), tokenStatus: cur.modoConexao === 'direta' ? 'valido' : cur.tokenStatus }
  persistConn(clienteId, s)
  return s
}
export function simularTokenExpirado(clienteId: string): ClienteInstagram {
  const cur = getInstagramState(clienteId)
  if (cur.modoConexao !== 'direta') return cur
  const s: ClienteInstagram = { ...cur, tokenStatus: 'expirado', ultimaSincronizacao: new Date(Date.now() - 12 * 86_400_000).toISOString() }
  const c = conns()
  c[clienteId] = s
  connCache = c
  if (modoBanco) void supabase.from('cliente_instagram').upsert(connToRow(clienteId, s))
  else writeJSON(CONN_KEY, c)
  return s
}
export function getAllInstagramConnections(): { clienteId: string; state: ClienteInstagram }[] {
  return Object.entries(conns())
    .filter(([, s]) => s.modoConexao !== 'nao_conectado')
    .map(([clienteId, state]) => ({ clienteId, state }))
}

// ── Config de agência ────────────────────────────────────────────────────────
/** Evento (mesma aba) quando a conexão de agência muda — ex.: status no painel de Integrações. */
export const EVENTO_AGENCIA_INSTAGRAM = 'instagram-agency-config'

export function getAgencyConfig(): AgencyInstagramConfig {
  return agencyCache ?? readJSON<AgencyInstagramConfig>(AGENCY_KEY, { conectado: false })
}
export function setAgencyConfig(cfg: AgencyInstagramConfig) {
  agencyCache = cfg
  window.dispatchEvent(new Event(EVENTO_AGENCIA_INSTAGRAM))
  if (modoBanco) {
    void supabase.from('instagram_config').upsert({ id: 'default', conectado: cfg.conectado, business_manager: cfg.businessManager ?? null, conectado_em: cfg.conectadoEm ?? null }).then(({ error }) => {
      if (error) console.warn('[instagram] setAgencyConfig', error.message)
    })
  } else {
    writeJSON(AGENCY_KEY, cfg)
  }
}

// ── Métricas (mock determinístico + snapshot no histórico) ───────────────────
function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return Math.abs(h)
}
function ranged(seed: number, min: number, max: number): number {
  const r = (seed % 1000) / 1000
  return Math.round(min + r * (max - min))
}
const periodoCorrente = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const TIPOS_POST: TipoPost[] = ['reels', 'carrossel', 'feed', 'stories']

function gerarPosts(clienteId: string, p: string, base: number): PostInstagram[] {
  const [y, mo] = p.split('-').map(Number)
  const n = 5 + (base % 4) // 5–8 posts
  return Array.from({ length: n }, (_, i) => {
    const ps = hash(`${base}post${i}`)
    const alcance = ranged(hash(`${ps}a`), 800, 14000)
    const curtidas = ranged(hash(`${ps}l`), 40, Math.max(80, Math.round(alcance * 0.12)))
    const comentarios = ranged(hash(`${ps}c`), 2, 130)
    const salvamentos = ranged(hash(`${ps}s`), 1, 240)
    const taxa = alcance > 0 ? ((curtidas + comentarios + salvamentos) / alcance) * 100 : 0
    const dia = 1 + (ps % 27)
    return {
      id: `${clienteId}-${p}-${i}`,
      tipo: TIPOS_POST[ps % 4],
      dataPublicacao: `${y}-${String(mo).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      alcance,
      curtidas,
      comentarios,
      salvamentos,
      taxaEngajamento: Math.round(taxa * 100) / 100,
    }
  })
}

export function getInstagramMetricsForPeriod(clienteId: string, periodo: string): MetricasInstagram | null {
  const state = getInstagramState(clienteId)
  if (state.modoConexao === 'nao_conectado') return null
  const p = periodo.slice(0, 7)
  const base = hash(`${clienteId}|${p}`)
  return {
    clienteId,
    periodo: p,
    postsPublicados: ranged(hash(`${base}posts`), 8, 22),
    alcanceMedio: ranged(hash(`${base}alc`), 2200, 16000),
    seguidores: ranged(base, 4200, 52000),
    seguidoresVariacao: ranged(hash(`${base}v`), -180, 1600),
    engajamentoMedio: Math.round(ranged(hash(`${base}eng`), 180, 820)) / 100,
    posts: gerarPosts(clienteId, p, base),
    fonteDado: 'api_instagram',
    sincronizadoEm: state.ultimaSincronizacao,
  }
}

/** Grava o snapshot do período corrente em instagram_metricas (best-effort). */
async function persistMetricasSnapshot(clienteId: string) {
  if (!modoBanco) return
  const m = getInstagramMetricsForPeriod(clienteId, periodoCorrente())
  if (!m) return
  const { error } = await supabase.from('instagram_metricas').upsert(
    {
      cliente_id: clienteId,
      periodo: m.periodo,
      posts_publicados: m.postsPublicados,
      alcance_medio: m.alcanceMedio,
      seguidores: m.seguidores,
      seguidores_variacao: m.seguidoresVariacao,
      engajamento_medio: m.engajamentoMedio,
      fonte_dado: m.fonteDado,
      sincronizado_em: m.sincronizadoEm ?? nowISO(),
    },
    { onConflict: 'cliente_id,periodo' },
  )
  if (error) console.warn('[instagram] persistMetricasSnapshot', error.message)
}

// ── Helpers de exibição ──────────────────────────────────────────────────────
export function fmtHora(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function fmtDataHora(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${fmtHora(iso)}`
}
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
