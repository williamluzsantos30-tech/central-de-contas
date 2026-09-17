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
  flags: Flag[]
}

// ---- helpers de data (relativas a hoje) ----
function diasAtras(n: number, h = 11, m = 30): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
export function maisDias(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

let seq = 0
function flag(
  tipo: TipoFlag,
  categoria: string,
  motivo: string,
  criadaEm: string,
  status: StatusFlag,
  descricao?: string,
): Flag {
  return {
    id: `flag-${++seq}`,
    tipo,
    categoria,
    motivo,
    descricao,
    criadaEm,
    expiraEm: tipo === 'amarela' ? maisDias(criadaEm, AMARELA_VALIDADE_DIAS) : null,
    status,
  }
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
  const critico = amarelasAtivas >= LIMITE_CRITICO_AMARELAS || vermelhaAtiva
  const limite30 = new Date(hoje.getTime() - 30 * 86_400_000)
  const flags30d = c.flags.filter((f) => new Date(f.criadaEm) >= limite30).length
  return {
    amarelasAtivas,
    vermelhaAtiva,
    ultimaFlag,
    statusRisco: critico ? 'critico' : 'normal',
    elegivelDesligamento: vermelhaAtiva,
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

// ---- dados iniciais ----
export const COLABORADORES_INICIAIS: Colaborador[] = [
  {
    id: 'c-agnaldo',
    nome: 'Agnaldo Junior',
    cargo: 'Experiência do Cliente',
    squad: 'BlackSkull',
    // 2 amarelas antigas, ambas revertidas → 0 ativas (Normal)
    flags: [
      flag('amarela', 'Operacional', 'Não seguiu POP', diasAtras(120, 11, 37), 'revertida', 'Otimizações dentro da campanha da Dra. Francileia não estavam seguindo o padrão'),
      flag('amarela', 'Operacional', 'Não seguiu POP', diasAtras(140, 17, 5), 'revertida', 'Não envio relatório no grupo do cliente.'),
    ],
  },
  { id: 'c-alexandre', nome: 'Alexandre Fernandes', cargo: 'Account Manager', squad: 'Delta', flags: [] },
  { id: 'c-arlen', nome: 'Arlen Soares', cargo: 'Designer', squad: null, flags: [] },
  { id: 'c-beatriz', nome: 'Beatriz Barros', cargo: 'Social Media', squad: null, flags: [] },
  { id: 'c-bruno', nome: 'Bruno Gomes', cargo: 'Head de Conteúdo', squad: null, flags: [] },
  { id: 'c-diego', nome: 'Diego Assis', cargo: 'Diretor', squad: null, flags: [] },
  { id: 'c-glenda', nome: 'Glenda Lima', cargo: 'Social Media', squad: null, flags: [] },
  { id: 'c-igorm', nome: 'Igor Mandau', cargo: 'SDR', squad: null, flags: [] },
  { id: 'c-igorr', nome: 'Igor Reis', cargo: 'Designer', squad: null, flags: [] },
  { id: 'c-joaopedro', nome: 'João Pedro Menezes', cargo: 'Editor de Vídeo', squad: null, flags: [] },
  { id: 'c-joaopinto', nome: 'João Pinto', cargo: 'Diretor', squad: null, flags: [] },
  {
    id: 'c-jorge',
    nome: 'Jorge Luiz',
    cargo: 'Account Manager',
    squad: 'MovSeals',
    // 3 amarelas ativas (recentes) → Crítico
    flags: [
      flag('amarela', 'Operacional', 'Não seguiu POP', diasAtras(5, 9, 12), 'ativa', 'Não seguiu o checklist de rotina do AM.'),
      flag('amarela', 'Performance', 'Queda de performance', diasAtras(22, 14, 40), 'ativa', 'Queda relevante de leads em duas contas.'),
      flag('amarela', 'Operacional', 'Falha de registro no CRM', diasAtras(45, 10, 3), 'ativa', 'Contatos não registrados no CRM no período.'),
    ],
  },
]
