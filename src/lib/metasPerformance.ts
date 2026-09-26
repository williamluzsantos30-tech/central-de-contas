/**
 * Faixas de cor do score da Performance da Equipe (Configurações › Geral ›
 * "Metas de Performance"): verde ≥ `verde`, laranja ≥ `laranja`, vermelho abaixo.
 *
 * Guardado no navegador (como os demais parâmetros de Configurações › Geral,
 * que ainda não têm tabela no banco). Evento avisa a tela aberta ao mudar.
 */
export interface FaixasPerformance {
  verde: number
  laranja: number
}

export const FAIXAS_PERFORMANCE_PADRAO: FaixasPerformance = { verde: 70, laranja: 40 }
export const EVENTO_FAIXAS_PERFORMANCE = 'faixas-performance'
const CHAVE = 'domus-faixas-performance'

export function lerFaixasPerformance(): FaixasPerformance {
  try {
    const raw = window.localStorage.getItem(CHAVE)
    const v = raw ? (JSON.parse(raw) as Partial<FaixasPerformance>) : {}
    return normalizar({ ...FAIXAS_PERFORMANCE_PADRAO, ...v })
  } catch {
    return FAIXAS_PERFORMANCE_PADRAO
  }
}

export function salvarFaixasPerformance(f: FaixasPerformance): FaixasPerformance {
  const n = normalizar(f)
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(n))
  } catch {
    /* indisponível */
  }
  window.dispatchEvent(new Event(EVENTO_FAIXAS_PERFORMANCE))
  return n
}

/**
 * Só limita a 0–100. Não amarra um no outro: ao digitar o verde dígito a
 * dígito ("7" → "75") o laranja seria rebaixado de vez. Laranja ≥ verde
 * apenas elimina a faixa laranja (nivelDoScore testa o verde primeiro).
 */
function normalizar(f: FaixasPerformance): FaixasPerformance {
  const lim = (v: number) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)))
  return { verde: lim(f.verde), laranja: lim(f.laranja) }
}

export type NivelScore = 'bom' | 'medio' | 'ruim'

export function nivelDoScore(pct: number, f: FaixasPerformance): NivelScore {
  if (pct >= f.verde) return 'bom'
  if (pct >= f.laranja) return 'medio'
  return 'ruim'
}
