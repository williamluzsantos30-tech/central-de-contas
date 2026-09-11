/**
 * Templates dos formularios NPS.
 *
 * 2 tipos:
 *   ONBOARDING — 30 dias / primeiro ciclo. Avalia entrada.
 *   OPERACAO   — Cliente ativo, campanhas rodando. Avalia continuidade.
 *
 * Formato:
 *   Cada template tem `blocos`, cada bloco tem `perguntas`.
 *   Cada pergunta tem:
 *     key            — id unico dentro do survey (guardado em respostas)
 *     tipo           — 'escala5' | 'escala10' | 'texto' | 'opcoes'
 *     titulo         — enunciado exibido
 *     obrigatoria    — bool
 *     opcoes         — so em tipo='opcoes'
 *     escalaLabels   — so em tipo='escala5/10' (min/max labels)
 *     mostrarSe      — funcao opcional pra pergunta condicional. Recebe
 *                      { temSocialMedia } e retorna bool
 *
 * Substituicoes de linguagem:
 *   - "MovMed" foi substituido por "nossa agencia" ou "a equipe" pra
 *     ficar generico (o produto e' white-label — cada agencia usa)
 *   - Nome do cliente e' interpolado com {{cliente}} onde faz sentido
 */

export type PerguntaTipo = 'escala5' | 'escala10' | 'texto' | 'opcoes'

export interface Pergunta {
  key: string
  tipo: PerguntaTipo
  titulo: string
  obrigatoria: boolean
  opcoes?: string[]
  escalaLabels?: { min: string; max: string }
  ehNpsPrincipal?: boolean
  permiteOutro?: boolean
  mostrarSe?: (ctx: { temSocialMedia: boolean }) => boolean
}

export interface Bloco {
  titulo: string
  subtitulo?: string
  perguntas: Pergunta[]
}

export interface NpsTemplate {
  tipo: 'onboarding' | 'operacao'
  titulo: string
  subtitulo: string
  saudacao: (cliente: string) => string
  blocos: Bloco[]
}

const ESCALA5_LABELS = { min: 'Muito insatisfeito', max: 'Muito satisfeito' }

// ==========================================================
// ONBOARDING — 30 dias / primeiro ciclo
// ==========================================================

export const TEMPLATE_ONBOARDING: NpsTemplate = {
  tipo: 'onboarding',
  titulo: 'Pesquisa de Satisfação — Onboarding',
  subtitulo: '30 dias · Avaliação da fase de entrada',
  saudacao: (cliente) =>
    `Olá, ${cliente}! Sua opinião é muito importante pra nós. Por favor, responda às perguntas abaixo sobre esses primeiros 30 dias de parceria.`,
  blocos: [
    {
      titulo: 'Comunicação & Clareza',
      perguntas: [
        {
          key: 'clareza_explicacoes',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como você avalia a clareza das explicações sobre o processo, etapas e próximos passos?',
          escalaLabels: ESCALA5_LABELS,
        },
        {
          key: 'comunicacao_30dias',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como foi a comunicação da equipe durante esses primeiros 30 dias?',
          escalaLabels: ESCALA5_LABELS,
        },
        {
          key: 'reunioes_15_30',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como avalia o acompanhamento realizado nas reuniões de 15 e 30 dias?',
          escalaLabels: ESCALA5_LABELS,
        },
      ],
    },
    {
      titulo: 'Prazos & Organização',
      perguntas: [
        {
          key: 'prazos_cumpridos',
          tipo: 'escala5',
          obrigatoria: true,
          titulo: 'Os prazos combinados foram cumpridos conforme alinhado?',
          escalaLabels: ESCALA5_LABELS,
        },
        {
          key: 'planejamento_estrategico',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'O planejamento estratégico apresentado fez sentido para sua realidade e objetivos?',
          escalaLabels: ESCALA5_LABELS,
        },
        {
          key: 'landing_page',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como você avalia a landing page que entregamos, considerando clareza das informações, alinhamento com sua especialidade e se ela representa bem o seu serviço?',
          escalaLabels: ESCALA5_LABELS,
        },
        {
          key: 'processo_comercial',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como você avalia o processo comercial até aqui, considerando organização, clareza das orientações e a forma como os atendimentos estão sendo conduzidos?',
          escalaLabels: ESCALA5_LABELS,
        },
        {
          key: 'confianca_trabalho',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Após esses 30 dias, o quanto você se sente confiante no trabalho que está sendo desenvolvido pela nossa equipe?',
          escalaLabels: ESCALA5_LABELS,
        },
      ],
    },
    // Bloco Social Media (condicional) — aguardando texto do user pra
    // definir perguntas. Placeholder por enquanto.
    {
      titulo: 'Social Media',
      subtitulo: 'Bloco condicional — só aparece se você tem Social Media',
      perguntas: [
        {
          key: 'social_conteudos',
          tipo: 'escala5',
          obrigatoria: true,
          titulo: 'Como você avalia a qualidade dos conteúdos publicados?',
          escalaLabels: ESCALA5_LABELS,
          mostrarSe: (ctx) => ctx.temSocialMedia,
        },
        {
          key: 'social_datas',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como você avalia as datas de postagem — frequência, consistência e alinhamento com o combinado?',
          escalaLabels: ESCALA5_LABELS,
          mostrarSe: (ctx) => ctx.temSocialMedia,
        },
      ],
    },
    {
      titulo: 'Percepção Qualitativa',
      perguntas: [
        {
          key: 'momento_inseguro',
          tipo: 'texto',
          obrigatoria: false,
          titulo:
            'Teve algum momento em que você se sentiu inseguro(a), confuso(a) ou mal informado(a)? Se sim, qual?',
        },
      ],
    },
    {
      titulo: 'Alerta Operacional',
      perguntas: [
        {
          key: 'ajuste_continuidade',
          tipo: 'opcoes',
          obrigatoria: true,
          titulo:
            'Existe algo que, se não for ajustado rapidamente, pode atrapalhar sua continuidade conosco?',
          opcoes: ['Não', 'Sim'],
        },
        {
          key: 'ajuste_qual',
          tipo: 'texto',
          obrigatoria: false,
          titulo: 'Se sim, qual?',
        },
      ],
    },
    {
      titulo: 'Expectativa Para Próximo Ciclo',
      perguntas: [
        {
          key: 'proximos_30_prioridade',
          tipo: 'opcoes',
          obrigatoria: true,
          permiteOutro: true,
          titulo:
            'Para os próximos 30 dias, o que é mais importante para você ver acontecer?',
          opcoes: [
            'Resultados iniciais',
            'Mais proximidade da equipe',
            'Mais clareza nos relatórios',
            'Ajustes estratégicos',
          ],
        },
      ],
    },
    {
      titulo: 'NPS — Percepção Geral',
      perguntas: [
        {
          key: 'nps_principal',
          tipo: 'escala10',
          obrigatoria: true,
          ehNpsPrincipal: true,
          titulo:
            'Em uma escala de 0 a 10, o quanto você indicaria nossa equipe para outro médico ou clínica, considerando sua experiência até agora?',
          escalaLabels: { min: 'Nada provável', max: 'Extremamente provável' },
        },
      ],
    },
  ],
}

