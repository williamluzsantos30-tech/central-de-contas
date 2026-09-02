/**
 * Calendário público do cliente — acessado via link
 * `/publico/calendario/:token`. NÃO exige login.
 *
 * Chama a RPC `get_calendario_publico(token)` que devolve só os posts
 * do cliente daquele token. Renderiza uma versão read-only do
 * calendário, sem sidebar/menu, só o essencial pro cliente acompanhar.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Film,
  LayoutGrid,
  ExternalLink,
  ThumbsUp,
  MessageSquareWarning,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatDateBR } from '@/lib/dates'

interface PostPublico {
  cliente_nome: string
  cliente_id: string
  cliente_instagram: string | null
  item_id: string
  formato: string
  titulo: string
  ideia_conteudo: string | null
  /** Caption do post no Instagram (texto abaixo da arte). So vem
   *  preenchida quando o item esta em em_aprovacao ou conclusao. */
  legenda: string | null
  status: string
  prazo: string
  publicado_em: string | null
  publicado_url: string | null
  /**
   * Array de URLs das artes prontas — só vem preenchido quando
   * status = 'conclusao' ou publicado_em está setado. Rascunho fica []
   * (regra na RPC pra não vazar arte incompleta).
   */
  artes_prontas: string[]
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const formatoIcon: Record<string, React.ComponentType<{ size?: number }>> = {
  carrossel: LayoutGrid,
  estatico: ImageIcon,
  reel: Film,
  outro: ImageIcon,
}

const formatoBg: Record<string, string> = {
  carrossel: 'bg-pink-500/15 text-pink-200 border-pink-500/30',
  estatico: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
  reel: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  outro: 'bg-zinc-500/15 text-zinc-200 border-zinc-500/30',
}

