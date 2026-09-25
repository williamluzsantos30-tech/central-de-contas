/**
 * SyncStatusBadge — estado da sincronização do lead com o CRM externo
 * (Sistema → CRM). Reutilizado nas tabelas do Social Selling e do Closer.
 *
 *   sincronizado → chip verde "CRM" (tooltip com o ID do registro)
 *   pendente     → chip azul "Enviando ao CRM…"
 *   erro         → chip vermelho "Falha no CRM" (tooltip com o erro) + retry
 *   nao_aplicavel / ausente → nada (lead sem CRM com escrita ativa)
 */
import { useState } from 'react'
import { ArrowLeftRight, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead } from '@/pages/comercial/mockLeads'

function fmtQuando(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const chip = 'inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium'

export function SyncStatusBadge({ lead, onRetry }: { lead: Lead; onRetry?: () => Promise<void> | void }) {
  const [tentando, setTentando] = useState(false)
  const st = lead.sincronizacaoCRM

  if (!st || st === 'nao_aplicavel') return null

  if (st === 'sincronizado') {
    return (
      <span
        className={cn(chip, 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300')}
        title={`Sincronizado com o CRM${lead.crmExternoId ? ` · registro ${lead.crmExternoId}` : ''}${
          lead.ultimaSincronizacaoCRM ? ` · ${fmtQuando(lead.ultimaSincronizacaoCRM)}` : ''
        }`}
      >
        <ArrowLeftRight size={10} /> CRM
      </span>
    )
  }

  if (st === 'pendente' || tentando) {
    return (
      <span className={cn(chip, 'border-sky-500/30 bg-sky-500/10 text-sky-300')} title="Enviando ao CRM…">
        <Loader2 size={10} className="animate-spin" /> Enviando ao CRM…
      </span>
    )
  }

  // erro
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(chip, 'border-red-500/40 bg-red-500/10 text-red-300')}
        title={`Falha ao sincronizar com o CRM${lead.erroSincronizacaoCRM ? `: ${lead.erroSincronizacaoCRM}` : ''}${
          lead.ultimaSincronizacaoCRM ? ` (${fmtQuando(lead.ultimaSincronizacaoCRM)})` : ''
        }`}
      >
        <AlertTriangle size={10} /> Falha no CRM
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation()
            setTentando(true)
            try {
              await onRetry()
            } finally {
              setTentando(false)
            }
          }}
          className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-zinc-200 transition-colors hover:border-red-500/40 hover:text-red-200"
          title={lead.erroSincronizacaoCRM ?? 'Tentar sincronizar novamente'}
        >
          <RefreshCw size={10} /> Tentar novamente
        </button>
      )}
    </span>
  )
}
