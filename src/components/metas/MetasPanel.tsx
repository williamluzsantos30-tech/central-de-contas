import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  TrendingUp,
  TrendingDown,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckCircle2,
  Wallet,
  MessageSquare,
  Stethoscope,
  Activity,
  Trophy,
  BarChart3,
  LineChart,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, monthKey } from '@/lib/utils'
import type { Meta, MetasPorPlataforma, MetasValores } from '@/types/database'

interface Props {
  clienteId: string
}

type Plataforma = 'google' | 'meta'
type Seccao = 'meta_data' | 'resultado_data'

const emptyValores: MetasValores = {
  investimento: null,
  custo_mensagem: null,
  mensagens_qualificadas: null,
  numero_consultas: null,
  tm_consulta: null,
  numero_procedimentos: null,
  tm_procedimento: null,
}

const emptyPlataformas: MetasPorPlataforma = {
  google: { ...emptyValores },
  meta: { ...emptyValores },
}

/** Normaliza — aceita formato antigo (valores direto) e novo ({google,meta}). */
function normalize(raw: unknown): MetasPorPlataforma {
  const r = (raw ?? {}) as Record<string, unknown>
  if ('google' in r || 'meta' in r) {
    return {
      google: { ...emptyValores, ...((r.google ?? {}) as MetasValores) },
      meta: { ...emptyValores, ...((r.meta ?? {}) as MetasValores) },
    }
  }
  // formato antigo → só google
  return {
    google: { ...emptyValores, ...(r as MetasValores) },
    meta: { ...emptyValores },
  }
}

interface Calculos {
  valorDiario: number | null
  mensagens: number | null
  custoMensagemQualificada: number | null
  txaConversaoConsulta: number | null
  txaConversaoProcedimento: number | null
  faturamento: number | null
  roas: number | null
  cac: number | null
}

function computeCalculos(v: MetasValores): Calculos {
  const faturamento =
    (v.numero_consultas ?? 0) * (v.tm_consulta ?? 0) +
    (v.numero_procedimentos ?? 0) * (v.tm_procedimento ?? 0)
  return {
    valorDiario: v.investimento ? v.investimento / 30 : null,
    mensagens:
      v.investimento && v.custo_mensagem ? Math.floor(v.investimento / v.custo_mensagem) : null,
    custoMensagemQualificada:
      v.investimento && v.mensagens_qualificadas
        ? v.investimento / v.mensagens_qualificadas
        : null,
    txaConversaoConsulta:
      v.numero_consultas && v.mensagens_qualificadas
        ? (v.numero_consultas / v.mensagens_qualificadas) * 100
        : null,
    txaConversaoProcedimento:
      v.numero_procedimentos && v.numero_consultas
        ? (v.numero_procedimentos / v.numero_consultas) * 100
        : null,
    faturamento: faturamento > 0 ? faturamento : null,
    roas: v.investimento && faturamento > 0 ? faturamento / v.investimento : null,
    cac: v.investimento && v.numero_consultas ? v.investimento / v.numero_consultas : null,
  }
}

