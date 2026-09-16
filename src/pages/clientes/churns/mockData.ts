/**
 * Dados mockados do dashboard de Churns.
 *
 * Tudo aqui é placeholder realista pra montar a tela. Quando o backend
 * estiver pronto, troque cada export por uma query (Supabase/RPC) — a
 * página consome só estes objetos, então a UI não muda.
 *
 * Base conceitual: churn = cliente cancelado (status/jornada 'churn').
 * MRR perdido = soma do ticket mensal no momento do cancelamento.
 */

export interface ChurnKpis {
  totalChurns: number
  totalChurnsDeltaPct: number
  mrrPerdido: number
  mrrPerdidoDeltaPct: number
  mrrMesAtual: number
  mrrMesAtualDeltaPct: number
  churnRate: number // 0-1
  churnRateDeltaPct: number
  tempoMedioCasaMeses: number
  tempoMedioCasaDeltaPct: number
  ticketMedioChurn: number
  ticketMedioAtivo: number
}

export const churnKpis: ChurnKpis = {
  totalChurns: 79,
  totalChurnsDeltaPct: 0.12,
  mrrPerdido: 148951,
  mrrPerdidoDeltaPct: 0.18,
  mrrMesAtual: 10552,
  mrrMesAtualDeltaPct: 0.3,
  churnRate: 0.462,
  churnRateDeltaPct: 0.05,
  tempoMedioCasaMeses: 6,
  tempoMedioCasaDeltaPct: -0.08,
  ticketMedioChurn: 1885,
  ticketMedioAtivo: 2131,
}

export interface TendenciaMes {
  mes: string // "out/25"
  qtd: number // churns no mês
  mrr: number // MRR perdido no mês (R$)
}

/** Últimos 12 meses (out/25 → set/26). Pico em mai/26. */
export const tendenciaChurns: TendenciaMes[] = [
  { mes: 'out/25', qtd: 0, mrr: 0 },
  { mes: 'nov/25', qtd: 0, mrr: 0 },
  { mes: 'dez/25', qtd: 0, mrr: 0 },
  { mes: 'jan/26', qtd: 5, mrr: 7200 },
  { mes: 'fev/26', qtd: 8, mrr: 11800 },
  { mes: 'mar/26', qtd: 3, mrr: 4100 },
  { mes: 'abr/26', qtd: 10, mrr: 15600 },
  { mes: 'mai/26', qtd: 14, mrr: 26400 },
  { mes: 'jun/26', qtd: 8, mrr: 12300 },
  { mes: 'jul/26', qtd: 12, mrr: 20100 },
  { mes: 'ago/26', qtd: 8, mrr: 11400 },
  { mes: 'set/26', qtd: 5, mrr: 8050 },
]

export interface MotivoChurn {
  motivo: string
  qtd: number
}

/** Soma = 79. Percentuais são calculados na tela. */
export const churnsPorMotivo: MotivoChurn[] = [
  { motivo: 'Resultado inexistente', qtd: 32 },
  { motivo: 'Outro', qtd: 17 },
  { motivo: 'Dificuldades financeiras', qtd: 10 },
  { motivo: 'Problemas de atendimento', qtd: 8 },
  { motivo: 'Mudança de estratégia', qtd: 6 },
  { motivo: 'Encerramento da clínica', qtd: 4 },
  { motivo: 'Não informado', qtd: 2 },
]

export interface ChurnPorSquad {
  squad: string
  qtd: number
}

export const churnsPorSquad: ChurnPorSquad[] = [
  { squad: 'BlackOps', qtd: 26 },
  { squad: 'Delta', qtd: 20 },
  { squad: 'MovSeals', qtd: 19 },
  { squad: 'Sem squad', qtd: 14 },
]

export interface FaixaTempoCasa {
  faixa: string
  qtd: number
}

export const churnsPorTempoCasa: FaixaTempoCasa[] = [
  { faixa: '0-3m', qtd: 23 },
  { faixa: '3-6m', qtd: 29 },
  { faixa: '6-12m', qtd: 19 },
  { faixa: '12-24m', qtd: 6 },
  { faixa: '24m+', qtd: 2 },
]

/** Comparativo de ticket médio: quem cancelou vs base ativa. */
export const ticketComparativo = {
  churns: 1885,
  baseAtiva: 2131,
}
