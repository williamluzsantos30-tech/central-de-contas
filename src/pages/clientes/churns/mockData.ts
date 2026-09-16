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

export interface ClienteChurn {
  id: string
  nome: string
  nicho: string
  squad: string | null
  accountManager: string | null
  ticketMensal: number
  dataChurn: string // ISO 'YYYY-MM-DD'
  tempoCasaMeses: number | null
  ltv: number | null
  motivo: string
  nps: number | null
}

/** Lista de clientes cancelados (mais recentes primeiro). */
export const churnsClientes: ClienteChurn[] = [
  { id: 'ch-01', nome: 'Dr. Daniel Oliveira', nicho: 'Cirurgião Gastrointestinal', squad: 'BlackOps', accountManager: 'Lucas Portilho', ticketMensal: 3300, dataChurn: '2026-09-16', tempoCasaMeses: 8, ltv: 19800, motivo: 'Resultado inexistente', nps: 8 },
  { id: 'ch-02', nome: 'Dr. Vinícius Cruz', nicho: 'Otorrinolaringologista', squad: 'BlackOps', accountManager: 'Lucas Portilho', ticketMensal: 3085, dataChurn: '2026-09-15', tempoCasaMeses: 7, ltv: 12595, motivo: 'Outro', nps: 8 },
  { id: 'ch-03', nome: 'Dra. Fernanda Soubak', nicho: 'Pediatra Alergista Infantil e Adulto', squad: 'Delta', accountManager: 'Alexandre Fernandes', ticketMensal: 1500, dataChurn: '2026-09-10', tempoCasaMeses: 7, ltv: 10500, motivo: 'Resultado inexistente', nps: 5 },
  { id: 'ch-04', nome: 'Dra. Juliana Soares', nicho: 'Clínica Geral e Cardiologia', squad: 'MovSeals', accountManager: 'Jorge Luiz', ticketMensal: 1667, dataChurn: '2026-09-10', tempoCasaMeses: 7, ltv: 11667, motivo: 'Resultado inexistente', nps: 9 },
  { id: 'ch-05', nome: 'Dra. Susana Mesquita', nicho: 'Ginecologista', squad: 'Delta', accountManager: 'Alexandre Fernandes', ticketMensal: 1000, dataChurn: '2026-09-03', tempoCasaMeses: 12, ltv: 12000, motivo: 'Resultado inexistente', nps: 8 },
  { id: 'ch-06', nome: 'Dra. Samyra Coutrim', nicho: 'Ginecologista', squad: 'MovSeals', accountManager: 'Jorge Luiz', ticketMensal: 1543, dataChurn: '2026-08-28', tempoCasaMeses: 8, ltv: 12344, motivo: 'Problemas de atendimento', nps: null },
  { id: 'ch-07', nome: 'Dra. Annita Torres', nicho: 'Ginecologista', squad: 'MovSeals', accountManager: 'Jorge Luiz', ticketMensal: 1245, dataChurn: '2026-08-12', tempoCasaMeses: 4, ltv: 4980, motivo: 'Resultado inexistente', nps: 8 },
  { id: 'ch-08', nome: 'Dra. Simone Pereira', nicho: 'Ginecologista - Cirurgiã', squad: 'BlackOps', accountManager: 'Lucas Portilho', ticketMensal: 1285, dataChurn: '2026-08-12', tempoCasaMeses: 4, ltv: 5140, motivo: 'Resultado inexistente', nps: 10 },
  { id: 'ch-09', nome: 'Dr. Artur Guerra', nicho: 'Ortopedista - Cirurgia de Coluna', squad: 'BlackOps', accountManager: 'Lucas Portilho', ticketMensal: 1800, dataChurn: '2026-08-10', tempoCasaMeses: 2, ltv: 3600, motivo: 'Resultado inexistente', nps: null },
  { id: 'ch-10', nome: 'Dra. Heloisa Queiroz Medeiros', nicho: 'Pneumologista', squad: 'Delta', accountManager: 'Alexandre Fernandes', ticketMensal: 1500, dataChurn: '2026-08-07', tempoCasaMeses: 8, ltv: 9000, motivo: 'Outro', nps: null },
  { id: 'ch-11', nome: 'Dr. Gabriel Ribeiro', nicho: 'Cirurgia de Ombro', squad: 'BlackOps', accountManager: 'Lucas Portilho', ticketMensal: 3200, dataChurn: '2026-08-06', tempoCasaMeses: 8, ltv: 25600, motivo: 'Resultado inexistente', nps: 4 },
  { id: 'ch-12', nome: 'Dra. Thayna Grossoni', nicho: 'Nutrologia/Emagrecimento', squad: null, accountManager: null, ticketMensal: 3000, dataChurn: '2026-08-05', tempoCasaMeses: 7, ltv: 21000, motivo: 'Resultado inexistente', nps: 10 },
  { id: 'ch-13', nome: 'Dr. Rennan Gabriel Botelho', nicho: 'Nefrologista', squad: 'Delta', accountManager: 'Alexandre Fernandes', ticketMensal: 1400, dataChurn: '2026-08-03', tempoCasaMeses: 8, ltv: 8400, motivo: 'Resultado inexistente', nps: 8 },
  { id: 'ch-14', nome: 'Restaurante Laurent', nicho: 'Restaurante', squad: 'BlackOps', accountManager: 'Lucas Portilho', ticketMensal: 1500, dataChurn: '2026-07-28', tempoCasaMeses: 3, ltv: 4500, motivo: 'Dificuldades financeiras', nps: 10 },
  { id: 'ch-15', nome: 'Dr. Silvio Brandão', nicho: 'Cirurgião Plástico', squad: 'MovSeals', accountManager: 'Jorge Luiz', ticketMensal: 1000, dataChurn: '2026-07-24', tempoCasaMeses: 23, ltv: 23000, motivo: 'Outro', nps: null },
  { id: 'ch-16', nome: 'Dra. Isadora Campos', nicho: 'Cirurgiã De Coluna', squad: 'BlackOps', accountManager: 'Lucas Portilho', ticketMensal: 5000, dataChurn: '2026-07-21', tempoCasaMeses: null, ltv: null, motivo: 'Problemas de atendimento', nps: null },
  { id: 'ch-17', nome: 'Dr. Lucas Mariano', nicho: 'Generalista', squad: 'Delta', accountManager: 'Alexandre Fernandes', ticketMensal: 1542, dataChurn: '2026-07-16', tempoCasaMeses: 3, ltv: 4826, motivo: 'Resultado inexistente', nps: 8 },
]
