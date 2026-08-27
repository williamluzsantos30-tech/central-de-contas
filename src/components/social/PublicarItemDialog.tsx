import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  Instagram,
  Megaphone,
  Pencil,
  Send,
  Clock,
  X,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ItemSocialMedia } from '@/types/database'

interface Props {
  item: ItemSocialMedia
  onChanged: () => void
  /** Modo compacto: botão menorzinho pra usar dentro do calendário */
  compact?: boolean
}

/**
 * Botão "Marcar como publicado" + dialog que pede o link da publicação
 * no Instagram. Quando o usuário confirma, marca o item como concluído,
 * salva a URL, datestamp e quem publicou — alimenta o KPI "% no prazo".
 */
export function PublicarItemBotao({ item, onChanged, compact }: Props) {
  const [open, setOpen] = useState(false)
  const ehPublicado = item.status === 'conclusao' && !!item.publicado_em

  if (ehPublicado) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/15"
          title="Editar publicação"
        >
          <CheckCircle2 size={11} />
          Publicado
          <Pencil size={9} className="opacity-60" />
        </button>
        {open && (
          <PublicarDialog item={item} onClose={() => setOpen(false)} onChanged={onChanged} />
        )}
      </>
    )
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={
          compact
            ? '!px-2 !py-1 !text-[11px] border-emerald-500/40 !text-emerald-200 hover:bg-emerald-500/10'
            : 'border-emerald-500/40 !text-emerald-200 hover:bg-emerald-500/10'
        }
      >
        <Send size={11} />
        Marcar como publicado
      </Button>
      {open && (
        <PublicarDialog item={item} onClose={() => setOpen(false)} onChanged={onChanged} />
      )}
    </>
  )
}

