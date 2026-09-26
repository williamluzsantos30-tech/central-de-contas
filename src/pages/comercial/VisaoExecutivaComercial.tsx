/**
 * Comercial › Visão Executiva — funil de vendas, conversão por etapa,
 * gargalos, performance por pessoa e motivos de perda. Tudo derivado dos
 * leads (mockLeads) em tempo real; nada agregado hardcoded.
 */
import { useMemo, useState } from 'react'
import { Inbox, Target, Handshake, DollarSign, TrendingUp, Clock } from 'lucide-react'
import { PageHeader, KPICard, Select } from '@/components/ds'
import { fmtBRL } from '@/components/comercial/LeadsTable'
import { FunnelChart, type FunnelEtapa } from '@/components/comercial/FunnelChart'
import { BottleneckAlert, type Gargalo } from '@/components/comercial/BottleneckAlert'
import { LossReasonsChart } from '@/components/comercial/LossReasonsChart'
import { useComercial } from './store'
import { EQUIPE_COMERCIAL, type Lead } from './mockLeads'
import { calculateLeadSLA, formatDuracao } from './sla'
import { mesAnterior } from './marketingCalculator'

type Periodo = 'mes' | 'trimestre' | 'tudo' | 'custom'

const DIA_MS = 86_400_000

function diasEntre(aIso?: string, bIso?: string): number | null {
  if (!aIso || !bIso) return null
  const a = Date.parse(aIso.slice(0, 10))
  const b = Date.parse(bIso.slice(0, 10))
  if (isNaN(a) || isNaN(b)) return null
  return Math.max(0, (b - a) / DIA_MS)
}

/** 6 KPIs escalares do topo (reusado pro período atual e o anterior). */
function kpiScalars(leads: Lead[], inPeriodo: (iso?: string) => boolean) {
  const teveCall = (l: Lead) =>
    l.etapaFunil === 'em_negociacao' || l.etapaFunil === 'fechado' || (l.etapaFunil === 'perdido' && !!l.motivoPerda)
  const recebidos = leads.filter((l) => inPeriodo(l.dataEntrada))
  const qualificados = recebidos.filter((l) => l.qualificado)
  const reunioes = recebidos.filter(teveCall)
  const fechados = recebidos.filter((l) => l.etapaFunil === 'fechado')
  const receita = fechados.reduce((s, l) => s + (l.mrr ?? 0), 0)
  const ciclos = fechados.map((l) => diasEntre(l.dataEntrada, l.dataFechamento)).filter((x): x is number => x != null)
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)
  return {
    recebidos: recebidos.length,
    taxaQualificacao: pct(qualificados.length, recebidos.length),
    taxaFechamento: pct(fechados.length, reunioes.length),
    ticketMedio: fechados.length ? receita / fechados.length : 0,
    receita,
    cicloMedio: ciclos.length ? ciclos.reduce((s, x) => s + x, 0) / ciclos.length : 0,
  }
}

