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
