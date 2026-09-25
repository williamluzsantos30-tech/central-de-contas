/**
 * AgencyAdsSettings — bloco de uma plataforma de anúncios em Configurações ›
 * Integrações. Conexão a nível de AGÊNCIA (MCC no Google / Business Manager no
 * Meta): configurada uma vez por tenant, torna os clientes elegíveis ao modo
 * "via agência". Inclui simulação de sincronização e lista de clientes
 * conectados. Genérico via adapter; tudo simulado (sem chamada real de API).
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, FlaskConical, Unlink, Building2 } from 'lucide-react'
import { PrimaryButton, OutlineButton, Input, Badge } from '@/components/ds'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  fmtDataHoraAds,
  modoConexaoLabel,
  tokenStatusLabel,
  type AdsAgencyConfig,
  type AdsPlatformAdapter,
} from './adsPlatform'

export function AgencyAdsSettings({ adapter }: { adapter: AdsPlatformAdapter }) {
  const t = adapter.textos
  const Icon = adapter.icon
  const [cfg, setCfg] = useState<AdsAgencyConfig>(() => adapter.getAgencyConfig())
  const [contaAgencia, setContaAgencia] = useState(cfg.contaAgenciaId ?? t.agenciaDefaultId)
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [, setNonce] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)

  const conexoes = adapter.getAllConnections()

  useEffect(() => {
    adapter.loadCache().then(() => {
      setCfg(adapter.getAgencyConfig())
      setNonce((n) => n + 1)
    })
    supabase
      .from('clientes')
      .select('id, nome')
      .then(({ data }) =>
        setNomes(new Map(((data as { id: string; nome: string }[]) ?? []).map((c) => [c.id, c.nome]))),
      )
  }, [adapter])

  function conectar() {
    const novo: AdsAgencyConfig = {
      conectado: true,
      contaAgenciaId: contaAgencia.trim() || t.agenciaDefaultId,
      conectadoEm: new Date().toISOString(),
    }
    adapter.setAgencyConfig(novo)
    setCfg(novo)
    setAviso(`${t.agenciaNome} conectada (simulado). Os clientes já podem ser vinculados via ${t.agenciaSigla} na Ficha.`)
  }
  function desconectar() {
    const novo: AdsAgencyConfig = { conectado: false }
    adapter.setAgencyConfig(novo)
    setCfg(novo)
    setAviso(null)
  }
  function simular() {
    const ativos = adapter.getAllConnections()
    if (ativos.length === 0) {
      setAviso(`Nenhum cliente conectado ainda. Conecte um cliente na Ficha (Operacional Tráfego › ${adapter.nome}) para simular.`)
      return
    }
    for (const c of ativos) adapter.simularSincronizacao(c.clienteId)
    setNonce((n) => n + 1)
    setAviso(`Sincronização simulada para ${ativos.length} cliente(s) conectado(s) — campanhas atualizadas.`)
  }

  return (
    <div className="space-y-4">
      {/* Card explicativo + status */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', adapter.cores.fundoIcone, adapter.cores.texto)}>
              <Icon size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{t.tituloConfig}</h3>
              <p className="mt-0.5 max-w-xl text-[12px] text-muted">{t.descricaoConfig}</p>
            </div>
          </div>
          {cfg.conectado ? (
            <Badge tone="success">
              <CheckCircle2 size={11} /> Conectado{cfg.contaAgenciaId ? ` · ${cfg.contaAgenciaId}` : ''}
            </Badge>
          ) : (
            <Badge tone="neutral">Não configurado</Badge>
          )}
        </div>
        <p className="mt-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-[11px] text-muted">{t.notaApiReal}</p>
      </div>

      {/* Conta de agência */}
      <div className="space-y-3 rounded-xl border border-border bg-bg-card p-4">
        <div className="max-w-md">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{t.agenciaNome}</label>
          <div className="flex gap-2">
            <Input
              value={contaAgencia}
              onChange={(e) => setContaAgencia(e.target.value)}
              placeholder={`ex.: ${t.agenciaDefaultId}`}
              disabled={cfg.conectado}
            />
            {cfg.conectado ? (
              <OutlineButton size="sm" onClick={desconectar} className="shrink-0">
                <Unlink size={13} /> Desconectar
              </OutlineButton>
            ) : (
              <PrimaryButton size="sm" onClick={conectar} className="shrink-0">
                <Building2 size={13} /> Conectar
              </PrimaryButton>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OutlineButton size="sm" onClick={simular}>
            <FlaskConical size={13} /> 🧪 Simular Sincronização de Campanhas
          </OutlineButton>
          <span className="text-[11px] text-muted">Atualiza o carimbo de sincronização dos clientes conectados</span>
        </div>
        {aviso && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> <span>{aviso}</span>
          </div>
        )}
      </div>

      {/* Clientes conectados */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-100">Clientes conectados · {adapter.nome}</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Conta</th>
                <th className="px-3 py-2 font-semibold">Modo</th>
                <th className="px-3 py-2 font-semibold">Token</th>
                <th className="px-3 py-2 font-semibold">Última sync</th>
                <th className="px-3 py-2 font-semibold">Dev</th>
              </tr>
            </thead>
            <tbody>
              {conexoes.map(({ clienteId, state }) => (
                <tr key={clienteId} className="border-b border-border/60 last:border-b-0">
                  <td className="px-3 py-2 text-zinc-200">{nomes.get(clienteId) ?? clienteId.slice(0, 8)}</td>
                  <td className={cn('px-3 py-2 tabular-nums', adapter.cores.texto)}>{state.contaId}</td>
                  <td className="px-3 py-2">
                    <Badge tone={state.modo === 'direta' ? 'info' : 'accent'}>{modoConexaoLabel(adapter, state.modo)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {state.tokenStatus ? (
                      <Badge
                        tone={state.tokenStatus === 'valido' ? 'success' : state.tokenStatus === 'expirado' ? 'warning' : 'danger'}
                      >
                        {tokenStatusLabel[state.tokenStatus]}
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted">{fmtDataHoraAds(state.ultimaSincronizacao)}</td>
                  <td className="px-3 py-2">
                    {state.tokenStatus !== 'expirado' ? (
                      <button
                        onClick={() => {
                          adapter.simularTokenExpirado(clienteId)
                          setNonce((n) => n + 1)
                        }}
                        className="text-[10px] text-muted underline decoration-dotted hover:text-amber-300"
                        title="Ferramenta de teste: força o token deste cliente como expirado"
                      >
                        simular expiração
                      </button>
                    ) : (
                      <span className="text-muted/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {conexoes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-muted">
                    Nenhum cliente conectado. Conecte na Ficha do Cliente › Operacional Tráfego › {adapter.nome}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
