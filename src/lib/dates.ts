// =========================================================
// Helpers de data — anti-timezone-bug
// =========================================================
// Problema clássico: `new Date('2026-05-15')` é parseado como
// UTC midnight. No fuso de Brasília (-03) isso vira
// `2026-05-14 21:00`, então toLocaleDateString mostra o dia
// anterior. Forçando meio-dia local (`T12:00:00`) o Date cai
// no dia certo independente do fuso.
// =========================================================

/**
 * Parsea uma string ISO de data (YYYY-MM-DD) ancorando ao
 * meio-dia local — evita o off-by-one causado pelo fuso.
 * Se a string já tiver hora (`T...`), deixa o Date lidar normal.
 */
export function parseLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  if (iso.includes('T')) return new Date(iso)
  return new Date(iso + 'T12:00:00')
}

/**
 * Formata uma string ISO de data em pt-BR sem sofrer off-by-one.
 * Retorna '—' se o input for null/undefined/vazio.
 */
export function formatDateBR(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' },
): string {
  const d = parseLocalDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR', opts)
}

/**
 * Compara uma data ISO (YYYY-MM-DD) com "hoje" sem ruído de fuso.
 * Retorna true se a data já passou (estritamente antes de hoje).
 */
export function isDateOverdue(iso: string | null | undefined): boolean {
  const d = parseLocalDate(iso)
  if (!d) return false
  const hoje = new Date()
  // zera as horas dos dois lados pra comparar só o dia
  hoje.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d.getTime() < hoje.getTime()
}

/** Data (YYYY-MM-DD ou ISO com hora) → dia local à meia-noite. */
function diaLocal(v: Date | string): Date {
  const d = typeof v === 'string' ? (v.length <= 10 ? parseLocalDate(v)! : new Date(v)) : new Date(v)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Prazo de SLA em dias úteis: soma `slaDiasUteis` dias de seg–sex a partir
 * do dia de início (o próprio dia não conta; sábado/domingo são pulados).
 * Ex.: aprovado na segunda + 3 dias úteis → quinta; na sexta + 3 → quarta.
 * Mesma regra do add_business_days do banco. Feriados não são considerados.
 */
export function calculateSLADeadline(aprovadoEm: Date | string, slaDiasUteis: number): Date {
  const d = diaLocal(aprovadoEm)
  let faltam = Math.max(0, Math.round(slaDiasUteis))
  while (faltam > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) faltam--
  }
  return d
}

/** Dias úteis (seg–sex) decorridos de `inicio` até `fim` (o dia de início não conta). */
export function diasUteisEntre(inicio: Date | string, fim: Date | string = new Date()): number {
  const d = diaLocal(inicio)
  const alvo = diaLocal(fim)
  let n = 0
  while (d < alvo) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) n++
  }
  return n
}

/** Dias corridos de atraso de um prazo (0 se ainda não venceu). */
export function diasDeAtraso(prazo: Date | string, hoje: Date = new Date()): number {
  const diff = Math.round((diaLocal(hoje).getTime() - diaLocal(prazo).getTime()) / 86_400_000)
  return Math.max(0, diff)
}
