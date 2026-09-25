/**
 * Sincronização de SAÍDA com o CRM externo (Sistema → CRM) — metade nova da
 * integração bidirecional. A entrada (CRM → Caixa de Entrada) continua no
 * webhook de mockIntegrations.ts.
 *
 * Dois eventos disparam envio, AUTOMATICAMENTE, a partir do store:
 *   - 'criacao'     : Social Selling cadastra um lead → cria o registro no CRM
 *                     e guarda o ID devolvido (crmExternoId).
 *   - 'atualizacao' : Closer registra o resultado da call → atualiza o estágio
 *                     do negócio no CRM (ganho/perdido/no-show/follow-up).
 *
 * ESTRUTURA + SIMULAÇÃO: `syncLeadToCRM` é o ÚNICO ponto a trocar pela chamada
 * real à API do provedor configurado pelo tenant — os componentes e o store
 * não mudam. Hoje ele valida de forma determinística (config, vínculo,
 * mapeamento) e simula falhas transitórias (token/indisponibilidade/limite).
 */
import type { Lead } from './mockLeads'
import {
  SAIDA_POR_PROVEDOR,
  STATUS_SAIDA,
  escritaHabilitada,
  gerarIdExterno,
  presetLabel,
  type CampoInterno,
  type CrmProvider,
  type IntegracaoConfig,
  type StatusSaida,
} from './mockIntegrations'

export type TipoSync = 'criacao' | 'atualizacao'

/** Registro de uma tentativa de envio ao CRM (tabela crm_sync_logs). */
export interface LogSincronizacaoCRM {
  id: string
  leadId: string
  /** Nome do contato no momento do envio (pra exibir mesmo se o lead mudar). */
  leadNome: string
  tipo: TipoSync
  status: 'sucesso' | 'erro'
  provider: CrmProvider
  payloadEnviado: Record<string, unknown>
  respostaErro?: string
  timestamp: string // ISO
}

export type ResultadoSync =
  | { ok: true; crmExternoId: string; payload: Record<string, unknown> }
  | { ok: false; erro: string; payload: Record<string, unknown> }

/** Probabilidade de uma falha transitória na simulação (pra exercitar o retry). */
export const TAXA_FALHA_SIMULADA = 0.1

const ERROS_TRANSITORIOS = [
  'Token de acesso expirado (401). Reautentique a integração no CRM.',
  'CRM indisponível no momento (503). Tente novamente em instantes.',
  'Limite de requisições da API atingido (429). Aguarde e tente de novo.',
]

// ── Mapeamento de status ─────────────────────────────────────────────────────
/** Desfecho do Closer representado pelo estado atual do lead (null = nenhum). */
export function statusSaidaDoLead(lead: Lead): StatusSaida | null {
  if (lead.etapaFunil === 'fechado') return 'fechou'
  if (lead.etapaFunil === 'perdido' && lead.motivoPerda) return 'perdido'
  if (lead.etapaFunil === 'em_negociacao' && lead.subStatusNegociacao === 'no_show') return 'no_show'
  if (lead.etapaFunil === 'em_negociacao' && lead.subStatusNegociacao === 'em_followup') return 'followup'
  return null
}

export function statusSaidaLabel(s: StatusSaida): string {
  return STATUS_SAIDA.find((x) => x.key === s)?.label ?? s
}

/**
 * O lead pode receber ATUALIZAÇÃO no CRM ativo? Precisa estar vinculado a um
 * registro (crmExternoId) do MESMO provedor que está configurado agora.
 */
export function vinculadoAoCrmAtivo(lead: Lead, cfg: IntegracaoConfig): boolean {
  if (!lead.crmExternoId) return false
  return !lead.crmExternoProvider || lead.crmExternoProvider === cfg.provider
}

// ── Payloads (o que seria enviado à API) ─────────────────────────────────────
function valorInterno(lead: Lead, campo: CampoInterno): string | undefined {
  switch (campo) {
    case 'nomeContato':
      return lead.nomeContato
    case 'empresa':
      return lead.empresa
    case 'telefone':
      return lead.telefone
    case 'email':
      return lead.email
    case 'origem':
      return lead.canalOriginal ?? lead.origem
    case 'especialidade':
      return lead.especialidade
  }
}

