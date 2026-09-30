/**
 * FunilClienteCard — "Funil deste Cliente" na Visão geral do Operacional
 * Tráfego, mês atual, Google + Meta somados.
 *
 * Investimento vem das INTEGRAÇÕES (Google Ads / Meta Ads) quando conectadas;
 * sem integração, do Realizado digitado na aba Metas. Leads qualificados, nº
 * de consultas e CAC dependem de dado manual (aba Metas / CRM): sem dado,
 * mostra "Preencher em Metas →" — nunca um 0 que parece resultado.
 */
import { useEffect, useState } from 'react'
import { ArrowRight, Receipt, RefreshCw, Stethoscope, Target, Users, Wallet } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, monthKey } from '@/lib/utils'
import { midiaDoMes, NOME_PLATAFORMA, registrarVerbasCliente, type PlataformaMetas } from '@/lib/trafegoCliente'
import { resultadoEfetivo, VALORES_VAZIOS } from '@/components/metas/metasTabela'
import type { Cliente, MetasValores } from '@/types/database'

/** Aceita formato antigo (valores direto) e novo ({google, meta}). */
function normalize(raw: unknown): Record<PlataformaMetas, MetasValores> {
  const r = (raw ?? {}) as Record<string, unknown>
  if ('google' in r || 'meta' in r) {
    return {
      google: { ...VALORES_VAZIOS, ...((r.google ?? {}) as MetasValores) },
      meta: { ...VALORES_VAZIOS, ...((r.meta ?? {}) as MetasValores) },
    }
  }
  return { google: { ...VALORES_VAZIOS, ...(r as unknown as MetasValores) }, meta: { ...VALORES_VAZIOS } }
}

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n))
/** Soma que distingue "sem dado" (null) de zero de verdade. */
const soma = (a: number | null | undefined, b: number | null | undefined) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0))

export function FunilClienteCard({ cliente, onIrParaMetas }: { cliente: Cliente; onIrParaMetas: () => void }) {
  const [loading, setLoading] = useState(true)
  const [resultado, setResultado] = useState<unknown | null>(null)

  useEffect(() => {
    let vivo = true
    setLoading(true)
    supabase
      .from('metas')
      .select('resultado_data')
      .eq('cliente_id', cliente.id)
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
  }, [cliente.id])

  registrarVerbasCliente(cliente)
  const periodo = monthKey().slice(0, 7)
  const res = normalize(resultado)
  const midia = {
    google: midiaDoMes(cliente.id, 'google', periodo, res.google),
    meta: midiaDoMes(cliente.id, 'meta', periodo, res.meta),
  }
  const ef = { google: resultadoEfetivo(res.google, midia.google), meta: resultadoEfetivo(res.meta, midia.meta) }

  const investimento = soma(ef.google.investimento, ef.meta.investimento)
  const leads = soma(ef.google.mensagens_qualificadas, ef.meta.mensagens_qualificadas)
  const consultas = soma(ef.google.numero_consultas, ef.meta.numero_consultas)
  const cac = investimento != null && consultas ? investimento / consultas : null
  const conectadas = (['google', 'meta'] as const).filter((p) => midia[p].conectado)
  // Origem por plataforma que tem dado — ex.: "Google Ads (integração) + Meta Ads (manual)".
  const origemInvest = (['google', 'meta'] as const)
    .filter((p) => midia[p].origem)
    .map((p) => `${NOME_PLATAFORMA[p]} (${midia[p].origem === 'integracao' ? 'integração' : 'manual'})`)
    .join(' + ')

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
            <Target size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">🎯 Funil deste Cliente</p>
            <p className="mt-0.5 text-[11px] text-muted">Mês atual · Google + Meta somados.</p>
          </div>
        </div>

        {loading ? (
          <p className="py-4 text-center text-xs text-muted">Carregando…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Users size={12} className="text-sky-300" />} label="Leads qualificados" valor={leads != null ? fmtNum(leads) : null} onPreencher={onIrParaMetas} />
            <Stat
              icon={<Receipt size={12} className="text-emerald-300" />}
              label="CAC"
              valor={cac != null ? formatCurrency(cac) : null}
              onPreencher={consultas == null ? onIrParaMetas : undefined}
              semValorTitulo={consultas === 0 ? 'Sem consultas no mês — CAC não se aplica' : undefined}
              tone="success"
            />
            <Stat
              icon={<Wallet size={12} className="text-sky-300" />}
              label="Investimento total"
              valor={investimento != null ? formatCurrency(investimento) : null}
              sub={investimento != null ? origemInvest : undefined}
              sincronizado={conectadas.length > 0}
              onPreencher={onIrParaMetas}
            />
            <Stat icon={<Stethoscope size={12} className="text-sky-300" />} label="Nº de consultas" valor={consultas != null ? fmtNum(consultas) : null} onPreencher={onIrParaMetas} />
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
        {sincronizado && valor != null && <RefreshCw size={9} className="text-emerald-400" aria-label="Sincronizado" />}
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
      {sub && <p className="mt-0.5 truncate text-[10px] text-muted">{sub}</p>}
    </div>
  )
}
