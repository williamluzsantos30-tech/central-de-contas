/**
 * Edição de Vídeo — Lote × Vídeo individual.
 *
 * LOTE: os vídeos de um cliente, em ordem de entrada (ordem, created_at),
 * fatiados de `tamanhoLote` em `tamanhoLote` (lote 1 = vídeos 1–2, lote 2 =
 * 3–4…). Posicional e estável: concluir um vídeo não muda o lote dos outros.
 * Não há tabela de lote — é a mesma regra "lote de 2 vídeos a cada 3 dias
 * úteis" que já existia (migration 023).
 *
 * VÍDEO: cada um tem o próprio status e o próprio SLA. O SLA só começa quando
 * o cliente aprova (aprovado_em): prazo = aprovado_em + slaDiasUteis dias
 * úteis. Sem aprovação → "aguardando" (não atrasa). A coluna `prazo` do banco
 * (calculada por fila a partir de created_at) não é usada nesta tela.
 */
import { calculateSLADeadline, diasDeAtraso } from '@/lib/dates'
import type { Cliente, EdicaoVideo } from '@/types/database'

export interface ConfigLote {
  tamanhoLote: number
  slaDiasUteis: number
}

export const LOTE_EDICAO_PADRAO: ConfigLote = { tamanhoLote: 2, slaDiasUteis: 3 }

export type EstadoSLA = 'aguardando' | 'no_prazo' | 'atrasado' | 'concluido'

export const ESTADO_SLA_LABEL: Record<EstadoSLA, string> = {
  aguardando: 'Aguardando aprovação',
  no_prazo: 'No prazo',
  atrasado: 'Atrasado',
  concluido: 'Concluído',
}

export interface SlaVideo {
  aprovado: boolean
  aprovadoEm: Date | null
  prazo: Date | null
  estado: EstadoSLA
  diasAtraso: number
}

export interface VideoEdicao {
  edicao: EdicaoVideo
  /** Posição do vídeo na sequência do cliente (1, 2, 3…). */
  posicao: number
  sla: SlaVideo
}

export interface LoteEdicao {
  id: string
  clienteId: string
  cliente: Cliente | null
  squad: string | null
  numero: number
  tamanhoLote: number
  slaDiasUteis: number
  videos: VideoEdicao[]
  concluidos: number
  atrasados: number
  /** Todos os vídeos que existem no lote estão concluídos. */
  concluido: boolean
  /** Último lote do cliente (onde entra o próximo vídeo). */
  ultimo: boolean
}

export function slaDoVideo(e: EdicaoVideo, cfg: ConfigLote, hoje: Date = new Date()): SlaVideo {
  const aprovadoEm = e.aprovado_em ? new Date(e.aprovado_em) : null
  const prazo = aprovadoEm ? calculateSLADeadline(aprovadoEm, cfg.slaDiasUteis) : null
  if (e.status === 'conclusao') return { aprovado: !!aprovadoEm, aprovadoEm, prazo, estado: 'concluido', diasAtraso: 0 }
  if (!aprovadoEm || !prazo) return { aprovado: false, aprovadoEm: null, prazo: null, estado: 'aguardando', diasAtraso: 0 }
  const atraso = diasDeAtraso(prazo, hoje)
  return { aprovado: true, aprovadoEm, prazo, estado: atraso > 0 ? 'atrasado' : 'no_prazo', diasAtraso: atraso }
}

const ordemEntrada = (a: EdicaoVideo, b: EdicaoVideo) =>
  (a.ordem ?? 0) - (b.ordem ?? 0) || a.created_at.localeCompare(b.created_at)

/** Todos os lotes (de todos os clientes), a partir da lista COMPLETA de vídeos. */
export function montarLotes(
  edicoes: EdicaoVideo[],
  clientes: Map<string, Cliente>,
  cfg: ConfigLote = LOTE_EDICAO_PADRAO,
  hoje: Date = new Date(),
): LoteEdicao[] {
  const porCliente = new Map<string, EdicaoVideo[]>()
  for (const e of edicoes) {
    const k = e.cliente_id ?? '__sem__'
    porCliente.set(k, [...(porCliente.get(k) ?? []), e])
  }
  const lotes: LoteEdicao[] = []
  for (const [clienteId, lista] of porCliente) {
    const ord = [...lista].sort(ordemEntrada)
    const cliente = clientes.get(clienteId) ?? lista[0]?.cliente ?? null
    const total = Math.ceil(ord.length / cfg.tamanhoLote)
    for (let n = 0; n < total; n++) {
      const videos = ord.slice(n * cfg.tamanhoLote, (n + 1) * cfg.tamanhoLote).map((edicao, i) => ({
        edicao,
        posicao: n * cfg.tamanhoLote + i + 1,
        sla: slaDoVideo(edicao, cfg, hoje),
      }))
      const concluidos = videos.filter((v) => v.sla.estado === 'concluido').length
      lotes.push({
        id: `${clienteId}#${n + 1}`,
        clienteId,
        cliente,
        squad: cliente?.squad ?? null,
        numero: n + 1,
        tamanhoLote: cfg.tamanhoLote,
        slaDiasUteis: cfg.slaDiasUteis,
        videos,
        concluidos,
        atrasados: videos.filter((v) => v.sla.estado === 'atrasado').length,
        concluido: concluidos === videos.length,
        ultimo: n === total - 1,
      })
    }
  }
  return lotes
}

/** Prazo do lote = o mais tardio entre os vídeos aprovados e não concluídos. */
export function prazoDoLote(l: LoteEdicao): Date | null {
  const prazos = l.videos.filter((v) => v.sla.estado === 'no_prazo' || v.sla.estado === 'atrasado').map((v) => v.sla.prazo!)
  return prazos.length ? new Date(Math.max(...prazos.map((d) => d.getTime()))) : null
}
