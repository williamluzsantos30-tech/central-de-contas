/**
 * Landing Page — fluxo da esteira (o que não cabe nas colunas de
 * projetos_webdesign): responsável e datas por etapa, aprovações/reprovações,
 * pausas com motivo, escalação, status da URL e vínculo com o Marketing.
 *
 * A etapa atual continua sendo `projetos_webdesign.status` (Pausado inclusive);
 * o fluxo guarda a etapa em que o projeto parou pra retomar no lugar certo.
 *
 * PERSISTÊNCIA: tabela `projetos_webdesign_fluxo` (migration 096), um JSON
 * por projeto. Sem a tabela, cai no navegador (localStorage) e avisa — nada
 * quebra, mas não é compartilhado com a equipe até rodar a 096.
 */
import { supabase } from '@/lib/supabase'
import { calculateSLADeadline, diasUteisEntre } from '@/lib/dates'
import type { ProjetoWebdesign, StatusProjetoWebdesign } from '@/types/database'

export type EtapaLP = Exclude<StatusProjetoWebdesign, 'pausado'>
export type EtapaAprovacao = 'copy' | 'design'

export const ETAPAS_LP: EtapaLP[] = ['copy', 'aprovacao_copy', 'design', 'aprovacao_design', 'implementacao', 'conclusao']
export const SLA_LP_DIAS_UTEIS = 10

/** Etapa de aprovação → etapa de produção que ela aprova (e pra onde volta se reprovar). */
export const APROVACAO_DE: Partial<Record<EtapaLP, EtapaAprovacao>> = { aprovacao_copy: 'copy', aprovacao_design: 'design' }

export interface EtapaInfo {
  responsavelId?: string | null
  iniciadaEm?: string | null
  concluidaEm?: string | null
}

export interface DecisaoAprovacao {
  id: string
  etapa: EtapaAprovacao
  status: 'aprovado' | 'reprovado'
  /** "Cliente" ou o nome de quem decidiu internamente. */
  por: string
  data: string
  motivo?: string
}

export interface PausaLP {
  motivo: string
  em: string
  etapa: EtapaLP
  por?: string
  retomadoEm?: string
}

export interface EventoLP {
  tipo: 'notificacao' | 'escalado' | 'desescalado' | 'url' | 'marketing'
  em: string
  texto: string
}

export type StatusUrl = 'online' | 'offline' | 'nao_publicado'

export interface FluxoLP {
  etapas: Partial<Record<EtapaLP, EtapaInfo>>
  aprovacoes: DecisaoAprovacao[]
  /** Etapa de produção que voltou por reprovação e está em ajuste. */
  emRevisao: EtapaAprovacao | null
  pausa: PausaLP | null
  pausas: PausaLP[]
  escalado: { em: string; por: string } | null
  eventos: EventoLP[]
  statusUrl: StatusUrl | null
  urlVerificadaEm: string | null
  /** Link do design (Figma/Drive) — mostrado na Aprovação de Design. */
  designUrl: string | null
  marketing: { canal: string; url: string; vinculadoEm: string } | null
  /** Início do SLA; sem valor = criação do projeto. */
  iniciadoEm: string | null
}

export const fluxoVazio = (): FluxoLP => ({
  etapas: {},
  aprovacoes: [],
  emRevisao: null,
  pausa: null,
  pausas: [],
  escalado: null,
  eventos: [],
  statusUrl: null,
  urlVerificadaEm: null,
  designUrl: null,
  marketing: null,
  iniciadoEm: null,
})

export function normalizarFluxo(raw: unknown): FluxoLP {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FluxoLP>
  const v = fluxoVazio()
  return {
    ...v,
    ...r,
    etapas: r.etapas ?? {},
    aprovacoes: Array.isArray(r.aprovacoes) ? r.aprovacoes : [],
    pausas: Array.isArray(r.pausas) ? r.pausas : [],
    eventos: Array.isArray(r.eventos) ? r.eventos : [],
  }
}

// ── Etapa atual, responsável, SLA ───────────────────────────────────────────

