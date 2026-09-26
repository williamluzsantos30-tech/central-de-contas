/**
 * Onboarding — aba de acompanhamento dos clientes em fase de entrada.
 *
 * Lista TODO cliente com jornada === 'onboarding' (nao-arquivado),
 * independente do status (ativo/atencao). Cada linha expande pra timeline
 * completa das etapas, com prazo (data_inicio + slaDia), data de
 * conclusao e status (concluida / atrasada / pendente).
 *
 * Fonte: clientes.onboarding_etapas (jsonb) + template em
 * src/lib/onboardingTemplate.ts. Prazos sao derivados — sem tabela
 * historica, sem migration. Marcar/desmarcar etapa grava concluido_em.
 * "Finalizar" move a jornada pra 'otimizacao' (dispara o evento que
 * alimenta o Tempo Medio de Onboarding na Visao Executiva).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  UserPlus,
  Calendar,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Send,
  CircleCheck,
  AlertTriangle,
  Loader2,
  RotateCw,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { FilterBar, FilterPill, ROW_TONE } from '@/components/ds'
import { supabase } from '@/lib/supabase'
import { buscarProfilesComPapel } from '@/lib/profilesComPapel'
import { temCargo } from '@/lib/cargos'
import { cn } from '@/lib/utils'
import { cargoLabel, type Cargo } from '@/lib/cargos'
import type { Cliente, Profile } from '@/types/database'
import {
  ONBOARDING_SLA_DIAS,
  prazoEtapa,
  resumoOnboarding,
  statusEtapa,
  type OnboardingEtapa,
  type OnboardingProgresso,
  type StatusEtapa,
} from '@/lib/onboardingTemplate'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function ddmm(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ddmmHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(
    d.getHours(),
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Resolve o responsavel de uma etapa pro membro do time do cliente. */
function responsavelDaEtapa(
  etapa: OnboardingEtapa,
  cliente: Cliente,
  profiles: Profile[],
): string {
  const idPorCargo: Partial<Record<Cargo, string | null>> = {
    account_manager: cliente.account_manager_id,
    gestor_trafego: cliente.gestor_id,
    social_media: cliente.social_media_id,
  }
  const id = idPorCargo[etapa.responsavel]
  if (id) {
    const p = profiles.find((x) => x.id === id)
    if (p) return p.nome
  }
  return cargoLabel[etapa.responsavel]
}

type PeriodoFiltro = '' | 'mes' | '30' | '90'

/** Survey de NPS de Onboarding (fonte central: tabela nps_surveys, tipo='onboarding'). */
interface NpsOnbSurvey {
  cliente_id: string
  token: string
  criado_em: string
  respondido_em: string | null
  nps_score: number | null
}

