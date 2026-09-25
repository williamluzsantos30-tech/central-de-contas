/**
 * Bloco "Taxas de Conversão Ideal entre Etapas" (Configurações › Geral ›
 * Metas Comerciais). Base do "Ideal Recalculado" nos cards de Comercial ›
 * Metas. Global + sobrescrita por canal ou por responsável (em branco =
 * herda o global), mesmo padrão das Metas de Marketing.
 */
import { useState } from 'react'
import { ArrowRight, Percent } from 'lucide-react'
import { Input } from '@/components/ds'
import { cn } from '@/lib/utils'
import { useComercial } from '@/pages/comercial/store'
import { EQUIPE_COMERCIAL } from '@/pages/comercial/mockLeads'
import type { TaxasConversaoIdeal, TaxasConversaoIdealValores } from '@/pages/comercial/mockComercialConfig'

type Campo = keyof TaxasConversaoIdealValores
type Grupo = 'overridesPorCanal' | 'overridesPorResponsavel'

const CANAIS = ['Meta Ads', 'Google Ads', 'Indicação', 'Social Selling', 'Inbound', 'Orgânico']
const CAMPOS: { key: Campo; label: string; curto: string }[] = [
  { key: 'sdr', label: 'Taxa Ideal SDR — Leads Qualificados → Reuniões Agendadas (%)', curto: 'SDR (%)' },
  { key: 'noShow', label: 'Taxa Ideal No-show (%)', curto: 'No-show (%)' },
  { key: 'closer', label: 'Taxa Ideal Closer — Reuniões Realizadas → Fechamentos (%)', curto: 'Closer (%)' },
]
// Cada papel só mexe nas taxas da sua etapa.
const PESSOAS: { id: string; nome: string; papel: string; campos: Campo[] }[] = [
  ...EQUIPE_COMERCIAL.sdrs.map((p) => ({ ...p, papel: 'SDR', campos: ['sdr'] as Campo[] })),
  ...EQUIPE_COMERCIAL.closers.map((p) => ({ ...p, papel: 'Closer', campos: ['noShow', 'closer'] as Campo[] })),
]

const pct = (v: number) => Math.min(100, Math.max(0, v))

export function TaxasConversaoIdealBloco() {
  const { taxasConversaoIdeal: t, setTaxasConversaoIdeal } = useComercial()
  const [aba, setAba] = useState<Grupo>('overridesPorCanal')

  const setGlobal = (campo: Campo, raw: string) => setTaxasConversaoIdeal({ ...t, [campo]: pct(Number(raw) || 0) })
  const setOverride = (grupo: Grupo, chave: string, campo: Campo, raw: string) => {
    const cur: Partial<TaxasConversaoIdealValores> = { ...(t[grupo][chave] ?? {}) }
    if (raw === '') delete cur[campo]
    else cur[campo] = pct(Number(raw) || 0)
    const mapa = { ...t[grupo], [chave]: cur }
    if (Object.keys(cur).length === 0) delete mapa[chave]
    setTaxasConversaoIdeal({ ...t, [grupo]: mapa } as TaxasConversaoIdeal)
  }

  // Leitura rápida da régua: 100 qualificados descendo o funil pelas taxas ideais.
  const agend = Math.round(100 * (t.sdr / 100))
  const real = Math.round(agend * (1 - t.noShow / 100))
  const fech = Math.round(real * (t.closer / 100))

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-1 flex items-center gap-2">
        <Percent size={14} className="text-brand-300" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Taxas de Conversão Ideal entre Etapas</p>
      </div>
      <p className="mb-3 text-[11px] text-muted">
        Base do <span className="text-zinc-300">Ideal Recalculado</span> nos cards de Comercial › Metas: cada etapa é
        cobrada a partir do <span className="text-zinc-300">realizado</span> da etapa anterior (não da meta dela).
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

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted">Sobrescrita (em branco = herda o global)</p>
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          {([
            ['overridesPorCanal', 'Por canal'],
            ['overridesPorResponsavel', 'Por responsável'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setAba(k)}
              className={cn(
                'rounded-md px-3 py-1 text-[11px] font-medium transition-colors',
                aba === k ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs" style={{ minWidth: 520 }}>
          <thead>
            <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-semibold">{aba === 'overridesPorCanal' ? 'Canal' : 'Responsável'}</th>
              {CAMPOS.map((c) => (
                <th key={c.key} className="px-3 py-2 font-semibold">{c.curto}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(aba === 'overridesPorCanal'
              ? CANAIS.map((c) => ({ chave: c, nome: c, papel: '', campos: CAMPOS.map((x) => x.key) }))
              : PESSOAS.map((p) => ({ chave: p.id, nome: p.nome, papel: p.papel, campos: p.campos }))
            ).map((row) => {
              const ov = t[aba][row.chave] ?? {}
              return (
                <tr key={row.chave} className="border-b border-border/60 last:border-b-0">
                  <td className="px-3 py-2 text-zinc-200">
                    {row.nome}
                    {row.papel && <span className="ml-1.5 text-[10px] text-muted">{row.papel}</span>}
                  </td>
                  {CAMPOS.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      {row.campos.includes(c.key) ? (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={ov[c.key] ?? ''}
                          onChange={(e) => setOverride(aba, row.chave, c.key, e.target.value)}
                          placeholder={String(t[c.key])}
                        />
                      ) : (
                        <span className="text-muted/60">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted">
        As sobrescritas valem nas metas segmentadas (por canal ou responsável). Prioridade: responsável › canal › global.
      </p>
    </div>
  )
}
