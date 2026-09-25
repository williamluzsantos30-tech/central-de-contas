/**
 * Integração com CRM externo — camada CONFIGURÁVEL POR CONTA (SaaS multi-tenant).
 *
 * Cada conta escolhe o CRM que já usa (RD Station, HubSpot, Pipedrive, Kommo,
 * ActiveCampaign, Meta Ads ou webhook genérico). Os leads recebidos por lá
 * caem, via webhook, na MESMA Caixa de Entrada do Comercial que recebe a
 * prospecção do Social Selling.
 *
 * Como a integração real depende de credenciais, aqui é tudo mock: presets com
 * mapeamento sugerido, uma config de exemplo já "Conectado" e um
 * `receiveWebhookLead()` estruturado como se fosse o endpoint real — aplica o
 * mapeamento de campos e devolve um Lead pronto pra Caixa de Entrada.
 */
import type { Lead } from './mockLeads'

const todayISO = () => new Date().toISOString().slice(0, 10)

export type CrmProvider =
  | 'rd_station'
  | 'hubspot'
  | 'pipedrive'
  | 'kommo'
  | 'activecampaign'
  | 'meta_ads'
  | 'webhook_generico'

/** Campo interno do Lead que um campo externo do CRM pode alimentar. */
export type CampoInterno = 'nomeContato' | 'empresa' | 'telefone' | 'email' | 'origem' | 'especialidade'

export const CAMPOS_INTERNOS: { key: CampoInterno; label: string }[] = [
  { key: 'nomeContato', label: 'Nome' },
  { key: 'empresa', label: 'Empresa / Clínica' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'origem', label: 'Origem / Canal' },
  { key: 'especialidade', label: 'Especialidade' },
]

/** Uma linha do mapeamento: campo que vem do CRM → campo interno do Lead. */
export interface MapeamentoCampo {
  externo: string
  interno: CampoInterno
}

export interface CrmPreset {
  provider: CrmProvider
  label: string
  /** Instruções resumidas de onde colar a URL do webhook. */
  instrucoes: string
  /** Mapeamento sugerido pros nomes de campo típicos daquele CRM. */
  mapeamentoSugerido: MapeamentoCampo[]
}

