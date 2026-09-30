/**
 * Peças da aba Criativos: esteira com o desvio da Aprovação do Design,
 * modal de Aprovar/Reprovar (motivo obrigatório), confirmação de exclusão e
 * histórico de decisões.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, CornerDownRight, ExternalLink, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn, statusCriativoWebdesignLabel, ESTEIRA_CRIATIVOS } from '@/lib/utils'
import type { CriativoWebdesign, StatusCriativoWebdesign } from '@/types/database'
import { alteracaoPercorrida, type FluxoCriativo } from './fluxoCriativo'

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const ehImagem = (u: string) => /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(u) || /images\.unsplash\.com/i.test(u)

/* ─── Esteira ───────────────────────────────────────────────────────────── */

export function EsteiraCriativo({
  status,
  fluxo,
  onMover,
  onAprovacao,
  onReenviar,
}: {
  status: StatusCriativoWebdesign
  fluxo: FluxoCriativo
  onMover: (s: StatusCriativoWebdesign) => void
  onAprovacao: () => void
  onReenviar: () => void
}) {
  const idx = ESTEIRA_CRIATIVOS.indexOf(status)
  const percorrida = alteracaoPercorrida(fluxo)

  function clicar(s: StatusCriativoWebdesign) {
    if (s === 'aprovacao_design') return onAprovacao()
    // Alteração só é aberta reprovando na Aprovação do Design.
    if (s === 'alteracao') return status === 'aprovacao_design' ? onAprovacao() : undefined
    onMover(s)
  }

  return (
    <div>
      <div className="flex items-center">
        {ESTEIRA_CRIATIVOS.map((s, i) => {
          const pulada = s === 'alteracao' && i < idx && !percorrida
          const feita = i < idx && !pulada
          const atual = i === idx
          const revisao = atual && s === 'alteracao'
          return (
            <div key={s} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => clicar(s)}
                title={
                  s === 'aprovacao_design'
                    ? 'Abrir Aprovação do Design (aprovar ou reprovar)'
                    : s === 'alteracao'
                      ? 'Alteração acontece quando o design é reprovado'
                      : `Mover pra ${statusCriativoWebdesignLabel[s]}`
                }
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors',
                  feita && 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300',
                  atual && !revisao && 'border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/30',
                  revisao && 'border-orange-500 bg-orange-500 text-white',
                  pulada && 'border-dashed border-border bg-transparent text-muted',
                  !feita && !atual && !pulada && 'border-border bg-bg-soft text-muted hover:text-zinc-200',
                  s === 'alteracao' && !atual && status !== 'aprovacao_design' && 'cursor-default',
                )}
              >
                {feita ? <Check size={12} /> : revisao ? <RotateCcw size={12} /> : pulada ? '—' : i + 1}
              </button>
              {i < ESTEIRA_CRIATIVOS.length - 1 && <div className={cn('h-0.5 flex-1', feita ? 'bg-emerald-500/40' : 'bg-border')} />}
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1 text-[10px] uppercase tracking-wider">
        {ESTEIRA_CRIATIVOS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => clicar(s)}
            className={cn('truncate text-center hover:text-zinc-200', i === idx ? 'font-semibold text-brand-300' : 'text-muted')}
          >
            {statusCriativoWebdesignLabel[s]}
            {s === 'alteracao' && <span className="block text-[8px] normal-case tracking-normal text-muted">só se reprovar</span>}
            {s === 'aprovacao_design' && status === 'aprovacao_design' && (
              <span className="block text-[8px] normal-case tracking-normal text-brand-300">clique pra decidir</span>
            )}
          </button>
        ))}
      </div>

      {status === 'alteracao' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2">
          <p className="min-w-0 text-xs text-zinc-100">
            <RotateCcw size={12} className="mr-1 inline text-orange-400" />
            <strong>Em ajuste — reprovado</strong>
            {fluxo.reprovacao ? <>: {fluxo.reprovacao.motivo}</> : ''}
          </p>
          <Button size="sm" variant="outline" onClick={onReenviar}>
            <CornerDownRight size={12} /> Ajuste pronto — reenviar pra aprovação
          </Button>
        </div>
      )}
    </div>
  )
}

/* ─── Aprovação do Design ───────────────────────────────────────────────── */

