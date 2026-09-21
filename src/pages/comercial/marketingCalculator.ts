/**
 * Calculadora do funil de aquisição (Marketing) — cruza investimento de mídia
 * por canal com o funil comercial (mesma entidade Lead). Tudo derivado dos
 * leads em tempo real; investimento é input manual.
 */
import type { Lead } from './mockLeads'
import type { InvestimentoMarketing } from './mockInvestimentos'

/** Duração padrão do contrato (meses) quando o lead não informou. */
const DURACAO_PADRAO = 12
const hojeISO = () => new Date().toISOString().slice(0, 10)

/**
 * Canal canônico de um lead (a partir de canalOriginal/origem). Mapeia os
 * rótulos variados que chegam dos CRMs/prospecção pra um conjunto estável,
 * usado tanto pra agrupar leads quanto pra casar com o investimento lançado.
 */
export function canalDoLead(lead: Lead): string {
  const raw = (lead.canalOriginal ?? lead.origem ?? '').toLowerCase()
  if (raw.includes('meta') || raw.includes('facebook') || raw.includes('instagram ads')) return 'Meta Ads'
  if (raw.includes('google') || raw.includes('search')) return 'Google Ads'
  if (raw.includes('prospec') || raw.includes('social selling')) return 'Social Selling'
  if (raw.includes('indica')) return 'Indicação'
  if (raw.includes('inbound') || raw.includes('site') || raw.includes('formul')) return 'Inbound'
  return 'Orgânico'
}

// ── Período ────────────────────────────────────────────────────────────────
export interface PeriodoFiltro {
  /** Meses "YYYY-MM" cobertos (pra somar investimentos). */
  meses: string[]
  /** Mês de referência (o "atual" do período) — base pro comparativo. */
  mesRef: string
  inPeriodo: (iso?: string | null) => boolean
}

export function periodoMes(mes: string): PeriodoFiltro {
  return { meses: [mes], mesRef: mes, inPeriodo: (iso) => !!iso && iso.slice(0, 7) === mes }
}

export function periodoRange(de: string, ate: string): PeriodoFiltro {
  const meses = mesesEntre(de, ate)
  return {
    meses,
    mesRef: (de || ate).slice(0, 7),
    inPeriodo: (iso) => {
      if (!iso) return false
      const d = iso.slice(0, 10)
      return (!de || d >= de) && (!ate || d <= ate)
    },
  }
}

