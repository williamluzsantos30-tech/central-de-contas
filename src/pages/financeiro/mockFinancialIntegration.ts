/**
 * Integração FINANCEIRA externa — estrutura (mock), espelhando o padrão da
 * integração de CRM (mockIntegrations do Comercial). Cada conta conecta a
 * ferramenta financeira que já usa (Conta Azul, Omie, Bling ou webhook
 * genérico); as despesas recebidas por lá chegam com `origem =
 * "integracao_externa"` e `origemDetalhe` preenchido, e entram na tela de
 * Despesas sem opção de exclusão (a fonte de verdade é a ferramenta externa;
 * o domus.agn só edita metadados internos — categoria e setor).
 *
 * Tudo mock: presets com mapeamento sugerido + `receiveWebhookDespesa()`
 * estruturado como o endpoint real, e `fakeFinancialPayload()` pro botão de
 * simulação.
 */
import type { CategoriaDespesa, Despesa } from './mockDespesas'
import { mesAtualISO } from './despesasCalculator'

export type FinProvider = 'conta_azul' | 'omie' | 'bling' | 'webhook_generico'

/** Campo interno da Despesa que um campo externo pode alimentar. */
export type FinCampoInterno = 'descricao' | 'valor' | 'categoria' | 'setor' | 'fornecedor' | 'dataCompetencia'

export const FIN_CAMPOS_INTERNOS: { key: FinCampoInterno; label: string }[] = [
  { key: 'descricao', label: 'Descrição' },
  { key: 'valor', label: 'Valor' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'setor', label: 'Setor' },
  { key: 'fornecedor', label: 'Fornecedor' },
  { key: 'dataCompetencia', label: 'Competência' },
]

export interface FinMapeamentoCampo {
  externo: string
  interno: FinCampoInterno
}

export interface FinPreset {
  provider: FinProvider
  label: string
  instrucoes: string
  mapeamentoSugerido: FinMapeamentoCampo[]
}

export const FIN_PRESETS: FinPreset[] = [
  {
    provider: 'conta_azul',
    label: 'Conta Azul',
    instrucoes: 'No Conta Azul, vá em Configurações › Integrações › Webhooks e cole esta URL.',
    mapeamentoSugerido: [
      { externo: 'descricao', interno: 'descricao' },
      { externo: 'valor', interno: 'valor' },
      { externo: 'categoria', interno: 'categoria' },
      { externo: 'centro_custo', interno: 'setor' },
      { externo: 'fornecedor', interno: 'fornecedor' },
      { externo: 'competencia', interno: 'dataCompetencia' },
    ],
  },
  {
    provider: 'omie',
    label: 'Omie',
    instrucoes: 'Na Omie, configure um Webhook de Contas a Pagar apontando para esta URL.',
    mapeamentoSugerido: [
      { externo: 'observacao', interno: 'descricao' },
      { externo: 'valor_documento', interno: 'valor' },
      { externo: 'categoria', interno: 'categoria' },
      { externo: 'departamento', interno: 'setor' },
      { externo: 'nome_fornecedor', interno: 'fornecedor' },
      { externo: 'data_previsao', interno: 'dataCompetencia' },
    ],
  },
  {
    provider: 'bling',
    label: 'Bling',
    instrucoes: 'No Bling, vá em Preferências › Integrações › Webhooks e cole esta URL.',
    mapeamentoSugerido: [
      { externo: 'historico', interno: 'descricao' },
      { externo: 'valor', interno: 'valor' },
      { externo: 'categoria', interno: 'categoria' },
      { externo: 'centroCusto', interno: 'setor' },
      { externo: 'fornecedor', interno: 'fornecedor' },
      { externo: 'competencia', interno: 'dataCompetencia' },
    ],
  },
  {
    provider: 'webhook_generico',
    label: 'Personalizado (Webhook genérico)',
    instrucoes: 'Configure seu sistema pra fazer POST com JSON nesta URL. Mapeie os campos abaixo.',
    mapeamentoSugerido: [
      { externo: 'description', interno: 'descricao' },
      { externo: 'amount', interno: 'valor' },
      { externo: 'category', interno: 'categoria' },
      { externo: 'cost_center', interno: 'setor' },
      { externo: 'supplier', interno: 'fornecedor' },
      { externo: 'competence', interno: 'dataCompetencia' },
    ],
  },
]

export const finPresetLabel = (p: FinProvider) => FIN_PRESETS.find((x) => x.provider === p)?.label ?? p

export type StatusIntegracaoFin = 'conectado' | 'nao_configurado'

export interface FinIntegracaoConfig {
  provider: FinProvider
  webhookUrl: string
  token: string
  status: StatusIntegracaoFin
  ultimoEm?: string | null
  mapeamento: FinMapeamentoCampo[]
}