export const CRM_PRESETS: CrmPreset[] = [
  {
    provider: 'rd_station',
    label: 'RD Station',
    instrucoes: 'No RD Station, vá em Integrações › Webhooks, crie um novo webhook e cole esta URL.',
    mapeamentoSugerido: [
      { externo: 'name', interno: 'nomeContato' },
      { externo: 'company', interno: 'empresa' },
      { externo: 'personal_phone', interno: 'telefone' },
      { externo: 'email', interno: 'email' },
      { externo: 'source', interno: 'origem' },
      { externo: 'cf_especialidade', interno: 'especialidade' },
    ],
  },
  {
    provider: 'hubspot',
    label: 'HubSpot',
    instrucoes: 'No HubSpot, use Workflows › Webhook (ou Settings › Integrations › Webhooks) e cole esta URL.',
    mapeamentoSugerido: [
      { externo: 'firstname', interno: 'nomeContato' },
      { externo: 'company', interno: 'empresa' },
      { externo: 'phone', interno: 'telefone' },
      { externo: 'email', interno: 'email' },
      { externo: 'hs_analytics_source', interno: 'origem' },
    ],
  },
  {
    provider: 'pipedrive',
    label: 'Pipedrive',
    instrucoes: 'No Pipedrive, vá em Ferramentas e Configurações › Webhooks e cole esta URL.',
    mapeamentoSugerido: [
      { externo: 'name', interno: 'nomeContato' },
      { externo: 'org_name', interno: 'empresa' },
      { externo: 'phone', interno: 'telefone' },
      { externo: 'email', interno: 'email' },
      { externo: 'source_channel', interno: 'origem' },
    ],
  },
  {
    provider: 'kommo',
    label: 'Kommo',
    instrucoes: 'No Kommo, vá em Configurações › Integrações › Webhooks e cole esta URL.',
    mapeamentoSugerido: [
      { externo: 'name', interno: 'nomeContato' },
      { externo: 'company_name', interno: 'empresa' },
      { externo: 'phone', interno: 'telefone' },
      { externo: 'email', interno: 'email' },
      { externo: 'pipeline', interno: 'origem' },
    ],
  },
  {
    provider: 'activecampaign',
    label: 'ActiveCampaign',
    instrucoes: 'No ActiveCampaign, use Automations com a ação "Webhook" e cole esta URL.',
    mapeamentoSugerido: [
      { externo: 'first_name', interno: 'nomeContato' },
      { externo: 'orgname', interno: 'empresa' },
      { externo: 'phone', interno: 'telefone' },
      { externo: 'email', interno: 'email' },
      { externo: 'source', interno: 'origem' },
    ],
  },
  {
    provider: 'meta_ads',
    label: 'Meta Ads (Lead Ads)',
    instrucoes: 'Conecte a página no Gerenciador de Leads da Meta e aponte o Lead Ads para esta URL.',
    mapeamentoSugerido: [
      { externo: 'full_name', interno: 'nomeContato' },
      { externo: 'phone_number', interno: 'telefone' },
      { externo: 'email', interno: 'email' },
      { externo: 'ad_name', interno: 'origem' },
    ],
  },
  {
    provider: 'webhook_generico',
    label: 'Personalizado (Webhook genérico)',
    instrucoes: 'Configure seu sistema para fazer um POST com JSON nesta URL. Mapeie os campos abaixo.',
    mapeamentoSugerido: [
      { externo: 'name', interno: 'nomeContato' },
      { externo: 'company', interno: 'empresa' },
      { externo: 'phone', interno: 'telefone' },
      { externo: 'email', interno: 'email' },
      { externo: 'source', interno: 'origem' },
    ],
  },
]

export function presetLabel(provider: CrmProvider): string {
  return CRM_PRESETS.find((p) => p.provider === provider)?.label ?? provider
}

// ── Sincronização de SAÍDA (Sistema → CRM) ────────────────────────────────
/** Desfechos do Closer que viram atualização de status no CRM. */
export type StatusSaida = 'fechou' | 'perdido' | 'no_show' | 'followup'

export const STATUS_SAIDA: { key: StatusSaida; label: string; efeito: string }[] = [
  { key: 'fechou', label: 'Fechou', efeito: 'Negócio ganho + valor do contrato' },
  { key: 'perdido', label: 'Não fechou', efeito: 'Negócio perdido + motivo na nota' },
  { key: 'no_show', label: 'No-show', efeito: 'Estágio intermediário e/ou nota com a nova data' },
  { key: 'followup', label: 'Em follow-up', efeito: 'Negócio segue aberto + nota com o próximo contato' },
]

/**
 * Como cada provedor recebe a escrita: nomes de campo da API e estágios
 * sugeridos por desfecho. Estágio vazio = mantém o estágio atual no CRM e só
 * registra a nota (quando o provedor suporta).
 */
export interface SaidaProvedor {
  suportaEscrita: boolean
  campoEstagio: string
  campoValor: string
  campoMotivo: string
  campoNota: string
  statusSugerido: Record<StatusSaida, string>
  dica: string
}

