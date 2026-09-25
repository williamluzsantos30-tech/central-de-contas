/**
 * AgencyGoogleAdsSettings — bloco "Google Ads (Manager/MCC)" em Configurações ›
 * Integrações. Conexão a nível de AGÊNCIA (Conta Gerenciadora): configurada uma
 * vez, torna os clientes elegíveis ao Modo MCC (vínculo sem autorização
 * individual). Tudo simulado (ver mockGoogleAds), sem chamada real de API.
 */
import { useEffect, useState } from 'react'
import { Megaphone, CheckCircle2, FlaskConical, Unlink, Building2 } from 'lucide-react'
import { PrimaryButton, OutlineButton, Input, Badge } from '@/components/ds'
import { supabase } from '@/lib/supabase'
import {
  getAgencyGoogleAdsConfig,
  getAllGoogleAdsConnections,
  loadGoogleAdsCache,
  modoConexaoGaLabel,
  setAgencyGoogleAdsConfig,
  simularSincronizacaoGA,
  simularTokenExpiradoGA,
  tokenStatusGaLabel,
  fmtDataHoraGA,
  type AgencyGoogleAdsConfig,
} from './mockGoogleAds'

export function AgencyGoogleAdsSettings() {
  const [cfg, setCfg] = useState<AgencyGoogleAdsConfig>(() => getAgencyGoogleAdsConfig())
  const [mcc, setMcc] = useState(cfg.mccId ?? 'MovMed MCC')
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [nonce, setNonce] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)

  const conexoes = getAllGoogleAdsConnections()

  useEffect(() => {
    loadGoogleAdsCache().then(() => {
      setCfg(getAgencyGoogleAdsConfig())
      setNonce((n) => n + 1)
    })
    supabase
      .from('clientes')
      .select('id, nome')
      .then(({ data }) =>
        setNomes(new Map(((data as { id: string; nome: string }[]) ?? []).map((c) => [c.id, c.nome]))),
      )
  }, [])

  function conectar() {
    const novo: AgencyGoogleAdsConfig = {
      conectado: true,
      mccId: mcc.trim() || 'MovMed MCC',
      conectadoEm: new Date().toISOString(),
    }
    setAgencyGoogleAdsConfig(novo)
    setCfg(novo)
    setAviso('Conta Gerenciadora conectada (simulado). Os clientes já podem ser vinculados via MCC na Ficha.')
  }
  function desconectar() {
    const novo: AgencyGoogleAdsConfig = { conectado: false }
    setAgencyGoogleAdsConfig(novo)
    setCfg(novo)
    setAviso(null)
  }
  function simular() {
    const ativos = getAllGoogleAdsConnections()
    if (ativos.length === 0) {
      setAviso('Nenhum cliente conectado ainda. Conecte um cliente na Ficha (Operacional Tráfego › Visão geral) para simular.')
      return
    }
    for (const c of ativos) simularSincronizacaoGA(c.clienteId)
    setNonce((n) => n + 1)
    setAviso(`Sincronização simulada para ${ativos.length} cliente(s) conectado(s) — campanhas atualizadas.`)
  }

  return (
    <div className="space-y-4" key={nonce}>
      {/* Card explicativo + status */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
              <Megaphone size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Google Ads (Conta Gerenciadora / MCC)</h3>
              <p className="mt-0.5 max-w-xl text-[12px] text-muted">
                Conexão a nível de agência. Torna os clientes sob a Conta Gerenciadora elegíveis a ter as
                métricas e campanhas puxadas automaticamente, sem autorização individual (Modo MCC).
              </p>
            </div>
          </div>
          {cfg.conectado ? (
            <Badge tone="success">
              <CheckCircle2 size={11} /> Conectado{cfg.mccId ? ` · ${cfg.mccId}` : ''}
            </Badge>
          ) : (
            <Badge tone="neutral">Não configurado</Badge>
          )}
        </div>

        <p className="mt-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-[11px] text-muted">
          A conexão real depende de OAuth + credenciais de desenvolvedor do Google Ads. Esta tela já está
          pronta para quando a integração for ativada — basta trocar a fonte de dados mockada pela chamada real.
        </p>
      </div>

      {/* Conexão do MCC */}
      <div className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
        <div className="max-w-md">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Conta Gerenciadora (MCC)</label>
          <div className="flex gap-2">
            <Input value={mcc} onChange={(e) => setMcc(e.target.value)} placeholder="ex.: MovMed MCC" disabled={cfg.conectado} />
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
        <h3 className="mb-3 text-sm font-semibold text-zinc-100">Clientes conectados</h3>
        <div className="overflow-hidden rounded-lg border border-border">
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
                  <td className="px-3 py-2 tabular-nums text-sky-300">{state.contaId}</td>
                  <td className="px-3 py-2">
                    <Badge tone={state.modo === 'direta' ? 'info' : 'accent'}>{modoConexaoGaLabel[state.modo]}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {state.tokenStatus ? (
                      <Badge tone={state.tokenStatus === 'valido' ? 'success' : state.tokenStatus === 'expirado' ? 'warning' : 'danger'}>
                        {tokenStatusGaLabel[state.tokenStatus]}
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted">{fmtDataHoraGA(state.ultimaSincronizacao)}</td>
                  <td className="px-3 py-2">
                    {state.tokenStatus !== 'expirado' ? (
                      <button
                        onClick={() => {
                          simularTokenExpiradoGA(clienteId)
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
                    Nenhum cliente conectado. Conecte na Ficha do Cliente › Operacional Tráfego › Visão geral.
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
