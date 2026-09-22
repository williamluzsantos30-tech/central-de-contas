/**
 * Módulo FINANCEIRO — entidade Despesa (base do sistema financeiro).
 *
 * Toda despesa da empresa é lançada e categorizada aqui. É a fonte de dados
 * que os próximos módulos financeiros (DRE, Margens, LTV:CAC, DRE por Setor,
 * Comissionamento, Fluxo de Caixa) vão consumir — por isso os cálculos ficam
 * numa função reutilizável (`calculateExpensesSummary`, em ./despesasCalculator).
 *
 * PERSISTÊNCIA: por enquanto MOCK em memória (via DespesasProvider), com
 * `origem` e `origemDetalhe` já modelados pra futura integração financeira
 * (Conta Azul, Omie, Bling…). Datas em ISO string (padrão do projeto);
 * competência tem granularidade de mês ("YYYY-MM"), pagamento em dia ("YYYY-MM-DD").
 */
import type { Tone } from '@/components/ds'

export type CategoriaDespesa =
  | 'custo_fixo'
  | 'custo_variavel'
  | 'despesa_administrativa'
  | 'despesa_comercial'
  | 'impostos'
  | 'despesa_financeira'

export type TipoRecorrencia = 'unica' | 'mensal_fixa' | 'mensal_variavel'
export type StatusDespesa = 'pendente' | 'pago' | 'atrasado'
export type OrigemDespesa = 'manual' | 'integracao_externa'

/** Rastreabilidade da integração externa (preenchida quando origem = integração). */
export interface OrigemDetalhe {
  /** ex.: "Conta Azul", "Omie", "Bling", "Webhook Genérico". */
  provedor: string
  /** ID do registro na ferramenta externa — evita duplicidade em syncs futuros. */
  idExterno: string
  /** Quando foi sincronizado (ISO datetime). */
  sincronizadoEm: string
}

export interface Despesa {
  id: string
  descricao: string
  categoria: CategoriaDespesa
  /** Setor/centro de custo. "Geral" (ou vazio) quando não alocável. */
  setor?: string
  valor: number
  tipoRecorrencia: TipoRecorrencia
  /** Mês/ano de referência (regime de competência): "YYYY-MM". */
  dataCompetencia: string
  /** Quando foi efetivamente paga (regime de caixa): "YYYY-MM-DD". */
  dataPagamento?: string
  status: StatusDespesa
  fornecedor?: string
  observacao?: string

  origem: OrigemDespesa
  origemDetalhe?: OrigemDetalhe

  // ── Recorrência ────────────────────────────────────────────────────────
  /** Até quando repetir (mensal_*): "YYYY-MM" ou null/undefined = indeterminado. */
  repetirAte?: string | null
  /** Instância materializada de uma recorrência aponta pro id da despesa-modelo. */
  recorrenciaModeloId?: string
  /** Runtime-only: linha gerada por recorrência ainda não materializada (não persiste). */
  projecao?: boolean
}

// ── Metadados (labels + tom semântico) ──────────────────────────────────────

export const CATEGORIAS: { key: CategoriaDespesa; label: string; tone: Tone }[] = [
  { key: 'custo_fixo', label: 'Custo Fixo', tone: 'info' },
  { key: 'custo_variavel', label: 'Custo Variável', tone: 'purple' },
  { key: 'despesa_administrativa', label: 'Despesa Administrativa', tone: 'neutral' },
  { key: 'despesa_comercial', label: 'Despesa Comercial', tone: 'accent' },
  { key: 'impostos', label: 'Impostos', tone: 'warning' },
  { key: 'despesa_financeira', label: 'Despesa Financeira', tone: 'attention' },
]

export const RECORRENCIAS: { key: TipoRecorrencia; label: string; tone: Tone }[] = [
  { key: 'unica', label: 'Única', tone: 'neutral' },
  { key: 'mensal_fixa', label: 'Mensal Fixa', tone: 'info' },
  { key: 'mensal_variavel', label: 'Mensal Variável', tone: 'purple' },
]

export const STATUS_DESPESA: { key: StatusDespesa; label: string; tone: Tone }[] = [
  { key: 'pago', label: 'Pago', tone: 'success' },
  { key: 'pendente', label: 'Pendente', tone: 'attention' },
  { key: 'atrasado', label: 'Atrasado', tone: 'danger' },
]

/** Setores/centros de custo do sistema (+ "Geral" pra não alocável). */
export const SETORES_DESPESA = ['Tráfego', 'Social Media', 'Comercial', 'Design', 'Administrativo', 'Geral'] as const

export const categoriaInfo = (c: CategoriaDespesa) => CATEGORIAS.find((x) => x.key === c)!
export const recorrenciaInfo = (r: TipoRecorrencia) => RECORRENCIAS.find((x) => x.key === r)!
export const statusInfo = (s: StatusDespesa) => STATUS_DESPESA.find((x) => x.key === s)!
export const categoriaLabel = (c: CategoriaDespesa) => categoriaInfo(c).label
export const recorrenciaLabel = (r: TipoRecorrencia) => recorrenciaInfo(r).label

// ── Seed (mock) ──────────────────────────────────────────────────────────────
// Meses relativos a hoje pra a demo ficar sempre "atual".
const _now = new Date()
const _ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const mesRel = (delta: number) => _ym(new Date(_now.getFullYear(), _now.getMonth() + delta, 1))

