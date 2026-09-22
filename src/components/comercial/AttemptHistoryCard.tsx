/**
 * AttemptHistoryCard — histórico colapsável de tentativas, genérico (reusado
 * pelo follow-up do SDR e pela abordagem do Social Selling). Recebe itens já
 * normalizados (rótulo + tom + observação + quem), mais recentes primeiro.
 */
import { useState } from 'react'
import { ChevronDown, Phone } from 'lucide-react'
import { Badge, type Tone } from '@/components/ds'
import { cn } from '@/lib/utils'
import { pessoaComercialNome, resultadoTentativaLabel, tipoAbordagemLabel, type Lead, type ResultadoTentativa, type TipoAbordagemSocial } from '@/pages/comercial/mockLeads'

export interface HistItem {
  id: string
  data: string
  rotulo: string
  tone: Tone
  observacao?: string
  quem?: string
}

function dataHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function AttemptHistoryCard({ itens, titulo = 'Histórico de tentativas' }: { itens: HistItem[]; titulo?: string }) {
  const [aberto, setAberto] = useState(true)
  const ordenadas = [...itens].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
          <Phone size={14} className="text-brand-300" /> {titulo} ({itens.length})
        </span>
        <ChevronDown size={16} className={cn('text-muted transition-transform', aberto ? '' : '-rotate-90')} />
      </button>

      {aberto && (
        <ul className="mt-3 space-y-2">
          {ordenadas.length === 0 && <li className="text-[11px] text-muted">Nenhuma tentativa registrada ainda.</li>}
          {ordenadas.map((t) => (
            <li key={t.id} className="rounded-lg border border-border/60 bg-bg-soft/30 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] tabular-nums text-zinc-300">{dataHora(t.data)}</span>
                <Badge tone={t.tone}>{t.rotulo}</Badge>
                {t.quem && <span className="text-[11px] text-muted">· {t.quem}</span>}
              </div>
              {t.observacao && <p className="mt-1 text-[11px] text-muted">{t.observacao}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Mappers (tentativa → HistItem) ─────────────────────────────────────────
const tomResultado: Record<ResultadoTentativa, Tone> = {
  nao_atendeu: 'neutral',
  caixa_postal: 'neutral',
  pediu_retorno: 'info',
  em_analise: 'attention',
  numero_invalido: 'danger',
  outro: 'neutral',
}
const tomAbordagem: Record<TipoAbordagemSocial, Tone> = {
  dm_enviada: 'info',
  comentario: 'info',
  engajamento: 'accent',
  conexao: 'purple',
  resposta_recebida: 'success',
  sem_resposta: 'neutral',
  outro: 'neutral',
}

/** Tentativas de contato do SDR → HistItem[]. */
export function histTentativasSdr(lead: Lead): HistItem[] {
  return (lead.tentativasContato ?? []).map((t) => ({
    id: t.id,
    data: t.data,
    rotulo: resultadoTentativaLabel(t.resultado),
    tone: tomResultado[t.resultado],
    observacao: t.observacao,
    quem: pessoaComercialNome(t.sdrId),
  }))
}

/** Tentativas de abordagem do Social Selling → HistItem[]. */
export function histAbordagensSocial(lead: Lead): HistItem[] {
  return (lead.tentativasAbordagemSocial ?? []).map((t) => ({
    id: t.id,
    data: t.data,
    rotulo: tipoAbordagemLabel(t.tipo),
    tone: tomAbordagem[t.tipo],
    observacao: t.observacao,
    quem: pessoaComercialNome(t.socialSellerId),
  }))
}
