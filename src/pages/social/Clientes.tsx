import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Eye,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
  Plus,
  Pencil,
  FileText,
  Instagram,
} from 'lucide-react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { ResumoSocialKpi } from '@/components/clientes/ResumoSocialKpi'
import { downloadRelatorioSemanalSocialPDF } from '@/components/social/RelatorioClientesSemanalPDF'
import { supabase } from '@/lib/supabase'
import { parseLocalDate } from '@/lib/dates'
import { temCargo, temAlgumCargo } from '@/lib/cargos'
import {
  cn,
  formatDate,
  JORNADAS_SOCIAL,
  jornadaSocialLabel,
  statusClienteLabel,
  tipoClienteLabel,
} from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Cliente,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
  Profile,
} from '@/types/database'

interface ClienteSocialStats {
  cliente: Cliente
  postagensMes: number
  concluidasMes: number
  /** Atrasadas DO MÊS CORRENTE (prazo passou e não publicou) */
  atrasadasMes: number
  /** Em produção — designer ainda mexendo (pendente/design/alteracao), prazo futuro */
  emProducaoFuturoMes: number
  /** Arte pronta, aguardando publicação (design_finalizado/em_aprovacao/conclusao), prazo futuro */
  prontasFuturoMes: number
  /** Data alvo pra apresentar o próximo plano — primeiro post da semana
   *  ANTERIOR à semana da última postagem (mesma regra do KPI do header). */
  apresentarProximoPlano: string | null
  /**
   * Dias do mês com posts. Ordenados por dia.
   * state:
   *   publicada  - publicado_em setado
   *   atrasada   - prazo passou sem publicar
   *   pronta     - arte finalizada, aguardando publicacao (futura)
   *   futura     - designer ainda mexendo (futura)
   */
  diasDoMes: Array<{
    dia: number
    state: 'publicada' | 'atrasada' | 'pronta' | 'futura'
    status: ItemSocialMedia['status']
    titulo: string
    formato: ItemSocialMedia['formato']
  }>
}