export function MetasPanel({ clienteId }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const [todosMeses, setTodosMeses] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [historicoView, setHistoricoView] = useState<'tabela' | 'grafico'>('tabela')

  // Refs das 4 planilhas para forçar flush antes de operações destrutivas
  const planMetaGoogleRef = useRef<PlanilhaHandle>(null)
  const planResultGoogleRef = useRef<PlanilhaHandle>(null)
  const planMetaMetaRef = useRef<PlanilhaHandle>(null)
  const planResultMetaRef = useRef<PlanilhaHandle>(null)

  /** Garante que qualquer save pendente das planilhas seja finalizado antes de continuar. */
  async function flushAllPlanilhas() {
    await Promise.all([
      planMetaGoogleRef.current?.flush(),
      planResultGoogleRef.current?.flush(),
      planMetaMetaRef.current?.flush(),
      planResultMetaRef.current?.flush(),
    ])
  }

  const initializedRef = useRef(false)

  async function load() {
    // Loading visível APENAS na primeira carga; saves subsequentes refrescam em background
    // (caso contrário, o componente desmonta a cada save e o input "perde" o valor digitado)
    if (!initializedRef.current) setLoading(true)
    const { data } = await supabase
      .from('metas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('mes_ano', { ascending: false })
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

  const metaAtual = useMemo(
    () => todosMeses.find((m) => m.mes_ano === selectedMonth) ?? null,
    [todosMeses, selectedMonth],
  )

  const metaData = useMemo(() => normalize(metaAtual?.meta_data), [metaAtual])
  const resultadoData = useMemo(() => normalize(metaAtual?.resultado_data), [metaAtual])

  async function saveSection(section: Seccao, plataforma: Plataforma, valores: MetasValores) {
    // Busca o registro atualizado DO DB (evita race condition quando o usuário
    // edita Google e Meta em sequência antes do load() terminar).
    const { data: freshArr } = await supabase
      .from('metas')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('mes_ano', selectedMonth)
    const fresh = (freshArr as Meta[] | null)?.[0] ?? null

    if (fresh) {
      const currentSection = normalize(fresh[section])
      const updated: MetasPorPlataforma = { ...currentSection, [plataforma]: valores }
      await supabase.from('metas').update({ [section]: updated }).eq('id', fresh.id)
    } else {
      const newSection: MetasPorPlataforma = {
        google: section !== section ? emptyValores : emptyValores,
        meta: emptyValores,
        [plataforma]: valores,
      }
      await supabase.from('metas').insert({
        cliente_id: clienteId,
        mes_ano: selectedMonth,
        meta_data: section === 'meta_data' ? newSection : emptyPlataformas,
        resultado_data: section === 'resultado_data' ? newSection : emptyPlataformas,
      })
    }
    load()
  }

  async function excluirMeta(id: string) {
    if (!confirm('Excluir este mês do histórico?')) return
    await flushAllPlanilhas()
    await supabase.from('metas').delete().eq('id', id)
    load()
  }

  async function shiftMonth(delta: number) {
    // Flush qualquer save pendente ANTES de trocar de mês,
    // senão o debounce dispara depois com o mês novo (race condition)
    await flushAllPlanilhas()
    const d = parseISO(selectedMonth)
    d.setMonth(d.getMonth() + delta)
    setSelectedMonth(format(d, 'yyyy-MM-01'))
  }

  async function goToCurrentMonth() {
    await flushAllPlanilhas()
    setSelectedMonth(monthKey())
  }

  async function selectMonth(mes: string) {
    await flushAllPlanilhas()
    setSelectedMonth(mes)
  }

  if (loading) {
    return <p className="text-sm text-muted">Carregando...</p>
  }

  const isCurrentMonth = selectedMonth === monthKey()

  return (
    <div>
      {/* Navegador de mês */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
            title="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft px-4 py-1.5 text-sm">
            <span className="font-semibold text-zinc-100">{formatCompetencia(selectedMonth)}</span>
            {!isCurrentMonth && (
              <button
                onClick={goToCurrentMonth}
                className="text-[11px] text-brand-300 hover:underline"
              >
                voltar ao atual
              </button>
            )}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
            title="Próximo mês"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Gráfico de contexto histórico — fica antes das Planilhas pra mostrar
          o desempenho dos meses anteriores enquanto o usuário define as metas
          do mês corrente. Só renderiza se houver pelo menos 1 mês cadastrado. */}
      {todosMeses.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
            Resultados dos últimos meses · contexto pra definir as metas
          </h3>
          <HistoricoChart historico={todosMeses} />
        </div>
      )}

      {/* Google Ads */}
      <PlatformSection title="Google Ads — Captação de Leads" color="blue">
        <Planilha
          ref={planMetaGoogleRef}
          titulo="Meta do Mês"
          tone="meta"
          valores={metaData.google}
          onChange={(v) => saveSection('meta_data', 'google', v)}
        />
        <Planilha
          ref={planResultGoogleRef}
          titulo="Resultado Obtido"
          tone="success"
          valores={resultadoData.google}
          onChange={(v) => saveSection('resultado_data', 'google', v)}
        />
      </PlatformSection>

      {/* Meta Ads */}
      <PlatformSection title="Meta Ads — Captação de Leads" color="violet">
        <Planilha
          ref={planMetaMetaRef}
          titulo="Meta do Mês"
          tone="meta"
          valores={metaData.meta}
          onChange={(v) => saveSection('meta_data', 'meta', v)}
        />
        <Planilha
          ref={planResultMetaRef}
          titulo="Resultado Obtido"
          tone="success"
          valores={resultadoData.meta}
          onChange={(v) => saveSection('resultado_data', 'meta', v)}
        />
      </PlatformSection>

      {/* Histórico agregado */}
      {todosMeses.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              Evolução mensal · Resultados (Google + Meta somados)
            </h3>
            <div className="inline-flex rounded-md border border-border bg-bg-soft p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setHistoricoView('tabela')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors',
                  historicoView === 'tabela'
                    ? 'bg-bg-elev text-zinc-100'
                    : 'text-muted hover:text-zinc-200',
                )}
              >
                <BarChart3 size={12} />
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setHistoricoView('grafico')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors',
                  historicoView === 'grafico'
                    ? 'bg-bg-elev text-zinc-100'
                    : 'text-muted hover:text-zinc-200',
                )}
              >
                <LineChart size={12} />
                Gráfico
              </button>
            </div>
          </div>
          {historicoView === 'tabela' ? (
            <HistoricoTable
              historico={todosMeses}
              selectedMonth={selectedMonth}
              onDelete={excluirMeta}
              onSelect={selectMonth}
            />
          ) : (
            <HistoricoChart historico={todosMeses} />
          )}
        </div>
      )}
    </div>
  )
}

