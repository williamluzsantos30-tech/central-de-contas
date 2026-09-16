/**
 * Portal do Cliente — /publico/portal/:token
 *
 * Pagina read-only, sem login, onde o cliente da agencia acompanha:
 *   - Fase da jornada (onboarding / otimizacao / expansao / retencao)
 *   - Progresso do onboarding etapa por etapa
 *   - Contrato (tipo, datas, dias restantes)
 *   - Investimento mensal
 *   - Metricas mensais (investimento, leads, CPL, consultas, CAC,
 *     vendas, faturamento, ROAS) — dos ultimos meses preenchidos
 *   - Logins que a agencia liberou (visivel_portal=true)
 *   - Equipe responsavel
 *
 * Dados vem de uma unica RPC get_portal_publico(token). Branding
 * neutro (white-label) — o cliente ve a marca da agencia, nao da
 * plataforma.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  DollarSign,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  KeyRound,
  Rocket,
  TrendingUp,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  etapasParaModulos,
  progressoOnboarding,
  type OnboardingProgresso,
} from '@/lib/onboardingTemplate'
import type { MetasPorPlataforma, MetasValores } from '@/types/database'

// ---------- Tipos do payload da RPC ----------
interface PortalData {
  cliente: {
    nome: string
    nicho: string | null
    instagram_handle: string | null
    data_inicio: string
    jornada: string | null
    jornada_social: string | null
    modulos: string[]
    servicos_contratados: string[]
  }
  equipe: {
    account_manager: string | null
    gestor_trafego: string | null
    social_media: string | null
  }
  contrato: {
    tipo: string | null
    inicio: string | null
    fim: string | null
    status: string | null
  }
  investimento: {
    ticket_mensal: number | null
    verba_google: number | null
    verba_meta: number | null
  }
  pagamento: {
    dia_vencimento: number | null
    forma_pagamento: string | null
    valor: number | null
    agencia: {
      pix_chave?: string
      pix_tipo?: string
      pix_nome?: string
      razao_social?: string
      cnpj?: string
      instrucoes?: string
    }
  }
  onboarding_etapas: OnboardingProgresso
  logins: { plataforma: string; login: string; senha: string | null; url: string | null }[]
  metricas: {
    mes_ano: string
    resultado_data: MetasPorPlataforma | MetasValores | null
    meta_leads: number | null
    meta_cpl: number | null
    meta_vendas: number | null
  }[]
}

// ---------- Helpers ----------
function brl(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: digits,
  })
}

function dateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function mesLabel(mesAno: string): string {
  // mes_ano vem como "2026-09" ou "2026-09-01"
  const [y, m] = mesAno.split('-').map(Number)
  if (!y || !m) return mesAno
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

const JORNADA_LABEL: Record<string, { label: string; descricao: string; ordem: number }> = {
  onboarding: { label: 'Onboarding', descricao: 'Primeiros 30 dias — estruturando a base.', ordem: 0 },
  otimizacao: { label: 'Otimização', descricao: 'Campanhas rodando e sendo refinadas.', ordem: 1 },
  escala: { label: 'Escala', descricao: 'Escalando o que funciona.', ordem: 2 },
}
// Fases mostradas ao cliente (churn é estado interno, não vira tile).
const JORNADA_ORDEM = ['onboarding', 'otimizacao', 'escala']

const CONTRATO_TIPO_LABEL: Record<string, string> = {
  mensal: 'Mensal',
  '3_meses': '3 meses',
  '6_meses': '6 meses',
  '12_meses': '12 meses',
  anual: 'Anual',
  indefinido: 'Indefinido',
}

/** Soma google+meta (ou usa o objeto direto se for formato legado). */
function somaPlataformas(rd: MetasPorPlataforma | MetasValores | null): MetasValores {
  const zero: MetasValores = {
    investimento: 0,
    custo_mensagem: null,
    mensagens_qualificadas: 0,
    numero_consultas: 0,
    tm_consulta: null,
    numero_procedimentos: 0,
    tm_procedimento: null,
  }
  if (!rd) return zero
  const isPorPlataforma = 'google' in rd || 'meta' in rd
  if (!isPorPlataforma) return { ...zero, ...(rd as MetasValores) }
  const pp = rd as MetasPorPlataforma
  const plats = [pp.google, pp.meta].filter(Boolean) as MetasValores[]
  return {
    investimento: plats.reduce((s, p) => s + (p.investimento ?? 0), 0),
    custo_mensagem: null,
    mensagens_qualificadas: plats.reduce((s, p) => s + (p.mensagens_qualificadas ?? 0), 0),
    numero_consultas: plats.reduce((s, p) => s + (p.numero_consultas ?? 0), 0),
    // tm_* sao medias — guardamos a soma ponderada via faturamento abaixo
    tm_consulta: null,
    numero_procedimentos: plats.reduce((s, p) => s + (p.numero_procedimentos ?? 0), 0),
    tm_procedimento: null,
  }
}

