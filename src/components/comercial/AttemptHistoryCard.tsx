/**
 * AttemptHistoryCard — histórico colapsável das tentativas de contato do SDR,
 * mais recentes primeiro. Badge colorido por resultado.
 */
import { useState } from 'react'
import { ChevronDown, Phone } from 'lucide-react'
import { Badge, type Tone } from '@/components/ds'
import { cn } from '@/lib/utils'
import { pessoaComercialNome, resultadoTentativaLabel, type ResultadoTentativa, type TentativaContato } from '@/pages/comercial/mockLeads'

const tom: Record<ResultadoTentativa, Tone> = {
  nao_atendeu: 'neutral',
  caixa_postal: 'neutral',
  pediu_retorno: 'info',
  em_analise: 'attention',
  numero_invalido: 'danger',
  outro: 'neutral',
}

function dataHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function AttemptHistoryCard({ tentativas }: { tentativas: TentativaContato[] }) {
  const [aberto, setAberto] = useState(true)
  const ordenadas = [...tentativas].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
          <Phone size={14} className="text-brand-300" /> Histórico de tentativas ({tentativas.length})
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
                <Badge tone={tom[t.resultado]}>{resultadoTentativaLabel(t.resultado)}</Badge>
                <span className="text-[11px] text-muted">· {pessoaComercialNome(t.sdrId)}</span>
              </div>
              {t.observacao && <p className="mt-1 text-[11px] text-muted">{t.observacao}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
