/**
 * Tarefas recorrentes como OCORRÊNCIAS — uma por período.
 *
 * A linha de `tarefas` é o MODELO (a regra); cada vez que ela precisa ser
 * feita é uma ocorrência: diária = cada dia útil, semanal = cada semana (no
 * dia de referência), mensal = cada mês (no dia de referência). Ocorrência
 * não concluída até o fim do período vira "perdida" — não acumula atraso.
 * Esporádica continua com uma ocorrência só (a data limite) e essa sim fica
 * "Atrasada {n}d".
 *
 * Só o que ACONTECEU é gravado (tarefa_ocorrencias: feita, quem, quando,
 * observação). Pendente/perdida saem do calendário — sem cron, e o histórico
 * vale retroativamente. Este arquivo é puro (sem supabase): datas ISO locais
 * 'YYYY-MM-DD', fins de semana não têm ocorrência.
 */
import type { FrequenciaTarefa, PrioridadeTarefa, Tarefa } from '@/types/database'

export type StatusOcorrencia = 'pendente' | 'feita' | 'perdida'

export interface TarefaModelo {
  id: string
  clienteId: string
  titulo: string
  frequencia: FrequenciaTarefa
  /** Semanal: dia da semana (1=seg … 5=sex). Mensal: dia do mês. */
  diaReferencia?: number
  prioridade: PrioridadeTarefa
  responsavelId?: string
  /** Veio do template padrão. */
  padrao: boolean
  ativa: boolean
  /** Primeiro dia com ocorrências contadas — antes disso nada é "perdida". */
  desde: string
  /** Esporádica: data limite (única ocorrência). */
  dataLimite?: string | null
  /** Esporádica já concluída. */
  concluida?: boolean
}

/** Linha gravada em tarefa_ocorrencias. */
export interface RegistroOcorrencia {
  id?: string
  tarefa_id: string
  data_prevista: string
  status: StatusOcorrencia
  concluida_em: string | null
  concluida_por: string | null
  observacao: string | null
}

export interface OcorrenciaTarefa {
  id: string
  modeloId: string
  dataPrevista: string
  inicioPeriodo: string
  /** Último dia do período (inclusive). Esporádica: null — não expira. */
  fimPeriodo: string | null
  status: StatusOcorrencia
  concluidaEm?: string
  concluidaPor?: string
  observacao?: string
}

