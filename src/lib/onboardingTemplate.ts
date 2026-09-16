/**
 * Template das etapas de onboarding — a narrativa que o cliente ve no
 * Portal ("onde estamos"), que a equipe marca como concluida na Ficha e
 * que o Head acompanha na aba Onboarding (/clientes/onboarding).
 *
 * O progresso fica em clientes.onboarding_etapas (jsonb):
 *   { [key]: { concluido_em: string | null } }
 *
 * O PRAZO de cada etapa nao e armazenado — e derivado de
 * data_inicio + slaDia. Assim, mudar a data de entrada recalcula todos
 * os prazos automaticamente, sem migration.
 *
 * Etapa sem entrada no jsonb = pendente. Ordem aqui = ordem de exibicao.
 * Adicionar/editar etapa = mexer so neste arquivo.
 */
import type { Cargo } from '@/lib/cargos'
import type { Cliente } from '@/types/database'

export interface OnboardingEtapa {
  key: string
  label: string
  descricao: string
  /** Cargo responsavel pela etapa. Resolve pro membro do time do cliente
   *  (AM, gestor, social) quando ha campo; senao mostra o rotulo do cargo. */
  responsavel: Cargo
  /** Dia (contado a partir da data_inicio) em que a etapa deve estar
   *  concluida. Ex.: 0 = dia da entrada, 30 = fechamento em 30 dias. */
  slaDia: number
  /** Etapa so faz sentido pra quem tem esse modulo. Sem filtro = todos. */
  modulo?: 'trafego' | 'social_media'
}

/** SLA total do onboarding, em dias (ultima etapa). Vira config por
 *  agencia quando o modulo de metas nascer. */
export const ONBOARDING_SLA_DIAS = 30

export const ONBOARDING_ETAPAS: OnboardingEtapa[] = [
  {
    key: 'boas_vindas',
    label: 'Enviar boas-vindas + briefing + solicitar acessos',
    descricao: 'Mensagem inicial, formulário de briefing e pedido dos acessos.',
    responsavel: 'account_manager',
    slaDia: 0,
  },
  {
    key: 'grupo_oficial',
    label: 'Criar grupo oficial (Agência + Cliente)',
    descricao: 'Canal de comunicação com o cliente e a equipe.',
    responsavel: 'account_manager',
    slaDia: 0,
  },
  {
    key: 'call_onboarding',
    label: 'Realizar Call de Onboarding (alinhamento)',
    descricao: 'Alinhamento de expectativas, metas e responsáveis.',
    responsavel: 'account_manager',
    slaDia: 1,
  },
  {
    key: 'copy_landing',
    label: 'Produzir Copy da Landing Page',
    descricao: 'Texto de conversão da página, aprovado internamente.',
    responsavel: 'gestor_trafego',
    slaDia: 2,
    modulo: 'trafego',
  },
  {
    key: 'construcao_landing',
    label: 'Construção da Landing Page',
    descricao: 'Página montada e revisada com o cliente.',
    responsavel: 'designer',
    slaDia: 5,
    modulo: 'trafego',
  },
  {
    key: 'planejamento_trafego',
    label: 'Criar Planejamento de Tráfego',
    descricao: 'Estrutura de campanhas, públicos e verba.',
    responsavel: 'gestor_trafego',
    slaDia: 6,
    modulo: 'trafego',
  },
  {
    key: 'planejamento_social',
    label: 'Planejamento de conteúdo aprovado',
    descricao: 'Primeiro calendário mensal apresentado e aprovado.',
    responsavel: 'social_media',
    slaDia: 6,
    modulo: 'social_media',
  },
  {
    key: 'apresentar_planejamento',
    label: 'Apresentar Planejamento ao Cliente',
    descricao: 'Validação do plano com o cliente antes do go-live.',
    responsavel: 'account_manager',
    slaDia: 7,
  },
  {
    key: 'go_live',
    label: 'Campanhas Ativas (Go Live)',
    descricao: 'Primeiras campanhas no ar recebendo tráfego.',
    responsavel: 'gestor_trafego',
    slaDia: 8,
    modulo: 'trafego',
  },
  {
    key: 'treinamento_comercial',
    label: 'Treinamento Comercial (atendimento, follow-up e scripts)',
    descricao: 'Time do cliente preparado pra receber e converter leads.',
    responsavel: 'account_manager',
    slaDia: 10,
  },
  {
    key: 'reuniao_15d',
    label: 'Reunião 15 dias (ajustes iniciais)',
    descricao: 'Primeira leitura de resultados e ajustes.',
    responsavel: 'account_manager',
    slaDia: 15,
  },
  {
    key: 'entrega_landing',
    label: 'Entrega da Landing Page',
    descricao: 'Página final entregue e documentada.',
    responsavel: 'designer',
    slaDia: 16,
    modulo: 'trafego',
  },
  {
    key: 'reuniao_30d',
    label: 'Reunião 30 dias (fechamento onboarding)',
    descricao: 'Fechamento do onboarding e transição pra otimização.',
    responsavel: 'account_manager',
    slaDia: 30,
  },
]

