/**
 * Tons semânticos do design system domus.agn.
 * A cor SEMPRE carrega significado — verde=bom, vermelho=ruim,
 * laranja/amarelo=atenção, azul=info/link, violet=marca/ação, roxo=neutro
 * secundário em gráficos.
 */
export type Tone =
  | 'neutral'
  | 'success'
  | 'danger'
  | 'warning'
  | 'attention'
  | 'info'
  | 'accent'
  | 'purple'

/** Classes de badge/pill: fundo translúcido + borda + texto saturado. */
export const badgeTone: Record<Tone, string> = {
  neutral: 'border-zinc-600/50 bg-zinc-500/10 text-zinc-300',
  success: 'border-green-500/40 bg-green-500/10 text-green-300',
  danger: 'border-red-500/40 bg-red-500/10 text-red-300',
  warning: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  attention: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  accent: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
  purple: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
}

/** Cor de texto sólida (ex.: valor grande de KPI). */
export const textTone: Record<Tone, string> = {
  neutral: 'text-zinc-100',
  success: 'text-green-400',
  danger: 'text-red-400',
  warning: 'text-orange-400',
  attention: 'text-yellow-400',
  info: 'text-blue-400',
  accent: 'text-brand-400',
  purple: 'text-purple-400',
}

/** Cor de barra/preenchimento (ex.: séries de gráfico). Hex do DS §1. */
export const hexTone: Record<Tone, string> = {
  neutral: '#9ca3af',
  success: '#22c55e',
  danger: '#dc2626',
  warning: '#f97316',
  attention: '#eab308',
  info: '#3b82f6',
  accent: '#7c3aed',
  purple: '#a855f7',
}
