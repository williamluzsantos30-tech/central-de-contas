/**
 * Modais da Landing Page: Aprovar/Reprovar (copy ou design, reprovação exige
 * motivo) e Pausar (motivo obrigatório).
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn, statusProjetoWebdesignLabel } from '@/lib/utils'
import type { ProjetoWebdesign } from '@/types/database'
import { APROVACAO_DE, type EtapaLP, type FluxoLP } from './fluxoLP'

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function ApprovalModal({
  open,
  onClose,
  projeto,
  fluxo,
  etapa,
  atual,
  meuNome,
  onMoverParaAprovacao,
  onAprovar,
  onReprovar,
  onDesignUrl,
}: {
  open: boolean
  onClose: () => void
  projeto: ProjetoWebdesign
  fluxo: FluxoLP
  etapa: EtapaLP
  atual: EtapaLP
  meuNome: string
  onMoverParaAprovacao: () => void
  onAprovar: (por: string) => void
  onReprovar: (por: string, motivo: string) => void
  onDesignUrl: (url: string | null) => void
}) {
  const alvo = APROVACAO_DE[etapa] ?? 'copy'
  const [por, setPor] = useState('Cliente')
  const [reprovando, setReprovando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [designUrl, setDesignUrl] = useState(fluxo.designUrl ?? '')

  useEffect(() => {
    if (!open) return
    setPor('Cliente')
    setReprovando(false)
    setMotivo('')
    setDesignUrl(fluxo.designUrl ?? '')
  }, [open, fluxo.designUrl])

  const pausado = projeto.status === 'pausado'
  const aqui = atual === etapa && !pausado
  const historico = fluxo.aprovacoes.filter((a) => a.etapa === alvo).slice().reverse()
  const copyArquivos = (projeto.copy_arquivos ?? []).filter(Boolean)

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      title={statusProjetoWebdesignLabel[etapa]}
      footer={
        aqui ? (
          reprovando ? (
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
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            {!pausado && (
              <Button onClick={onMoverParaAprovacao}>Mover projeto pra {statusProjetoWebdesignLabel[etapa]}</Button>
            )}
          </div>
        )
      }
    >
      <div className="space-y-4">
        {!aqui && (
          <p className="rounded-md border border-border bg-bg-soft px-3 py-2 text-xs text-muted">
            {pausado
              ? 'O projeto está pausado — retome antes de decidir a aprovação.'
              : `O projeto está em «${statusProjetoWebdesignLabel[atual]}». Mova pra esta etapa quando o material for enviado ao cliente.`}
          </p>
        )}

        {/* Preview do material */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            {alvo === 'copy' ? 'Copy a aprovar' : 'Design a aprovar'}
          </p>
          {alvo === 'copy' ? (
            <>
              {projeto.copy_texto?.trim() ? (
                <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-bg-soft p-3 font-sans text-xs leading-relaxed text-zinc-200">
                  {projeto.copy_texto}
                </pre>
              ) : (
                <p className="text-xs text-muted">Sem texto de copy no projeto.</p>
              )}
              {copyArquivos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {copyArquivos.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-300 hover:underline">
                        <ExternalLink size={11} /> {u.split('/').pop() || u}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={designUrl}
                  onChange={(e) => setDesignUrl(e.target.value)}
                  onBlur={() => designUrl.trim() !== (fluxo.designUrl ?? '') && onDesignUrl(designUrl.trim() || null)}
                  placeholder="Link do design (Figma, Drive, staging...)"
                />
                {designUrl.trim() && (
                  <a
                    href={designUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-xs text-zinc-200 hover:bg-bg-elev"
                  >
                    <ExternalLink size={12} /> Abrir
                  </a>
                )}
              </div>
              {(projeto.fotos ?? []).length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {projeto.fotos.slice(0, 6).map((u) => (
                    <img key={u} src={u} alt="" className="h-16 w-24 shrink-0 rounded border border-border object-cover" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {reprovando && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-red-300">Motivo da reprovação *</p>
            <Textarea
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="O que precisa mudar? (ex.: trocar a headline, cores fora da identidade...)"
              className="min-h-[90px]"
            />
            <p className="mt-1 text-[10px] text-muted">
              O projeto volta pra «{statusProjetoWebdesignLabel[alvo]}» e fica marcado como em revisão.
            </p>
          </div>
        )}

        {/* Histórico desta aprovação */}
        {historico.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Histórico</p>
            <ul className="space-y-1.5">
              {historico.map((a) => (
                <li key={a.id} className="rounded-md border border-border bg-bg-soft px-3 py-2 text-xs">
                  <span className={cn('font-semibold', a.status === 'aprovado' ? 'text-emerald-400' : 'text-red-400')}>
                    {a.status === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                  </span>
                  <span className="text-muted"> · {a.por} · {dataHora(a.data)}</span>
                  {a.motivo && <p className="mt-0.5 text-zinc-300">{a.motivo}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function PauseProjectModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  useEffect(() => {
    if (open) setMotivo('')
  }, [open])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pausar projeto"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!motivo.trim()} onClick={() => onConfirm(motivo)}>
            Confirmar pausa
          </Button>
        </div>
      }
    >
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Motivo da pausa *</p>
      <Textarea
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ex.: cliente em viagem até dia 10; aguardando fotos da clínica..."
        className="min-h-[90px]"
      />
      <p className="mt-1.5 text-[10px] text-muted">Enquanto pausado, o projeto não aparece como SLA estourado. Ao retomar, ele volta pra etapa em que parou.</p>
    </Modal>
  )
}
