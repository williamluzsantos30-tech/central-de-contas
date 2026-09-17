/**
 * Central Operacional — dados (mock) estruturados como Setor → Documentos[].
 *
 * A contagem de docs do card NÃO é um número solto: é derivada de
 * `setor.documentos.length`. Criar um documento (modal "Novo Documento")
 * empurra pra lista do setor e a contagem sobe sozinha. Trocar por API
 * depois não muda a UI — a página consome só esta estrutura via store.
 */

export type StatusDoc = 'oficial' | 'em_revisao'

export const STATUS_LABEL: Record<StatusDoc, { label: string; cls: string }> = {
  oficial: { label: 'Oficial', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  em_revisao: { label: 'Em revisão', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
}

/** Categorias de documento (ordem = ordem de exibição no detalhe do setor). */
export const CATEGORIAS = [
  'Playbooks',
  'POPs',
  'Rituais & Reuniões',
  'Templates',
  'Job Descriptions',
] as const
export type Categoria = (typeof CATEGORIAS)[number]

/** Cargos disponíveis (checkboxes do modal + pills de filtro). */
export const CARGOS = [
  'Account Manager',
  'Comercial',
  'Concierge',
  'Consultoria',
  'Coordenador de Qualidade',
  'Coordenador Geral',
  'CS',
  'Designer',
  'Diretor',
  'Editor de Vídeo',
  'Experiência do Cliente',
  'Gerente Operacional',
  'Gestor de Tráfego',
  'Head de Conteúdo',
  'Head de Tráfego',
  'SDR',
  'Setor Financeiro',
  'Social Media',
  'Social Seller',
] as const

export interface Documento {
  id: string
  titulo: string
  categoria: Categoria
  status: StatusDoc
  cargos: string[]
  conteudo?: string
  data: string // ISO 'YYYY-MM-DD'
  temPdf?: boolean
}

/** Cor/tema visual de cada setor (decorativo, variado por setor). */
export type SetorCor = 'violet' | 'emerald' | 'amber' | 'pink' | 'indigo' | 'cyan' | 'fuchsia'

export interface Setor {
  id: string
  nome: string
  descricao: string
  icon: string // nome do ícone lucide (resolvido na UI)
  cor: SetorCor
  cargos: string[]
  documentos: Documento[]
}

let seq = 0
function doc(
  titulo: string,
  categoria: Categoria,
  status: StatusDoc,
  cargos: string[],
  data: string,
  conteudo?: string,
): Documento {
  return { id: `doc-${++seq}`, titulo, categoria, status, cargos, data, conteudo }
}

const CONTEUDO_CONTAS_CRITICAS = `## Objetivo
Garantir que contas em situação crítica recebam intervenção rápida, estruturada e eficaz, minimizando o risco de churn e recuperando a performance.

---

## 1. Critérios para Classificar uma Conta como Crítica
Uma conta deve ser classificada como crítica quando apresentar pelo menos um dos seguintes indicadores:

| Indicador | Critério |
|-----------|----------|
| NPS | Score < 7 na última pesquisa |
| Queda de Leads | Redução > 20% em relação ao mês anterior |
| Reclamação Formal | Cliente registrou insatisfação por e-mail, reunião ou canal oficial |
| Investimento Parado | Cliente pausou campanhas ou reduziu budget > 30% |
| Risco de Churn | Sinalização do Account Manager sobre intenção de cancelamento |

> ⚠️ **Regra:** Toda conta classificada como crítica deve ter um plano de recuperação registrado em até 48 horas.

---

## 2. Protocolo de Intervenção

### Etapa 1 — Diagnóstico (até 24h)
1. Revisar métricas dos últimos 30 dias (CPL, leads, investimento, CTR, CPC)
2. Analisar criativos ativos e histórico de alterações
3. Verificar landing page (velocidade, formulário, copy)
4. Consultar Account Manager sobre contexto do cliente
5. Identificar causa raiz (não apenas sintomas)

### Etapa 2 — Plano de Ação (até 48h)
1. Elaborar plano de recuperação usando o template abaixo
2. Alinhar com o Gestor de Tráfego responsável
3. Apresentar ao Account Manager para validação
4. Comunicar ao cliente (quando necessário)

### Etapa 3 — Acompanhamento (semanal)
1. Follow-up semanal obrigatório até a conta sair do status crítico
2. Registrar evolução das métricas no sistema
3. Ajustar plano conforme resultados parciais`

export const SETORES_INICIAIS: Setor[] = [
  {
    id: 'trafego',
    nome: 'Setor de Tráfego',
    descricao: 'Gestão de mídia, performance e atendimento estratégico de clientes',
    icon: 'Megaphone',
    cor: 'violet',
    cargos: ['Account Manager', 'Gerente Operacional', 'Gestor de Tráfego', 'Head de Tráfego'],
    documentos: [
      doc('Playbook — Gestão de Contas Críticas', 'Playbooks', 'oficial', ['Head de Tráfego'], '2026-02-25', CONTEUDO_CONTAS_CRITICAS),
      doc('Playbook — Auditoria Proativa de Contas', 'Playbooks', 'oficial', ['Head de Tráfego'], '2026-02-25'),
      doc('Playbook Oficial de Cultura', 'Playbooks', 'em_revisao', ['Account Manager', 'Designer', 'Social Media', 'Gestor de Tráfego', 'Coordenador Geral'], '2026-02-03'),
      doc('Playbook Operacional — Gestor de Tráfego', 'Playbooks', 'em_revisao', ['Social Media', 'Gestor de Tráfego'], '2026-01-28'),
      doc('Playbook Operacional — Account Manager (AM)', 'Playbooks', 'em_revisao', ['Account Manager'], '2026-01-28'),
      doc('Roteiro Oficial — Call de Alinhamento de Expectativa (Onboarding)', 'POPs', 'oficial', ['CS', 'Account Manager', 'Gestor de Tráfego', 'Head de Tráfego'], '2026-07-01'),
      doc('POP — MSC Academy', 'POPs', 'oficial', ['Account Manager', 'Coordenador Geral', 'Diretor'], '2026-05-30'),
      doc('POP — Check-in Diário com Gestores de Tráfego', 'POPs', 'oficial', ['Head de Tráfego'], '2026-02-25'),
      doc('POP — Relatório Diário de Contas em Risco', 'POPs', 'oficial', ['Head de Tráfego'], '2026-02-25'),
      doc('POP — Cliente Onboarding', 'POPs', 'em_revisao', ['Account Manager'], '2026-01-28'),
      doc('POP — Produção de Conteúdos', 'POPs', 'em_revisao', ['Social Media', 'Designer', 'Account Manager'], '2026-01-28'),
      doc('Reunião Semanal de Estratégia de Tráfego', 'Rituais & Reuniões', 'oficial', ['Head de Tráfego'], '2026-02-25'),
      doc('Apresentação de Onboarding - AVF', 'Rituais & Reuniões', 'oficial', ['Concierge', 'Account Manager'], '2026-02-11'),
      doc('Rotina do Account Manager', 'Rituais & Reuniões', 'em_revisao', ['Account Manager'], '2026-01-28'),
      doc('Template — Relatório Semanal de Performance', 'Templates', 'oficial', ['Account Manager'], '2026-02-25'),
    ],
  },
  {
    id: 'financeiro',
    nome: 'Setor Financeiro',
    descricao: 'Cobranças, lembretes de vencimento e processos financeiros',
    icon: 'Wallet',
    cor: 'emerald',
    cargos: ['Setor Financeiro'],
    documentos: [
      doc('Playbook — Régua de Cobrança', 'Playbooks', 'oficial', ['Setor Financeiro'], '2026-03-10'),
      doc('POP — Lembrete de Vencimento e Renovação', 'POPs', 'oficial', ['Setor Financeiro'], '2026-03-10'),
    ],
  },
  {
    id: 'comercial',
    nome: 'Setor Comercial',
    descricao: 'Vendas, prospecção e relacionamento comercial',
    icon: 'Briefcase',
    cor: 'amber',
    cargos: ['Comercial', 'SDR', 'Social Seller'],
    documentos: [
      doc('Playbook — Processo Comercial de Ponta a Ponta', 'Playbooks', 'oficial', ['Comercial'], '2026-02-18'),
      doc('Playbook — Prospecção Ativa (Outbound)', 'Playbooks', 'oficial', ['SDR'], '2026-02-18'),
      doc('Playbook — Social Selling', 'Playbooks', 'em_revisao', ['Social Seller'], '2026-01-28'),
      doc('POP — Qualificação de Leads (SDR)', 'POPs', 'oficial', ['SDR'], '2026-02-20'),
      doc('POP — Passagem de Bastão SDR → Closer', 'POPs', 'oficial', ['SDR', 'Comercial'], '2026-02-20'),
      doc('POP — Follow-up de Proposta', 'POPs', 'em_revisao', ['Comercial'], '2026-01-30'),
      doc('Ritual — Daily Comercial', 'Rituais & Reuniões', 'oficial', ['Comercial', 'SDR'], '2026-02-05'),
      doc('Template — Proposta Comercial', 'Templates', 'oficial', ['Comercial'], '2026-02-12'),
      doc('Template — Script de Cold Call', 'Templates', 'em_revisao', ['SDR'], '2026-01-28'),
    ],
  },
  {
    id: 'relacionamento',
    nome: 'Setor de Relacionamento com o Cliente',
    descricao: 'Atendimento, satisfação e fidelização de clientes',
    icon: 'HeartHandshake',
    cor: 'pink',
    cargos: ['Concierge', 'Coordenador de Qualidade', 'CS'],
    documentos: [
      doc('Playbook — Retenção e Fidelização', 'Playbooks', 'oficial', ['CS'], '2026-03-02'),
      doc('Playbook — Gestão de Churn', 'Playbooks', 'oficial', ['CS', 'Coordenador de Qualidade'], '2026-03-02'),
      doc('Playbook — Escalada de Insatisfação', 'Playbooks', 'em_revisao', ['CS', 'Concierge'], '2026-01-28'),
      doc('POP — Onboarding de Relacionamento', 'POPs', 'oficial', ['CS', 'Concierge'], '2026-02-14'),
      doc('POP — Pesquisa de NPS', 'POPs', 'oficial', ['Coordenador de Qualidade'], '2026-02-14'),
      doc('POP — Registro de Contato', 'POPs', 'oficial', ['CS'], '2026-02-14'),
      doc('POP — Resolução de Reclamações', 'POPs', 'em_revisao', ['Concierge', 'Coordenador de Qualidade'], '2026-01-28'),
      doc('POP — Reativação de Cliente', 'POPs', 'em_revisao', ['CS'], '2026-01-28'),
      doc('Ritual — Reunião de Carteira', 'Rituais & Reuniões', 'oficial', ['CS'], '2026-02-06'),
      doc('Ritual — Voz do Cliente (Semanal)', 'Rituais & Reuniões', 'oficial', ['Coordenador de Qualidade'], '2026-02-06'),
      doc('Ritual — Comitê de Retenção', 'Rituais & Reuniões', 'em_revisao', ['CS', 'Coordenador de Qualidade'], '2026-01-28'),
      doc('Template — E-mail de Boas-vindas', 'Templates', 'oficial', ['Concierge'], '2026-02-08'),
      doc('Template — Relatório de Saúde da Conta', 'Templates', 'oficial', ['CS'], '2026-02-08'),
      doc('Template — Pesquisa de Cancelamento', 'Templates', 'em_revisao', ['Coordenador de Qualidade'], '2026-01-28'),
    ],
  },
  {
    id: 'lideranca',
    nome: 'Setor de Liderança',
    descricao: 'Gestão estratégica, supervisão e direção operacional',
    icon: 'Crown',
    cor: 'indigo',
    cargos: ['Coordenador Geral', 'Diretor'],
    documentos: [
      doc('Playbook — Direção Operacional', 'Playbooks', 'oficial', ['Coordenador Geral', 'Diretor'], '2026-02-01'),
    ],
  },
  {
    id: 'criativo',
    nome: 'Setor Criativo',
    descricao: 'Produção de conteúdo, edição de vídeo e social media',
    icon: 'Palette',
    cor: 'cyan',
    cargos: ['Designer', 'Editor de Vídeo', 'Head de Conteúdo', 'Social Media'],
    documentos: [
      doc('Playbook — Linha Editorial e Identidade', 'Playbooks', 'oficial', ['Head de Conteúdo', 'Social Media'], '2026-02-22'),
      doc('POP — Fluxo de Produção de Conteúdo', 'POPs', 'oficial', ['Social Media', 'Designer'], '2026-02-22'),
      doc('POP — Edição e Entrega de Vídeo', 'POPs', 'em_revisao', ['Editor de Vídeo'], '2026-01-28'),
      doc('Template — Briefing de Criativo', 'Templates', 'oficial', ['Designer'], '2026-02-15'),
    ],
  },
  {
    id: 'consultoria',
    nome: 'Setor de Consultoria',
    descricao: 'Mentoria e implementação guiada para médicos (MRS 20→100)',
    icon: 'Lightbulb',
    cor: 'fuchsia',
    cargos: ['Consultoria'],
    documentos: [
      doc('Playbook — Implementação MRS 20→100', 'Playbooks', 'oficial', ['Consultoria'], '2026-02-19'),
    ],
  },
]
