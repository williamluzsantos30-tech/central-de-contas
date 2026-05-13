// =========================================================
// Helpers de configuração de Criações (templates de introdução do PDF)
// =========================================================
import { supabase } from '@/lib/supabase'
import type { ConfigCriacaoIntro, TipoCriacao } from '@/types/database'

/** Defaults hardcoded — usados como fallback se o banco não tiver config (migration 021 não rodada). */
export const introsHardcoded: Record<TipoCriacao, { titulo: string; paragrafos: string[] }> = {
  copy_lp: {
    titulo: 'Sobre essa copy',
    paragrafos: [
      'O objetivo dessa copy é conectar com o público-alvo do cliente, atacar suas principais dores e gerar autoridade, levando o visitante a tomar a ação desejada na landing page.',
      'A copy foi estruturada em blocos (headline, subhead, prova social, oferta, CTA) pensada pra ser conversiva — ou seja, transformar visita em lead/contato.',
      'Após aprovação, a copy segue automaticamente pra produção da landing page com a equipe de design.',
    ],
  },
  copy_criativos: {
    titulo: 'Sobre essas copies de criativo',
    paragrafos: [
      'São variações de copy para os anúncios (Meta Ads / Google Ads). Cada variação testa um ângulo diferente: dor, desejo, prova social, urgência.',
      'O objetivo é abrir leque de testes pra identificar qual mensagem gera mais CTR e CPL no público do cliente.',
      'Após aprovação, as copies seguem automaticamente pra produção do criativo com a equipe de design.',
    ],
  },
  planejamento: {
    titulo: 'Sobre esse planejamento',
    paragrafos: [
      'Documento estratégico que organiza as campanhas do cliente: objetivos, público, plataformas, orçamento, criativos previstos e KPIs alvo.',
      'Serve como guia pra equipe de tráfego executar a operação com foco e pra alinhar expectativas com o cliente sobre o que está sendo entregue no mês.',
    ],
  },
  roteiro: {
    titulo: 'Sobre esse roteiro',
    paragrafos: [
      'Roteiro estruturado para vídeo (reel/anúncio) ou carrossel. Define gancho inicial, desenvolvimento, prova/argumento e CTA.',
      'Pensado pra prender atenção nos primeiros segundos, manter retenção e conduzir até a ação desejada.',
    ],
  },
}

/**
 * Busca todos os templates globais do banco. Retorna mapa por tipo.
 * Se a query falhar (migration não rodada, sem auth, etc.), retorna os hardcoded.
 */
export async function loadIntros(): Promise<Record<TipoCriacao, { titulo: string; paragrafos: string[] }>> {
  const { data, error } = await supabase
    .from('config_criacoes_intros')
    .select('tipo, titulo, paragrafos')
  if (error || !data) return introsHardcoded
  const map = { ...introsHardcoded }
  for (const row of data as ConfigCriacaoIntro[]) {
    if (row.tipo in map) {
      map[row.tipo] = {
        titulo: row.titulo || introsHardcoded[row.tipo].titulo,
        paragrafos:
          Array.isArray(row.paragrafos) && row.paragrafos.length > 0
            ? row.paragrafos
            : introsHardcoded[row.tipo].paragrafos,
      }
    }
  }
  return map
}

/**
 * Aplica a cascata: override per-criacao > template global > hardcoded.
 * Retorna o texto pronto pra renderizar (paragrafos como array).
 */
export function resolverIntro({
  tipo,
  introducaoPdf,
  intros,
}: {
  tipo: TipoCriacao
  introducaoPdf: string | null | undefined
  intros: Record<TipoCriacao, { titulo: string; paragrafos: string[] }>
}): { titulo: string; paragrafos: string[] } {
  const base = intros[tipo] ?? introsHardcoded[tipo]
  if (introducaoPdf && introducaoPdf.trim()) {
    // Override: usa o título do template + parágrafos do override (split por linha dupla).
    const paragrafos = introducaoPdf
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    return { titulo: base.titulo, paragrafos }
  }
  return base
}

/** Atualiza um template global. Requer auth. */
export async function saveIntro(
  tipo: TipoCriacao,
  patch: { titulo?: string; paragrafos?: string[] },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('config_criacoes_intros')
    .upsert({
      tipo,
      titulo: patch.titulo ?? '',
      paragrafos: patch.paragrafos ?? [],
      updated_at: new Date().toISOString(),
    })
  return { error: error?.message ?? null }
}
