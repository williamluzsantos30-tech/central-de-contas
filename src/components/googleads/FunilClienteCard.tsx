/**
 * FunilClienteCard — mini-bloco "Funil deste Cliente" na Visão geral do
 * Operacional Tráfego. INDEPENDENTE da conexão Google Ads: lê as METAS
 * (tabela `metas`, resultado_data) do mês atual, somando Google + Meta.
 *
 * Leads qualificados = soma de mensagens_qualificadas (Google + Meta).
 * CAC = investimento total ÷ nº de consultas total (— se não houver consultas).
 */
import { useEffect, useState } from 'react'
import { Target, Users, Wallet, Stethoscope, Receipt } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { formatCurrency, monthKey } from '@/lib/utils'
import type { MetasValores } from '@/types/database'

const emptyValores: MetasValores = {
  investimento: null,
  custo_mensagem: null,
  mensagens_qualificadas: null,
  numero_consultas: null,
  tm_consulta: null,
  numero_procedimentos: null,
  tm_procedimento: null,
}

/** Aceita formato antigo (valores direto) e novo ({google, meta}). */
function normalize(raw: unknown): { google: MetasValores; meta: MetasValores } {
  const r = (raw ?? {}) as Record<string, unknown>
  if ('google' in r || 'meta' in r) {
    return {
      google: { ...emptyValores, ...((r.google ?? {}) as MetasValores) },
      meta: { ...emptyValores, ...((r.meta ?? {}) as MetasValores) },
    }
  }
  return { google: { ...emptyValores, ...(r as unknown as MetasValores) }, meta: { ...emptyValores } }
}

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n))

export function FunilClienteCard({ clienteId }: { clienteId: string }) {
  const [loading, setLoading] = useState(true)
  const [resultado, setResultado] = useState<unknown | null>(null)

  useEffect(() => {
    let vivo = true
    setLoading(true)
    supabase
      .from('metas')
      .select('resultado_data')
      .eq('cliente_id', clienteId)
      .eq('mes_ano', monthKey())
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return
        setResultado((data as { resultado_data: unknown } | null)?.resultado_data ?? null)
        setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [clienteId])

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
            <Target size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">🎯 Funil deste Cliente</p>
            <p className="mt-0.5 text-[11px] text-muted">Metas do mês atual (Google + Meta somados).</p>
          </div>
        </div>

        {loading ? (
          <p className="py-4 text-center text-xs text-muted">Carregando…</p>
        ) : resultado == null ? (
          <div className="rounded-lg border border-dashed border-border bg-bg-soft/30 px-4 py-6 text-center text-[11px] text-muted">
            Defina as metas deste cliente na aba Metas.
          </div>
        ) : (
          <Stats resultado={resultado} />
        )}
      </CardBody>
    </Card>
  )
}

function Stats({ resultado }: { resultado: unknown }) {
  const { google, meta } = normalize(resultado)

  const leads = (google.mensagens_qualificadas ?? 0) + (meta.mensagens_qualificadas ?? 0)
  const investimento = (google.investimento ?? 0) + (meta.investimento ?? 0)
  const consultas = (google.numero_consultas ?? 0) + (meta.numero_consultas ?? 0)
  const cac = consultas > 0 ? investimento / consultas : null

  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat icon={<Users size={12} className="text-sky-300" />} label="Leads qualificados" value={fmtNum(leads)} />
      <Stat
        icon={<Receipt size={12} className="text-emerald-300" />}
        label="CAC"
        value={cac !== null ? formatCurrency(cac) : '—'}
        tone="success"
      />
      <Stat
        icon={<Wallet size={12} className="text-sky-300" />}
        label="Investimento total"
        value={investimento > 0 ? formatCurrency(investimento) : '—'}
      />
      <Stat icon={<Stethoscope size={12} className="text-sky-300" />} label="Nº de consultas" value={fmtNum(consultas)} />
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'success'
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p
        className={
          tone === 'success'
            ? 'mt-1 text-lg font-bold tabular-nums text-emerald-300'
            : 'mt-1 text-lg font-bold tabular-nums text-zinc-100'
        }
      >
        {value}
      </p>
    </div>
  )
}