/** Faturamento = Σ por plataforma (consultas×tm_consulta + proced×tm_proced). */
function faturamentoDe(rd: MetasPorPlataforma | MetasValores | null): number {
  if (!rd) return 0
  const calc = (p: MetasValores) =>
    (p.numero_consultas ?? 0) * (p.tm_consulta ?? 0) +
    (p.numero_procedimentos ?? 0) * (p.tm_procedimento ?? 0)
  const isPorPlataforma = 'google' in rd || 'meta' in rd
  if (!isPorPlataforma) return calc(rd as MetasValores)
  const pp = rd as MetasPorPlataforma
  return (pp.google ? calc(pp.google) : 0) + (pp.meta ? calc(pp.meta) : 0)
}

interface MesMetricas {
  mes_ano: string
  label: string
  investimento: number
  leads: number
  cpl: number | null
  consultas: number
  cac: number | null
  vendas: number
  faturamento: number
  roas: number | null
}

function derivaMetricas(rows: PortalData['metricas']): MesMetricas[] {
  return rows
    .map((r) => {
      const s = somaPlataformas(r.resultado_data)
      const inv = s.investimento ?? 0
      const leads = s.mensagens_qualificadas ?? 0
      const consultas = s.numero_consultas ?? 0
      const vendas = s.numero_procedimentos ?? 0
      const fat = faturamentoDe(r.resultado_data)
      return {
        mes_ano: r.mes_ano,
        label: mesLabel(r.mes_ano),
        investimento: inv,
        leads,
        cpl: inv > 0 && leads > 0 ? inv / leads : null,
        consultas,
        cac: inv > 0 && consultas > 0 ? inv / consultas : null,
        vendas,
        faturamento: fat,
        roas: inv > 0 && fat > 0 ? fat / inv : null,
      }
    })
    // so meses com algum dado preenchido
    .filter((m) => m.investimento > 0 || m.leads > 0 || m.consultas > 0 || m.vendas > 0)
}

