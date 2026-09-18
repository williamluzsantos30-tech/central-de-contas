/**
 * Configurações — mock estruturado por squad + parâmetros do sistema.
 *
 * As metas por squad são o portfólio real aplicado às fórmulas oficiais.
 * Os agregados de "Metas Mensais" NÃO são números soltos: derivam da soma
 * das metas dos squads operacionais (ver `agregadoMetas`).
 *
 * Fórmulas (parametrizadas por `churnLimitePct`):
 *   gapNRR       = 95 − (100 − churnLimite)              → 6% com churn 11%
 *   Nova Receita = MRR × gapNRR%
 *   Indicações   = máx(3, round(clientes ÷ 3))
 *   Logo Churn   = round(clientes × churnLimite%)
 *   Rev. Churn   = MRR × churnLimite%
 */

export interface Params {
  churnLimitePct: number
  slaOnboardingDias: number
  receitaAlta: number
  saudeAltaNps: number
  npsSatisfeito: number
  npsNeutro: number
  npsInsatisfeito: number
}

export const PARAMS_INICIAIS: Params = {
  churnLimitePct: 11,
  slaOnboardingDias: 30,
  receitaAlta: 4000,
  saudeAltaNps: 8,
  npsSatisfeito: 9,
  npsNeutro: 7,
  npsInsatisfeito: 6,
}

export interface SquadMetas {
  indicacoes: number
  novaReceita: number
  nrr: number // meta fixa (95)
  logoChurn: number // limite de clientes
  revChurn: number // limite de MRR perdido
}

export interface SquadAtual {
  novaReceita: number
  indicacoes: number
  nrr: number // %
  logoChurn: number
  revChurn: number
}

export interface Squad {
  id: string
  nome: string
  descricao: string | null
  lider: string | null
  /** id do profile líder (quando a fonte é o banco). O `lider` acima é o nome. */
  liderId?: string | null
  ativo: boolean
  hasLinkedClients: boolean
  clientes: number
  mrr: number
  metas: SquadMetas
  atual: SquadAtual
}

export type RoleTipo = 'operacional' | 'estrategico'
export type RoleEscopo = 'Squad' | 'Global'

export const PERMISSOES = [
  'Visualizar clientes',
  'Editar status',
  'Registrar NPS',
  'Registrar expansão',
  'Registrar churn',
  'Apenas leitura',
  // Acessos operacionais (antes eram "módulos" por cargo). Dobrados nos
  // papéis: um papel com esses acessos vê as respectivas áreas na sidebar.
  // Os labels batem com moduloLabel em @/lib/cargos.
  'Operacional Tráfego',
  'Operacional Webdesign',
  'Operacional Social Media',
] as const

export interface Role {
  id: string
  nome: string
  tipo: RoleTipo
  escopo: RoleEscopo
  permissoes: string[]
  jdPreenchida: boolean
  ativo: boolean
}

export interface TeamMember {
  id: string
  nome: string
  email: string | null
  papel: string | null
  squad: string | null
  ativo: boolean
}

/** Colaboradores pro dropdown de líder (Novo Squad). */
export const COLABORADORES = [
  'Agnaldo Junior',
  'Alexandre Fernandes',
  'Arlen Soares',
  'Beatriz Barros',
  'Bruno Gomes',
  'Diego Assis',
  'Glenda Lima',
  'Igor Mandau',
  'Igor Reis',
  'João Pedro Menezes',
  'João Pinto',
  'Jorge Luiz',
  'Lucas Portilho',
]

