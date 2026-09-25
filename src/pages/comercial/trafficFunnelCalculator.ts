/**
 * Calculadora do Funil Tráfego (Comercial) — cruza os criativos da Meta Ads
 * (gasto por anúncio) com a QUALIDADE dos leads que cada criativo trouxe,
 * usando a classificação A/B/C que já chega pronta do CRM externo.
 *
 * Tudo derivado dos leads em tempo real (mesma entidade Lead do Comercial).
 * Recorte por COORTE: leads que ENTRARAM no período (dataEntrada) — assim o
 * winrate de um criativo/classe é o destino dos leads que ele gerou no período.
 */
import type { ClassificacaoLead, Lead } from './mockLeads'
import type { CriativoMetaAds } from './mockMetaAdsData'
import { canalDoLead, teveCall, type PeriodoFiltro } from './marketingCalculator'

export const CLASSIFICACOES: ClassificacaoLead[] = ['A', 'B', 'C']

const div = (a: number, b: number) => (b > 0 ? a / b : 0)

/** Chave estável de um criativo: ad_id quando existe, senão o nome normalizado. */
export function chaveCriativo(c: { idAnuncioMeta?: string | null; nomeAnuncio: string }): string {
  return c.idAnuncioMeta ? `id:${c.idAnuncioMeta}` : `nome:${c.nomeAnuncio.trim().toLowerCase()}`
}

// ── Tipos de saída ─────────────────────────────────────────────────────────
export interface LinhaRankingCriativo {
  chave: string
  nomeAnuncio: string
  idAnuncioMeta?: string
  leads: number
  qualificados: number
  /** null = sem investimento rastreado (orgânico, Google ou Meta não sincronizada). */
  gasto: number | null
  custoPorQualificado: number | null
  ctr: number | null
}

export interface DistribuicaoClassificacao {
  A: number
  B: number
  C: number
  semClassificacao: number
  /** Leads classificados (A+B+C). */
  classificados: number
  total: number
  /** % de cada classe sobre os CLASSIFICADOS. */
  pct: Record<ClassificacaoLead, number>
}

export interface WinrateClasse {
  classe: ClassificacaoLead
  leads: number
  /** Chegaram ao Closer e a call aconteceu (teveCall). */
  chegaram: number
  fechados: number
  /** fechados ÷ chegaram (%). */
  winrate: number
  mrr: number
  ticketMedio: number
}

export interface LinhaCruzamento {
  chave: string
  nomeAnuncio: string
  idAnuncioMeta?: string
  leads: number
  porClasse: Record<ClassificacaoLead, number>
  semClassificacao: number
  /** % de cada classe sobre os classificados do criativo. */
  pct: Record<ClassificacaoLead, number>
  chegaram: number
  fechados: number
  winrate: number
  gasto: number | null
  /** gasto ÷ leads A (o custo de trazer um lead bom). */
  custoPorLeadA: number | null
}

export interface TrafficFunnel {
  ranking: LinhaRankingCriativo[]
  distribuicao: DistribuicaoClassificacao
  winrate: WinrateClasse[]
  cruzamento: LinhaCruzamento[]
  totais: {
    leads: number
    leadsComCriativo: number
    qualificados: number
    gasto: number
    /** Gasto rastreado ÷ qualificados dos criativos COM gasto. */
    custoPorQualificado: number
  }
}

