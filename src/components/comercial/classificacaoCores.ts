/** Cores fixas da classificação A/B/C (Funil Tráfego) — mesmas em todos os blocos. */
import type { ClassificacaoLead } from '@/pages/comercial/mockLeads'

export const COR_CLASSE: Record<ClassificacaoLead, string> = {
  A: '#22c55e',
  B: '#eab308',
  C: '#ef4444',
}
export const COR_SEM_CLASSE = '#52525b'

export const TEXTO_CLASSE: Record<ClassificacaoLead, string> = {
  A: 'text-green-300',
  B: 'text-yellow-300',
  C: 'text-red-300',
}