// ── Datas (locais, sem fuso) ────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
export const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hojeISO = () => isoLocal(new Date())
export function parseDia(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDias(iso: string, n: number): string {
  const d = parseDia(iso)
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}
export const diasEntre = (de: string, ate: string) => Math.round((parseDia(ate).getTime() - parseDia(de).getTime()) / 86400000)
const diaDaSemana = (iso: string) => parseDia(iso).getDay()
export const ehDiaUtil = (iso: string) => {
  const w = diaDaSemana(iso)
  return w !== 0 && w !== 6
}
/** Segunda-feira da semana (seg–dom) que contém a data. */
export function segundaDaSemana(iso: string): string {
  const w = diaDaSemana(iso)
  return addDias(iso, w === 0 ? -6 : 1 - w)
}
const inicioDoMes = (iso: string) => `${iso.slice(0, 7)}-01`
function fimDoMes(iso: string): string {
  const d = parseDia(iso)
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
const mesSeguinte = (iso: string) => {
  const d = parseDia(inicioDoMes(iso))
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}

/** Dia `dia` do mês; se cair no fim de semana, próxima segunda (ou a sexta anterior, se virar o mês). */
export function dataMensal(mesISO: string, dia: number): string {
  const base = parseDia(inicioDoMes(mesISO))
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const d = new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(1, dia), ultimo))
  const w = d.getDay()
  if (w === 6 || w === 0) {
    const frente = new Date(d)
    frente.setDate(frente.getDate() + (w === 6 ? 2 : 1))
    if (frente.getMonth() === d.getMonth()) return isoLocal(frente)
    d.setDate(d.getDate() - (w === 6 ? 1 : 2))
  }
  return isoLocal(d)
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

// ── Modelo a partir da linha de `tarefas` ───────────────────────────────────

/**
 * `fallbackDesde` = sem a migration 098 não existe `ocorrencias_desde`; usa o
 * primeiro uso neste navegador pra não transformar todo o passado em "perdida".
 */
export function modeloDaTarefa(t: Tarefa, fallbackDesde?: string): TarefaModelo {
  const criada = t.created_at.slice(0, 10)
  const desde = t.ocorrencias_desde ?? (fallbackDesde && fallbackDesde > criada ? fallbackDesde : criada)
  let dia: number | undefined
  if (t.frequencia === 'semanal') {
    const tpl = t.template?.dias_semana?.find((d) => d >= 1 && d <= 5)
    const venc = t.data_vencimento ? diaDaSemana(t.data_vencimento) : undefined
    dia = clamp(t.dia_referencia ?? tpl ?? (venc && venc >= 1 && venc <= 5 ? venc : 1), 1, 5)
  } else if (t.frequencia === 'mensal') {
    dia = clamp(t.dia_referencia ?? t.template?.dia_mes ?? (t.data_vencimento ? parseDia(t.data_vencimento).getDate() : 1), 1, 31)
  }
  return {
    id: t.id,
    clienteId: t.cliente_id,
    titulo: t.nome,
    frequencia: t.frequencia,
    diaReferencia: dia,
    prioridade: t.prioridade,
    responsavelId: t.responsavel_id ?? undefined,
    padrao: !!t.template_id,
    ativa: t.frequencia === 'esporadica' ? t.status !== 'cancelada' : t.status === 'pendente' || t.status === 'em_andamento',
    desde,
    dataLimite: t.frequencia === 'esporadica' ? t.data_vencimento : undefined,
    concluida: t.frequencia === 'esporadica' ? t.status === 'concluida' : undefined,
  }
}

// ── Geração ─────────────────────────────────────────────────────────────────

function nova(modelo: TarefaModelo, dataPrevista: string, inicio: string, fim: string | null, reg?: RegistroOcorrencia): OcorrenciaTarefa {
  return {
    id: reg?.id ?? `${modelo.id}|${dataPrevista}`,
    modeloId: modelo.id,
    dataPrevista,
    inicioPeriodo: inicio,
    fimPeriodo: fim,
    status: reg?.status === 'feita' ? 'feita' : 'pendente',
    concluidaEm: reg?.status === 'feita' ? (reg.concluida_em ?? undefined) : undefined,
    concluidaPor: reg?.status === 'feita' ? (reg.concluida_por ?? undefined) : undefined,
    observacao: reg?.observacao ?? undefined,
  }
}

/**
 * Ocorrências do modelo com data prevista em [inicio, fim] (nunca antes de
 * `modelo.desde`), já com o que foi gravado (feita/observação). Todas saem
 * "pendente" ou "feita" — quem vira "perdida" é closeExpiredOccurrences.
 */
export function generateOccurrences(
  modelo: TarefaModelo,
  intervalo: { inicio: string; fim: string },
  registros: RegistroOcorrencia[] = [],
): OcorrenciaTarefa[] {
  const porData = new Map(registros.map((r) => [r.data_prevista.slice(0, 10), r]))
  if (modelo.frequencia === 'esporadica') {
    const data = modelo.dataLimite?.slice(0, 10)
    if (!data) return []
    const oc = nova(modelo, data, modelo.desde, null, porData.get(data))
    if (modelo.concluida) oc.status = 'feita'
    return [oc]
  }
  const inicio = intervalo.inicio > modelo.desde ? intervalo.inicio : modelo.desde
  const fim = intervalo.fim
  const out: OcorrenciaTarefa[] = []
  if (inicio > fim) return out

  if (modelo.frequencia === 'diaria') {
    for (let d = inicio; d <= fim; d = addDias(d, 1)) {
      if (ehDiaUtil(d)) out.push(nova(modelo, d, d, d, porData.get(d)))
    }
  } else if (modelo.frequencia === 'semanal') {
    const dia = modelo.diaReferencia ?? 1
    for (let seg = segundaDaSemana(inicio); seg <= fim; seg = addDias(seg, 7)) {
      const d = addDias(seg, dia - 1)
      if (d >= inicio && d <= fim) out.push(nova(modelo, d, seg, addDias(seg, 6), porData.get(d)))
    }
  } else {
    const dia = modelo.diaReferencia ?? 1
    for (let m = inicioDoMes(inicio); m <= fim; m = mesSeguinte(m)) {
      const d = dataMensal(m, dia)
      if (d >= inicio && d <= fim) out.push(nova(modelo, d, m, fimDoMes(m), porData.get(d)))
    }
  }
  return out
}

/** Pendente cujo período já terminou (fim < hoje) vira "perdida". */
export function closeExpiredOccurrences(ocorrencias: OcorrenciaTarefa[], hoje: string): OcorrenciaTarefa[] {
  return ocorrencias.map((o) => (o.status === 'pendente' && o.fimPeriodo && o.fimPeriodo < hoje ? { ...o, status: 'perdida' } : o))
}

/** Quantas das ocorrências já decididas foram feitas (pendente em aberto não conta). */
export function getCompletionRate(ocorrencias: OcorrenciaTarefa[]): { feitas: number; perdidas: number; avaliadas: number; pct: number | null } {
  const feitas = ocorrencias.filter((o) => o.status === 'feita').length
  const perdidas = ocorrencias.filter((o) => o.status === 'perdida').length
  const avaliadas = feitas + perdidas
  return { feitas, perdidas, avaliadas, pct: avaliadas ? (feitas / avaliadas) * 100 : null }
}

/** Janela pra trás que cobre N períodos (com folga pros fins de semana). */
const JANELA_DIAS: Record<FrequenciaTarefa, number> = { diaria: 3, semanal: 7, mensal: 31, esporadica: 0 }

/**
 * A ocorrência "da vez": a primeira cujo período ainda não fechou. Diária no
 * fim de semana → a de segunda. Semanal/mensal com a data já passada mas o
 * período aberto → ela mesma (atrasada, ainda dá pra fazer).
 */
export function ocorrenciaAtual(modelo: TarefaModelo, registros: RegistroOcorrencia[], hoje: string): OcorrenciaTarefa | null {
  if (modelo.frequencia === 'esporadica') {
    const unica = generateOccurrences(modelo, { inicio: hoje, fim: hoje }, registros)[0]
    if (unica) return unica
    // Sem prazo: a ocorrência é "hoje" (dá pra concluir mesmo assim).
    const oc = nova(modelo, hoje, hoje, null, registros.find((r) => r.data_prevista.slice(0, 10) === hoje))
    if (modelo.concluida) oc.status = 'feita'
    return oc
  }
  const ocs = generateOccurrences(modelo, { inicio: addDias(hoje, -JANELA_DIAS[modelo.frequencia]), fim: addDias(hoje, 70) }, registros)
  return ocs.find((o) => (o.fimPeriodo ?? o.dataPrevista) >= hoje) ?? null
}

/** Ocorrência seguinte a uma data prevista. */
export function ocorrenciaSeguinte(modelo: TarefaModelo, dataPrevista: string): OcorrenciaTarefa | null {
  if (modelo.frequencia === 'esporadica') return null
  return generateOccurrences(modelo, { inicio: addDias(dataPrevista, 1), fim: addDias(dataPrevista, 70) })[0] ?? null
}

/** Próxima data a cumprir: a atual se está em aberto; se já foi feita, a do período seguinte. */
export function proximaDataPrevista(modelo: TarefaModelo, registros: RegistroOcorrencia[], hoje: string): string | null {
  const atual = ocorrenciaAtual(modelo, registros, hoje)
  if (!atual) return null
  if (atual.status !== 'feita') return atual.dataPrevista
  return ocorrenciaSeguinte(modelo, atual.dataPrevista)?.dataPrevista ?? null
}

/** Tamanho da trilha de cumprimento: 10 dias úteis / 4 semanas / 3 meses. */
export const TAMANHO_TRILHA: Record<FrequenciaTarefa, number> = { diaria: 10, semanal: 4, mensal: 3, esporadica: 1 }

/** Últimas N ocorrências até a atual (inclusive), já com perdidas fechadas. */
export function trilhaDeCumprimento(modelo: TarefaModelo, registros: RegistroOcorrencia[], hoje: string, n = TAMANHO_TRILHA[modelo.frequencia]): OcorrenciaTarefa[] {
  const atual = ocorrenciaAtual(modelo, registros, hoje)
  if (!atual) return []
  const volta = modelo.frequencia === 'diaria' ? n * 2 + 4 : modelo.frequencia === 'semanal' ? n * 7 + 7 : n * 31 + 31
  const ocs = generateOccurrences(modelo, { inicio: addDias(atual.dataPrevista, -volta), fim: atual.dataPrevista }, registros)
  return closeExpiredOccurrences(ocs, hoje).slice(-n)
}

/** Histórico completo (mais recente primeiro), do início do rastreio até a ocorrência atual. */
export function historicoCompleto(modelo: TarefaModelo, registros: RegistroOcorrencia[], hoje: string, limite = 400): OcorrenciaTarefa[] {
  if (modelo.frequencia === 'esporadica') return closeExpiredOccurrences(generateOccurrences(modelo, { inicio: modelo.desde, fim: hoje }, registros), hoje)
  const atual = ocorrenciaAtual(modelo, registros, hoje)
  const fim = atual?.dataPrevista ?? hoje
  const geradas = closeExpiredOccurrences(generateOccurrences(modelo, { inicio: modelo.desde, fim }, registros), hoje)
  // Registros de antes do rastreio (ex.: tarefa reativada) continuam no histórico.
  const datas = new Set(geradas.map((o) => o.dataPrevista))
  const antigos = registros
    .filter((r) => r.data_prevista.slice(0, 10) < modelo.desde && !datas.has(r.data_prevista.slice(0, 10)))
    .map((r) => ({ ...nova(modelo, r.data_prevista.slice(0, 10), r.data_prevista.slice(0, 10), r.data_prevista.slice(0, 10), r), status: r.status === 'feita' ? ('feita' as const) : ('perdida' as const) }))
  return [...antigos, ...geradas].sort((a, b) => (a.dataPrevista < b.dataPrevista ? 1 : -1)).slice(0, limite)
}

// ── Painel "Tarefas do dia" ─────────────────────────────────────────────────

export interface ItemDoDia {
  tarefa: Tarefa
  modelo: TarefaModelo
  ocorrencia: OcorrenciaTarefa
  /** Dias desde a data prevista (0 = hoje). */
  diasAtraso: number
}

export interface ResumoDoDia {
  /** Data prevista = hoje e ainda pendente. */
  hoje: ItemDoDia[]
  /** Esporádicas vencidas + semanais/mensais com a data passada e o período ainda aberto. */
  atrasadas: ItemDoDia[]
  /** Ocorrências perdidas nos últimos 7 dias, por cliente. */
  perdidasPorCliente: Map<string, number>
  perdidasSemana: number
}

export function resumirDoDia(
  tarefas: Tarefa[],
  registrosPorTarefa: Map<string, RegistroOcorrencia[]>,
  hoje: string,
  fallbackDesde?: string,
): ResumoDoDia {
  const r: ResumoDoDia = { hoje: [], atrasadas: [], perdidasPorCliente: new Map(), perdidasSemana: 0 }
  for (const t of tarefas) {
    const modelo = modeloDaTarefa(t, fallbackDesde)
    if (!modelo.ativa || modelo.concluida) continue
    if (modelo.frequencia === 'esporadica' && !modelo.dataLimite) continue
    const regs = registrosPorTarefa.get(t.id) ?? []
    const atual = ocorrenciaAtual(modelo, regs, hoje)
    if (atual && atual.status === 'pendente') {
      const item = { tarefa: t, modelo, ocorrencia: atual, diasAtraso: diasEntre(atual.dataPrevista, hoje) }
      if (atual.dataPrevista === hoje) r.hoje.push(item)
      else if (atual.dataPrevista < hoje && modelo.frequencia !== 'diaria') r.atrasadas.push(item)
    }
    if (modelo.frequencia !== 'esporadica') {
      const perdidas = closeExpiredOccurrences(generateOccurrences(modelo, { inicio: addDias(hoje, -7), fim: addDias(hoje, -1) }, regs), hoje).filter(
        (o) => o.status === 'perdida',
      ).length
      if (perdidas) {
        r.perdidasPorCliente.set(t.cliente_id, (r.perdidasPorCliente.get(t.cliente_id) ?? 0) + perdidas)
        r.perdidasSemana += perdidas
      }
    }
  }
  r.atrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso)
  return r
}

// ── Rótulos ─────────────────────────────────────────────────────────────────

export function rotuloData(iso: string, hoje: string): string {
  const d = diasEntre(hoje, iso)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d === -1) return 'ontem'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const nomeDiaSemana = (iso: string) => DIAS_SEMANA[diaDaSemana(iso)]

export function rotuloRecorrencia(m: TarefaModelo): string {
  if (m.frequencia === 'diaria') return 'Todo dia útil'
  if (m.frequencia === 'semanal') return `Toda ${DIAS_SEMANA[m.diaReferencia ?? 1]}`
  if (m.frequencia === 'mensal') return `Todo dia ${m.diaReferencia ?? 1}`
  return 'Uma vez'
}