export const SAIDA_POR_PROVEDOR: Record<CrmProvider, SaidaProvedor> = {
  rd_station: {
    suportaEscrita: true,
    campoEstagio: 'deal_stage',
    campoValor: 'amount_total',
    campoMotivo: 'deal_lost_reason',
    campoNota: 'annotation',
    statusSugerido: { fechou: 'Ganho', perdido: 'Perdido', no_show: 'Reunião não realizada', followup: 'Em negociação' },
    dica: 'No RD Station CRM, ganho/perdido marcam o negócio como fechado; os demais são nomes de etapa do funil.',
  },
  hubspot: {
    suportaEscrita: true,
    campoEstagio: 'dealstage',
    campoValor: 'amount',
    campoMotivo: 'closed_lost_reason',
    campoNota: 'hs_note_body',
    statusSugerido: { fechou: 'closedwon', perdido: 'closedlost', no_show: 'appointmentscheduled', followup: 'presentationscheduled' },
    dica: 'Use o ID interno da etapa do pipeline de negócios (ex.: closedwon, closedlost).',
  },
  pipedrive: {
    suportaEscrita: true,
    campoEstagio: 'status',
    campoValor: 'value',
    campoMotivo: 'lost_reason',
    campoNota: 'note',
    statusSugerido: { fechou: 'won', perdido: 'lost', no_show: 'open', followup: 'open' },
    dica: 'No Pipedrive o status do negócio é won / lost / open; no-show e follow-up mantêm aberto e viram nota/atividade.',
  },
  kommo: {
    suportaEscrita: true,
    campoEstagio: 'status_id',
    campoValor: 'price',
    campoMotivo: 'loss_reason',
    campoNota: 'note_text',
    statusSugerido: { fechou: '142', perdido: '143', no_show: 'Reunião não realizada', followup: 'Negociação' },
    dica: 'No Kommo, 142 (Venda ganha) e 143 (Venda perdida) são IDs fixos; os demais são etapas do seu funil.',
  },
  activecampaign: {
    suportaEscrita: true,
    campoEstagio: 'status',
    campoValor: 'value',
    campoMotivo: 'note',
    campoNota: 'note',
    statusSugerido: { fechou: '1', perdido: '2', no_show: '0', followup: '0' },
    dica: 'No ActiveCampaign o status do deal é 0 (aberto), 1 (ganho) ou 2 (perdido); o motivo vai como nota.',
  },
  meta_ads: {
    suportaEscrita: false,
    campoEstagio: '',
    campoValor: '',
    campoMotivo: '',
    campoNota: '',
    statusSugerido: { fechou: '', perdido: '', no_show: '', followup: '' },
    dica: 'O Lead Ads da Meta só ENVIA leads — não é um CRM e não aceita escrita de volta.',
  },
  webhook_generico: {
    suportaEscrita: true,
    campoEstagio: 'status',
    campoValor: 'value',
    campoMotivo: 'lost_reason',
    campoNota: 'note',
    statusSugerido: { fechou: 'won', perdido: 'lost', no_show: 'no_show', followup: 'follow_up' },
    dica: 'Enviamos um POST JSON para a URL de saída com os campos abaixo; use os valores que seu sistema espera.',
  },
}

export type StatusIntegracao = 'conectado' | 'nao_configurado'

export interface IntegracaoConfig {
  provider: CrmProvider
  webhookUrl: string
  token: string
  status: StatusIntegracao
  ultimoLeadEm?: string | null
  mapeamento: MapeamentoCampo[]
  /** Sincronização bidirecional ligada (Social Selling cria / Closer atualiza no CRM). */
  escritaAtiva: boolean
  /** Estágio/status do CRM correspondente a cada desfecho interno. */
  mapeamentoStatus: Record<StatusSaida, string>
  /** Só pro webhook genérico: pra onde enviar os eventos de saída. */
  webhookSaidaUrl?: string
}

/** A integração pode escrever no CRM agora? (conectada + escrita ligada + provedor suporta) */
export function escritaHabilitada(cfg: IntegracaoConfig): boolean {
  return cfg.status === 'conectado' && cfg.escritaAtiva && SAIDA_POR_PROVEDOR[cfg.provider].suportaEscrita
}

