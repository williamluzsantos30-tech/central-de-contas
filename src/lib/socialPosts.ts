/**
 * Helpers compartilhados pra visão de postagens de Social Media.
 *
 * Os "posts" NÃO são entidade própria: são `ItemSocialMedia`
 * (producoes_social_media_items) ligados ao cliente via o planejamento
 * (producoes_social_media): item.producao_id === planejamento.id e
 * planejamento.cliente_id === cliente.id.
 *
 * Estado derivado de cada post (fonte da verdade: publicado_em):
 *   - publicado_em setado           -> 'publicado' (success/verde)
 *   - senão, prazo < hoje (00:00)   -> 'atrasado'  (danger/vermelho)
 *   - senão                         -> 'agendado'  (accent/roxo)
 *
 * Usado por KPIs (range = mês), Hoje/Amanhã (ranges de dia) e o
 * calendário — garantindo que os números sempre batam.
 */
import { parseLocalDate } from '@/lib/dates'
import type {
  Cliente,
  FormatoSocialMedia,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
  StatusSocialMedia,
} from '@/types/database'

export type EstadoPost = 'publicado' | 'atrasado' | 'agendado'

export interface PostView {
  id: string
  clienteId: string
  clienteNome: string
  cliente: Cliente
  titulo: string
  formato: FormatoSocialMedia
  status: StatusSocialMedia
  /** Data de postagem (prazo) como Date local (meio-dia, anti-fuso). */
  prazoDate: Date
  estado: EstadoPost
  item: ItemSocialMedia
}

/** Meia-noite local de hoje — âncora pra comparar "atrasado". */
export function startOfToday(): Date {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

/** Deriva o estado do post pela regra oficial (publicado_em manda). */
export function derivarEstadoPost(
  item: ItemSocialMedia,
  prazoDate: Date,
  hoje: Date = startOfToday(),
): EstadoPost {
  if (item.publicado_em) return 'publicado'
  const d = new Date(prazoDate)
  d.setHours(0, 0, 0, 0)
  return d < hoje ? 'atrasado' : 'agendado'
}

/**
 * Liga item → planejamento → cliente, escopa aos `clientes` passados e
 * devolve os posts cujo prazo cai no range [inicio, fim] (inclusivo por dia).
 */
export function getPostsForDateRange(
  items: ItemSocialMedia[],
  planejamentos: PlanejamentoSocialMedia[],
  clientes: Cliente[],
  inicio: Date,
  fim: Date,
): PostView[] {
  const hoje = startOfToday()
  const planToCliente = new Map<string, string>()
  for (const p of planejamentos) planToCliente.set(p.id, p.cliente_id)
  const clienteById = new Map<string, Cliente>()
  for (const c of clientes) clienteById.set(c.id, c)

  const rangeIni = new Date(inicio)
  rangeIni.setHours(0, 0, 0, 0)
  const rangeFim = new Date(fim)
  rangeFim.setHours(23, 59, 59, 999)

  const result: PostView[] = []
  for (const it of items) {
    if (!it.prazo) continue
    const clienteId = planToCliente.get(it.producao_id)
    if (!clienteId) continue
    const cliente = clienteById.get(clienteId)
    if (!cliente) continue // escopa aos clientes passados (filtered)
    const prazoDate = parseLocalDate(it.prazo)
    if (!prazoDate) continue
    if (prazoDate < rangeIni || prazoDate > rangeFim) continue
    result.push({
      id: it.id,
      clienteId,
      clienteNome: cliente.nome,
      cliente,
      titulo: it.titulo,
      formato: it.formato,
      status: it.status,
      prazoDate,
      estado: derivarEstadoPost(it, prazoDate, hoje),
      item: it,
    })
  }
  return result
}

/**
 * Pontualidade de um post (Performance da Equipe — Social Media):
 *   - 'no_prazo'  publicado até o dia da postagem (prazo)
 *   - 'fora'      publicado depois do prazo, ou 'atrasado' (não publicado e prazo passou)
 *   - 'pendente'  agendado (prazo ainda não chegou) — não conta no %
 */
export function prazoDoPost(post: PostView): 'no_prazo' | 'fora' | 'pendente' {
  if (post.estado === 'agendado') return 'pendente'
  if (post.estado === 'atrasado') return 'fora'
  const publicado = post.item.publicado_em ? parseLocalDate(post.item.publicado_em.slice(0, 10)) : null
  if (!publicado) return 'no_prazo'
  const prazo = new Date(post.prazoDate)
  prazo.setHours(23, 59, 59, 999)
  return publicado <= prazo ? 'no_prazo' : 'fora'
}

/** Nome curto pro chip do calendário: primeiro nome (ou iniciais). */
export function nomeCurtoCliente(nome: string): string {
  const limpo = nome.trim()
  if (!limpo) return '—'
  const partes = limpo.split(/\s+/)
  if (partes.length === 1) return partes[0]
  // Nome composto → iniciais das 2 primeiras palavras (ex.: "Happy Body" -> "HB")
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