export const SQUADS_INICIAIS: Squad[] = [
  {
    id: 's-blackops',
    nome: 'BlackOps',
    descricao: null,
    lider: 'Lucas Portilho',
    ativo: true,
    hasLinkedClients: true,
    clientes: 32,
    mrr: 62824,
    metas: { indicacoes: 11, novaReceita: 3973, nrr: 95, logoChurn: 4, revChurn: 7283 },
    atual: { novaReceita: 0, indicacoes: 1, nrr: 87.6, logoChurn: 2, revChurn: 8885 },
  },
  {
    id: 's-delta',
    nome: 'Delta',
    descricao: null,
    lider: 'Alexandre Fernandes',
    ativo: true,
    hasLinkedClients: true,
    clientes: 32,
    mrr: 70347,
    metas: { indicacoes: 11, novaReceita: 4231, nrr: 95, logoChurn: 4, revChurn: 7757 },
    atual: { novaReceita: 16897, indicacoes: 0, nrr: 121.8, logoChurn: 3, revChurn: 4300 },
  },
  {
    id: 's-movseals',
    nome: 'MovSeals',
    descricao: null,
    lider: 'Jorge Luiz',
    ativo: true,
    hasLinkedClients: true,
    clientes: 27,
    mrr: 61126,
    metas: { indicacoes: 9, novaReceita: 3563, nrr: 95, logoChurn: 3, revChurn: 6533 },
    atual: { novaReceita: 7200, indicacoes: 4, nrr: 108.8, logoChurn: 1, revChurn: 1667 },
  },
  {
    id: 's-blackskull',
    nome: 'BlackSkull',
    descricao: null,
    lider: null,
    ativo: false,
    hasLinkedClients: true,
    clientes: 0,
    mrr: 0,
    metas: { indicacoes: 0, novaReceita: 0, nrr: 95, logoChurn: 0, revChurn: 0 },
    atual: { novaReceita: 0, indicacoes: 0, nrr: 0, logoChurn: 0, revChurn: 0 },
  },
  {
    id: 's-diretoria',
    nome: 'Diretoria',
    descricao: null,
    lider: 'João Pinto',
    ativo: false,
    hasLinkedClients: false,
    clientes: 0,
    mrr: 0,
    metas: { indicacoes: 0, novaReceita: 0, nrr: 95, logoChurn: 0, revChurn: 0 },
    atual: { novaReceita: 0, indicacoes: 0, nrr: 0, logoChurn: 0, revChurn: 0 },
  },
]

export const ROLES_INICIAIS: Role[] = [
  { id: 'r-am', nome: 'Account Manager', tipo: 'operacional', escopo: 'Squad', permissoes: ['Visualizar clientes', 'Apenas leitura', 'Editar status', 'Registrar NPS'], jdPreenchida: false, ativo: true },
  { id: 'r-comercial', nome: 'Comercial', tipo: 'operacional', escopo: 'Global', permissoes: [], jdPreenchida: false, ativo: true },
  { id: 'r-concierge', nome: 'Concierge', tipo: 'operacional', escopo: 'Squad', permissoes: ['Visualizar clientes', 'Apenas leitura'], jdPreenchida: true, ativo: true },
  { id: 'r-consultoria', nome: 'Consultoria', tipo: 'operacional', escopo: 'Squad', permissoes: [], jdPreenchida: false, ativo: true },
  { id: 'r-coordq', nome: 'Coordenador de Qualidade', tipo: 'estrategico', escopo: 'Global', permissoes: ['Visualizar clientes', 'Editar status', 'Registrar NPS'], jdPreenchida: true, ativo: true },
  { id: 'r-coordg', nome: 'Coordenador Geral', tipo: 'estrategico', escopo: 'Global', permissoes: ['Visualizar clientes', 'Registrar churn', 'Registrar NPS', 'Registrar expansão', 'Editar status'], jdPreenchida: true, ativo: true },
  { id: 'r-designer', nome: 'Designer', tipo: 'operacional', escopo: 'Squad', permissoes: ['Visualizar clientes', 'Apenas leitura'], jdPreenchida: false, ativo: true },
  { id: 'r-diretor', nome: 'Diretor', tipo: 'estrategico', escopo: 'Global', permissoes: ['Visualizar clientes', 'Editar status', 'Registrar NPS', 'Registrar expansão', 'Registrar churn', 'Apenas leitura'], jdPreenchida: false, ativo: true },
  { id: 'r-editorvideo', nome: 'Editor de Vídeo', tipo: 'operacional', escopo: 'Global', permissoes: ['Visualizar clientes', 'Apenas leitura'], jdPreenchida: false, ativo: true },
  { id: 'r-expcliente', nome: 'Experiência do Cliente', tipo: 'operacional', escopo: 'Squad', permissoes: ['Visualizar clientes', 'Editar status', 'Registrar NPS', 'Apenas leitura'], jdPreenchida: false, ativo: true },
  { id: 'r-gerenteop', nome: 'Gerente Operacional', tipo: 'estrategico', escopo: 'Global', permissoes: ['Visualizar clientes', 'Editar status', 'Registrar NPS', 'Registrar expansão', 'Registrar churn'], jdPreenchida: true, ativo: true },
  { id: 'r-gestortrafego', nome: 'Gestor de Tráfego', tipo: 'operacional', escopo: 'Squad', permissoes: ['Visualizar clientes', 'Apenas leitura'], jdPreenchida: false, ativo: true },
  { id: 'r-headconteudo', nome: 'Head de Conteúdo', tipo: 'estrategico', escopo: 'Global', permissoes: ['Apenas leitura', 'Editar status', 'Registrar NPS'], jdPreenchida: false, ativo: true },
  { id: 'r-headtrafego', nome: 'Head de Tráfego', tipo: 'estrategico', escopo: 'Global', permissoes: ['Visualizar clientes', 'Editar status', 'Registrar NPS'], jdPreenchida: true, ativo: true },
]

