/**
 * Trilha (breadcrumb) da rota atual, derivada da MESMA árvore do menu
 * (sidebarConfig) — nenhuma página precisa montar a própria trilha.
 *
 * Regra: item do menu com rota exata → pastas + item. Rota mais funda (ficha,
 * detalhe) → item vira link + rótulo do detalhe. Rotas fora do menu ficam em
 * EXTRAS.
 */
import { SIDEBAR_NAV, SIDEBAR_SISTEMA, type NavItem, type NavNode } from './sidebarConfig'

export interface Crumb {
  label: string
  /** Sem `to` = texto (pasta ou página atual). */
  to?: string
}

export interface EntradaNav {
  item: NavItem
  /** Rótulos das pastas até o item (ex.: ['Operacional', 'Gestão']). */
  pastas: string[]
}

function achatar(nodes: NavNode[], pastas: string[] = [], out: EntradaNav[] = []): EntradaNav[] {
  for (const n of nodes) {
    if (n.kind === 'item') out.push({ item: n, pastas })
    else achatar(n.children, [...pastas, n.label], out)
  }
  return out
}

/** Todos os itens do menu, com as pastas de cada um. */
export const ENTRADAS_NAV: EntradaNav[] = achatar([...SIDEBAR_NAV, ...SIDEBAR_SISTEMA])

/** Páginas que existem mas não estão no menu. */
const EXTRAS: { to: string; label: string; pastas: string[] }[] = [
  { to: '/minhas-tarefas', label: 'Minhas Tarefas', pastas: [] },
  { to: '/social', label: 'Agenda Social Media', pastas: ['Operacional', 'Execução'] },
  { to: '/social/agenda', label: 'Agenda Social Media', pastas: ['Operacional', 'Execução'] },
  { to: '/social/head', label: 'Head Social', pastas: ['Operacional', 'Execução'] },
  { to: '/social/calendario', label: 'Calendário de Postagens', pastas: ['Operacional', 'Execução'] },
]

/** Rótulos das sub-rotas (o que vem depois da rota do item do menu). */
function detalhes(base: string, resto: string[]): Crumb[] {
  if (base === '/central-operacional') {
    // /central-operacional/:setor[/:doc]
    return resto.length === 1
      ? [{ label: 'Setor' }]
      : [{ label: 'Setor', to: `${base}/${resto[0]}` }, { label: 'Documento' }]
  }
  if (base === '/comercial/sdr' && resto[0] === 'qualificar') return [{ label: 'Qualificar lead' }]
  if (base === '/flags') return [{ label: 'Colaborador' }]
  if (base === '/clientes' || base === '/social/clientes' || base === '/trafego/clientes') return [{ label: 'Ficha do cliente' }]
  return [{ label: 'Detalhe' }]
}

const segmentos = (p: string) => p.split('/').filter(Boolean)

/**
 * Rota do item do menu que deve ficar ATIVO: o de rota exata ou o de maior
 * prefixo. (O `NavLink` sozinho acenderia "Clientes" junto com "Renovações",
 * porque /clientes é prefixo de /clientes/renovacoes.)
 */
export function itemAtivoDaRota(pathname: string): string | undefined {
  const path = pathname.replace(/\/+$/, '') || '/'
  return ENTRADAS_NAV.filter((e) => path === e.item.to || path.startsWith(`${e.item.to}/`)).sort(
    (a, b) => b.item.to.length - a.item.to.length,
  )[0]?.item.to
}

export function trilhaDaRota(pathname: string): Crumb[] {
  const path = pathname.replace(/\/+$/, '') || '/'

  const exato = ENTRADAS_NAV.find((e) => e.item.to === path)
  if (exato) return [...exato.pastas.map((label) => ({ label })), { label: exato.item.label }]

  const extra = EXTRAS.find((e) => e.to === path)
  if (extra) return [...extra.pastas.map((label) => ({ label })), { label: extra.label }]

  // Rota mais funda: item do menu cuja rota é o maior prefixo (por segmento).
  const pai = [...ENTRADAS_NAV]
    .filter((e) => path.startsWith(`${e.item.to}/`))
    .sort((a, b) => b.item.to.length - a.item.to.length)[0]
  if (pai) {
    const resto = segmentos(path.slice(pai.item.to.length))
    return [
      ...pai.pastas.map((label) => ({ label })),
      { label: pai.item.label, to: pai.item.to },
      ...detalhes(pai.item.to, resto),
    ]
  }
  return []
}
