/**
 * Comercial › Marketing — funil de aquisição: investimento (por canal) × o
 * funil comercial (Leads/Qualificados/Reuniões/Fechamentos) da mesma entidade
 * Lead. Visão Geral (todos os canais) ou por canal (recalcula tudo filtrando).
 * Investimento é input manual; metas colorem os KPIs.
 */
import { useMemo, useState } from 'react'
import { DollarSign, Megaphone, Plus } from 'lucide-react'
import { PageHeader, KPICard, PrimaryButton, OutlineButton, Modal, Input, Select, type Tone } from '@/components/ds'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { fmtBRL } from '@/components/comercial/LeadsTable'
import { WeekNavigator } from '@/components/comercial/WeekNavigator'
import { MetaFormModal } from '@/components/comercial/MetaFormModal'
import { useComercial } from './store'
import { metaDoCanal } from './mockComercialConfig'
import {
  calculateMarketingFunnel,
  calculateChannelComparison,
  canaisDoPeriodo,
  periodoMes,
  periodoRange,
  periodoSemana,
  weekRefOf,
  SEM_ORIGEM,
  type MarketingFunnel,
} from './marketingCalculator'
import {
  formatMetaValor,
  metricaInfo,
  metricaLabel,
  type MetaComercial,
  type MetricaMeta,
  type Periodicidade,
} from './mockMetasComerciais'
import { calculateGoalProgress, statusDeProgresso } from './metasComerciais'
import { escopoLabel } from '@/components/comercial/GoalProgressCard'

const CANAIS_BASE = ['Meta Ads', 'Google Ads', 'Indicação', 'Social Selling', 'Inbound', 'Orgânico']
const pct = (v: number) => `${v.toFixed(0)}%`
const roas = (v: number) => `${v.toFixed(2)}x`

