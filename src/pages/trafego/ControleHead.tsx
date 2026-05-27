/**
 * Painel do Head de Tráfego — visão de TODAS as contas com status de saúde
 * (Estável / Instável / Crítica) e cadência de verificação obrigatória.
 *
 * Regra de cadência (definida pelo head):
 *   - Estável  → 1x por semana (≥ 1 verificação na semana corrente)
 *   - Instável → 2x por semana
 *   - Crítica  → 3x por semana
 *
 * ⚠️ ESTA TELA AINDA NÃO USA DADOS REAIS DO SUPABASE.
 * É um mock pra revisão visual antes de criar as migrations/tabelas.
 * O state vive só no client e some quando recarrega.
 */
import { useMemo, useState } from 'react'
import {
  Search,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

// =========================================================
// Tipos & mock data
// =========================================================

type StatusConta = 'estavel' | 'instavel' | 'critico'

/** Quantas verificações por semana cada status exige. */
const META_SEMANAL: Record<StatusConta, number> = {
  estavel: 1,
  instavel: 2,
  critico: 3,
}

const statusLabel: Record<StatusConta, string> = {
  estavel: 'Estável',
  instavel: 'Instável',
  critico: 'Crítica',
}

const statusCor: Record<
  StatusConta,
  { dot: string; bar: string; border: string; bg: string; text: string }
> = {
  estavel: {
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-500/70',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
  },
  instavel: {
    dot: 'bg-amber-400',
    bar: 'bg-amber-500/70',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
  critico: {
    dot: 'bg-red-400',
    bar: 'bg-red-500/70',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-300',
  },
}

interface ContaMock {
  id: string
  nome: string
  nicho: string
  squad: string
  gestor: { nome: string; avatar_url?: string | null }
  status: StatusConta
  /** Data ISO da última verificação registrada */
  ultima_verificacao: string | null
  /** Datas ISO das verificações registradas na semana corrente (seg–dom) */
  verificacoes_semana: string[]
  leads_30d: number
  cpl: number
  verba_gasta: number
  verba_orcamento: number
  /** Tendência da última semana (mock): +X% leads vs semana anterior */
  tendencia_pct: number
  observacao?: string
}

/** Helper pra subtrair N dias da data atual (ISO). */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

/** Gera N datas dentro da semana atual (entre seg e hoje). */
function thisWeek(quantos: number): string[] {
  const today = new Date()
  const segIdx = today.getDay() === 0 ? 6 : today.getDay() - 1 // 0=seg
  const arr: string[] = []
  for (let i = 0; i < quantos; i++) {
    const offset = Math.min(segIdx, Math.floor((i * segIdx) / quantos))
    arr.push(daysAgo(segIdx - offset))
  }
  return arr.slice(0, quantos)
}

const MOCK_CONTAS: ContaMock[] = [
  // CRÍTICAS (2)
  {
    id: 'm1',
    nome: 'Dra. Camila Estética',
    nicho: 'Harmonização Facial',
    squad: 'BlackOps',
    gestor: { nome: 'Lucas Portilho' },
    status: 'critico',
    ultima_verificacao: daysAgo(2),
    verificacoes_semana: thisWeek(1), // só 1 de 3 = atrasada
    leads_30d: 8,
    cpl: 240.5,
    verba_gasta: 3800,
    verba_orcamento: 6000,
    tendencia_pct: -42,
    observacao: 'CPL disparou na última semana, anúncios em revisão.',
  },
  {
    id: 'm2',
    nome: 'Dr. Henrique Cardio',
    nicho: 'Cardiologia',
    squad: 'BlackSkull',
    gestor: { nome: 'Beatriz Barros' },
    status: 'critico',
    ultima_verificacao: daysAgo(3),
    verificacoes_semana: thisWeek(2), // 2 de 3
    leads_30d: 14,
    cpl: 178.2,
    verba_gasta: 4200,
    verba_orcamento: 5000,
    tendencia_pct: -18,
  },

  // INSTÁVEIS (4)
  {
    id: 'm3',
    nome: 'Clínica Sorrir Mais',
    nicho: 'Odonto',
    squad: 'BlackOps',
    gestor: { nome: 'Lucas Portilho' },
    status: 'instavel',
    ultima_verificacao: daysAgo(2),
    verificacoes_semana: thisWeek(1),
    leads_30d: 32,
    cpl: 78,
    verba_gasta: 2400,
    verba_orcamento: 3000,
    tendencia_pct: -8,
  },
  {
    id: 'm4',
    nome: 'Dra. Renata Derma',
    nicho: 'Dermatologia',
    squad: 'BlackSkull',
    gestor: { nome: 'Igor Reis' },
    status: 'instavel',
    ultima_verificacao: daysAgo(4),
    verificacoes_semana: [], // 0 de 2 = atrasada
    leads_30d: 22,
    cpl: 120,
    verba_gasta: 2600,
    verba_orcamento: 3500,
    tendencia_pct: 5,
  },
  {
    id: 'm5',
    nome: 'Dr. Pedro Ortopedia',
    nicho: 'Ortopedia',
    squad: 'BlackOps',
    gestor: { nome: 'Diego Assis' },
    status: 'instavel',
    ultima_verificacao: daysAgo(1),
    verificacoes_semana: thisWeek(2), // 2 de 2 = ok
    leads_30d: 18,
    cpl: 195,
    verba_gasta: 3500,
    verba_orcamento: 4000,
    tendencia_pct: -3,
  },
  {
    id: 'm6',
    nome: 'Espaço Bella Vita',
    nicho: 'Estética',
    squad: 'BlackSkull',
    gestor: { nome: 'Beatriz Barros' },
    status: 'instavel',
    ultima_verificacao: daysAgo(3),
    verificacoes_semana: thisWeek(1),
    leads_30d: 27,
    cpl: 88,
    verba_gasta: 2200,
    verba_orcamento: 2800,
    tendencia_pct: 12,
  },

  // ESTÁVEIS (12)
  ...Array.from({ length: 12 }).map((_, i) => {
    const nomes = [
      'Dra. Fernanda Ginecologia',
      'Dr. Artur Coluna',
      'Dr. Daniel Sadigursky',
      'Clínica Vita Plena',
      'Dr. Marcelo Plástica',
      'Dra. Violeta Canejo',
      'Clínica Bem Estar',
      'Dr. Rafael Vascular',
      'Dra. Leticia Fabiana',
      'Espaço Saúde Total',
      'Dr. Bruno Cirurgia',
      'Dra. Patrícia Pediatria',
    ]
    const nichos = [
      'Ginecologia',
      'Ortopedia',
      'Ortopedia',
      'Multi',
      'Cirurgia Plástica',
      'Ginecologia',
      'Multi',
      'Vascular',
      'Estética',
      'Multi',
      'Cirurgia Geral',
      'Pediatria',
    ]
    const gestores = [
      'Lucas Portilho',
      'Beatriz Barros',
      'Igor Reis',
      'Diego Assis',
      'Lucas Antonio',
    ]
    const squads = ['BlackOps', 'BlackSkull']
    const verificacoesFeitas = Math.random() > 0.3 ? 1 : 0 // 70% feitas
    return {
      id: `m${i + 7}`,
      nome: nomes[i],
      nicho: nichos[i],
      squad: squads[i % 2],
      gestor: { nome: gestores[i % gestores.length] },
      status: 'estavel' as StatusConta,
      ultima_verificacao: daysAgo(Math.floor(Math.random() * 5) + 1),
      verificacoes_semana: thisWeek(verificacoesFeitas),
      leads_30d: Math.floor(Math.random() * 60) + 25,
      cpl: Math.floor(Math.random() * 80) + 50,
      verba_gasta: Math.floor(Math.random() * 3000) + 2500,
      verba_orcamento: Math.floor(Math.random() * 2000) + 4500,
      tendencia_pct: Math.floor(Math.random() * 30) - 5,
    }
  }),
]

// =========================================================
// Helpers de cálculo
// =========================================================

function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function labelDiasDesde(dias: number | null): string {
  if (dias === null) return 'Nunca verificada'
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return `${dias} dias atrás`
}

/** Conta está atrasada se as verificações da semana < meta E já passou da metade da semana */
function estaAtrasada(c: ContaMock): boolean {
  const meta = META_SEMANAL[c.status]
  const feitas = c.verificacoes_semana.length
  if (feitas >= meta) return false
  const today = new Date()
  const diaSemana = today.getDay() === 0 ? 7 : today.getDay() // seg=1, dom=7
  // Espera proporcional: dia 4 da semana (qui) com 0 verificações em conta crítica = atrasada
  const esperado = Math.floor((meta * diaSemana) / 7)
  return feitas < esperado
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// =========================================================
// Página
// =========================================================

export default function ControleHead() {
  const [contas, setContas] = useState<ContaMock[]>(MOCK_CONTAS)
  const [q, setQ] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fGestor, setFGestor] = useState('')
  const [collapsed, setCollapsed] = useState<Record<StatusConta, boolean>>({
    critico: false,
    instavel: false,
    estavel: true, // estáveis colapsadas por padrão (muitas)
  })

  // Listas distintas pros filtros
  const squads = useMemo(
    () => Array.from(new Set(contas.map((c) => c.squad))).sort(),
    [contas],
  )
  const gestores = useMemo(
    () => Array.from(new Set(contas.map((c) => c.gestor.nome))).sort(),
    [contas],
  )

  const filtered = useMemo(() => {
    return contas.filter((c) => {
      if (fSquad && c.squad !== fSquad) return false
      if (fGestor && c.gestor.nome !== fGestor) return false
      if (q) {
        const hay = `${c.nome} ${c.nicho} ${c.gestor.nome}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [contas, q, fSquad, fGestor])

  const grupos = useMemo(() => {
    const m: Record<StatusConta, ContaMock[]> = { critico: [], instavel: [], estavel: [] }
    for (const c of filtered) m[c.status].push(c)
    return m
  }, [filtered])

  // KPIs
  const kpis = useMemo(() => {
    const out = {
      estavel: { total: 0, no_prazo: 0 },
      instavel: { total: 0, no_prazo: 0 },
      critico: { total: 0, no_prazo: 0 },
      atrasadas: 0,
    }
    for (const c of filtered) {
      out[c.status].total++
      if (c.verificacoes_semana.length >= META_SEMANAL[c.status]) {
        out[c.status].no_prazo++
      }
      if (estaAtrasada(c)) out.atrasadas++
    }
    return out
  }, [filtered])

  function registrarVerificacao(id: string) {
    setContas((arr) =>
      arr.map((c) =>
        c.id === id
          ? {
              ...c,
              ultima_verificacao: new Date().toISOString(),
              verificacoes_semana: [...c.verificacoes_semana, new Date().toISOString()],
            }
          : c,
      ),
    )
  }

  function mudarStatus(id: string, novo: StatusConta) {
    setContas((arr) => arr.map((c) => (c.id === id ? { ...c, status: novo } : c)))
  }

  return (
    <div>
      <PageHeader
        title="Controle do Head de Tráfego"
        description={`${contas.length} contas no seu radar · cadência semanal de verificação`}
      />

      {/* Aviso temporario sobre mock */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div>
          <strong>Versão de revisão · dados fictícios.</strong> Esta tela ainda
          não consulta o banco — é um mock pra você validar o layout, fluxo de
          verificação e os filtros. Quando aprovar, conecto com a base real
          (clientes + tabela de verificações) e ativo o registro persistente.
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          tone="critico"
          label="Críticas"
          valor={kpis.critico.total}
          subtitle={`${kpis.critico.no_prazo}/${kpis.critico.total} no prazo · 3x semana`}
          icon={AlertTriangle}
        />
        <KpiCard
          tone="instavel"
          label="Instáveis"
          valor={kpis.instavel.total}
          subtitle={`${kpis.instavel.no_prazo}/${kpis.instavel.total} no prazo · 2x semana`}
          icon={Activity}
        />
        <KpiCard
          tone="estavel"
          label="Estáveis"
          valor={kpis.estavel.total}
          subtitle={`${kpis.estavel.no_prazo}/${kpis.estavel.total} no prazo · 1x semana`}
          icon={CheckCircle2}
        />
        <KpiCard
          tone="critico"
          label="Atrasadas"
          valor={kpis.atrasadas}
          subtitle="Verificações abaixo do esperado pra essa semana"
          icon={Calendar}
        />
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por cliente, nicho ou gestor..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={fSquad} onChange={(e) => setFSquad(e.target.value)} className="w-44">
            <option value="">Todos squads</option>
            {squads.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={fGestor} onChange={(e) => setFGestor(e.target.value)} className="w-56">
            <option value="">Todos gestores</option>
            {gestores.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Seções por status */}
      <div className="space-y-5">
        {(['critico', 'instavel', 'estavel'] as StatusConta[]).map((s) => {
          const items = grupos[s]
          if (items.length === 0) return null
          const isCollapsed = collapsed[s]
          const cor = statusCor[s]
          return (
            <div key={s}>
              <button
                onClick={() => setCollapsed((o) => ({ ...o, [s]: !o[s] }))}
                className="mb-2 flex w-full items-center gap-2.5 text-left"
              >
                <span className={cn('h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]', cor.dot)} />
                <span className={cn('text-[11px] font-semibold uppercase tracking-wider', cor.text)}>
                  {statusLabel[s]} · {META_SEMANAL[s]}x por semana
                </span>
                <span className="rounded-md bg-bg-elev px-1.5 py-0.5 text-[10px] text-muted">
                  {items.length}
                </span>
                {isCollapsed ? (
                  <ChevronRight size={12} className="ml-auto text-muted" />
                ) : (
                  <ChevronDown size={12} className="ml-auto text-muted" />
                )}
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {items.map((c) => (
                    <ContaCard
                      key={c.id}
                      conta={c}
                      onRegistrar={() => registrarVerificacao(c.id)}
                      onMudarStatus={(novo) => mudarStatus(c.id, novo)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
            <Users size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-zinc-200">Nenhuma conta nos filtros atuais</p>
            <p className="mt-1 text-xs text-muted">Limpe os filtros pra ver todas.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// =========================================================
// Subcomponentes
// =========================================================

function KpiCard({
  tone,
  label,
  valor,
  subtitle,
  icon: Icon,
}: {
  tone: StatusConta
  label: string
  valor: number
  subtitle: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  const cor = statusCor[tone]
  return (
    <Card className={cn('border', cor.border, cor.bg)}>
      <CardBody className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', cor.text)}>
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">{valor}</p>
          <p className="mt-1 text-[10px] text-muted">{subtitle}</p>
        </div>
        <Icon size={18} className={cor.text} />
      </CardBody>
    </Card>
  )
}

function ContaCard({
  conta,
  onRegistrar,
  onMudarStatus,
}: {
  conta: ContaMock
  onRegistrar: () => void
  onMudarStatus: (novo: StatusConta) => void
}) {
  const cor = statusCor[conta.status]
  const meta = META_SEMANAL[conta.status]
  const feitas = conta.verificacoes_semana.length
  const pct = Math.min(100, Math.round((feitas / meta) * 100))
  const completo = feitas >= meta
  const atrasada = estaAtrasada(conta)
  const dias = diasDesde(conta.ultima_verificacao)
  const cplFmt = `R$ ${conta.cpl.toFixed(2).replace('.', ',')}`
  const verbaPct = Math.round((conta.verba_gasta / conta.verba_orcamento) * 100)

  return (
    <div
      className={cn(
        'rounded-xl border bg-bg-card overflow-hidden transition-colors',
        cor.border,
        'hover:border-brand-500/40',
      )}
    >
      {/* Barra colorida lateral */}
      <div className="flex">
        <div className={cn('w-1 shrink-0', cor.bar)} />
        <div className="flex-1 p-4">
          {/* Header: nome + badges */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-zinc-100">{conta.nome}</h3>
              <p className="mt-0.5 text-[11px] text-muted">
                {conta.nicho} · Squad {conta.squad}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Avatar name={conta.gestor.nome} size="sm" />
              {atrasada && (
                <Badge tone="danger" className="text-[9px]">
                  Atrasada
                </Badge>
              )}
            </div>
          </div>

          {/* Métricas em linha */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Metric
              label="Leads 30d"
              valor={String(conta.leads_30d)}
              tendencia={conta.tendencia_pct}
            />
            <Metric label="CPL" valor={cplFmt} />
            <Metric label="Verba" valor={`${verbaPct}%`} sub={formatBRL(conta.verba_gasta)} />
          </div>

          {/* Cadência semanal */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
              <span>Verificações esta semana</span>
              <span className={cn('font-semibold', completo ? 'text-emerald-300' : cor.text)}>
                {feitas}/{meta}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: meta }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-sm',
                    i < feitas
                      ? completo
                        ? 'bg-emerald-500'
                        : cor.bar
                      : 'bg-bg-soft border border-border',
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted">
              Última: {labelDiasDesde(dias)}
              {conta.observacao && (
                <>
                  {' '}· <span className="text-amber-300">{conta.observacao}</span>
                </>
              )}
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <Select
              value={conta.status}
              onChange={(e) => onMudarStatus(e.target.value as StatusConta)}
              className="h-7 w-32 text-[11px]"
              title="Mudar status da conta"
            >
              <option value="estavel">Estável</option>
              <option value="instavel">Instável</option>
              <option value="critico">Crítica</option>
            </Select>
            <Button size="sm" onClick={onRegistrar}>
              {completo ? <RefreshCw size={12} /> : <Plus size={12} />}
              {completo ? 'Verificar +1' : 'Registrar verificação'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({
  label,
  valor,
  sub,
  tendencia,
}: {
  label: string
  valor: string
  sub?: string
  tendencia?: number
}) {
  const positivo = (tendencia ?? 0) > 0
  const Icon = positivo ? TrendingUp : TrendingDown
  return (
    <div className="rounded-md border border-border bg-bg-soft px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1 text-sm font-semibold text-zinc-100">
        {valor}
        {tendencia !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[10px]',
              positivo ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            <Icon size={9} />
            {Math.abs(tendencia)}%
          </span>
        )}
      </p>
      {sub && <p className="text-[9px] text-muted">{sub}</p>}
    </div>
  )
}
