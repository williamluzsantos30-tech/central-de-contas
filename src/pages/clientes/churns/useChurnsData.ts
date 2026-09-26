/**
 * useChurnsData — dados REAIS do dashboard de Churns.
 *
 * Fonte da verdade: o registro de churn feito na Ficha do cliente
 * ("Registrar Perda" → Churn), que grava um evento em cliente_eventos
 * (tipo='churn', meta rica) e marca o cliente como status='churn' +
 * arquivado_em. Aqui a gente lê esses registros e agrega tudo que o
 * dashboard mostra. Cliente marcado como churn sem evento (via status)
 * ainda entra, com fallbacks.
 *
 * Evento de churn (meta):
 *   { motivo, data, valor_perdido, ltv_congelado,
 *     ticket_mensal_no_churn, tempo_de_casa_meses }
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Profile } from '@/types/database'

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface ChurnKpis {
  totalChurns: number
  mrrPerdido: number
  mrrMesAtual: number
  mrrMesAtualDeltaPct: number | null
  churnRate: number // 0-1
  tempoMedioCasaMeses: number
  ticketMedioChurn: number
  ticketMedioAtivo: number
}

export interface ClienteChurn {
  id: string
  nome: string
  nicho: string
  squad: string | null
  accountManager: string | null
  ticketMensal: number
  dataChurn: string // 'YYYY-MM-DD'
  tempoCasaMeses: number | null
  ltv: number | null
  motivo: string
  nps: number | null
}

/** Filtros da tela. Squad/AM/Gestor escopam a base toda; período (meses pra trás) escopa os churns. */
export interface FiltrosChurn {
  periodoMeses?: number | null
  squad?: string
  amId?: string
  gestorId?: string
}

export interface OpcaoFiltro {
  value: string
  label: string
}

export interface ChurnsData {
  loading: boolean
  /** Opções reais pros filtros de AM e Gestor (a partir dos clientes). */
  opcoes: { ams: OpcaoFiltro[]; gestores: OpcaoFiltro[] }
  vazio: boolean
  kpis: ChurnKpis
  tendencia: { mes: string; qtd: number; mrr: number }[]
  porMotivo: { motivo: string; qtd: number }[]
  porSquad: { squad: string; qtd: number }[]
  porTempoCasa: { faixa: string; qtd: number }[]
  ticket: { churns: number; baseAtiva: number }
  clientes: ClienteChurn[]
  reload: () => void
}

export interface EventoChurn {
  cliente_id: string
  criado_em: string
  meta: {
    motivo?: string
    data?: string
    valor_perdido?: number
    ltv_congelado?: number
    tempo_de_casa_meses?: number
  } | null
}

const KPIS_ZERO: ChurnKpis = {
  totalChurns: 0,
  mrrPerdido: 0,
  mrrMesAtual: 0,
  mrrMesAtualDeltaPct: null,
  churnRate: 0,
  tempoMedioCasaMeses: 0,
  ticketMedioChurn: 0,
  ticketMedioAtivo: 0,
}

function mesISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function labelMes(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${NOMES_MES[m - 1]}/${String(y).slice(2)}`
}
function mesesEntre(iniISO: string | null, fimISO: string | null): number {
  if (!iniISO || !fimISO) return 0
  const a = new Date(iniISO)
  const b = new Date(fimISO)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44))) + 1
}
function faixaTempo(meses: number | null): string {
  if (meses === null) return '—'
  if (meses <= 3) return '0-3m'
  if (meses <= 6) return '3-6m'
  if (meses <= 12) return '6-12m'
  if (meses <= 24) return '12-24m'
  return '24m+'
}

export function useChurnsData(filtros: FiltrosChurn = {}): ChurnsData {
  const { periodoMeses = null, squad = '', amId = '', gestorId = '' } = filtros
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [eventos, setEventos] = useState<EventoChurn[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [cRes, eRes, pRes] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('cliente_eventos').select('cliente_id, criado_em, meta').eq('tipo', 'churn'),
      supabase.from('profiles').select('id, nome'),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setEventos((eRes.data as EventoChurn[]) ?? [])
    setProfiles((pRes.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Opções de AM/Gestor: só quem de fato atende algum cliente.
  const opcoes = useMemo(() => {
    const nomeProfile = new Map(profiles.map((p) => [p.id, p.nome]))
    const lista = (ids: (string | null)[]) =>
      [...new Set(ids.filter((id): id is string => !!id && nomeProfile.has(id)))]
        .map((id) => ({ value: id, label: nomeProfile.get(id)! }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    return { ams: lista(clientes.map((c) => c.account_manager_id)), gestores: lista(clientes.map((c) => c.gestor_id)) }
  }, [clientes, profiles])

  const data = useMemo(
    () => calcularChurns(clientes, eventos, profiles, { periodoMeses, squad, amId, gestorId }),
    [clientes, eventos, profiles, periodoMeses, squad, amId, gestorId],
  )

  if (loading) {
    return {
      loading: true,
      opcoes,
      vazio: false,
      kpis: KPIS_ZERO,
      tendencia: [],
      porMotivo: [],
      porSquad: [],
      porTempoCasa: [],
      ticket: { churns: 0, baseAtiva: 0 },
      clientes: [],
      reload: load,
    }
  }
  return { loading: false, opcoes, ...data, reload: load }
}

/**
 * Cálculo puro da tela de Churns (KPIs, séries e tabela) — separado do hook
 * pra ser testável. Squad/AM/Gestor escopam a base; período escopa os churns.
 */
export function calcularChurns(
  clientes: Cliente[],
  eventos: EventoChurn[],
  profiles: Pick<Profile, 'id' | 'nome'>[],
  { periodoMeses = null, squad = '', amId = '', gestorId = '' }: FiltrosChurn = {},
): Omit<ChurnsData, 'loading' | 'reload' | 'opcoes'> {
  const nomeProfile = new Map(profiles.map((p) => [p.id, p.nome]))
  // Escopo da base (squad/AM/gestor) — vale pra churns E pra base ativa.
  const base = clientes.filter(
    (c) => (!squad || c.squad === squad) && (!amId || c.account_manager_id === amId) && (!gestorId || c.gestor_id === gestorId),
  )
  // Último evento de churn por cliente
  const eventoPorCliente = new Map<string, EventoChurn>()
  for (const ev of eventos) {
    const atual = eventoPorCliente.get(ev.cliente_id)
    const dEv = new Date(ev.meta?.data ?? ev.criado_em).getTime()
    const dAtual = atual ? new Date(atual.meta?.data ?? atual.criado_em).getTime() : -Infinity
    if (!atual || dEv >= dAtual) eventoPorCliente.set(ev.cliente_id, ev)
  }

  // Base ativa (pra ticket médio e churn rate)
  const ativos = base.filter((c) => c.status !== 'churn' && !c.arquivado_em)
  const ticketMedioAtivo =
    ativos.length > 0 ? ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0) / ativos.length : 0

  // Clientes churnados (status='churn'), enriquecidos com o evento
  const churnedBase = base.filter((c) => c.status === 'churn')
  const todos: ClienteChurn[] = churnedBase.map((c) => {
    const ev = eventoPorCliente.get(c.id)
    const dataChurn = (ev?.meta?.data ?? c.arquivado_em ?? c.data_inicio ?? '').slice(0, 10)
    const tempoCasa =
      ev?.meta?.tempo_de_casa_meses ??
      (c.data_inicio && dataChurn ? mesesEntre(c.data_inicio, dataChurn) : null)
    return {
      id: c.id,
      nome: c.nome,
      nicho: c.nicho ?? '',
      squad: c.squad,
      accountManager: c.account_manager_id ? nomeProfile.get(c.account_manager_id) ?? null : null,
      ticketMensal: c.verba_mensal ?? 0,
      dataChurn,
      tempoCasaMeses: tempoCasa,
      ltv: ev?.meta?.ltv_congelado ?? null,
      motivo: ev?.meta?.motivo ?? 'Não informado',
      nps: typeof c.nps === 'number' ? c.nps : null,
    }
  })
  // valor perdido por cliente (evento ou fallback pro ticket)
  const valorPerdido = new Map<string, number>()
  for (const c of churnedBase) {
    const ev = eventoPorCliente.get(c.id)
    valorPerdido.set(c.id, ev?.meta?.valor_perdido ?? c.verba_mensal ?? 0)
  }

  todos.sort((a, b) => (b.dataChurn || '').localeCompare(a.dataChurn || ''))

  // Período: churns cuja data cai nos últimos N meses (a tendência de 12
  // meses abaixo usa `todos`, pra continuar mostrando a série completa).
  const hoje = new Date()
  const corte = periodoMeses ? mesISO(new Date(hoje.getFullYear(), hoje.getMonth() - (periodoMeses - 1), 1)) + '-01' : ''
  const lista = corte ? todos.filter((c) => c.dataChurn >= corte) : todos
  const idsNoPeriodo = new Set(lista.map((c) => c.id))
  const churnedRaw = churnedBase.filter((c) => idsNoPeriodo.has(c.id))

  // KPIs
  const totalChurns = lista.length
  const mrrPerdido = churnedRaw.reduce((s, c) => s + (valorPerdido.get(c.id) ?? 0), 0)
  const mesAtual = mesISO(hoje)
  const mesAnterior = mesISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))
  let mrrMesAtual = 0
  let mrrMesAnterior = 0
  for (const cl of todos) {
    const m = cl.dataChurn.slice(0, 7)
    const v = valorPerdido.get(cl.id) ?? 0
    if (m === mesAtual) mrrMesAtual += v
    else if (m === mesAnterior) mrrMesAnterior += v
  }
  const mrrMesAtualDeltaPct =
    mrrMesAnterior > 0 ? (mrrMesAtual - mrrMesAnterior) / mrrMesAnterior : null

  const churnRate =
    totalChurns + ativos.length > 0 ? totalChurns / (totalChurns + ativos.length) : 0
  const tempos = lista.map((c) => c.tempoCasaMeses).filter((v): v is number => typeof v === 'number')
  const tempoMedioCasaMeses =
    tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0
  const ticketMedioChurn = totalChurns > 0 ? mrrPerdido / totalChurns : 0

  const kpis: ChurnKpis = {
    totalChurns,
    mrrPerdido,
    mrrMesAtual,
    mrrMesAtualDeltaPct,
    churnRate,
    tempoMedioCasaMeses,
    ticketMedioChurn,
    ticketMedioAtivo,
  }

  // Tendência 12 meses
  const meses: string[] = []
  for (let i = 11; i >= 0; i--) meses.push(mesISO(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)))
  const tendencia = meses.map((iso) => {
    let qtd = 0
    let mrr = 0
    for (const cl of todos) {
      if (cl.dataChurn.slice(0, 7) === iso) {
        qtd++
        mrr += valorPerdido.get(cl.id) ?? 0
      }
    }
    return { mes: labelMes(iso + '-01'), qtd, mrr }
  })

  // Por motivo
  const motivoMap = new Map<string, number>()
  for (const cl of lista) motivoMap.set(cl.motivo, (motivoMap.get(cl.motivo) ?? 0) + 1)
  const porMotivo = [...motivoMap.entries()]
    .map(([motivo, qtd]) => ({ motivo, qtd }))
    .sort((a, b) => b.qtd - a.qtd)

  // Por squad
  const squadMap = new Map<string, number>()
  for (const cl of lista) {
    const s = cl.squad ?? 'Sem squad'
    squadMap.set(s, (squadMap.get(s) ?? 0) + 1)
  }
  const porSquad = [...squadMap.entries()]
    .map(([squad, qtd]) => ({ squad, qtd }))
    .sort((a, b) => b.qtd - a.qtd)

  // Por tempo de casa (faixas fixas, ordenadas)
  const ordemFaixa = ['0-3m', '3-6m', '6-12m', '12-24m', '24m+']
  const faixaMap = new Map<string, number>()
  for (const f of ordemFaixa) faixaMap.set(f, 0)
  for (const cl of lista) {
    const f = faixaTempo(cl.tempoCasaMeses)
    if (faixaMap.has(f)) faixaMap.set(f, (faixaMap.get(f) ?? 0) + 1)
  }
  const porTempoCasa = ordemFaixa.map((faixa) => ({ faixa, qtd: faixaMap.get(faixa) ?? 0 }))

  return {
    // "Vazio" = não há churn nenhum na base (não "o filtro escondeu tudo").
    vazio: !clientes.some((c) => c.status === 'churn'),
    kpis,
    tendencia,
    porMotivo,
    porSquad,
    porTempoCasa,
    ticket: { churns: ticketMedioChurn, baseAtiva: ticketMedioAtivo },
    clientes: lista,
  }
}
