/**
 * FollowUpBanner — sinais pós-reunião do Closer, exibidos na linha do lead:
 *  - follow-up com data do próximo contato (vermelho se vencido);
 *  - alerta de 2º no-show com ação rápida de desqualificar (No-show recorrente).
 */
import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { Lead } from '@/pages/comercial/mockLeads'
import { followupVencido } from '@/pages/comercial/sla'
import { fmtData } from './LeadsTable'

export function FollowUpBanner({ lead, onDesqualificar }: { lead: Lead; onDesqualificar: (lead: Lead) => void }) {
  const vencido = followupVencido(lead)
  const noShow = lead.contadorNoShow ?? 0
  const nada = !lead.dataProximoContato && noShow < 1
  if (nada) return null

  return (
    <div className="flex flex-col gap-1">
      {lead.subStatusNegociacao === 'em_followup' && lead.dataProximoContato && (
        <span className={`inline-flex items-center gap-1 text-[10px] ${vencido ? 'text-red-300' : 'text-muted'}`}>
          <RotateCcw size={10} />
          {vencido ? 'Retorno vencido' : 'Retornar'} · {fmtData(lead.dataProximoContato)}
        </span>
      )}
      {noShow >= 1 && (
        <span className="inline-flex items-center gap-1 text-[10px] text-orange-300">
          <AlertTriangle size={10} /> {noShow}x no-show
        </span>
      )}
      {noShow >= 2 && (
        <button
          onClick={() => onDesqualificar(lead)}
          className="mt-0.5 inline-flex w-fit items-center gap-1 rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-200 hover:bg-orange-500/20"
          title="Mover para perdido com motivo No-show recorrente"
        >
          Desqualificar (recorrente)
        </button>
      )}
    </div>
  )
}
