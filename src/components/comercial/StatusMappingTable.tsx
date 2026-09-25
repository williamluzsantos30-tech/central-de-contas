/**
 * StatusMappingTable — "Mapeamento de Status de Saída": qual estágio/status do
 * CRM corresponde a cada desfecho do Closer. Cada provedor nomeia de um jeito
 * (RD "Ganho", HubSpot "closedwon", Kommo 142…); os presets vêm de
 * SAIDA_POR_PROVEDOR e o tenant edita livremente.
 */
import { RotateCcw, Info } from 'lucide-react'
import { OutlineButton, Input } from '@/components/ds'
import {
  SAIDA_POR_PROVEDOR,
  STATUS_SAIDA,
  presetLabel,
  type IntegracaoConfig,
  type StatusSaida,
} from '@/pages/comercial/mockIntegrations'

export function StatusMappingTable({
  cfg,
  onChange,
}: {
  cfg: IntegracaoConfig
  onChange: (mapeamento: Record<StatusSaida, string>) => void
}) {
  const saida = SAIDA_POR_PROVEDOR[cfg.provider]
  const nome = presetLabel(cfg.provider)
  const igualAoPreset = STATUS_SAIDA.every((s) => (cfg.mapeamentoStatus[s.key] ?? '') === saida.statusSugerido[s.key])

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">Mapeamento de status de saída</h3>
        {saida.suportaEscrita && (
          <OutlineButton
            size="sm"
            disabled={igualAoPreset}
            onClick={() => onChange({ ...saida.statusSugerido })}
            title={`Volta para os estágios sugeridos do ${nome}`}
          >
            <RotateCcw size={13} /> Usar sugestão do {nome}
          </OutlineButton>
        )}
      </div>
      <p className="mb-3 text-[11px] text-muted">
        Quando o Closer registra o resultado da call, o negócio no CRM vai pro estágio abaixo. Deixe em branco pra
        manter o estágio atual e só registrar uma nota.
      </p>

      {!saida.suportaEscrita ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200">
          <Info size={13} className="mt-0.5 shrink-0" /> {saida.dica}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-semibold">Desfecho no sistema</th>
                  <th className="px-3 py-2 font-semibold">O que acontece no CRM</th>
                  <th className="px-3 py-2 font-semibold">Estágio / status no {nome}</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_SAIDA.map((s) => (
                  <tr key={s.key} className="border-b border-border/60 last:border-b-0">
                    <td className="px-3 py-2 font-medium text-zinc-100">{s.label}</td>
                    <td className="px-3 py-2 text-muted">{s.efeito}</td>
                    <td className="px-3 py-2">
                      <Input
                        value={cfg.mapeamentoStatus[s.key] ?? ''}
                        onChange={(e) => onChange({ ...cfg.mapeamentoStatus, [s.key]: e.target.value })}
                        placeholder={saida.statusSugerido[s.key] || '(manter estágio atual)'}
                        className="font-mono text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              <strong className="text-zinc-300">{nome}:</strong> {saida.dica} Campos usados na escrita:{' '}
              <code className="text-zinc-300">{saida.campoEstagio}</code>, <code className="text-zinc-300">{saida.campoValor}</code>,{' '}
              <code className="text-zinc-300">{saida.campoNota}</code>.
            </span>
          </p>
        </>
      )}
    </div>
  )
}