export function mesAnterior(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Semanas (segunda a domingo) ─────────────────────────────────────────────
function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Segunda-feira da semana da data informada (hoje se vazio). */
export function mondayOf(ref?: string | Date): Date {
  const d = ref ? (typeof ref === 'string' ? new Date(ref.slice(0, 10) + 'T12:00:00') : new Date(ref)) : new Date()
  const day = (d.getDay() + 6) % 7 // 0 = segunda
  d.setDate(d.getDate() - day)
  d.setHours(12, 0, 0, 0)
  return d
}
/** Ref de semana = data (YYYY-MM-DD) da segunda-feira. */
export function weekRefOf(ref?: string | Date): string {
  return isoDia(mondayOf(ref))
}
/** Avança/retrocede semanas a partir de uma ref de segunda-feira. */
export function addSemanas(mondayIso: string, n: number): string {
  const m = mondayOf(mondayIso)
  m.setDate(m.getDate() + n * 7)
  return isoDia(m)
}
/** PeriodoFiltro cobrindo a semana (segunda→domingo) da ref. */
export function periodoSemana(mondayIso: string): PeriodoFiltro {
  const monday = mondayOf(mondayIso)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const p = periodoRange(isoDia(monday), isoDia(sunday))
  return { ...p, mesRef: isoDia(monday).slice(0, 7) }
}
/** Rótulo "Semana N de Setembro (15/09 - 21/09)". */
export function weekLabel(mondayIso: string): string {
  const monday = mondayOf(mondayIso)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const n = Math.ceil(monday.getDate() / 7)
  const mes = monday.toLocaleDateString('pt-BR', { month: 'long' })
  const dd = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `Semana ${n} de ${mes} (${dd(monday)} - ${dd(sunday)})`
}
/** Segundas-feiras cujas semanas tocam o mês "YYYY-MM". */
export function semanasDoMes(mes: string): string[] {
  const [y, m] = mes.split('-').map(Number)
  const last = new Date(y, m, 0)
  let monday = mondayOf(new Date(y, m - 1, 1))
  const out: string[] = []
  while (monday <= last) {
    out.push(isoDia(monday))
    const nx = new Date(monday)
    nx.setDate(monday.getDate() + 7)
    monday = nx
  }
  return out
}

function mesesEntre(de: string, ate: string): string[] {
  if (!de || !ate) return [de || ate].map((s) => s.slice(0, 7)).filter(Boolean)
  const out: string[] = []
  const [y0, m0] = de.slice(0, 7).split('-').map(Number)
  const [y1, m1] = ate.slice(0, 7).split('-').map(Number)
  let y = y0
  let m = m0
  while (y < y1 || (y === y1 && m <= m1)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

const div = (a: number, b: number) => (b > 0 ? a / b : 0)

// ── Funil ────────────────────────────────────────────────────────────────
export interface MarketingFunnel {
  canal: string // "Geral" ou o canal
  investimento: number
  leads: number
  cpl: number
  qualificados: number
  mqlPct: number
  cpmql: number
  reunioesAgendadas: number
  custoPorAgendada: number
  reunioesRealizadas: number
  custoPorRealizada: number
  reunioesASerem: number
  noShowPct: number
  taxaAgendamento: number
  cancelamentos: number
  taxaCancelamentos: number
  reunioesMesPassado: number
  fechamentos: number
  txConversao: number
  fechamentosMesPassado: number
  txConversaoReunioesDoMes: number
  mrr: number
  caixaRecolhido: number
  contratoFechado: number
  ticketMedio: number
  roasMrr: number
  roasCaixa: number
  roasContrato: number
  cac: number
}

/** Uma call "aconteceu" (não é no-show nem reunião futura ainda não ocorrida). */
function teveCall(l: Lead): boolean {
  const avançou = l.etapaFunil === 'em_negociacao' || l.etapaFunil === 'fechado' || (l.etapaFunil === 'perdido' && !!l.motivoPerda)
  return avançou && l.subStatusNegociacao !== 'no_show'
}

export function calculateMarketingFunnel(
  leads: Lead[],
  investimentos: InvestimentoMarketing[],
  periodo: PeriodoFiltro,
  canal?: string,
): MarketingFunnel {
  const doCanal = canal ? leads.filter((l) => canalDoLead(l) === canal) : leads
  const hoje = hojeISO()

  const investimento = investimentos
    .filter((i) => periodo.meses.includes(i.periodo) && (!canal || i.canal === canal))
    .reduce((s, i) => s + i.valor, 0)

  const leadsP = doCanal.filter((l) => periodo.inPeriodo(l.dataEntrada))
  const qualificados = leadsP.filter((l) => l.qualificado)

  const agendadas = doCanal.filter((l) => l.dataReuniaoAgendada && periodo.inPeriodo(l.dataReuniaoAgendada))
  const aSerem = agendadas.filter((l) => l.etapaFunil === 'reuniao_agendada' && (l.reuniao?.data ?? '') >= hoje)
  const realizadas = agendadas.filter(teveCall)
  const cancelamentos = 0 // sem status de cancelamento no modelo (mock)

  const fechados = doCanal.filter((l) => l.etapaFunil === 'fechado' && periodo.inPeriodo(l.dataFechamento))
  const mrr = fechados.reduce((s, l) => s + (l.ticketMensal ?? 0), 0)
  const caixaRecolhido = fechados.reduce((s, l) => s + (l.caixaRecolhido ?? l.valorProposta ?? 0), 0)
  const contratoFechado = fechados.reduce((s, l) => s + (l.ticketMensal ?? 0) * (l.duracaoContratoMeses ?? DURACAO_PADRAO), 0)

  const mesPass = mesAnterior(periodo.mesRef)
  const reunioesMesPassado = doCanal.filter((l) => l.dataReuniaoAgendada?.slice(0, 7) === mesPass).length
  const fechamentosMesPassado = doCanal.filter((l) => l.etapaFunil === 'fechado' && l.dataFechamento?.slice(0, 7) === mesPass).length

  const ocorreram = agendadas.length - aSerem.length
  const noShowPct = ocorreram > 0 ? div(realizadas.length, ocorreram) - 1 : 0
  const fechadosDeReunioesDoMes = realizadas.filter((l) => l.etapaFunil === 'fechado').length

  return {
    canal: canal ?? 'Geral',
    investimento,
    leads: leadsP.length,
    cpl: div(investimento, leadsP.length),
    qualificados: qualificados.length,
    mqlPct: div(qualificados.length, leadsP.length) * 100,
    cpmql: div(investimento, qualificados.length),
    reunioesAgendadas: agendadas.length,
    custoPorAgendada: div(investimento, agendadas.length),
    reunioesRealizadas: realizadas.length,
    custoPorRealizada: div(investimento, realizadas.length),
    reunioesASerem: aSerem.length,
    noShowPct: noShowPct * 100,
    taxaAgendamento: div(agendadas.length, qualificados.length) * 100,
    cancelamentos,
    taxaCancelamentos: div(cancelamentos, agendadas.length) * 100,
    reunioesMesPassado,
    fechamentos: fechados.length,
    txConversao: div(fechados.length, realizadas.length) * 100,
    fechamentosMesPassado,
    txConversaoReunioesDoMes: div(fechadosDeReunioesDoMes, realizadas.length) * 100,
    mrr,
    caixaRecolhido,
    contratoFechado,
    ticketMedio: div(caixaRecolhido, fechados.length),
    roasMrr: div(mrr, investimento),
    roasCaixa: div(caixaRecolhido, investimento),
    roasContrato: div(contratoFechado, investimento),
    cac: div(investimento, fechados.length),
  }
}

/** Canais presentes no período (leads) ∪ canais com investimento lançado. */
export function canaisDoPeriodo(
  leads: Lead[],
  investimentos: InvestimentoMarketing[],
  periodo: PeriodoFiltro,
): string[] {
  const deLeads = leads.filter((l) => periodo.inPeriodo(l.dataEntrada)).map(canalDoLead)
  const deInv = investimentos.filter((i) => periodo.meses.includes(i.periodo)).map((i) => i.canal)
  return Array.from(new Set([...deLeads, ...deInv])).sort()
}

export function calculateChannelComparison(
  leads: Lead[],
  investimentos: InvestimentoMarketing[],
  periodo: PeriodoFiltro,
): MarketingFunnel[] {
  return canaisDoPeriodo(leads, investimentos, periodo).map((canal) =>
    calculateMarketingFunnel(leads, investimentos, periodo, canal),
  )
}
