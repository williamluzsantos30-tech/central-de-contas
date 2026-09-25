/**
 * Diagnóstico de desempenho de campanha — motor de regras GENÉRICO (serve pra
 * qualquer plataforma; os textos específicos vêm de `adapter.dicas`).
 *
 * Compara a campanha com a MÉDIA DA PRÓPRIA CONTA (não com benchmark de
 * mercado — varia demais por nicho) e gera recomendações acionáveis:
 *   - critico      : está queimando verba (sem conversão / CPA muito alto)
 *   - atencao      : algo abaixo do esperado (CTR, conversão, entrega, fadiga)
 *   - oportunidade : dá pra ganhar mais (escalar, reativar, testar)
 *
 * Recomendações com `executavel` podem ser aplicadas direto (pausar, reativar,
 * ajustar orçamento — via API, simulada nesta etapa). As demais são
 * orientações pro gestor executar e registrar no Log de otimização.
 */
import type { TipoOtimizacao } from '@/types/database'
import {
  diasDecorridosNoPeriodo,
  formatKpi,
  type AcaoCampanha,
  type AdsCampanha,
  type AdsMetricas,
  type AdsPlatformAdapter,
} from './adsPlatform'

export type Severidade = 'critico' | 'atencao' | 'oportunidade'

export interface Recomendacao {
  id: string
  severidade: Severidade
  titulo: string
  /** Por quê — com os números. */
  diagnostico: string
  /** O que fazer. */
  acao: string
  /** Categoria no Log de otimização. */
  tipoOtimizacao: TipoOtimizacao
  /** Ação que pode ser aplicada direto pela API. */
  executavel?: AcaoCampanha
}

export interface MetricasCampanha {
  ctr: number // %
  cpc: number // R$
  cpa: number | null // R$ (null = sem conversão)
  taxaConversao: number // % dos cliques
  diasDecorridos: number
  /** Gasto esperado até hoje = orçamento diário × dias decorridos. */
  gastoEsperado: number
  /** Ritmo de entrega: gasto ÷ esperado (1 = gastando todo o orçamento). */
  ritmo: number
}

export function metricasCampanha(c: AdsCampanha, periodo: string): MetricasCampanha {
  const dias = diasDecorridosNoPeriodo(periodo)
  const gastoEsperado = c.orcamentoDiario * dias
  return {
    ctr: c.impressoes > 0 ? (c.cliques / c.impressoes) * 100 : 0,
    cpc: c.cliques > 0 ? c.investimentoMes / c.cliques : 0,
    cpa: c.conversoes > 0 ? c.investimentoMes / c.conversoes : null,
    taxaConversao: c.cliques > 0 ? (c.conversoes / c.cliques) * 100 : 0,
    diasDecorridos: dias,
    gastoEsperado,
    ritmo: gastoEsperado > 0 ? c.investimentoMes / gastoEsperado : 0,
  }
}

/** Médias da conta usadas como referência. */
export function mediasConta(conta: AdsMetricas) {
  return {
    ctr: conta.ctr,
    cpa: conta.cpa,
    taxaConversao: conta.cliques > 0 ? (conta.conversoes / conta.cliques) * 100 : 0,
  }
}

const ORDEM: Record<Severidade, number> = { critico: 0, atencao: 1, oportunidade: 2 }
const moeda = (v: number) => formatKpi(v, 'moeda')
const pct = (v: number) => `${Math.round(v)}%`
const pct2 = (v: number) => formatKpi(v, 'pct')

