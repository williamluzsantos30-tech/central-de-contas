/**
 * Score de Saúde por Squad — usado no Resumo Geral (Visão Executiva, bloco
 * "Score e Saúde por Squad") e na Performance da Equipe (score do Account
 * Manager). Movido da Visão Executiva sem alteração da fórmula (26/09/2026).
 */
import type { Cliente } from '@/types/database'

// ==============================================================
// Score e Saúde por Squad
// ==============================================================
//
// Formula do score (de -3 a +9 — conferido com o código abaixo):
//   +2 se NRR >= 95% no mes (meta de retencao)
//   +2 se zero churn no mes  |  -2 se houve perda de MRR (churn) no mes
//   +2 se zero clientes em atencao
//   +2 se MRR do squad > media geral (squad puxando resultado)
//   +1 se o squad tem indicacoes  |  -1 se nao tem
//
// Classificacao: <=0 Critico, 1-4 Atencao, 5+ Saudavel.

// Evento manual de expansao/perda/churn — usado pra construir o
// Resultado do Negocio a partir do log real, nao mais placeholder.
export interface EventoMovimento {
  tipo: 'expansao' | 'perda' | 'churn'
  cliente_id: string
  criado_em: string
  meta: {
    valor?: number
    valor_perdido?: number
    data?: string
    motivo?: string
    recorrente?: boolean
  } | null
}

export interface ScoreSquad {
  nome: string
  clientes: Cliente[]
  mrr: number
  mrrMes: number // MRR reconstruido do mes (base do NRR e da comparacao MoM)
  nrr: number
  churnsCount: number
  emRiscoCount: number
  revChurn: number
  indicacoes: number
  score: number
  badges: { label: string; positive: boolean }[]
  classificacao: 'critico' | 'atencao' | 'saudavel'
}

/**
 * MRR reconstruido de um squad num mes: soma verba_mensal dos clientes
 * que ja tinham iniciado ate o fim do mes e ainda nao estavam arquivados
 * naquele momento (data_inicio <= fimMes E arquivado_em nulo ou > fimMes).
 * Base pro NRR (mrrInicio) e pra comparacao mes-a-mes.
 */
export function mrrSquadNoMes(lista: Cliente[], mesISO: string): number {
  const [y, m] = mesISO.split('-').map(Number)
  const fimMes = new Date(y, m, 0, 23, 59, 59)
  return lista.reduce((s, c) => {
    if (!c.data_inicio) return s
    const ini = new Date(c.data_inicio)
    if (isNaN(ini.getTime()) || ini > fimMes) return s
    if (c.arquivado_em && new Date(c.arquivado_em) <= fimMes) return s
    return s + (c.verba_mensal ?? 0)
  }, 0)
}

