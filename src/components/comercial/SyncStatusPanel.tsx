/**
 * SyncStatusPanel — "Status de Sincronização Bidirecional" (Configurações ›
 * Integrações › CRM). Visão centralizada pra auditar a saída Sistema → CRM:
 * KPIs do mês, últimas sincronizações (sucesso e falha) com retry, e os botões
 * de desenvolvimento que simulam envio/falha.
 */
import { useMemo, useState } from 'react'
import { Send, RefreshCw, AlertTriangle, FlaskConical, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { KPICard, OutlineButton, Badge } from '@/components/ds'
import { cn } from '@/lib/utils'
import { useComercial } from '@/pages/comercial/store'
import { escritaHabilitada, presetLabel } from '@/pages/comercial/mockIntegrations'
import type { LogSincronizacaoCRM } from '@/pages/comercial/crmSync'

const mesAtual = () => new Date().toISOString().slice(0, 7)

function fmtDataHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function SyncStatusPanel() {
  const { leads, syncLogs, sincronizarLead, simularSincronizacaoCRM, integracaoCrm } = useComercial()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [simulando, setSimulando] = useState<'sucesso' | 'erro' | null>(null)
  const [tentando, setTentando] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const ativa = escritaHabilitada(integracaoCrm)

  const kpis = useMemo(() => {
    const mes = mesAtual()
    const doMes = syncLogs.filter((l) => l.timestamp.slice(0, 7) === mes && l.status === 'sucesso')
    return {
      enviados: doMes.filter((l) => l.tipo === 'criacao').length,
      atualizacoes: doMes.filter((l) => l.tipo === 'atualizacao').length,
      falhas: leads.filter((l) => l.sincronizacaoCRM === 'erro').length,
    }
  }, [syncLogs, leads])

  // Retry só faz sentido na falha MAIS RECENTE de um lead que ainda está em erro.
  const leadEmErro = useMemo(() => new Set(leads.filter((l) => l.sincronizacaoCRM === 'erro').map((l) => l.id)), [leads])
  const ultimoLogDoLead = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of syncLogs) if (!m.has(l.leadId)) m.set(l.leadId, l.id)
    return m
  }, [syncLogs])
  const podeRetry = (log: LogSincronizacaoCRM) =>
    log.status === 'erro' && leadEmErro.has(log.leadId) && ultimoLogDoLead.get(log.leadId) === log.id

  async function simular(modo: 'sucesso' | 'erro') {
    setSimulando(modo)
    setAviso(null)
    const texto = await simularSincronizacaoCRM(modo)
    setAviso({ ok: texto.startsWith('✓'), texto })
    setSimulando(null)
  }

  async function retry(leadId: string) {
    setTentando(leadId)
    await sincronizarLead(leadId)
    setTentando(null)
  }

  const recentes = syncLogs.slice(0, 15)

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Status de sincronização bidirecional</h3>
          <p className="mt-0.5 text-[11px] text-muted">
            Saída Sistema → {presetLabel(integracaoCrm.provider)}: leads criados pelo Social Selling e resultados do
            Closer.
          </p>
        </div>
        {ativa ? (
          <Badge tone="success">
            <CheckCircle2 size={11} /> Escrita ativa
          </Badge>
        ) : (
          <Badge tone="neutral">Escrita desligada</Badge>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPICard label="Leads enviados ao CRM" value={String(kpis.enviados)} icon={<Send size={13} />} tone="accent" sub="criações no mês" />
        <KPICard label="Atualizações enviadas" value={String(kpis.atualizacoes)} icon={<RefreshCw size={13} />} tone="info" sub="resultados do Closer no mês" />
        <KPICard
          label="Falhas pendentes"
          value={String(kpis.falhas)}
          icon={<AlertTriangle size={13} />}
          tone={kpis.falhas > 0 ? 'danger' : 'neutral'}
          sub={kpis.falhas > 0 ? 'leads aguardando retry' : 'tudo sincronizado'}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-semibold">Data</th>
              <th className="px-3 py-2 font-semibold">Tipo</th>
              <th className="px-3 py-2 font-semibold">Lead</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Enviado</th>
              <th className="px-3 py-2 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {recentes.map((log) => {
              const expandido = aberto === log.id
              return (
                <tr key={log.id} className="border-b border-border/60 align-top last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">{fmtDataHora(log.timestamp)}</td>
                  <td className="px-3 py-2 text-zinc-200">{log.tipo === 'criacao' ? 'Criação' : 'Atualização'}</td>
                  <td className="px-3 py-2 text-zinc-100">{log.leadNome}</td>
                  <td className="px-3 py-2">
                    {log.status === 'sucesso' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 size={12} /> Sucesso
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-red-300">
                          <XCircle size={12} /> Erro
                        </span>
                        {log.respostaErro && <span className="max-w-[260px] text-[10px] text-muted">{log.respostaErro}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setAberto(expandido ? null : log.id)}
                      className="inline-flex items-center gap-0.5 text-[11px] text-brand-300 hover:underline"
                    >
                      {expandido ? <ChevronDown size={11} /> : <ChevronRight size={11} />} payload
                    </button>
                    {expandido && (
                      <pre className="mt-1 max-w-[320px] overflow-x-auto whitespace-pre-wrap break-all rounded border border-border bg-bg-soft/60 p-2 font-mono text-[10px] text-zinc-300">
                        {JSON.stringify(log.payloadEnviado, null, 2)}
                      </pre>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {podeRetry(log) ? (
                      <OutlineButton size="sm" disabled={tentando === log.leadId} onClick={() => retry(log.leadId)}>
                        <RefreshCw size={12} className={cn(tentando === log.leadId && 'animate-spin')} /> Tentar novamente
                      </OutlineButton>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {recentes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-muted">
                  Nenhuma sincronização ainda. Cadastre um lead no Social Selling ou registre um resultado no Closer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OutlineButton size="sm" disabled={!!simulando} onClick={() => simular('sucesso')}>
          <FlaskConical size={13} /> {simulando === 'sucesso' ? 'Enviando…' : '🧪 Simular Envio de Lead ao CRM'}
        </OutlineButton>
        <OutlineButton size="sm" disabled={!!simulando} onClick={() => simular('erro')}>
          <FlaskConical size={13} /> {simulando === 'erro' ? 'Enviando…' : '🧪 Simular Falha de Sincronização'}
        </OutlineButton>
        <span className="text-[11px] text-muted">Ferramentas de teste — usam um lead real e geram entrada no log.</span>
      </div>
      {aviso && (
        <div
          className={cn(
            'mt-3 flex items-start gap-2 rounded-lg border p-3 text-xs',
            aviso.ok ? 'border-green-500/40 bg-green-500/10 text-green-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
          )}
        >
          {aviso.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          <span>{aviso.texto}</span>
        </div>
      )}
    </div>
  )
}
