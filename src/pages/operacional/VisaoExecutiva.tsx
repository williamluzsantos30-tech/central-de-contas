/**
 * Visao Executiva — pagina que o DONO da agencia abre primeiro.
 * Reproduz o layout de resumo geral que ele mostrou como referencia.
 *
 * Estrutura:
 *   Header + filtros (mes/squad/AM/gestor)
 *   Banner "Mes Atual - Tempo Real" (so quando mes atual selecionado)
 *   Banner de alerta (condicional, quando ha metricas ruins)
 *   Hero: Receita do Mes (MRR) grande
 *   Grid de KPIs: NRR, Churn Rate, MRR em Risco, Composicao Base,
 *                  Ticket Medio
 *   Resultado do Negocio: Expansao / Reducao / Churn + Saldo
 *   Execucao Operacional: Clientes em Risco, Tempo Medio Vida,
 *                          Onboarding Finalizado, NPS Medio
 *   Lifetime Value: LTV Medio, LT Medio
 *   Acoes por Status: Verde / Amarelo / Vermelho com sugestoes
 *
 * Metricas derivadas de clientes.* (sem tabela historica ainda):
 *   MRR              = SUM verba_mensal WHERE status='ativo'
 *   Churn Rate       = churns_mes / (ativos_hoje + churns_mes) — aprox
 *   NRR              = 1 - churn_rate  — aprox (sem tracking de
 *                      expansao/reducao ainda; assume 0)
 *   MRR em Risco     = SUM verba_mensal WHERE status='atencao'
 *   NPS Medio        = AVG(nps) dos ativos com nps preenchido
 *   Tempo Medio Vida = AVG(hoje - data_inicio) em meses (ativos)
 *   LTV Medio        = ticket_medio × tempo_medio_vida
 *
 * O que ainda NAO faz (v2):
 *   - Grafico de Evolucao de Clientes (precisa snapshot mensal)
 *   - Score por Squad (falta definir formula com o user)
 *   - Expansao / Reducao (precisa log de mudancas em verba_mensal)
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  BookOpen,
  Download,
  Smile,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Cliente, Profile } from '@/types/database'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function formatBRLSigned(v: number): string {
  const s = v < 0 ? '-' : v > 0 ? '+' : ''
  return `${s}${formatBRL(Math.abs(v))}`
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function labelMes(mesISO: string): string {
  const [y, m] = mesISO.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

function shiftMes(mesISO: string, delta: number): string {
  const [y, m] = mesISO.split('-').map(Number)
  const nova = new Date(y, m - 1 + delta, 1)
  return `${nova.getFullYear()}-${String(nova.getMonth() + 1).padStart(2, '0')}-01`
}

/** Meses entre data ISO e hoje. Retorna 0 se data invalida. */
function mesesDesde(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  const hoje = new Date()
  const diffMs = hoje.getTime() - d.getTime()
  return diffMs / (1000 * 60 * 60 * 24 * 30.44)
}

