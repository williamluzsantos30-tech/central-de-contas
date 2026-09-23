import { useState } from 'react'
import { Bot, CheckCircle2, AlertTriangle, Loader2, Ban, RotateCw, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { PostMediaUpload } from './PostMediaUpload'
import { PublicationStatusBadge } from './PublicationStatusBadge'
import {
  getPostPub,
  agendarViaAPI,
  cancelarAgendamento,
  simularPublicacao,
  type PostPublicacao,
  type StatusPublicacao,
} from './mockPosts'
import type { ItemSocialMedia } from '@/types/database'

interface Props {
  item: ItemSocialMedia
  clienteId: string
  onChanged: () => void
}

/** datetime-local default: agendamento salvo → prazo do post (09:00) → agora. */
function defaultDateTime(item: ItemSocialMedia): string {
  const salvo = getPostPub(item.id).agendadoPara
  if (salvo) {
    const d = new Date(salvo)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 16)
  }
  if (item.prazo) return `${item.prazo.slice(0, 10)}T09:00`
  return new Date().toISOString().slice(0, 16)
}

/** Formatos de vídeo/Reels passam pelo passo `processando` na simulação. */
function tipoParaSimulacao(item: ItemSocialMedia): string {
  return item.formato === 'reel' ? 'video' : item.formato
}

/** Rótulo curto do botão que abre o modal, conforme o status. */
const TRIGGER: Record<StatusPublicacao, { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; spin?: boolean }> = {
  pendente: { label: 'Publicar via API', Icon: Bot },
  agendado_manual: { label: 'Publicar via API', Icon: Bot },
  publicado_manual: { label: 'Publicar via API', Icon: Bot },
  agendado_api: { label: 'Agendado', Icon: Bot },
  processando: { label: 'Publicando…', Icon: Loader2, spin: true },
  publicado_api: { label: 'Publicado', Icon: CheckCircle2 },
  falha_publicacao: { label: 'Falha', Icon: AlertTriangle },
}

/**
 * Fluxo de publicação automática (cliente conectado ao Instagram). Substitui os
 * botões manuais Programar/Publicar. Abre um modal com a mídia final, legenda,
 * data/hora e a progressão de status ao vivo. É tela de produção — sem
 * ferramentas dev aqui (essas ficam em Configurações › Integrações).
 *
 * `clienteId` fica disponível pra futura integração real (escopo por cliente).
 */
export function PostPublishActions({ item, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [pub, setPub] = useState<PostPublicacao>(() => getPostPub(item.id))
  const [rodando, setRodando] = useState(false)
  const [dataHora, setDataHora] = useState<string>(() => defaultDateTime(item))

  const trigger = TRIGGER[pub.statusPublicacao]

  function abrir() {
    setPub(getPostPub(item.id))
    setDataHora(defaultDateTime(item))
    setOpen(true)
  }
  function fechar() {
    if (rodando) return
    setOpen(false)
    onChanged()
  }
  function refresh() {
    setPub(getPostPub(item.id))
  }

  const midiaOk = !!pub.midiaFinal && pub.midiaFinal.urls.length > 0
  const legendaOk = !!pub.legendaFinal && pub.legendaFinal.trim().length > 0
  const pronto = midiaOk && legendaOk

  const status = pub.statusPublicacao
  const editavel = status === 'pendente' || status === 'falha_publicacao'

  async function agendar() {
    const iso = (() => {
      const d = new Date(dataHora)
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    })()
    agendarViaAPI(item.id, iso)
    setRodando(true)
    await simularPublicacao(item.id, tipoParaSimulacao(item), (s) => setPub(s))
    setRodando(false)
  }
  function cancelar() {
    cancelarAgendamento(item.id)
    refresh()
  }
  async function tentarNovamente() {
    setRodando(true)
    await simularPublicacao(item.id, tipoParaSimulacao(item), (s) => setPub(s))
    setRodando(false)
  }

  const acaoContextual = (() => {
    if (status === 'publicado_api') return null
    if (status === 'falha_publicacao') {
      return (
        <Button onClick={tentarNovamente} disabled={rodando}>
          <RotateCw size={14} className={rodando ? 'animate-spin' : undefined} />
          {rodando ? 'Publicando…' : 'Tentar novamente'}
        </Button>
      )
    }
    if (status === 'agendado_api' || status === 'processando') {
      return (
        <Button variant="secondary" onClick={cancelar} disabled={rodando}>
          <Ban size={14} />
          Cancelar agendamento
        </Button>
      )
    }
    // pendente (e estados manuais como fallback)
    return (
      <Button onClick={agendar} disabled={rodando || !pronto} title={pronto ? undefined : 'Preencha mídia e legenda'}>
        <Bot size={14} className={rodando ? 'animate-spin' : undefined} />
        {rodando ? 'Agendando…' : 'Agendar publicação automática'}
      </Button>
    )
  })()

  return (
    <>
      <button
        onClick={abrir}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-150',
          status === 'publicado_api'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
            : status === 'falha_publicacao'
            ? 'border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15'
            : status === 'agendado_api' || status === 'processando'
            ? 'border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15'
            : 'border-sky-500/40 text-sky-200 hover:bg-sky-500/10',
        )}
        title="Publicação automática via Instagram"
      >
        <trigger.Icon size={11} className={trigger.spin ? 'animate-spin' : undefined} />
        {trigger.label}
      </button>

      <Modal
        open={open}
        onClose={fechar}
        title="Publicação automática via Instagram"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="secondary" onClick={fechar} disabled={rodando}>
              Fechar
            </Button>
            {acaoContextual ?? <span />}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Resumo do post */}
          <div className="rounded-lg border border-border bg-bg-soft p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-zinc-100">{item.titulo}</p>
              <PublicationStatusBadge status={status} className="!text-[9px]" />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px]">
              <Badge tone="neutral" className="!text-[9px]">
                {item.formato}
              </Badge>
              {item.prazo && (
                <span className="text-muted">
                  Programado pra{' '}
                  {new Date(item.prazo + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Publicado via API */}
          {status === 'publicado_api' && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-emerald-200">
                <CheckCircle2 size={13} />
                Publicado via API
              </div>
              <div className="mt-2 space-y-1 text-emerald-200/80">
                {pub.publicadoEm && (
                  <p>
                    Publicado em{' '}
                    {new Date(pub.publicadoEm).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {pub.idPostInstagram && (
                  <p className="inline-flex items-center gap-1 tabular-nums">
                    <ExternalLink size={10} />
                    ID do post: {pub.idPostInstagram}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Falha */}
          {status === 'falha_publicacao' && pub.erroPublicacao && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-[11px] text-red-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{pub.erroPublicacao}</span>
            </div>
          )}

          {/* Mídia + legenda (só editável enquanto não agendou/publicou) */}
          {editavel ? (
            <PostMediaUpload item={item} onChange={refresh} />
          ) : (
            <p className="rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-[11px] text-muted">
              A mídia e a legenda ficam bloqueadas depois do agendamento. Cancele o agendamento pra editar.
            </p>
          )}

          {/* Data/hora da publicação */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
              <Bot size={11} className="text-sky-300" />
              Data e hora da publicação
            </label>
            <Input
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              disabled={!editavel || rodando}
            />
            <p className="mt-1 text-[10px] text-muted">
              A API do Instagram publica automaticamente no horário definido. Vídeos/Reels passam por um
              processamento antes de ir ao ar.
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}