export default function PublicoCalendario() {
  const { token } = useParams<{ token: string }>()
  const [posts, setPosts] = useState<PostPublico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  async function carregar(withLoading = true) {
    if (!token) return
    if (withLoading) setLoading(true)
    const { data, error } = await supabase
      .rpc('get_calendario_publico', { p_token: token })
    if (error) {
      setErro('Link inválido ou expirado.')
      setLoading(false)
      return
    }
    setPosts((data ?? []) as PostPublico[])
    setErro(null)
    setLoading(false)
  }

  useEffect(() => {
    carregar(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const clienteNome = posts[0]?.cliente_nome ?? ''
  const clienteInsta = posts[0]?.cliente_instagram ?? null

  // Semanas do mês (grid 7 × N)
  const semanas = useMemo(() => buildCalendar(mesISO), [mesISO])

  // Items do mês (filtrados)
  const postsPorDia = useMemo(() => {
    const m = mesISO.slice(0, 7)
    const map = new Map<string, PostPublico[]>()
    for (const p of posts) {
      if (!p.prazo.startsWith(m)) continue
      const arr = map.get(p.prazo) ?? []
      arr.push(p)
      map.set(p.prazo, arr)
    }
    return map
  }, [posts, mesISO])

  const totalMes = useMemo(() => {
    let t = 0, publ = 0
    for (const [, arr] of postsPorDia) {
      t += arr.length
      publ += arr.filter((p) => !!p.publicado_em).length
    }
    return { total: t, publicados: publ }
  }, [postsPorDia])

  function shiftMes(delta: number) {
    // Bug antes: `new Date(mesISO)` interpreta "2026-07-01" como UTC midnight.
    // Em Brasil (UTC-3) vira 2026-06-30 21:00 local, entao getMonth() retorna
    // Junho. +1 volta pra Julho — travava no mesmo mes. Fix: parse manual
    // dos componentes; o constructor Date(y, m, d) usa timezone LOCAL.
    const [y, m] = mesISO.split('-').map(Number)
    const nova = new Date(y, m - 1 + delta, 1)
    setMesISO(`${nova.getFullYear()}-${String(nova.getMonth() + 1).padStart(2, '0')}-01`)
  }

  function goHoje() {
    const d = new Date()
    setMesISO(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  // Mesma correcao — new Date(mesISO) shift de timezone. Parse manual +
  // constructor Date(y, m, d) mantem a data em local time.
  const mesLabel = (() => {
    const [y, m] = mesISO.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
  })()

  return (
    <div className="min-h-screen bg-bg text-zinc-100">
      {/* Header fixo */}
      <header className="border-b border-border bg-black">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-movmed.png" alt="MovMed" className="h-9 w-auto object-contain" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 leading-none">
                Central de Contas
              </p>
              <p className="mt-1 text-xs text-zinc-200">
                Calendário de postagens
                {clienteNome && (
                  <>
                    {' '}·{' '}
                    <span className="font-semibold text-brand-300">{clienteNome}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          {clienteInsta && (
            <a
              href={`https://instagram.com/${clienteInsta.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 hover:border-brand-500/40 hover:text-brand-300"
            >
              <ExternalLink size={12} />@{clienteInsta.replace(/^@/, '')}
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {loading ? (
          <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-muted">
            Carregando…
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-8 text-center">
            <p className="text-lg font-semibold text-red-200">Link inválido</p>
            <p className="mt-2 text-sm text-red-300/80">
              Esse link pode ter sido revogado. Peça à equipe MovMed pra gerar
              um novo.
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-soft/40 p-12 text-center">
            <p className="text-sm text-zinc-200">Nenhuma postagem programada ainda.</p>
            <p className="mt-1 text-xs text-muted">
              Assim que o planejamento for aprovado, as postagens aparecem aqui.
            </p>
          </div>
        ) : (
          <>
            {/* Navegador do mês + resumo */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => shiftMes(-1)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
                >
                  <ChevronLeft size={14} />
                </button>
                <h1 className="text-lg font-semibold capitalize">{mesLabel}</h1>
                <button
                  onClick={() => shiftMes(1)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-bg-elev hover:text-zinc-100"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={goHoje}
                  className="ml-2 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-xs text-zinc-200 hover:border-brand-500/40 hover:text-brand-300"
                >
                  hoje
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-2 py-1">
                  <Clock size={11} className="text-amber-300" />
                  {totalMes.total - totalMes.publicados} programado
                  {totalMes.total - totalMes.publicados === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                  <CheckCircle2 size={11} />
                  {totalMes.publicados} publicado
                  {totalMes.publicados === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* Legenda das bolinhas de status */}
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-[10px] text-muted">
              <span className="font-semibold uppercase tracking-wider text-zinc-300">
                Legenda:
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400/50" />
                Programado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_5px_rgba(167,139,250,0.7)]" />
                Em aprovação
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_5px_rgba(56,189,248,0.7)]" />
                Arte pronta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                Publicado
              </span>
              <span className="ml-auto italic">
                Clique num dia pra ver detalhes e artes
              </span>
            </div>

            {/* Grid do calendário */}
            <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
              {/* Header dos dias */}
              <div className="grid grid-cols-7 border-b border-border bg-bg-soft/50">
                {DIAS_SEMANA.map((d) => (
                  <div
                    key={d}
                    className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Grid */}
              <div>
                {semanas.map((semana, i) => (
                  <div key={i} className="grid grid-cols-7 border-b border-border last:border-b-0">
                    {semana.map((dia, j) => {
                      if (!dia) {
                        return (
                          <div
                            key={`${i}-${j}`}
                            className="min-h-[100px] border-r border-border last:border-r-0 bg-bg-soft/20"
                          />
                        )
                      }
                      const dateISO = formatDateISO(dia)
                      const postsDoDia = postsPorDia.get(dateISO) ?? []
                      const isHoje = dateISO === todayISO()
                      return (
                        <button
                          key={`${i}-${j}`}
                          onClick={() =>
                            postsDoDia.length > 0 && setDiaSelecionado(dateISO)
                          }
                          className={cn(
                            'min-h-[100px] border-r border-border last:border-r-0 p-1.5 text-left transition-colors',
                            postsDoDia.length > 0 && 'cursor-pointer hover:bg-bg-soft',
                            isHoje && 'bg-brand-500/5',
                          )}
                        >
                          <div className="flex items-center justify-between px-1">
                            <span
                              className={cn(
                                'text-xs font-medium',
                                isHoje ? 'text-brand-300' : 'text-zinc-300',
                              )}
                            >
                              {dia.getDate()}
                            </span>
                            {postsDoDia.length > 0 && (
                              <span className="text-[9px] text-muted">
                                {postsDoDia.length}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-col gap-1">
                            {postsDoDia.slice(0, 2).map((p) => (
                              <PostPill key={p.item_id} post={p} />
                            ))}
                            {postsDoDia.length > 2 && (
                              <span className="text-[9px] text-muted pl-1">
                                +{postsDoDia.length - 2}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé com créditos */}
            <p className="mt-6 text-center text-[10px] text-muted">
              Calendário gerado automaticamente pela MovMed · atualizado em tempo real
            </p>
          </>
        )}
      </main>

      {/* Modal do dia selecionado */}
      {diaSelecionado && (
        <DiaModal
          dataISO={diaSelecionado}
          posts={postsPorDia.get(diaSelecionado) ?? []}
          token={token ?? ''}
          onClose={() => setDiaSelecionado(null)}
          onRefetch={() => carregar(false)}
        />
      )}
    </div>
  )
}

function PostPill({ post }: { post: PostPublico }) {
  const publicado = !!post.publicado_em
  const concluido = post.status === 'conclusao'
  const emAprovacao = post.status === 'em_aprovacao'
  const Icon = formatoIcon[post.formato] ?? ImageIcon
  const cls = formatoBg[post.formato] ?? formatoBg.outro

  // Bolinha de status na esquerda do pill — permite ver de relance o
  // que precisa de atenção sem abrir o modal.
  //   emerald+glow = publicado
  //   sky+glow     = arte pronta (conclusao)
  //   violet+glow  = em aprovação (cliente precisa aprovar)
  //   amber suave  = programado (rascunho)
  const statusDot = publicado
    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]'
    : concluido
      ? 'bg-sky-400 shadow-[0_0_5px_rgba(56,189,248,0.7)]'
      : emAprovacao
        ? 'bg-violet-400 shadow-[0_0_5px_rgba(167,139,250,0.7)]'
        : 'bg-amber-400/50'

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]',
        publicado ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : cls,
      )}
      title={
        publicado
          ? 'Publicado'
          : concluido
            ? 'Arte pronta'
            : emAprovacao
              ? 'Em aprovação'
              : 'Programado'
      }
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot)} />
      <Icon size={9} />
      <span className="truncate">{post.titulo || 'Sem título'}</span>
    </div>
  )
}

function DiaModal({
  dataISO,
  posts,
  token,
  onClose,
  onRefetch,
}: {
  dataISO: string
  posts: PostPublico[]
  token: string
  onClose: () => void
  onRefetch: () => void | Promise<void>
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-bg-card"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold capitalize">
            {new Date(dataISO + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            })}
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-zinc-200"
          >
            Fechar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
          {posts.map((p) => {
            const publicado = !!p.publicado_em
            const concluido = p.status === 'conclusao'
            const emAprovacao = p.status === 'em_aprovacao'
            const Icon = formatoIcon[p.formato] ?? ImageIcon
            const artes = p.artes_prontas ?? []
            return (
              <div key={p.item_id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                      formatoBg[p.formato] ?? formatoBg.outro,
                    )}
                  >
                    <Icon size={9} />
                    {p.formato}
                  </span>
                  {publicado ? (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                      <CheckCircle2 size={9} /> Publicado
                    </span>
                  ) : concluido ? (
                    <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-200">
                      <CheckCircle2 size={9} /> Arte pronta
                    </span>
                  ) : emAprovacao ? (
                    <span className="inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-200">
                      <Clock size={9} /> Em aprovação
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                      <Clock size={9} /> Programado
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-zinc-100">
                  {p.titulo || 'Sem título'}
                </p>
                {p.ideia_conteudo && (
                  <p className="mt-1 text-xs text-muted whitespace-pre-wrap">
                    {p.ideia_conteudo}
                  </p>
                )}

                {/* Legenda do post — a caption que vai abaixo da arte no
                    Instagram. Backend so expoe quando status = em_aprovacao
                    ou conclusao (regra na RPC), pra nao vazar copy nao pronta. */}
                {p.legenda && (
                  <div className="mt-3 rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">
                      Legenda do post
                    </p>
                    <p className="text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed">
                      {p.legenda}
                    </p>
                  </div>
                )}

                {/* Galeria de artes — só aparece quando concluído ou publicado
                    (backend controla isso na RPC; artes_prontas vem [] pra
                    rascunho). */}
                {artes.length > 0 && (
                  <GaleriaArtes artes={artes} formato={p.formato} />
                )}

                {/* Aprovacao pelo cliente — so aparece quando o item esta
                    aguardando decisao. Depois de aprovado ou reprovado a
                    RPC filtra por status='em_aprovacao', entao os botoes
                    somem naturalmente no proximo refetch. */}
                {emAprovacao && (
                  <AprovacaoBox
                    token={token}
                    itemId={p.item_id}
                    onDone={onRefetch}
                  />
                )}

                {publicado && p.publicado_url && (
                  <a
                    href={p.publicado_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-brand-300 hover:underline"
                  >
                    <ExternalLink size={11} />
                    Ver publicação no Instagram
                  </a>
                )}
                {publicado && p.publicado_em && (
                  <p className="mt-1 text-[10px] text-muted">
                    Publicado em {formatDateBR(p.publicado_em)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Bloco de aprovacao — 2 botoes (Aprovar / Pedir alteracao). Reprovar
 * abre textarea inline pedindo explicacao breve (min 3 chars, validado
 * no front E no banco). Ambas as acoes chamam a mesma RPC publica
 * `aprovar_ou_alterar_item_publico`, que valida o token, valida o item
 * e aplica a mudanca de status.
 */
function AprovacaoBox({
  token,
  itemId,
  onDone,
}: {
  token: string
  itemId: string
  onDone: () => void | Promise<void>
}) {
  const [modo, setModo] = useState<'idle' | 'reprovando' | 'salvando' | 'ok'>('idle')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function aprovar() {
    if (!confirm('Confirma a aprovação deste post?')) return
    setErro(null)
    setModo('salvando')
    const { error } = await supabase.rpc('aprovar_ou_alterar_item_publico', {
      p_token: token,
      p_item_id: itemId,
      p_acao: 'aprovar',
      p_descricao: null,
    })
    if (error) {
      setErro(error.message || 'Erro ao aprovar. Tente novamente.')
      setModo('idle')
      return
    }
    setModo('ok')
    await onDone()
  }

  async function enviarAlteracao() {
    const d = descricao.trim()
    if (d.length < 3) {
      setErro('Escreve pelo menos 3 caracteres explicando o que precisa mudar.')
      return
    }
    setErro(null)
    setModo('salvando')
    const { error } = await supabase.rpc('aprovar_ou_alterar_item_publico', {
      p_token: token,
      p_item_id: itemId,
      p_acao: 'alterar',
      p_descricao: d,
    })
    if (error) {
      setErro(error.message || 'Erro ao enviar. Tente novamente.')
      setModo('reprovando')
      return
    }
    setModo('ok')
    await onDone()
  }

  if (modo === 'ok') {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
        <CheckCircle2 size={12} className="inline mr-1" />
        Obrigado! Sua resposta foi registrada.
      </div>
    )
  }

  if (modo === 'reprovando' || modo === 'salvando') {
    return (
      <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200">
            O que precisa mudar?
          </p>
          {modo === 'reprovando' && (
            <button
              type="button"
              onClick={() => {
                setModo('idle')
                setDescricao('')
                setErro(null)
              }}
              className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
              title="Cancelar"
            >
              <X size={11} />
            </button>
          )}
        </div>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          disabled={modo === 'salvando'}
          rows={3}
          placeholder="Ex.: trocar a foto do slide 2 e ajustar o texto do slide 3"
          className="mb-2 w-full resize-none rounded-md border border-border bg-bg-soft px-2 py-1.5 text-xs text-zinc-100 placeholder:text-muted focus:border-amber-500/60 focus:outline-none"
          autoFocus
        />
        {erro && (
          <p className="mb-2 text-[11px] text-red-300">{erro}</p>
        )}
        <button
          type="button"
          onClick={enviarAlteracao}
          disabled={modo === 'salvando' || descricao.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
        >
          {modo === 'salvando' ? 'Enviando…' : 'Enviar pedido de alteração'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/80">
        Sua aprovação
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={aprovar}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-500/25"
        >
          <ThumbsUp size={12} /> Aprovar
        </button>
        <button
          type="button"
          onClick={() => setModo('reprovando')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-500/20"
        >
          <MessageSquareWarning size={12} /> Pedir alteração
        </button>
      </div>
      {erro && (
        <p className="text-[11px] text-red-300">{erro}</p>
      )}
    </div>
  )
}

/**
 * Galeria de artes como carrossel swipe. Usa CSS scroll-snap horizontal
 * — funciona touch nativo (deslize dedo esquerda/direita), no desktop
 * mostra setas + dots pra navegar. Contador "1 / N" no topo. Cada arte
 * aparece uma por vez em aspect-square, com object-contain pra nao
 * cortar carrossel/reel vertical.
 */
function GaleriaArtes({ artes, formato }: { artes: string[]; formato: string }) {
  const [idx, setIdx] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const total = artes.length

  function handleScroll() {
    const el = scrollerRef.current
    if (!el || el.clientWidth === 0) return
    const novo = Math.round(el.scrollLeft / el.clientWidth)
    if (novo !== idx && novo >= 0 && novo < total) setIdx(novo)
  }

  function goTo(i: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted">
          {formato === 'carrossel' && total > 1
            ? `Arte final · ${total} slides`
            : 'Arte final'}
        </p>
        {total > 1 && (
          <span className="text-[10px] tabular-nums text-muted">
            {idx + 1} / {total}
          </span>
        )}
      </div>
      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-lg border border-border bg-black"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {artes.map((url, i) => (
            <div key={`${url}-${i}`} className="w-full flex-shrink-0 snap-center">
              <ArteSlide url={url} index={i} />
            </div>
          ))}
        </div>
        {total > 1 && (
          <>
            {idx > 0 && (
              <button
                type="button"
                onClick={() => goTo(idx - 1)}
                className="absolute left-2 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 sm:grid sm:h-9 sm:w-9"
                aria-label="Arte anterior"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {idx < total - 1 && (
              <button
                type="button"
                onClick={() => goTo(idx + 1)}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 sm:grid sm:h-9 sm:w-9"
                aria-label="Próxima arte"
              >
                <ChevronRight size={18} />
              </button>
            )}
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-black/50 px-2 py-1">
              {artes.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70',
                  )}
                  aria-label={`Ir pra arte ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {total > 1 && (
        <p className="mt-2 text-center text-[10px] italic text-muted sm:hidden">
          Deslize pra ver as outras artes
        </p>
      )}
    </div>
  )
}

function ArteSlide({ url, index }: { url: string; index: number }) {
  const ehVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)
  if (ehVideo) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="aspect-square w-full bg-black object-contain"
      />
    )
  }
  return (
    <img
      src={url}
      alt={`Arte ${index + 1}`}
      loading="lazy"
      draggable={false}
      className="aspect-square w-full bg-black object-contain"
    />
  )
}

/** Constrói uma matriz 7×N (dias da semana × semanas) do mês. */
function buildCalendar(mesISO: string): (Date | null)[][] {
  const [ano, mes] = mesISO.split('-').map(Number)
  const primeiro = new Date(ano, mes - 1, 1)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const offsetInicio = primeiro.getDay()
  const total = offsetInicio + ultimoDia
  const semanas = Math.ceil(total / 7)
  const grid: (Date | null)[][] = []
  let dia = 1
  for (let s = 0; s < semanas; s++) {
    const linha: (Date | null)[] = []
    for (let d = 0; d < 7; d++) {
      const pos = s * 7 + d
      if (pos < offsetInicio || dia > ultimoDia) linha.push(null)
      else {
        linha.push(new Date(ano, mes - 1, dia))
        dia++
      }
    }
    grid.push(linha)
  }
  return grid
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayISO(): string {
  return formatDateISO(new Date())
}