export default function MarketingFunnelPanel({ modo = 'marketing' }: { modo?: 'marketing' | 'metas' }) {
  const ehMetas = modo === 'metas'
  const {
    leads,
    investimentos,
    metasMarketing,
    registrarInvestimentos,
    metasComerciais,
    criarMetas,
    atualizarMeta,
  } = useComercial()
  const [tipoPeriodo, setTipoPeriodo] = useState<'mes' | 'custom' | 'semana'>('mes')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [semanaRef, setSemanaRef] = useState(weekRefOf())
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [view, setView] = useState('Geral')
  const [invOpen, setInvOpen] = useState(false)
  const [metaModalOpen, setMetaModalOpen] = useState(false)
  const [metaEdit, setMetaEdit] = useState<MetaComercial | null>(null)

  const filtro = useMemo(() => {
    if (ehMetas) return tipoPeriodo === 'semana' ? periodoSemana(semanaRef) : periodoMes(mes)
    return tipoPeriodo === 'custom' && (de || ate) ? periodoRange(de, ate) : periodoMes(mes)
  }, [ehMetas, tipoPeriodo, mes, semanaRef, de, ate])

  const canais = useMemo(() => canaisDoPeriodo(leads, investimentos, filtro), [leads, investimentos, filtro])
  const canalSel = view === 'Geral' ? undefined : view
  const f = useMemo(() => calculateMarketingFunnel(leads, investimentos, filtro, canalSel), [leads, investimentos, filtro, canalSel])
  const fAnt = useMemo(
    () => calculateMarketingFunnel(leads, investimentos, filtro.anterior(), canalSel),
    [leads, investimentos, filtro, canalSel],
  )
  const comparativo = useMemo(
    () => (!ehMetas && view === 'Geral' ? calculateChannelComparison(leads, investimentos, filtro) : []),
    [ehMetas, view, leads, investimentos, filtro],
  )

  // ── Metas (modo "metas") ──────────────────────────────────────────────
  const periodicidade: Periodicidade = tipoPeriodo === 'semana' ? 'semanal' : 'mensal'
  const refMeta = tipoPeriodo === 'semana' ? semanaRef : mes
  const metaGeralDe = (metrica: MetricaMeta) =>
    metasComerciais.find(
      (m) => m.periodicidade === periodicidade && m.periodoReferencia === refMeta && m.metrica === metrica && !m.canal && !m.responsavelId,
    )
  const metasEscopo = metasComerciais.filter(
    (m) => m.periodicidade === periodicidade && m.periodoReferencia === refMeta && (m.canal || m.responsavelId),
  )
  function salvarMetaInline(metrica: MetricaMeta, valor: number) {
    const existente = metaGeralDe(metrica)
    if (existente) atualizarMeta(existente.id, { valorMeta: valor })
    else criarMetas([{ periodicidade, metrica, valorMeta: valor, periodoReferencia: refMeta }])
  }
  /** Props do KPICard por card: comparação (marketing) OU meta editável (metas). */
  function extra(metrica: MetricaMeta | null, atual: number, anterior: number, dir: 'maior' | 'menor') {
    if (!ehMetas) return { valorAtual: atual, valorAnterior: anterior, direcaoFavoravel: dir }
    if (!metrica) return {}
    const m = metaGeralDe(metrica)
    const info = metricaInfo(metrica)
    return {
      comMeta: true,
      valorAtual: atual,
      meta: m?.valorMeta ?? null,
      metaLabel: m ? formatMetaValor(metrica, m.valorMeta) : undefined,
      metaInvertida: !!info.invertida,
      onSalvarMeta: (v: number) => salvarMetaInline(metrica, v),
    }
  }

  const metaAgend = metaDoCanal(metasMarketing, view, 'taxaAgendamento')
  const metaRoas = metaDoCanal(metasMarketing, view, 'roasContrato')
  const metaCac = metaDoCanal(metasMarketing, view, 'cacAlvo')
  const toneAgend: Tone = f.taxaAgendamento >= metaAgend ? 'success' : 'danger'
  const toneRoas: Tone = f.roasContrato >= metaRoas ? 'success' : f.roasContrato < 1 ? 'danger' : 'warning'
  const toneCac: Tone = f.fechamentos === 0 ? 'neutral' : f.cac <= metaCac ? 'success' : 'danger'

  return (
    <div>
      <Breadcrumb trilha={['Comercial', ehMetas ? 'Metas' : 'Marketing']} />
      <PageHeader
        title={ehMetas ? 'Metas' : 'Marketing'}
        description={ehMetas ? 'Metas do funil — realizado vs. meta, edite direto no card' : 'Funil de aquisição — investimento, custo por etapa e retorno'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tipoPeriodo} onChange={(e) => setTipoPeriodo(e.target.value as 'mes' | 'custom' | 'semana')} className="w-32">
              {ehMetas ? (
                <>
                  <option value="mes">Mensal</option>
                  <option value="semana">Semanal</option>
                </>
              ) : (
                <>
                  <option value="mes">Por mês</option>
                  <option value="custom">Intervalo</option>
                </>
              )}
            </Select>
            {tipoPeriodo === 'semana' ? (
              <WeekNavigator semanaRef={semanaRef} onChange={setSemanaRef} />
            ) : tipoPeriodo === 'custom' ? (
              <>
                <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs text-zinc-100" />
                <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs text-zinc-100" />
              </>
            ) : (
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs text-zinc-100" />
            )}
            {ehMetas ? (
              <PrimaryButton size="sm" onClick={() => { setMetaEdit(null); setMetaModalOpen(true) }}>
                <Plus size={14} /> Nova Meta
              </PrimaryButton>
            ) : (
              <PrimaryButton size="sm" onClick={() => setInvOpen(true)}>
                <DollarSign size={14} /> Registrar Investimento do Mês
              </PrimaryButton>
            )}
          </div>
        }
      />

      {/* Seletor de visão por canal — só no Marketing */}
      {!ehMetas && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <ViewTab label="🌐 Geral" ativo={view === 'Geral'} onClick={() => setView('Geral')} />
          {canais.map((c) => (
            <ViewTab key={c} label={c} ativo={view === c} onClick={() => setView(c)} />
          ))}
        </div>
      )}

      {/* BLOCO 1 — Topo de funil */}
      <Bloco titulo="Topo de funil" icon={<Megaphone size={13} />}>
        <KPICard label="Investimento" value={fmtBRL(f.investimento)} tone="neutral" sub="mídia no período" {...extra(null, f.investimento, fAnt.investimento, 'maior')} />
        <KPICard label="Leads" value={String(f.leads)} tone="accent" sub="entraram na Caixa" {...extra('leads', f.leads, fAnt.leads, 'maior')} />
        <KPICard label="CPL" value={fmtBRL(f.cpl)} tone="neutral" sub="custo por lead" {...extra(null, f.cpl, fAnt.cpl, 'menor')} />
        <KPICard label="Leads qualificados" value={String(f.qualificados)} tone="info" sub="viraram SQL" {...extra('leads_qualificados', f.qualificados, fAnt.qualificados, 'maior')} />
        <KPICard label="MQL" value={pct(f.mqlPct)} tone="info" sub="qualificados / leads" {...extra(null, f.mqlPct, fAnt.mqlPct, 'maior')} />
        <KPICard label="CPMQL" value={fmtBRL(f.cpmql)} tone="neutral" sub="custo por qualificado" {...extra(null, f.cpmql, fAnt.cpmql, 'menor')} />
      </Bloco>

      {/* BLOCO 2 — Reuniões */}
      <Bloco titulo="Reuniões" icon={<Megaphone size={13} />}>
        <KPICard label="Reuniões agendadas" value={String(f.reunioesAgendadas)} tone="accent" sub="no período" {...extra('reunioes_agendadas', f.reunioesAgendadas, fAnt.reunioesAgendadas, 'maior')} />
        <KPICard label="Custo / agendada" value={fmtBRL(f.custoPorAgendada)} tone="neutral" sub="investimento ÷ agendadas" {...extra(null, f.custoPorAgendada, fAnt.custoPorAgendada, 'menor')} />
        <KPICard label="Reuniões realizadas" value={String(f.reunioesRealizadas)} tone="success" sub="call aconteceu" {...extra('reunioes_realizadas', f.reunioesRealizadas, fAnt.reunioesRealizadas, 'maior')} />
        <KPICard label="Custo / realizada" value={fmtBRL(f.custoPorRealizada)} tone="neutral" sub="investimento ÷ realizadas" {...extra(null, f.custoPorRealizada, fAnt.custoPorRealizada, 'menor')} />
        <KPICard label="A serem realizadas" value={String(f.reunioesASerem)} tone="warning" sub="agendadas futuras" {...extra(null, f.reunioesASerem, fAnt.reunioesASerem, 'maior')} />
        <KPICard label="No-show" value={pct(f.noShowPct)} tone={f.noShowPct > 0 ? 'danger' : 'neutral'} sub="taxa de falta" {...extra('no_show_max', f.noShowPct, fAnt.noShowPct, 'menor')} />
      </Bloco>
      <SubLinhas>
        <SubItem label="Taxa de agendamento" valor={pct(f.taxaAgendamento)} tone={ehMetas ? 'neutral' : toneAgend} meta={ehMetas ? undefined : `Meta ${pct(metaAgend)}`} />
        <SubItem label="Cancelamentos" valor={`${f.cancelamentos} · ${pct(f.taxaCancelamentos)}`} />
      </SubLinhas>

      {/* BLOCO 3 — Fechamentos e receita */}
      <Bloco titulo="Fechamentos e receita" icon={<DollarSign size={13} />}>
        <KPICard label="Fechamentos" value={String(f.fechamentos)} tone="success" sub="no período" {...extra('fechamentos', f.fechamentos, fAnt.fechamentos, 'maior')} />
        <KPICard label="Txa de conversão" value={pct(f.txConversao)} tone="info" sub="fechados ÷ realizadas" {...extra('taxa_conversao', f.txConversao, fAnt.txConversao, 'maior')} />
        <KPICard label="MRR" value={fmtBRL(f.mrr)} tone="success" sub="receita recorrente" {...extra('mrr', f.mrr, fAnt.mrr, 'maior')} />
        <KPICard label="Caixa recolhido" value={fmtBRL(f.caixaRecolhido)} tone="success" sub="entrada recebida" {...extra('caixa_recolhido', f.caixaRecolhido, fAnt.caixaRecolhido, 'maior')} />
        <KPICard label="Contrato fechado" value={fmtBRL(f.contratoFechado)} tone="neutral" sub="total dos contratos" {...extra('contrato_fechado', f.contratoFechado, fAnt.contratoFechado, 'maior')} />
        <KPICard label="Ticket médio" value={fmtBRL(f.ticketMedio)} tone="neutral" sub="caixa ÷ fechamentos" {...extra(null, f.ticketMedio, fAnt.ticketMedio, 'maior')} />
      </Bloco>
      <SubLinhas>
        <SubItem label="Conversão reuniões do mês" valor={pct(f.txConversaoReunioesDoMes)} />
      </SubLinhas>

      {/* BLOCO 4 — Retorno */}
      <Bloco titulo="Retorno" icon={<DollarSign size={13} />} cols4>
        <KPICard label="ROAS MRR" value={roas(f.roasMrr)} tone={f.roasMrr >= 1 ? 'success' : 'warning'} sub="MRR ÷ investimento" {...extra(null, f.roasMrr, fAnt.roasMrr, 'maior')} />
        <KPICard label="ROAS caixa recolhido" value={roas(f.roasCaixa)} tone={f.roasCaixa >= 1 ? 'success' : 'warning'} sub="caixa ÷ investimento" {...extra(null, f.roasCaixa, fAnt.roasCaixa, 'maior')} />
        <KPICard label="ROAS contrato" value={roas(f.roasContrato)} tone={toneRoas} sub={`meta ${roas(metaRoas)}`} {...extra(null, f.roasContrato, fAnt.roasContrato, 'maior')} />
        <KPICard label="CAC" value={fmtBRL(f.cac)} tone={toneCac} sub={`alvo ≤ ${fmtBRL(metaCac)}`} {...extra(null, f.cac, fAnt.cac, 'menor')} />
      </Bloco>

      {/* BLOCO 5 — Comparativo entre canais (Marketing, visão Geral) */}
      {!ehMetas && view === 'Geral' && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-100">Comparativo entre canais</h3>
          <ComparativoCanais rows={comparativo} total={f} metasFn={(canal, campo) => metaDoCanal(metasMarketing, canal, campo)} />
        </div>
      )}

      {/* Metas por canal/responsável (modo Metas) */}
      {ehMetas && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Metas por canal / responsável</h3>
            <OutlineButton size="sm" onClick={() => { setMetaEdit(null); setMetaModalOpen(true) }}>
              <Plus size={13} /> Nova Meta Segmentada
            </OutlineButton>
          </div>
          {metasEscopo.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-bg-soft/30 p-4 text-center text-xs text-muted">
              Nenhuma meta segmentada neste período.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metasEscopo.map((m) => (
                <MetaEscopoCard key={m.id} meta={m} leads={leads} investimentos={investimentos} onSalvar={(v) => atualizarMeta(m.id, { valorMeta: v })} />
              ))}
            </div>
          )}
        </div>
      )}

      {!ehMetas && (
        <InvestimentoModal
          open={invOpen}
          onClose={() => setInvOpen(false)}
          periodo={filtro.mesRef}
          canais={Array.from(new Set([...canais, ...CANAIS_BASE]))}
          investimentosAtuais={investimentos}
          onSalvar={(lancamentos) => {
            registrarInvestimentos(filtro.mesRef, lancamentos)
            setInvOpen(false)
          }}
        />
      )}

      {ehMetas && (
        <MetaFormModal
          open={metaModalOpen}
          onClose={() => { setMetaModalOpen(false); setMetaEdit(null) }}
          meta={metaEdit}
          periodicidadePadrao={periodicidade}
          mesPadrao={mes}
          semanaPadrao={semanaRef}
        />
      )}
    </div>
  )
}

