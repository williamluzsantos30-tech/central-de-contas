import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Pencil, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, monthKey } from '@/lib/utils'
import { fechamentosDoRealizado, getClientTrafficSummary, NOME_PLATAFORMA_TRAFEGO, type ResumoTrafegoCliente } from '@/lib/traffic/summary'
import type { EstadoSalvar } from '@/components/trafego/TrafegoUI'
import type { Cliente, Meta, MetasPorPlataforma, MetasValores } from '@/types/database'
import { downloadRelatorioMetasPDF } from './RelatorioMetasPDF'
import { GoalsTable } from './GoalsTable'
import { realizadoComResumo, semMidiaRealizado, VALORES_VAZIOS } from './metasTabela'

interface Props {
  clienteId: string
  cliente: Cliente
  /** Período da ficha (YYYY-MM-01) — o mesmo das abas Google Ads, Meta Ads e Visão geral. */
  mes: string
  onMes: (mes: string) => void
}

type PlataformaMetas = 'google' | 'meta'

/** Mês das metas + o resumo de tráfego dele (fonte do realizado de mídia). */
export type MetaComResumo = Meta & { resumoTrafego: ResumoTrafegoCliente }

type Seccao = 'meta_data' | 'resultado_data'

const emptyPlataformas: MetasPorPlataforma = {
  google: { ...VALORES_VAZIOS },
  meta: { ...VALORES_VAZIOS },
}

/** Normaliza — aceita formato antigo (valores direto) e novo ({google,meta}). */
function normalize(raw: unknown): MetasPorPlataforma {
  const r = (raw ?? {}) as Record<string, unknown>
  if ('google' in r || 'meta' in r) {
    return {
      google: { ...VALORES_VAZIOS, ...((r.google ?? {}) as MetasValores) },
      meta: { ...VALORES_VAZIOS, ...((r.meta ?? {}) as MetasValores) },
    }
  }
  // formato antigo → só google
  return { google: { ...VALORES_VAZIOS, ...(r as unknown as MetasValores) }, meta: { ...VALORES_VAZIOS } }
}

/** Mês com o realizado de mídia vindo do resumo de tráfego (getClientTrafficSummary). */
function comResumo(m: Meta, clienteId: string): MetaComResumo {
  const res = normalize(m.resultado_data)
  const resumoTrafego = getClientTrafficSummary(clienteId, m.mes_ano, { fechamentos: fechamentosDoRealizado(res) })
  return {
    ...m,
    resultado_data: {
      google: realizadoComResumo(res.google, resumoTrafego.porPlataforma.googleAds),
      meta: realizadoComResumo(res.meta, resumoTrafego.porPlataforma.metaAds),
    },
    resumoTrafego,
  }
}

const TIMEOUT_SALVAR_MS = 15000

/**
 * Estado local + auto-save (debounce 600 ms) de UMA seção/plataforma.
 * "Salvando..." → "Salvo" (some em 2 s) → erro com "Tentar novamente".
 * Nunca fica preso: timeout de 15 s vira erro.
 */
function usePlanilha(externo: MetasValores, salvar: (v: MetasValores) => Promise<void>) {
  const [local, setLocal] = useState<MetasValores>({ ...VALORES_VAZIOS, ...externo })
  const [estado, setEstado] = useState<EstadoSalvar>('idle')
  const localRef = useRef(local)
  const sujoRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const salvoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const salvarRef = useRef(salvar)
  salvarRef.current = salvar
  const chaveExterna = JSON.stringify(externo)

  // Troca de mês / recarga: adota o valor externo se não há edição pendente.
  useEffect(() => {
    if (sujoRef.current) return
    const v = { ...VALORES_VAZIOS, ...externo }
    localRef.current = v
    setLocal(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveExterna])

  async function flush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!sujoRef.current) return
    sujoRef.current = false
    setEstado('saving')
    try {
      await Promise.race([
        salvarRef.current(localRef.current),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_SALVAR_MS)),
      ])
      setEstado('saved')
      if (salvoRef.current) clearTimeout(salvoRef.current)
      salvoRef.current = setTimeout(() => setEstado('idle'), 2000)
    } catch {
      sujoRef.current = true // mantém pra "Tentar novamente"
      setEstado('error')
    }
  }

  function set(campo: keyof MetasValores, valor: number | null) {
    const n = { ...localRef.current, [campo]: valor }
    localRef.current = n
    setLocal(n)
    sujoRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void flush(), 600)
  }

  // Saiu da aba/página com edição pendente: salva sem esperar.
  useEffect(() => {
    const onUnload = () => {
      if (sujoRef.current) void salvarRef.current(localRef.current)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (salvoRef.current) clearTimeout(salvoRef.current)
      if (sujoRef.current) void salvarRef.current(localRef.current)
    }
  }, [])

  return { local, set, estado, flush }
}

