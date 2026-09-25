/**
 * Configuração do Comercial — SLAs por etapa do funil (horas), Metas de
 * Marketing e Taxas de Conversão Ideal entre etapas.
 * Editável em Configurações › Geral. Mock: guardado no ComercialProvider
 * (estado), seed a partir daqui.
 */
export interface SlaConfigComercial {
  /** Caixa de Entrada → primeiro contato do SDR. */
  caixaPrimeiroContatoHoras: number
  /** Qualificação (SDR) → envio ao Closer. */
  qualificacaoEnvioCloserHoras: number
  /** Recebimento pelo Closer → realização da call. */
  closerCallHoras: number
  /** Tempo esperado entre uma tentativa de contato e a próxima (follow-up SDR). */
  slaEntreTentativasHoras: number
  /** Nº de tentativas de contato antes de sugerir desqualificar o lead. */
  limiteTentativasContato: number
  /** Nº de tentativas de abordagem (Social Selling) antes de sugerir descartar. */
  limiteTentativasAbordagem: number
}

export const SLA_CONFIG_INICIAL: SlaConfigComercial = {
  caixaPrimeiroContatoHoras: 1,
  qualificacaoEnvioCloserHoras: 24,
  closerCallHoras: 48,
  slaEntreTentativasHoras: 24,
  limiteTentativasContato: 5,
  limiteTentativasAbordagem: 4,
}

/**
 * Metas de Marketing — valores-alvo pra colorir os KPIs. Meta global +
 * sobrescrita por canal (ex.: Indicação converte melhor, meta maior).
 */
export interface MetaMarketingValores {
  taxaAgendamento: number // % (Reuniões agendadas ÷ Qualificados)
  roasContrato: number // x (Contrato fechado ÷ Investimento)
  cacAlvo: number // R$ — CAC máximo aceitável
}

export interface MetasMarketing extends MetaMarketingValores {
  overridesPorCanal: Record<string, Partial<MetaMarketingValores>>
}

export const METAS_MARKETING_INICIAL: MetasMarketing = {
  taxaAgendamento: 30,
  roasContrato: 3,
  cacAlvo: 2000,
  overridesPorCanal: {
    Indicação: { taxaAgendamento: 50, cacAlvo: 500 },
  },
}

/** Valor da meta pra um canal (usa override do canal ou cai no global). */
export function metaDoCanal(
  metas: MetasMarketing,
  canal: string,
  campo: keyof MetaMarketingValores,
): number {
  return metas.overridesPorCanal[canal]?.[campo] ?? metas[campo]
}

/**
 * Taxas de Conversão IDEAL entre etapas (%) — base do "Ideal Recalculado" nos
 * cards de Comercial › Marketing: o ideal de cada etapa vem do REALIZADO da
 * etapa anterior × a taxa ideal (ver calculateIdealCascade). Editável em
 * Configurações › Geral, logo abaixo das Metas de Marketing. Global +
 * sobrescrita por canal (vale na aba do canal no Marketing).
 */
export interface TaxasConversaoIdealValores {
  /** SDR: Leads Qualificados → Reuniões Agendadas. */
  sdr: number
  /** No-show máximo esperado (usado invertido: realizadas = agendadas × (1 − no-show)). */
  noShow: number
  /** Closer: Reuniões Realizadas → Fechamentos. */
  closer: number
}

export interface TaxasConversaoIdeal extends TaxasConversaoIdealValores {
  overridesPorCanal: Record<string, Partial<TaxasConversaoIdealValores>>
}

export const TAXAS_CONVERSAO_IDEAL_INICIAL: TaxasConversaoIdeal = {
  sdr: 30,
  noShow: 25,
  closer: 33,
  overridesPorCanal: {},
}

/** Aceita config parcial/antiga do banco (colunas ausentes → default). */
export function normalizarTaxasIdeais(raw: Partial<TaxasConversaoIdeal> | null | undefined): TaxasConversaoIdeal {
  return {
    sdr: raw?.sdr ?? TAXAS_CONVERSAO_IDEAL_INICIAL.sdr,
    noShow: raw?.noShow ?? TAXAS_CONVERSAO_IDEAL_INICIAL.noShow,
    closer: raw?.closer ?? TAXAS_CONVERSAO_IDEAL_INICIAL.closer,
    overridesPorCanal: { ...(raw?.overridesPorCanal ?? {}) },
  }
}

/**
 * Taxas efetivas de um canal: sobrescrita do canal > global (campo a campo —
 * um override só de "closer" herda sdr/no-show do global). Sem canal = global.
 */
export function taxasIdeaisDoEscopo(cfg: TaxasConversaoIdeal, canal?: string): TaxasConversaoIdealValores {
  const doCanal = canal ? cfg.overridesPorCanal[canal] ?? {} : {}
  const campo = (k: keyof TaxasConversaoIdealValores) => doCanal[k] ?? cfg[k]
  return { sdr: campo('sdr'), noShow: campo('noShow'), closer: campo('closer') }
}
