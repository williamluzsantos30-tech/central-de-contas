/**
 * Blocos da Landing Page: ações de SLA estourado, URL de produção com
 * status/preview, fechamento de ciclo com o Marketing, histórico e o selo de
 * origem do material (Cliente × Time).
 */
import { useState } from 'react'
import { ArrowUpCircle, Bell, ExternalLink, Loader2, Target } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { FluxoLP, StatusUrl } from './fluxoLP'

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/* ─── SLA estourado: notificar / escalar ────────────────────────────────── */

export function SLAEscalationActions({
  responsavelNome,
  escalado,
  ultimaNotificacao,
  onNotificar,
  onEscalar,
}: {
  responsavelNome: string | null
  escalado: boolean
  ultimaNotificacao: string | null
  onNotificar: () => void
  onEscalar: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onNotificar}
        disabled={!responsavelNome}
        title={
          responsavelNome
            ? `Avisar ${responsavelNome} (responsável da etapa atual)${ultimaNotificacao ? ` · último aviso ${dataHora(ultimaNotificacao)}` : ''}`
            : 'Atribua um responsável à etapa atual pra poder notificar'
        }
        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-card px-2 py-0.5 text-[10px] font-medium text-zinc-200 hover:border-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Bell size={10} /> Notificar responsável
      </button>
      <button
        type="button"
        onClick={onEscalar}
        title={escalado ? 'Tirar a sinalização de escalado' : 'Sinaliza o projeto pra liderança na lista'}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
          escalado ? 'border-red-500/50 bg-red-500/15 text-red-300' : 'border-border bg-bg-card text-zinc-200 hover:border-red-500/50',
        )}
      >
        <ArrowUpCircle size={10} /> {escalado ? 'Escalado pro Head' : 'Escalar para Head'}
      </button>
    </div>
  )
}

/* ─── URL de produção: status + preview ─────────────────────────────────── */

const STATUS_URL: Record<StatusUrl, { label: string; dot: string }> = {
  online: { label: 'Online', dot: 'bg-emerald-500' },
  offline: { label: 'Offline', dot: 'bg-red-500' },
  nao_publicado: { label: 'Ainda não publicado', dot: 'bg-zinc-400' },
}

/**
 * "Verificar status" é SIMULADO (o navegador não consegue checar outro site
 * por CORS): URL válida com https → Online; inválida → Offline; vazia → não
 * publicado. O status também pode ser trocado na mão.
 */
