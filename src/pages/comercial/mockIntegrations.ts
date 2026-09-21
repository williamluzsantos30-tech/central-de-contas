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

export type StatusIntegracao = 'conectado' | 'nao_configurado'

export interface IntegracaoConfig {
  provider: CrmProvider
  webhookUrl: string
  token: string
  status: StatusIntegracao
  ultimoLeadEm?: string | null
  mapeamento: MapeamentoCampo[]
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
  }
})()

/** Payload fake de um CRM, pro botão "Simular Lead Recebido via Webhook". */
export function fakeWebhookPayload(provider: CrmProvider): Record<string, string> {
  const amostras: Record<string, string>[] = [
    { name: 'Dr. Túlio Barreto', company: 'Clínica Barreto', personal_phone: '(11) 90000-7777', email: 'tulio@barreto.com', source: 'Anúncio Meta', cf_especialidade: 'Cardiologia' },
    { name: 'Dra. Paula Andrade', company: 'Andrade Estética', personal_phone: '(21) 90000-8888', email: 'paula@andradeestetica.com', source: 'Anúncio Google', cf_especialidade: 'Dermatologia' },
    { name: 'Dr. Ivan Correia', company: 'Instituto Correia', personal_phone: '(31) 90000-9999', email: 'ivan@correia.com', source: 'Formulário do site', cf_especialidade: 'Ortopedia' },
  ]
  const base = amostras[Math.floor(Math.random() * amostras.length)]
  // Adapta as CHAVES ao provedor escolhido (cada CRM nomeia diferente), pra
  // exercitar o mapeamento de campos configurado.
  if (provider === 'hubspot') return { firstname: base.name, company: base.company, phone: base.personal_phone, email: base.email, hs_analytics_source: base.source }
  if (provider === 'meta_ads') return { full_name: base.name, phone_number: base.personal_phone, email: base.email, ad_name: base.source }
  if (provider === 'pipedrive') return { name: base.name, org_name: base.company, phone: base.personal_phone, email: base.email, source_channel: base.source }
  return base // rd_station / genérico usam as chaves base
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
    dataEntrada: hoje,
    socialSellerId: '',
    dataCaptacao: hoje,
    qualificado: false,
  }
}