/** Card de meta segmentada (canal/responsável) com edição inline do valor. */
function MetaEscopoCard({
  meta,
  leads,
  investimentos,
  onSalvar,
}: {
  meta: MetaComercial
  leads: Parameters<typeof calculateGoalProgress>[1]
  investimentos: Parameters<typeof calculateGoalProgress>[2]
  onSalvar: (valor: number) => void
}) {
  const prog = calculateGoalProgress(meta, leads, investimentos)
  const info = metricaInfo(meta.metrica)
  const st = statusDeProgresso(prog.valorAtual, meta.valorMeta, !!info.invertida)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(String(meta.valorMeta))
  const barra = st.status === 'success' ? 'bg-green-500' : st.status === 'atencao' ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="rounded-lg border border-border bg-bg-card p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">{metricaLabel(meta.metrica)}</p>
          <p className="text-[11px] text-muted">{escopoLabel(meta)}</p>
        </div>
        {!editando && (
          <button onClick={() => { setRascunho(String(meta.valorMeta)); setEditando(true) }} className="text-muted hover:text-brand-300" title="Editar meta">✏️</button>
        )}
      </div>
      {editando ? (
        <div className="flex items-center gap-1">
          <Input type="number" min={0} value={rascunho} onChange={(e) => setRascunho(e.target.value)} className="text-xs" />
          <button onClick={() => { const v = Number(rascunho); if (v > 0) onSalvar(v); setEditando(false) }} className="rounded border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-300">ok</button>
        </div>
      ) : (
        <>
          <div className="mb-1.5 flex items-baseline gap-1 text-xs">
            <span className="font-semibold text-zinc-100">{formatMetaValor(meta.metrica, prog.valorAtual)}</span>
            <span className="text-muted">/ {formatMetaValor(meta.metrica, meta.valorMeta)}</span>
            <span className="ml-auto text-[11px] tabular-nums text-muted">{Math.round(st.percentual)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-soft/60">
            <div className={`h-full rounded-full ${barra}`} style={{ width: `${Math.min(100, Math.max(0, st.percentual))}%` }} />
          </div>
        </>
      )}
    </div>
  )
}

