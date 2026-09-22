/**
 * Estrutura da sidebar em níveis (config declarativa).
 *
 *   Operacional (pasta)
 *     Gestão (sub-pasta)      → Visão Executiva, Clientes (completa), Onboarding,
 *                                Churns, Renovações, Central Operacional, Flags
 *     Execução (sub-pasta)    → Social Media e Tráfego (a MESMA lista de Clientes,
 *                                filtrada por responsável) + itens de Webdesign
 *   Sistema (rodapé, fora de Operacional) → Configurações, Admin
 *
 * "Social Media"/"Tráfego" em Execução apontam pra /social/clientes e
 * /trafego/clientes, que renderizam o MESMO componente Clientes com um filtro
 * (social_media_id / gestor_id). Não há lista de dados própria.
 */
import {
  TrendingUp,
  Users,
  UserPlus,
  UserMinus,
  FileClock,
  BookOpen,
  Flag,
  Smartphone,
  Megaphone,
  LayoutGrid,
  Sparkles,
  Film,
  Share2,
  ClipboardList,
  Rocket,
  Settings2,
  ShieldCheck,
  Briefcase,
  Radio,
  Inbox,
  Target,
  Headphones,
  BarChart3,
  Goal,
  Wallet,
  Receipt,
  FileBarChart,
  Waves,
  Layers,
  Scale,
  HandCoins,
} from 'lucide-react'
import { PERM } from '@/hooks/usePermissoes'
import type { Cargo, Modulo } from '@/lib/cargos'

type IconCmp = React.ComponentType<{ size?: number; className?: string }>

export type NavItem = {
  kind: 'item'
  to: string
  label: string
  icon: IconCmp
  end?: boolean
  adminOnly?: boolean
  /** Permissão de papel exigida (usePermissoes). */
  perm?: string
  /** Acesso operacional exigido (papel-first / cargoPermissoes). */
  modulo?: Modulo
  /** Só aparece pra quem tem QUALQUER um desses cargos. */
  cargosPermitidos?: Cargo[]
}

export type NavFolder = {
  kind: 'folder'
  key: string
  label: string
  icon?: IconCmp
  defaultOpen?: boolean
  children: NavNode[]
}

export type NavNode = NavItem | NavFolder

/** Árvore principal (dentro do corpo rolável da sidebar). */
export const SIDEBAR_NAV: NavNode[] = [
  {
    kind: 'folder',
    key: 'operacional',
    label: 'Operacional',
    icon: TrendingUp,
    defaultOpen: true,
    children: [
      {
        kind: 'folder',
        key: 'gestao',
        label: 'Gestão',
        icon: ClipboardList,
        defaultOpen: true,
        children: [
          { kind: 'item', to: '/operacional/visao', label: 'Visão Executiva', icon: TrendingUp },
          { kind: 'item', to: '/clientes', label: 'Clientes', icon: Users, perm: PERM.visualizar },
          { kind: 'item', to: '/clientes/onboarding', label: 'Onboarding', icon: UserPlus },
          { kind: 'item', to: '/clientes/churns', label: 'Churns', icon: UserMinus },
          { kind: 'item', to: '/clientes/renovacoes', label: 'Renovações', icon: FileClock },
          { kind: 'item', to: '/central-operacional', label: 'Central Operacional', icon: BookOpen },
          { kind: 'item', to: '/flags', label: 'Flags (Performance)', icon: Flag },
        ],
      },
      {
        kind: 'folder',
        key: 'execucao',
        label: 'Execução',
        icon: Rocket,
        defaultOpen: true,
        children: [
          // Mesma lista de Clientes, filtrada por responsável vinculado.
          { kind: 'item', to: '/social/clientes', label: 'Social Media', icon: Smartphone, modulo: 'social_media', perm: PERM.visualizar },
          { kind: 'item', to: '/trafego/clientes', label: 'Tráfego', icon: Megaphone, modulo: 'trafego', perm: PERM.visualizar },
          { kind: 'item', to: '/webdesign/projetos', label: 'Landing Page', icon: LayoutGrid, modulo: 'webdesign' },
          { kind: 'item', to: '/webdesign/criativos', label: 'Criativos', icon: Sparkles, modulo: 'webdesign' },
          { kind: 'item', to: '/webdesign/edicao-video', label: 'Edição de Vídeo', icon: Film, modulo: 'webdesign' },
          { kind: 'item', to: '/webdesign/social-media', label: 'Produção Social Media', icon: Share2, modulo: 'webdesign' },
        ],
      },
    ],
  },
  {
    kind: 'folder',
    key: 'comercial',
    label: 'Comercial',
    icon: Briefcase,
    defaultOpen: true,
    children: [
      // Visão Executiva no topo (mesmo papel da de Gestão), depois o funil.
      { kind: 'item', to: '/comercial/visao', label: 'Visão Executiva', icon: TrendingUp },
      { kind: 'item', to: '/comercial/social-selling', label: 'Social Selling', icon: Radio },
      { kind: 'item', to: '/comercial/caixa-entrada', label: 'Caixa de Entrada', icon: Inbox },
      { kind: 'item', to: '/comercial/sdr', label: 'SDR', icon: Target },
      { kind: 'item', to: '/comercial/closer', label: 'Closer', icon: Headphones },
      { kind: 'item', to: '/comercial/marketing', label: 'Marketing', icon: BarChart3 },
      { kind: 'item', to: '/comercial/metas', label: 'Metas', icon: Goal },
    ],
  },
  {
    kind: 'folder',
    key: 'financeiro',
    label: 'Financeiro',
    icon: Wallet,
    defaultOpen: true,
    children: [
      { kind: 'item', to: '/financeiro/despesas', label: 'Despesas', icon: Receipt },
      { kind: 'item', to: '/financeiro/dre', label: 'DRE', icon: FileBarChart },
      { kind: 'item', to: '/financeiro/dre-setor', label: 'DRE por Setor', icon: Layers },
      { kind: 'item', to: '/financeiro/ltv-cac', label: 'LTV:CAC', icon: Scale },
      { kind: 'item', to: '/financeiro/comissionamento', label: 'Comissionamento', icon: HandCoins },
      { kind: 'item', to: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa', icon: Waves },
    ],
  },
]

/** Seção Sistema — fixa no rodapé, fora da pasta Operacional. */
export const SIDEBAR_SISTEMA: NavNode[] = [
  {
    kind: 'folder',
    key: 'sistema',
    label: 'Sistema',
    icon: Settings2,
    defaultOpen: true,
    children: [
      { kind: 'item', to: '/configuracoes', label: 'Configurações', icon: Settings2 },
      { kind: 'item', to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
    ],
  },
]
