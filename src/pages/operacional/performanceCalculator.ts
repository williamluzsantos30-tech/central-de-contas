/**
 * Performance da Equipe — score de cada colaborador = UMA métrica-chave do
 * cargo (0–100%), sempre REAPROVEITANDO o cálculo do módulo de origem:
 *
 *   Gestor de Tráfego → % tarefas no prazo    (lib/tarefasDoDia · classificarPrazoTarefas)
 *   Social Media      → % posts no prazo      (lib/socialPosts · getPostsForDateRange + prazoDoPost)
 *   SDR               → SLA do 1º contato     (comercial/sla · slaPrimeiroContato)
 *   Closer            → Winrate               (comercial/marketingCalculator · teveCall — igual ao Funil Tráfego)
 *   Social Seller     → % captados qualificados (Lead.qualificado)
 *   Produção          → % entregas no prazo   (lib/dates · isDateOverdue — "demandas atrasadas" invertido)
 *   Account Manager   → Score de Squad        (lib/scoreSquads · calculaScoreSquads → scoreSquadPercentual)
 *
 * Como toda métrica já é um %, o score é o próprio % — comparável entre
 * cargos num ranking único. Sem dado no período → score null (fica fora do
 * ranking e aparece em "sem dados").
 *
 * Entidade CALCULADA (nunca gravada): a tela carrega os dados e chama
 * calculateTeamPerformance.
 */
import type {
  Cliente,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
  Profile,
  Squad,
  Tarefa,
} from '@/types/database'
import { funcaoPrincipal } from '@/lib/cargos'
import { isDateOverdue } from '@/lib/dates'
import { classificarPrazoTarefas } from '@/lib/tarefasDoDia'
import { getPostsForDateRange, prazoDoPost } from '@/lib/socialPosts'
import { calculaScoreSquads, scoreSquadPercentual, type EventoMovimento } from '@/lib/scoreSquads'
import { EQUIPE_COMERCIAL, type Lead } from '@/pages/comercial/mockLeads'
import { slaPrimeiroContato } from '@/pages/comercial/sla'
import { teveCall } from '@/pages/comercial/marketingCalculator'
import type { SlaConfigComercial } from '@/pages/comercial/mockComercialConfig'

// ── Cargos e métricas ────────────────────────────────────────────────────────
export type CargoPerformance =
  | 'gestor_trafego'
  | 'social_media'
  | 'sdr'
  | 'closer'
  | 'social_seller'
  | 'producao'
  | 'account_manager'

export const METRICA_POR_CARGO: Record<CargoPerformance, { cargo: string; metrica: string; curta: string }> = {
  gestor_trafego: { cargo: 'Gestor de Tráfego', metrica: 'Tarefas no prazo', curta: '% tarefas no prazo' },
  social_media: { cargo: 'Social Media', metrica: 'Posts no prazo', curta: '% posts no prazo' },
  sdr: { cargo: 'SDR', metrica: 'SLA de primeiro contato', curta: 'SLA 1º contato' },
  closer: { cargo: 'Closer', metrica: 'Winrate', curta: 'Winrate' },
  social_seller: { cargo: 'Social Seller', metrica: 'Captados que viraram qualificados', curta: '% qualificação' },
  producao: { cargo: 'Produção', metrica: 'Entregas no prazo', curta: '% entregas no prazo' },
  account_manager: { cargo: 'Account Manager', metrica: 'Score de Saúde do Squad', curta: 'Score de Squad' },
}
export const ORDEM_CARGOS: CargoPerformance[] = [
  'gestor_trafego',
  'social_media',
  'producao',
  'account_manager',
  'sdr',
  'closer',
  'social_seller',
]

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface PeriodoPerformance {
  /** null = todo o período. */
  inicio: Date | null
  fim: Date
}

export interface Colaborador {
  id: string
  nome: string
  /** Sempre exibido (diferencia contas com o mesmo nome). */
  identificador: string
  avatarUrl?: string | null
  cargo: CargoPerformance
  origem: 'equipe' | 'comercial'
  /** Squad principal (Equipe Operacional) — base do score do AM. */
  squadNome?: string | null
}