function ViewTab({ label, ativo, onClick }: { label: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        ativo ? 'border-brand-500/50 bg-brand-500/15 text-brand-200' : 'border-border text-muted hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  )
}

function Bloco({ titulo, icon, cols4, children }: { titulo: string; icon: React.ReactNode; cols4?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span className="text-brand-300">{icon}</span> {titulo}
      </div>
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${cols4 ? 'lg:grid-cols-4' : 'lg:grid-cols-6'}`}>{children}</div>
    </section>
  )
}

function SubLinhas({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap gap-2">{children}</div>
}

function SubItem({ label, valor, tone = 'neutral', meta }: { label: string; valor: string; tone?: Tone; meta?: string }) {
  const cls: Record<string, string> = {
    neutral: 'text-zinc-200',
    success: 'text-green-300',
    danger: 'text-red-300',
    warning: 'text-orange-300',
    info: 'text-blue-300',
    attention: 'text-yellow-300',
    accent: 'text-brand-300',
    purple: 'text-purple-300',
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-card px-3 py-1.5 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${cls[tone]}`}>{valor}</span>
      {meta && <span className="text-[10px] text-muted">· {meta}</span>}
    </div>
  )
}

// ── Comparativo entre canais (bloco 5) ──────────────────────────────────────
type SortKey = 'canal' | 'investimento' | 'leads' | 'cpl' | 'mqlPct' | 'reunioesRealizadas' | 'fechamentos' | 'cac' | 'roasContrato'

