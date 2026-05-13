import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isBefore, isToday, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  FrequenciaTarefa,
  PlataformaAds,
  PrioridadeTarefa,
  StatusAtivo,
  StatusCliente,
  StatusCriacao,
  StatusCriativoWebdesign,
  StatusProjetoWebdesign,
  StatusSocialMedia,
  StatusTarefa,
  TipoAtivo,
  TipoCliente,
  TipoCriacao,
  TipoOtimizacao,
  TipoProjetoWebdesign,
  JornadaCliente,
  JornadaSocial,
  SemaforoCliente,
  FormatoCriativo,
  FormatoSocialMedia,
  StatusEdicaoVideo,
  TipoReferenciaVideo,
  UserRole,
} from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(value: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), pattern, { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, "dd/MM/yyyy 'às' HH:mm")
}

export function relativeDueLabel(dateISO: string | null | undefined): string {
  if (!dateISO) return 'Sem prazo'
  try {
    const d = parseISO(dateISO)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(d)
    target.setHours(0, 0, 0, 0)
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
    if (diff === 0) return 'Hoje'
    if (diff < 0) return `Atrasada ${Math.abs(diff)}d`
    if (diff === 1) return 'Amanhã'
    return format(d, 'dd/MM', { locale: ptBR })
  } catch {
    return '—'
  }
}

/** True se o prazo é hoje (desconsiderando hora). */
export function isDueToday(dateISO: string | null | undefined): boolean {
  if (!dateISO) return false
  try {
    const d = parseISO(dateISO)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(d)
    target.setHours(0, 0, 0, 0)
    return target.getTime() === today.getTime()
  } catch {
    return false
  }
}

export function isOverdue(dateISO: string | null | undefined): boolean {
  if (!dateISO) return false
  try {
    const d = parseISO(dateISO)
    return isBefore(d, new Date()) && !isToday(d)
  } catch {
    return false
  }
}

export const plataformaLabel: Record<PlataformaAds, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  ambos: 'Google + Meta',
}

export const statusClienteLabel: Record<StatusCliente, string> = {
  ativo: 'Ativo',
  atencao: 'Atenção',
  pausado: 'Pausado',
  churn: 'Churn',
}

export const tipoClienteLabel: Record<TipoCliente, string> = {
  assessoria: 'Assessoria',
  consultoria: 'Consultoria',
}

export const TIPOS_CLIENTE: TipoCliente[] = ['assessoria', 'consultoria']

export const jornadaClienteLabel: Record<JornadaCliente, string> = {
  onboarding: 'Onboarding',
  otimizacao: 'Otimização',
  expansao: 'Expansão',
  retencao: 'Retenção',
}

export const JORNADAS_CLIENTE: JornadaCliente[] = [
  'onboarding',
  'otimizacao',
  'expansao',
  'retencao',
]

// Jornadas específicas do operacional Social Media (playbook):
// onboarding = perfil sendo otimizado / 1º planejamento
// postando = operação em ritmo, postagens regulares
export const jornadaSocialLabel: Record<JornadaSocial, string> = {
  onboarding: 'Onboarding',
  postando: 'Postando',
}

export const JORNADAS_SOCIAL: JornadaSocial[] = ['onboarding', 'postando']

export const semaforoClienteColor: Record<SemaforoCliente, string> = {
  verde: 'bg-emerald-500',
  amarelo: 'bg-yellow-500',
  laranja: 'bg-orange-500',
  vermelho: 'bg-red-500',
}

export const SEMAFOROS_CLIENTE: SemaforoCliente[] = ['verde', 'amarelo', 'laranja', 'vermelho']

/** Retorna "Xm" (meses desde data_inicio). */
export function lifetimeMeses(dataInicio: string | null | undefined): string {
  if (!dataInicio) return '—'
  try {
    const start = parseISO(dataInicio)
    const now = new Date()
    const months =
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    return `${Math.max(0, months)}m`
  } catch {
    return '—'
  }
}

export const prioridadeLabel: Record<PrioridadeTarefa, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const frequenciaLabel: Record<FrequenciaTarefa, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  esporadica: 'Esporádica',
}

export const statusTarefaLabel: Record<StatusTarefa, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const tipoAtivoLabel: Record<TipoAtivo, string> = {
  meta_pixel: 'Meta Pixel',
  ga4: 'Google Analytics 4',
  google_meu_negocio: 'Google Meu Negócio',
  bio_estruturada: 'Bio Estruturada',
  publicos_meta_ads: 'Públicos Meta Ads',
}

export const statusAtivoLabel: Record<StatusAtivo, string> = {
  pendente: 'Pendente',
  configurado: 'Configurado',
  funcional: 'Funcional',
  com_problema: 'Com problema',
}

export const statusAtivoColor: Record<StatusAtivo, string> = {
  pendente: 'bg-zinc-600',
  configurado: 'bg-yellow-500',
  funcional: 'bg-emerald-500',
  com_problema: 'bg-red-500',
}

export const tipoOtimizacaoLabel: Record<TipoOtimizacao, string> = {
  ajuste_lance: 'Ajuste de lance',
  pausa_campanha: 'Pausa de campanha',
  novo_criativo: 'Novo criativo',
  ajuste_publico: 'Ajuste de público',
  ajuste_orcamento: 'Ajuste de orçamento',
  teste_ab: 'Teste A/B',
  outro: 'Outro',
}