export function diagnosticarCampanha(
  adapter: AdsPlatformAdapter,
  c: AdsCampanha,
  conta: AdsMetricas,
  periodo: string,
): Recomendacao[] {
  const m = metricasCampanha(c, periodo)
  const media = mediasConta(conta)
  const d = adapter.dicas
  const recs: Recomendacao[] = []
  const add = (key: string, r: Omit<Recomendacao, 'id'>) => recs.push({ id: `${c.id}:${key}`, ...r })

  if (c.status === 'removida') return []

  if (c.status === 'em_revisao') {
    add('revisao', {
      severidade: 'atencao',
      titulo: 'Anúncios em revisão',
      diagnostico: `Os anúncios desta campanha estão em revisão no ${adapter.nome} — ela pode não entregar até a aprovação.`,
      acao: 'Acompanhe a aprovação. Se algum anúncio for reprovado, ajuste texto/criativo conforme a política e reenvie.',
      tipoOtimizacao: 'outro',
    })
    return recs
  }

  if (c.status === 'pausada') {
    if (m.cpa != null && media.cpa > 0 && m.cpa <= media.cpa) {
      add('reativar', {
        severidade: 'oportunidade',
        titulo: 'Pausada, mas convertia bem',
        diagnostico: `CPA de ${moeda(m.cpa)} no mês — abaixo da média da conta (${moeda(media.cpa)}).`,
        acao: 'Reative a campanha: ela vinha convertendo mais barato que a média.',
        tipoOtimizacao: 'outro',
        executavel: { tipo: 'reativar' },
      })
    }
    return recs
  }

  // ── Campanha ativa ──────────────────────────────────────────────────────────
  if (c.conversoes === 0 && c.investimentoMes >= 200) {
    add('sem-conversao', {
      severidade: 'critico',
      titulo: 'Gastando sem converter',
      diagnostico: `${moeda(c.investimentoMes)} investidos no mês e nenhuma conversão.`,
      acao: d.semConversao,
      tipoOtimizacao: 'pausa_campanha',
      executavel: { tipo: 'pausar' },
    })
  } else if (m.cpa != null && media.cpa > 0 && m.cpa > media.cpa * 1.2) {
    const critico = m.cpa > media.cpa * 1.5
    add('cpa-alto', {
      severidade: critico ? 'critico' : 'atencao',
      titulo: 'CPA acima da média da conta',
      diagnostico: `${moeda(m.cpa)} por conversão — ${pct((m.cpa / media.cpa - 1) * 100)} acima da média da conta (${moeda(media.cpa)}).`,
      acao: critico
        ? `${d.cpaAlto(c.tipo)} Enquanto ajusta, reduza o orçamento em 20% pra conter o desperdício.`
        : d.cpaAlto(c.tipo),
      tipoOtimizacao: d.tipoOtimCpaAlto,
      executavel: critico ? { tipo: 'orcamento', percentual: -20 } : undefined,
    })
  }

  if (media.ctr > 0 && c.impressoes > 0 && m.ctr < media.ctr * 0.6) {
    add('ctr-baixo', {
      severidade: 'atencao',
      titulo: 'CTR baixo — anúncio pouco atrativo',
      diagnostico: `CTR de ${pct2(m.ctr)}, contra ${pct2(media.ctr)} na média da conta.`,
      acao: d.ctrBaixo(c.tipo),
      tipoOtimizacao: 'novo_criativo',
    })
  }

  if (c.conversoes > 0 && media.taxaConversao > 0 && m.taxaConversao < media.taxaConversao * 0.5) {
    add('conversao-baixa', {
      severidade: 'atencao',
      titulo: 'Muitos cliques, poucas conversões',
      diagnostico: `Só ${pct2(m.taxaConversao)} dos cliques viram conversão (média da conta: ${pct2(media.taxaConversao)}).`,
      acao: d.conversaoBaixa,
      tipoOtimizacao: 'teste_ab',
    })
  }

  const cpaBom = m.cpa != null && media.cpa > 0 && m.cpa <= media.cpa
  if (m.ritmo >= 0.95 && cpaBom) {
    add('escalar', {
      severidade: 'oportunidade',
      titulo: 'Limitada pelo orçamento com CPA bom',
      diagnostico: `Gastou ${pct(m.ritmo * 100)} do orçamento previsto até hoje, com CPA ${pct((1 - m.cpa! / media.cpa) * 100)} abaixo da média da conta.`,
      acao: d.escalar,
      tipoOtimizacao: 'ajuste_orcamento',
      executavel: { tipo: 'orcamento', percentual: 20 },
    })
  } else if (m.ritmo < 0.6) {
    add('subentrega', {
      severidade: 'atencao',
      titulo: 'Entregando abaixo do orçamento',
      diagnostico: `Gastou só ${pct(m.ritmo * 100)} do previsto até hoje (${moeda(c.investimentoMes)} de ${moeda(m.gastoEsperado)}).`,
      acao: d.subentrega(c.tipo),
      tipoOtimizacao: d.tipoOtimSubentrega,
    })
  }

  if (d.fadiga && conta.frequencia != null && conta.frequencia >= 2.5) {
    add('fadiga', {
      severidade: 'atencao',
      titulo: 'Frequência alta — risco de fadiga',
      diagnostico: `Frequência média de ${conta.frequencia.toFixed(1).replace('.', ',')} na conta.`,
      acao: d.fadiga,
      tipoOtimizacao: 'novo_criativo',
    })
  }

  if (recs.length === 0) {
    add('saudavel', {
      severidade: 'oportunidade',
      titulo: 'Campanha saudável',
      diagnostico: 'CPA, CTR, conversão e entrega dentro ou melhores que a média da conta.',
      acao: d.saudavel,
      tipoOtimizacao: 'teste_ab',
    })
  }

  return recs.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade])
}

/** Pior severidade da campanha (pro indicador na tabela). */
export function severidadeCampanha(recs: Recomendacao[]): Severidade | null {
  if (recs.some((r) => r.severidade === 'critico')) return 'critico'
  if (recs.some((r) => r.severidade === 'atencao')) return 'atencao'
  if (recs.length > 0) return 'oportunidade'
  return null
}

export function descreverAcao(acao: AcaoCampanha, c: AdsCampanha): string {
  if (acao.tipo === 'pausar') return 'Campanha pausada'
  if (acao.tipo === 'reativar') return 'Campanha reativada'
  const novo = Math.max(1, Math.round(c.orcamentoDiario * (1 + acao.percentual / 100)))
  const sinal = acao.percentual > 0 ? '+' : ''
  return `Orçamento diário ${sinal}${acao.percentual}%: ${moeda(c.orcamentoDiario)} → ${moeda(novo)}`
}

export function rotuloAcao(acao: AcaoCampanha): string {
  if (acao.tipo === 'pausar') return 'Pausar campanha'
  if (acao.tipo === 'reativar') return 'Reativar campanha'
  return `${acao.percentual > 0 ? 'Aumentar' : 'Reduzir'} orçamento ${Math.abs(acao.percentual)}%`
}

export function tipoOtimizacaoDaAcao(acao: AcaoCampanha): TipoOtimizacao {
  if (acao.tipo === 'pausar') return 'pausa_campanha'
  if (acao.tipo === 'orcamento') return 'ajuste_orcamento'
  return 'outro'
}