export const MEMBROS_INICIAIS: TeamMember[] = [
  { id: 'm-agnaldo', nome: 'Agnaldo Junior', email: 'agnaldo', papel: 'Experiência do Cliente', squad: null, ativo: true },
  { id: 'm-alexandre', nome: 'Alexandre Fernandes', email: 'alexandrefernandes', papel: 'Account Manager', squad: 'Delta', ativo: true },
  { id: 'm-arlen', nome: 'Arlen Soares', email: 'arlen', papel: 'Designer', squad: null, ativo: true },
  { id: 'm-arthur', nome: 'Arthur Almeida', email: null, papel: 'Editor de Vídeo', squad: null, ativo: false },
  { id: 'm-augusto', nome: 'Augusto Gomes', email: null, papel: 'Designer', squad: null, ativo: false },
  { id: 'm-beatriz', nome: 'Beatriz Barros', email: null, papel: 'Social Media', squad: null, ativo: true },
  { id: 'm-brenda', nome: 'Brenda Fonseca', email: null, papel: 'Social Media', squad: null, ativo: false },
  { id: 'm-bruno', nome: 'Bruno Gomes', email: null, papel: 'Head de Conteúdo', squad: null, ativo: true },
  { id: 'm-diego', nome: 'Diego Assis', email: null, papel: 'Diretor', squad: null, ativo: true },
  { id: 'm-glenda', nome: 'Glenda Lima', email: 'glendalima', papel: 'Social Media', squad: null, ativo: true },
  { id: 'm-icaro', nome: 'Ícaro Falcão', email: 'icaro', papel: 'Gestor de Tráfego', squad: 'BlackOps', ativo: false },
  { id: 'm-igorm', nome: 'Igor Mandau', email: null, papel: 'SDR', squad: null, ativo: true },
  { id: 'm-igorr', nome: 'Igor Reis', email: null, papel: 'Designer', squad: null, ativo: true },
]

/** Squads operacionais = ativos com portfólio (entram nas metas). */
export function squadsOperacionais(squads: Squad[]): Squad[] {
  return squads.filter((s) => s.ativo && s.clientes > 0)
}

export interface AgregadoMetas {
  metaDoMes: number
  metaMinima: number
  metaRecomendada: number
  squadsOperacionais: number
  indicacoesTotais: number
  limiteLogoChurn: number
  limiteRevChurn: number
}

/** Agregado derivado da soma das metas dos squads operacionais. */
export function agregadoMetas(squads: Squad[]): AgregadoMetas {
  const ops = squadsOperacionais(squads)
  const metaMinima = ops.reduce((s, x) => s + x.metas.novaReceita, 0)
  return {
    metaDoMes: metaMinima,
    metaMinima,
    metaRecomendada: Math.round(metaMinima * 1.75),
    squadsOperacionais: ops.length,
    indicacoesTotais: ops.reduce((s, x) => s + x.metas.indicacoes, 0),
    limiteLogoChurn: ops.reduce((s, x) => s + x.metas.logoChurn, 0),
    limiteRevChurn: ops.reduce((s, x) => s + x.metas.revChurn, 0),
  }
}

export type StatusTom = 'ok' | 'atencao' | 'critico'

/** Métrica de crescimento (nova receita, indicações, NRR): maior = melhor. */
export function statusCrescimento(atual: number, meta: number): { pct: number; tom: StatusTom } {
  const pct = meta > 0 ? Math.round((atual / meta) * 100) : 0
  const tom: StatusTom = pct >= 100 ? 'ok' : pct >= 50 ? 'atencao' : 'critico'
  return { pct, tom }
}

/** Métrica de limite (logo churn, rev churn): abaixo do limite = melhor. */
export function statusLimite(atual: number, limite: number): { label: string; tom: StatusTom; pct: number } {
  const ratio = limite > 0 ? atual / limite : 0
  const tom: StatusTom = ratio > 1 ? 'critico' : ratio >= 0.75 ? 'atencao' : 'ok'
  const label = tom === 'ok' ? 'Excelente' : tom === 'atencao' ? 'Atenção' : 'Crítico'
  return { label, tom, pct: Math.min(100, Math.round(ratio * 100)) }
}
