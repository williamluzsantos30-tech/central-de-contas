/**
 * Visao Executiva — a pagina que o DONO da agencia abre primeiro.
 *
 * 5 KPIs macro (MRR, Churn Rate, MRR em Risco, Clientes Ativos, Ticket
 * Medio) + CTA grande de "Novo cliente". Nao substitui o Dashboard
 * (que continua sendo o resumo de tarefas do dia); a Visao Executiva
 * e' um passo acima, foco em SAUDE FINANCEIRA da operacao.
 *
 * Calculos (feitos client-side em cima de clientes.verba_mensal):
 *   MRR              = SUM(verba_mensal) WHERE status='ativo'
 *                      no periodo selecionado
 *   MRR em Risco     = SUM(verba_mensal) WHERE status='atencao'
 *   Clientes Ativos  = COUNT(status='ativo')
 *   Ticket Medio     = MRR / Clientes Ativos
 *   Churn Rate       = churns_no_mes / base_inicio_mes
 *                    aprox: churn_mes / (ativos_hoje + churn_mes)
 *
 * Filtro de mes muda quais churns entram na conta e no MRR (posso
 * navegar Set/26, Ago/26, etc). Nao muda a base atual (ativos_hoje
 * e' snapshot do banco — historico de MRR mensal precisa da tabela
 * separada que ainda nao existe. Aviso quando o usuario navega pra
 * um mes que nao e' o atual).
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, AlertTriangle, Users, DollarSign } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Cliente } from '@/types/database'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

// Rotulo do mes tipo "Setembro 2026"
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

export default function VisaoExecutiva() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nome')
    setClientes((data as Cliente[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Mes selecionado eh o corrente?
  const hoje = new Date()
  const mesAtualISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const eMesAtual = mesISO === mesAtualISO

  const kpis = useMemo(() => {
    const [y, m] = mesISO.split('-').map(Number)
    const inicioMes = new Date(y, m - 1, 1)
    const fimMes = new Date(y, m, 0, 23, 59, 59)

    // Filtra ativos que NAO estao arquivados (churn efetivo)
    const ativos = clientes.filter(
      (c) => c.status === 'ativo' && !c.arquivado_em,
    )
    const emRisco = clientes.filter(
      (c) => c.status === 'atencao' && !c.arquivado_em,
    )

    // Churns no periodo = clientes com arquivado_em dentro do mes
    const churnsNoMes = clientes.filter((c) => {
      if (!c.arquivado_em) return false
      const d = new Date(c.arquivado_em)
      return d >= inicioMes && d <= fimMes
    })

    const mrr = ativos.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrRisco = emRisco.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)
    const mrrChurn = churnsNoMes.reduce((s, c) => s + (c.verba_mensal ?? 0), 0)

    // Churn rate aproximado: assume que base_inicio_mes ~ ativos_hoje +
    // churns_no_mes. Nao e perfeito (ignora novos entrantes), mas boa
    // aproximacao ate a gente ter tabela historica de MRR mensal
    const baseInicioMes = ativos.length + churnsNoMes.length
    const churnRate =
      baseInicioMes > 0 ? churnsNoMes.length / baseInicioMes : 0

    const ticketMedio = ativos.length > 0 ? mrr / ativos.length : 0

    return {
      mrr,
      mrrRisco,
      mrrChurn,
      churnRate,
      ativos: ativos.length,
      emRisco: emRisco.length,
      churnsNoMes: churnsNoMes.length,
      ticketMedio,
    }
  }, [clientes, mesISO])

  return (
    <div>
      <PageHeader
        title="Visão Executiva"
        description="Saúde financeira e operacional da agência"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Novo cliente
          </Button>
        }
      />

      {/* Navegador de mes */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMesISO(shiftMes(mesISO, -1))}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold capitalize min-w-[180px]">
          {labelMes(mesISO)}
        </span>
        <button
          onClick={() => setMesISO(shiftMes(mesISO, 1))}
          disabled={mesISO === mesAtualISO}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={() => setMesISO(mesAtualISO)}
          className="ml-2 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 hover:border-brand-500/40 hover:text-brand-300"
        >
          hoje
        </button>
        {!eMesAtual && (
          <span className="ml-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            Meses passados usam a base atual como aproximação — histórico de MRR mensal fica na v2.
          </span>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : (
        <>
          {/* Grid principal — 5 KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              titulo="Receita do mês (MRR)"
              valor={formatBRL(kpis.mrr)}
              sub={`${kpis.ativos} ${kpis.ativos === 1 ? 'cliente ativo' : 'clientes ativos'}`}
              icon={DollarSign}
              tone="brand"
              destaque
            />
            <KpiCard
              titulo="Churn Rate"
              valor={formatPct(kpis.churnRate)}
              sub={`${kpis.churnsNoMes} ${kpis.churnsNoMes === 1 ? 'churn' : 'churns'} no mês${
                kpis.mrrChurn > 0 ? ` · ${formatBRL(kpis.mrrChurn)} perdidos` : ''
              }`}
              icon={TrendingDown}
              tone={kpis.churnRate > 0.05 ? 'danger' : kpis.churnRate > 0.02 ? 'warning' : 'success'}
            />
            <KpiCard
              titulo="MRR em Risco"
              valor={formatBRL(kpis.mrrRisco)}
              sub={`${kpis.emRisco} ${kpis.emRisco === 1 ? 'cliente' : 'clientes'} em atenção`}
              icon={AlertTriangle}
              tone={kpis.emRisco > 0 ? 'warning' : 'muted'}
            />
            <KpiCard
              titulo="Clientes Ativos"
              valor={String(kpis.ativos)}
              sub={
                kpis.emRisco > 0
                  ? `${kpis.emRisco} sinalizados como risco`
                  : 'nenhum em atenção'
              }
              icon={Users}
              tone="muted"
            />
            <KpiCard
              titulo="Ticket Médio"
              valor={formatBRL(kpis.ticketMedio)}
              sub="MRR ÷ clientes ativos"
              icon={TrendingUp}
              tone="muted"
            />
          </div>

          {/* Bloco de contexto pra dono */}
          <div className="mt-6 rounded-xl border border-border bg-bg-card p-5">
            <h3 className="text-sm font-semibold text-zinc-100">
              O que fazer com esses números
            </h3>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              MRR em Risco alto? Passa em revisão os clientes marcados como <b>atenção</b> —
              provavelmente tem um ou dois puxando o número. Churn Rate {'>'} 5%? Reunião com
              AM e Gestores pra entender o padrão. Ticket Médio caindo? Sinal pra revisar
              precificação ou upsell.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/clientes?status=atencao"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 hover:border-brand-500/40 hover:text-brand-300"
              >
                <AlertTriangle size={12} /> Ver clientes em atenção
              </a>
              <a
                href="/clientes"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 hover:border-brand-500/40 hover:text-brand-300"
              >
                <Users size={12} /> Base de clientes completa
              </a>
            </div>
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

// ------ KPI Card ------
type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'muted'

const toneClass: Record<Tone, string> = {
  brand: 'border-brand-500/40 bg-brand-500/5',
  success: 'border-emerald-500/40 bg-emerald-500/5',
  warning: 'border-amber-500/40 bg-amber-500/5',
  danger: 'border-red-500/40 bg-red-500/5',
  muted: 'border-border bg-bg-card',
}

const toneAccent: Record<Tone, string> = {
  brand: 'text-brand-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-red-300',
  muted: 'text-zinc-300',
}

function KpiCard({
  titulo,
  valor,
  sub,
  icon: Icon,
  tone,
  destaque = false,
}: {
  titulo: string
  valor: string
  sub?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone: Tone
  destaque?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        toneClass[tone],
        destaque && 'lg:col-span-2',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {titulo}
        </p>
        <Icon size={14} className={toneAccent[tone]} />
      </div>
      <p
        className={cn(
          'mt-2 font-semibold tabular-nums leading-none',
          destaque ? 'text-4xl' : 'text-2xl',
          toneAccent[tone],
        )}
      >
        {valor}
      </p>
      {sub && <p className="mt-2 text-[11px] text-muted">{sub}</p>}
    </div>
  )
}
