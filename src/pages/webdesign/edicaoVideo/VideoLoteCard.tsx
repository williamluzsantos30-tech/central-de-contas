/**
 * Card de LOTE (até `tamanhoLote` vídeos de um cliente) e a linha de cada
 * VÍDEO dentro dele. Métricas do lote ficam no cabeçalho; status, responsável
 * e SLA de cada vídeo ficam na linha — pra não confundir as duas coisas.
 */
import { useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Hourglass,
  Pencil,
  Plus,
  User,
  X,
} from 'lucide-react'
import { Badge, ROW_TONE } from '@/components/ds'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { cn, statusEdicaoVideoLabel, ESTEIRA_EDICAO_VIDEO } from '@/lib/utils'
import type { EdicaoVideo, Profile, StatusEdicaoVideo } from '@/types/database'
import { prazoDoLote, type LoteEdicao, type VideoEdicao } from './lotes'
import type { ListaEditores } from './editores'
import { dataCurta, statusBar, statusPill } from './estilos'

export function VideoLoteCard({
  lote,
  videos,
  editores,
  onEdit,
  onChanged,
}: {
  lote: LoteEdicao
  /** Vídeos visíveis com os filtros ativos (as métricas usam o lote inteiro). */
  videos: VideoEdicao[]
  editores: ListaEditores
  onEdit: (e: EdicaoVideo) => void
  onChanged: () => void
}) {
  const nomeCliente = lote.cliente?.nome ?? 'Sem cliente'
  const prazo = prazoDoLote(lote)
  const aguardando = lote.videos.some((v) => v.sla.estado === 'aguardando')
  const pct = Math.round((lote.concluidos / lote.tamanhoLote) * 100)
  const escondidos = lote.videos.length - videos.length

  // Editor do lote: o responsável mais comum entre os vídeos em aberto.
  const contagem = new Map<string, number>()
  for (const v of lote.videos) {
    const r = v.edicao.responsavel_id
    if (r && v.sla.estado !== 'concluido') contagem.set(r, (contagem.get(r) ?? 0) + 1)
  }
  const editorDoLote = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? lote.videos.find((v) => v.edicao.responsavel_id)?.edicao.responsavel_id ?? null

  async function atribuirLote(id: string | null) {
    await supabase
      .from('edicoes_video')
      .update({ responsavel_id: id })
      .in('id', lote.videos.map((v) => v.edicao.id))
    onChanged()
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-bg-card',
        lote.atrasados > 0 ? 'border-red-500/40' : 'border-border',
      )}
    >
      {/* Cabeçalho do LOTE */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-100">[{nomeCliente.toUpperCase()}] EDIÇÃO DE VÍDEO</p>
            <span className="rounded bg-bg-elev px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Lote {lote.numero}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent" title="Quantos vídeos já entraram neste lote">
              {lote.videos.length} de {lote.tamanhoLote} vídeos no lote
            </Badge>
            <Badge tone={lote.concluidos === lote.tamanhoLote ? 'success' : 'neutral'} title="Métrica do LOTE (não de um vídeo)">
              Concluídos: {lote.concluidos}/{lote.tamanhoLote}
            </Badge>
            {lote.squad && <span className="text-[11px] text-muted">· Squad {lote.squad}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lote.atrasados > 0 && (
            <Badge tone="danger">
              <AlertTriangle size={10} /> {lote.atrasados} atrasado{lote.atrasados > 1 ? 's' : ''}
            </Badge>
          )}
          <SeletorResponsavel
            atual={editorDoLote}
            editores={editores}
            onEscolher={atribuirLote}
            titulo="Editor do lote — aplica em todos os vídeos deste lote"
            compacto
          />
        </div>
      </div>

      {/* Progresso do lote + regra de SLA */}
      <div className="h-1 bg-bg-soft">
        <div
          className={cn('h-full', lote.concluido ? 'bg-emerald-500/70' : lote.atrasados ? 'bg-red-500/70' : 'bg-brand-500/60')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-soft/30 px-4 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          SLA: lote de {lote.tamanhoLote} vídeos a cada {lote.slaDiasUteis} dias úteis
        </span>
        <span className={cn('text-[11px] font-medium', lote.atrasados ? 'text-red-400' : 'text-zinc-300')}>
          {lote.concluido
            ? 'Lote concluído'
            : prazo
              ? `Prazo do lote ${dataCurta(prazo)}`
              : aguardando
                ? 'Aguardando aprovação do cliente'
                : '—'}
        </span>
      </div>

      {/* Vídeos */}
      <div className="divide-y divide-border/60">
        {videos.map((v) => (
          <VideoRow key={v.edicao.id} video={v} editores={editores} onEdit={onEdit} onChanged={onChanged} />
        ))}
      </div>
      {escondidos > 0 && (
        <p className="border-t border-border/60 px-4 py-1.5 text-[10px] text-muted">
          + {escondidos} vídeo{escondidos > 1 ? 's' : ''} deste lote fora dos filtros
        </p>
      )}

      {lote.ultimo && lote.cliente && (
        <AdicionarVideo
          lote={lote}
          responsavelId={editorDoLote}
          onCreated={onChanged}
          onAbrir={onEdit}
        />
      )}
    </div>
  )
}