const ACCOUNT_ID = 'acc_movmed_demo'

export function gerarTokenFin(): string {
  return 'fin_' + Array.from({ length: 20 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
  ).join('')
}

export function gerarWebhookUrlFin(accountId: string, token: string): string {
  return `https://api.domusagn.com/webhooks/despesas/${accountId}/${token}`
}

/** Config inicial: ainda não configurado (Conta Azul pré-selecionado). */
export const INTEGRACAO_FIN_INICIAL: FinIntegracaoConfig = (() => {
  const token = gerarTokenFin()
  return {
    provider: 'conta_azul',
    webhookUrl: gerarWebhookUrlFin(ACCOUNT_ID, token),
    token,
    status: 'nao_configurado',
    ultimoEm: null,
    mapeamento: FIN_PRESETS[0].mapeamentoSugerido,
  }
})()

/** Mapeia rótulos livres de categoria vindos do sistema externo → enum interno. */
function normalizaCategoria(raw?: string): CategoriaDespesa {
  const s = (raw ?? '').toLowerCase()
  if (s.includes('imposto') || s.includes('tribut')) return 'impostos'
  if (s.includes('comerc') || s.includes('marketing') || s.includes('vend')) return 'despesa_comercial'
  if (s.includes('financ') || s.includes('juro') || s.includes('banc')) return 'despesa_financeira'
  if (s.includes('variáv') || s.includes('variav')) return 'custo_variavel'
  if (s.includes('fixo')) return 'custo_fixo'
  return 'despesa_administrativa'
}

/** Payload fictício de uma ferramenta financeira, pro botão "Simular". */
export function fakeFinancialPayload(provider: FinProvider): Record<string, string> {
  const amostras = [
    { descricao: 'Assinatura de e-mail corporativo', valor: '210', categoria: 'Administrativa', centro: 'Administrativo', fornecedor: 'Google Workspace' },
    { descricao: 'Anúncios institucionais', valor: '1500', categoria: 'Comercial / Marketing', centro: 'Comercial', fornecedor: 'Meta' },
    { descricao: 'Tarifa bancária mensal', valor: '89', categoria: 'Financeira', centro: 'Geral', fornecedor: 'Banco Inter' },
    { descricao: 'Notebook para novo colaborador', valor: '4200', categoria: 'Custo Fixo', centro: 'Design', fornecedor: 'Kabum' },
  ]
  const b = amostras[Math.floor(Math.random() * amostras.length)]
  const comp = mesAtualISO()
  if (provider === 'omie') return { observacao: b.descricao, valor_documento: b.valor, categoria: b.categoria, departamento: b.centro, nome_fornecedor: b.fornecedor, data_previsao: comp }
  if (provider === 'bling') return { historico: b.descricao, valor: b.valor, categoria: b.categoria, centroCusto: b.centro, fornecedor: b.fornecedor, competencia: comp }
  if (provider === 'webhook_generico') return { description: b.descricao, amount: b.valor, category: b.categoria, cost_center: b.centro, supplier: b.fornecedor, competence: comp }
  return { descricao: b.descricao, valor: b.valor, categoria: b.categoria, centro_custo: b.centro, fornecedor: b.fornecedor, competencia: comp }
}

/**
 * "Endpoint" mockado: aplica o mapeamento sobre o payload cru e devolve uma
 * Despesa com origem = integração externa (rastreável, não editável como
 * registro financeiro).
 */
export function receiveWebhookDespesa(payload: Record<string, string>, config: FinIntegracaoConfig): Despesa {
  const campos: Partial<Record<FinCampoInterno, string>> = {}
  for (const m of config.mapeamento) {
    const v = payload[m.externo]
    if (v != null && v !== '') campos[m.interno] = v
  }
  const provedor = finPresetLabel(config.provider)
  const comp = (campos.dataCompetencia || mesAtualISO()).slice(0, 7)
  return {
    id: `desp-ext-${Date.now()}`,
    descricao: campos.descricao || 'Despesa importada',
    categoria: normalizaCategoria(campos.categoria),
    setor: campos.setor || 'Geral',
    valor: Math.max(0, Number(campos.valor) || 0),
    tipoRecorrencia: 'unica',
    dataCompetencia: comp,
    status: 'pendente',
    fornecedor: campos.fornecedor || undefined,
    origem: 'integracao_externa',
    origemDetalhe: {
      provedor,
      idExterno: payload.id || payload.idExterno || `${config.provider.toUpperCase()}-${Math.floor(Math.random() * 1e6)}`,
      sincronizadoEm: new Date().toISOString().slice(0, 19),
    },
  }
}