export default function VisaoExecutiva() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [fSquad, setFSquad] = useState('')
  const [fAM, setFAM] = useState('')
  const [fGestor, setFGestor] = useState('')

  async function load() {
    setLoading(true)
    const [cRes, pRes] = await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('profiles').select('*').eq('ativo', true).eq('aprovado', true),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setProfiles((pRes.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const hoje = new Date()
  const mesAtualISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const eMesAtual = mesISO === mesAtualISO

  // Base filtrada por squad / AM / gestor
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      if (fSquad && c.squad !== fSquad) return false
      if (fAM && c.account_manager_id !== fAM) return false
      if (fGestor && c.gestor_id !== fGestor) return false
      return true
    })
  }, [clientes, fSquad, fAM, fGestor])

  // Squads distintos pra dropdown
  const squadsDistintos = useMemo(() => {
    const set = new Set<string>()
    for (const c of clientes) if (c.squad) set.add(c.squad)
    return [...set].sort()
  }, [clientes])

  const ams = useMemo(() => profiles.filter((p) => p.cargo === 'account_manager'), [profiles])
  const gestores = useMemo(() => profiles.filter((p) => p.cargo === 'gestor_trafego'), [profiles])

  const kpis = useMemo(() => {
    const [y, m] = mesISO.split('-').map(Number)
    const inicioMes = new Date(y, m - 1, 1)
    const fimMes = new Date(y, m, 0, 23, 59, 59)

    const ativos = clientesFiltrados.filter(
      (c) => c.status === 'ativo' && !c.arquivado_em,
    )
    const emRisco = clientesFiltrados.filter(
      (c) => c.status === 'atencao' && !c.arquivado_em,
    )
    const churnsNoMes = clientesFiltrados.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    })

    const mrr = ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrRisco = emRisco.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrChurn = churnsNoMes.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)

    const baseInicioMes = ativos.length + churnsNoMes.length
    const churnRate = baseInicioMes > 0 ? churnsNoMes.length / baseInicioMes : 0

    // NRR aproximado — sem log de expansao/reducao, assume ambos = 0
    const nrr = 1 - churnRate

    const ticketMedio = ativos.length > 0 ? mrr / ativos.length : 0

    // Composicao por tipo
    const nAssessoria = ativos.filter((c) => c.tipo === 'assessoria').length
    const nConsultoria = ativos.filter((c) => c.tipo === 'consultoria').length

    // Resultado do negocio
    const expansao = 0 // v2
    const reducao = 0 // v2
    const saldo = expansao - reducao - mrrChurn

    // Execucao operacional
    const emOnboarding = ativos.filter((c) => c.jornada === 'onboarding').length
    const finalizouOnboarding = ativos.filter((c) => c.jornada && c.jornada !== 'onboarding').length
    const pctOnboardingFinalizado =
      ativos.length > 0 ? finalizouOnboarding / ativos.length : 0

    const clientesComNps = ativos.filter((c) => typeof c.nps === 'number')
    const npsMedio =
      clientesComNps.length > 0
        ? clientesComNps.reduce((s, c) => s + (c.nps ?? 0), 0) / clientesComNps.length
        : null

    // Tempo medio de vida (meses) — dos ativos com data_inicio
    const vidasAtivos = ativos
      .map((c) => mesesDesde(c.data_inicio))
      .filter((v) => v > 0)
    const tempoMedioVida =
      vidasAtivos.length > 0
        ? vidasAtivos.reduce((a, b) => a + b, 0) / vidasAtivos.length
        : 0

    // LTV medio = ticket * tempo de vida
    const ltvMedio = ticketMedio * tempoMedioVida

    return {
      mrr,
      mrrRisco,
      mrrChurn,
      churnRate,
      nrr,
      ativos: ativos.length,
      emRisco: emRisco.length,
      churnsNoMes: churnsNoMes.length,
      ticketMedio,
      nAssessoria,
      nConsultoria,
      expansao,
      reducao,
      saldo,
      emOnboarding,
      pctOnboardingFinalizado,
      npsMedio,
      tempoMedioVida,
      ltvMedio,
    }
  }, [clientesFiltrados, mesISO])

  // Classificacao do "farol" pro banner de alerta
  const temAlerta = kpis.saldo < 0 || kpis.emRisco > 0 || kpis.churnRate > 0.05

  return (
    <div>
      <PageHeader
        title="Resumo Geral"
        description="Visão executiva da saúde da operação"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => alert('Código de Cultura — em breve')}>
              <BookOpen size={14} /> Código de Cultura
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Download size={14} /> Exportar
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={14} /> Novo cliente
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-soft px-2 py-1">
          <button
            onClick={() => setMesISO(shiftMes(mesISO, -1))}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-100"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="min-w-[130px] text-center text-xs font-semibold capitalize">
            {labelMes(mesISO)}
          </span>
          <button
            onClick={() => setMesISO(shiftMes(mesISO, 1))}
            disabled={eMesAtual}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={13} />
          </button>
        </div>
        <Select value={fSquad} onChange={(e) => setFSquad(e.target.value)}>
          <option value="">Todos os Squads</option>
          {squadsDistintos.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={fAM} onChange={(e) => setFAM(e.target.value)}>
          <option value="">Todos os AMs</option>
          {ams.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
        <Select value={fGestor} onChange={(e) => setFGestor(e.target.value)}>
          <option value="">Todos os Gestores</option>
          {gestores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : (
        <>
          {/* Banner Mes Atual — tempo real */}
          {eMesAtual && (
            <div className="mb-3 rounded-xl border border-sky-500/40 bg-sky-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-sky-300" />
                <p className="text-xs font-semibold text-sky-200">
                  Mês Atual
                  <span className="ml-2 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] uppercase text-sky-300">
                    Tempo Real
                  </span>
                </p>
              </div>
              <p className="mt-1 text-[11px] text-sky-300/80">
                Dados de {labelMes(mesISO)} são calculados em tempo real e podem
                mudar conforme novas movimentações são registradas.
              </p>
            </div>
          )}

          {/* Banner de alerta condicional */}
          {temAlerta && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-300" />
                <p className="text-xs font-semibold text-red-200">
                  {labelMes(mesISO)} em alerta
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                {kpis.nrr < 1 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    NRR {formatPct(kpis.nrr)}
                  </span>
                )}
                {kpis.churnRate > 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Churn {formatPct(kpis.churnRate)}
                  </span>
                )}
                {kpis.saldo !== 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Saldo {formatBRLSigned(kpis.saldo)}
                  </span>
                )}
                {kpis.emRisco > 0 && (
                  <span className="flex items-center gap-1 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {kpis.emRisco} em risco ({formatBRL(kpis.mrrRisco)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Bloco principal — MRR + KPIs em grade */}
          <div className="rounded-xl border border-border bg-bg-card p-6">
            {/* Hero MRR */}
            <div className="mb-6 pb-6 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-emerald-300" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Receita do mês (MRR)
                </p>
              </div>
              <p className="text-5xl font-bold tabular-nums leading-none text-emerald-300">
                {formatBRL(kpis.mrr)}
              </p>
              <p className="mt-2 text-xs text-muted">receita recorrente mensal</p>
            </div>

            {/* Grid de sub-KPIs */}
            <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
              <SubKpi
                titulo="NRR"
                valor={formatPct(kpis.nrr)}
                tone={kpis.nrr >= 1 ? 'emerald' : kpis.nrr >= 0.95 ? 'amber' : 'red'}
              />
              <SubKpi
                titulo="Churn Rate"
                valor={formatPct(kpis.churnRate)}
                tone={kpis.churnRate === 0 ? 'emerald' : kpis.churnRate < 0.03 ? 'amber' : 'red'}
              />
              <SubKpi
                titulo="MRR em Risco"
                valor={formatBRL(kpis.mrrRisco)}
                tone={kpis.mrrRisco === 0 ? 'emerald' : 'red'}
              />
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                  Composição da Base
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">
                  {kpis.ativos}
                </p>
                <p className="text-[10px] text-muted">clientes ativos</p>
                <div className="mt-2 flex flex-col gap-0.5 text-[10px] text-muted">
                  <span>{kpis.nAssessoria} Assessoria</span>
                  <span>{kpis.nConsultoria} Consultoria</span>
                </div>
              </div>
              <SubKpi
                titulo="Ticket Médio"
                valor={formatBRL(kpis.ticketMedio)}
                tone="neutral"
              />
            </div>
          </div>

          {/* Resultado do Negocio */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-bg-card p-5 md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-4">
                Resultado do Negócio
              </p>
              <div className="space-y-3">
                <LinhaResultado
                  icone={<Plus size={12} className="text-emerald-400" />}
                  label="Expansão"
                  valor={kpis.expansao}
                  tone="emerald"
                  aproximado
                />
                <LinhaResultado
                  icone={<span className="text-amber-400 text-xs">−</span>}
                  label="Redução"
                  valor={-kpis.reducao}
                  tone="amber"
                  aproximado
                />
                <LinhaResultado
                  icone={<span className="text-red-400 text-xs">−</span>}
                  label="Churn"
                  valor={-kpis.mrrChurn}
                  tone="red"
                />
              </div>
              <p className="mt-3 text-[10px] text-muted italic">
                Expansão e Redução em tempo real virão na v2 (precisa log de
                mudanças no verba_mensal).
              </p>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                <Zap size={12} className="inline mr-1" />
                Saldo do Mês
              </p>
              <p
                className={cn(
                  'text-4xl font-bold tabular-nums leading-none mt-3',
                  kpis.saldo < 0
                    ? 'text-red-300'
                    : kpis.saldo > 0
                      ? 'text-emerald-300'
                      : 'text-zinc-300',
                )}
              >
                {formatBRLSigned(kpis.saldo)}
              </p>
              <p className="mt-3 text-[10px] text-muted leading-relaxed">
                Saldo = Expansão + Nova Receita manual − Redução − Churn no
                período.
              </p>
            </div>
          </div>

          {/* Execucao Operacional */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
              Execução Operacional
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ExecKpi
                icone={<AlertTriangle size={14} className="text-red-300" />}
                titulo="Clientes em Risco"
                valor={String(kpis.emRisco)}
                sub={`${formatBRL(kpis.mrrRisco)} em risco`}
              />
              <ExecKpi
                icone={<Clock size={14} className="text-brand-300" />}
                titulo="Tempo Médio de Vida"
                valor={`${kpis.tempoMedioVida.toFixed(1)}m`}
                sub={`${kpis.ativos} clientes ativos`}
              />
              <ExecKpi
                icone={<CheckCircle2 size={14} className="text-emerald-300" />}
                titulo="Onboarding Finalizado"
                valor={formatPct(kpis.pctOnboardingFinalizado)}
                sub={`${kpis.emOnboarding} em onboarding`}
              />
              <ExecKpi
                icone={<Smile size={14} className="text-amber-300" />}
                titulo="NPS Médio"
                valor={kpis.npsMedio !== null ? kpis.npsMedio.toFixed(1) : 'sem dado'}
                sub={
                  kpis.npsMedio !== null
                    ? 'de 0 a 10'
                    : 'nenhum cliente com NPS preenchido'
                }
              />
            </div>
          </div>

          {/* Lifetime Value */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
              <DollarSign size={12} className="inline mr-1" />
              Lifetime Value (LTV)
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ExecKpi
                icone={<DollarSign size={14} className="text-brand-300" />}
                titulo="LTV Médio"
                valor={formatBRL(kpis.ltvMedio)}
                sub={`ticket médio × tempo médio de vida`}
                grande
              />
              <ExecKpi
                icone={<Users size={14} className="text-brand-300" />}
                titulo="LT Médio (Base Ativa)"
                valor={`${kpis.tempoMedioVida.toFixed(1)} meses`}
                sub={`${kpis.ativos} clientes ativos`}
                grande
              />
            </div>
          </div>

          {/* Acoes por Status */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
              Ações Sugeridas
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <BoxAcao
                titulo="Verde (base saudável)"
                icon={<CheckCircle2 size={14} className="text-emerald-300" />}
                tone="emerald"
                acoes={[
                  'Manter padrão atual',
                  'Documentar boas práticas',
                  'Apto a receber novos clientes',
                ]}
              />
              <BoxAcao
                titulo="Amarelo (atenção)"
                icon={<AlertTriangle size={14} className="text-amber-300" />}
                tone="amber"
                acoes={[
                  'Revisar onboarding',
                  'Reunião com AM e Gestores',
                  'Monitorar próximo ciclo',
                ]}
              />
              <BoxAcao
                titulo="Vermelho (crítico)"
                icon={<XCircle size={14} className="text-red-300" />}
                tone="red"
                acoes={[
                  'Congelar entrada de novos clientes',
                  'Revisão completa de processos',
                  'Intervenção direta da liderança',
                ]}
              />
            </div>
          </div>

          {/* Rodape com placeholders v2 */}
          <div className="mt-8 rounded-xl border border-dashed border-border bg-bg-soft/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Próximos blocos (v2)
            </p>
            <ul className="mt-2 space-y-1 text-[11px] text-muted">
              <li>· Evolução de Clientes (bar chart histórico) — precisa snapshot mensal</li>
              <li>· Score e Saúde por Squad — falta definir a fórmula do score</li>
              <li>· Métricas de Social Media integradas</li>
              <li>· Expansão / Redução em tempo real — precisa log de mudanças em verba_mensal</li>
            </ul>
          </div>
        </>
      )}

      <ClienteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        cliente={null}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />
    </div>
  )
}

// ------ Sub-componentes ------
type Tone = 'emerald' | 'amber' | 'red' | 'neutral'

const toneText: Record<Tone, string> = {
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  red: 'text-red-300',
  neutral: 'text-zinc-100',
}

function SubKpi({ titulo, valor, tone }: { titulo: string; valor: string; tone: Tone }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
        {titulo}
      </p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums leading-none', toneText[tone])}>
        {valor}
      </p>
    </div>
  )
}

function LinhaResultado({
  icone,
  label,
  valor,
  tone,
  aproximado = false,
}: {
  icone: React.ReactNode
  label: string
  valor: number
  tone: 'emerald' | 'amber' | 'red'
  aproximado?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-bg-soft/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-bg-elev">
          {icone}
        </span>
        <span className="text-xs text-zinc-200">
          {label}
          {aproximado && <span className="ml-1 text-[10px] text-muted italic">(v2)</span>}
        </span>
      </div>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-red-300',
        )}
      >
        {formatBRL(valor)}
      </span>
    </div>
  )
}

function ExecKpi({
  icone,
  titulo,
  valor,
  sub,
  grande = false,
}: {
  icone: React.ReactNode
  titulo: string
  valor: string
  sub?: string
  grande?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        {icone}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {titulo}
        </p>
      </div>
      <p className={cn('font-bold tabular-nums text-zinc-100', grande ? 'text-3xl' : 'text-2xl')}>
        {valor}
      </p>
      {sub && <p className="mt-1 text-[10px] text-muted">{sub}</p>}
    </div>
  )
}

function BoxAcao({
  titulo,
  icon,
  acoes,
  tone,
}: {
  titulo: string
  icon: React.ReactNode
  acoes: string[]
  tone: 'emerald' | 'amber' | 'red'
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-500/40 bg-emerald-500/[0.05]'
      : tone === 'amber'
        ? 'border-amber-500/40 bg-amber-500/[0.05]'
        : 'border-red-500/40 bg-red-500/[0.05]'
  const textCls =
    tone === 'emerald' ? 'text-emerald-200' : tone === 'amber' ? 'text-amber-200' : 'text-red-200'
  return (
    <div className={cn('rounded-xl border p-4', cls)}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className={cn('text-xs font-semibold', textCls)}>{titulo}</p>
      </div>
      <ul className="space-y-1.5 text-[11px] text-muted">
        {acoes.map((a) => (
          <li key={a} className="flex items-start gap-1.5">
            <span className={cn('mt-0.5', textCls)}>·</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
