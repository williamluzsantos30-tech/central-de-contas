/**
 * Comercial › Metas — board no estilo da planilha de Marketing: blocos de
 * cards por métrica do funil, cada um mostrando Realizado vs Meta + % e barra.
 * Seletor Mês/Semana (semana navegável) e "Nova Meta". Metas com escopo de
 * canal/responsável aparecem numa seção própria abaixo.
 */
import { useMemo, useState } from 'react'
import { Plus, Megaphone, DollarSign, Users2 } from 'lucide-react'
import { PageHeader, PrimaryButton } from '@/components/ds'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/comercial/Breadcrumb'
import { WeekNavigator } from '@/components/comercial/WeekNavigator'
import { GoalProgressCard } from '@/components/comercial/GoalProgressCard'
import { MetaFormModal } from '@/components/comercial/MetaFormModal'
import { useComercial } from './store'
import { calculateMarketingFunnel, periodoMes, periodoSemana, weekRefOf } from './marketingCalculator'
import { calculateGoalProgress, metricaValor, statusDeProgresso, type StatusMeta } from './metasComerciais'
import {
  formatMetaValor,
  metricaInfo,
  type MetaComercial,
  type MetricaMeta,
} from './mockMetasComerciais'

const BLOCOS: { titulo: string; icon: React.ReactNode; metricas: MetricaMeta[] }[] = [
  { titulo: 'Topo de funil', icon: <Megaphone size={13} />, metricas: ['leads', 'leads_qualificados'] },
  { titulo: 'Reuniões', icon: <Megaphone size={13} />, metricas: ['reunioes_agendadas', 'reunioes_realizadas', 'taxa_agendamento', 'no_show_max'] },
  { titulo: 'Fechamentos e receita', icon: <DollarSign size={13} />, metricas: ['fechamentos', 'taxa_conversao', 'mrr', 'caixa_recolhido', 'contrato_fechado'] },
]

const txt: Record<StatusMeta, string> = { success: 'text-green-300', atencao: 'text-orange-300', critico: 'text-red-300' }
const barra: Record<StatusMeta, string> = { success: 'bg-green-500', atencao: 'bg-orange-500', critico: 'bg-red-500' }
const badge: Record<StatusMeta, { label: string; cls: string }> = {
  success: { label: 'Excelente', cls: 'border-green-500/40 bg-green-500/10 text-green-300' },
  atencao: { label: 'Atenção', cls: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  critico: { label: 'Crítico', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
}

export default function MetasPanel() {
  const { leads, investimentos, metasComerciais } = useComercial()
  const [visao, setVisao] = useState<'mes' | 'semana'>('mes')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [semanaRef, setSemanaRef] = useState(weekRefOf())
  const [formOpen, setFormOpen] = useState(false)
  const [metaEdit, setMetaEdit] = useState<MetaComercial | null>(null)

  const periodicidade = visao === 'semana' ? 'semanal' : 'mensal'
  const ref = visao === 'semana' ? semanaRef : mes
  const periodo = useMemo(() => (visao === 'semana' ? periodoSemana(semanaRef) : periodoMes(mes)), [visao, semanaRef, mes])

  // Realizado (Geral) do período.
  const f = useMemo(() => calculateMarketingFunnel(leads, investimentos, periodo), [leads, investimentos, periodo])

  // Metas do período selecionado.
  const metasDoPeriodo = useMemo(
    () => metasComerciais.filter((m) => m.periodicidade === periodicidade && m.periodoReferencia === ref),
    [metasComerciais, periodicidade, ref],
  )
  const metaGeralDe = (metrica: MetricaMeta) =>
    metasDoPeriodo.find((m) => m.metrica === metrica && !m.canal && !m.responsavelId)
  const metasEscopo = metasDoPeriodo.filter((m) => m.canal || m.responsavelId)

  function abrirNova() {
    setMetaEdit(null)
    setFormOpen(true)
  }

  return (
    <div>
      <Breadcrumb trilha={['Comercial', 'Metas']} />
      <PageHeader
        title="Metas"
        description="Metas comerciais do período — realizado vs. meta por métrica"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {visao === 'semana' ? (
              <WeekNavigator semanaRef={semanaRef} onChange={setSemanaRef} />
            ) : (
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs text-zinc-100" />
            )}
            <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
              {(['mes', 'semana'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setVisao(k)}
                  className={cn('rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors', visao === k ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200')}
                >
                  {k === 'mes' ? 'Mensal' : 'Semanal'}
                </button>
              ))}
            </div>
            <PrimaryButton size="sm" onClick={abrirNova}>
              <Plus size={14} /> Nova Meta
            </PrimaryButton>
          </div>
        }
      />

      {BLOCOS.map((bloco) => (
        <section key={bloco.titulo} className="mb-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="text-brand-300">{bloco.icon}</span> {bloco.titulo}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {bloco.metricas.map((metrica) => (
              <MetaKpiCard key={metrica} metrica={metrica} realizado={metricaValor(f, metrica)} meta={metaGeralDe(metrica)} />
            ))}
          </div>
        </section>
      ))}

      {/* Metas específicas (por canal ou responsável) */}
      {metasEscopo.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Users2 size={14} className="text-brand-300" /> Metas por canal / responsável
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metasEscopo.map((m) => (
              <GoalProgressCard key={m.id} meta={m} progress={calculateGoalProgress(m, leads, investimentos)} />
            ))}
          </div>
        </section>
      )}

      {metasDoPeriodo.length === 0 && (
        <p className="mt-2 rounded-lg border border-dashed border-border bg-bg-soft/30 p-6 text-center text-xs text-muted">
          Nenhuma meta {periodicidade === 'mensal' ? 'mensal' : 'semanal'} definida para este período. Os cards mostram o
          realizado; clique em <strong className="text-zinc-300">Nova Meta</strong> para definir os alvos.
        </p>
      )}

      <MetaFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setMetaEdit(null)
        }}
        meta={metaEdit}
        periodicidadePadrao={periodicidade}
        mesPadrao={mes}
        semanaPadrao={semanaRef}
      />
    </div>
  )
}

function MetaKpiCard({ metrica, realizado, meta }: { metrica: MetricaMeta; realizado: number; meta?: MetaComercial }) {
  const info = metricaInfo(metrica)
  const prog = meta ? statusDeProgresso(realizado, meta.valorMeta, !!info.invertida) : null
  const larguraBar = prog ? Math.min(100, Math.max(0, prog.percentual)) : 0
  return (
    <div className="rounded-lg border border-border bg-bg-card px-4 py-3.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{info.label}</p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-2xl font-bold leading-none tabular-nums text-zinc-100">{formatMetaValor(metrica, realizado)}</p>
        {meta && <span className="text-[11px] text-muted">/ {formatMetaValor(metrica, meta.valorMeta)}</span>}
        {prog && !info.invertida && <span className={cn('text-xs font-bold tabular-nums', txt[prog.status])}>{Math.round(prog.percentual)}%</span>}
        {prog && info.invertida && (
          <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', badge[prog.status].cls)}>{badge[prog.status].label}</span>
        )}
      </div>
      {meta ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-soft/60">
          <div className={cn('h-full rounded-full transition-all', barra[prog!.status])} style={{ width: `${larguraBar}%` }} />
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] text-muted">sem meta definida</p>
      )}
    </div>
  )
}
