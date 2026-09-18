/**
 * Gestão de Flags — modelo + mock estruturado como Colaborador → Flags[].
 *
 * Os contadores da lista e os KPIs agregados são DERIVADOS da lista real de
 * flags (ver `derivar`), nunca números soltos. Regras de negócio:
 *  - Flag amarela expira 60 dias após o registro (deixa de contar como ativa).
 *  - 3 amarelas ativas simultâneas → status de risco "Crítico".
 *  - Flag vermelha nunca expira e deixa o colaborador "Elegível a Desligamento".
 *
 * Datas do mock são relativas a hoje pra a demo ficar sempre coerente.
 */

export type TipoFlag = 'amarela' | 'vermelha'
export type StatusFlag = 'ativa' | 'revertida'

export const AMARELA_VALIDADE_DIAS = 60
export const LIMITE_CRITICO_AMARELAS = 3

export const CATEGORIAS_FLAG = [
  'Operacional',
  'Performance',
  'Comportamental',
  'Ética/Confiança',
  'Cliente/Financeiro',
] as const

export const MOTIVOS_FLAG = [
  'Não seguiu POP',
  'Atraso crítico',
  'Falha de registro no CRM',
  'Queda de performance',
  'Postura passiva / sem proatividade',
  'Conduta inadequada',
  'Quebra de confiança',
  'Risco ao cliente',
  'Outro',
] as const

export interface Flag {
  id: string
  tipo: TipoFlag
  categoria: string
  motivo: string
  descricao?: string
  criadaEm: string // ISO datetime
  expiraEm: string | null // amarela: criada + 60d; vermelha: null
  status: StatusFlag
}

export interface Colaborador {
  id: string
  nome: string
  cargo: string
  squad: string | null
  /** Espelha o status do Membro da Equipe (fonte central). Só ativos listam. */
  ativo: boolean
  flags: Flag[]
}

// ---- helpers de data ----
export function maisDias(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

// ---- derivação (fonte única dos contadores) ----
export function isAmarelaAtiva(f: Flag, hoje = new Date()): boolean {
  if (f.tipo !== 'amarela' || f.status !== 'ativa') return false
  if (f.expiraEm && new Date(f.expiraEm).getTime() < hoje.getTime()) return false
  return true
}

export interface ColaboradorDerivado {
  amarelasAtivas: number
  vermelhaAtiva: boolean
  ultimaFlag: string | null
  statusRisco: 'normal' | 'critico'
  elegivelDesligamento: boolean
  totalHistorico: number
  flags30d: number
}

export function derivar(c: Colaborador, hoje = new Date()): ColaboradorDerivado {
  const amarelasAtivas = c.flags.filter((f) => isAmarelaAtiva(f, hoje)).length
  const vermelhaAtiva = c.flags.some((f) => f.tipo === 'vermelha' && f.status === 'ativa')
  const datas = c.flags.map((f) => f.criadaEm).sort()
  const ultimaFlag = datas.length ? datas[datas.length - 1] : null
  // Elegível a desligamento: bateu o limite de amarelas ativas OU tem
  // vermelha ativa. "Crítico" acompanha a elegibilidade.
  const elegivelDesligamento = amarelasAtivas >= LIMITE_CRITICO_AMARELAS || vermelhaAtiva
  const limite30 = new Date(hoje.getTime() - 30 * 86_400_000)
  const flags30d = c.flags.filter((f) => new Date(f.criadaEm) >= limite30).length
  return {
    amarelasAtivas,
    vermelhaAtiva,
    ultimaFlag,
    statusRisco: elegivelDesligamento ? 'critico' : 'normal',
    elegivelDesligamento,
    totalHistorico: c.flags.length,
    flags30d,
  }
}

export interface FlagsKpis {
  colaboradoresComFlags: number
  amarelasAtivas: number
  vermelhasAtivas: number
  elegiveisDesligamento: number
}

export function derivarKpis(cs: Colaborador[], hoje = new Date()): FlagsKpis {
  let colaboradoresComFlags = 0
  let amarelasAtivas = 0
  let vermelhasAtivas = 0
  let elegiveisDesligamento = 0
  for (const c of cs) {
    const d = derivar(c, hoje)
    if (d.amarelasAtivas > 0 || d.vermelhaAtiva) colaboradoresComFlags++
    amarelasAtivas += d.amarelasAtivas
    if (d.vermelhaAtiva) vermelhasAtivas++
    if (d.elegivelDesligamento) elegiveisDesligamento++
  }
  return { colaboradoresComFlags, amarelasAtivas, vermelhasAtivas, elegiveisDesligamento }
}