// ── Cálculo ────────────────────────────────────────────────────────────────
export function calculateTrafficFunnel(
  leads: Lead[],
  criativos: CriativoMetaAds[],
  periodo: PeriodoFiltro,
  canal?: string,
): TrafficFunnel {
  const doPeriodo = leads.filter((l) => periodo.inPeriodo(l.dataEntrada) && (!canal || canalDoLead(l) === canal))

  // Métricas Meta por chave (ad_id e, como fallback, nome).
  const metaPorChave = new Map<string, CriativoMetaAds>()
  for (const c of criativos) {
    metaPorChave.set(chaveCriativo(c), c)
    metaPorChave.set(chaveCriativo({ nomeAnuncio: c.nomeAnuncio }), c)
  }
  const metaDe = (l: Lead) => {
    const co = l.criativoOrigem
    if (!co) return undefined
    return metaPorChave.get(chaveCriativo(co)) ?? metaPorChave.get(chaveCriativo({ nomeAnuncio: co.nomeAnuncio }))
  }

  // Agrupa por criativo (a chave canônica vem da Meta quando casou).
  const grupos = new Map<string, { nomeAnuncio: string; idAnuncioMeta?: string; meta?: CriativoMetaAds; leads: Lead[] }>()
  for (const l of doPeriodo) {
    if (!l.criativoOrigem) continue
    const meta = metaDe(l)
    const chave = meta ? chaveCriativo(meta) : chaveCriativo(l.criativoOrigem)
    const g = grupos.get(chave) ?? {
      nomeAnuncio: meta?.nomeAnuncio ?? l.criativoOrigem.nomeAnuncio,
      idAnuncioMeta: meta?.idAnuncioMeta ?? l.criativoOrigem.idAnuncioMeta,
      meta,
      leads: [],
    }
    g.leads.push(l)
    grupos.set(chave, g)
  }

  const contarClasses = (ls: Lead[]) => {
    const porClasse: Record<ClassificacaoLead, number> = { A: 0, B: 0, C: 0 }
    let sem = 0
    for (const l of ls) {
      if (l.classificacaoCRM) porClasse[l.classificacaoCRM]++
      else sem++
    }
    const classificados = porClasse.A + porClasse.B + porClasse.C
    const pct = {
      A: div(porClasse.A, classificados) * 100,
      B: div(porClasse.B, classificados) * 100,
      C: div(porClasse.C, classificados) * 100,
    }
    return { porClasse, sem, classificados, pct }
  }

  // Bloco 1 — Ranking (só criativos com ≥ 1 qualificado)
  const ranking: LinhaRankingCriativo[] = []
  // Bloco 4 — Cruzamento (todo criativo com lead no período)
  const cruzamento: LinhaCruzamento[] = []
  for (const [chave, g] of grupos) {
    const qualificados = g.leads.filter((l) => l.qualificado).length
    const gasto = g.meta?.investimento ?? null
    const chegaram = g.leads.filter(teveCall).length
    const fechados = g.leads.filter((l) => l.etapaFunil === 'fechado').length
    const cls = contarClasses(g.leads)
    if (qualificados > 0) {
      ranking.push({
        chave,
        nomeAnuncio: g.nomeAnuncio,
        idAnuncioMeta: g.idAnuncioMeta,
        leads: g.leads.length,
        qualificados,
        gasto,
        custoPorQualificado: gasto != null ? div(gasto, qualificados) : null,
        ctr: g.meta?.ctr ?? null,
      })
    }
    cruzamento.push({
      chave,
      nomeAnuncio: g.nomeAnuncio,
      idAnuncioMeta: g.idAnuncioMeta,
      leads: g.leads.length,
      porClasse: cls.porClasse,
      semClassificacao: cls.sem,
      pct: cls.pct,
      chegaram,
      fechados,
      winrate: div(fechados, chegaram) * 100,
      gasto,
      custoPorLeadA: gasto != null && cls.porClasse.A > 0 ? gasto / cls.porClasse.A : null,
    })
  }
  ranking.sort((a, b) => b.qualificados - a.qualificados || (b.gasto ?? -1) - (a.gasto ?? -1) || a.nomeAnuncio.localeCompare(b.nomeAnuncio))
  cruzamento.sort((a, b) => b.leads - a.leads || a.nomeAnuncio.localeCompare(b.nomeAnuncio))

  // Bloco 2 — Distribuição A/B/C (todos os leads do período/canal)
  const d = contarClasses(doPeriodo)
  const distribuicao: DistribuicaoClassificacao = {
    ...d.porClasse,
    semClassificacao: d.sem,
    classificados: d.classificados,
    total: doPeriodo.length,
    pct: d.pct,
  }

  // Bloco 3 — Winrate por classificação
  const winrate: WinrateClasse[] = CLASSIFICACOES.map((classe) => {
    const ls = doPeriodo.filter((l) => l.classificacaoCRM === classe)
    const chegaram = ls.filter(teveCall).length
    const fechadosL = ls.filter((l) => l.etapaFunil === 'fechado')
    const mrr = fechadosL.reduce((s, l) => s + (l.mrr ?? 0), 0)
    return {
      classe,
      leads: ls.length,
      chegaram,
      fechados: fechadosL.length,
      winrate: div(fechadosL.length, chegaram) * 100,
      mrr,
      ticketMedio: div(mrr, fechadosL.length),
    }
  })

  const comGasto = ranking.filter((r) => r.gasto != null)
  const gastoTotal = comGasto.reduce((s, r) => s + (r.gasto ?? 0), 0)
  return {
    ranking,
    distribuicao,
    winrate,
    cruzamento,
    totais: {
      leads: doPeriodo.length,
      leadsComCriativo: cruzamento.reduce((s, r) => s + r.leads, 0),
      qualificados: ranking.reduce((s, r) => s + r.qualificados, 0),
      gasto: gastoTotal,
      custoPorQualificado: div(gastoTotal, comGasto.reduce((s, r) => s + r.qualificados, 0)),
    },
  }
}

/**
 * Frase de leitura do winrate ("Lead A fecha 6,9x mais que Lead C"). null se
 * não houver base (nenhuma call realizada numa das pontas).
 */
export function insightWinrate(w: WinrateClasse[]): string | null {
  const a = w.find((x) => x.classe === 'A')
  const c = w.find((x) => x.classe === 'C')
  if (!a || !c || a.chegaram === 0) return null
  if (c.chegaram === 0) return `Lead A fecha ${a.winrate.toFixed(0)}% das calls — ainda sem calls de Lead C no período pra comparar.`
  if (c.winrate === 0) {
    return `Lead A fecha ${a.winrate.toFixed(0)}% das calls; Lead C não fechou nenhuma (${c.chegaram} call${c.chegaram > 1 ? 's' : ''}). Priorize criativos que trazem A.`
  }
  const x = a.winrate / c.winrate
  return `Lead A fecha ${x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x mais que Lead C (${a.winrate.toFixed(0)}% vs ${c.winrate.toFixed(0)}%). Priorize criativos que trazem A.`
}