// ============================================================
export default function PublicoPortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    supabase.rpc('get_portal_publico', { p_token: token }).then(({ data, error }) => {
      if (error || !data) {
        setErro('Link inválido ou expirado.')
      } else {
        setData(data as PortalData)
      }
      setLoading(false)
    })
  }, [token])

  const metricas = useMemo(() => (data ? derivaMetricas(data.metricas) : []), [data])
  const etapas = useMemo(
    () => (data ? etapasParaModulos(data.cliente.modulos) : []),
    [data],
  )
  const progresso = useMemo(
    () => (data ? progressoOnboarding(data.onboarding_etapas, data.cliente.modulos) : null),
    [data],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-zinc-100 flex items-center justify-center">
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    )
  }

  if (erro || !data) {
    return (
      <div className="min-h-screen bg-bg text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <p className="text-lg font-semibold text-red-200">Link inválido</p>
          <p className="mt-2 text-sm text-red-300/80">
            Esse link pode ter sido revogado. Peça à sua agência pra gerar um novo.
          </p>
        </div>
      </div>
    )
  }

  const c = data.cliente
  const jornadaAtual = c.jornada ?? 'onboarding'
  const jornadaIdx = JORNADA_ORDEM.indexOf(jornadaAtual)
  const ultimoMes = metricas[0] ?? null
  const diasContrato = (() => {
    if (!data.contrato.fim) return null
    const fim = new Date(data.contrato.fim + 'T12:00:00')
    const hoje = new Date()
    hoje.setHours(12, 0, 0, 0)
    return Math.round((fim.getTime() - hoje.getTime()) / 86400000)
  })()

  return (
    <div className="min-h-screen bg-bg text-zinc-100">
      {/* Header */}
      <header className="border-b border-border bg-black">
        <div className="mx-auto max-w-5xl px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Portal do Cliente</p>
            <h1 className="mt-1 text-xl font-bold text-zinc-100">{c.nome}</h1>
            {c.nicho && <p className="text-xs text-muted">{c.nicho}</p>}
          </div>
          <div className="flex items-center gap-2">
            {c.instagram_handle && (
              <a
                href={`https://instagram.com/${c.instagram_handle.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 hover:border-brand-500/40 hover:text-brand-300"
              >
                <ExternalLink size={12} />@{c.instagram_handle.replace(/^@/, '')}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-5">
        {/* ===== Fase da jornada ===== */}
        <section className="rounded-xl border border-border bg-bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Rocket size={14} className="text-brand-300" />
            <h2 className="text-sm font-semibold">Onde estamos</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {JORNADA_ORDEM.map((k, i) => {
              const cfg = JORNADA_LABEL[k]
              const ativa = i === jornadaIdx
              const passada = i < jornadaIdx
              return (
                <div
                  key={k}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    ativa
                      ? 'border-brand-500/60 bg-brand-500/10'
                      : passada
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                        : 'border-border bg-bg-soft/40 opacity-60',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {passada ? (
                      <CheckCircle2 size={12} className="text-emerald-300" />
                    ) : ativa ? (
                      <span className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
                    ) : (
                      <Circle size={12} className="text-muted" />
                    )}
                    <p
                      className={cn(
                        'text-xs font-semibold',
                        ativa ? 'text-brand-200' : passada ? 'text-emerald-200' : 'text-zinc-300',
                      )}
                    >
                      {cfg.label}
                    </p>
                  </div>
                  <p className="mt-1 text-[10px] text-muted leading-snug">{cfg.descricao}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ===== Onboarding checklist (destaque se ainda esta em onboarding) ===== */}
        {progresso && etapas.length > 0 && (jornadaAtual === 'onboarding' || progresso.pct < 1) && (
          <section className="rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-300" />
                <h2 className="text-sm font-semibold">Onboarding</h2>
              </div>
              <span className="text-xs text-muted tabular-nums">
                {progresso.concluidas} de {progresso.total} etapas
              </span>
            </div>
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-bg-elev">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.round(progresso.pct * 100)}%` }}
              />
            </div>
            <ol className="space-y-2">
              {etapas.map((e, i) => {
                const done = !!data.onboarding_etapas?.[e.key]?.concluido_em
                const proximaPendente =
                  !done && etapas.slice(0, i).every((p) => !!data.onboarding_etapas?.[p.key]?.concluido_em)
                return (
                  <li
                    key={e.key}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                        : proximaPendente
                          ? 'border-brand-500/40 bg-brand-500/[0.06]'
                          : 'border-border bg-bg-soft/30',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                        done
                          ? 'bg-emerald-500 text-white'
                          : proximaPendente
                            ? 'border border-brand-400 text-brand-300'
                            : 'border border-border text-muted',
                      )}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={cn(
                            'text-xs font-medium',
                            done ? 'text-emerald-200 line-through opacity-80' : 'text-zinc-100',
                          )}
                        >
                          {e.label}
                        </p>
                        {done && (
                          <span className="text-[10px] text-muted tabular-nums">
                            {dateBR(data.onboarding_etapas[e.key].concluido_em)}
                          </span>
                        )}
                        {proximaPendente && (
                          <span className="rounded border border-brand-500/40 bg-brand-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-brand-300">
                            em andamento
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{e.descricao}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {/* ===== Contrato + Investimento (lado a lado) ===== */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <FileText size={14} className="text-brand-300" />
              <h2 className="text-sm font-semibold">Contrato</h2>
            </div>
            {data.contrato.tipo || data.contrato.inicio ? (
              <div className="space-y-2 text-xs">
                <Linha label="Tipo" valor={CONTRATO_TIPO_LABEL[data.contrato.tipo ?? ''] ?? '—'} />
                <Linha label="Início" valor={dateBR(data.contrato.inicio)} />
                <Linha label="Fim" valor={dateBR(data.contrato.fim)} />
                <Linha
                  label="Dias restantes"
                  valor={
                    diasContrato === null ? (
                      '—'
                    ) : (
                      <span
                        className={cn(
                          'rounded border px-2 py-0.5 text-[10px] font-medium tabular-nums',
                          diasContrato < 0
                            ? 'border-red-500/50 bg-red-500/15 text-red-200'
                            : diasContrato < 30
                              ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                              : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
                        )}
                      >
                        {diasContrato < 0 ? `vencido há ${Math.abs(diasContrato)}d` : `${diasContrato}d`}
                      </span>
                    )
                  }
                />
                <Linha label="Cliente desde" valor={dateBR(c.data_inicio)} />
              </div>
            ) : (
              <p className="text-xs text-muted italic">Dados do contrato ainda não cadastrados.</p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign size={14} className="text-emerald-300" />
              <h2 className="text-sm font-semibold">Investimento mensal</h2>
            </div>
            <p className="text-3xl font-bold tabular-nums text-emerald-300">
              {brl(data.investimento.ticket_mensal)}
            </p>
            <p className="mt-1 text-[11px] text-muted">valor mensal do serviço</p>
            {((data.investimento.verba_google ?? 0) > 0 || (data.investimento.verba_meta ?? 0) > 0) && (
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Verba de anúncios
                </p>
                {(data.investimento.verba_google ?? 0) > 0 && (
                  <Linha label="Google Ads" valor={brl(data.investimento.verba_google)} />
                )}
                {(data.investimento.verba_meta ?? 0) > 0 && (
                  <Linha label="Meta Ads" valor={brl(data.investimento.verba_meta)} />
                )}
              </div>
            )}
          </section>
        </div>

        {/* ===== Pagamento ===== */}
        {(data.pagamento.dia_vencimento || data.pagamento.agencia?.pix_chave) && (
          <PagamentoSection pagamento={data.pagamento} />
        )}

        {/* ===== Metricas ===== */}
        <section className="rounded-xl border border-border bg-bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-brand-300" />
              <h2 className="text-sm font-semibold">Resultados</h2>
            </div>
            {ultimoMes && (
              <span className="text-[11px] text-muted">
                último mês fechado: <span className="text-zinc-200 capitalize">{ultimoMes.label}</span>
              </span>
            )}
          </div>

          {metricas.length === 0 ? (
            <p className="text-xs text-muted italic">
              Os resultados aparecem aqui assim que o primeiro mês de campanhas for fechado.
            </p>
          ) : (
            <>
              {/* KPIs do ultimo mes */}
              {ultimoMes && (
                <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi label="Investimento" valor={brl(ultimoMes.investimento)} />
                  <Kpi label="Leads" valor={String(ultimoMes.leads)} sub={`CPL ${brl(ultimoMes.cpl, 2)}`} />
                  <Kpi
                    label="Consultas"
                    valor={String(ultimoMes.consultas)}
                    sub={`CAC ${brl(ultimoMes.cac, 2)}`}
                  />
                  <Kpi
                    label="Faturamento"
                    valor={brl(ultimoMes.faturamento)}
                    sub={ultimoMes.roas !== null ? `ROAS ${ultimoMes.roas.toFixed(2)}x` : undefined}
                    tone="emerald"
                  />
                </div>
              )}

              {/* Tabela historico */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-bg-soft/40 text-[9px] uppercase tracking-wider text-muted">
                      <th className="px-3 py-2 text-left font-semibold">Mês</th>
                      <th className="px-3 py-2 text-right font-semibold">Investimento</th>
                      <th className="px-3 py-2 text-right font-semibold">Leads</th>
                      <th className="px-3 py-2 text-right font-semibold">CPL</th>
                      <th className="px-3 py-2 text-right font-semibold">Consultas</th>
                      <th className="px-3 py-2 text-right font-semibold">CAC</th>
                      <th className="px-3 py-2 text-right font-semibold">Vendas</th>
                      <th className="px-3 py-2 text-right font-semibold">Faturamento</th>
                      <th className="px-3 py-2 text-right font-semibold">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricas.map((m) => (
                      <tr key={m.mes_ano} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-2 capitalize text-zinc-200">{m.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{brl(m.investimento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.leads}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{brl(m.cpl, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.consultas}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{brl(m.cac, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.vendas}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-300">
                          {brl(m.faturamento)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {m.roas !== null ? (
                            <span
                              className={cn(
                                'rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                                m.roas >= 3
                                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                                  : m.roas >= 1.5
                                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                                    : 'border-red-500/50 bg-red-500/15 text-red-200',
                              )}
                            >
                              {m.roas.toFixed(2)}x
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* ===== Logins + Equipe (lado a lado) ===== */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound size={14} className="text-brand-300" />
              <h2 className="text-sm font-semibold">Seus acessos</h2>
            </div>
            {data.logins.length === 0 ? (
              <p className="text-xs text-muted italic">Nenhum acesso compartilhado por aqui ainda.</p>
            ) : (
              <div className="space-y-2">
                {data.logins.map((l, i) => (
                  <LoginCard key={`${l.plataforma}-${i}`} login={l} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users size={14} className="text-violet-300" />
              <h2 className="text-sm font-semibold">Sua equipe</h2>
            </div>
            <div className="space-y-2 text-xs">
              {data.equipe.account_manager && (
                <Linha label="Account Manager" valor={data.equipe.account_manager} />
              )}
              {data.equipe.gestor_trafego && (
                <Linha label="Gestor de Tráfego" valor={data.equipe.gestor_trafego} />
              )}
              {data.equipe.social_media && (
                <Linha label="Social Media" valor={data.equipe.social_media} />
              )}
              {!data.equipe.account_manager &&
                !data.equipe.gestor_trafego &&
                !data.equipe.social_media && (
                  <p className="text-muted italic">Equipe em definição.</p>
                )}
            </div>
          </section>
        </div>

        <p className="pb-4 pt-2 text-center text-[10px] text-muted">
          <Clock size={9} className="inline mr-1" />
          Portal atualizado em tempo real · acesso somente leitura
        </p>
      </main>
    </div>
  )
}

// ---------- Pagamento ----------
const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  outro: 'Outro',
}

/** Proximo vencimento a partir do dia do mes: se hoje ja passou do dia,
 *  vai pro mes seguinte. Clampa dia 31 em meses menores. */
function proximoVencimento(dia: number): Date {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const tenta = (y: number, m: number) => {
    const ultimoDia = new Date(y, m + 1, 0).getDate()
    return new Date(y, m, Math.min(dia, ultimoDia))
  }
  let d = tenta(hoje.getFullYear(), hoje.getMonth())
  if (d < hoje) d = tenta(hoje.getFullYear(), hoje.getMonth() + 1)
  return d
}

function PagamentoSection({ pagamento }: { pagamento: PortalData['pagamento'] }) {
  const [copiado, setCopiado] = useState(false)
  const ag = pagamento.agencia ?? {}
  const venc = pagamento.dia_vencimento ? proximoVencimento(pagamento.dia_vencimento) : null
  const diasAteVenc = venc
    ? Math.round((venc.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null

  async function copiarPix() {
    if (!ag.pix_chave) return
    try {
      await navigator.clipboard.writeText(ag.pix_chave)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* noop */
    }
  }

  return (
    <section className="rounded-xl border border-border bg-bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <DollarSign size={14} className="text-emerald-300" />
        <h2 className="text-sm font-semibold">Pagamento</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Proximo vencimento */}
        <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
            Próximo vencimento
          </p>
          {venc ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
                {venc.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </p>
              <p
                className={cn(
                  'mt-1 text-[11px] tabular-nums',
                  diasAteVenc !== null && diasAteVenc <= 3 ? 'text-amber-300' : 'text-muted',
                )}
              >
                {diasAteVenc === 0
                  ? 'vence hoje'
                  : diasAteVenc === 1
                    ? 'vence amanhã'
                    : `em ${diasAteVenc} dias`}
                {' · '}todo dia {pagamento.dia_vencimento}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted italic">Data a combinar com a agência.</p>
          )}
          <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
            <Linha label="Valor" valor={<span className="text-emerald-300">{brl(pagamento.valor)}</span>} />
            {pagamento.forma_pagamento && (
              <Linha
                label="Forma"
                valor={FORMA_PAGAMENTO_LABEL[pagamento.forma_pagamento] ?? pagamento.forma_pagamento}
              />
            )}
          </div>
        </div>

        {/* PIX da agencia */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
            Pagar via PIX
          </p>
          {ag.pix_chave ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded border border-emerald-500/30 bg-bg-elev px-2 py-1.5 font-mono text-[12px] text-zinc-100">
                  {ag.pix_chave}
                </code>
                <button
                  onClick={copiarPix}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    copiado
                      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
                  )}
                >
                  {copiado ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-muted">
                {ag.pix_tipo && <p>Tipo: <span className="text-zinc-300 uppercase">{ag.pix_tipo}</span></p>}
                {ag.pix_nome && <p>Favorecido: <span className="text-zinc-300">{ag.pix_nome}</span></p>}
                {ag.razao_social && <p>Razão social: <span className="text-zinc-300">{ag.razao_social}</span></p>}
                {ag.cnpj && <p>CNPJ: <span className="text-zinc-300 tabular-nums">{ag.cnpj}</span></p>}
              </div>
              {ag.instrucoes && (
                <p className="mt-3 rounded-md border border-border bg-bg-soft/40 px-3 py-2 text-[11px] text-zinc-300 whitespace-pre-wrap">
                  {ag.instrucoes}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs text-muted italic">
              Dados de pagamento serão disponibilizados pela agência.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------- Sub-componentes ----------
function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-zinc-100 text-right">{valor}</span>
    </div>
  )
}

function Kpi({
  label,
  valor,
  sub,
  tone = 'neutral',
}: {
  label: string
  valor: string
  sub?: string
  tone?: 'neutral' | 'emerald'
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums leading-none',
          tone === 'emerald' ? 'text-emerald-300' : 'text-zinc-100',
        )}
      >
        {valor}
      </p>
      {sub && <p className="mt-1.5 text-[10px] text-muted tabular-nums">{sub}</p>}
    </div>
  )
}

function LoginCard({
  login,
}: {
  login: { plataforma: string; login: string; senha: string | null; url: string | null }
}) {
  const [reveal, setReveal] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  async function copiar(v: string, k: string) {
    try {
      await navigator.clipboard.writeText(v)
      setCopiado(k)
      setTimeout(() => setCopiado((x) => (x === k ? null : x)), 1500)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-100">{login.plataforma}</p>
        {login.url && (
          <a
            href={login.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-brand-300 hover:underline"
          >
            <ExternalLink size={9} /> abrir
          </a>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        <Cred
          label="Login"
          valor={login.login}
          copiado={copiado === 'login'}
          onCopiar={() => copiar(login.login, 'login')}
        />
        {login.senha && (
          <Cred
            label="Senha"
            valor={reveal ? login.senha : '•'.repeat(Math.min(login.senha.length, 12))}
            copiado={copiado === 'senha'}
            onCopiar={() => copiar(login.senha!, 'senha')}
            onToggle={() => setReveal((v) => !v)}
            revelado={reveal}
          />
        )}
      </div>
    </div>
  )
}

function Cred({
  label,
  valor,
  copiado,
  onCopiar,
  onToggle,
  revelado,
}: {
  label: string
  valor: string
  copiado: boolean
  onCopiar: () => void
  onToggle?: () => void
  revelado?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <code className="flex-1 truncate rounded border border-border bg-bg-elev px-2 py-1 font-mono text-[11px] text-zinc-200">
        {valor}
      </code>
      {onToggle && (
        <button
          onClick={onToggle}
          className="rounded p-1 text-muted hover:bg-bg-elev hover:text-brand-300"
          title={revelado ? 'Ocultar' : 'Mostrar'}
        >
          {revelado ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      )}
      <button
        onClick={onCopiar}
        className={cn(
          'rounded p-1 text-muted hover:bg-bg-elev hover:text-brand-300',
          copiado && 'text-emerald-300',
        )}
        title="Copiar"
      >
        {copiado ? <CheckCircle2 size={11} /> : <Copy size={11} />}
      </button>
    </div>
  )
}