export function simularStatusUrl(url: string): StatusUrl {
  const u = url.trim()
  if (!u) return 'nao_publicado'
  try {
    const p = new URL(u)
    return p.protocol === 'https:' && p.hostname.includes('.') ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

export function UrlPreviewField({
  value,
  onChange,
  statusUrl,
  verificadaEm,
  onStatus,
}: {
  value: string
  onChange: (v: string) => void
  statusUrl: StatusUrl | null
  verificadaEm: string | null
  onStatus: (s: StatusUrl, verificado: boolean) => void
}) {
  const [verificando, setVerificando] = useState(false)
  const status: StatusUrl = statusUrl ?? (value.trim() ? 'offline' : 'nao_publicado')
  const s = STATUS_URL[status]
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted">URL de produção</span>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." className="min-w-[220px] flex-1" />
        <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-soft pl-2.5 pr-1 text-xs text-zinc-200" title="Status da URL (pode trocar na mão)">
          <span className={cn('h-2 w-2 rounded-full', s.dot)} />
          <select
            value={status}
            onChange={(e) => onStatus(e.target.value as StatusUrl, false)}
            className="cursor-pointer bg-transparent pr-1 text-xs focus:outline-none"
          >
            {(Object.keys(STATUS_URL) as StatusUrl[]).map((k) => (
              <option key={k} value={k} className="bg-bg-card">
                {STATUS_URL[k].label}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={verificando}
          onClick={() => {
            setVerificando(true)
            setTimeout(() => {
              onStatus(simularStatusUrl(value), true)
              setVerificando(false)
            }, 700)
          }}
        >
          {verificando ? <Loader2 size={12} className="animate-spin" /> : null} Verificar status
        </Button>
        {value.trim() ? (
          <a
            href={value.trim()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs text-zinc-200 hover:bg-bg-elev"
          >
            <ExternalLink size={12} /> Abrir preview
          </a>
        ) : null}
      </div>
      {verificadaEm && <p className="mt-1 text-[10px] text-muted">Verificado em {dataHora(verificadaEm)} (checagem simulada)</p>}
    </div>
  )
}

/* ─── Fechamento de ciclo: LP como canal do Marketing ───────────────────── */

export function MarketingLinkCard({
  fluxo,
  url,
  leads,
  onVincular,
  onDesvincular,
}: {
  fluxo: FluxoLP
  url: string
  leads: number
  onVincular: () => void
  onDesvincular: () => void
}) {
  const vinculada = fluxo.marketing
  return (
    <div className={cn('rounded-xl border p-4', vinculada ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-brand-500/40 bg-brand-500/5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Target size={14} className={vinculada ? 'text-emerald-500' : 'text-brand-400'} />
            {vinculada ? `Canal de aquisição: ${vinculada.canal}` : 'Landing Page publicada — vincular como canal de aquisição?'}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {vinculada
              ? `Leads do Comercial cuja origem cita ${url} contam como este canal, com linha própria no Comparativo entre canais do Marketing.`
              : 'Os leads que chegarem por esta URL passam a ser um canal próprio no Marketing (como Meta Ads, Google Ads...).'}
          </p>
          {vinculada && (
            <p className="mt-2 text-xs text-zinc-200">
              Leads gerados: <strong className="tabular-nums">{leads}</strong>
            </p>
          )}
        </div>
        {vinculada ? (
          <Button size="sm" variant="ghost" onClick={onDesvincular}>
            Desvincular
          </Button>
        ) : (
          <Button size="sm" onClick={onVincular}>
            <Target size={12} /> Vincular ao Marketing
          </Button>
        )}
      </div>
    </div>
  )
}

/* ─── Histórico (aprovações, pausas, avisos) ────────────────────────────── */

export function HistoricoLP({ fluxo }: { fluxo: FluxoLP }) {
  const itens = [
    ...fluxo.aprovacoes.map((a) => ({
      em: a.data,
      cor: a.status === 'aprovado' ? 'text-emerald-400' : 'text-red-400',
      titulo: `${a.etapa === 'copy' ? 'Copy' : 'Design'} ${a.status === 'aprovado' ? 'aprovado' : 'reprovado'}`,
      detalhe: [a.por, a.motivo].filter(Boolean).join(' — '),
    })),
    ...[...fluxo.pausas, ...(fluxo.pausa ? [fluxo.pausa] : [])].map((p) => ({
      em: p.em,
      cor: 'text-yellow-400',
      titulo: p.retomadoEm ? `Pausado (retomado em ${dataHora(p.retomadoEm)})` : 'Pausado',
      detalhe: [p.por, p.motivo].filter(Boolean).join(' — '),
    })),
    ...fluxo.eventos.map((e) => ({ em: e.em, cor: e.tipo === 'escalado' ? 'text-red-400' : 'text-muted', titulo: e.texto, detalhe: '' })),
  ].sort((a, b) => b.em.localeCompare(a.em))

  if (itens.length === 0) return <p className="text-xs text-muted">Nenhum registro ainda — aprovações, reprovações, pausas e avisos aparecem aqui.</p>
  return (
    <ol className="space-y-1.5">
      {itens.map((i, k) => (
        <li key={k} className="flex gap-2 text-xs">
          <span className="w-24 shrink-0 tabular-nums text-muted">{dataHora(i.em)}</span>
          <span className="min-w-0">
            <span className={cn('font-medium', i.cor)}>{i.titulo}</span>
            {i.detalhe && <span className="text-zinc-300"> · {i.detalhe}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/* ─── Origem do material ────────────────────────────────────────────────── */

export function OrigemBadge({ origem }: { origem: 'cliente' | 'time' }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
      title={origem === 'cliente' ? 'Se estiver vazio, cobrar do cliente' : 'Se estiver vazio, é pendência do time'}
    >
      {origem === 'cliente' ? '📥 Fornecido pelo Cliente' : '📤 Fornecido pelo Time'}
    </span>
  )
}
