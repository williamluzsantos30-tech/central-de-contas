/**
 * CampaignDetailModal — diagnóstico + ações de uma campanha (o "olho" da
 * tabela de campanhas). Genérico via adapter (Google Ads / Meta Ads).
 *
 *  1. Métricas da campanha vs. média da conta (CTR, CPA, conversão).
 *  2. Ritmo de entrega do orçamento.
 *  3. Ações rápidas: pausar/reativar, orçamento ±20% (API — simulada).
 *  4. Recomendações do motor de regras (campaignInsights), cada uma com
 *     "Aplicar" (quando executável) ou "Marcar como feito".
 *  5. Histórico: otimizações já registradas pra esta campanha.
 *
 * Toda ação aplicada ou marcada vira um registro REAL no Log de otimização
 * (tabela `otimizacoes`), com o prefixo "[Nome da campanha]" na descrição.
 */
import { useEffect, useState } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  Sparkles,
  Pause,
  Play,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  History,
  Zap,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatDate, tipoOtimizacaoLabel } from '@/lib/utils'
import type { Otimizacao, TipoOtimizacao } from '@/types/database'
import {
  formatKpi,
  statusCampanhaLabel,
  statusCampanhaTone,
  type AcaoCampanha,
  type AdsPlatformAdapter,
} from './adsPlatform'
import {
  descreverAcao,
  diagnosticarCampanha,
  mediasConta,
  metricasCampanha,
  rotuloAcao,
  tipoOtimizacaoDaAcao,
  type Recomendacao,
  type Severidade,
} from './campaignInsights'