function PlatformSection({
  title,
  color,
  children,
}: {
  title: string
  color: 'blue' | 'violet'
  children: React.ReactNode
}) {
  const accent =
    color === 'blue'
      ? { dot: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]', text: 'text-blue-300' }
      : { dot: 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.7)]', text: 'text-violet-300' }
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', accent.dot)} />
        <h3 className={cn('text-[11px] font-bold uppercase tracking-widest', accent.text)}>
          {title}
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-border via-border/40 to-transparent" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>
    </div>
  )
}

export type PlanilhaHandle = { flush: () => Promise<void> }

const Planilha = forwardRef<
  PlanilhaHandle,
  {
    titulo: string
    tone: 'meta' | 'success'
    valores: MetasValores
    onChange: (v: MetasValores) => Promise<void> | void
  }
>(function Planilha({ titulo, tone, valores, onChange }, externalRef) {
  const [local, setLocal] = useState<MetasValores>({ ...emptyValores, ...valores })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const firstRenderRef = useRef(true)
  const onChangeRef = useRef(onChange)
  const localRef = useRef(local)
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mantém refs atualizadas
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    localRef.current = local
  }, [local])

  // Salva os valores atuais imediatamente (cancela debounce pendente)
  async function flushSave() {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    // Skip se nada mudou em relação aos valores carregados (evita race em flush sem mudanças)
    if (JSON.stringify(localRef.current) === JSON.stringify({ ...emptyValores, ...valores })) {
      return
    }
    setSaveState('saving')
    try {
      await onChangeRef.current(localRef.current)
      setSaveState('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('idle')
    }
  }

  // Permite o pai (MetasPanel) forçar o save, ex: antes de trocar de mês
  useImperativeHandle(externalRef, () => ({ flush: flushSave }), [])

  // Reset quando os valores externos mudam (mês trocado, recarregamento, etc.)
  useEffect(() => {
    setLocal({ ...emptyValores, ...valores })
    firstRenderRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(valores)])

  // Auto-save com debounce de 600ms
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    setSaveState('saving')
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    pendingTimerRef.current = setTimeout(() => {
      flushSave()
    }, 600)
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  // Flush ao desmontar (sair da página, trocar tab, etc.)
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
        // dispara save imediato sem await (sair da página)
        try {
          onChangeRef.current(localRef.current)
        } catch {
          /* noop */
        }
      }
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // Salva quando o usuário fechar a aba/janela com mudanças pendentes
  useEffect(() => {
    function onBeforeUnload() {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
        try {
          onChangeRef.current(localRef.current)
        } catch {
          /* noop */
        }
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const calc = useMemo(() => computeCalculos(local), [local])

  const isMeta = tone === 'meta'
  const HeaderIcon = isMeta ? Target : CheckCircle2

  function setField(key: keyof MetasValores, val: string) {
    setLocal((cur) => ({ ...cur, [key]: val === '' ? null : Number(val) }))
  }

  return (
    <Card className="overflow-hidden">
      {/* Header com ícone, título e gradiente sutil */}
      <div
        className={cn(
          'relative flex items-center gap-2.5 border-b px-4 py-3',
          isMeta
            ? 'border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-transparent'
            : 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent',
        )}
      >
        <div
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg border',
            isMeta
              ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
          )}
        >
          <HeaderIcon size={15} />
        </div>
        <div className="flex-1">
          <h4
            className={cn(
              'text-[13px] font-semibold leading-tight',
              isMeta ? 'text-indigo-200' : 'text-emerald-200',
            )}
          >
            {titulo}
          </h4>
          <p className="text-[10.5px] text-muted leading-tight mt-0.5">
            {isMeta ? 'Projeção do que se espera atingir' : 'O que de fato aconteceu no mês'}
          </p>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      <div className="divide-y divide-border/40">
        <SectionGroup icon={Wallet} label="Investimento" tone={tone}>
          <InputRow
            label="Investimento"
            value={local.investimento}
            onChange={(v) => setField('investimento', v)}
            onBlur={flushSave}
            format="money"
          />
          <CalcRow
            label="Valor diário"
            formula="investimento / 30"
            value={calc.valorDiario}
            format="money"
          />
        </SectionGroup>

        <SectionGroup icon={MessageSquare} label="Funil de mensagens" tone={tone}>
          <InputRow
            label="Custo por mensagem"
            value={local.custo_mensagem}
            onChange={(v) => setField('custo_mensagem', v)}
            onBlur={flushSave}
            format="money"
          />
          <CalcRow
            label="Mensagens"
            formula="investimento ÷ custo por mensagem"
            value={calc.mensagens}
            format="int"
          />
          <InputRow
            label="Mensagens qualificadas"
            value={local.mensagens_qualificadas}
            onChange={(v) => setField('mensagens_qualificadas', v)}
            onBlur={flushSave}
            format="int"
          />
          <CalcRow
            label="Custo por mens. qualificada"
            formula="investimento ÷ mens. qualificadas"
            value={calc.custoMensagemQualificada}
            format="money"
          />
        </SectionGroup>

        <SectionGroup icon={Stethoscope} label="Funil de consultas" tone={tone}>
          <InputRow
            label="Nº de consultas / mês"
            value={local.numero_consultas}
            onChange={(v) => setField('numero_consultas', v)}
            onBlur={flushSave}
            format="int"
          />
          <InputRow
            label="Ticket médio (consulta)"
            value={local.tm_consulta}
            onChange={(v) => setField('tm_consulta', v)}
            onBlur={flushSave}
            format="money"
          />
          <CalcRow
            label="Taxa de conversão"
            formula="consultas ÷ mens. qualificadas"
            value={calc.txaConversaoConsulta}
            format="percent"
          />
        </SectionGroup>

        <SectionGroup icon={Activity} label="Funil de procedimentos" tone={tone}>
          <InputRow
            label="Nº de procedimentos / mês"
            value={local.numero_procedimentos}
            onChange={(v) => setField('numero_procedimentos', v)}
            onBlur={flushSave}
            format="int"
          />
          <InputRow
            label="Ticket médio (procedimento)"
            value={local.tm_procedimento}
            onChange={(v) => setField('tm_procedimento', v)}
            onBlur={flushSave}
            format="money"
          />
          <CalcRow
            label="Taxa de conversão"
            formula="procedimentos ÷ consultas"
            value={calc.txaConversaoProcedimento}
            format="percent"
          />
        </SectionGroup>

        <SectionGroup icon={Trophy} label="Resultado" tone={tone}>
          <CalcRow
            label="Faturamento"
            formula="(consultas × TM) + (proc. × TM proc.)"
            value={calc.faturamento}
            format="money"
            emphasis="strong"
          />
          <CalcRow
            label="ROAS"
            formula="faturamento ÷ investimento"
            value={calc.roas}
            format="multiplier"
            emphasis="strong"
          />
          <CalcRow
            label="CAC"
            formula="investimento ÷ consultas"
            value={calc.cac}
            format="money"
            emphasis="medium"
          />
        </SectionGroup>
      </div>
    </Card>
  )
})