export interface PerformanceColaborador {
  colaboradorId: string
  colaborador: Colaborador
  periodo: PeriodoPerformance
  cargo: CargoPerformance
  metricaUtilizada: string
  /** 0–100; null = sem dado no período. */
  scorePercentual: number | null
  /** Ex.: "Tarefas no prazo: 3/4". */
  resumo: string
  /** Texto curto do detalhamento (ex.: "1 fora do prazo · 2 ainda no prazo"). */
  detalheTexto: string
  /** Dados brutos do cálculo. */
  detalhamento: Record<string, number>
}

type ItemProducao = { status: string; prazo: string | null; responsavel_id: string | null; cliente_id: string | null }
type SquadComMeta = Squad & { atual_indicacoes?: number | null }

export interface DadosPerformance {
  hoje: Date
  profiles: Profile[]
  clientes: Cliente[]
  tarefas: Tarefa[]
  producao: ItemProducao[]
  itensSocial: ItemSocialMedia[]
  planejamentos: PlanejamentoSocialMedia[]
  leads: Lead[]
  slaConfig: SlaConfigComercial
  squads: SquadComMeta[]
  eventosMov: EventoMovimento[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const isoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const pct = (a: number, total: number) => (total > 0 ? Math.round((a / total) * 100) : null)
const noPeriodo = (iso: string | null | undefined, p: PeriodoPerformance) => {
  if (!iso) return false
  const d = iso.slice(0, 10)
  return (!p.inicio || d >= isoDia(p.inicio)) && d <= isoDia(p.fim)
}
const plural = (n: number, s: string, pl = `${s}s`) => `${n} ${n === 1 ? s : pl}`

/** Cargo de performance de um membro da Equipe Operacional (pelo papel/cargo). */
export function cargoDoProfile(p: Profile): CargoPerformance | null {
  const f = funcaoPrincipal(p)
  if (f === 'gestor_trafego' || f === 'social_media' || f === 'account_manager') return f
  if (f === 'designer') return 'producao'
  const papel = (p.papel?.nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (papel.includes('video') || papel.includes('editor')) return 'producao'
  return null // Diretoria, Heads, papéis sem métrica definida
}

/** Todos os colaboradores avaliáveis: Equipe Operacional + time Comercial. */
export function colaboradoresAvaliaveis(dados: DadosPerformance): Colaborador[] {
  const squadPorId = new Map(dados.squads.map((s) => [s.id, s.nome]))
  const daEquipe: Colaborador[] = dados.profiles
    .filter((p) => p.ativo && p.aprovado)
    .flatMap((p) => {
      const cargo = cargoDoProfile(p)
      if (!cargo) return []
      return [
        {
          id: p.id,
          nome: p.nome,
          identificador: p.email || p.id,
          avatarUrl: p.avatar_url,
          cargo,
          origem: 'equipe' as const,
          squadNome: p.squad?.nome ?? (p.squad_id ? squadPorId.get(p.squad_id) ?? null : null),
        },
      ]
    })
  const comercial = (lista: { id: string; nome: string }[], cargo: CargoPerformance): Colaborador[] =>
    lista.map((x) => ({ id: x.id, nome: x.nome, identificador: `Comercial · ${METRICA_POR_CARGO[cargo].cargo}`, cargo, origem: 'comercial' }))
  return [
    ...daEquipe,
    ...comercial(EQUIPE_COMERCIAL.sdrs, 'sdr'),
    ...comercial(EQUIPE_COMERCIAL.closers, 'closer'),
    ...comercial(EQUIPE_COMERCIAL.socialSellers, 'social_seller'),
  ]
}

// ── Cálculo por cargo ────────────────────────────────────────────────────────
export function calculatePerformance(
  colab: Colaborador,
  periodo: PeriodoPerformance,
  dados: DadosPerformance,
): PerformanceColaborador {
  const base = {
    colaboradorId: colab.id,
    colaborador: colab,
    periodo,
    cargo: colab.cargo,
    metricaUtilizada: METRICA_POR_CARGO[colab.cargo].metrica,
  }
  const clientePorId = new Map(dados.clientes.map((c) => [c.id, c]))

  switch (colab.cargo) {
    case 'gestor_trafego': {
      // Tarefas próprias: responsável direto ou, sem responsável, gestor do cliente.
      const minhas = dados.tarefas.filter((t) => (t.responsavel_id ?? clientePorId.get(t.cliente_id)?.gestor_id) === colab.id)
      const r = classificarPrazoTarefas(minhas, dados.clientes, isoDia(dados.hoje), periodo.inicio ? isoDia(periodo.inicio) : null)
      const total = r.noPrazo + r.foraDoPrazo
      return {
        ...base,
        scorePercentual: pct(r.noPrazo, total),
        resumo: `Tarefas no prazo: ${r.noPrazo}/${total}`,
        detalheTexto: `${plural(r.foraDoPrazo, 'fora do prazo', 'fora do prazo')} · ${plural(r.pendentes, 'ainda no prazo', 'ainda no prazo')}`,
        detalhamento: { ...r },
      }
    }
    case 'social_media': {
      const posts = getPostsForDateRange(dados.itensSocial, dados.planejamentos, dados.clientes, periodo.inicio ?? new Date(2000, 0, 1), dados.hoje)
        .filter((p) => (p.item.responsavel_id ?? p.cliente.social_media_id) === colab.id)
      let noPrazo = 0
      let fora = 0
      let pendentes = 0
      for (const p of posts) {
        const s = prazoDoPost(p)
        if (s === 'no_prazo') noPrazo++
        else if (s === 'fora') fora++
        else pendentes++
      }
      return {
        ...base,
        scorePercentual: pct(noPrazo, noPrazo + fora),
        resumo: `Posts no prazo: ${noPrazo}/${noPrazo + fora}`,
        detalheTexto: `${plural(fora, 'atrasado ou publicado depois', 'atrasados ou publicados depois')} · ${plural(pendentes, 'agendado')}`,
        detalhamento: { noPrazo, foraDoPrazo: fora, agendados: pendentes },
      }
    }
    case 'sdr': {
      const meus = dados.leads.filter((l) => l.sdrId === colab.id && noPeriodo(l.dataEntrada ?? l.dataCaptacao, periodo))
      let noPrazo = 0
      let fora = 0
      let semContato = 0
      for (const l of meus) {
        const s = slaPrimeiroContato(l, dados.slaConfig)
        if (!s.aplicavel) semContato++
        else if (s.noPrazo) noPrazo++
        else fora++
      }
      return {
        ...base,
        scorePercentual: pct(noPrazo, noPrazo + fora),
        resumo: `1º contato no SLA: ${noPrazo}/${noPrazo + fora}`,
        detalheTexto: `SLA de ${dados.slaConfig.caixaPrimeiroContatoHoras}h · ${plural(fora, 'fora do SLA', 'fora do SLA')}${semContato ? ` · ${semContato} sem contato` : ''}`,
        detalhamento: { noPrazo, foraDoPrazo: fora, semContato },
      }
    }
    case 'closer': {
      // Reuniões do período (data da reunião). Winrate = fechados ÷ calls que aconteceram (teveCall).
      const meus = dados.leads.filter((l) => l.closerId === colab.id && noPeriodo(l.dataReuniaoAgendada, periodo))
      const calls = meus.filter(teveCall)
      const fechados = calls.filter((l) => l.etapaFunil === 'fechado').length
      const noShow = meus.filter((l) => l.subStatusNegociacao === 'no_show').length
      return {
        ...base,
        scorePercentual: pct(fechados, calls.length),
        resumo: `Winrate: ${fechados}/${calls.length} fechados`,
        detalheTexto: `${plural(calls.length - fechados, 'call sem fechamento', 'calls sem fechamento')}${noShow ? ` · ${noShow} no-show` : ''}`,
        detalhamento: { fechados, calls: calls.length, noShow },
      }
    }
    case 'social_seller': {
      const captados = dados.leads.filter((l) => l.socialSellerId === colab.id && noPeriodo(l.dataCaptacao, periodo))
      const qualificados = captados.filter((l) => l.qualificado).length
      return {
        ...base,
        scorePercentual: pct(qualificados, captados.length),
        resumo: `Qualificados: ${qualificados}/${captados.length} captados`,
        detalheTexto: `${plural(captados.length - qualificados, 'ainda não qualificado', 'ainda não qualificados')}`,
        detalhamento: { qualificados, captados: captados.length },
      }
    }
    case 'producao': {
      // "Demandas atrasadas" invertido: no prazo = concluída; atrasada = não concluída e prazo vencido.
      const minhas = dados.producao.filter((d) => d.responsavel_id === colab.id && d.prazo && noPeriodo(d.prazo, periodo))
      const noPrazo = minhas.filter((d) => d.status === 'conclusao').length
      const atrasadas = minhas.filter((d) => d.status !== 'conclusao' && isDateOverdue(d.prazo)).length
      const andamento = minhas.length - noPrazo - atrasadas
      return {
        ...base,
        scorePercentual: pct(noPrazo, noPrazo + atrasadas),
        resumo: `Entregas no prazo: ${noPrazo}/${noPrazo + atrasadas}`,
        detalheTexto: `${plural(atrasadas, 'atrasada')} · ${andamento} em andamento`,
        detalhamento: { noPrazo, atrasadas, emAndamento: andamento },
      }
    }
    case 'account_manager': {
      // Squad(s) do AM: squad principal (Equipe Operacional) ou, sem ele, os squads dos clientes que atende.
      const squadsDoAm = colab.squadNome
        ? [colab.squadNome]
        : [...new Set(dados.clientes.filter((c) => c.account_manager_id === colab.id && !c.arquivado_em && c.squad).map((c) => c.squad as string))]
      if (!squadsDoAm.length) {
        return { ...base, scorePercentual: null, resumo: 'Sem squad vinculado', detalheTexto: 'Defina o squad em Equipe Operacional', detalhamento: {} }
      }
      // Mesmo cálculo do Resumo Geral, no mês de referência (mês do fim do período).
      const mesISO = `${isoDia(dados.hoje).slice(0, 7)}-01`
      const ativos = dados.squads.filter((s) => s.ativo).map((s) => s.nome)
      const mrrTotal = dados.clientes.filter((c) => c.status === 'ativo' && !c.arquivado_em).reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
      const indicacoes = new Map(dados.squads.map((s) => [s.nome, Number(s.atual_indicacoes ?? 0)]))
      const scores = calculaScoreSquads(dados.clientes, mesISO, mrrTotal / (ativos.length || 1), squadsDoAm, false, indicacoes, dados.eventosMov)
      if (!scores.length) {
        return { ...base, scorePercentual: null, resumo: 'Squad sem dados', detalheTexto: squadsDoAm.join(', '), detalhamento: {} }
      }
      const media = Math.round(scores.reduce((s, q) => s + scoreSquadPercentual(q.score), 0) / scores.length)
      const rotulo = { saudavel: 'Saudável', atencao: 'Atenção', critico: 'Crítico' } as const
      return {
        ...base,
        scorePercentual: media,
        resumo: `Score de Squad: ${scores.map((q) => `${q.nome} ${q.score}/9`).join(' · ')}`,
        detalheTexto: scores
          .map((q) => `${rotulo[q.classificacao]} · NRR ${Math.round(q.nrr * 100)}% · ${plural(q.emRiscoCount, 'em atenção', 'em atenção')} · ${plural(q.churnsCount, 'churn')}`)
          .join(' | '),
        detalhamento: Object.fromEntries(scores.map((q) => [q.nome, q.score])),
      }
    }
  }
}

/** Ranking do time: com score primeiro (maior → menor), sem dados no fim. */
export function calculateTeamPerformance(periodo: PeriodoPerformance, dados: DadosPerformance): PerformanceColaborador[] {
  return colaboradoresAvaliaveis(dados)
    .map((c) => calculatePerformance(c, periodo, dados))
    .sort((a, b) => {
      if (a.scorePercentual == null && b.scorePercentual == null) return a.colaborador.nome.localeCompare(b.colaborador.nome, 'pt-BR')
      if (a.scorePercentual == null) return 1
      if (b.scorePercentual == null) return -1
      return b.scorePercentual - a.scorePercentual || a.colaborador.nome.localeCompare(b.colaborador.nome, 'pt-BR')
    })
}
