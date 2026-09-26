/**
 * Operacional › Gestão › Performance da Equipe — score individual por cargo,
 * com UMA métrica-chave por função (ver performanceCalculator.ts), num
 * ranking único e comparável (todas as métricas já são % 0–100).
 * Só admin (rota e menu).
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Gauge, Trophy, Users } from 'lucide-react'
import { PageHeader, KPICard, type Tone } from '@/components/ds'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { nivelDoScore } from '@/lib/metasPerformance'
import type { EventoMovimento } from '@/lib/scoreSquads'
import { useComercial } from '@/pages/comercial/store'
import type { Cliente, ItemSocialMedia, PlanejamentoSocialMedia, Profile, Squad, Tarefa } from '@/types/database'
import {
  CargoPerformanceGroup,
  PerformanceLegend,
  PerformanceRankingCard,
  useFaixasPerformance,
} from '@/components/performance/PerformanceComponents'
import {
  METRICA_POR_CARGO,
  ORDEM_CARGOS,
  calculateTeamPerformance,
  type DadosPerformance,
  type PeriodoPerformance,
} from './performanceCalculator'

type Periodo = '7d' | '30d' | '90d' | 'all'
const PERIODOS: { id: Periodo; label: string; dias: number | null }[] = [
  { id: '7d', label: '7 dias', dias: 7 },
  { id: '30d', label: '30 dias', dias: 30 },
  { id: '90d', label: '90 dias', dias: 90 },
  { id: 'all', label: 'Todo período', dias: null },
]

type DadosCarregados = Omit<DadosPerformance, 'hoje' | 'leads' | 'slaConfig'>

async function carregar(): Promise<DadosCarregados> {
  const comEquipe = '*, papel:papeis_operacionais!profiles_papel_fk(*), squad:squads!profiles_squad_fk(*)'
  const [pRes, cRes, tRes, pwRes, crRes, evRes, itRes, plRes, sqRes, movRes] = await Promise.all([
    supabase.from('profiles').select(comEquipe).order('nome'),
    supabase.from('clientes').select('*'),
    supabase.from('tarefas').select('id, status, data_vencimento, data_conclusao, responsavel_id, cliente_id'),
    supabase.from('projetos_webdesign').select('status, prazo, responsavel_id, cliente_id'),
    supabase.from('criativos_webdesign').select('status, prazo, responsavel_id, cliente_id'),
    supabase.from('edicoes_video').select('status, prazo, responsavel_id, cliente_id'),
    supabase.from('producoes_social_media_items').select('*'),
    supabase.from('producoes_social_media').select('id, cliente_id'),
    supabase.from('squads').select('*'),
    supabase.from('cliente_eventos').select('tipo, cliente_id, criado_em, meta').in('tipo', ['expansao', 'perda', 'churn']),
  ])
  // Sem as FKs da Equipe Operacional (083) → profiles sem papel/squad.
  const profiles = pRes.error ? ((await supabase.from('profiles').select('*').order('nome')).data as Profile[]) : (pRes.data as Profile[])
  type Prod = DadosPerformance['producao'][number]
  return {
    profiles: profiles ?? [],
    clientes: (cRes.data as Cliente[]) ?? [],
    tarefas: (tRes.data as Tarefa[]) ?? [],
    producao: [...((pwRes.data as Prod[]) ?? []), ...((crRes.data as Prod[]) ?? []), ...((evRes.data as Prod[]) ?? [])],
    itensSocial: (itRes.data as ItemSocialMedia[]) ?? [],
    planejamentos: (plRes.data as PlanejamentoSocialMedia[]) ?? [],
    squads: (sqRes.data as (Squad & { atual_indicacoes?: number | null })[]) ?? [],
    eventosMov: (movRes.data as EventoMovimento[]) ?? [],
  }
}

export default function PerformanceEquipe() {
  const { leads, slaConfig } = useComercial()
  const faixas = useFaixasPerformance()
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [dados, setDados] = useState<DadosCarregados | null>(null)
  const [verSemDados, setVerSemDados] = useState(false)

  useEffect(() => {
    carregar().then(setDados)
  }, [])

  const ranking = useMemo(() => {
    if (!dados) return []
    const hoje = new Date()
    const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? null
    const inicio = dias ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (dias - 1)) : null
    const p: PeriodoPerformance = { inicio, fim: hoje }
    return calculateTeamPerformance(p, { ...dados, hoje, leads, slaConfig })
  }, [dados, periodo, leads, slaConfig])

  const comScore = ranking.filter((r) => r.scorePercentual != null)
  const semDados = ranking.filter((r) => r.scorePercentual == null)
  const media = comScore.length ? Math.round(comScore.reduce((s, r) => s + (r.scorePercentual ?? 0), 0) / comScore.length) : null
  const destaque = comScore[0]
  const tomMedia: Tone =
    media == null ? 'neutral' : { bom: 'success', medio: 'warning', ruim: 'danger' }[nivelDoScore(media, faixas)] as Tone
  const cargos = ORDEM_CARGOS.filter((c) => ranking.some((r) => r.cargo === c))

  return (
    <div>
      <PageHeader
        title="Performance da Equipe"
        description="Score individual por cargo, com base na métrica-chave de cada função"
        actions={
          <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                  periodo === p.id ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      <PerformanceLegend />

      {!dados ? (
        <div className="mt-4 rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">Carregando…</div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KPICard
              icon={<Gauge size={13} />}
              label="Score médio do time"
              value={media != null ? `${media}%` : '—'}
              tone={tomMedia}
              sub="média simples dos scores individuais"
            />
            <KPICard
              icon={<Users size={13} />}
              label="Ativos no período"
              value={String(comScore.length)}
              sub={`de ${ranking.length} avaliáveis · com ao menos 1 dado`}
            />
            <KPICard
              icon={<Trophy size={13} />}
              label="Destaque do período"
              value={destaque ? `${destaque.scorePercentual}%` : '—'}
              tone={destaque ? 'success' : 'neutral'}
              sub={destaque ? `${destaque.colaborador.nome} · ${METRICA_POR_CARGO[destaque.cargo].cargo}` : 'sem dados no período'}
            />
          </div>

          {/* Ranking geral */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">Ranking geral</h3>
            {comScore.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-8 text-center text-xs text-muted">
                Ninguém com dados no período. Tente um período maior.
              </p>
            ) : (
              <ol className="space-y-2">
                {comScore.map((p, i) => (
                  <PerformanceRankingCard key={`${p.colaborador.origem}-${p.colaboradorId}`} p={p} posicao={i + 1} faixas={faixas} />
                ))}
              </ol>
            )}

            {semDados.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setVerSemDados((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-zinc-200"
                >
                  <ChevronDown size={12} className={cn('transition-transform', !verSemDados && '-rotate-90')} />
                  Sem dados no período ({semDados.length})
                </button>
                {verSemDados && (
                  <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {semDados.map((p) => (
                      <li key={`${p.colaborador.origem}-${p.colaboradorId}`} className="rounded-lg border border-border bg-bg-card px-3 py-2 text-xs">
                        <p className="truncate font-medium text-zinc-200">
                          {p.colaborador.nome} <span className="text-[10px] text-muted">· {METRICA_POR_CARGO[p.cargo].cargo}</span>
                        </p>
                        <p className="truncate text-[10px] text-muted">{p.colaborador.identificador}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Por cargo */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">Performance por cargo</h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {cargos.map((c) => (
                <CargoPerformanceGroup key={c} cargo={c} pessoas={ranking.filter((r) => r.cargo === c)} faixas={faixas} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
