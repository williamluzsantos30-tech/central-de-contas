/**
 * Template das etapas de onboarding — a narrativa que o cliente ve no
 * Portal ("onde estamos") e que a equipe marca como concluida na Ficha.
 *
 * O progresso fica em clientes.onboarding_etapas (jsonb):
 *   { [key]: { concluido_em: string | null } }
 *
 * Etapa sem entrada no jsonb = pendente. Ordem aqui = ordem de exibicao.
 * Adicionar etapa nova = 1 linha aqui, sem migration.
 */

export interface OnboardingEtapa {
  key: string
  label: string
  descricao: string
  /** Etapa so faz sentido pra quem tem esse modulo. Sem filtro = todos. */
  modulo?: 'trafego' | 'social_media'
}

export const ONBOARDING_ETAPAS: OnboardingEtapa[] = [
  {
    key: 'kickoff',
    label: 'Reunião de kickoff',
    descricao: 'Alinhamento inicial de expectativas, metas e responsáveis.',
  },
  {
    key: 'briefing',
    label: 'Briefing respondido',
    descricao: 'Formulário com posicionamento, público, diferenciais e referências.',
  },
  {
    key: 'acessos',
    label: 'Acessos liberados',
    descricao: 'Contas de anúncio, Instagram, site e ferramentas compartilhadas com a equipe.',
  },
  {
    key: 'setup_tecnico',
    label: 'Setup técnico',
    descricao: 'Pixel, GA4, Google Meu Negócio e públicos configurados.',
    modulo: 'trafego',
  },
  {
    key: 'landing_page',
    label: 'Landing page no ar',
    descricao: 'Página de conversão publicada e revisada com você.',
    modulo: 'trafego',
  },
  {
    key: 'planejamento_social',
    label: 'Planejamento de conteúdo aprovado',
    descricao: 'Primeiro calendário mensal apresentado e aprovado.',
    modulo: 'social_media',
  },
  {
    key: 'campanhas_ar',
    label: 'Campanhas no ar',
    descricao: 'Primeiras campanhas ativas e recebendo tráfego.',
    modulo: 'trafego',
  },
  {
    key: 'reuniao_15d',
    label: 'Reunião de 15 dias',
    descricao: 'Primeira leitura de resultados e ajustes iniciais.',
  },
  {
    key: 'reuniao_30d',
    label: 'Reunião de 30 dias',
    descricao: 'Fechamento do onboarding e transição pra fase de otimização.',
  },
]

export type OnboardingProgresso = Record<string, { concluido_em: string | null }>

/** Filtra as etapas aplicaveis aos modulos do cliente. */
export function etapasParaModulos(modulos: string[] | null | undefined): OnboardingEtapa[] {
  const set = new Set(modulos ?? [])
  return ONBOARDING_ETAPAS.filter((e) => !e.modulo || set.has(e.modulo))
}

/** Conta concluidas / total e devolve percentual 0-1. */
export function progressoOnboarding(
  progresso: OnboardingProgresso | null | undefined,
  modulos: string[] | null | undefined,
): { concluidas: number; total: number; pct: number } {
  const etapas = etapasParaModulos(modulos)
  const concluidas = etapas.filter((e) => !!progresso?.[e.key]?.concluido_em).length
  const total = etapas.length
  return { concluidas, total, pct: total > 0 ? concluidas / total : 0 }
}