export default function VisaoExecutivaComercial() {
  const { leads, slaConfig } = useComercial()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const { inPeriodo, inPeriodoAnterior } = useMemo(() => {
    const now = new Date()
    const mesAtual = now.toISOString().slice(0, 7)
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
    const inPeriodo = (iso?: string): boolean => {
      if (!iso) return false
      const d = iso.slice(0, 10)
      if (periodo === 'tudo') return true
      if (periodo === 'custom') return (!de || d >= de) && (!ate || d <= ate)
      if (periodo === 'mes') return d.slice(0, 7) === mesAtual
      const dt = new Date(d + 'T12:00:00')
      return dt >= qStart && dt <= qEnd
    }
    // Período anterior equivalente — só pra mês e intervalo custom.
    let inPeriodoAnterior: ((iso?: string) => boolean) | null = null
    if (periodo === 'mes') {
      const mesAnt = mesAnterior(mesAtual)
      inPeriodoAnterior = (iso) => !!iso && iso.slice(0, 7) === mesAnt
    } else if (periodo === 'custom' && (de || ate)) {
      const d0 = new Date((de || ate) + 'T12:00:00')
      const d1 = new Date((ate || de) + 'T12:00:00')
      const dias = Math.max(0, Math.round((d1.getTime() - d0.getTime()) / DIA_MS)) + 1
      const antAte = new Date(d0)
      antAte.setDate(antAte.getDate() - 1)
      const antDe = new Date(antAte)
      antDe.setDate(antDe.getDate() - (dias - 1))
      const deA = antDe.toISOString().slice(0, 10)
      const ateA = antAte.toISOString().slice(0, 10)
      inPeriodoAnterior = (iso) => !!iso && iso.slice(0, 10) >= deA && iso.slice(0, 10) <= ateA
    }
    return { inPeriodo, inPeriodoAnterior }
  }, [periodo, de, ate])

  const kAnt = useMemo(
    () => (inPeriodoAnterior ? kpiScalars(leads, inPeriodoAnterior) : null),
    [leads, inPeriodoAnterior],
  )

  const m = useMemo(() => {
    // Coorte: leads que ENTRARAM no funil (Caixa) dentro do período.
    const recebidos = leads.filter((l) => inPeriodo(l.dataEntrada))
    const teveCall = (l: Lead) =>
      l.etapaFunil === 'em_negociacao' || l.etapaFunil === 'fechado' || (l.etapaFunil === 'perdido' && !!l.motivoPerda)
    const qualificados = recebidos.filter((l) => l.qualificado)
    const reunioes = recebidos.filter(teveCall)
    const emNeg = recebidos.filter((l) => l.etapaFunil === 'em_negociacao')
    const fechados = recebidos.filter((l) => l.etapaFunil === 'fechado')

    const receita = fechados.reduce((s, l) => s + (l.mrr ?? 0), 0)
    const ticketMedio = fechados.length ? receita / fechados.length : 0
    const ciclos = fechados.map((l) => diasEntre(l.dataEntrada, l.dataFechamento)).filter((x): x is number => x != null)
    const cicloMedio = ciclos.length ? ciclos.reduce((s, x) => s + x, 0) / ciclos.length : 0

    const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)

    const funil: FunnelEtapa[] = [
      { label: 'Caixa de Entrada', count: recebidos.length, convPct: null },
      { label: 'Qualificados (SQL)', count: qualificados.length, convPct: pct(qualificados.length, recebidos.length) },
      { label: 'Reunião Realizada', count: reunioes.length, convPct: pct(reunioes.length, qualificados.length) },
      { label: 'Em Negociação/Follow-up', count: emNeg.length, convPct: pct(emNeg.length, reunioes.length) },
      { label: 'Fechado', count: fechados.length, convPct: pct(fechados.length, reunioes.length) },
    ]

    // Gargalo: transição com maior % de perda; tempo médio = média de dias
    // parados dos leads atualmente na etapa "de".
    const transicoes: { etapa: string; prev: number; next: number; fromEtapas: Lead['etapaFunil'][] }[] = [
      { etapa: 'Caixa → Qualificação (SDR)', prev: recebidos.length, next: qualificados.length, fromEtapas: ['caixa_entrada', 'em_qualificacao'] },
      { etapa: 'Qualificação → Reunião (Closer)', prev: qualificados.length, next: reunioes.length, fromEtapas: ['reuniao_agendada'] },
      { etapa: 'Reunião → Negociação', prev: reunioes.length, next: emNeg.length + fechados.length, fromEtapas: ['em_negociacao'] },
      { etapa: 'Negociação → Fechamento', prev: emNeg.length + fechados.length, next: fechados.length, fromEtapas: ['em_negociacao'] },
    ]
    let gargalo: Gargalo | null = null
    for (const t of transicoes) {
      if (t.prev <= 0) continue
      const perdaPct = ((t.prev - t.next) / t.prev) * 100
      if (perdaPct <= 0) continue
      const naEtapa = leads.filter((l) => t.fromEtapas.includes(l.etapaFunil))
      const dias = naEtapa
        .map((l) => calculateLeadSLA(l, slaConfig))
        .filter((s) => s.aplicavel)
        .map((s) => s.decorridoMs / DIA_MS)
      const tempoMedio = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : cicloMedio
      if (!gargalo || perdaPct > gargalo.perdaPct) gargalo = { etapa: t.etapa, perdaPct, tempoMedioDias: tempoMedio }
    }

    // Motivos de perda agregados (perda do Closer + desqualificação do SDR).
    const motivos = new Map<string, number>()
    for (const l of recebidos) {
      const mv = l.motivoPerda ?? l.motivoDesqualificacao
      if (l.etapaFunil === 'perdido' && mv) motivos.set(mv, (motivos.get(mv) ?? 0) + 1)
    }
    const motivosPerda = Array.from(motivos.entries())
      .map(([motivo, qtd]) => ({ motivo, qtd }))
      .sort((a, b) => b.qtd - a.qtd)

    return {
      recebidos: recebidos.length,
      taxaQualificacao: pct(qualificados.length, recebidos.length),
      taxaFechamento: pct(fechados.length, reunioes.length),
      ticketMedio,
      receita,
      cicloMedio,
      funil,
      gargalo,
      motivosPerda,
      cohort: recebidos,
    }
  }, [leads, slaConfig, inPeriodo])

  const performance = useMemo(() => buildPerformance(m.cohort, slaConfig), [m.cohort, slaConfig])

  return (
    <div>
      <PageHeader
        title="Visão Executiva — Comercial"
        description="Funil de vendas, conversão por etapa e gargalos"
        actions={
          <div className="flex items-center gap-2">
            <Select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="w-40">
              <option value="mes">Este mês</option>
              <option value="trimestre">Trimestre</option>
              <option value="tudo">Tudo</option>
              <option value="custom">Personalizado</option>
            </Select>
            {periodo === 'custom' && (
              <>
                <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs text-zinc-100" />
                <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs text-zinc-100" />
              </>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard label="Leads recebidos" value={String(m.recebidos)} icon={<Inbox size={13} />} tone="accent" sub="entraram na Caixa" valorAtual={m.recebidos} valorAnterior={kAnt?.recebidos} direcaoFavoravel="maior" />
        <KPICard label="Taxa de qualificação" value={`${m.taxaQualificacao.toFixed(0)}%`} icon={<Target size={13} />} tone="info" sub="viram SQL" valorAtual={m.taxaQualificacao} valorAnterior={kAnt?.taxaQualificacao} direcaoFavoravel="maior" />
        <KPICard label="Taxa de fechamento" value={`${m.taxaFechamento.toFixed(0)}%`} icon={<Handshake size={13} />} tone="success" sub="reuniões que fecham" valorAtual={m.taxaFechamento} valorAnterior={kAnt?.taxaFechamento} direcaoFavoravel="maior" />
        <KPICard label="Ticket médio fechado" value={fmtBRL(m.ticketMedio)} icon={<DollarSign size={13} />} tone="neutral" sub="média (MRR) dos fechados" valorAtual={m.ticketMedio} valorAnterior={kAnt?.ticketMedio} direcaoFavoravel="maior" />
        <KPICard label="Receita gerada" value={fmtBRL(m.receita)} icon={<TrendingUp size={13} />} tone="success" sub="MRR dos fechados" valorAtual={m.receita} valorAnterior={kAnt?.receita} direcaoFavoravel="maior" />
        <KPICard label="Ciclo médio de venda" value={`${m.cicloMedio.toFixed(1)}d`} icon={<Clock size={13} />} tone="neutral" sub="entrada → fechamento" valorAtual={m.cicloMedio} valorAnterior={kAnt?.cicloMedio} direcaoFavoravel="menor" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-zinc-100">Funil de conversão</h3>
          <FunnelChart etapas={m.funil} />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">Gargalos do funil</h3>
            <BottleneckAlert gargalo={m.gargalo} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Performance por pessoa (sem ranking — só números operacionais) */}
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-100">Performance por etapa/pessoa</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 460 }}>
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-2 py-2 font-semibold">Nome</th>
                  <th className="px-2 py-2 font-semibold">Papel</th>
                  <th className="px-2 py-2 font-semibold text-right">Leads</th>
                  <th className="px-2 py-2 font-semibold text-right">Conversão</th>
                  <th className="px-2 py-2 font-semibold text-right">SLA médio</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-2 py-2 text-zinc-200">{p.nome}</td>
                    <td className="px-2 py-2 text-muted">{p.papel}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-zinc-200">{p.leads}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-zinc-200">{p.leads ? `${p.conversao.toFixed(0)}%` : '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted">{p.slaMedio}</td>
                  </tr>
                ))}
                {performance.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-6 text-center text-muted">Sem dados no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Motivos de perda */}
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-100">Motivos de perda</h3>
          <LossReasonsChart dados={m.motivosPerda} />
        </div>
      </div>
    </div>
  )
}