const PESO_ESTADO: Record<EstadoSalvar, number> = { error: 3, saving: 2, saved: 1, idle: 0 }
const combinar = (a: EstadoSalvar, b: EstadoSalvar) => (PESO_ESTADO[a] >= PESO_ESTADO[b] ? a : b)

export function MetasPanel({ clienteId, cliente, mes, onMes }: Props) {
  const selectedMonth = mes
  const [todosMeses, setTodosMeses] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const initializedRef = useRef(false)
  // Saves em fila: dois saves do mesmo mês (Google e Meta, meta e realizado)
  // não podem criar a linha do mês duas vezes.
  const filaRef = useRef<Promise<unknown>>(Promise.resolve())

  async function load() {
    if (!initializedRef.current) setLoading(true)
    const { data } = await supabase.from('metas').select('*').eq('cliente_id', clienteId).order('mes_ano', { ascending: false })
    setTodosMeses((data as Meta[]) ?? [])
    if (!initializedRef.current) {
      setLoading(false)
      initializedRef.current = true
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  const metaAtual = useMemo(() => todosMeses.find((m) => m.mes_ano === selectedMonth) ?? null, [todosMeses, selectedMonth])
  const metaData = useMemo(() => normalize(metaAtual?.meta_data), [metaAtual])
  const resultadoData = useMemo(() => normalize(metaAtual?.resultado_data), [metaAtual])

  function salvarSecao(section: Seccao, plataforma: PlataformaMetas, valores: MetasValores): Promise<void> {
    const mes = selectedMonth
    const tarefa = async () => {
      // Lê o registro atual DO BANCO (evita pisar em edição da outra plataforma).
      const { data: freshArr, error: e1 } = await supabase.from('metas').select('*').eq('cliente_id', clienteId).eq('mes_ano', mes)
      if (e1) throw e1
      const fresh = (freshArr as Meta[] | null)?.[0] ?? null
      if (fresh) {
        const updated: MetasPorPlataforma = { ...normalize(fresh[section]), [plataforma]: valores }
        const { error } = await supabase.from('metas').update({ [section]: updated }).eq('id', fresh.id)
        if (error) throw error
      } else {
        const nova: MetasPorPlataforma = { ...emptyPlataformas, [plataforma]: valores }
        const { error } = await supabase.from('metas').insert({
          cliente_id: clienteId,
          mes_ano: mes,
          meta_data: section === 'meta_data' ? nova : emptyPlataformas,
          resultado_data: section === 'resultado_data' ? nova : emptyPlataformas,
        })
        if (error) throw error
      }
      void load()
    }
    const p = filaRef.current.then(tarefa, tarefa)
    filaRef.current = p.catch(() => undefined)
    return p
  }

  const metaG = usePlanilha(metaData.google, (v) => salvarSecao('meta_data', 'google', v))
  // Realizado: mídia não é gravada (vem do resumo de tráfego) — só o funil depois do clique.
  const realG = usePlanilha(resultadoData.google, (v) => salvarSecao('resultado_data', 'google', semMidiaRealizado(v)))
  const metaM = usePlanilha(metaData.meta, (v) => salvarSecao('meta_data', 'meta', v))
  const realM = usePlanilha(resultadoData.meta, (v) => salvarSecao('resultado_data', 'meta', semMidiaRealizado(v)))

  async function flushAll() {
    await Promise.allSettled([metaG.flush(), realG.flush(), metaM.flush(), realM.flush()])
  }

  async function baixarPdf() {
    await flushAll()
    const historico = todosMeses.map((m) => comResumo(m, clienteId))
    if (historico.length === 0) {
      alert('Não há metas registradas pra esse cliente ainda.')
      return
    }
    setGerandoPdf(true)
    try {
      await downloadRelatorioMetasPDF({ cliente, historico })
    } finally {
      setGerandoPdf(false)
    }
  }

  async function excluirMeta(id: string) {
    if (!confirm('Excluir este mês do histórico?')) return
    await flushAll()
    await supabase.from('metas').delete().eq('id', id)
    load()
  }

  async function irParaMes(mes: string) {
    await flushAll()
    onMes(mes)
  }

  function shiftMonth(delta: number) {
    const d = parseISO(selectedMonth)
    d.setMonth(d.getMonth() + delta)
    void irParaMes(format(d, 'yyyy-MM-01'))
  }

  if (loading) return <p className="text-sm text-muted">Carregando...</p>

  const isCurrentMonth = selectedMonth === monthKey()
  // Fonte única: mesma função do Funil, do pacing e das abas de plataforma.
  // Fechamentos (consultas) = o que está sendo digitado agora no Realizado.
  const resumo = getClientTrafficSummary(clienteId, selectedMonth, {
    fechamentos: { googleAds: realG.local.numero_consultas, metaAds: realM.local.numero_consultas },
  })
  const historicoEfetivo = todosMeses.map((m) => comResumo(m, clienteId))

  return (
    <div>
      {/* Navegador de mês */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft px-4 py-1.5 text-sm">
            <span className="font-semibold text-zinc-100">{formatCompetencia(selectedMonth)}</span>
            {!isCurrentMonth && (
              <button onClick={() => void irParaMes(monthKey())} className="text-[11px] text-brand-300 hover:underline">
                voltar ao atual
              </button>
            )}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
            title="Próximo mês"
            aria-label="Próximo mês"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={baixarPdf}
          disabled={gerandoPdf || todosMeses.length === 0}
          title="Baixa o PDF com a tabela Meta × Realizado de cada mês + resumo do período"
        >
          <FileText size={13} />
          {gerandoPdf ? 'Gerando...' : 'Baixar PDF'}
        </Button>
      </div>

      <GoalsTable
        titulo="Google Ads — Captação de Leads"
        nomePlataforma={NOME_PLATAFORMA_TRAFEGO.googleAds}
        corTitulo="text-blue-300"
        meta={metaG.local}
        real={realG.local}
        resumo={resumo.porPlataforma.googleAds}
        semVerba={!cliente.verba_google}
        estado={combinar(metaG.estado, realG.estado)}
        onRetry={() => void Promise.allSettled([metaG.flush(), realG.flush()])}
        onMeta={metaG.set}
        onReal={realG.set}
        onBlur={() => void Promise.allSettled([metaG.flush(), realG.flush()])}
      />
      <GoalsTable
        titulo="Meta Ads — Captação de Leads"
        nomePlataforma={NOME_PLATAFORMA_TRAFEGO.metaAds}
        corTitulo="text-violet-300"
        meta={metaM.local}
        real={realM.local}
        resumo={resumo.porPlataforma.metaAds}
        semVerba={!cliente.verba_meta}
        estado={combinar(metaM.estado, realM.estado)}
        onRetry={() => void Promise.allSettled([metaM.flush(), realM.flush()])}
        onMeta={metaM.set}
        onReal={realM.set}
        onBlur={() => void Promise.allSettled([metaM.flush(), realM.flush()])}
      />

      {/* Histórico agregado */}
      {historicoEfetivo.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
            Evolução mensal · Resultados (Google + Meta somados)
          </h3>
          <HistoricoTable historico={historicoEfetivo} selectedMonth={selectedMonth} onDelete={excluirMeta} onSelect={(m) => void irParaMes(m)} />
        </div>
      )}
    </div>
  )
}

function faturamentoDe(v: MetasValores): number {
  return (v.numero_consultas ?? 0) * (v.tm_consulta ?? 0) + (v.numero_procedimentos ?? 0) * (v.tm_procedimento ?? 0)
}

/* Tabela histórica agregada Google + Meta */
interface Agregado {
  investimento: number | null
  faturamento: number | null
  roas: number | null
  leads: number | null
  consultas: number | null
  vendas: number | null
}

function combinaMes(m: MetaComResumo): Agregado {
  const res = normalize(m.resultado_data)
  const investimento = m.resumoTrafego.total.investimento
  const faturamento = faturamentoDe(res.google) + faturamentoDe(res.meta)
  const leads =
    (res.google.mensagens_qualificadas ?? 0) + (res.meta.mensagens_qualificadas ?? 0)
  const consultas = (res.google.numero_consultas ?? 0) + (res.meta.numero_consultas ?? 0)
  const vendas =
    (res.google.numero_procedimentos ?? 0) + (res.meta.numero_procedimentos ?? 0)
  return {
    investimento: investimento > 0 ? investimento : null,
    faturamento: faturamento > 0 ? faturamento : null,
    roas: investimento > 0 && faturamento > 0 ? faturamento / investimento : null,
    leads: leads > 0 ? leads : null,
    consultas: consultas > 0 ? consultas : null,
    vendas: vendas > 0 ? vendas : null,
  }
}

function HistoricoTable({
  historico,
  selectedMonth,
  onDelete,
  onSelect,
}: {
  historico: MetaComResumo[]
  selectedMonth: string
  onDelete: (id: string) => void
  onSelect: (mes: string) => void
}) {
  const rows = useMemo(() => {
    return historico.map((m, idx) => {
      const ag = combinaMes(m)
      const prev = historico[idx + 1] ? combinaMes(historico[idx + 1]) : null
      const variacao =
        prev?.faturamento && ag.faturamento
          ? ((ag.faturamento - prev.faturamento) / prev.faturamento) * 100
          : null
      return { meta: m, ...ag, variacao }
    })
  }, [historico])

  /**
   * Média dos meses do histórico. Cada métrica é calculada SÓ sobre os
   * meses que têm aquele dado preenchido (não conta os "—" como zero).
   * Investimento conta zero como ausente também (mes só investido sem
   * resultado não polui a média de faturamento mas é incluído em
   * investimento se > 0).
   */
  const medias = useMemo(() => {
    function avg(valores: (number | null | undefined)[]): number | null {
      const validos = valores.filter(
        (v): v is number => typeof v === 'number' && !isNaN(v) && v > 0,
      )
      if (validos.length === 0) return null
      return validos.reduce((a, b) => a + b, 0) / validos.length
    }
    return {
      investimento: avg(rows.map((r) => r.investimento)),
      faturamento: avg(rows.map((r) => r.faturamento)),
      roas: avg(rows.map((r) => r.roas)),
      leads: avg(rows.map((r) => r.leads)),
      consultas: avg(rows.map((r) => r.consultas)),
      vendas: avg(rows.map((r) => r.vendas)),
      totalMeses: rows.length,
    }
  }, [rows])

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft">
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Competência</th>
              <th className="px-3 py-2.5 text-right">Investimento</th>
              <th className="px-3 py-2.5 text-right">Faturamento</th>
              <th className="px-3 py-2.5 text-center">ROAS</th>
              <th className="px-3 py-2.5 text-center">Leads</th>
              <th className="px-3 py-2.5 text-center">Consultas</th>
              <th className="px-3 py-2.5 text-center">Vendas</th>
              <th className="px-3 py-2.5 text-center">Variação</th>
              <th className="px-3 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.meta.mes_ano === selectedMonth
              return (
                <tr
                  key={row.meta.id}
                  className="border-t border-border hover:bg-bg-soft/50"
                >
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <button
                      onClick={() => onSelect(row.meta.mes_ano)}
                      className={cn(
                        'hover:text-zinc-100',
                        isSelected ? 'font-semibold text-zinc-100' : 'text-zinc-300',
                      )}
                    >
                      {formatCompetencia(row.meta.mes_ano)}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right text-sm">
                    {formatCurrency(row.investimento)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium text-zinc-100">
                    {formatCurrency(row.faturamento)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.roas !== null ? (
                      <Badge tone="success">{row.roas.toFixed(2).replace('.', ',')}x</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-sm">{row.leads ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-sm">{row.consultas ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-sm">{row.vendas ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-sm">
                    {row.variacao === null ? (
                      <span className="text-muted">—</span>
                    ) : row.variacao >= 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <TrendingUp size={12} />
                        +{row.variacao.toFixed(1).replace('.', ',')}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400">
                        <TrendingDown size={12} />
                        {row.variacao.toFixed(1).replace('.', ',')}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => onSelect(row.meta.mes_ano)}
                        className="rounded p-1 text-muted hover:bg-bg-elev hover:text-brand-300"
                        title="Abrir este mês"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(row.meta.id)}
                        className="rounded p-1 text-muted hover:bg-bg-elev hover:text-red-400"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {medias.totalMeses > 0 && (
            <tfoot className="border-t-2 border-border bg-bg-soft/40">
              <tr>
                <td className="px-4 py-3 text-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300">
                    Média
                  </span>
                  <span className="ml-1.5 text-[10px] text-muted">
                    ({medias.totalMeses}m)
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-zinc-100">
                  {medias.investimento !== null
                    ? formatCurrency(medias.investimento)
                    : '—'}
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-zinc-100">
                  {medias.faturamento !== null
                    ? formatCurrency(medias.faturamento)
                    : '—'}
                </td>
                <td className="px-3 py-3 text-center">
                  {medias.roas !== null ? (
                    <Badge tone="success">
                      {medias.roas.toFixed(2).replace('.', ',')}x
                    </Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-zinc-100">
                  {medias.leads !== null
                    ? medias.leads.toFixed(1).replace('.', ',')
                    : '—'}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-zinc-100">
                  {medias.consultas !== null
                    ? medias.consultas.toFixed(1).replace('.', ',')
                    : '—'}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-zinc-100">
                  {medias.vendas !== null
                    ? medias.vendas.toFixed(1).replace('.', ',')
                    : '—'}
                </td>
                <td className="px-3 py-3 text-center text-muted">—</td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  )
}


function formatCompetencia(mesAno: string): string {
  try {
    const d = parseISO(mesAno)
    const mesCurto = format(d, 'LLL', { locale: ptBR }).replace('.', '')
    const ano = format(d, 'yyyy')
    return `${mesCurto.charAt(0).toUpperCase() + mesCurto.slice(1)} ${ano}`
  } catch {
    return mesAno
  }
}
