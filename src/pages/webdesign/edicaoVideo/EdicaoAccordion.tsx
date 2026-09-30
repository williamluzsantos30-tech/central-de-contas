/**
 * Card antigo de UM vídeo (accordion) — usado só pela página de preview
 * (/preview/edicao-video). A tela real usa VideoLoteCard.
 */
import { Calendar, ChevronRight, ExternalLink, FileText, Link as LinkIcon, Paperclip, Pencil, User, Video } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'
import { formatDateBR, isDateOverdue } from '@/lib/dates'
import { cn, statusEdicaoVideoLabel, ESTEIRA_EDICAO_VIDEO, tipoReferenciaVideoLabel } from '@/lib/utils'
import type { Cliente, EdicaoVideo, StatusEdicaoVideo } from '@/types/database'
import { statusBar } from './estilos'
/** Conta dias úteis (seg-sex) entre `start` e hoje. */
function diasUteisDesde(start: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  let days = 0
  while (cur < today) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

/** Conta dias úteis entre 2 datas. */
function diasUteisEntre(start: Date, end: Date): number {
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const target = new Date(end)
  target.setHours(0, 0, 0, 0)
  let days = 0
  while (cur < target) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

export function EdicaoAccordion({
  edicao,
  clientes: _clientes,
  expanded,
  onToggle,
  onClick,
  onChanged,
  previewMode = false,
}: {
  edicao: EdicaoVideo
  clientes: Cliente[]
  expanded: boolean
  onToggle: () => void
  onClick: () => void
  onChanged: () => void
  previewMode?: boolean
}) {
  void _clientes // não usado nessa versão simples — futuro: edit inline de cliente

  // SLA: do aprovado_em (ou created_at) até o prazo (calculado pelo banco)
  const ref = edicao.aprovado_em ?? edicao.created_at
  const refDate = new Date(ref)
  const diasUsados = diasUteisDesde(refDate)
  const prazoDate = edicao.prazo ? new Date(edicao.prazo + 'T12:00:00') : null
  const totalSla = prazoDate ? diasUteisEntre(refDate, prazoDate) : 3
  const concluido = edicao.status === 'conclusao'
  const slaEstourado =
    !concluido && edicao.prazo ? isDateOverdue(edicao.prazo) : false
  const slaPct = Math.min(100, Math.round((diasUsados / Math.max(1, totalSla)) * 100))
  const slaBarColor = concluido
    ? 'bg-emerald-500/70'
    : slaEstourado
    ? 'bg-red-500/70'
    : diasUsados >= totalSla - 1
    ? 'bg-amber-500/70'
    : 'bg-sky-500/70'
  const slaLabelTxt = concluido
    ? `SLA cumprido`
    : slaEstourado
    ? `SLA estourado`
    : `${diasUsados}/${totalSla} dias úteis`

  // Counts de assets
  const refCount = (edicao.referencias ?? []).length
  const arqCount = (edicao.arquivos ?? []).length
  const temBriefing = !!edicao.briefing && edicao.briefing.trim().length > 0
  const temVideoFinal = !!edicao.video_final_url

  function go(e: React.MouseEvent) {
    e.stopPropagation()
    onClick()
  }

  // Mudança rápida de status direto pelo dropdown no card.
  async function mudarStatus(novoStatus: StatusEdicaoVideo) {
    if (novoStatus === edicao.status) return
    if (previewMode) {
      alert('Preview: mudança de status desabilitada.')
      return
    }
    await supabase
      .from('edicoes_video')
      .update({ status: novoStatus })
      .eq('id', edicao.id)
    onChanged()
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-bg-card overflow-hidden transition-all',
        expanded
          ? 'border-brand-500/50 shadow-lg shadow-brand-500/5'
          : 'border-border hover:border-brand-500/30',
      )}
    >
      <div
        onClick={onToggle}
        className={cn(
          'relative flex cursor-pointer items-stretch transition-colors',
          expanded ? 'bg-bg-soft/40' : 'hover:bg-bg-soft/40',
        )}
      >
        {/* Barra colorida lateral */}
        <div className={cn('w-1 shrink-0', statusBar[edicao.status])} />

        <div className="flex flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
          {/* Lado esquerdo: chevron + título + meta */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ChevronRight
              size={14}
              className={cn(
                'shrink-0 text-muted transition-transform',
                expanded && 'rotate-90',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {edicao.titulo || edicao.cliente?.nome || 'Sem título'}
                </p>
                <button
                  onClick={go}
                  className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-bg-elev hover:text-brand-300 group-hover:opacity-100"
                  title="Editar"
                >
                  <Pencil size={11} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                <span className="inline-flex items-center rounded-md border border-border bg-bg-soft px-2 py-0.5 text-[11px] text-zinc-300">
                  Edição de vídeo
                </span>
                {edicao.cliente?.nome && <span>· {edicao.cliente.nome}</span>}
                {edicao.cliente?.nicho && <span>· {edicao.cliente.nicho}</span>}
                {edicao.cliente?.squad && <span>· Squad {edicao.cliente.squad}</span>}
              </div>
            </div>
          </div>

          {/* Ícones de assets */}
          <div className="flex items-center gap-1.5">
            <IconBadge on={temBriefing} icon={FileText} title="Briefing preenchido" />
            <IconBadge
              on={refCount > 0}
              icon={LinkIcon}
              title={`${refCount} referência(s)`}
            />
            <IconBadge
              on={arqCount > 0}
              icon={Paperclip}
              title={`${arqCount} arquivo(s)`}
            />
            <IconBadge on={temVideoFinal} icon={Video} title="Vídeo final entregue" />
          </div>

          {/* Direita: status, prazo, responsável */}
          <div className="flex items-center gap-2">
            {edicao.video_final_url && (
              <a
                href={edicao.video_final_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft px-2 py-1 text-[11px] text-zinc-300 hover:border-brand-500/40 hover:text-brand-300"
                title="Abrir vídeo final"
              >
                <ExternalLink size={10} />
                vídeo
              </a>
            )}
            {/* Mover de etapa direto sem abrir modal */}
            <Select
              value={edicao.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => mudarStatus(e.target.value as StatusEdicaoVideo)}
              className="h-7 w-36 text-[11px]"
              title="Mover de etapa"
            >
              {ESTEIRA_EDICAO_VIDEO.map((s) => (
                <option key={s} value={s}>
                  {statusEdicaoVideoLabel[s]}
                </option>
              ))}
            </Select>
            <PrazoBadge prazo={edicao.prazo} concluido={concluido} />
            {edicao.responsavel ? (
              <Avatar
                name={edicao.responsavel.nome}
                url={edicao.responsavel.avatar_url}
                size="sm"
              />
            ) : (
              <span
                className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-border text-muted"
                title="Sem responsável"
              >
                <User size={12} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de SLA */}
      <div>
        <div className="h-1 bg-bg-soft">
          <div
            className={cn('h-full transition-all', slaBarColor)}
            style={{ width: `${slaPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 bg-bg-soft/30 px-4 py-1.5">
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider',
              slaEstourado ? 'text-red-400 font-semibold' : 'text-muted',
            )}
          >
            SLA · lote 2 vídeos × 3 dias úteis
          </span>
          <span
            className={cn(
              'text-[11px] font-semibold',
              concluido ? 'text-emerald-400' : slaEstourado ? 'text-red-400' : 'text-zinc-200',
            )}
          >
            {slaLabelTxt}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-5">
          <ExpandedDetails edicao={edicao} onEdit={onClick} />
        </div>
      )}
    </div>
  )
}

function IconBadge({
  on,
  icon: Icon,
  title,
}: {
  on: boolean
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md border',
        on
          ? 'border-brand-500/40 bg-brand-500/15 text-brand-300'
          : 'border-border bg-bg-soft text-muted',
      )}
    >
      <Icon size={12} />
    </span>
  )
}

function PrazoBadge({
  prazo,
  concluido,
}: {
  prazo: string | null
  concluido: boolean
}) {
  if (!prazo) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-bg-soft px-2 py-1 text-[11px] text-muted">
        <Calendar size={10} /> Sem prazo
      </span>
    )
  }
  const atrasada = !concluido && isDateOverdue(prazo)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] whitespace-nowrap',
        atrasada
          ? 'border-red-500/40 bg-red-500/10 text-red-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      )}
    >
      <Calendar size={10} />
      {formatDateBR(prazo)}
    </span>
  )
}

function ExpandedDetails({
  edicao,
  onEdit,
}: {
  edicao: EdicaoVideo
  onEdit: () => void
}) {
  return (
    <div className="space-y-3 text-sm">
      {edicao.briefing && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Briefing</p>
          <p className="whitespace-pre-wrap text-xs text-zinc-200 leading-relaxed">
            {edicao.briefing}
          </p>
        </div>
      )}
      {(edicao.referencias ?? []).length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            Referências ({edicao.referencias.length})
          </p>
          <ul className="space-y-1">
            {edicao.referencias.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <Badge tone="neutral" className="text-[9px]">
                  {tipoReferenciaVideoLabel[r.tipo]}
                </Badge>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-brand-300 hover:underline"
                >
                  {r.descricao || r.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(edicao.arquivos ?? []).length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            Arquivos brutos ({edicao.arquivos.length})
          </p>
          <ul className="space-y-1">
            {edicao.arquivos.map((a, i) => (
              <li key={i} className="text-xs">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-200 hover:text-brand-300 hover:underline"
                >
                  {a.nome}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {edicao.observacoes && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            Observações
          </p>
          <p className="whitespace-pre-wrap text-xs text-muted">{edicao.observacoes}</p>
        </div>
      )}
      <div className="pt-1">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil size={12} /> Editar detalhes
        </Button>
      </div>
    </div>
  )
}
