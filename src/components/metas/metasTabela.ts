/**
 * Tabela unificada Meta × Realizado (aba Metas do Tráfego) — linhas, fórmulas
 * e "% atingido". Pura: usada pela tela (GoalsTable) e pelo PDF.
 *
 * Realizado de mídia (investimento, cliques, mensagens) vem SEMPRE do resumo
 * de tráfego (getClientTrafficSummary — mesma fonte das abas de plataforma):
 * não é editável nem tem campo manual; plataforma desconectada conta 0. O
 * funil depois do clique (qualificadas, consultas, procedimentos, ticket) é
 * registrado pelo time; os derivados são calculados.
 */
import type { MetasValores } from '@/types/database'
import type { MetricasPlataforma } from '@/lib/traffic/summary'

export type Formato = 'money' | 'int' | 'percent' | 'multiplier'
export type TipoCelula = 'input' | 'integracao' | 'calc' | 'vazio'

export interface Celula {
  tipo: TipoCelula
  valor: number | null
  /** Campo editável (tipo 'input'). */
  campo?: keyof MetasValores
  /** Realizado digitado pelo time (sem fonte automática) — sinalizado na tela. */
  manual?: boolean
}

export interface LinhaMeta {
  key: string
  label: string
  formula?: string
  formato: Formato
  /** Métrica de custo: menor é melhor (o % inverte). */
  custo?: boolean
  /** Sem cor no % (execução de verba, não "quanto mais melhor"). */
  neutro?: boolean
  destaque?: boolean
  meta: Celula
  real: Celula
  pct: number | null
}

export interface GrupoMeta {
  key: 'investimento' | 'mensagens' | 'consultas' | 'procedimentos' | 'resultado'
  label: string
  linhas: LinhaMeta[]
}

export const VALORES_VAZIOS: MetasValores = {
  investimento: null,
  custo_mensagem: null,
  mensagens_qualificadas: null,
  numero_consultas: null,
  tm_consulta: null,
  numero_procedimentos: null,
  tm_procedimento: null,
  cliques: null,
  mensagens: null,
}

const div = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b : null)
const mult = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? a * b : null)

/** Campos de mídia do Realizado — vêm do resumo de tráfego, nunca do banco/digitação. */
export const CAMPOS_MIDIA_REALIZADO: (keyof MetasValores)[] = ['investimento', 'cliques', 'mensagens', 'custo_mensagem']

/** Realizado com a mídia do resumo de tráfego (o que estiver gravado nesses campos é ignorado). */
export function realizadoComResumo(real: MetasValores, resumo: MetricasPlataforma): MetasValores {
  return { ...VALORES_VAZIOS, ...real, investimento: resumo.investimento, cliques: resumo.cliques, mensagens: resumo.leads, custo_mensagem: null }
}

/** Tira do Realizado os campos de mídia antes de salvar (não guardar cópia do que vem das plataformas). */
export function semMidiaRealizado(real: MetasValores): MetasValores {
  const r = { ...real }
  for (const k of CAMPOS_MIDIA_REALIZADO) delete r[k]
  return r
}

/** % atingido: realizado ÷ meta (custos: meta ÷ realizado — menor é melhor). */
export function pctAtingido(meta: number | null, real: number | null, custo?: boolean): number | null {
  if (meta == null || real == null || meta === 0) return null
  if (custo) return real > 0 ? (meta / real) * 100 : null
  return (real / meta) * 100
}

export type NivelPct = 'bom' | 'medio' | 'ruim'
/** Verde ≥ 100% · laranja 70–99% · vermelho < 70%. */
export function nivelPct(p: number): NivelPct {
  return p >= 100 ? 'bom' : p >= 70 ? 'medio' : 'ruim'
}

export function formatarValor(v: number | null, formato: Formato): string {
  if (v == null || Number.isNaN(v) || !Number.isFinite(v)) return '—'
  if (formato === 'money') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (formato === 'percent') return `${v.toFixed(1).replace('.', ',')}%`
  if (formato === 'multiplier') return `${v.toFixed(2).replace('.', ',')}x`
  return Math.round(v).toLocaleString('pt-BR')
}

/**
 * Monta os grupos de linhas. `resumo` = a plataforma no resumo de tráfego do
 * período (getClientTrafficSummary(...).porPlataforma[p]), calculado com os
 * fechamentos (consultas) deste Realizado.
 */