export type OnboardingProgresso = Record<string, { concluido_em: string | null }>

export type StatusEtapa = 'concluida' | 'atrasada' | 'pendente'

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

/** Data-prazo de uma etapa = data_inicio + slaDia (00:00 local). */
export function prazoEtapa(dataInicio: string | null, etapa: OnboardingEtapa): Date | null {
  if (!dataInicio) return null
  const base = new Date(dataInicio)
  if (isNaN(base.getTime())) return null
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + etapa.slaDia)
  return d
}

/** Status de uma etapa dado o progresso do cliente e a data de hoje. */
export function statusEtapa(
  etapa: OnboardingEtapa,
  progresso: OnboardingProgresso | null | undefined,
  dataInicio: string | null,
  hoje = new Date(),
): StatusEtapa {
  if (progresso?.[etapa.key]?.concluido_em) return 'concluida'
  const prazo = prazoEtapa(dataInicio, etapa)
  if (prazo && hoje.getTime() > prazo.getTime() + 86_400_000 - 1) return 'atrasada'
  return 'pendente'
}

export interface ResumoOnboarding {
  etapas: OnboardingEtapa[]
  concluidas: number
  total: number
  pct: number
  diasDecorridos: number
  slaDias: number
  etapasAtrasadas: number
  proxima: OnboardingEtapa | null
  proximaPrazo: Date | null
  foraDoSla: boolean
  semaforo: 'verde' | 'amarelo' | 'vermelho'
}

/** Consolida tudo que a aba Onboarding precisa por cliente. */
export function resumoOnboarding(cliente: Cliente, hoje = new Date()): ResumoOnboarding {
  const etapas = etapasParaModulos(cliente.modulos)
  const progresso = cliente.onboarding_etapas as OnboardingProgresso | null
  const concluidas = etapas.filter((e) => !!progresso?.[e.key]?.concluido_em).length
  const total = etapas.length

  let etapasAtrasadas = 0
  let proxima: OnboardingEtapa | null = null
  for (const e of etapas) {
    const st = statusEtapa(e, progresso, cliente.data_inicio, hoje)
    if (st === 'atrasada') etapasAtrasadas++
    if (!proxima && st !== 'concluida') proxima = e
  }

  const inicio = cliente.data_inicio ? new Date(cliente.data_inicio) : null
  const diasDecorridos =
    inicio && !isNaN(inicio.getTime())
      ? Math.max(0, Math.round((hoje.getTime() - inicio.getTime()) / 86_400_000))
      : 0

  const foraDoSla = concluidas < total && diasDecorridos > ONBOARDING_SLA_DIAS
  const semaforo: 'verde' | 'amarelo' | 'vermelho' = foraDoSla
    ? 'vermelho'
    : etapasAtrasadas > 0
      ? 'amarelo'
      : 'verde'

  return {
    etapas,
    concluidas,
    total,
    pct: total > 0 ? concluidas / total : 0,
    diasDecorridos,
    slaDias: ONBOARDING_SLA_DIAS,
    etapasAtrasadas,
    proxima,
    proximaPrazo: proxima ? prazoEtapa(cliente.data_inicio, proxima) : null,
    foraDoSla,
    semaforo,
  }
}
