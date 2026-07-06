/**
 * Calendário público do cliente — acessado via link
 * `/publico/calendario/:token`. NÃO exige login.
 *
 * Chama a RPC `get_calendario_publico(token)` que devolve só os posts
 * do cliente daquele token. Renderiza uma versão read-only do
 * calendário, sem sidebar/menu, só o essencial pro cliente acompanhar.
 */
import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    if (!token) return
    setLoading(true)
    supabase
      .rpc('get_calendario_publico', { p_token: token })
      .then(({ data, error }) => {
        if (error) {
          setErro('Link inválido ou expirado.')
          setLoading(false)
          return
        }
        const rows = (data ?? []) as PostPublico[]
        setPosts(rows)
        setErro(rows.length === 0 ? null : null)
        setLoading(false)
      })
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
    const d = new Date(mesISO)
    d.setMonth(d.getMonth() + delta)
    setMesISO(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  function goHoje() {
    const d = new Date()
    setMesISO(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const mesLabel = new Date(mesISO).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

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
          onClose={() => setDiaSelecionado(null)}
        />
      )}
    </div>
  )
}

function PostPill({ post }: { post: PostPublico }) {
  const publicado = !!post.publicado_em
  const Icon = formatoIcon[post.formato] ?? ImageIcon
  const cls = formatoBg[post.formato] ?? formatoBg.outro
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]',
        publicado ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : cls,
      )}
    >
      {publicado ? <CheckCircle2 size={9} /> : <Icon size={9} />}
      <span className="truncate">{post.titulo || 'Sem título'}</span>
    </div>
  )
}

function DiaModal({
  dataISO,
  posts,
  onClose,
}: {
  dataISO: string
  posts: PostPublico[]
  onClose: () => void
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

                {/* Galeria de artes — só aparece quando concluído ou publicado
                    (backend controla isso na RPC; artes_prontas vem [] pra
                    rascunho). */}
                {artes.length > 0 && (
                  <GaleriaArtes artes={artes} formato={p.formato} />
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
 * Renderiza a galeria de artes prontas — imagens em grid, vídeos com
 * <video controls>. Click em imagem abre em nova aba. Formato "carrossel"
 * exibe todas com contagem.
 */
function GaleriaArtes({ artes, formato }: { artes: string[]; formato: string }) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">
        {formato === 'carrossel' && artes.length > 1
          ? `Arte final · ${artes.length} slides`
          : 'Arte final'}
      </p>
      <div
        className={cn(
          'grid gap-2',
          artes.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3',
        )}
      >
        {artes.map((url, i) => (
          <ArteThumb key={`${url}-${i}`} url={url} index={i} />
        ))}
      </div>
    </div>
  )
}

function ArteThumb({ url, index }: { url: string; index: number }) {
  const ehVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)
  if (ehVideo) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-square rounded-md border border-border object-cover bg-black"
      />
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-md border border-border bg-bg-soft"
      title={`Abrir arte ${index + 1} em nova aba`}
    >
      <img
        src={url}
        alt={`Arte ${index + 1}`}
        loading="lazy"
        className="w-full aspect-square object-cover transition-transform group-hover:scale-105"
      />
    </a>
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