export function montarTabelaMetas(meta: MetasValores, real: MetasValores, resumo: MetricasPlataforma): GrupoMeta[] {
  const m = { ...VALORES_VAZIOS, ...meta }
  const r = realizadoComResumo(real, resumo)

  const inp = (v: number | null | undefined, campo: keyof MetasValores): Celula => ({ tipo: 'input', valor: v ?? null, campo })
  const calc = (v: number | null): Celula => ({ tipo: 'calc', valor: v })
  // Realizado sem fonte automática no sistema: digitado pelo time, sinalizado.
  const manual = (v: number | null | undefined, campo: keyof MetasValores): Celula => ({ tipo: 'input', valor: v ?? null, campo, manual: true })
  // Mídia: sempre do resumo, só leitura (desconectada = 0).
  const midiaCel = (v: number | null | undefined): Celula => ({ tipo: 'integracao', valor: v ?? null })

  // Meta
  const mMensagens = m.investimento && m.custo_mensagem ? Math.floor(m.investimento / m.custo_mensagem) : null
  const mFat = faturamento(m)
  // Realizado
  const rCustoMsg = div(r.investimento, r.mensagens)

  const linha = (l: Omit<LinhaMeta, 'pct'>): LinhaMeta => ({ ...l, pct: pctAtingido(l.meta.valor, l.real.valor, l.custo) })

  return [
    {
      key: 'investimento',
      label: 'Investimento',
      linhas: [
        linha({ key: 'investimento', label: 'Investimento', formato: 'money', neutro: true, meta: inp(m.investimento, 'investimento'), real: midiaCel(r.investimento) }),
        linha({ key: 'valor_diario', label: 'Valor diário', formula: 'investimento ÷ 30', formato: 'money', neutro: true, meta: calc(div(m.investimento, 30)), real: calc(div(r.investimento, 30)) }),
      ],
    },
    {
      key: 'mensagens',
      label: 'Funil de mensagens',
      linhas: [
        linha({ key: 'cliques', label: 'Cliques', formato: 'int', meta: { tipo: 'vazio', valor: null }, real: midiaCel(r.cliques) }),
        linha({ key: 'custo_mensagem', label: 'Custo por mensagem', formato: 'money', custo: true, meta: inp(m.custo_mensagem, 'custo_mensagem'), real: calc(rCustoMsg) }),
        linha({ key: 'mensagens', label: 'Mensagens', formula: 'investimento ÷ custo por mensagem', formato: 'int', meta: calc(mMensagens), real: midiaCel(r.mensagens) }),
        linha({ key: 'mensagens_qualificadas', label: 'Mensagens qualificadas', formato: 'int', meta: inp(m.mensagens_qualificadas, 'mensagens_qualificadas'), real: manual(r.mensagens_qualificadas, 'mensagens_qualificadas') }),
        linha({ key: 'custo_mensagem_qualificada', label: 'Custo por mens. qualificada', formula: 'investimento ÷ mens. qualificadas', formato: 'money', custo: true, meta: calc(div(m.investimento, m.mensagens_qualificadas)), real: calc(div(r.investimento, r.mensagens_qualificadas)) }),
      ],
    },
    {
      key: 'consultas',
      label: 'Funil de consultas',
      linhas: [
        linha({ key: 'numero_consultas', label: 'Nº de consultas', formato: 'int', meta: inp(m.numero_consultas, 'numero_consultas'), real: manual(r.numero_consultas, 'numero_consultas') }),
        linha({ key: 'tm_consulta', label: 'Ticket médio (consulta)', formato: 'money', meta: inp(m.tm_consulta, 'tm_consulta'), real: manual(r.tm_consulta, 'tm_consulta') }),
        linha({ key: 'taxa_consulta', label: 'Taxa de conversão', formula: 'consultas ÷ mens. qualificadas', formato: 'percent', meta: calc(pctDe(m.numero_consultas, m.mensagens_qualificadas)), real: calc(pctDe(r.numero_consultas, r.mensagens_qualificadas)) }),
      ],
    },
    {
      key: 'procedimentos',
      label: 'Funil de procedimentos',
      linhas: [
        linha({ key: 'numero_procedimentos', label: 'Nº de procedimentos', formato: 'int', meta: inp(m.numero_procedimentos, 'numero_procedimentos'), real: manual(r.numero_procedimentos, 'numero_procedimentos') }),
        linha({ key: 'tm_procedimento', label: 'Ticket médio (procedimento)', formato: 'money', meta: inp(m.tm_procedimento, 'tm_procedimento'), real: manual(r.tm_procedimento, 'tm_procedimento') }),
        linha({ key: 'taxa_procedimento', label: 'Taxa de conversão', formula: 'procedimentos ÷ consultas', formato: 'percent', meta: calc(pctDe(m.numero_procedimentos, m.numero_consultas)), real: calc(pctDe(r.numero_procedimentos, r.numero_consultas)) }),
      ],
    },
    {
      key: 'resultado',
      label: 'Resultado',
      linhas: [
        linha({ key: 'faturamento', label: 'Faturamento', formula: '(consultas × TM consulta) + (procedimentos × TM procedimento)', formato: 'money', destaque: true, meta: calc(mFat), real: calc(resumo.faturamento) }),
        linha({ key: 'roas', label: 'ROAS', formula: 'faturamento ÷ investimento', formato: 'multiplier', destaque: true, meta: calc(div(mFat, m.investimento)), real: calc(resumo.roas) }),
        linha({ key: 'cac', label: 'CAC', formula: 'investimento ÷ consultas', formato: 'money', custo: true, meta: calc(div(m.investimento, m.numero_consultas)), real: calc(resumo.cac) }),
      ],
    },
  ]
}

function pctDe(a: number | null | undefined, b: number | null | undefined): number | null {
  const v = div(a, b)
  return v == null ? null : v * 100
}

function faturamento(v: MetasValores): number | null {
  const c = mult(v.numero_consultas, v.tm_consulta)
  const p = mult(v.numero_procedimentos, v.tm_procedimento)
  if (c == null && p == null) return null
  return (c ?? 0) + (p ?? 0)
}
