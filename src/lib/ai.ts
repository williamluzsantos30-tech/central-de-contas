import { supabase } from '@/lib/supabase'
import type { Cliente, CriacaoAnexo, TipoCriacao } from '@/types/database'

interface GenerateParams {
  tipo: TipoCriacao
  briefing: string
  prompt?: string
  anexos?: CriacaoAnexo[]
  cliente: Pick<Cliente, 'nome' | 'nicho' | 'plataformas'>
}

/**
 * Gera conteúdo via Edge Function `ai-generate` (que chama OpenAI/Anthropic com a chave
 * armazenada nos Secrets do Supabase).
 *
 * Se a função não estiver deployada ou o app estiver em modo demo (sem URL Supabase),
 * cai num stub local que retorna um template plausível.
 */
export async function generateWithAI(params: GenerateParams): Promise<string> {
  // Tenta usar a Edge Function. Se não existir, cai no stub.
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        tipo: params.tipo,
        briefing: params.briefing,
        prompt: params.prompt,
        anexos: (params.anexos ?? []).map((a) => ({
          nome: a.nome,
          tipo: a.tipo,
          url: a.url,
        })),
        cliente: {
          nome: params.cliente.nome,
          nicho: params.cliente.nicho,
          plataformas: params.cliente.plataformas,
        },
      },
    })

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[ai-generate] erro, caindo no fallback:', error.message)
      return fallbackLocal(params, `(IA real indisponível: ${error.message})`)
    }
    const text = (data as { text?: string } | null)?.text
    if (!text) {
      return fallbackLocal(params, '(IA real retornou vazio — usando template local)')
    }
    return text
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ai-generate] exceção, caindo no fallback:', err)
    return fallbackLocal(
      params,
      `(IA real indisponível: ${(err as Error).message ?? 'erro desconhecido'})`,
    )
  }
}

/**
 * Stub local — usado quando a Edge Function não está disponível ou em modo demo.
 * Mantém a mesma estrutura de retorno pra UI continuar funcionando.
 */
function fallbackLocal(params: GenerateParams, motivo: string): string {
  const { tipo, briefing, prompt, anexos, cliente } = params
  const nome = cliente.nome
  const nicho = cliente.nicho ?? 'saúde'
  const resumoBrief = (briefing || '(sem briefing)')
    .split('\n')
    .slice(0, 2)
    .join(' ')
    .slice(0, 180)

  const contextos: string[] = []
  if (prompt?.trim()) contextos.push('prompt customizado')
  if (briefing.trim()) contextos.push('briefing')
  if (anexos && anexos.length > 0) {
    contextos.push(
      `${anexos.length} arquivo(s) anexado(s): ${anexos.map((a) => a.nome).join(', ')}`,
    )
  }
  const contextHeader =
    contextos.length > 0
      ? `[Rascunho gerado com base em: ${contextos.join(' · ')} ${motivo}]\n\n`
      : `[${motivo}]\n\n`

  let body = ''

  if (tipo === 'copy_lp') {
    body = [
      `HEADLINE:`,
      `${nome}: cuidado ${nicho.toLowerCase()} com a excelência que você merece.`,
      ``,
      `SUBHEADLINE:`,
      `Mais de 10 anos transformando a vida de pacientes com atendimento humanizado e resultados reais.`,
      ``,
      `BENEFÍCIOS:`,
      `✓ Avaliação personalizada na primeira consulta`,
      `✓ Tecnologia de ponta com diagnóstico rápido`,
      `✓ Equipe especializada e acolhedora`,
      `✓ Planos de tratamento transparentes`,
      ``,
      `PROVA SOCIAL:`,
      `"Atendimento impecável do começo ao fim." — Paciente verificada`,
      ``,
      `CTA:`,
      `Agende sua consulta em menos de 2 minutos`,
      ``,
      `— rascunho a partir do briefing: "${resumoBrief}". Edite livremente.`,
    ].join('\n')
  } else if (tipo === 'planejamento') {
    body = [
      `OBJETIVO:`,
      `Aumentar o volume qualificado de primeiras consultas em ${nome} nos próximos 90 dias, mantendo CPL sob controle.`,
      ``,
      `DIAGNÓSTICO:`,
      `- ${resumoBrief}`,
      ``,
      `ESTRATÉGIA:`,
      `1. Reforçar campanhas de alta intenção em Google Ads (keywords específicas de ${nicho.toLowerCase()}).`,
      `2. Construir funil de awareness em Meta Ads com conteúdo educativo do próprio médico.`,
      `3. Retargeting dos visitantes do site e interações do Instagram.`,
      ``,
      `KPIs:`,
      `- CPL meta: definir junto ao cliente`,
      `- Taxa de comparecimento: > 75%`,
      `- CAC: monitorar mensalmente`,
      ``,
      `CRONOGRAMA:`,
      `- Mês 1: setup, pixel, públicos, 3 criativos por campanha`,
      `- Mês 2: otimização baseada em dados`,
      `- Mês 3: escala do que funcionou, descarte do que não funcionou`,
    ].join('\n')
  } else if (tipo === 'roteiro') {
    body = [
      `FORMATO: Reels / vertical / ~60 segundos.`,
      ``,
      `ABERTURA (0-5s) — GANCHO:`,
      `"Você sabia que [afirmação provocativa relacionada a ${nicho.toLowerCase()}]?"`,
      ``,
      `DESENVOLVIMENTO (5-45s):`,
      `- 5-15s: contextualize o problema com uma estatística real`,
      `- 15-30s: explique a solução com linguagem simples, mostrando o médico no ambiente`,
      `- 30-45s: depoimento curto ou before/after visual`,
      ``,
      `CTA (45-60s):`,
      `Médico olhando pra câmera: "Se você se identificou, agende sua avaliação. Link na bio."`,
      ``,
      `ORIENTAÇÕES DE PRODUÇÃO:`,
      `- Use legendas sempre (80% das pessoas assistem sem som)`,
      `- Enquadramento vertical, luz natural`,
      `- Música: sutil, não disputa com a fala`,
    ].join('\n')
  } else {
    body = [
      `VARIAÇÃO A — DOR:`,
      `Headline: [Problema específico]? Você não precisa conviver com isso.`,
      `Texto: Em ${nome}, cada paciente recebe um plano de tratamento sob medida. Descubra o seu.`,
      `CTA: Quero uma avaliação`,
      ``,
      `VARIAÇÃO B — PROVA SOCIAL:`,
      `Headline: "Nunca pensei que seria tão rápido."`,
      `Texto: O depoimento acima é real — e pode ser o seu também. Conheça a abordagem de ${nome}.`,
      `CTA: Falar com a equipe`,
      ``,
      `VARIAÇÃO C — SOLUÇÃO DIRETA:`,
      `Headline: ${nicho} moderna, sem enrolação.`,
      `Texto: Consulta objetiva, diagnóstico claro, tratamento baseado em evidência.`,
      `CTA: Agendar agora`,
    ].join('\n')
  }

  return contextHeader + body
}
