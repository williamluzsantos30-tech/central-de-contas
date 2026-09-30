/**
 * Sincronização Arte (Produção Social Media) ↔ Postagem (Calendário).
 *
 * No domus a postagem do Calendário É a própria arte (linha de
 * producoes_social_media_items com data de postagem) — não existe tabela de
 * post separada. Então "vincular" é o mesmo id, e a decisão do cliente volta
 * pra arte por construção. Esta função formaliza o MAPA de eventos → status,
 * pra todo lugar que registra um desses eventos usar a mesma regra:
 *
 *   enviado   (Produção → Calendário, pra aprovação)  → em_aprovacao
 *   aprovado  (cliente aprovou o post)                 → conclusao
 *   reprovado (cliente pediu alteração, com descrição) → alteracao
 *
 * A aprovação pelo link público do calendário aplica a MESMA regra no banco
 * (RPC aprovar_ou_alterar_item_publico, migration 071). O status continua
 * editável na mão a qualquer momento — nada trava.
 */
import { supabase } from '@/lib/supabase'
import { getPostPub, marcarEnviadoAoCalendario } from '@/components/social/mockPosts'
import type { ItemSocialMedia, StatusSocialMedia } from '@/types/database'

export type EventoCalendario = 'enviado' | 'aprovado' | 'reprovado'

export const STATUS_ARTE_POR_EVENTO: Record<EventoCalendario, StatusSocialMedia> = {
  enviado: 'em_aprovacao',
  aprovado: 'conclusao',
  reprovado: 'alteracao',
}

export async function syncArteStatusWithCalendario(
  arteId: string,
  evento: EventoCalendario,
  opts: { descricaoAlteracao?: string } = {},
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = { status: STATUS_ARTE_POR_EVENTO[evento] }
  if (evento === 'reprovado' && opts.descricaoAlteracao?.trim()) patch.descricao_alteracao = opts.descricaoAlteracao.trim()
  const { error } = await supabase.from('producoes_social_media_items').update(patch).eq('id', arteId)
  return { error: error?.message ?? null }
}

/**
 * "Enviar para Calendário": a mídia final do post vem das artes prontas e a
 * legenda final da legenda da arte (Publicação no Instagram), e a arte passa
 * pra Em Aprovação — o cliente decide pelo link do calendário.
 */
export async function enviarArteAoCalendario(arte: ItemSocialMedia): Promise<{ error: string | null }> {
  const urls = (arte.artes_prontas ?? []).filter(Boolean)
  const pub = getPostPub(arte.id)
  marcarEnviadoAoCalendario(
    arte.id,
    urls.length ? { urls, tipoArquivo: arte.formato === 'reel' ? 'video' : 'imagem' } : pub.midiaFinal,
    arte.legenda?.trim() || pub.legendaFinal,
  )
  return syncArteStatusWithCalendario(arte.id, 'enviado')
}

/** Arte pode ir pro Calendário: tem arte pronta e data de postagem (e não é backlog). */
export function podeEnviarAoCalendario(arte: ItemSocialMedia): { ok: boolean; motivo?: string } {
  if (!(arte.artes_prontas ?? []).some(Boolean)) return { ok: false, motivo: 'Suba as artes prontas primeiro' }
  if (arte.is_backlog) return { ok: false, motivo: 'Arte de backlog não vai pro calendário' }
  if (!arte.prazo) return { ok: false, motivo: 'Defina a data de postagem no Planejamento Mensal' }
  return { ok: true }
}

/**
 * Calendário DO CLIENTE (Social › Cliente › Calendário — o mesmo que gera o
 * link público pro cliente aprovar), aberto no mês/dia da postagem. Sem
 * cliente, cai no Calendário de Postagens geral.
 */
export function linkNoCalendario(arte: Pick<ItemSocialMedia, 'prazo'>, clienteId?: string | null): string {
  const data = arte.prazo?.slice(0, 10)
  if (clienteId) {
    const q = new URLSearchParams({ aba: 'operacional-social', social: 'calendario' })
    if (data) q.set('data', data)
    return `/social/clientes/${clienteId}?${q.toString()}`
  }
  return data ? `/social/calendario?data=${data}` : '/social/calendario'
}
