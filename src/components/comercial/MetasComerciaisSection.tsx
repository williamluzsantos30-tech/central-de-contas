/**
 * Bloco "Metas Comerciais" em Configurações › Geral. Tabs Mensal/Semanal +
 * "Nova Meta" + tabela + modal de criação/edição.
 */
import { useMemo, useState } from 'react'
import { Target, Plus } from 'lucide-react'
import { PrimaryButton } from '@/components/ds'
import { cn } from '@/lib/utils'
import { useComercial } from '@/pages/comercial/store'
import type { MetaComercial, Periodicidade } from '@/pages/comercial/mockMetasComerciais'
import { MetasComerciaisTable } from './MetasComerciaisTable'
import { MetaFormModal } from './MetaFormModal'
import { TaxasConversaoIdealBloco } from './TaxasConversaoIdealBloco'

export function MetasComerciaisSection() {
  const { metasComerciais } = useComercial()
  const [aba, setAba] = useState<Periodicidade>('mensal')
  const [form, setForm] = useState<{ open: boolean; meta: MetaComercial | null }>({ open: false, meta: null })

  const doTipo = useMemo(() => metasComerciais.filter((m) => m.periodicidade === aba), [metasComerciais, aba])

  return (
    <section className="rounded-lg border border-border bg-bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-brand-300" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Metas Comerciais</p>
        </div>
        <PrimaryButton size="sm" onClick={() => setForm({ open: true, meta: null })}>
          <Plus size={13} /> Nova Meta
        </PrimaryButton>
      </div>

      <div className="mb-3 inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
        {(['mensal', 'semanal'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
              aba === k ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200',
            )}
          >
            {k === 'mensal' ? 'Metas Mensais' : 'Metas Semanais'}
          </button>
        ))}
      </div>

      <MetasComerciaisTable metas={doTipo} onEdit={(m) => setForm({ open: true, meta: m })} />

      <TaxasConversaoIdealBloco />

      <MetaFormModal
        open={form.open}
        onClose={() => setForm({ open: false, meta: null })}
        meta={form.meta}
        periodicidadePadrao={aba}
      />
    </section>
  )
}
