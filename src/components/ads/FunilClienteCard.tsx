/**
 * FunilClienteCard — "Funil deste Cliente" na Visão geral do Operacional
 * Tráfego, no período da ficha, Google + Meta somados.
 *
 * Todos os números vêm de getClientTrafficSummary(...).total — a MESMA fonte
 * das abas Google Ads / Meta Ads e do Realizado da aba Metas. Nada de dado
 * próprio: plataforma desconectada conta 0 (e é sinalizada); leads
 * qualificados e consultas (fechamentos, base do CAC) vêm do funil do cliente
 * registrado na aba Metas — o módulo Comercial não é fonte (lá são os leads
 * da própria agência).
 */
import { useEffect, useState } from 'react'
import { ArrowRight, Receipt, RefreshCw, Stethoscope, Target, Users, Wallet } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import {
  funilDoRealizado,
  getClientTrafficSummary,
  NOME_PLATAFORMA_TRAFEGO,
  PLATAFORMAS_TRAFEGO,
  rotuloPeriodo,
} from '@/lib/traffic/summary'
import type { Cliente, MetasValores } from '@/types/database'

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n))

export function FunilClienteCard({
  cliente,
  periodo,
  onIrParaMetas,
}: {
  cliente: Cliente
  /** Período da ficha (YYYY-MM-01) — o mesmo das abas de plataforma e de Metas. */
  periodo: string
  onIrParaMetas: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [realizado, setRealizado] = useState<Partial<Record<'google' | 'meta', MetasValores>> | null>(null)

  useEffect(() => {
    let vivo = true
    setLoading(true)
    supabase
      .from('metas')
      .select('resultado_data')
      .eq('cliente_id', cliente.id)
      .eq('mes_ano', periodo)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return
        setRealizado(((data as { resultado_data: Partial<Record<'google' | 'meta', MetasValores>> } | null)?.resultado_data ?? null))
        setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [cliente.id, periodo])

  const resumo = getClientTrafficSummary(cliente.id, periodo, { funil: funilDoRealizado(realizado) })
  const { total, plataformasAusentes } = resumo
  const nenhumaConectada = plataformasAusentes.length === PLATAFORMAS_TRAFEGO.length
  const conectadas = PLATAFORMAS_TRAFEGO.filter((p) => !plataformasAusentes.includes(p))
  const origem = conectadas.map((p) => NOME_PLATAFORMA_TRAFEGO[p]).join(' + ')
  const ausentesTxt = plataformasAusentes.map((p) => NOME_PLATAFORMA_TRAFEGO[p]).join(' e ')

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
            <Target size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">🎯 Funil deste Cliente</p>
            <p className="mt-0.5 text-[11px] text-muted">{rotuloPeriodo(periodo)} · Google + Meta somados.</p>
          </div>
        </div>

        {loading ? (
          <p className="py-4 text-center text-xs text-muted">Carregando…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Users size={12} className="text-sky-300" />}
              label="Leads qualificados"
              valor={total.leadsQualificados != null ? fmtNum(total.leadsQualificados) : null}
              sub={nenhumaConectada ? undefined : `${fmtNum(total.leads)} leads nas plataformas`}
              onPreencher={total.leadsQualificados == null ? onIrParaMetas : undefined}
            />
            <Stat
              icon={<Receipt size={12} className="text-emerald-300" />}
              label="CAC"
              valor={total.cac != null ? formatCurrency(total.cac) : null}
              semValorTitulo="Sem conversões no período"
              tone="success"
            />
            <Stat
              icon={<Wallet size={12} className="text-sky-300" />}
              label="Investimento total"
              valor={nenhumaConectada ? null : formatCurrency(total.investimento)}
              sub={
                nenhumaConectada
                  ? 'Conecte Google Ads ou Meta Ads'
                  : plataformasAusentes.length
                    ? `${origem} · ${ausentesTxt} não conectado (conta 0)`
                    : origem
              }
              semValorTitulo="Nenhuma plataforma conectada"
              sincronizado={!nenhumaConectada}
            />
            <Stat
              icon={<Stethoscope size={12} className="text-sky-300" />}
              label="Nº de consultas"
              valor={total.conversoes != null ? fmtNum(total.conversoes) : null}
              onPreencher={onIrParaMetas}
            />
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function Stat({
  icon,
  label,
  valor,
  sub,
  tone,
  sincronizado,
  onPreencher,
  semValorTitulo,
}: {
  icon: React.ReactNode
  label: string
  /** null = sem dado (diferente de 0). */
  valor: string | null
  sub?: string
  tone?: 'success'
  sincronizado?: boolean
  onPreencher?: () => void
  semValorTitulo?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
        {sincronizado && valor != null && <RefreshCw size={9} className="text-emerald-400" aria-label="Vem das plataformas" />}
      </div>
      {valor != null ? (
        <p className={cn('mt-1 text-lg font-bold tabular-nums', tone === 'success' ? 'text-emerald-300' : 'text-zinc-100')}>{valor}</p>
      ) : (
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-muted" title={semValorTitulo ?? 'Ainda não informado'}>
            —
          </span>
          {onPreencher && (
            <button type="button" onClick={onPreencher} className="inline-flex items-center gap-0.5 text-[11px] text-brand-300 hover:underline">
              Preencher em Metas <ArrowRight size={10} />
            </button>
          )}
        </p>
      )}
      {sub && <p className="mt-0.5 truncate text-[10px] text-muted" title={sub}>{sub}</p>}
    </div>
  )
}
