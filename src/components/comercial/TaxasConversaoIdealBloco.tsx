/**
 * Seção "Taxas de Conversão Ideal entre Etapas" (Configurações › Geral, logo
 * abaixo das Metas de Marketing). Base do "Ideal Recalculado" nos cards de
 * Comercial › Marketing. Global + sobrescrita por canal (em branco = herda o
 * global), mesmo padrão das Metas de Marketing — a aba do canal no Marketing
 * usa a sobrescrita dele.
 */
import { ArrowRight, Percent } from 'lucide-react'
import { Input } from '@/components/ds'
import { useComercial } from '@/pages/comercial/store'
import type { TaxasConversaoIdealValores } from '@/pages/comercial/mockComercialConfig'

type Campo = keyof TaxasConversaoIdealValores

const CANAIS = ['Meta Ads', 'Google Ads', 'Indicação', 'Social Selling', 'Inbound', 'Orgânico']
const CAMPOS: { key: Campo; label: string; curto: string }[] = [
  { key: 'sdr', label: 'Taxa Ideal SDR — Leads Qualificados → Reuniões Agendadas (%)', curto: 'SDR (%)' },
  { key: 'noShow', label: 'Taxa Ideal No-show (%)', curto: 'No-show (%)' },
  { key: 'closer', label: 'Taxa Ideal Closer — Reuniões Realizadas → Fechamentos (%)', curto: 'Closer (%)' },
]

const pct = (v: number) => Math.min(100, Math.max(0, v))

export function TaxasConversaoIdealBloco() {
  const { taxasConversaoIdeal: t, setTaxasConversaoIdeal } = useComercial()

  const setGlobal = (campo: Campo, raw: string) => setTaxasConversaoIdeal({ ...t, [campo]: pct(Number(raw) || 0) })
  const setOverride = (canal: string, campo: Campo, raw: string) => {
    const cur: Partial<TaxasConversaoIdealValores> = { ...(t.overridesPorCanal[canal] ?? {}) }
    if (raw === '') delete cur[campo]
    else cur[campo] = pct(Number(raw) || 0)
    const mapa = { ...t.overridesPorCanal, [canal]: cur }
    if (Object.keys(cur).length === 0) delete mapa[canal]
    setTaxasConversaoIdeal({ ...t, overridesPorCanal: mapa })
  }

  // Leitura rápida da régua: 100 qualificados descendo o funil pelas taxas ideais.
  const agend = Math.round(100 * (t.sdr / 100))
  const real = Math.round(agend * (1 - t.noShow / 100))
  const fech = Math.round(real * (t.closer / 100))

  return (
    <section className="rounded-lg border border-border bg-bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Percent size={14} className="text-brand-300" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Taxas de Conversão Ideal entre Etapas</p>
      </div>
      <p className="mb-4 text-[11px] text-muted">
        Base do <span className="text-zinc-300">Ideal Recalculado</span> nos cards de Comercial › Marketing: cada etapa é
        cobrada a partir do <span className="text-zinc-300">realizado</span> da etapa anterior.
      </p>

      <div className="mb-2 grid grid-cols-1 items-end gap-3 md:grid-cols-3">
        {CAMPOS.map((c) => (
          <div key={c.key}>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{c.label}</label>
            <Input type="number" min={0} max={100} value={String(t[c.key])} onChange={(e) => setGlobal(c.key, e.target.value)} />
          </div>
        ))}
      </div>
      <p className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-muted">
        Régua: 100 qualificados <ArrowRight size={11} /> {agend} agendadas <ArrowRight size={11} /> {real} realizadas{' '}
        <ArrowRight size={11} /> {fech} fechamentos
      </p>

      <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">Sobrescrita por canal (em branco = herda o global)</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs" style={{ minWidth: 520 }}>
          <thead>
            <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-semibold">Canal</th>
              {CAMPOS.map((c) => (
                <th key={c.key} className="px-3 py-2 font-semibold">{c.curto}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CANAIS.map((canal) => {
              const ov = t.overridesPorCanal[canal] ?? {}
              return (
                <tr key={canal} className="border-b border-border/60 last:border-b-0">
                  <td className="px-3 py-2 text-zinc-200">{canal}</td>
                  {CAMPOS.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={ov[c.key] ?? ''}
                        onChange={(e) => setOverride(canal, c.key, e.target.value)}
                        placeholder={String(t[c.key])}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
