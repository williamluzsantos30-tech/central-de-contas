/**
 * Comissionamento — comissões da equipe comercial sobre os fechamentos.
 * 100% derivado dos Leads fechados (Comercial). A REGRA é configurável
 * (base + % por papel), então nada é chutado — o usuário define em Config.
 *
 * Cada deal fechado paga comissão a quem participou: Closer, SDR (que
 * qualificou) e Social Seller (que captou), cada um pelo seu %.
 */
import { pessoaComercialNome, type Lead } from '@/pages/comercial/mockLeads'

export type BaseComissao = 'mrr' | 'caixaRecolhido' | 'contratoFechado'

export const BASES_COMISSAO: { key: BaseComissao; label: string }[] = [
  { key: 'caixaRecolhido', label: 'Caixa Recolhido' },
  { key: 'mrr', label: 'MRR' },
  { key: 'contratoFechado', label: 'Contrato Fechado' },
]

export interface ComissaoConfig {
  base: BaseComissao
  pctCloser: number
  pctSdr: number
  pctSocial: number
}

export const COMISSAO_CONFIG_INICIAL: ComissaoConfig = {
  base: 'caixaRecolhido',
  pctCloser: 10,
  pctSdr: 3,
  pctSocial: 2,
}

export type PapelComissao = 'Closer' | 'SDR' | 'Social Selling'

export interface ComissaoPessoa {
  id: string
  nome: string
  papel: PapelComissao
  deals: number
  base: number // base gerada pela pessoa (soma dos deals que tocou)
  comissao: number
}

export interface ComissoesResult {
  porPessoa: ComissaoPessoa[]
  totalComissao: number
  totalBase: number
  fechamentos: number
}

function baseValor(l: Lead, base: BaseComissao): number {
  if (base === 'mrr') return l.mrr ?? 0
  if (base === 'contratoFechado') return l.contratoFechado ?? 0
  return l.caixaRecolhido ?? 0
}

export function calculateComissoes(leads: Lead[], config: ComissaoConfig, meses: string[]): ComissoesResult {
  const set = new Set(meses)
  const fechados = leads.filter((l) => l.etapaFunil === 'fechado' && l.dataFechamento && set.has(l.dataFechamento.slice(0, 7)))

  const acc = new Map<string, ComissaoPessoa>()
  const add = (id: string | undefined, papel: PapelComissao, base: number, com: number) => {
    if (!id || com <= 0) return
    const cur = acc.get(id) ?? { id, nome: pessoaComercialNome(id), papel, deals: 0, base: 0, comissao: 0 }
    cur.deals += 1
    cur.base += base
    cur.comissao += com
    acc.set(id, cur)
  }

  let totalComissao = 0
  let totalBase = 0
  for (const l of fechados) {
    const b = baseValor(l, config.base)
    totalBase += b
    const cCloser = (b * config.pctCloser) / 100
    const cSdr = (b * config.pctSdr) / 100
    const cSocial = (b * config.pctSocial) / 100
    add(l.closerId, 'Closer', b, cCloser)
    add(l.sdrId, 'SDR', b, cSdr)
    add(l.socialSellerId, 'Social Selling', b, cSocial)
    totalComissao += (l.closerId ? cCloser : 0) + (l.sdrId ? cSdr : 0) + (l.socialSellerId ? cSocial : 0)
  }

  const porPessoa = [...acc.values()].sort((a, b) => b.comissao - a.comissao)
  return { porPessoa, totalComissao, totalBase, fechamentos: fechados.length }
}