export default function Onboarding() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  // NPS D30 por cliente — a survey mais recente (tipo onboarding).
  const [npsPorCliente, setNpsPorCliente] = useState<Map<string, NpsOnbSurvey>>(new Map())
  const [enviandoNps, setEnviandoNps] = useState<string | null>(null)
  const [reenviar, setReenviar] = useState<{ cliente: Cliente; survey: NpsOnbSurvey } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [fPeriodo, setFPeriodo] = useState<PeriodoFiltro>('')
  const [fSquad, setFSquad] = useState('')
  const [fAM, setFAM] = useState('')
  const [fGestor, setFGestor] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [finalizar, setFinalizar] = useState<Cliente | null>(null)

  async function load() {
    setLoading(true)
    const [cRes, pRes, nRes] = await Promise.all([
      supabase.from('clientes').select('*').order('data_inicio', { ascending: true }),
      // Com o papel (Equipe Operacional) — AM/gestor saem de temCargo.
      buscarProfilesComPapel((sel) => supabase.from('profiles').select(sel).eq('ativo', true).eq('aprovado', true)),
      supabase
        .from('nps_surveys')
        .select('cliente_id, token, criado_em, respondido_em, nps_score')
        .eq('tipo', 'onboarding')
        .order('criado_em', { ascending: false }),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setProfiles((pRes.data as Profile[]) ?? [])
    // Mapa cliente → survey mais recente (já vem ordenado desc por criado_em).
    const m = new Map<string, NpsOnbSurvey>()
    for (const s of (nRes.data as NpsOnbSurvey[]) ?? []) if (!m.has(s.cliente_id)) m.set(s.cliente_id, s)
    setNpsPorCliente(m)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function avisar(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 4000)
  }

  // Dispara o NPS de Onboarding: cria a survey (nps_surveys, tipo onboarding),
  // gera o link público e copia pra área de transferência.
  async function enviarNpsOnboarding(cliente: Cliente) {
    setEnviandoNps(cliente.id)
    const { data, error } = await supabase
      .from('nps_surveys')
      .insert({ cliente_id: cliente.id, tipo: 'onboarding' })
      .select('cliente_id, token, criado_em, respondido_em, nps_score')
      .single()
    setEnviandoNps(null)
    setReenviar(null)
    if (error || !data) {
      avisar(`Erro ao enviar NPS: ${error?.message ?? 'tente novamente'}`)
      return
    }
    const survey = data as NpsOnbSurvey
    setNpsPorCliente((prev) => new Map(prev).set(cliente.id, survey))
    const url = `${window.location.origin}/publico/nps/${survey.token}`
    try {
      await navigator.clipboard?.writeText(url)
      avisar(`NPS de Onboarding enviado para ${cliente.nome} — link copiado`)
    } catch {
      avisar(`NPS de Onboarding enviado para ${cliente.nome}`)
    }
  }

  // Base: todo cliente em onboarding, nao-arquivado (qualquer status)
  const emOnboarding = useMemo(
    () => clientes.filter((c) => c.jornada === 'onboarding' && !c.arquivado_em),
    [clientes],
  )

  const squadsDistintos = useMemo(() => {
    const s = new Set<string>()
    for (const c of emOnboarding) if (c.squad) s.add(c.squad)
    return [...s].sort()
  }, [emOnboarding])

  const ams = useMemo(() => profiles.filter((p) => temCargo(p, 'account_manager')), [profiles])
  const gestores = useMemo(() => profiles.filter((p) => temCargo(p, 'gestor_trafego')), [profiles])

  const filtrados = useMemo(() => {
    const hoje = new Date()
    const limitePeriodo = (() => {
      if (fPeriodo === 'mes') return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      if (fPeriodo === '30') return new Date(hoje.getTime() - 30 * 86_400_000)
      if (fPeriodo === '90') return new Date(hoje.getTime() - 90 * 86_400_000)
      return null
    })()
    const q = busca.trim().toLowerCase()
    return emOnboarding.filter((c) => {
      if (fSquad && c.squad !== fSquad) return false
      if (fAM && c.account_manager_id !== fAM) return false
      if (fGestor && c.gestor_id !== fGestor) return false
      if (limitePeriodo && (!c.data_inicio || new Date(c.data_inicio) < limitePeriodo)) return false
      if (q && !c.nome.toLowerCase().includes(q) && !(c.nicho ?? '').toLowerCase().includes(q))
        return false
      return true
    })
  }, [emOnboarding, fSquad, fAM, fGestor, fPeriodo, busca])

  const kpis = useMemo(() => {
    const hoje = new Date()
    let noPrazo = 0
    let atrasados = 0
    let mrr = 0
    let somaDias = 0
    let etapasAtrasadas = 0
    for (const c of filtrados) {
      const r = resumoOnboarding(c, hoje)
      mrr += c.verba_mensal ?? 0
      somaDias += r.diasDecorridos
      etapasAtrasadas += r.etapasAtrasadas
      if (r.foraDoSla) atrasados++
      else noPrazo++
    }
    return {
      total: filtrados.length,
      noPrazo,
      atrasados,
      mrr,
      mediaDias: filtrados.length > 0 ? Math.round(somaDias / filtrados.length) : 0,
      etapasAtrasadas,
    }
  }, [filtrados])

  // Marca / desmarca etapa — grava concluido_em e atualiza local
  async function toggleEtapa(cliente: Cliente, key: string) {
    const atual = (cliente.onboarding_etapas as OnboardingProgresso | null) ?? {}
    const jaConcluida = !!atual[key]?.concluido_em
    const novo = { ...atual, [key]: { concluido_em: jaConcluida ? null : new Date().toISOString() } }
    // Otimista
    setClientes((prev) =>
      prev.map((c) => (c.id === cliente.id ? { ...c, onboarding_etapas: novo } : c)),
    )
    const { error } = await supabase
      .from('clientes')
      .update({ onboarding_etapas: novo })
      .eq('id', cliente.id)
    if (error) {
      alert(`Erro ao salvar: ${error.message}`)
      load()
    }
  }

  async function confirmarFinalizar() {
    if (!finalizar) return
    const { error } = await supabase
      .from('clientes')
      .update({ jornada: 'otimizacao' })
      .eq('id', finalizar.id)
    setFinalizar(null)
    if (error) {
      alert(`Erro: ${error.message}`)
      return
    }
    load()
  }

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Acompanhe o progresso dos clientes em fase de onboarding"
      />

      {/* KPI header */}
      <div className="mb-4 rounded-xl border border-border bg-bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Em onboarding
            </p>
            <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-emerald-300">
              {kpis.total}
            </p>
            <p className="mt-1.5 text-[10px] text-muted">SLA padrão: {ONBOARDING_SLA_DIAS} dias</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-5">
            <MiniStat valor={String(kpis.noPrazo)} label="No prazo" tone="emerald" />
            <MiniStat valor={String(kpis.atrasados)} label="Atrasados" tone="red" />
            <MiniStat valor={formatBRL(kpis.mrr)} label="MRR em Onboarding" tone="neutral" />
            <MiniStat valor={`${kpis.mediaDias}`} label="Média de dias" tone="neutral" />
            <MiniStat
              valor={String(kpis.etapasAtrasadas)}
              label="Etapas atrasadas"
              tone={kpis.etapasAtrasadas > 0 ? 'amber' : 'emerald'}
            />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <FilterBar className="mb-3">
        <FilterPill
          value={fPeriodo}
          onChange={(v) => setFPeriodo(v as PeriodoFiltro)}
          options={[
            { value: '', label: 'Todos os períodos' },
            { value: 'mes', label: 'Entraram este mês' },
            { value: '30', label: 'Últimos 30 dias' },
            { value: '90', label: 'Últimos 90 dias' },
          ]}
        />
        <FilterPill value={fSquad} onChange={setFSquad} placeholder="Todos os Squads" options={squadsDistintos.map((s) => ({ value: s, label: s }))} />
        <FilterPill value={fAM} onChange={setFAM} placeholder="Todos os AMs" options={ams.map((p) => ({ value: p.id, label: p.nome }))} />
        <FilterPill value={fGestor} onChange={setFGestor} placeholder="Todos os Gestores" options={gestores.map((p) => ({ value: p.id, label: p.nome }))} />
      </FilterBar>

      {/* Busca */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full rounded-lg border border-border bg-bg-card py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-muted focus:border-brand-500/60 focus:outline-none"
        />
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
          Carregando…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-12 text-center">
          <UserPlus size={22} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-zinc-200">Nenhum cliente em onboarding</p>
          <p className="mt-1 text-[11px] text-muted">
            Clientes com jornada “Onboarding” aparecem aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
          {/* Cabecalho */}
          <div className="hidden grid-cols-[minmax(200px,2fr)_80px_120px_96px_48px_44px_130px_minmax(140px,1.4fr)_72px_64px] items-center gap-3 border-b border-border bg-bg-soft/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted lg:grid">
            <span>Cliente</span>
            <span>Squad</span>
            <span>Account Manager</span>
            <span className="text-right">Ticket Mensal</span>
            <span className="text-right">Dias</span>
            <span className="text-right">SLA</span>
            <span>Progresso</span>
            <span>Etapa Atual</span>
            <span className="text-center">NPS D30</span>
            <span className="text-center">Semáforo</span>
          </div>

          {filtrados.map((c) => (
            <LinhaCliente
              key={c.id}
              cliente={c}
              profiles={profiles}
              survey={npsPorCliente.get(c.id) ?? null}
              enviandoNps={enviandoNps === c.id}
              onEnviarNps={() => enviarNpsOnboarding(c)}
              onReenviarNps={(s) => setReenviar({ cliente: c, survey: s })}
              expandido={expandido === c.id}
              onToggleExpandir={() => setExpandido((e) => (e === c.id ? null : c.id))}
              onToggleEtapa={(key) => toggleEtapa(c, key)}
              onFinalizar={() => setFinalizar(c)}
            />
          ))}
        </div>
      )}

      {finalizar && (
        <FinalizarModal
          cliente={finalizar}
          onClose={() => setFinalizar(null)}
          onConfirm={confirmarFinalizar}
        />
      )}

      {reenviar && (
        <ReenviarNpsModal
          nome={reenviar.cliente.nome}
          enviadoEm={reenviar.survey.criado_em}
          onClose={() => setReenviar(null)}
          onConfirm={() => enviarNpsOnboarding(reenviar.cliente)}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-2 rounded-lg border border-emerald-500/40 bg-bg-card px-4 py-3 text-xs text-zinc-100 shadow-xl">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />
          <span className="flex-1">{toast}</span>
          <button onClick={() => setToast(null)} className="text-muted hover:text-zinc-200">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------- Sub-componentes ----------------

function MiniStat({
  valor,
  label,
  tone,
}: {
  valor: string
  label: string
  tone: 'emerald' | 'red' | 'amber' | 'neutral'
}) {
  const cls = {
    emerald: 'text-emerald-300',
    red: 'text-red-300',
    amber: 'text-amber-300',
    neutral: 'text-zinc-100',
  }[tone]
  return (
    <div>
      <p className={cn('text-lg font-bold leading-none tabular-nums', cls)}>{valor}</p>
      <p className="mt-1 text-[10px] text-muted">{label}</p>
    </div>
  )
}

const semaforoDot: Record<'verde' | 'amarelo' | 'vermelho', string> = {
  verde: 'bg-emerald-400',
  amarelo: 'bg-amber-400',
  vermelho: 'bg-red-400',
}

function npsScoreCls(n: number): string {
  return n >= 9 ? 'text-emerald-300' : n >= 7 ? 'text-amber-300' : 'text-red-300'
}

/** Célula NPS D30 — 3 estados: nunca enviado / enviado (aguardando) / respondido. */
function NpsD30Cell({
  survey,
  enviando,
  onEnviar,
  onReenviar,
}: {
  survey: NpsOnbSurvey | null
  enviando: boolean
  onEnviar: () => void
  onReenviar: () => void
}) {
  if (enviando) return <Loader2 size={13} className="animate-spin text-brand-300" />

  // Respondido → mostra a nota (preenche a coluna).
  if (survey?.nps_score != null) {
    return (
      <span
        className={cn('text-sm font-bold tabular-nums', npsScoreCls(survey.nps_score))}
        title={`NPS Onboarding respondido${survey.respondido_em ? ` em ${ddmm(new Date(survey.respondido_em))}` : ''}`}
      >
        {survey.nps_score}
      </span>
    )
  }

  // Enviado, aguardando resposta → badge "Enviado {data}" + reenviar.
  if (survey) {
    return (
      <button
        type="button"
        onClick={onReenviar}
        title={`Enviado em ${ddmm(new Date(survey.criado_em))} — clique para reenviar`}
        className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
      >
        <CheckCircle2 size={10} /> {ddmm(new Date(survey.criado_em))}
        <RotateCw size={9} className="ml-0.5 opacity-70" />
      </button>
    )
  }

  // Nunca enviado → enviar.
  return (
    <button
      type="button"
      onClick={onEnviar}
      title="Enviar NPS de Onboarding (D30)"
      className="inline-flex items-center gap-1 text-[11px] text-brand-300 transition-colors hover:text-brand-200"
    >
      <Send size={11} /> Enviar
    </button>
  )
}

function ReenviarNpsModal({
  nome,
  enviadoEm,
  onClose,
  onConfirm,
}: {
  nome: string
  enviadoEm: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <Send size={16} className="text-brand-300" />
          <h3 className="text-sm font-semibold text-zinc-100">Reenviar NPS de Onboarding</h3>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          O NPS de Onboarding de <strong className="text-zinc-200">{nome}</strong> já foi enviado em{' '}
          <strong className="text-zinc-200">{ddmm(new Date(enviadoEm))}</strong>. Enviar novamente? Um novo link público será gerado.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-bg-elev">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-200 hover:bg-brand-500/25"
          >
            <Send size={13} /> Enviar novamente
          </button>
        </div>
      </div>
    </div>
  )
}

function LinhaCliente({
  cliente,
  profiles,
  survey,
  enviandoNps,
  onEnviarNps,
  onReenviarNps,
  expandido,
  onToggleExpandir,
  onToggleEtapa,
  onFinalizar,
}: {
  cliente: Cliente
  profiles: Profile[]
  survey: NpsOnbSurvey | null
  enviandoNps: boolean
  onEnviarNps: () => void
  onReenviarNps: (s: NpsOnbSurvey) => void
  expandido: boolean
  onToggleExpandir: () => void
  onToggleEtapa: (key: string) => void
  onFinalizar: () => void
}) {
  const r = useMemo(() => resumoOnboarding(cliente), [cliente])
  const am = profiles.find((p) => p.id === cliente.account_manager_id)
  const inicial = (cliente.nome || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="border-b border-border/60 last:border-b-0">
      {/* Linha principal */}
      <div
        onClick={onToggleExpandir}
        // Fora do SLA = linha inteira tingida (mesmo padrão do DataTable).
        className={cn(
          'grid cursor-pointer grid-cols-1 items-center gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(200px,2fr)_80px_120px_96px_48px_44px_130px_minmax(140px,1.4fr)_72px_64px]',
          r.foraDoSla ? ROW_TONE.danger : 'hover:bg-bg-soft/50',
        )}
      >
        {/* Cliente */}
        <div className="flex items-center gap-2.5">
          <span className="text-muted">
            {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/15 text-[11px] font-bold text-brand-300">
            {inicial}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-zinc-100">{cliente.nome}</span>
              {r.foraDoSla && (
                <span className="shrink-0 rounded border border-red-500/40 bg-red-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-red-300">
                  Fora do SLA
                </span>
              )}
            </div>
            {cliente.nicho && <p className="truncate text-[10px] text-muted">{cliente.nicho}</p>}
          </div>
        </div>

        {/* Squad */}
        <span className="text-xs text-zinc-300">{cliente.squad ?? '—'}</span>

        {/* AM */}
        <span className="truncate text-xs text-zinc-300">{am?.nome ?? '—'}</span>

        {/* Ticket */}
        <span className="text-right text-xs font-semibold tabular-nums text-zinc-100">
          {formatBRL(cliente.verba_mensal ?? 0)}
        </span>

        {/* Dias */}
        <span
          className={cn(
            'text-right text-xs font-semibold tabular-nums',
            r.foraDoSla ? 'text-red-300' : 'text-zinc-200',
          )}
        >
          {r.diasDecorridos}
        </span>

        {/* SLA */}
        <span className="text-right text-xs tabular-nums text-muted">{r.slaDias}</span>

        {/* Progresso */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elev">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                r.foraDoSla ? 'bg-red-500' : r.etapasAtrasadas > 0 ? 'bg-orange-500' : 'bg-brand-500',
              )}
              style={{ width: `${Math.round(r.pct * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted">
            {r.concluidas}/{r.total}
          </span>
        </div>

        {/* Etapa atual */}
        <span className="truncate text-xs text-zinc-300" title={r.proxima?.label}>
          {r.proxima ? r.proxima.label : 'Concluído'}
        </span>

        {/* NPS D30 */}
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <NpsD30Cell
            survey={survey}
            enviando={enviandoNps}
            onEnviar={onEnviarNps}
            onReenviar={() => survey && onReenviarNps(survey)}
          />
        </div>

        {/* Semaforo */}
        <div className="flex items-center justify-center">
          <span className={cn('h-2.5 w-2.5 rounded-full', semaforoDot[r.semaforo])} />
        </div>
      </div>

      {/* Detalhe expandido — timeline das etapas */}
      {expandido && (
        <div className="border-t border-border/60 bg-bg-soft/30 px-4 py-4">
          <TimelineOnboarding
            cliente={cliente}
            profiles={profiles}
            onToggleEtapa={onToggleEtapa}
            onFinalizar={onFinalizar}
          />
        </div>
      )}
    </div>
  )
}

const statusBadge: Record<StatusEtapa, { label: string; cls: string }> = {
  concluida: { label: 'Concluída', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  atrasada: { label: 'Atrasada', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
  pendente: { label: 'Pendente', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
}

function TimelineOnboarding({
  cliente,
  profiles,
  onToggleEtapa,
  onFinalizar,
}: {
  cliente: Cliente
  profiles: Profile[]
  onToggleEtapa: (key: string) => void
  onFinalizar: () => void
}) {
  const r = resumoOnboarding(cliente)
  const progresso = (cliente.onboarding_etapas as OnboardingProgresso | null) ?? {}

  return (
    <div>
      {/* Barra de progresso + SLA */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', semaforoDot[r.semaforo])} />
          <span className="text-xs font-semibold text-zinc-100 tabular-nums">
            {r.diasDecorridos} dias{' '}
            <span className="font-normal text-muted">/ {r.slaDias} SLA</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tabular-nums text-muted">
            {r.concluidas}/{r.total} etapas
          </span>
          <button
            type="button"
            onClick={onFinalizar}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <CircleCheck size={12} /> Finalizar onboarding
          </button>
        </div>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-bg-elev">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            r.foraDoSla ? 'bg-red-400' : r.etapasAtrasadas > 0 ? 'bg-amber-400' : 'bg-emerald-500',
          )}
          style={{ width: `${Math.round(r.pct * 100)}%` }}
        />
      </div>

      {/* Proxima etapa */}
      {r.proxima && (
        <div className="mb-4 rounded-lg border border-border bg-bg-elev px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Próxima etapa
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-100">{r.proxima.label}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Calendar size={11} /> {ddmm(r.proximaPrazo)}
            </span>
          </div>
        </div>
      )}

      {/* Lista de etapas */}
      <ol className="space-y-1.5">
        {r.etapas.map((etapa, i) => {
          const st = statusEtapa(etapa, progresso, cliente.data_inicio)
          const done = st === 'concluida'
          const prazo = prazoEtapa(cliente.data_inicio, etapa)
          const concluidoEm = progresso[etapa.key]?.concluido_em ?? null
          const resp = responsavelDaEtapa(etapa, cliente, profiles)
          const badge = statusBadge[st]
          return (
            <li
              key={etapa.key}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                done
                  ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                  : st === 'atrasada'
                    ? 'border-red-500/25 bg-red-500/[0.03]'
                    : 'border-border bg-bg-card',
              )}
            >
              {/* Indicador de status — numero (pendente) ou check verde (concluida) */}
              <span
                className={cn(
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                  done ? 'bg-emerald-500 text-white' : 'border border-border text-muted',
                )}
              >
                {done ? <CheckCircle2 size={13} /> : i + 1}
              </span>

              {/* Conteudo */}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-medium',
                    done ? 'text-zinc-400 line-through' : 'text-zinc-100',
                  )}
                >
                  {etapa.label}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-bg-elev text-[8px] font-bold text-brand-300">
                      {resp.charAt(0).toUpperCase()}
                    </span>
                    {resp}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={10} /> {ddmm(prazo)}
                  </span>
                  {concluidoEm && (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircle2 size={10} /> {ddmmHora(concluidoEm)}
                    </span>
                  )}
                </div>
              </div>

              {/* Acoes — badge de status + botao concluir */}
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                    badge.cls,
                  )}
                >
                  {badge.label}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleEtapa(etapa.key)}
                  title={done ? 'Concluída — clique para reabrir' : 'Marcar como concluída'}
                  aria-label={done ? 'Reabrir etapa' : 'Concluir etapa'}
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-md border transition-colors',
                    done
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                      : 'border-border text-muted hover:border-emerald-500/50 hover:text-emerald-300',
                  )}
                >
                  {done ? <CircleCheck size={15} /> : <Circle size={15} />}
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function FinalizarModal({
  cliente,
  onClose,
  onConfirm,
}: {
  cliente: Cliente
  onClose: () => void
  onConfirm: () => void
}) {
  const r = resumoOnboarding(cliente)
  const incompletas = r.total - r.concluidas
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2">
          <CircleCheck size={16} className="text-emerald-300" />
          <h3 className="text-sm font-semibold text-zinc-100">Finalizar onboarding</h3>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          <strong className="text-zinc-200">{cliente.nome}</strong> passa da jornada Onboarding para{' '}
          <strong className="text-zinc-200">Otimização</strong> e sai desta lista. O tempo de
          onboarding entra na média da Visão Executiva.
        </p>

        {incompletas > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-300" />
            <span>
              Ainda há {incompletas} {incompletas === 1 ? 'etapa' : 'etapas'} não concluída
              {incompletas === 1 ? '' : 's'}. Você pode finalizar mesmo assim.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-bg-elev"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25"
          >
            <CircleCheck size={13} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