export function calculaScoreSquads(
  clientes: Cliente[],
  mesISO: string,
  mrrMedioSquad: number,
  squadsAtivos: string[],
  incluirSemSquad: boolean,
  indicacoesPorSquad: Map<string, number>,
  eventosMov: EventoMovimento[],
): ScoreSquad[] {
  const [y, m] = mesISO.split('-').map(Number)
  const inicioMes = new Date(y, m - 1, 1)
  const fimMes = new Date(y, m, 0, 23, 59, 59)

  const byNome = new Map<string, Cliente[]>()
  for (const c of clientes) {
    const nome = c.squad ?? '(sem squad)'
    if (!byNome.has(nome)) byNome.set(nome, [])
    byNome.get(nome)!.push(c)
  }

  // Um card por squad ATIVO cadastrado (mesmo sem clientes) + "(sem squad)"
  // quando há clientes sem squad. Squads inativos não entram. A fonte é a
  // lista central (useSquads), nunca nomes hardcoded.
  const nomesAlvo = [...squadsAtivos]
  if (incluirSemSquad && byNome.has('(sem squad)')) nomesAlvo.push('(sem squad)')

  const resultados: ScoreSquad[] = []
  for (const nome of Array.from(new Set(nomesAlvo))) {
    const lista = byNome.get(nome) ?? []
    const ativos = lista.filter((c) => c.status === 'ativo' && !c.arquivado_em)
    const emRisco = lista.filter((c) => c.status === 'atencao' && !c.arquivado_em)
    const churnsNoMes = lista.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    })

    const mrr = ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const revChurn = churnsNoMes.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)

    // NRR com expansao — pode passar de 100%. Puxa os eventos de movimento
    // comercial DAQUELE squad no mes (prioriza meta.data, cai pra criado_em).
    const squadClienteIds = new Set(lista.map((c) => c.id))
    const eventosDoMes = eventosMov.filter((ev) => {
      if (!squadClienteIds.has(ev.cliente_id)) return false
      const d = new Date(ev.meta?.data ?? ev.criado_em)
      return d >= inicioMes && d <= fimMes
    })
    const expansao = eventosDoMes
      .filter((ev) => ev.tipo === 'expansao')
      .reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)
    const reducao = eventosDoMes
      .filter((ev) => ev.tipo === 'perda')
      .reduce((s, ev) => s + (ev.meta?.valor ?? 0), 0)
    const churnsEv = eventosDoMes.filter((ev) => ev.tipo === 'churn')
    // Churn perdido = soma dos eventos tipo 'churn'; sem eventos, cai pro
    // rev churn reconstruido de arquivado_em (retrocompativel).
    const churnPerdido =
      churnsEv.length > 0
        ? churnsEv.reduce((s, ev) => s + (ev.meta?.valor_perdido ?? 0), 0)
        : revChurn

    // mrrInicio = MRR do mes reconstruido. NRR = (inicio + exp - red - churn)
    // / inicio; se inicio=0, NRR=1 (evita divisao por zero).
    const mrrMes = mrrSquadNoMes(lista, mesISO)
    const nrr = mrrMes > 0 ? (mrrMes + expansao - reducao - churnPerdido) / mrrMes : 1

    // Score components
    let score = 0
    const badges: { label: string; positive: boolean }[] = []

    if (nrr >= 0.95) {
      // Meta atingida — NRR acima de 95%
      score += 2
      badges.push({ label: '+2 NRR', positive: true })
    }
    if (churnsNoMes.length === 0) {
      score += 2
      badges.push({ label: '+2 Zero churn', positive: true })
    } else {
      score -= 2
      badges.push({ label: '-2 Perda MRR', positive: false })
    }
    if (emRisco.length === 0) {
      score += 2
      badges.push({ label: '+2 Zero risco', positive: true })
    }
    if (mrr > mrrMedioSquad) {
      score += 2
      badges.push({ label: '+2 MRR acima da média', positive: true })
    }
    // Indicações — valor real do squad (atual_indicacoes na tabela squads,
    // editável no Painel de Metas). Com indicação = +1; sem = -1.
    const indicacoes = indicacoesPorSquad.get(nome) ?? 0
    if (indicacoes > 0) {
      score += 1
      badges.push({ label: `+1 Indicações`, positive: true })
    } else {
      score -= 1
      badges.push({ label: '-1 Sem indic.', positive: false })
    }

    const classificacao: 'critico' | 'atencao' | 'saudavel' =
      score <= 0 ? 'critico' : score <= 4 ? 'atencao' : 'saudavel'

    resultados.push({
      nome,
      clientes: lista,
      mrr,
      mrrMes,
      nrr,
      churnsCount: churnsNoMes.length,
      emRiscoCount: emRisco.length,
      revChurn,
      indicacoes,
      score,
      badges,
      classificacao,
    })
  }
  // Ordena: saudavel primeiro, depois atencao, depois critico
  const ordem = { saudavel: 0, atencao: 1, critico: 2 }
  resultados.sort((a, b) => ordem[a.classificacao] - ordem[b.classificacao])
  return resultados
}

// ── Normalização 0–100% (Performance da Equipe) ──────────────────────────────
/** Limites reais da fórmula acima: -2 (churn) -1 (sem indicação) = -3; 2+2+2+2+1 = 9. */
export const SCORE_SQUAD_MIN = -3
export const SCORE_SQUAD_MAX = 9

/**
 * Score de squad (-3…9) → % (0–100), por FAIXA de classificação, pra casar
 * com as faixas de cor padrão da Performance (vermelho < 40 ≤ laranja < 70 ≤ verde):
 *   Crítico  (-3…0) →  0–39%   linear: (s + 3) / 3 × 39
 *   Atenção  ( 1…4) → 40–69%   linear: 40 + (s − 1) / 3 × 29
 *   Saudável ( 5…9) → 70–100%  linear: 70 + (s − 5) / 4 × 30
 */
export function scoreSquadPercentual(score: number): number {
  const s = Math.max(SCORE_SQUAD_MIN, Math.min(SCORE_SQUAD_MAX, score))
  if (s <= 0) return Math.round(((s + 3) / 3) * 39)
  if (s <= 4) return Math.round(40 + ((s - 1) / 3) * 29)
  return Math.round(70 + ((s - 5) / 4) * 30)
}