function SectionGroup({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  tone: 'brand' | 'success'
  children: React.ReactNode
}) {
  const accent = tone === 'brand' ? 'text-brand-300' : 'text-emerald-300'
  return (
    <div>
      <div className="flex items-center gap-1.5 bg-bg-soft/60 px-4 py-1.5">
        <Icon size={11} className={cn('opacity-70', accent)} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          {label}
        </span>
      </div>
      <div className="divide-y divide-border/30">{children}</div>
    </div>
  )
}

function InputRow({
  label,
  value,
  onChange,
  onBlur,
  format,
}: {
  label: string
  value: number | null
  onChange: (v: string) => void
  onBlur?: () => void
  format: 'money' | 'int' | 'percent'
}) {
  const prefix = format === 'money' ? 'R$' : ''
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-1.5 transition-colors hover:bg-bg-soft/40">
      <span className="text-[12.5px] text-zinc-200">{label}</span>
      <div className="flex items-center gap-1 w-32">
        {prefix && <span className="text-[10.5px] font-medium text-muted shrink-0">{prefix}</span>}
        <input
          type="number"
          step={format === 'money' ? '0.01' : '1'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="0"
          className={cn(
            'h-7 w-full rounded-md border border-transparent bg-bg-soft/60 px-2 text-right text-[12.5px] font-medium text-zinc-100',
            'transition-all duration-150',
            'hover:border-border placeholder:text-muted/40',
            'focus:border-brand-500/60 focus:bg-bg-soft focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          )}
        />
      </div>
    </div>
  )
}

function CalcRow({
  label,
  formula,
  value,
  format,
  emphasis,
}: {
  label: string
  formula: string
  value: number | null
  format: 'money' | 'int' | 'percent' | 'multiplier'
  emphasis?: 'medium' | 'strong'
}) {
  let text: string
  if (value === null || Number.isNaN(value)) {
    text = '—'
  } else if (format === 'money') {
    text = formatCurrency(value)
  } else if (format === 'percent') {
    text = `${value.toFixed(2).replace('.', ',')}%`
  } else if (format === 'multiplier') {
    text = `${value.toFixed(2).replace('.', ',')}x`
  } else {
    text = Math.round(value).toString()
  }

  const isFilled = value !== null && !Number.isNaN(value)

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-1.5">
      <div className="min-w-0">
        <p className="text-[12.5px] text-zinc-300">{label}</p>
        <p className="text-[10px] italic text-muted/80 truncate">= {formula}</p>
      </div>
      <div
        className={cn(
          'w-32 rounded-md px-2 py-1 text-right text-[13px] font-semibold tabular-nums',
          !isFilled && 'text-muted',
          isFilled && emphasis === 'strong' && 'bg-emerald-500/10 text-emerald-300',
          isFilled && emphasis === 'medium' && 'text-zinc-100',
          isFilled && !emphasis && 'text-zinc-100',
        )}
      >
        {text}
      </div>
    </div>
  )
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

function combinaMes(m: Meta): Agregado {
  const res = normalize(m.resultado_data)
  const calcG = computeCalculos(res.google)
  const calcM = computeCalculos(res.meta)
  const investimento = (res.google.investimento ?? 0) + (res.meta.investimento ?? 0)
  const faturamento = (calcG.faturamento ?? 0) + (calcM.faturamento ?? 0)
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
  historico: Meta[]
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

/* =========================================================
   HistoricoChart — gráfico SVG nativo de Faturamento + ROAS
   ========================================================= */

function HistoricoChart({ historico }: { historico: Meta[] }) {
  // Inverte pra ordem cronológica (mais antigo → mais recente)
  const pontos = useMemo(() => {
    const arr = [...historico].reverse().map((m) => {
      const ag = combinaMes(m)
      return {
        mes: m.mes_ano,
        faturamento: ag.faturamento,
        roas: ag.roas,
      }
    })
    return arr
  }, [historico])

  // Escalas — só com base nos pontos (médias removidas do visual)
  const fatMax = Math.max(...pontos.map((p) => p.faturamento ?? 0), 1)
  const roasMax = Math.max(...pontos.map((p) => p.roas ?? 0), 1)

  // Dimensões do SVG
  const W = 800
  const H = 280
  const margin = { top: 24, right: 64, bottom: 36, left: 64 }
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom

  function x(i: number): number {
    if (pontos.length <= 1) return margin.left + innerW / 2
    return margin.left + (i / (pontos.length - 1)) * innerW
  }
  function yFat(v: number | null): number | null {
    if (v === null) return null
    return margin.top + innerH - (v / fatMax) * innerH
  }
  function yRoas(v: number | null): number | null {
    if (v === null) return null
    return margin.top + innerH - (v / roasMax) * innerH
  }

  /**
   * Constrói o `d` de um path com CURVAS SUAVES (Catmull-Rom convertido pra
   * cubic Bezier). Conecta só pontos válidos (≠ null) — se um valor é null,
   * a curva quebra e retoma no próximo válido.
   *
   * Fórmula Catmull-Rom → Bezier:
   *   Pra cada par de pontos consecutivos (P1, P2), os controles vêm dos
   *   vizinhos P0 e P3:
   *     C1 = P1 + (P2 - P0) / 6
   *     C2 = P2 - (P3 - P1) / 6
   *   Nas pontas (sem P0 ou P3), reflete o ponto disponível.
   */
  function smoothPath(
    values: (number | null)[],
    yFn: (v: number | null) => number | null,
  ): string {
    // Agrupa em "segmentos contíguos" — sempre que aparece um null, fecha o
    // segmento atual e abre um novo no próximo válido.
    const segments: Array<Array<{ x: number; y: number }>> = []
    let current: Array<{ x: number; y: number }> = []
    values.forEach((v, i) => {
      const yv = yFn(v)
      if (yv === null) {
        if (current.length > 0) segments.push(current)
        current = []
        return
      }
      current.push({ x: x(i), y: yv })
    })
    if (current.length > 0) segments.push(current)

    const out: string[] = []
    for (const seg of segments) {
      if (seg.length === 0) continue
      if (seg.length === 1) {
        // Ponto isolado — só um Move (renderiza como circle separadamente)
        out.push(`M${seg[0].x.toFixed(2)},${seg[0].y.toFixed(2)}`)
        continue
      }
      out.push(`M${seg[0].x.toFixed(2)},${seg[0].y.toFixed(2)}`)
      for (let i = 0; i < seg.length - 1; i++) {
        const p0 = seg[i - 1] ?? seg[i]
        const p1 = seg[i]
        const p2 = seg[i + 1]
        const p3 = seg[i + 2] ?? p2
        const c1x = p1.x + (p2.x - p0.x) / 6
        const c1y = p1.y + (p2.y - p0.y) / 6
        const c2x = p2.x - (p3.x - p1.x) / 6
        const c2y = p2.y - (p3.y - p1.y) / 6
        out.push(
          `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
        )
      }
    }
    return out.join(' ')
  }

  const dFat = smoothPath(
    pontos.map((p) => p.faturamento),
    yFat,
  )
  const dRoas = smoothPath(
    pontos.map((p) => p.roas),
    yRoas,
  )

  const COR_FAT = '#f97316' // laranja brand
  const COR_ROAS = '#10b981' // verde
  const COR_BORDA = 'var(--color-border, #404040)'

  // Ticks Y — 3 linhas horizontais (25%, 50%, 75%) só pra dar contexto
  const yTicks = [0.25, 0.5, 0.75]

  if (pontos.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        Sem dados pra exibir no gráfico.
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-4">
      {/* Legenda */}
      <div className="mb-2 flex items-center justify-center gap-4 text-[11px] text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_FAT }} />
          Faturamento
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_ROAS }} />
          ROAS
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Linhas de grade horizontais */}
        {yTicks.map((t) => {
          const y = margin.top + innerH * (1 - t)
          return (
            <line
              key={t}
              x1={margin.left}
              x2={margin.left + innerW}
              y1={y}
              y2={y}
              stroke={COR_BORDA}
              strokeWidth="0.5"
              strokeDasharray="2 4"
              opacity="0.4"
            />
          )
        })}

        {/* Eixo X linha de base */}
        <line
          x1={margin.left}
          x2={margin.left + innerW}
          y1={margin.top + innerH}
          y2={margin.top + innerH}
          stroke={COR_BORDA}
          strokeWidth="1"
        />

        {/* Eixo Y esquerdo — Faturamento (R$) */}
        <text
          x={margin.left - 8}
          y={margin.top + 4}
          fill="rgb(115 115 115)"
          fontSize="10"
          textAnchor="end"
        >
          {formatShort(fatMax)}
        </text>
        <text
          x={margin.left - 8}
          y={margin.top + innerH * 0.5 + 4}
          fill="rgb(115 115 115)"
          fontSize="10"
          textAnchor="end"
        >
          {formatShort(fatMax * 0.5)}
        </text>
        <text
          x={margin.left - 8}
          y={margin.top + innerH + 4}
          fill="rgb(115 115 115)"
          fontSize="10"
          textAnchor="end"
        >
          0
        </text>

        {/* Eixo Y direito — ROAS (x) */}
        <text
          x={margin.left + innerW + 8}
          y={margin.top + 4}
          fill="rgb(115 115 115)"
          fontSize="10"
        >
          {roasMax.toFixed(1)}x
        </text>
        <text
          x={margin.left + innerW + 8}
          y={margin.top + innerH * 0.5 + 4}
          fill="rgb(115 115 115)"
          fontSize="10"
        >
          {(roasMax * 0.5).toFixed(1)}x
        </text>
        <text
          x={margin.left + innerW + 8}
          y={margin.top + innerH + 4}
          fill="rgb(115 115 115)"
          fontSize="10"
        >
          0x
        </text>

        {/* Linha Faturamento */}
        {dFat && (
          <path
            d={dFat}
            fill="none"
            stroke={COR_FAT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Pontos Faturamento */}
        {pontos.map((p, i) => {
          const yv = yFat(p.faturamento)
          if (yv === null) return null
          return (
            <circle
              key={`fat-${i}`}
              cx={x(i)}
              cy={yv}
              r="3.5"
              fill={COR_FAT}
              stroke="#0a0a0a"
              strokeWidth="1.5"
            >
              <title>{`${shortMonth(p.mes)}: ${formatCurrency(p.faturamento ?? 0)}`}</title>
            </circle>
          )
        })}

        {/* Linha ROAS */}
        {dRoas && (
          <path
            d={dRoas}
            fill="none"
            stroke={COR_ROAS}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Pontos ROAS */}
        {pontos.map((p, i) => {
          const yv = yRoas(p.roas)
          if (yv === null) return null
          return (
            <circle
              key={`roas-${i}`}
              cx={x(i)}
              cy={yv}
              r="3.5"
              fill={COR_ROAS}
              stroke="#0a0a0a"
              strokeWidth="1.5"
            >
              <title>{`${shortMonth(p.mes)}: ${(p.roas ?? 0).toFixed(2)}x`}</title>
            </circle>
          )
        })}

        {/* Labels eixo X (meses) */}
        {pontos.map((p, i) => (
          <text
            key={`lbl-${i}`}
            x={x(i)}
            y={margin.top + innerH + 18}
            fill="rgb(115 115 115)"
            fontSize="10"
            textAnchor="middle"
          >
            {shortMonth(p.mes)}
          </text>
        ))}
      </svg>
    </Card>
  )
}

/** Formata número em "R$ X.XXXk" ou "R$ XM" pra economizar espaço no eixo. */
function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1_000) return `${Math.round(n / 1000)}k`
  return n.toFixed(0)
}

/** "2026-02-01" → "fev/26" */
function shortMonth(mesAno: string): string {
  try {
    const d = parseISO(mesAno)
    const mes = format(d, 'LLL', { locale: ptBR }).replace('.', '')
    const ano = format(d, 'yy')
    return `${mes}/${ano}`
  } catch {
    return mesAno
  }
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted/60">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        Auto-save
      </span>
    )
  }
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Salvando…
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 animate-fade-in">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
      Salvo
    </span>
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