export const MOCK_DESPESAS: Despesa[] = [
  // Recorrente MENSAL FIXA (valor repete todo mês) — folha da empresa (Geral).
  {
    id: 'desp-folha',
    descricao: 'Folha de Pagamento',
    categoria: 'custo_fixo',
    setor: 'Geral',
    valor: 48000,
    tipoRecorrencia: 'mensal_fixa',
    dataCompetencia: mesRel(-2),
    dataPagamento: `${mesRel(-2)}-05`,
    status: 'pago',
    fornecedor: 'Colaboradores CLT',
    repetirAte: null,
    origem: 'manual',
  },
  // Recorrente MENSAL VARIÁVEL (valor muda a cada mês) — energia.
  {
    id: 'desp-energia',
    descricao: 'Energia elétrica — sede',
    categoria: 'custo_variavel',
    setor: 'Administrativo',
    valor: 1820,
    tipoRecorrencia: 'mensal_variavel',
    dataCompetencia: mesRel(-2),
    dataPagamento: `${mesRel(-2)}-12`,
    status: 'pago',
    fornecedor: 'Enel',
    repetirAte: null,
    origem: 'manual',
  },
  // Software fixo (Design).
  {
    id: 'desp-figma',
    descricao: 'Assinatura Figma (time)',
    categoria: 'despesa_administrativa',
    setor: 'Design',
    valor: 380,
    tipoRecorrencia: 'mensal_fixa',
    dataCompetencia: mesRel(-3),
    dataPagamento: `${mesRel(-3)}-02`,
    status: 'pago',
    fornecedor: 'Figma Inc.',
    repetirAte: null,
    origem: 'manual',
  },
  // Ferramenta de agendamento (Social Media).
  {
    id: 'desp-mlabs',
    descricao: 'Ferramenta de agendamento social',
    categoria: 'custo_fixo',
    setor: 'Social Media',
    valor: 250,
    tipoRecorrencia: 'mensal_fixa',
    dataCompetencia: mesRel(-1),
    dataPagamento: `${mesRel(-1)}-03`,
    status: 'pago',
    fornecedor: 'mLabs',
    repetirAte: null,
    origem: 'manual',
  },
  // Impostos (mensal variável, Geral).
  {
    id: 'desp-simples',
    descricao: 'Simples Nacional (DAS)',
    categoria: 'impostos',
    setor: 'Geral',
    valor: 12500,
    tipoRecorrencia: 'mensal_variavel',
    dataCompetencia: mesRel(-1),
    dataPagamento: `${mesRel(-1)}-20`,
    status: 'pago',
    fornecedor: 'Receita Federal',
    repetirAte: null,
    origem: 'manual',
  },
  // Despesa financeira (juros de empréstimo, fixa).
  {
    id: 'desp-juros',
    descricao: 'Juros de empréstimo de capital de giro',
    categoria: 'despesa_financeira',
    setor: 'Geral',
    valor: 2200,
    tipoRecorrencia: 'mensal_fixa',
    dataCompetencia: mesRel(-2),
    dataPagamento: `${mesRel(-2)}-10`,
    status: 'pago',
    fornecedor: 'Banco Inter',
    repetirAte: null,
    origem: 'manual',
  },
  // Única do mês atual — pendente (Comercial).
  {
    id: 'desp-institucional',
    descricao: 'Impulsionamento institucional (branding)',
    categoria: 'despesa_comercial',
    setor: 'Comercial',
    valor: 3000,
    tipoRecorrencia: 'unica',
    dataCompetencia: mesRel(0),
    status: 'pendente',
    fornecedor: 'Meta',
    observacao: 'Campanha de marca do trimestre.',
    origem: 'manual',
  },
  // Comissão comercial do mês atual — variável, pendente (Comercial).
  {
    id: 'desp-comissao',
    descricao: 'Comissão comercial (closers)',
    categoria: 'despesa_comercial',
    setor: 'Comercial',
    valor: 5400,
    tipoRecorrencia: 'mensal_variavel',
    dataCompetencia: mesRel(0),
    status: 'pendente',
    repetirAte: null,
    origem: 'manual',
  },
  // Atrasada — competência no mês passado, ainda pendente e sem pagamento.
  {
    id: 'desp-manutencao',
    descricao: 'Manutenção de equipamentos',
    categoria: 'custo_variavel',
    setor: 'Design',
    valor: 640,
    tipoRecorrencia: 'unica',
    dataCompetencia: mesRel(-1),
    status: 'pendente',
    fornecedor: 'TecFix',
    origem: 'manual',
  },
  // Origem INTEGRAÇÃO EXTERNA — não editável/excluível como registro financeiro.
  {
    id: 'desp-contabilidade',
    descricao: 'Honorários de contabilidade',
    categoria: 'despesa_administrativa',
    setor: 'Administrativo',
    valor: 900,
    tipoRecorrencia: 'unica',
    dataCompetencia: mesRel(0),
    dataPagamento: `${mesRel(0)}-08`,
    status: 'pago',
    fornecedor: 'Contabilizei',
    origem: 'integracao_externa',
    origemDetalhe: {
      provedor: 'Conta Azul',
      idExterno: 'CA-2026-000912',
      sincronizadoEm: `${mesRel(0)}-08T09:14:00`,
    },
  },
]
