/**
 * Bloco "Metas do Período" — acompanhamento visual das Metas Comerciais na
 * Visão Executiva. Alterna Esta Semana / Este Mês (semana navegável) e
 * renderiza um GoalProgressCard por meta do período/escopo.
 */
import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useComercial } from '@/pages/comercial/store'
import { weekRefOf } from '@/pages/comercial/marketingCalculator'
import { calculateGoalProgress } from '@/pages/comercial/metasComerciais'
import { GoalProgressCard } from './GoalProgressCard'
import { WeekNavigator } from './WeekNavigator'

const mesAtual = new Date().toISOString().slice(0, 7)

export function MetasAcompanhamento() {
  const { metasComerciais, leads, investimentos } = useComercial()
  const [visao, setVisao] = useState<'semana' | 'mes'>('mes')
  const [semanaRef, setSemanaRef] = useState(weekRefOf())

  const metas = useMemo(() => {
    if (visao === 'mes') return metasComerciais.filter((m) => m.periodicidade === 'mensal' && m.periodoReferencia === mesAtual)
    return metasComerciais.filter((m) => m.periodicidade === 'semanal' && m.periodoReferencia === semanaRef)
  }, [metasComerciais, visao, semanaRef])

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
          <Target size={14} className="text-brand-300" /> Metas do Período
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {visao === 'semana' && <WeekNavigator semanaRef={semanaRef} onChange={setSemanaRef} />}
          <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
            {(['semana', 'mes'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setVisao(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                  visao === k ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200',
                )}
              >
                {k === 'semana' ? 'Esta Semana' : 'Este Mês'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {metas.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">
          Nenhuma meta {visao === 'semana' ? 'semanal' : 'mensal'} cadastrada para este período. Configure em
          Configurações › Geral › Metas Comerciais.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metas.map((m) => (
            <GoalProgressCard key={m.id} meta={m} progress={calculateGoalProgress(m, leads, investimentos)} />
          ))}
        </div>
      )}
    </div>
  )
}