// ==========================================================
// OPERACAO — Cliente ativo, campanhas rodando
// ==========================================================

export const TEMPLATE_OPERACAO: NpsTemplate = {
  tipo: 'operacao',
  titulo: 'Pesquisa de Satisfação — Operação',
  subtitulo: 'Cliente ativo · Avaliação da parceria em andamento',
  saudacao: (cliente) =>
    `Olá, ${cliente}! Sua opinião é muito importante pra nós. Por favor, responda às perguntas abaixo.`,
  blocos: [
    {
      titulo: 'Resultados (percepção)',
      perguntas: [
        {
          key: 'resultados_percebidos',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como você avalia os resultados que vem obtendo até agora com nosso trabalho?',
          escalaLabels: ESCALA5_LABELS,
        },
      ],
    },
    {
      titulo: 'Comunicação & Acompanhamento',
      perguntas: [
        {
          key: 'comunicacao_dia_a_dia',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como você avalia nossa comunicação no dia a dia (clareza, frequência e facilidade para falar com a equipe)?',
          escalaLabels: ESCALA5_LABELS,
        },
        {
          key: 'acompanhamento_seguro',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Você se sente bem acompanhado(a) e seguro(a) em relação ao que está sendo feito na sua conta?',
          escalaLabels: ESCALA5_LABELS,
        },
      ],
    },
    {
      titulo: 'Expectativa x Realidade',
      perguntas: [
        {
          key: 'expectativa_realidade',
          tipo: 'opcoes',
          obrigatoria: true,
          titulo:
            'Até aqui, o trabalho da nossa equipe está alinhado com o que você esperava quando iniciou a parceria?',
          opcoes: ['Abaixo do esperado', 'Dentro do esperado', 'Acima do esperado'],
        },
      ],
    },
    {
      titulo: 'Evolução & Proatividade',
      perguntas: [
        {
          key: 'evolucao_proatividade',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Você percebe que a equipe busca evoluir a estratégia e propor melhorias ao longo do tempo?',
          escalaLabels: ESCALA5_LABELS,
        },
      ],
    },
    // Bloco Social Media (condicional)
    {
      titulo: 'Social Media',
      subtitulo: 'Bloco condicional — só aparece se você tem Social Media',
      perguntas: [
        {
          key: 'social_conteudos',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'Como você avalia a qualidade e a criatividade dos conteúdos publicados no seu perfil?',
          escalaLabels: ESCALA5_LABELS,
          mostrarSe: (ctx) => ctx.temSocialMedia,
        },
        {
          key: 'social_datas',
          tipo: 'escala5',
          obrigatoria: true,
          titulo:
            'As datas de postagem estão adequadas (frequência, consistência, alinhamento com o combinado)?',
          escalaLabels: ESCALA5_LABELS,
          mostrarSe: (ctx) => ctx.temSocialMedia,
        },
      ],
    },
    {
      titulo: 'Perguntas Abertas',
      perguntas: [
        {
          key: 'satisfacao_hoje',
          tipo: 'texto',
          obrigatoria: false,
          titulo: 'O que mais te deixa satisfeito(a) hoje na parceria?',
        },
      ],
    },
    {
      titulo: 'Alerta de Continuidade',
      perguntas: [
        {
          key: 'continuar_meses',
          tipo: 'opcoes',
          obrigatoria: true,
          titulo:
            'Hoje, você pretende continuar com nossa equipe pelos próximos meses?',
          opcoes: [
            'Sim, com certeza',
            'Sim, mas com ressalvas',
            'Não tenho certeza',
            'Não',
          ],
        },
      ],
    },
    {
      titulo: 'NPS — Valor Percebido',
      perguntas: [
        {
          key: 'nps_principal',
          tipo: 'escala10',
          obrigatoria: true,
          ehNpsPrincipal: true,
          titulo:
            'Em uma escala de 0 a 10, o quanto você indicaria nossa equipe para outro médico ou clínica, considerando os resultados e a experiência atual da parceria?',
          escalaLabels: { min: 'Nada provável', max: 'Extremamente provável' },
        },
      ],
    },
  ],
}

export function getTemplate(tipo: 'onboarding' | 'operacao'): NpsTemplate {
  return tipo === 'onboarding' ? TEMPLATE_ONBOARDING : TEMPLATE_OPERACAO
}
