import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Users,
  Save,
  Edit3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatDateBR } from '@/lib/dates'
import type {
  Cliente,
  ItemSocialMedia,
  MetricasSocialMensal,
} from '@/types/database'
import { calculatePeriodComparison, type PeriodComparison } from '@/components/ds/KPICard'
import { InstagramConnectionCard } from './InstagramConnectionCard'
import { TopPostsRanking } from './TopPostsRanking'
import { fmtHora, diasAtras, getInstagramMetricsForPeriod, getInstagramState, loadInstagramCache } from './mockInstagram'

interface Props {
  cliente: Cliente
  items: ItemSocialMedia[]
}

/**
 * Painel de Métricas do Social Media — playbook seção 7.
 * Combina KPIs calculados automaticamente (a partir dos posts) com
 * campos de input mensal (engajamento, alcance, nota).
 */
export function MetricasSocialPanel({ cliente, items }: Props) {
  const [metricas, setMetricas] = useState<MetricasSocialMensal[]>([])
  const [loading, setLoading] = useState(true)
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cliente_metricas_social')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('mes_referencia', { ascending: false })
    setMetricas((data as MetricasSocialMensal[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id])

  const metricaDoMes = useMemo(
    () => metricas.find((m) => m.mes_referencia.slice(0, 7) === mesISO.slice(0, 7)) ?? null,
    [metricas, mesISO],
  )

  const mesAnterior = useMemo(() => {
    const [y, m] = mesISO.split('-').map(Number)
    const ant = new Date(y, m - 2, 1)
    const antISO = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, '0')}-01`
    return metricas.find((m) => m.mes_referencia.slice(0, 7) === antISO.slice(0, 7)) ?? null
  }, [metricas, mesISO])

  // KPIs calculados: % no prazo, # publicados, # reaproveitados
  const kpiCalculado = useMemo(() => calcularKPIs(items, mesISO), [items, mesISO])

  // Integração Instagram — recarrega ao conectar/sincronizar.
  const [igNonce, setIgNonce] = useState(0)
  const refreshIg = () => setIgNonce((n) => n + 1)
  // Carrega o cache de conexão (banco → memória) na 1ª montagem.
  useEffect(() => {
    loadInstagramCache().then(refreshIg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const igState = useMemo(() => getInstagramState(cliente.id), [cliente.id, igNonce])
  const igMetricas = useMemo(() => getInstagramMetricsForPeriod(cliente.id, mesISO), [cliente.id, mesISO, igNonce])
  const igMetricasAnterior = useMemo(() => {
    const [y, m] = mesISO.split('-').map(Number)
    const ant = new Date(y, m - 2, 1)
    return getInstagramMetricsForPeriod(cliente.id, `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, '0')}`)
  }, [cliente.id, mesISO, igNonce])
  const igConectado = igState.modoConexao !== 'nao_conectado'
  const igExpirado = igState.tokenStatus === 'expirado'
  const igSync = igConectado
    ? igExpirado
      ? `há ${diasAtras(igState.ultimaSincronizacao)} dias — token expirado`
      : `Sincronizado às ${fmtHora(igState.ultimaSincronizacao)}`
    : undefined
  const hintConectar = igConectado ? undefined : 'Conecte o Instagram para preencher automaticamente'

  function shiftMes(delta: number) {
    const [y, m] = mesISO.split('-').map(Number)
    const novaData = new Date(y, m - 1 + delta, 1)
    setMesISO(`${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const mesLabel = formatDateBR(mesISO, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Header com seletor de mês */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => shiftMes(-1)}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:border-pink-500/40 hover:text-pink-300"
        >
          <ChevronLeft size={14} />
        </button>
        <h2 className="px-2 text-lg font-semibold capitalize">{mesLabel}</h2>
        <button
          onClick={() => shiftMes(1)}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:border-pink-500/40 hover:text-pink-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Integração Instagram — conexão (2 modos) */}
      <InstagramConnectionCard clienteId={cliente.id} nomeCliente={cliente.nome} version={igNonce} onChanged={refreshIg} />

      {/* AUTOMÁTICAS — via Instagram Graph API (fundo neutro, cor só no badge) */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <AutoKpiCard
          icon={<CheckCircle2 size={14} />}
          label="Posts publicados"
          valor={
            igConectado && igMetricas
              ? String(igMetricas.postsPublicados)
              : `${kpiCalculado.totalPublicados}/${kpiCalculado.totalProgramados}`
          }
          sub={igConectado ? 'no período' : 'contagem interna (calendário)'}
          atual={igConectado && igMetricas ? igMetricas.postsPublicados : undefined}
          anterior={igMetricasAnterior?.postsPublicados}
          sync={igConectado ? igSync : undefined}
          hint={hintConectar}
        />
        <AutoKpiCard
          icon={<TrendingUp size={14} />}
          label="Alcance médio"
          valor={
            igConectado && igMetricas
              ? igMetricas.alcanceMedio.toLocaleString('pt-BR')
              : metricaDoMes?.alcance_medio != null
                ? metricaDoMes.alcance_medio.toLocaleString('pt-BR')
                : '—'
          }
          sub="por post"
          atual={igConectado && igMetricas ? igMetricas.alcanceMedio : undefined}
          anterior={igMetricasAnterior?.alcanceMedio}
          sync={igConectado ? igSync : undefined}
          hint={hintConectar}
        />
        <AutoKpiCard
          icon={<Users size={14} />}
          label="Seguidores"
          valor={
            igConectado && igMetricas
              ? igMetricas.seguidores.toLocaleString('pt-BR')
              : metricaDoMes?.seguidores != null
                ? metricaDoMes.seguidores.toLocaleString('pt-BR')
                : '—'
          }
          sub={
            igConectado && igMetricas
              ? `${igMetricas.seguidoresVariacao >= 0 ? '+' : ''}${igMetricas.seguidoresVariacao.toLocaleString('pt-BR')} no mês`
              : mesAnterior?.seguidores != null && metricaDoMes?.seguidores != null
                ? compararSeguidores(metricaDoMes.seguidores, mesAnterior.seguidores)
                : 'fim do mês'
          }
          atual={igConectado && igMetricas ? igMetricas.seguidores : undefined}
          anterior={igMetricasAnterior?.seguidores}
          sync={igConectado ? igSync : undefined}
          hint={hintConectar}
        />
        <AutoKpiCard
          icon={<Sparkles size={14} />}
          label="Engajamento médio"
          valor={
            igConectado && igMetricas
              ? `${igMetricas.engajamentoMedio.toFixed(2)}%`
              : metricaDoMes?.engajamento_medio != null
                ? `${metricaDoMes.engajamento_medio}%`
                : '—'
          }
          sub="curtidas + comentários + salvos ÷ alcance"
          atual={igConectado && igMetricas ? igMetricas.engajamentoMedio : undefined}
          anterior={igMetricasAnterior?.engajamentoMedio}
          sync={igConectado ? igSync : undefined}
          hint={hintConectar}
        />
      </div>

      {/* INTERNA — % posts no prazo (do Calendário de Postagens) */}
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard
          icon={<TrendingUp size={14} />}
          label="% posts no prazo"
          valor={kpiCalculado.totalPublicados === 0 ? '—' : `${kpiCalculado.pctNoPrazo}%`}
          sub={`${kpiCalculado.publicadosNoPrazo}/${kpiCalculado.totalPublicados} publicados`}
          tone={
            kpiCalculado.totalPublicados === 0
              ? 'neutral'
              : kpiCalculado.pctNoPrazo >= 90
              ? 'success'
              : kpiCalculado.pctNoPrazo >= 70
              ? 'warning'
              : 'danger'
          }
        />
      </div>

      {/* Melhores posts do mês (quando conectado) */}
      {igConectado && igMetricas && <TopPostsRanking posts={igMetricas.posts} />}

      {/* Registro manual — só como FALLBACK quando NÃO conectado */}
      {!igConectado && (
        <MetricasInputForm
          clienteId={cliente.id}
          mesISO={mesISO}
          metricaAtual={metricaDoMes}
          onSaved={load}
        />
      )}

      {/* Comparativo histórico */}
      {metricas.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-soft">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5">Mês</th>
                    <th className="px-3 py-2.5">Engajamento</th>
                    <th className="px-3 py-2.5">Alcance</th>
                    <th className="px-3 py-2.5">Seguidores</th>
                    <th className="px-3 py-2.5">Nota</th>
                    <th className="px-3 py-2.5">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.map((m) => (
                    <tr key={m.mes_referencia} className="border-t border-border">
                      <td className="px-4 py-2.5 capitalize">
                        {new Date(m.mes_referencia + 'T12:00:00').toLocaleDateString('pt-BR', {
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {m.engajamento_medio != null ? `${m.engajamento_medio}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {m.alcance_medio != null ? m.alcance_medio.toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {m.seguidores != null ? m.seguidores.toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {m.nota_qualitativa != null ? (
                          <Badge tone={m.nota_qualitativa >= 8 ? 'success' : m.nota_qualitativa >= 5 ? 'warning' : 'danger'}>
                            {m.nota_qualitativa}/10
                          </Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="max-w-[300px] truncate px-3 py-2.5 text-xs text-muted">
                        {m.observacoes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

/* ============================================================
   Helpers
   ============================================================ */

interface KPICalculado {
  totalProgramados: number
  totalPublicados: number
  publicadosNoPrazo: number
  atrasados: number
  pctNoPrazo: number
  reaproveitados: number
}

function calcularKPIs(items: ItemSocialMedia[], mesISO: string): KPICalculado {
  const mes = mesISO.slice(0, 7)
  const today = new Date().toISOString().slice(0, 10)

  // Filtra items programados pra esse mês (pelo prazo)
  const doMes = items.filter((i) => i.prazo && i.prazo.slice(0, 7) === mes)

  let publicados = 0
  let publicadosNoPrazo = 0
  let atrasados = 0
  let reaproveitados = 0

  for (const i of doMes) {
    if (i.publicado_em) {
      publicados++
      if (i.prazo && i.publicado_em.slice(0, 10) <= i.prazo.slice(0, 10)) {
        publicadosNoPrazo++
      }
    } else if (i.prazo && i.prazo.slice(0, 10) < today && i.status !== 'conclusao') {
      atrasados++
    }
    if (i.reaproveitado_para_ad) reaproveitados++
  }

  return {
    totalProgramados: doMes.length,
    totalPublicados: publicados,
    publicadosNoPrazo,
    atrasados,
    pctNoPrazo: publicados === 0 ? 0 : Math.round((publicadosNoPrazo / publicados) * 100),
    reaproveitados,
  }
}

function compararSeguidores(atual: number, anterior: number): string {
  const diff = atual - anterior
  const seta = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
  return `${seta} ${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-BR')} no mês`
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function KpiCard({
  icon,
  label,
  valor,
  sub,
  tone,
  auto,
  sync,
  hint,
}: {
  icon: React.ReactNode
  label: string
  valor: string
  sub: string
  tone: 'success' | 'warning' | 'danger' | 'brand' | 'neutral'
  /** Métrica automática (via Instagram API) — mostra a etiqueta "auto". */
  auto?: boolean
  /** Rodapé de sincronização quando conectado (ex.: "Sincronizado às 14:20"). */
  sync?: string
  /** Nota quando não conectado (ex.: "Conecte o Instagram..."). */
  hint?: string
}) {
  const cor = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-red-500/30 bg-red-500/10 text-red-200',
    brand: 'border-pink-500/30 bg-pink-500/10 text-pink-200',
    neutral: 'border-border bg-bg-soft text-muted',
  }[tone]
  const syncExpirado = !!sync?.includes('expirado')

  return (
    <Card className={cn('border', cor)}>
      <CardBody className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
            {icon}
            {label}
          </span>
          {auto && (
            <span className="text-[9px] opacity-60" title="Automático via Instagram API">
              auto
            </span>
          )}
        </div>
        <p className="text-2xl font-semibold tabular-nums">{valor}</p>
        <p className="text-[10px] opacity-70">{sub}</p>
        {sync ? (
          <p className={cn('flex items-center gap-1 text-[9px]', syncExpirado ? 'text-amber-300/90' : 'text-emerald-300/80')}>
            <RefreshCw size={9} /> {sync}
          </p>
        ) : hint ? (
          <p className="text-[9px] opacity-50">{hint}</p>
        ) : null}
      </CardBody>
    </Card>
  )
}

/** Card automático (via API): fundo neutro, badge de variação ▲/▼ vs. mês anterior. */
function AutoKpiCard({
  icon,
  label,
  valor,
  sub,
  atual,
  anterior,
  sync,
  hint,
}: {
  icon: React.ReactNode
  label: string
  valor: string
  sub: string
  atual?: number
  anterior?: number
  sync?: string
  hint?: string
}) {
  const comp = atual != null ? calculatePeriodComparison(atual, anterior ?? 0, 'maior') : null
  const semAnterior = atual != null && (anterior == null || anterior === 0)
  const syncExpirado = !!sync?.includes('expirado')
  return (
    <Card className="border border-border bg-bg-card">
      <CardBody className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            {icon}
            {label}
          </span>
          <span className="rounded border border-border bg-bg-soft px-1 py-0.5 text-[8px] uppercase tracking-wider text-muted" title="Automático via Instagram API">
            auto
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums text-zinc-100">{valor}</p>
          {comp && <CompBadge c={comp} semAnterior={semAnterior} />}
        </div>
        <p className="text-[10px] text-muted">{sub}</p>
        {sync ? (
          <p className={cn('flex items-center gap-1 text-[9px]', syncExpirado ? 'text-amber-300/80' : 'text-muted')}>
            <RefreshCw size={9} /> {sync}
          </p>
        ) : hint ? (
          <p className="text-[9px] text-muted/60">{hint}</p>
        ) : null}
      </CardBody>
    </Card>
  )
}

function CompBadge({ c, semAnterior }: { c: PeriodComparison; semAnterior: boolean }) {
  if (!c.temDadoAnterior || semAnterior) {
    return <span className="inline-flex items-center rounded border border-border px-1 py-0.5 text-[9px] text-muted" title="Sem mês anterior para comparar">—</span>
  }
  const zero = Math.abs(c.percentual) < 0.05
  const Icon = zero ? Minus : c.percentual > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-semibold tabular-nums',
        zero ? 'border-border text-muted' : c.favoravel ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300',
      )}
      title="vs. mês anterior"
    >
      <Icon size={9} />
      {c.percentual > 0 ? '+' : ''}
      {c.percentual.toFixed(1)}%
    </span>
  )
}

function MetricasInputForm({
  clienteId,
  mesISO,
  metricaAtual,
  onSaved,
}: {
  clienteId: string
  mesISO: string
  metricaAtual: MetricasSocialMensal | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [eng, setEng] = useState(metricaAtual?.engajamento_medio?.toString() ?? '')
  const [alc, setAlc] = useState(metricaAtual?.alcance_medio?.toString() ?? '')
  const [seg, setSeg] = useState(metricaAtual?.seguidores?.toString() ?? '')
  const [obs, setObs] = useState(metricaAtual?.observacoes ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEng(metricaAtual?.engajamento_medio?.toString() ?? '')
    setAlc(metricaAtual?.alcance_medio?.toString() ?? '')
    setSeg(metricaAtual?.seguidores?.toString() ?? '')
    setObs(metricaAtual?.observacoes ?? '')
  }, [metricaAtual])

  async function salvar() {
    setSaving(true)
    const payload = {
      cliente_id: clienteId,
      mes_referencia: mesISO,
      engajamento_medio: eng ? Number(eng) : null,
      alcance_medio: alc ? Number(alc) : null,
      seguidores: seg ? Number(seg) : null,
      nota_qualitativa: metricaAtual?.nota_qualitativa ?? null, // Evolução Qualitativa removida — preserva histórico
      observacoes: obs.trim() || null,
    }
    if (metricaAtual) {
      await supabase
        .from('cliente_metricas_social')
        .update(payload)
        .eq('cliente_id', clienteId)
        .eq('mes_referencia', mesISO)
    } else {
      await supabase.from('cliente_metricas_social').insert(payload)
    }
    setSaving(false)
    setEditing(false)
    onSaved()
  }

  if (!editing) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm text-zinc-100">
              {metricaAtual ? 'Métricas manuais deste mês preenchidas.' : 'Este cliente não está conectado ao Instagram.'}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Registre as métricas manualmente (alcance, seguidores, engajamento) até que a conexão
              seja feita — quando o Instagram for conectado, esses dados passam a vir da API automaticamente.
            </p>
          </div>
          <Button onClick={() => setEditing(true)}>
            <Edit3 size={13} /> {metricaAtual ? 'Editar' : 'Registrar'}
          </Button>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar métricas do mês</CardTitle>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-muted hover:text-zinc-200"
        >
          cancelar
        </button>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Engajamento médio (%)">
            <Input
              type="number"
              step="0.01"
              value={eng}
              onChange={(e) => setEng(e.target.value)}
              placeholder="ex: 4.25"
            />
          </Field>
          <Field label="Alcance médio (por post)">
            <Input
              type="number"
              value={alc}
              onChange={(e) => setAlc(e.target.value)}
              placeholder="ex: 12500"
            />
          </Field>
          <Field label="Seguidores (fim do mês)">
            <Input
              type="number"
              value={seg}
              onChange={(e) => setSeg(e.target.value)}
              placeholder="ex: 14200"
            />
          </Field>
        </div>
        <Field label="Observações do mês">
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Reels começaram a engajar mais, identidade visual estabilizada, etc."
            className="min-h-[70px] text-sm"
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={salvar} disabled={saving}>
            <Save size={13} /> {saving ? 'Salvando...' : 'Salvar métricas'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  )
}