/* ─── Linha de um vídeo ─────────────────────────────────────────────────── */

export function VideoRow({
  video,
  editores,
  onEdit,
  onChanged,
}: {
  video: VideoEdicao
  editores: ListaEditores
  onEdit: (e: EdicaoVideo) => void
  onChanged: () => void
}) {
  const { edicao, sla } = video
  const atrasado = sla.estado === 'atrasado'
  const semDescricao = edicao.status === 'em_alteracao' && !edicao.descricao_alteracao?.trim()

  async function mudarStatus(novo: StatusEdicaoVideo) {
    if (novo === edicao.status) return
    await supabase.from('edicoes_video').update({ status: novo }).eq('id', edicao.id)
    onChanged()
    // Em alteração → abre o modal pra registrar o que o cliente pediu.
    if (novo === 'em_alteracao') onEdit({ ...edicao, status: 'em_alteracao' })
  }

  async function atribuir(id: string | null) {
    await supabase.from('edicoes_video').update({ responsavel_id: id }).eq('id', edicao.id)
    onChanged()
  }

  return (
    <div className={cn('group relative flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pl-5 pr-4', atrasado ? ROW_TONE.danger : 'hover:bg-bg-soft/40')}>
      {!atrasado && <span className={cn('absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r', statusBar[edicao.status])} />}

      {/* Título */}
      <button type="button" onClick={() => onEdit(edicao)} className="flex min-w-[12rem] flex-1 items-center gap-2 text-left">
        <span className="rounded bg-bg-elev px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">#{video.posicao}</span>
        <span className="truncate text-sm text-zinc-100">{edicao.titulo || 'Sem título'}</span>
        {edicao.video_final_url && (
          <a
            href={edicao.video_final_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-muted hover:text-brand-300"
            title="Abrir vídeo final"
          >
            <ExternalLink size={11} />
          </a>
        )}
        {edicao.social_media_item_id && (
          <span className="shrink-0 text-muted" title="Vinculado a uma postagem do Calendário">
            <CalendarDays size={11} />
          </span>
        )}
      </button>

      {/* SLA do vídeo */}
      <div className="flex min-w-[15rem] items-center gap-2 text-[11px]">
        {sla.estado === 'concluido' ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <CheckCircle2 size={12} className="text-emerald-500" /> Concluído
          </span>
        ) : sla.estado === 'aguardando' ? (
          <span className="inline-flex items-center gap-1 text-muted" title="O prazo começa a contar quando o cliente aprovar">
            <Hourglass size={12} /> Aguardando aprovação do cliente — SLA ainda não iniciado
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-zinc-300">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Aprovado em {dataCurta(sla.aprovadoEm!)} · Prazo {dataCurta(sla.prazo!)}
            </span>
            {atrasado && (
              <Badge tone="danger">
                <AlertTriangle size={10} /> Atrasado há {sla.diasAtraso}d
              </Badge>
            )}
          </>
        )}
      </div>

      {semDescricao && (
        <Badge tone="danger" title="O cliente pediu alteração mas ninguém descreveu o que mudar">
          sem descrição
        </Badge>
      )}

      <SeletorResponsavel atual={edicao.responsavel_id} editores={editores} onEscolher={atribuir} />

      {/* Status do VÍDEO */}
      <div className="relative">
        <select
          value={edicao.status}
          onChange={(e) => mudarStatus(e.target.value as StatusEdicaoVideo)}
          className={cn(
            'h-7 cursor-pointer appearance-none rounded-md border pl-2.5 pr-6 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500/40',
            statusPill[edicao.status],
          )}
          title="Status deste vídeo"
        >
          {ESTEIRA_EDICAO_VIDEO.map((s) => (
            <option key={s} value={s} className="bg-bg-card text-zinc-100">
              {statusEdicaoVideoLabel[s]}
            </option>
          ))}
        </select>
        <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 opacity-70" />
      </div>

      <button
        onClick={() => onEdit(edicao)}
        className="rounded p-1 text-muted transition-colors hover:bg-bg-elev hover:text-brand-300"
        title="Editar detalhes"
        aria-label="Editar detalhes"
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

/* ─── Responsável (editor) — chip clicável que vira select ─────────────── */

function SeletorResponsavel({
  atual,
  editores,
  onEscolher,
  titulo,
  compacto,
}: {
  atual: string | null
  editores: ListaEditores
  onEscolher: (id: string | null) => void
  titulo?: string
  compacto?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const pessoa: Profile | undefined = atual ? editores.porId.get(atual) : undefined

  if (editando) {
    return (
      <select
        autoFocus
        value={atual ?? ''}
        onChange={(e) => {
          setEditando(false)
          onEscolher(e.target.value || null)
        }}
        onBlur={() => setEditando(false)}
        className="h-7 max-w-[11rem] rounded-md border border-brand-500 bg-bg-soft px-2 text-[11px] text-zinc-100 focus:outline-none"
      >
        <option value="">Sem responsável</option>
        {editores.pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      title={titulo ?? (pessoa ? `Editor: ${pessoa.nome} — clique pra trocar` : 'Clique pra atribuir um editor')}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full text-[11px] transition-colors',
        pessoa ? 'pr-2 text-zinc-200 hover:bg-bg-elev' : 'border border-dashed border-border px-2 text-muted hover:border-brand-500/50 hover:text-zinc-200',
        compacto && pessoa && 'pr-0',
      )}
    >
      {pessoa ? (
        <>
          <Avatar name={pessoa.nome} url={pessoa.avatar_url} size="sm" />
          {!compacto && <span className="max-w-[7rem] truncate">{pessoa.nome.split(' ')[0]}</span>}
        </>
      ) : (
        <>
          <User size={11} /> {compacto ? 'Editor' : 'Sem responsável'}
        </>
      )}
    </button>
  )
}

/* ─── Adicionar vídeo (entra no último lote ou abre o próximo) ─────────── */

function AdicionarVideo({
  lote,
  responsavelId,
  onCreated,
  onAbrir,
}: {
  lote: LoteEdicao
  responsavelId: string | null
  onCreated: () => void
  onAbrir: (e: EdicaoVideo) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const cheio = lote.videos.length >= lote.tamanhoLote
  const rotulo = cheio ? `Adicionar vídeo (abre o lote ${lote.numero + 1})` : `Adicionar vídeo ao lote ${lote.numero}`

  async function criar(detalhar: boolean) {
    if (!titulo.trim()) return
    setSalvando(true)
    const { data, error } = await supabase
      .from('edicoes_video')
      .insert({ cliente_id: lote.clienteId, titulo: titulo.trim(), status: 'pendente', responsavel_id: responsavelId })
      .select('*')
      .single()
    setSalvando(false)
    if (error) {
      alert('Erro ao criar: ' + error.message)
      return
    }
    setTitulo('')
    setAberto(false)
    onCreated()
    if (detalhar && data) onAbrir(data as EdicaoVideo)
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-border py-2 text-[11px] text-muted transition-colors hover:bg-bg-soft/30 hover:text-brand-300"
      >
        <Plus size={12} /> {rotulo}
      </button>
    )
  }
  return (
    <div className="border-t border-border bg-bg-soft/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !salvando) {
              e.preventDefault()
              criar(false)
            } else if (e.key === 'Escape') {
              setAberto(false)
              setTitulo('')
            }
          }}
          placeholder="Título do vídeo (ex.: Corte podcast episódio 12)"
          className="h-8 min-w-[220px] flex-1 text-sm"
        />
        <Button size="sm" onClick={() => criar(false)} disabled={salvando || !titulo.trim()}>
          {salvando ? '...' : 'Criar'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => criar(true)} disabled={salvando || !titulo.trim()}>
          Criar e detalhar
        </Button>
        <button
          onClick={() => {
            setAberto(false)
            setTitulo('')
          }}
          className="grid h-7 w-7 place-items-center rounded text-muted hover:text-zinc-200"
          title="Cancelar"
          aria-label="Cancelar"
        >
          <X size={12} />
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-muted">
        {cheio ? `O lote ${lote.numero} está completo — o vídeo novo abre o lote ${lote.numero + 1}.` : `Entra no lote ${lote.numero}.`}{' '}
        Enter cria · Esc cancela
      </p>
    </div>
  )
}
