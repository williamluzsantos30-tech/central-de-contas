/**
 * Configuração do Comercial — SLAs por etapa do funil (horas).
 * Editável em Configurações › Geral › "SLA Comercial". Mock: guardado no
 * ComercialProvider (estado), seed a partir daqui.
 */
export interface SlaConfigComercial {
  /** Caixa de Entrada → primeiro contato do SDR. */
  caixaPrimeiroContatoHoras: number
  /** Qualificação (SDR) → envio ao Closer. */
  qualificacaoEnvioCloserHoras: number
  /** Recebimento pelo Closer → realização da call. */
  closerCallHoras: number
}

export const SLA_CONFIG_INICIAL: SlaConfigComercial = {
  caixaPrimeiroContatoHoras: 1,
  qualificacaoEnvioCloserHoras: 24,
  closerCallHoras: 48,
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