export const userRoleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  supervisor: 'Supervisor',
}

export const TIPOS_ATIVO: TipoAtivo[] = [
  'meta_pixel',
  'ga4',
  'google_meu_negocio',
  'bio_estruturada',
  'publicos_meta_ads',
]

export const SQUADS: string[] = ['BlackOps', 'Delta', 'Alpha', 'Beta']

export const tipoCriacaoLabel: Record<TipoCriacao, string> = {
  copy_lp: 'Copy LP',
  planejamento: 'Planejamento',
  roteiro: 'Roteiro',
  copy_criativos: 'Copy Criativos',
}

export const tipoCriacaoDescricao: Record<TipoCriacao, string> = {
  copy_lp: 'Copy para landing page do cliente',
  planejamento: 'Planejamento estratégico de campanhas',
  roteiro: 'Roteiro para vídeo ou carrossel',
  copy_criativos: 'Variações de copy para anúncios',
}

export const TIPOS_CRIACAO: TipoCriacao[] = ['copy_lp', 'planejamento', 'roteiro', 'copy_criativos']

export const statusCriacaoLabel: Record<StatusCriacao, string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
}

export const tipoProjetoWebdesignLabel: Record<TipoProjetoWebdesign, string> = {
  site_institucional: 'Site institucional',
  landing_page: 'Landing page',
  ecommerce: 'E-commerce',
  blog: 'Blog',
  outro: 'Outro',
}

export const statusProjetoWebdesignLabel: Record<StatusProjetoWebdesign, string> = {
  copy: 'Copy',
  aprovacao_copy: 'Aprovação de Copy',
  design: 'Design',
  aprovacao_design: 'Aprovação de Design',
  implementacao: 'Implementação',
  conclusao: 'Conclusão',
  pausado: 'Pausado',
}

export const ESTEIRA_WEBDESIGN: StatusProjetoWebdesign[] = [
  'copy',
  'aprovacao_copy',
  'design',
  'aprovacao_design',
  'implementacao',
  'conclusao',
]

export const STATUS_PROJETO_WEBDESIGN: StatusProjetoWebdesign[] = [
  ...ESTEIRA_WEBDESIGN,
  'pausado',
]

export const TIPOS_PROJETO_WEBDESIGN: TipoProjetoWebdesign[] = [
  'site_institucional',
  'landing_page',
  'ecommerce',
  'blog',
  'outro',
]

export const formatoCriativoLabel: Record<FormatoCriativo, string> = {
  feed_estatico: 'Feed estático',
  story: 'Story',
  carrossel: 'Carrossel',
  outro: 'Outro',
  feed_estatico_story: 'Feed estático + Story',
}

export const FORMATOS_CRIATIVO: FormatoCriativo[] = [
  'feed_estatico',
  'story',
  'carrossel',
  'feed_estatico_story',
  'outro',
]

export const statusCriativoWebdesignLabel: Record<StatusCriativoWebdesign, string> = {
  pendente: 'Pendente',
  design: 'Design',
  design_finalizado: 'Design Finalizado',
  aprovacao_design: 'Aprovação do Design',
  alteracao: 'Alteração',
  conclusao: 'Conclusão',
}

export const ESTEIRA_CRIATIVOS: StatusCriativoWebdesign[] = [
  'pendente',
  'design',
  'design_finalizado',
  'aprovacao_design',
  'alteracao',
  'conclusao',
]

export const STATUS_CRIATIVO_WEBDESIGN: StatusCriativoWebdesign[] = [...ESTEIRA_CRIATIVOS]

// ============ Edição de Vídeo ============
export const statusEdicaoVideoLabel: Record<StatusEdicaoVideo, string> = {
  pendente: 'Pendente',
  em_edicao: 'Em edição',
  em_aprovacao: 'Em aprovação',
  em_alteracao: 'Em alteração',
  conclusao: 'Concluído',
}

export const ESTEIRA_EDICAO_VIDEO: StatusEdicaoVideo[] = [
  'pendente',
  'em_edicao',
  'em_aprovacao',
  'em_alteracao',
  'conclusao',
]

export const tipoReferenciaVideoLabel: Record<TipoReferenciaVideo, string> = {
  drive: 'Google Drive',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  link: 'Link',
}

export const formatoSocialMediaLabel: Record<FormatoSocialMedia, string> = {
  carrossel: 'Carrossel',
  estatico: 'Estático',
  reel: 'Reel',
  outro: 'Outro',
}

export const FORMATOS_SOCIAL_MEDIA: FormatoSocialMedia[] = [
  'carrossel',
  'estatico',
  'reel',
  'outro',
]

export const statusSocialMediaLabel: Record<StatusSocialMedia, string> = {
  pendente: 'Pendente',
  design: 'Design',
  design_finalizado: 'Design Finalizado',
  alteracao: 'Alteração',
  em_aprovacao: 'Em Aprovação',
  conclusao: 'Concluído',
}

export const ESTEIRA_SOCIAL_MEDIA: StatusSocialMedia[] = [
  'pendente',
  'design',
  'design_finalizado',
  'alteracao',
  'em_aprovacao',
  'conclusao',
]

export function initials(name: string | null | undefined): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '').concat(parts[1]?.[0] ?? '').toUpperCase() || '??'
}

export function monthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-01')
}