function PublicarDialog({
  item,
  onClose,
  onChanged,
}: {
  item: ItemSocialMedia
  onClose: () => void
  onChanged: () => void
}) {
  const { profile } = useAuth()
  const [url, setUrl] = useState(item.publicado_url ?? '')
  const [data, setData] = useState<string>(
    item.publicado_em
      ? new Date(item.publicado_em).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  )
  const [reaproveitado, setReaproveitado] = useState(item.reaproveitado_para_ad ?? false)
  const [reaproveitadoUrl, setReaproveitadoUrl] = useState(item.reaproveitado_url ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setUrl(item.publicado_url ?? '')
    setReaproveitado(item.reaproveitado_para_ad ?? false)
    setReaproveitadoUrl(item.reaproveitado_url ?? '')
    if (item.publicado_em) {
      setData(new Date(item.publicado_em).toISOString().slice(0, 16))
    }
  }, [item])

  const ehPublicado = item.status === 'conclusao' && !!item.publicado_em

  // Análise de "publicado no prazo"
  const noPrazo = item.prazo && item.publicado_em
    ? new Date(item.publicado_em).toISOString().slice(0, 10) <= item.prazo.slice(0, 10)
    : null

  async function publicar() {
    setSaving(true)
    await supabase
      .from('producoes_social_media_items')
      .update({
        status: 'conclusao',
        publicado_url: url.trim() || null,
        publicado_em: new Date(data).toISOString(),
        publicado_por: profile?.id ?? null,
        reaproveitado_para_ad: reaproveitado,
        reaproveitado_url: reaproveitado ? reaproveitadoUrl.trim() || null : null,
      })
      .eq('id', item.id)
    setSaving(false)
    onClose()
    onChanged()
  }

  async function reabrir() {
    if (!confirm('Reabrir esse post como pendente? A evidência da publicação será apagada.'))
      return
    setSaving(true)
    await supabase
      .from('producoes_social_media_items')
      .update({
        status: 'em_aprovacao',
        publicado_url: null,
        publicado_em: null,
        publicado_por: null,
      })
      .eq('id', item.id)
    setSaving(false)
    onClose()
    onChanged()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={ehPublicado ? 'Editar publicação' : 'Marcar como publicado'}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {ehPublicado ? (
            <button
              onClick={reabrir}
              disabled={saving}
              className="text-xs text-red-300 hover:underline disabled:opacity-50"
            >
              Reabrir post
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={publicar} disabled={saving}>
              <CheckCircle2 size={14} />
              {saving ? 'Salvando...' : ehPublicado ? 'Salvar' : 'Confirmar publicação'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Resumo do post */}
        <div className="rounded-lg border border-border bg-bg-soft p-3">
          <p className="text-sm font-medium text-zinc-100">{item.titulo}</p>
          {item.ideia_conteudo && (
            <p className="mt-1 text-xs text-muted leading-relaxed">{item.ideia_conteudo}</p>
          )}
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

        {/* URL da publicação */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Instagram size={11} className="text-pink-300" />
            Link do post no Instagram
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/AbCd123/"
            autoFocus
          />
          <p className="mt-1 text-[10px] text-muted">
            Cole o link do post depois de publicar — serve como evidência e
            facilita o cliente conferir.
          </p>
        </div>

        {/* Data/hora de publicação */}
        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
            Data e hora da publicação
          </label>
          <Input
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
          {ehPublicado && noPrazo !== null && (
            <p
              className={
                'mt-1 text-[10px] ' + (noPrazo ? 'text-emerald-300' : 'text-amber-300')
              }
            >
              {noPrazo ? '✓ Publicado no prazo' : '⚠ Publicado depois do programado'}
            </p>
          )}
        </div>

        {/* Reaproveitamento pra tráfego (KPI #4 do playbook) */}
        <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={reaproveitado}
              onChange={(e) => setReaproveitado(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-pink-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-pink-200">
                <Megaphone size={12} />
                Esse post foi reaproveitado pra Tráfego
              </div>
              <p className="mt-0.5 text-[10px] text-pink-200/70">
                Marque se virou criativo de Meta/Google Ads. Conta como reaproveitamento
                no KPI #4 do playbook.
              </p>
            </div>
          </label>
          {reaproveitado && (
            <div className="mt-2.5 pl-6">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-pink-200/80">
                Link do criativo (opcional)
              </label>
              <Input
                value={reaproveitadoUrl}
                onChange={(e) => setReaproveitadoUrl(e.target.value)}
                placeholder="https://business.facebook.com/ads/manager/..."
                className="text-xs"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/**
 * Botão "Marcar como programado" — sinaliza que o post foi agendado
 * no scheduler (Meta Business Suite / Buffer / etc). Diferente de
 * publicado — programado = agendou, publicado = foi ao ar.
 *
 * Fluxo tipico: arte pronta (conclusao) -> programado -> publicado.
 * Um post pode pular programado (publicar manualmente na data), mas
 * quando o time agenda antecipado essa metrica ajuda a saber a
 * consistencia da operacao.
 *
 * Nao mexe em status — so seta programado_em/programado_por.
 */
export function ProgramarItemBotao({ item, onChanged, compact }: Props) {
  const [open, setOpen] = useState(false)
  const ehProgramado = !!item.programado_em
  const ehPublicado = !!item.publicado_em

  // Se ja publicou, nao faz sentido mostrar botao de programar
  if (ehPublicado) return null

  if (ehProgramado) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15"
          title="Editar agendamento"
        >
          <Clock size={11} />
          Programado
          <Pencil size={9} className="opacity-60" />
        </button>
        {open && (
          <ProgramarDialog item={item} onClose={() => setOpen(false)} onChanged={onChanged} />
        )}
      </>
    )
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={
          compact
            ? '!px-2 !py-1 !text-[11px] border-amber-500/40 !text-amber-200 hover:bg-amber-500/10'
            : 'border-amber-500/40 !text-amber-200 hover:bg-amber-500/10'
        }
      >
        <Clock size={11} />
        Marcar como programado
      </Button>
      {open && (
        <ProgramarDialog item={item} onClose={() => setOpen(false)} onChanged={onChanged} />
      )}
    </>
  )
}

function ProgramarDialog({
  item,
  onClose,
  onChanged,
}: {
  item: ItemSocialMedia
  onClose: () => void
  onChanged: () => void
}) {
  const { profile } = useAuth()
  // Data/hora do agendamento — default: prazo do item (dia da postagem)
  const defaultDate = (() => {
    if (item.programado_em) return new Date(item.programado_em).toISOString().slice(0, 16)
    if (item.prazo) {
      // Se tem prazo (data de postagem), usa 09:00 daquele dia como default
      return `${item.prazo.slice(0, 10)}T09:00`
    }
    return new Date().toISOString().slice(0, 16)
  })()
  const [data, setData] = useState<string>(defaultDate)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item.programado_em) {
      setData(new Date(item.programado_em).toISOString().slice(0, 16))
    }
  }, [item])

  const ehProgramado = !!item.programado_em

  async function programar() {
    setSaving(true)
    await supabase
      .from('producoes_social_media_items')
      .update({
        programado_em: new Date(data).toISOString(),
        programado_por: profile?.id ?? null,
      })
      .eq('id', item.id)
    setSaving(false)
    onClose()
    onChanged()
  }

  async function desmarcar() {
    if (!confirm('Desmarcar o agendamento? A data será apagada.')) return
    setSaving(true)
    await supabase
      .from('producoes_social_media_items')
      .update({ programado_em: null, programado_por: null })
      .eq('id', item.id)
    setSaving(false)
    onClose()
    onChanged()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={ehProgramado ? 'Editar agendamento' : 'Marcar como programado'}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {ehProgramado ? (
            <button
              onClick={desmarcar}
              disabled={saving}
              className="text-xs text-red-300 hover:underline disabled:opacity-50"
            >
              Desmarcar agendamento
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={programar} disabled={saving}>
              <Clock size={14} />
              {saving ? 'Salvando...' : ehProgramado ? 'Salvar' : 'Confirmar agendamento'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-bg-soft p-3">
          <p className="text-sm font-medium text-zinc-100">{item.titulo}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            <Badge tone="neutral" className="!text-[9px]">
              {item.formato}
            </Badge>
            {item.prazo && (
              <span className="text-muted">
                Prazo:{' '}
                {new Date(item.prazo + 'T12:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Clock size={11} className="text-amber-300" />
            Data e hora do agendamento
          </label>
          <Input
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
          <p className="mt-1 text-[10px] text-muted">
            Quando o post foi programado pra ir ao ar no scheduler (Meta Business Suite,
            Buffer, etc). Depois que publicar de verdade, use "Marcar como publicado".
          </p>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Versão "info compacta" pra mostrar dados de uma publicação que JÁ
 * aconteceu — usado em listas / detalhes do dia. Não é botão.
 */
export function PublicacaoInfo({ item }: { item: ItemSocialMedia }) {
  // Renderiza 2 bandas empilhadas se aplicavel:
  //   1) Programado — quando ha programado_em (independente de publicado)
  //   2) Publicado — quando ha publicado_em
  // Ambos podem coexistir: agendou e depois publicou.
  const programadoDate = item.programado_em ? new Date(item.programado_em) : null
  const publicadoDate = item.publicado_em ? new Date(item.publicado_em) : null
  if (!programadoDate && !publicadoDate) return null

  return (
    <div className="mt-2 space-y-1.5">
      {programadoDate && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px]">
          <Clock size={12} className="text-amber-300" />
          <span className="text-amber-200 font-medium">Programado</span>
          <span className="text-amber-200/80">
            pra{' '}
            {programadoDate.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            })}{' '}
            às{' '}
            {programadoDate.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}
      {publicadoDate && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px]">
          <CheckCircle2 size={12} className="text-emerald-300" />
          <span className="text-emerald-200 font-medium">Publicado</span>
          <span className="text-emerald-200/80">
            em {publicadoDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às{' '}
            {publicadoDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {item.prazo && (
            <Badge
              tone={
                publicadoDate.toISOString().slice(0, 10) <= item.prazo.slice(0, 10)
                  ? 'success'
                  : 'warning'
              }
              className="!text-[9px]"
            >
              {publicadoDate.toISOString().slice(0, 10) <= item.prazo.slice(0, 10)
                ? 'no prazo'
                : 'fora do prazo'}
            </Badge>
          )}
          {item.publicado_url && (
            <a
              href={item.publicado_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-emerald-300 hover:underline"
            >
              ver no Instagram
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}
