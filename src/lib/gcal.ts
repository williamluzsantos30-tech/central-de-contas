/**
 * Integração com Google Calendar via webhook n8n.
 *
 * Fluxo:
 *   - Front (CallAlinhamentoCell) chama agendarCallNoGCal() após salvar
 *     a data da call ou marcar como realizada
 *   - Função faz POST pro webhook do n8n com {titulo, data, autor_email,
 *     evento_id_existente?}
 *   - n8n cria/atualiza evento no Google Calendar via Service Account
 *     e retorna {event_id}
 *   - Front salva event_id em clientes.gcal_event_id pra próximos updates
 *     atualizarem o MESMO evento (sem duplicar)
 *
 * Configuração necessária (.env do projeto):
 *   VITE_GCAL_WEBHOOK_URL=https://n8n.movmed.com/webhook/agendar-call
 *   VITE_GCAL_WEBHOOK_TOKEN=<token-secreto>
 *
 * Se as env vars não estiverem definidas, a função vira no-op silencioso
 * (graceful degradation) — a data salva normalmente, só não cria evento.
 */
import { supabase } from '@/lib/supabase'

const WEBHOOK_URL = import.meta.env.VITE_GCAL_WEBHOOK_URL as string | undefined
const WEBHOOK_TOKEN = import.meta.env.VITE_GCAL_WEBHOOK_TOKEN as string | undefined

/** Configuração de horário/duração padrão da call. */
const HORA_INICIO = '14:00'
const DURACAO_MIN = 30

export interface AgendarCallPayload {
  clienteId: string
  clienteNome: string
  /** Data no formato YYYY-MM-DD (já ajustada pra dia útil) */
  data: string
  /** Email do usuário que está agendando — recebe o convite */
  autorEmail: string
  /** Nome do autor pra montar a descrição */
  autorNome?: string
  /** ID do evento existente — se preenchido, n8n atualiza em vez de criar */
  eventoExistente?: string | null
}

export interface AgendarCallResposta {
  ok: boolean
  /** ID do evento criado/atualizado (se ok) */
  eventId?: string
  /** Mensagem de erro (se !ok) */
  erro?: string
}

/**
 * Dispara o webhook do n8n e, se tiver event_id, persiste em clientes.
 * Não bloqueia: se o webhook falhar, loga no console e retorna {ok:false}
 * mas NÃO desfaz a atualização da data (a integração é "best effort").
 */
export async function agendarCallNoGCal(
  payload: AgendarCallPayload,
): Promise<AgendarCallResposta> {
  if (!WEBHOOK_URL) {
    // Integração não configurada — silencioso. A feature do GCal fica
    // dormente até VITE_GCAL_WEBHOOK_URL ser preenchida em .env.
    return { ok: false, erro: 'webhook-nao-configurado' }
  }

  const titulo = `Reunião de Alinhamento - ${payload.clienteNome}`
  const inicio = `${payload.data}T${HORA_INICIO}:00`
  const fim = somar(inicio, DURACAO_MIN)
  const descricao = [
    `Call mensal de alinhamento com ${payload.clienteNome}.`,
    payload.autorNome ? `Agendada por ${payload.autorNome}.` : null,
    'Evento criado automaticamente pela Central de Contas MovMed.',
  ]
    .filter(Boolean)
    .join('\n')

  const body = {
    titulo,
    descricao,
    data_inicio: inicio, // ISO local
    data_fim: fim,
    cliente_id: payload.clienteId,
    cliente_nome: payload.clienteNome,
    convidado_email: payload.autorEmail,
    evento_id_existente: payload.eventoExistente ?? null,
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(WEBHOOK_TOKEN ? { 'x-webhook-token': WEBHOOK_TOKEN } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn('[gcal] webhook retornou erro', res.status, txt)
      return { ok: false, erro: `http ${res.status}` }
    }
    const json = (await res.json().catch(() => ({}))) as { event_id?: string }
    const eventId = json.event_id ?? undefined

    // Persiste event_id pra próximos updates atualizarem o MESMO evento
    if (eventId && eventId !== payload.eventoExistente) {
      const { error } = await supabase
        .from('clientes')
        .update({ gcal_event_id: eventId })
        .eq('id', payload.clienteId)
      if (error) console.warn('[gcal] falha ao persistir event_id', error)
    }

    return { ok: true, eventId }
  } catch (e) {
    console.warn('[gcal] erro ao chamar webhook', e)
    return { ok: false, erro: String(e) }
  }
}

/** Soma N minutos a uma data ISO local (YYYY-MM-DDTHH:MM:SS). */
function somar(iso: string, minutos: number): string {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() + minutos)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`
}

/** Indica se a integração GCal está configurada. */
export function gcalEstaConfigurado(): boolean {
  return !!WEBHOOK_URL
}
