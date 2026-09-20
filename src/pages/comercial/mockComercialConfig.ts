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