interface PerfRow {
  id: string
  nome: string
  papel: string
  leads: number
  conversao: number
  slaMedio: string
}

function buildPerformance(cohort: Lead[], slaConfig: Parameters<typeof calculateLeadSLA>[1]): PerfRow[] {
  const rows: PerfRow[] = []

  for (const p of EQUIPE_COMERCIAL.socialSellers) {
    const meus = cohort.filter((l) => l.socialSellerId === p.id)
    if (meus.length === 0) continue
    const enviados = meus.filter((l) => l.etapaFunil !== 'prospectado').length
    rows.push({ id: p.id, nome: p.nome, papel: 'Social Seller', leads: meus.length, conversao: (enviados / meus.length) * 100, slaMedio: '—' })
  }
  for (const p of EQUIPE_COMERCIAL.sdrs) {
    const meus = cohort.filter((l) => l.sdrId === p.id)
    if (meus.length === 0) continue
    const q = meus.filter((l) => l.qualificado).length
    rows.push({ id: p.id, nome: p.nome, papel: 'SDR', leads: meus.length, conversao: (q / meus.length) * 100, slaMedio: mediaSla(meus, slaConfig) })
  }
  for (const p of EQUIPE_COMERCIAL.closers) {
    const meus = cohort.filter((l) => l.closerId === p.id)
    if (meus.length === 0) continue
    const fez = meus.filter((l) => l.etapaFunil === 'fechado').length
    rows.push({ id: p.id, nome: p.nome, papel: 'Closer', leads: meus.length, conversao: (fez / meus.length) * 100, slaMedio: mediaSla(meus, slaConfig) })
  }
  return rows
}

function mediaSla(leads: Lead[], slaConfig: Parameters<typeof calculateLeadSLA>[1]): string {
  const ativos = leads.map((l) => calculateLeadSLA(l, slaConfig)).filter((s) => s.aplicavel)
  if (ativos.length === 0) return '—'
  const media = ativos.reduce((s, x) => s + x.decorridoMs, 0) / ativos.length
  return formatDuracao(media)
}
