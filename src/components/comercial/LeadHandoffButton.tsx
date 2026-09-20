/**
 * LeadHandoffButton — ação "Enviar para Caixa de Entrada" do Social Selling.
 * Manda o lead prospectado pra Caixa unificada (sem SDR pré-atribuído) —
 * qualquer SDR disponível puxa depois lá na Caixa de Entrada.
 */
import { Inbox } from 'lucide-react'
import { PrimaryButton } from '@/components/ds'
import type { Lead } from '@/pages/comercial/mockLeads'
import { useComercial } from '@/pages/comercial/store'

export function LeadHandoffButton({ lead }: { lead: Lead }) {
  const { enviarParaCaixa } = useComercial()
  return (
    <PrimaryButton size="sm" onClick={() => enviarParaCaixa(lead.id)}>
      <Inbox size={13} /> Enviar para Caixa de Entrada
    </PrimaryButton>
  )
}