export function etapaAtual(p: Pick<ProjetoWebdesign, 'status'>, f: FluxoLP): EtapaLP {
  return p.status === 'pausado' ? (f.pausa?.etapa ?? 'copy') : p.status
}

/** Responsável da etapa (o `responsavel_id` antigo do projeto vale como padrão da etapa atual). */
export function responsavelDaEtapa(p: ProjetoWebdesign, f: FluxoLP, etapa: EtapaLP): string | null {
  const r = f.etapas[etapa]?.responsavelId
  if (r !== undefined) return r ?? null
  return etapa === etapaAtual(p, f) ? p.responsavel_id : null
}

export interface SlaLP {
  inicio: Date
  prazo: Date
  diasUsados: number
  estourado: boolean
  /** Dias úteis além do SLA. */
  diasEstourado: number
  pct: number
  concluido: boolean
  pausado: boolean
}

export function slaDoProjeto(p: ProjetoWebdesign, f: FluxoLP, hoje: Date = new Date()): SlaLP {
  const inicio = new Date(f.iniciadoEm ?? p.created_at)
  const prazo = calculateSLADeadline(inicio, SLA_LP_DIAS_UTEIS)
  const diasUsados = diasUteisEntre(inicio, hoje)
  const concluido = p.status === 'conclusao'
  const pausado = p.status === 'pausado'
  const estourado = !concluido && !pausado && diasUsados > SLA_LP_DIAS_UTEIS
  return {
    inicio,
    prazo,
    diasUsados,
    estourado,
    diasEstourado: Math.max(0, diasUsados - SLA_LP_DIAS_UTEIS),
    pct: Math.min(100, Math.round((diasUsados / SLA_LP_DIAS_UTEIS) * 100)),
    concluido,
    pausado,
  }
}

// ── Transições (puras) ──────────────────────────────────────────────────────

const agoraISO = () => new Date().toISOString()
const idx = (e: EtapaLP) => ETAPAS_LP.indexOf(e)

/**
 * Move a esteira de `de` pra `para`. Avançando: as etapas deixadas pra trás
 * ganham "concluída em"; voltando: as etapas à frente são zeradas (vão ser
 * refeitas). A etapa de destino começa agora. Conclusão já nasce concluída.
 */
export function moverPara(f: FluxoLP, de: EtapaLP, para: EtapaLP, agora = agoraISO()): FluxoLP {
  const etapas = { ...f.etapas }
  const set = (e: EtapaLP, patch: EtapaInfo) => (etapas[e] = { ...(etapas[e] ?? {}), ...patch })
  if (idx(para) > idx(de)) {
    for (let i = idx(de); i < idx(para); i++) {
      const e = ETAPAS_LP[i]
      set(e, { iniciadaEm: etapas[e]?.iniciadaEm ?? agora, concluidaEm: etapas[e]?.concluidaEm ?? agora })
    }
  } else if (idx(para) < idx(de)) {
    for (let i = idx(para) + 1; i < ETAPAS_LP.length; i++) set(ETAPAS_LP[i], { iniciadaEm: null, concluidaEm: null })
  }
  if (para !== de) set(para, { iniciadaEm: agora, concluidaEm: para === 'conclusao' ? agora : null })
  // Passou da aprovação correspondente → sai do ciclo de revisão.
  const emRevisao =
    f.emRevisao && idx(para) > idx(f.emRevisao === 'copy' ? 'aprovacao_copy' : 'aprovacao_design') ? null : f.emRevisao
  return { ...f, etapas, emRevisao }
}

const novoId = () => Math.random().toString(36).slice(2, 10)

export function aprovar(f: FluxoLP, etapa: EtapaAprovacao, por: string, agora = agoraISO()): { status: EtapaLP; fluxo: FluxoLP } {
  const de: EtapaLP = etapa === 'copy' ? 'aprovacao_copy' : 'aprovacao_design'
  const para: EtapaLP = etapa === 'copy' ? 'design' : 'implementacao'
  const fluxo = moverPara({ ...f, emRevisao: null }, de, para, agora)
  fluxo.aprovacoes = [...f.aprovacoes, { id: novoId(), etapa, status: 'aprovado', por, data: agora }]
  return { status: para, fluxo }
}