function ComparativoCanais({
  rows,
  total,
  metasFn,
}: {
  rows: MarketingFunnel[]
  total: MarketingFunnel
  metasFn: (canal: string, campo: 'roasContrato' | 'cacAlvo') => number
}) {
  const [sortKey, setSortKey] = useState<SortKey>('roasContrato')
  const [asc, setAsc] = useState(false)

  const ordenados = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return asc ? cmp : -cmp
    })
    return arr
  }, [rows, sortKey, asc])

  function th(key: SortKey, label: string, align: 'left' | 'right' = 'right') {
    return (
      <th
        onClick={() => (sortKey === key ? setAsc((v) => !v) : (setSortKey(key), setAsc(false)))}
        className={`cursor-pointer select-none px-3 py-2 font-semibold hover:text-zinc-200 ${align === 'right' ? 'text-right' : 'text-left'}`}
        title="Ordenar"
      >
        {label}
        {sortKey === key && <span className="ml-1 text-brand-300">{asc ? '↑' : '↓'}</span>}
      </th>
    )
  }

  const cellRoas = (v: number, canal: string) => {
    const meta = metasFn(canal, 'roasContrato')
    const c = v >= meta ? 'text-green-300' : v < 1 ? 'text-red-300' : 'text-orange-300'
    return <span className={`font-semibold tabular-nums ${c}`}>{roas(v)}</span>
  }
  const cellCac = (v: number, canal: string, fech: number) => {
    if (fech === 0) return <span className="tabular-nums text-muted">—</span>
    const alvo = metasFn(canal, 'cacAlvo')
    const c = v <= alvo ? 'text-green-300' : 'text-red-300'
    return <span className={`font-semibold tabular-nums ${c}`}>{fmtBRL(v)}</span>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
      <table className="w-full text-xs" style={{ minWidth: 820 }}>
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
            {th('canal', 'Canal', 'left')}
            {th('investimento', 'Investimento')}
            {th('leads', 'Leads')}
            {th('cpl', 'CPL')}
            {th('mqlPct', 'MQL %')}
            {th('reunioesRealizadas', 'Reun. realizadas')}
            {th('fechamentos', 'Fechamentos')}
            {th('cac', 'CAC')}
            {th('roasContrato', 'ROAS contrato')}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((r) => (
            <tr key={r.canal} className="border-b border-border/60 last:border-b-0 hover:bg-bg-soft/40">
              <td className="px-3 py-2 text-zinc-200">
                {r.canal === SEM_ORIGEM ? (
                  <span className="inline-flex items-center gap-1 text-orange-300" title="Gap de rastreamento — corrigir o mapeamento no CRM">
                    ⚠ {SEM_ORIGEM}
                  </span>
                ) : (
                  r.canal
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{fmtBRL(r.investimento)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.leads}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{fmtBRL(r.cpl)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{pct(r.mqlPct)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.reunioesRealizadas}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.fechamentos}</td>
              <td className="px-3 py-2 text-right">{cellCac(r.cac, r.canal, r.fechamentos)}</td>
              <td className="px-3 py-2 text-right">{cellRoas(r.roasContrato, r.canal)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-bg-soft/40 font-semibold">
            <td className="px-3 py-2 text-zinc-100">TOTAL</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{fmtBRL(total.investimento)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{total.leads}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{fmtBRL(total.cpl)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{pct(total.mqlPct)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{total.reunioesRealizadas}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{total.fechamentos}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{total.fechamentos ? fmtBRL(total.cac) : '—'}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{roas(total.roasContrato)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Modal "Registrar Investimento do Mês" ──────────────────────────────────
function InvestimentoModal({
  open,
  onClose,
  periodo,
  canais,
  investimentosAtuais,
  onSalvar,
}: {
  open: boolean
  onClose: () => void
  periodo: string
  canais: string[]
  investimentosAtuais: { periodo: string; canal: string; valor: number }[]
  onSalvar: (lancamentos: { canal: string; valor: number }[]) => void
}) {
  const [valores, setValores] = useState<Record<string, string>>({})

  // Pré-preenche com o que já existe pra o período quando abre.
  const atuais = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of canais) {
      const found = investimentosAtuais.find((i) => i.periodo === periodo && i.canal === c)
      map[c] = found ? String(found.valor) : ''
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, periodo, canais.join('|')])

  const val = (c: string) => (valores[c] !== undefined ? valores[c] : (atuais[c] ?? ''))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Investimento do mês · ${periodo}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton
            size="sm"
            onClick={() =>
              onSalvar(
                canais.map((c) => ({ canal: c, valor: Number(val(c)) || 0 })).filter((l) => l.valor >= 0),
              )
            }
          >
            Salvar investimentos
          </PrimaryButton>
        </div>
      }
    >
      <p className="mb-3 text-[11px] text-muted">
        Lance o investimento de mídia de cada canal separadamente. Canais sem custo direto podem ficar zerados —
        continuam contando leads e fechamentos normalmente.
      </p>
      <div className="space-y-2">
        {canais.map((c) => (
          <div key={c} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-xs text-zinc-200">{c}</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted">R$</span>
              <Input
                type="number"
                min={0}
                value={val(c)}
                onChange={(e) => setValores((v) => ({ ...v, [c]: e.target.value }))}
                className="pl-8"
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
