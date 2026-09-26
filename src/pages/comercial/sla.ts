/**
 * Cálculo de SLA por etapa do funil comercial (centralizado, reusado nas 3
 * telas operacionais + Visão Executiva).
 *
 * O SLA é medido pelo tempo decorrido desde a ENTRADA na etapa atual vs. o
 * limite configurado daquela etapa:
 *   - no_prazo  (verde):   <= 70% do SLA
 *   - atencao   (laranja): > 70% e <= 100%
 *   - estourado (vermelho): > 100%
 *
 * Só as etapas "ativas" (caixa_entrada, em_qualificacao, reuniao_agendada,
 * em_negociacao) têm SLA — fechado/perdido/prospectado não são aplicáveis.
 */
import type { Lead } from './mockLeads'
import type { SlaConfigComercial } from './mockComercialConfig'

export type SlaStatus = 'no_prazo' | 'atencao' | 'estourado'

export interface SlaResultado {
  aplicavel: boolean
  status: SlaStatus
  decorridoMs: number
  limiteMs: number
  /** Tempo decorrido formatado (ex.: "3h47min", "2d 4h"). */
  label: string
}

const HORA_MS = 3_600_000

/** Timestamp de entrada na etapa atual + limite (horas) daquela etapa. */
function baseDaEtapa(lead: Lead, cfg: SlaConfigComercial): { entrada?: string; horas?: number } {
  switch (lead.etapaFunil) {
    case 'caixa_entrada':
      return { entrada: lead.dataEntrada ?? lead.dataCaptacao, horas: cfg.caixaPrimeiroContatoHoras }
    case 'em_qualificacao':
      // Se já houve tentativa de contato, o SLA passa a medir o cumprimento
      // do próximo contato agendado (follow-up), não mais o 1º contato.
      if ((lead.contadorTentativas ?? 0) > 0 && lead.proximoContato) {
        return { entrada: lead.proximoContato, horas: cfg.slaEntreTentativasHoras }
      }
      return { entrada: lead.dataEnvioSDR, horas: cfg.qualificacaoEnvioCloserHoras }
    case 'reuniao_agendada':
    case 'em_negociacao':
      return { entrada: lead.dataEnvioCloser, horas: cfg.closerCallHoras }
    default:
      return {}
  }
}

/** Próximo contato (follow-up do SDR) já venceu? */
export function proximoContatoVencido(lead: Lead): boolean {
  if (!lead.proximoContato) return false
  return Date.parse(lead.proximoContato) <= Date.now()
}

/** Data ("YYYY-MM-DD") ou data-hora ISO → ms (data pura = 00:00 local). */
function instante(iso: string): number {
  return Date.parse(iso.length <= 10 ? `${iso}T00:00:00` : iso)
}

/**
 * SLA do PRIMEIRO CONTATO (já ocorrido) de um lead: tempo entre a entrada na
 * Caixa e o SDR assumir/contatar (1ª tentativa ou envio ao SDR, o que vier
 * antes) vs. o limite `caixaPrimeiroContatoHoras` — o mesmo SLA que o
 * calculateLeadSLA aplica ao vivo na Caixa de Entrada. Usado na Performance
 * da Equipe (SDR). Sem contato ainda → não aplicável.
 */
export function slaPrimeiroContato(
  lead: Lead,
  cfg: SlaConfigComercial,
): { aplicavel: boolean; noPrazo: boolean; decorridoMs: number; limiteMs: number } {
  const entrada = lead.dataEntrada ?? lead.dataCaptacao
  const contatos = [lead.tentativasContato?.[0]?.data, lead.dataEnvioSDR].filter((x): x is string => !!x)
  if (!entrada || contatos.length === 0) return { aplicavel: false, noPrazo: false, decorridoMs: 0, limiteMs: 0 }
  const primeiro = Math.min(...contatos.map(instante))
  const decorridoMs = Math.max(0, primeiro - instante(entrada))
  const limiteMs = cfg.caixaPrimeiroContatoHoras * HORA_MS
  return { aplicavel: true, noPrazo: decorridoMs <= limiteMs, decorridoMs, limiteMs }
}

export function calculateLeadSLA(lead: Lead, cfg: SlaConfigComercial): SlaResultado {
  const { entrada, horas } = baseDaEtapa(lead, cfg)
  if (!entrada || !horas) {
    return { aplicavel: false, status: 'no_prazo', decorridoMs: 0, limiteMs: 0, label: '—' }
  }
  const inicio = instante(entrada)
  const decorridoMs = Math.max(0, Date.now() - inicio)
  const limiteMs = horas * HORA_MS
  const ratio = limiteMs > 0 ? decorridoMs / limiteMs : 0
  const status: SlaStatus = ratio > 1 ? 'estourado' : ratio > 0.7 ? 'atencao' : 'no_prazo'
  return { aplicavel: true, status, decorridoMs, limiteMs, label: formatDuracao(decorridoMs) }
}

/** ms → "45min" | "3h47min" | "2d 4h". */
export function formatDuracao(ms: number): string {
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const restoMin = min % 60
  if (h < 24) return restoMin > 0 ? `${h}h${restoMin}min` : `${h}h`
  const d = Math.floor(h / 24)
  const restoH = h % 24
  return restoH > 0 ? `${d}d ${restoH}h` : `${d}d`
}

/** Ordem de prioridade (menor = mais urgente): estourado → atenção → no prazo → n/a. */
export function slaPrioridade(r: SlaResultado): number {
  if (!r.aplicavel) return 3
  return r.status === 'estourado' ? 0 : r.status === 'atencao' ? 1 : 2
}

/** true quando o follow-up está vencido (data do próximo contato já passou). */
export function followupVencido(lead: Lead): boolean {
  if (lead.subStatusNegociacao !== 'em_followup' || !lead.dataProximoContato) return false
  const hoje = new Date().toISOString().slice(0, 10)
  return lead.dataProximoContato.slice(0, 10) <= hoje
}