export function reprovar(
  f: FluxoLP,
  etapa: EtapaAprovacao,
  por: string,
  motivo: string,
  agora = agoraISO(),
): { status: EtapaLP; fluxo: FluxoLP } {
  const de: EtapaLP = etapa === 'copy' ? 'aprovacao_copy' : 'aprovacao_design'
  const fluxo = moverPara(f, de, etapa, agora)
  fluxo.emRevisao = etapa
  fluxo.aprovacoes = [...f.aprovacoes, { id: novoId(), etapa, status: 'reprovado', por, data: agora, motivo: motivo.trim() }]
  return { status: etapa, fluxo }
}

export function pausar(f: FluxoLP, etapa: EtapaLP, motivo: string, por: string, agora = agoraISO()): FluxoLP {
  return { ...f, pausa: { motivo: motivo.trim(), em: agora, etapa, por } }
}

/** Volta pra etapa em que parou; a pausa vai pro histórico. */
export function retomar(f: FluxoLP, agora = agoraISO()): { status: EtapaLP; fluxo: FluxoLP } {
  const status = f.pausa?.etapa ?? 'copy'
  const pausas = f.pausa ? [...f.pausas, { ...f.pausa, retomadoEm: agora }] : f.pausas
  return { status, fluxo: { ...f, pausa: null, pausas } }
}

export function registrarEvento(f: FluxoLP, tipo: EventoLP['tipo'], texto: string, agora = agoraISO()): FluxoLP {
  return { ...f, eventos: [...f.eventos, { tipo, em: agora, texto }] }
}

// ── Marketing: LP como canal de aquisição ──────────────────────────────────

/** "https://www.site.com/lp/" → "site.com/lp" (o que procurar na origem do lead). */
export function chaveDaUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
}

export interface CanalLP {
  canal: string
  chaves: string[]
}

export const nomeCanalLP = (nome: string) => `LP · ${nome}`

// ── Persistência ────────────────────────────────────────────────────────────

const TABELA = 'projetos_webdesign_fluxo'
const CHAVE_LOCAL = 'domus-lp-fluxo-v1'
let modoBanco: boolean | null = null

/** true = banco; false = só neste navegador (migration 096 não rodada); null = ainda não sabe. */
export const fluxoNoBanco = () => modoBanco

function lerLocal(): Record<string, unknown> {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_LOCAL) ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function carregarFluxos(): Promise<Map<string, FluxoLP>> {
  const { data, error } = await supabase.from(TABELA).select('projeto_id, dados')
  if (!error) {
    modoBanco = true
    return new Map(((data as { projeto_id: string; dados: unknown }[]) ?? []).map((r) => [r.projeto_id, normalizarFluxo(r.dados)]))
  }
  modoBanco = false
  return new Map(Object.entries(lerLocal()).map(([id, d]) => [id, normalizarFluxo(d)]))
}

export async function salvarFluxo(projetoId: string, f: FluxoLP): Promise<void> {
  if (modoBanco !== false) {
    const { error } = await supabase
      .from(TABELA)
      .upsert({ projeto_id: projetoId, dados: f, updated_at: new Date().toISOString() }, { onConflict: 'projeto_id' })
    if (!error) {
      modoBanco = true
      return
    }
    modoBanco = false
  }
  try {
    const todos = lerLocal()
    todos[projetoId] = f
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(todos))
  } catch {
    /* storage indisponível */
  }
}

/** LPs vinculadas ao Marketing (pro canalDoLead reconhecer os leads delas). */
export async function carregarCanaisLP(): Promise<CanalLP[]> {
  const fluxos = await carregarFluxos()
  return [...fluxos.values()]
    .filter((f) => f.marketing?.url)
    .map((f) => ({ canal: f.marketing!.canal, chaves: [chaveDaUrl(f.marketing!.url)] }))
}