export function DesignApprovalModal({
  open,
  onClose,
  criativo,
  arquivoUrl,
  fluxo,
  meuNome,
  onMoverParaAprovacao,
  onAprovar,
  onReprovar,
}: {
  open: boolean
  onClose: () => void
  criativo: CriativoWebdesign
  arquivoUrl: string
  fluxo: FluxoCriativo
  meuNome: string
  onMoverParaAprovacao: () => void
  onAprovar: (por: string) => void
  onReprovar: (por: string, motivo: string) => void
}) {
  const [por, setPor] = useState('Cliente')
  const [reprovando, setReprovando] = useState(false)
  const [motivo, setMotivo] = useState('')
  useEffect(() => {
    if (!open) return
    setPor('Cliente')
    setReprovando(false)
    setMotivo('')
  }, [open])

  const aqui = criativo.status === 'aprovacao_design'
  const historico = [...fluxo.decisoes].reverse()

  if (!open) return null
  return createPortal(
    <Modal
      open
      onClose={onClose}
      className="max-w-2xl"
      title="Aprovação do Design"
      footer={
        !aqui ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            {criativo.status !== 'conclusao' && <Button onClick={onMoverParaAprovacao}>Mover pra Aprovação do Design</Button>}
          </div>
        ) : reprovando ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReprovando(false)}>
              Voltar
            </Button>
            <Button variant="danger" disabled={!motivo.trim()} onClick={() => onReprovar(por, motivo)}>
              <XCircle size={14} /> Confirmar reprovação
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[11px] text-muted">
              Quem decidiu
              <Select value={por} onChange={(e) => setPor(e.target.value)} className="h-8 w-40 text-xs">
                <option value="Cliente">Cliente</option>
                {meuNome && <option value={meuNome}>{meuNome}</option>}
              </Select>
            </label>
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => setReprovando(true)}>
                <XCircle size={14} /> Reprovar
              </Button>
              <Button onClick={() => onAprovar(por)} className="border-emerald-500/30 bg-emerald-600 hover:bg-emerald-500">
                <CheckCircle2 size={14} /> Aprovar
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {!aqui && (
          <p className="rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-muted">
            {criativo.status === 'conclusao'
              ? 'Criativo já concluído — o histórico de decisões está abaixo.'
              : `O criativo está em «${statusCriativoWebdesignLabel[criativo.status]}». Mova pra Aprovação do Design quando o arquivo for enviado ao cliente.`}
          </p>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Arquivo a aprovar</p>
          {arquivoUrl ? (
            <div className="flex items-start gap-3">
              {ehImagem(arquivoUrl) ? (
                <img src={arquivoUrl} alt="" className="max-h-56 max-w-[60%] rounded-lg border border-border object-contain" />
              ) : (
                <div className="grid h-24 w-40 place-items-center rounded-lg border border-dashed border-border text-[11px] text-muted">
                  sem preview
                </div>
              )}
              <a
                href={arquivoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-300 hover:underline"
              >
                <ExternalLink size={12} /> Abrir arquivo
              </a>
            </div>
          ) : (
            <p className="text-xs text-muted">Nenhum arquivo final anexado ainda (campo "Arquivo final do criativo").</p>
          )}
        </div>

        {reprovando && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-red-300">Motivo da reprovação *</p>
            <Textarea
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="O que o cliente pediu pra mudar? (ex.: trocar a foto, CTA maior, cores da marca)"
              className="min-h-[90px]"
            />
            <p className="mt-1 text-[10px] text-muted">O criativo vai pra Alteração; quando o ajuste ficar pronto, volta pra Aprovação.</p>
          </div>
        )}

        {historico.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Histórico de decisões</p>
            <HistoricoCriativo fluxo={fluxo} />
          </div>
        )}
      </div>
    </Modal>,
    document.body,
  )
}

/* ─── Histórico ─────────────────────────────────────────────────────────── */

export function HistoricoCriativo({ fluxo }: { fluxo: FluxoCriativo }) {
  const itens = [...fluxo.decisoes].reverse()
  if (itens.length === 0) return <p className="text-xs text-muted">Nenhuma decisão registrada ainda.</p>
  return (
    <ul className="space-y-1.5">
      {itens.map((d) => (
        <li key={d.id} className="rounded-md border border-border bg-bg-soft px-3 py-2 text-xs">
          <span className={cn('font-semibold', d.status === 'aprovado' ? 'text-emerald-400' : 'text-red-400')}>
            {d.status === 'aprovado' ? 'Aprovado' : 'Reprovado'}
          </span>
          <span className="text-muted">
            {' '}
            · {d.por} · {dataHora(d.data)}
          </span>
          {d.motivo && <p className="mt-0.5 text-zinc-300">{d.motivo}</p>}
        </li>
      ))}
    </ul>
  )
}

/* ─── Excluir ───────────────────────────────────────────────────────────── */

export function DeleteConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [excluindo, setExcluindo] = useState(false)
  if (!open) return null
  return createPortal(
    <Modal
      open
      onClose={onCancel}
      title="Excluir criativo"
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={excluindo}
            onClick={async () => {
              setExcluindo(true)
              await onConfirm()
              setExcluindo(false)
            }}
          >
            <Trash2 size={14} /> {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-100">Excluir este criativo? Esta ação não pode ser desfeita.</p>
    </Modal>,
    document.body,
  )
}