export default function SocialClientes({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [items, setItems] = useState<ItemSocialMedia[]>([])
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoSocialMedia[]>([])
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [q, setQ] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fSocial, setFSocial] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fJornada, setFJornada] = useState('')
  const [escopo, setEscopo] = useState<'meus' | 'todos'>(
    temCargo(profile, 'social_media') ? 'meus' : 'todos',
  )
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  // Toggle pra mostrar SOMENTE arquivados (churn). Só admin/diretoria/head veem.
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const isAdmin = profile?.role === 'admin'
  const podeVerArquivados =
    isAdmin || temAlgumCargo(profile, ['diretoria', 'head'])
  // Lista paralela de clientes do módulo SM SEM responsável atribuído —
  // mostra banner pro admin saber que precisa resolver.
  const [orfaos, setOrfaos] = useState<Cliente[]>([])
  const { nomes: squadsAtivos } = useSquads()

  async function load() {
    setLoading(true)
    const [cRes, oRes, pRes, iRes, profRes] = await Promise.all([
      supabase
        .from('clientes')
        .select(
          '*, account_manager:profiles!account_manager_id(*), social_media:profiles!social_media_id(*)',
        )
        // Só clientes do módulo social_media...
        .contains('modulos', ['social_media'])
        // ...e que têm uma Social Media responsável atribuída.
        // Quem está em SM precisa ter alguém da equipe responsável.
        .not('social_media_id', 'is', null)
        .order('nome'),
      // Órfãos: estão em SM mas sem responsável — pra alertar o admin
      supabase
        .from('clientes')
        .select('id, nome, modulos, social_media_id')
        .contains('modulos', ['social_media'])
        .is('social_media_id', null),
      supabase.from('producoes_social_media').select('*'),
      supabase.from('producoes_social_media_items').select('*'),
      // Filtro de "Todos social media" só lista quem é cargo social_media
      supabase
        .from('profiles')
        .select('*')
        .eq('ativo', true)
        .eq('aprovado', true)
        .eq('cargo', 'social_media')
        .order('nome'),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setOrfaos((oRes.data as Cliente[]) ?? [])
    setPlanejamentos((pRes.data as PlanejamentoSocialMedia[]) ?? [])
    setItems((iRes.data as ItemSocialMedia[]) ?? [])
    setResponsaveis((profRes.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Stats por cliente, escopadas ao MÊS CORRENTE.
  // diasDoMes agora inclui TODOS os posts do mês, cada um com state:
  //   - 'publicada'  = publicado_em != null
  //   - 'atrasada'   = prazo passou sem publicar
  //   - 'futura'     = prazo no futuro, ainda em produção
  // O strip visual do mês (PostsCell) pinta cada dia com base nesse state,
  // permitindo AM ver a distribuição completa (publicados + atrasados +
  // futuros) num relance.
  //
  // ⚠️ A fonte da verdade pra "publicada" é o campo publicado_em (timestamp
  // real de publicação), NÃO o status='conclusao' — esse último é só
  // "arte pronta", não significa que o post foi pro ar.
  const statsByCliente = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)
    const planById = new Map(planejamentos.map((p) => [p.id, p]))
    const map = new Map<string, ClienteSocialStats>()
    // Datas de postagem por cliente (ISO), pra calcular apresentarProximoPlano depois
    const postDatesPorCliente = new Map<string, string[]>()
    for (const c of clientes)
      map.set(c.id, {
        cliente: c,
        postagensMes: 0,
        concluidasMes: 0,
        atrasadasMes: 0,
        emProducaoFuturoMes: 0,
        prontasFuturoMes: 0,
        apresentarProximoPlano: null,
        diasDoMes: [],
      })

    for (const it of items) {
      const plan = planById.get(it.producao_id)
      if (!plan) continue
      const stat = map.get(plan.cliente_id)
      if (!stat) continue
      if (!it.prazo) continue
      const d = parseLocalDate(it.prazo)
      if (!d || d < monthStart || d > monthEnd) continue

      // Guarda o ISO pra calcular apresentarProximoPlano depois
      const arr = postDatesPorCliente.get(plan.cliente_id) ?? []
      arr.push(it.prazo.slice(0, 10))
      postDatesPorCliente.set(plan.cliente_id, arr)

      stat.postagensMes++
      const publicada = !!it.publicado_em
      if (publicada) stat.concluidasMes++

      if (publicada) {
        stat.diasDoMes.push({
          dia: d.getDate(),
          state: 'publicada',
          status: it.status,
          titulo: it.titulo,
          formato: it.formato,
        })
      } else if (d < today) {
        // Prazo passou e não publicou → atrasada
        stat.atrasadasMes++
        stat.diasDoMes.push({
          dia: d.getDate(),
          state: 'atrasada',
          status: it.status,
          titulo: it.titulo,
          formato: it.formato,
        })
      } else {
        // Prazo futuro. Divide em 2 sub-estados operacionais:
        //   pronta  = arte ja entregue, aguardando publicacao (tarefa do
        //             SM / cliente): design_finalizado, em_aprovacao,
        //             conclusao
        //   futura  = designer ainda mexendo (tarefa do designer):
        //             pendente, design, alteracao
        const artePronta =
          it.status === 'design_finalizado' ||
          it.status === 'em_aprovacao' ||
          it.status === 'conclusao'
        if (artePronta) {
          stat.prontasFuturoMes++
        } else {
          stat.emProducaoFuturoMes++
        }
        stat.diasDoMes.push({
          dia: d.getDate(),
          state: artePronta ? 'pronta' : 'futura',
          status: it.status,
          titulo: it.titulo,
          formato: it.formato,
        })
      }
    }
    // Ordena os dias por número
    for (const stat of map.values()) {
      stat.diasDoMes.sort((a, b) => a.dia - b.dia)
    }

    // Calcula apresentarProximoPlano por cliente (mesma regra do KPI do
    // header — SocialClienteHeader): primeira postagem da semana Mon-Sun
    // ANTERIOR a semana da ultima postagem. Fallback: segunda-feira da
    // semana anterior se ela nao tiver posts.
    for (const [clienteId, dates] of postDatesPorCliente.entries()) {
      const stat = map.get(clienteId)
      if (!stat || dates.length === 0) continue
      dates.sort()
      const lastPost = dates[dates.length - 1]
      const lastPostDate = new Date(lastPost + 'T12:00:00')
      const dow = lastPostDate.getDay() // 0=Dom, 1=Seg ... 6=Sab
      const daysBackToMon = dow === 0 ? 6 : dow - 1
      const weekStart = new Date(lastPostDate)
      weekStart.setDate(weekStart.getDate() - daysBackToMon)
      const prevWeekStart = new Date(weekStart)
      prevWeekStart.setDate(prevWeekStart.getDate() - 7)
      const prevWeekStartISO = prevWeekStart.toISOString().slice(0, 10)
      const weekStartISO = weekStart.toISOString().slice(0, 10)
      const firstOfPrevWeek = dates.find(
        (d) => d >= prevWeekStartISO && d < weekStartISO,
      )
      stat.apresentarProximoPlano = firstOfPrevWeek ?? prevWeekStartISO
    }

    return map
  }, [clientes, planejamentos, items])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      // Arquivados (churn): toggle decide se mostra só ativos (default) ou só arquivados
      const eArquivado = !!c.arquivado_em
      if (mostrarArquivados && !eArquivado) return false
      if (!mostrarArquivados && eArquivado) return false
      if (q && !c.nome.toLowerCase().includes(q.toLowerCase())) return false
      if (fSquad && c.squad !== fSquad) return false
      if (fSocial && c.social_media_id !== fSocial) return false
      if (fStatus && c.status !== fStatus) return false
      // Filtro usa a jornada específica de Social Media
      if (fJornada && c.jornada_social !== fJornada) return false
      if (escopo === 'meus' && profile && c.social_media_id !== profile.id) return false
      return true
    })
  }, [clientes, q, fSquad, fSocial, fStatus, fJornada, escopo, profile, mostrarArquivados])

  const acoes = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          setGerandoPdf(true)
          downloadRelatorioSemanalSocialPDF({
            clientes: filtered,
            items,
            planejamentos,
          }).finally(() => setGerandoPdf(false))
        }}
        disabled={gerandoPdf || loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300 disabled:opacity-50"
        title="Baixar PDF com publicadas, atrasadas e em produção desta semana"
      >
        <FileText size={13} />
        {gerandoPdf ? 'Gerando…' : 'Relatório semanal'}
      </button>
      <Button
        onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}
      >
        <Plus size={14} /> Novo cliente
      </Button>
    </div>
  )

  return (
    <div>
      {embedded ? (
        // Embutida na lista única — sem PageHeader próprio (o pai já tem).
        // Só a barra de ações fica visível, alinhada à direita.
        <div className="mb-4 flex items-center justify-end">{acoes}</div>
      ) : (
        <PageHeader
          title={
            mostrarArquivados ? 'Clientes arquivados · Social Media' : 'Clientes · Social Media'
          }
          description={
            mostrarArquivados
              ? `${filtered.length} ${filtered.length === 1 ? 'cliente arquivado' : 'clientes arquivados'} (churn)`
              : `${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'} sob acompanhamento`
          }
          actions={acoes}
        />
      )}

      {/* Banner de órfãos: clientes em SM sem responsável atribuído */}
      {orfaos.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
          <div className="flex items-start gap-2 text-xs text-amber-200">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">
                {orfaos.length} cliente{orfaos.length > 1 ? 's' : ''} em Social Media sem responsável atribuído
              </p>
              <p className="mt-0.5 opacity-90">
                Pra aparecer{orfaos.length > 1 ? 'em' : ''} na lista, atribua um Social Media responsável:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {orfaos.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setEditing(o)
                      setFormOpen(true)
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/25"
                  >
                    <Pencil size={9} />
                    {o.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo: tarefas do dia + atrasadas + clientes com problema de setup. */}
      <ResumoSocialKpi clientes={filtered} />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          {/* Toggle pessoal */}
          <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
            <button
              onClick={() => setEscopo('meus')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                escopo === 'meus'
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              Apenas meus
            </button>
            <button
              onClick={() => setEscopo('todos')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                escopo === 'todos'
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              Todo o time
            </button>
          </div>

          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={fSquad} onChange={(e) => setFSquad(e.target.value)} className="w-36">
            <option value="">Todas squads</option>
            {squadsAtivos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={fSocial} onChange={(e) => setFSocial(e.target.value)} className="w-44">
            <option value="">Todos social media</option>
            {responsaveis.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-32">
            <option value="">Todos status</option>
            <option value="ativo">Ativo</option>
            <option value="atencao">Atenção</option>
            <option value="pausado">Pausado</option>
            <option value="churn">Churn</option>
          </Select>
          <Select value={fJornada} onChange={(e) => setFJornada(e.target.value)} className="w-36">
            <option value="">Todas jornadas</option>
            {JORNADAS_SOCIAL.map((j) => (
              <option key={j} value={j}>
                {jornadaSocialLabel[j]}
              </option>
            ))}
          </Select>
          {podeVerArquivados && (
            <button
              type="button"
              onClick={() => setMostrarArquivados((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors',
                mostrarArquivados
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                  : 'border-border bg-bg-soft text-muted hover:border-amber-500/40 hover:text-amber-200',
              )}
              title="Mostrar apenas clientes arquivados (churn)"
            >
              {mostrarArquivados ? '↻ Voltar pra ativos' : '📁 Ver arquivados'}
            </button>
          )}
        </CardBody>
      </Card>

      <ClienteForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        cliente={editing}
        onSaved={load}
        defaultModulo="social_media"
      />

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-soft">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Squad</th>
                  <th className="px-3 py-2.5">Account Manager</th>
                  <th className="px-3 py-2.5">Social Media</th>
                  <th className="px-3 py-2.5">Publicações do mês</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Jornada</th>
                  <th className="px-3 py-2.5">Apresentar próximo plano</th>
                  <th className="px-3 py-2.5">Última atualização</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const stat = statsByCliente.get(c.id)
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-bg-soft">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/social/clientes/${c.id}`}
                              className="text-sm font-medium text-zinc-100 hover:text-pink-300"
                            >
                              {c.nome}
                            </Link>
                            {c.tipo && (
                              <Badge tone="neutral" className="shrink-0">
                                {tipoClienteLabel[c.tipo]}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {c.nicho && (
                              <span className="text-[11px] text-muted">{c.nicho}</span>
                            )}
                            {c.instagram_handle && (
                              <a
                                href={`https://instagram.com/${c.instagram_handle.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[11px] text-pink-300/80 hover:text-pink-300"
                                title="Abrir Instagram em nova aba"
                              >
                                <Instagram size={11} />
                                @{c.instagram_handle.replace(/^@/, '')}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">{c.squad ?? '—'}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {c.account_manager?.nome ?? '—'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {c.social_media ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={c.social_media.nome}
                                url={c.social_media.avatar_url}
                                size="sm"
                              />
                              <span className="text-sm text-zinc-200">{c.social_media.nome}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">— sem responsável —</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <PostsCell stats={stat} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Badge tone={statusTone(c.status)}>{statusClienteLabel[c.status]}</Badge>
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {c.jornada_social ? (
                            <Badge
                              tone={c.jornada_social === 'postando' ? 'success' : 'brand'}
                            >
                              {jornadaSocialLabel[c.jornada_social]}
                            </Badge>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <ApresentarProximoCell data={stat?.apresentarProximoPlano ?? null} />
                        </td>
                        <td className="px-3 py-3 text-xs text-muted whitespace-nowrap">
                          {formatDate(c.updated_at)}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => {
                                setEditing(c)
                                setFormOpen(true)
                              }}
                              className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-pink-300"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <Link
                              to={`/social/clientes/${c.id}`}
                              className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-pink-300"
                              title="Abrir detalhes"
                            >
                              <Eye size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

/**
 * Coluna "Publicações do mês": pills com o numero do dia de cada post.
 *   - Verde  = publicada (✓)
 *   - Vermelha = atrasada (⚠ prazo passou sem publicar)
 *   - Violeta = futura (⏳ em producao pra publicar)
 * Se um mesmo dia tem MULTIPLOS posts, aparece uma pill por post (nao
 * agrupa) — usuario ve a quantidade real.
 * Ordenado por dia ascendente. Sem cap — mostra todos, com wrap natural.
 * Rodape agregado embaixo (contadores por status).
 */
function PostsCell({ stats }: { stats?: ClienteSocialStats }) {
  if (
    !stats ||
    (stats.diasDoMes.length === 0 &&
      stats.emProducaoFuturoMes === 0 &&
      stats.prontasFuturoMes === 0)
  ) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
        <Sparkles size={11} className="opacity-50" />
        sem produção
      </span>
    )
  }

  type PillState = 'publicada' | 'atrasada' | 'pronta' | 'futura'

  const pillClass = (state: PillState): string => {
    switch (state) {
      case 'publicada':
        return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
      case 'atrasada':
        return 'border-red-500/50 bg-red-500/15 text-red-200'
      case 'pronta':
        return 'border-amber-500/50 bg-amber-500/15 text-amber-200'
      case 'futura':
        return 'border-violet-500/50 bg-violet-500/15 text-violet-200'
    }
  }

  const iconFor = (state: PillState) => {
    switch (state) {
      case 'publicada':
        return <CheckCircle2 size={9} className="shrink-0" />
      case 'atrasada':
        return <AlertCircle size={9} className="shrink-0" />
      case 'pronta':
        return <CheckCircle2 size={9} className="shrink-0" />
      case 'futura':
        return <Sparkles size={9} className="shrink-0" />
    }
  }

  const labelFor = (state: PillState) =>
    state === 'publicada'
      ? 'Publicada ✓'
      : state === 'atrasada'
        ? 'Não publicada (prazo passou)'
        : state === 'pronta'
          ? 'Arte pronta — aguardando publicação'
          : 'Em produção'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {stats.diasDoMes.map((d, i) => (
          <span
            key={`${d.dia}-${i}`}
            title={`Dia ${d.dia} · ${d.formato} · ${d.titulo} — ${labelFor(d.state)}`}
            className={cn(
              'inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[10px] font-semibold tabular-nums leading-none',
              pillClass(d.state),
            )}
          >
            {iconFor(d.state)}
            {d.dia}
          </span>
        ))}
      </div>
      {/* Rodape agregado */}
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span
          className="inline-flex items-center gap-0.5 text-emerald-300/90"
          title="Publicadas neste mês"
        >
          <CheckCircle2 size={9} />
          {stats.concluidasMes}
        </span>
        {stats.atrasadasMes > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-red-300"
            title="Não publicadas (prazo passou)"
          >
            <AlertCircle size={9} />
            {stats.atrasadasMes}
          </span>
        )}
        {stats.prontasFuturoMes > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-amber-300/90"
            title="Arte pronta, aguardando publicação (design_finalizado, em_aprovacao ou conclusao com prazo futuro)"
          >
            <CheckCircle2 size={9} />
            {stats.prontasFuturoMes} pronta{stats.prontasFuturoMes > 1 ? 's' : ''}
          </span>
        )}
        {stats.emProducaoFuturoMes > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-violet-300/90"
            title="Em produção — designer ainda trabalhando (pendente/design/alteração)"
          >
            <Sparkles size={9} />
            {stats.emProducaoFuturoMes} em produção
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Cell da coluna "Apresentar próximo plano". Mostra a data alvo
 * (primeira postagem da semana ANTERIOR a semana da ultima postagem —
 * mesma regra do KPI do header). Cor bate com a urgencia:
 *   - passada         -> vermelho (danger)
 *   - hoje ou <= 3d   -> ambar (warning)
 *   - > 3d            -> brand (rosa)
 *   - null            -> tracinho neutro
 */
function ApresentarProximoCell({ data }: { data: string | null }) {
  if (!data) {
    return <span className="text-xs text-muted">—</span>
  }
  const target = new Date(data + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dias = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const tone =
    dias < 0
      ? 'border-red-500/50 bg-red-500/15 text-red-200'
      : dias <= 3
        ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
        : 'border-brand-500/40 bg-brand-500/10 text-brand-200'
  const sub =
    dias < 0
      ? `${Math.abs(dias)}d atrasado`
      : dias === 0
        ? 'hoje'
        : dias === 1
          ? 'amanhã'
          : `em ${dias}d`
  return (
    <span
      className={cn(
        'inline-flex flex-col items-start gap-0 rounded-md border px-2 py-1 text-[11px] leading-tight',
        tone,
      )}
      title={`Alvo pra apresentar o próximo planejamento pro cliente (${sub})`}
    >
      <span className="tabular-nums font-medium">
        {target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
      </span>
      <span className="text-[9px] opacity-80">{sub}</span>
    </span>
  )
}

function statusTone(status: Cliente['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ativo':
      return 'success'
    case 'atencao':
      return 'warning'
    case 'pausado':
      return 'neutral'
    case 'churn':
      return 'danger'
  }
}