const SEV: Record<Severidade, { label: string; icon: LucideIcon; card: string; pill: string }> = {
  critico: {
    label: 'Crítico',
    icon: AlertOctagon,
    card: 'border-red-500/40 bg-red-500/[0.04]',
    pill: 'border-red-500/40 bg-red-500/10 text-red-300',
  },
  atencao: {
    label: 'Atenção',
    icon: AlertTriangle,
    card: 'border-amber-500/40 bg-amber-500/[0.04]',
    pill: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  oportunidade: {
    label: 'Oportunidade',
    icon: Sparkles,
    card: 'border-emerald-500/30 bg-emerald-500/[0.03]',
    pill: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
}

const moeda = (v: number) => formatKpi(v, 'moeda')

type Comparacao = { texto: string; cls: string }
function comparar(valor: number, media: number, direcao: 'maior' | 'menor'): Comparacao | null {
  if (!media) return null
  const dif = (valor / media - 1) * 100
  if (Math.abs(dif) < 5) return { texto: '≈ na média da conta', cls: 'text-muted' }
  const bom = direcao === 'maior' ? dif > 0 : dif < 0
  return {
    texto: `${dif > 0 ? '▲' : '▼'} ${Math.abs(Math.round(dif))}% vs. média da conta`,
    cls: bom ? 'text-emerald-300' : 'text-red-300',
  }
}

export function CampaignDetailModal({
  adapter,
  clienteId,
  campanhaId,
  periodo,
  onClose,
  onChanged,
  onOtimizacaoRegistrada,
}: {
  adapter: AdsPlatformAdapter
  clienteId: string
  campanhaId: string
  periodo: string
  onClose: () => void
  /** Campanha mudou (status/orçamento) — a tabela precisa re-renderizar. */
  onChanged: () => void
  /** Registro criado no Log de otimização — a Ficha recarrega o log. */
  onOtimizacaoRegistrada?: () => void
}) {
  const { profile } = useAuth()
  const [, setNonce] = useState(0)
  const [registradas, setRegistradas] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)
  const [historico, setHistorico] = useState<Otimizacao[]>([])
  const [feito, setFeito] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const conta = adapter.getMetrics(clienteId, periodo)
  const c = conta?.campanhas.find((x) => x.id === campanhaId) ?? null
  const prefixo = c ? `[${c.nome}]` : ''

  async function carregarHistorico() {
    if (!prefixo) return
    const { data } = await supabase
      .from('otimizacoes')
      .select('*, responsavel:profiles(*)')
      .eq('cliente_id', clienteId)
      .eq('plataforma', adapter.key)
      .ilike('descricao', `${prefixo}%`)
      .order('data_otimizacao', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)
    setHistorico((data as Otimizacao[]) ?? [])
  }

  useEffect(() => {
    void carregarHistorico()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaId, adapter.key, clienteId])

  if (!conta || !c) return null

  const m = metricasCampanha(c, periodo)
  const media = mediasConta(conta)
  const recs = diagnosticarCampanha(adapter, c, conta, periodo)
  const Icon = adapter.icon

  async function registrar(tipo: TipoOtimizacao, descricao: string): Promise<boolean> {
    const { error } = await supabase.from('otimizacoes').insert({
      cliente_id: clienteId,
      responsavel_id: profile?.id ?? null,
      plataforma: adapter.key,
      tipo,
      descricao,
      resultado: null,
      data_otimizacao: new Date().toISOString().slice(0, 10),
    })
    if (error) {
      setErro(`A ação foi aplicada, mas não deu pra registrar no Log de otimização: ${error.message}`)
      return false
    }
    setErro(null)
    await carregarHistorico()
    onOtimizacaoRegistrada?.()
    return true
  }

  async function executar(acao: AcaoCampanha, rec?: Recomendacao) {
    if (!c) return
    if (acao.tipo === 'pausar' && !window.confirm(`Pausar a campanha "${c.nome}"?`)) return
    setOcupado(true)
    const descricaoAcao = descreverAcao(acao, c)
    const descricao = `${prefixo} ${descricaoAcao}${rec ? ` — ${rec.titulo}` : ''} (via ${adapter.nome}, simulado)`
    adapter.aplicarAcaoCampanha(c, acao)
    setNonce((n) => n + 1)
    onChanged()
    const ok = await registrar(tipoOtimizacaoDaAcao(acao), descricao)
    if (ok) {
      if (rec) setRegistradas((s) => new Set(s).add(rec.id))
      setFeito(`✓ ${descricaoAcao} — registrado no Log de otimização.`)
    }
    setOcupado(false)
  }

  async function marcarFeito(rec: Recomendacao) {
    setOcupado(true)
    const ok = await registrar(rec.tipoOtimizacao, `${prefixo} ${rec.titulo}: ${rec.acao}`)
    if (ok) {
      setRegistradas((s) => new Set(s).add(rec.id))
      setFeito(`✓ "${rec.titulo}" registrado no Log de otimização.`)
    }
    setOcupado(false)
  }

  const ritmoCor = m.ritmo >= 0.95 ? 'bg-sky-400' : m.ritmo < 0.6 ? 'bg-amber-400' : 'bg-emerald-400'
  const ritmoTexto =
    m.ritmo >= 0.95 ? 'limitada pelo orçamento' : m.ritmo < 0.6 ? 'entregando abaixo do orçamento' : 'dentro do esperado'

  return (
    <Modal
      open
      onClose={onClose}
      title={c.nome}
      className="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[10px] text-muted">
            Ações rodam em modo simulação (API do {adapter.nome} ainda não conectada) e ficam registradas no Log de
            otimização.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Identificação */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
              adapter.cores.badge,
            )}
          >
            <Icon size={10} /> {adapter.nome}
          </span>
          <span className="text-muted">
            {adapter.textos.tipoColuna}: <span className="text-zinc-200">{adapter.tipoCampanhaLabel(c.tipo)}</span>
          </span>
          <Badge tone={statusCampanhaTone[c.status]}>{statusCampanhaLabel[c.status]}</Badge>
        </div>

        {/* Métricas vs. média da conta */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile
            label="Investimento no mês"
            valor={moeda(c.investimentoMes)}
            sub={conta.investimento > 0 ? `${Math.round((c.investimentoMes / conta.investimento) * 100)}% da conta` : undefined}
          />
          <Tile label="CTR" valor={formatKpi(m.ctr, 'pct')} comp={comparar(m.ctr, media.ctr, 'maior')} />
          <Tile
            label={adapter.textos.cpaLabel}
            valor={m.cpa != null ? moeda(m.cpa) : '—'}
            sub={m.cpa == null ? 'sem conversões' : undefined}
            comp={m.cpa != null ? comparar(m.cpa, media.cpa, 'menor') : null}
          />
          <Tile
            label={adapter.textos.conversoesColuna}
            valor={formatKpi(c.conversoes, 'numero')}
            sub={`${formatKpi(m.taxaConversao, 'pct')} dos cliques`}
            comp={c.cliques > 0 ? comparar(m.taxaConversao, media.taxaConversao, 'maior') : null}
          />
        </div>

        {/* Entrega do orçamento */}
        <div className="rounded-lg border border-border bg-bg-soft/30 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-muted">
            <span>
              Orçamento diário <span className="font-semibold text-zinc-100">{moeda(c.orcamentoDiario)}</span>
            </span>
            <span>
              Gasto no mês <span className="text-zinc-200">{moeda(c.investimentoMes)}</span> de{' '}
              {moeda(m.gastoEsperado)} previstos até hoje ({m.diasDecorridos} dias)
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-soft">
            <div className={cn('h-full rounded-full transition-all', ritmoCor)} style={{ width: `${Math.min(100, m.ritmo * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Ritmo de entrega: {Math.round(m.ritmo * 100)}% — {ritmoTexto}
          </p>
        </div>

        {/* Ações rápidas */}
        {c.status !== 'removida' && (
          <div>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Ações rápidas</h4>
            <div className="flex flex-wrap gap-2">
              {c.status === 'ativa' && (
                <Button size="sm" variant="outline" disabled={ocupado} onClick={() => executar({ tipo: 'pausar' })}>
                  <Pause size={12} /> Pausar
                </Button>
              )}
              {c.status === 'pausada' && (
                <Button size="sm" variant="outline" disabled={ocupado} onClick={() => executar({ tipo: 'reativar' })}>
                  <Play size={12} /> Reativar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={ocupado}
                onClick={() => executar({ tipo: 'orcamento', percentual: -20 })}
              >
                <TrendingDown size={12} /> Orçamento −20%
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={ocupado}
                onClick={() => executar({ tipo: 'orcamento', percentual: 20 })}
              >
                <TrendingUp size={12} /> Orçamento +20%
              </Button>
            </div>
          </div>
        )}

        {feito && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {feito}
          </div>
        )}
        {erro && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
          </div>
        )}

        {/* Recomendações */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Recomendações pra melhorar o desempenho {recs.length > 0 && `(${recs.length})`}
          </h4>
          {c.status === 'removida' ? (
            <p className="text-xs text-muted">Campanha removida — sem recomendações.</p>
          ) : recs.length === 0 ? (
            <p className="text-xs text-muted">Nada a recomendar no momento.</p>
          ) : (
            <div className="space-y-2">
              {recs.map((r) => {
                const sev = SEV[r.severidade]
                const SevIcon = sev.icon
                const registrada = registradas.has(r.id)
                return (
                  <div key={r.id} className={cn('rounded-lg border p-3', sev.card)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                          sev.pill,
                        )}
                      >
                        <SevIcon size={10} /> {sev.label}
                      </span>
                      <p className="text-sm font-semibold text-zinc-100">{r.titulo}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{r.diagnostico}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
                      <span className="font-semibold text-zinc-100">O que fazer: </span>
                      {r.acao}
                    </p>
                    <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                      {registrada ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                          <CheckCircle2 size={12} /> Registrado no Log de otimização
                        </span>
                      ) : (
                        <>
                          {r.executavel && (
                            <Button size="sm" disabled={ocupado} onClick={() => executar(r.executavel!, r)}>
                              <Zap size={12} /> Aplicar: {rotuloAcao(r.executavel)}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => marcarFeito(r)}>
                            <ClipboardCheck size={12} /> {r.executavel ? 'Fiz manualmente' : 'Marcar como feito'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Histórico da campanha */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <History size={11} /> Otimizações registradas nesta campanha
          </h4>
          {historico.length === 0 ? (
            <p className="text-xs text-muted">
              Nenhuma ainda. O que você aplicar ou marcar aqui aparece nesta lista e no Log de otimização.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {historico.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-border bg-bg-soft/30 px-3 py-2 text-[11px]"
                >
                  <span className="tabular-nums text-muted">{formatDate(o.data_otimizacao)}</span>
                  <Badge tone="brand" className="!text-[9px]">
                    {tipoOtimizacaoLabel[o.tipo]}
                  </Badge>
                  <span className="min-w-0 flex-1 text-zinc-200">
                    {o.descricao.startsWith(prefixo) ? o.descricao.slice(prefixo.length).trim() : o.descricao}
                  </span>
                  {o.responsavel?.nome && <span className="text-muted">· {o.responsavel.nome}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Tile({ label, valor, sub, comp }: { label: string; valor: string; sub?: string; comp?: Comparacao | null }) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/30 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">{valor}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
      {comp && <p className={cn('text-[10px]', comp.cls)}>{comp.texto}</p>}
    </div>
  )
}