/** Completa uma config salva (possivelmente antiga) com os campos novos. */
export function normalizarIntegracao(raw: Partial<IntegracaoConfig> | null | undefined): IntegracaoConfig {
  if (!raw || !raw.provider) return INTEGRACAO_INICIAL
  return {
    ...INTEGRACAO_INICIAL,
    ...raw,
    mapeamento: raw.mapeamento ?? INTEGRACAO_INICIAL.mapeamento,
    escritaAtiva: raw.escritaAtiva ?? true,
    mapeamentoStatus: { ...SAIDA_POR_PROVEDOR[raw.provider].statusSugerido, ...(raw.mapeamentoStatus ?? {}) },
  }
}

// Conta de exemplo (mock).
const ACCOUNT_ID = 'acc_movmed_demo'

export function gerarToken(): string {
  return Array.from({ length: 24 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
  ).join('')
}

export function gerarWebhookUrl(accountId: string, token: string): string {
  return `https://api.domusagn.com/webhooks/leads/${accountId}/${token}`
}

/** Config inicial de exemplo: RD Station já conectado. */
export const INTEGRACAO_INICIAL: IntegracaoConfig = (() => {
  const token = 'tok_rd_9f3a1c72e4b8'
  return {
    provider: 'rd_station',
    webhookUrl: gerarWebhookUrl(ACCOUNT_ID, token),
    token,
    status: 'conectado',
    ultimoLeadEm: '2026-09-20',
    mapeamento: CRM_PRESETS.find((p) => p.provider === 'rd_station')!.mapeamentoSugerido,
    escritaAtiva: true,
    mapeamentoStatus: { ...SAIDA_POR_PROVEDOR.rd_station.statusSugerido },
  }
})()

/** ID de registro no formato típico de cada CRM (mock). */
export function gerarIdExterno(provider: CrmProvider): string {
  const n = (digitos: number) => String(Math.floor(Math.random() * 10 ** digitos)).padStart(digitos, '0')
  switch (provider) {
    case 'rd_station':
      return `rd_${n(5)}`
    case 'hubspot':
      return `hs_${n(7)}`
    case 'pipedrive':
      return `pd_${n(4)}`
    case 'kommo':
      return `km_${n(8)}`
    case 'activecampaign':
      return `ac_${n(5)}`
    default:
      return `ext_${n(6)}`
  }
}

/** Payload fake de um CRM, pro botão "Simular Lead Recebido via Webhook". */
export function fakeWebhookPayload(provider: CrmProvider): Record<string, string> {
  const amostras: {
    name: string
    company: string
    personal_phone: string
    email: string
    source: string
    cf_especialidade: string
    extras: Record<string, string>
  }[] = [
    {
      name: 'Dr. Túlio Barreto', company: 'Clínica Barreto', personal_phone: '(11) 90000-7777', email: 'tulio@barreto.com', source: 'Anúncio Meta', cf_especialidade: 'Cardiologia',
      // Campos EXTRA do formulário (não mapeados) → caem em dadosOriginaisCRM
      extras: { 'Quanto você fatura por mês': 'R$ 60 a 80 mil', 'Já investe em anúncios?': 'Sim, no Meta', 'Melhor horário pra contato': 'Manhã' },
    },
    {
      name: 'Dra. Paula Andrade', company: 'Andrade Estética', personal_phone: '(21) 90000-8888', email: 'paula@andradeestetica.com', source: 'Anúncio Google', cf_especialidade: 'Dermatologia',
      extras: { 'Nº de unidades': '2', 'Principal objetivo': 'Escalar aquisição' },
    },
    {
      name: 'Dr. Ivan Correia', company: 'Instituto Correia', personal_phone: '(31) 90000-9999', email: 'ivan@correia.com', source: 'Formulário do site', cf_especialidade: 'Ortopedia',
      extras: { 'Cidade': 'Belo Horizonte - MG', 'Como conheceu a gente': 'Indicação de colega', 'Urgência': 'Alta' },
    },
  ]
  const base = amostras[Math.floor(Math.random() * amostras.length)]
  // ID do registro no CRM de origem — vira o crmExternoId do Lead.
  const extras = { ...base.extras, [CAMPO_ID_ENTRADA[provider]]: gerarIdExterno(provider) }
  // Adapta as CHAVES mapeadas ao provedor (cada CRM nomeia diferente) e sempre
  // anexa os EXTRAS (chaves não mapeadas) pra exercitar o dadosOriginaisCRM.
  if (provider === 'hubspot') return { firstname: base.name, company: base.company, phone: base.personal_phone, email: base.email, hs_analytics_source: base.source, ...extras }
  if (provider === 'meta_ads') return { full_name: base.name, phone_number: base.personal_phone, email: base.email, ad_name: base.source, ...extras }
  if (provider === 'pipedrive') return { name: base.name, org_name: base.company, phone: base.personal_phone, email: base.email, source_channel: base.source, ...extras }
  return { name: base.name, company: base.company, personal_phone: base.personal_phone, email: base.email, source: base.source, cf_especialidade: base.cf_especialidade, ...extras }
}

/** Campo do payload de entrada que traz o ID do registro no CRM. */
export const CAMPO_ID_ENTRADA: Record<CrmProvider, string> = {
  rd_station: 'id',
  hubspot: 'hs_object_id',
  pipedrive: 'id',
  kommo: 'id',
  activecampaign: 'id',
  meta_ads: 'leadgen_id',
  webhook_generico: 'id',
}

/**
 * "Endpoint" mockado do webhook. Aplica o mapeamento configurado sobre o
 * payload cru do CRM e devolve um Lead pronto pra Caixa de Entrada.
 */
export function receiveWebhookLead(
  payload: Record<string, string>,
  config: IntegracaoConfig,
): Lead {
  const campos: Partial<Record<CampoInterno, string>> = {}
  for (const m of config.mapeamento) {
    const valor = payload[m.externo]
    if (valor != null && valor !== '') campos[m.interno] = valor
  }
  // ID do registro no CRM → vínculo pra sincronização de saída (Closer).
  const campoId = CAMPO_ID_ENTRADA[config.provider]
  const crmExternoId = payload[campoId] || undefined
  const podeEscrever = SAIDA_POR_PROVEDOR[config.provider].suportaEscrita

  // Tudo que NÃO foi mapeado pra um campo fixo cai em dadosOriginaisCRM
  // (schema livre — só contexto). Campanha nova com pergunta nova aparece
  // automaticamente, sem configurar nada.
  const usados = new Set([...config.mapeamento.map((m) => m.externo), campoId])
  const dadosOriginaisCRM = Object.entries(payload)
    .filter(([k, v]) => !usados.has(k) && v != null && v !== '')
    .map(([campo, valor]) => ({ campo, valor: String(valor) }))
  const hoje = todayISO()
  const nome = campos.nomeContato || 'Lead sem nome'
  // Sem origem mapeada = gap de rastreamento → "Sem Origem Identificada"
  // (canalOriginal fica indefinido; canalDoLead classifica pelo fallback).
  return {
    id: `lead-crm-${Date.now()}`,
    nomeContato: nome,
    empresa: campos.empresa || nome,
    telefone: campos.telefone || '',
    email: campos.email || undefined,
    origem: campos.origem || 'Sem Origem Identificada',
    etapaFunil: 'caixa_entrada',
    origemEntrada: 'crm_externo',
    crmProvider: presetLabel(config.provider),
    canalOriginal: campos.origem || undefined,
    especialidade: campos.especialidade || undefined,
    dadosOriginaisCRM: dadosOriginaisCRM.length ? dadosOriginaisCRM : undefined,
    dataEntrada: hoje,
    socialSellerId: '',
    dataCaptacao: hoje,
    qualificado: false,
    crmExternoId,
    crmExternoProvider: config.provider,
    // Veio do CRM → já nasce espelhado lá (se o provedor aceita escrita de volta).
    sincronizacaoCRM: crmExternoId && podeEscrever ? 'sincronizado' : 'nao_aplicavel',
    ultimaSincronizacaoCRM: crmExternoId && podeEscrever ? new Date().toISOString() : undefined,
  }
}
