/**
 * Escrita ÚNICA no Log de otimização (tabela `otimizacoes`). É a mesma fonte
 * que a aba "Log de otimização" (histórico completo) e o card "Últimas
 * otimizações" da Visão geral (as mais recentes) leem — quem registra por
 * aqui aparece nos dois lugares.
 *
 * Usado pelas ações da tabela de campanhas (pausar/reativar/orçamento,
 * "Fiz manualmente") e pelo "Nova otimização". Autor = usuário logado.
 */
import { supabase } from '@/lib/supabase'
import { hojeISO } from '@/lib/ocorrencias'
import type { PlataformaAds, TipoOtimizacao } from '@/types/database'

export async function logOptimization(
  clienteId: string,
  plataforma: PlataformaAds,
  acao: TipoOtimizacao,
  descricao: string,
  opcoes: { autorId?: string | null; data?: string; resultado?: string | null } = {},
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('otimizacoes').insert({
    cliente_id: clienteId,
    responsavel_id: opcoes.autorId ?? null,
    plataforma,
    tipo: acao,
    descricao: descricao.trim(),
    resultado: opcoes.resultado?.trim() || null,
    // Data LOCAL (toISOString é UTC: à noite no Brasil já virava o dia seguinte).
    data_otimizacao: opcoes.data ?? hojeISO(),
  })
  return { error: error?.message ?? null }
}