const fmtDataBR = (iso?: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Criação: mapeamento de campos INVERTIDO (campo interno → nome no CRM). */
export function montarPayloadCriacao(lead: Lead, cfg: IntegracaoConfig): Record<string, unknown> {
  const saida = SAIDA_POR_PROVEDOR[cfg.provider]
  const p: Record<string, unknown> = {}
  for (const m of cfg.mapeamento) {
    const v = valorInterno(lead, m.interno)
    if (m.externo && v) p[m.externo] = v
  }
  if (lead.observacaoCaptacao && saida.campoNota) p[saida.campoNota] = lead.observacaoCaptacao
  p.origem_sistema = 'Social Selling · domus'
  if (cfg.provider === 'webhook_generico' && cfg.webhookSaidaUrl) p.evento = 'lead.criado'
  return p
}

/** Atualização: estágio mapeado + dados do desfecho (valor, motivo, nota). */
export function montarPayloadAtualizacao(lead: Lead, cfg: IntegracaoConfig): Record<string, unknown> {
  const saida = SAIDA_POR_PROVEDOR[cfg.provider]
  const st = statusSaidaDoLead(lead)
  const p: Record<string, unknown> = { id: lead.crmExternoId }
  if (!st) {
    // Sem desfecho do Closer: só re-envia os dados de contato.
    for (const m of cfg.mapeamento) {
      const v = valorInterno(lead, m.interno)
      if (m.externo && v) p[m.externo] = v
    }
    return p
  }
  const estagio = cfg.mapeamentoStatus[st]?.trim()
  if (estagio) p[saida.campoEstagio] = estagio
  if (st === 'fechou') {
    p[saida.campoValor] = lead.contratoFechado ?? lead.mrr ?? 0
    p[saida.campoNota] = `Negócio fechado · MRR ${lead.mrr ?? 0} · caixa recolhido ${lead.caixaRecolhido ?? 0}`
  }
  if (st === 'perdido') {
    if (saida.campoMotivo && saida.campoMotivo !== saida.campoNota) p[saida.campoMotivo] = lead.motivoPerda
    p[saida.campoNota] = `Não fechou — motivo: ${lead.motivoPerda ?? '—'}`
  }
  if (st === 'no_show') {
    p[saida.campoNota] = `No-show na reunião. Reagendada para ${fmtDataBR(lead.reuniao?.data)} ${lead.reuniao?.hora ?? ''}`.trim()
  }
  if (st === 'followup') {
    const ult = lead.historicoFollowups?.[lead.historicoFollowups.length - 1]?.observacao
    p[saida.campoNota] = `Follow-up: próximo contato em ${fmtDataBR(lead.dataProximoContato)}${ult ? ` — ${ult}` : ''}`
  }
  if (cfg.provider === 'webhook_generico' && cfg.webhookSaidaUrl) p.evento = `lead.${st}`
  return p
}

// ── Envio (simulado) ─────────────────────────────────────────────────────────
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Envia o lead ao CRM configurado. HOJE: simulação. NO FUTURO: trocar o bloco
 * marcado por `fetch` na API do provedor (com o token do tenant), mantendo a
 * mesma assinatura e o mesmo retorno.
 *
 * `forcar` existe pros botões de desenvolvimento em Configurações.
 */
export async function syncLeadToCRM(
  lead: Lead,
  tipo: TipoSync,
  cfg: IntegracaoConfig,
  opts?: { forcar?: 'sucesso' | 'erro' },
): Promise<ResultadoSync> {
  const payload = tipo === 'criacao' ? montarPayloadCriacao(lead, cfg) : montarPayloadAtualizacao(lead, cfg)
  const falha = (erro: string): ResultadoSync => ({ ok: false, erro, payload })

  // Latência de rede simulada.
  await esperar(350 + Math.random() * 450)

  // Validações determinísticas (valem também pra API real).
  if (!escritaHabilitada(cfg)) return falha(`Sincronização com o ${presetLabel(cfg.provider)} não está ativa para escrita.`)
  if (tipo === 'atualizacao' && !lead.crmExternoId)
    return falha('Lead sem vínculo com um registro no CRM (crmExternoId ausente).')
  if (tipo === 'criacao') {
    const mapeados = new Set(cfg.mapeamento.filter((m) => m.externo.trim()).map((m) => m.interno))
    if (!mapeados.has('nomeContato')) return falha('Erro de mapeamento: o campo "Nome" não está ligado a nenhum campo do CRM.')
    if (!mapeados.has('telefone')) return falha('Erro de mapeamento: o campo "Telefone" não está ligado a nenhum campo do CRM.')
  }
  if (tipo === 'atualizacao') {
    const st = statusSaidaDoLead(lead)
    if ((st === 'fechou' || st === 'perdido') && !cfg.mapeamentoStatus[st]?.trim())
      return falha(`Erro de mapeamento: o status "${statusSaidaLabel(st)}" não tem estágio correspondente no ${presetLabel(cfg.provider)}.`)
  }

  // ── Ponto de troca pela API real ──────────────────────────────────────────
  const transitoria = () => ERROS_TRANSITORIOS[Math.floor(Math.random() * ERROS_TRANSITORIOS.length)]
  if (opts?.forcar === 'erro') return falha(transitoria())
  if (opts?.forcar !== 'sucesso' && Math.random() < TAXA_FALHA_SIMULADA) return falha(transitoria())
  const crmExternoId = tipo === 'criacao' ? gerarIdExterno(cfg.provider) : lead.crmExternoId!
  return { ok: true, crmExternoId, payload }
}

export function novoLogId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
