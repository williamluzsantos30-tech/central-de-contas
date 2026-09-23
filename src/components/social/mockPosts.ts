/**
 * Publicação automática de posts (Meta Graph API) — estado por item.
 *
 * ESTRUTURA PRONTA + SIMULAÇÃO: nenhuma chamada real à Meta acontece aqui.
 * Segue o mesmo padrão de `mockInstagram.ts`: leitura síncrona a partir de um
 * store em localStorage (chave `ig-posts`), com try/catch de fallback pra não
 * quebrar quando o storage estiver indisponível.
 *
 * PONTO DE TROCA PELA API REAL: `simularPublicacao` é a ÚNICA função a ser
 * substituída pela Graph API quando o App for aprovado pela Meta. O fluxo real
 * é: criar o container de mídia (POST /{ig-user-id}/media) → publicar o
 * container (POST /{ig-user-id}/media_publish). Vídeo/Reels tem um passo extra
 * de processamento assíncrono do container (status IN_PROGRESS → FINISHED), que
 * aqui é representado pelo estado `processando`.
 *
 * RANKING: posts que terminam em `publicado_api` com `idPostInstagram` são os
 * candidatos naturais ao ranking "Melhores Posts do Mês" (TopPostsRanking) —
 * o wire completo com getInstagramMetricsForPeriod fica pra quando a API real
 * devolver o id/insights de cada publicação.
 */

export type StatusPublicacao =
  | 'pendente'
  | 'agendado_manual'
  | 'publicado_manual'
  | 'agendado_api'
  | 'processando'
  | 'publicado_api'
  | 'falha_publicacao'

export interface MidiaFinal {
  urls: string[]
  tipoArquivo: 'imagem' | 'video'
}

export interface PostPublicacao {
  midiaFinal?: MidiaFinal
  legendaFinal?: string
  statusPublicacao: StatusPublicacao
  erroPublicacao?: string
  agendadoPara?: string
  publicadoEm?: string
  idPostInstagram?: string
}

/** Limite de caracteres da legenda no Instagram. */
export const LIMITE_LEGENDA = 2200

const KEY = 'ig-posts'
const DEFAULT: PostPublicacao = { statusPublicacao: 'pendente' }

function readAll(): Record<string, PostPublicacao> {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, PostPublicacao>) : {}
  } catch {
    return {}
  }
}
function writeAll(all: Record<string, PostPublicacao>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage indisponível */
  }
}

/** Aplica um patch parcial ao estado do item e persiste. Devolve o novo estado. */
function patch(itemId: string, partial: Partial<PostPublicacao>): PostPublicacao {
  const all = readAll()
  const atual = all[itemId] ?? { ...DEFAULT }
  const proximo: PostPublicacao = { ...atual, ...partial }
  all[itemId] = proximo
  writeAll(all)
  return proximo
}

// ── Leitura síncrona ─────────────────────────────────────────────────────────
export function getPostPub(itemId: string): PostPublicacao {
  return readAll()[itemId] ?? { ...DEFAULT }
}

// ── Escrita (mídia/legenda) ──────────────────────────────────────────────────
/** Grava mídia final + legenda, mantendo o status atual. */
export function setPostMedia(
  itemId: string,
  midiaFinal?: MidiaFinal,
  legendaFinal?: string,
): PostPublicacao {
  return patch(itemId, { midiaFinal, legendaFinal })
}

// ── Agendamento via API ──────────────────────────────────────────────────────
export function agendarViaAPI(itemId: string, agendadoPara: string): PostPublicacao {
  return patch(itemId, {
    statusPublicacao: 'agendado_api',
    agendadoPara,
    erroPublicacao: undefined,
  })
}

export function cancelarAgendamento(itemId: string): PostPublicacao {
  return patch(itemId, { statusPublicacao: 'pendente', agendadoPara: undefined })
}

// ── Simulação do fluxo de publicação ─────────────────────────────────────────
const DELAY_MS = 1200
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
/** Formatos que passam pelo passo de processamento do container (Reels/vídeo). */
const TIPOS_COM_PROCESSAMENTO = new Set(['reels', 'reel', 'video'])

/**
 * Simula o fluxo assíncrono de publicação, chamando `onStep` a cada transição
 * pra a UI acompanhar ao vivo. É a ÚNICA função a trocar pela Graph API real
 * (criação de container de mídia + publish; vídeo tem o polling do container).
 *
 * - tipo 'reels' | 'video' → agendado_api → processando → publicado_api
 * - demais formatos        → agendado_api → publicado_api
 */
export async function simularPublicacao(
  itemId: string,
  tipo: string,
  onStep: (s: PostPublicacao) => void,
): Promise<void> {
  onStep(patch(itemId, { statusPublicacao: 'agendado_api', erroPublicacao: undefined }))
  await sleep(DELAY_MS)

  if (TIPOS_COM_PROCESSAMENTO.has(tipo)) {
    onStep(patch(itemId, { statusPublicacao: 'processando' }))
    await sleep(DELAY_MS)
  }

  onStep(
    patch(itemId, {
      statusPublicacao: 'publicado_api',
      publicadoEm: new Date().toISOString(),
      idPostInstagram: `ig_${Date.now()}`,
    }),
  )
}

/** Marca falha de publicação com um motivo (ex.: token expirado). */
export function simularFalha(itemId: string, motivo: string): PostPublicacao {
  return patch(itemId, { statusPublicacao: 'falha_publicacao', erroPublicacao: motivo })
}
