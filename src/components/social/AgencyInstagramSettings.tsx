/**
 * AgencyInstagramSettings — bloco "Instagram (Meta API)" em Configurações ›
 * Integrações (mesmo padrão visual do CRM e do Financeiro).
 *
 * É a conexão a nível de AGÊNCIA (Business Manager da Meta): configurada uma
 * vez, torna os clientes sob esse BM elegíveis ao Modo B (via agência). A
 * conexão real depende da aprovação do App pela Meta — aqui é tudo simulado.
 */
import { useEffect, useState } from 'react'
import { Instagram, CheckCircle2, FlaskConical, Unlink, Building2 } from 'lucide-react'
import { PrimaryButton, OutlineButton, Input, Badge } from '@/components/ds'
import { supabase } from '@/lib/supabase'
import {
  getAgencyConfig,
  getAllInstagramConnections,
  loadInstagramCache,
  modoConexaoLabel,
  setAgencyConfig,
  simularSincronizacao,
  simularTokenExpirado,
  tokenStatusLabel,
  fmtDataHora,
  type AgencyInstagramConfig,
} from './mockInstagram'

export function AgencyInstagramSettings() {
  const [cfg, setCfg] = useState<AgencyInstagramConfig>(() => getAgencyConfig())
  const [bm, setBm] = useState(cfg.businessManager ?? 'MovMed Agência')
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [nonce, setNonce] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)

  const conexoes = getAllInstagramConnections()

  useEffect(() => {
    // Carrega o cache de conexão (banco → memória) e os nomes dos clientes.
    loadInstagramCache().then(() => {
      setCfg(getAgencyConfig())
      setNonce((n) => n + 1)
    })
    supabase
      .from('clientes')
      .select('id, nome')
      .then(({ data }) => setNomes(new Map(((data as { id: string; nome: string }[]) ?? []).map((c) => [c.id, c.nome]))))
  }, [])

  function conectar() {
    const novo: AgencyInstagramConfig = { conectado: true, businessManager: bm.trim() || 'MovMed Agência', conectadoEm: new Date().toISOString() }
    setAgencyConfig(novo)
    setCfg(novo)
    setAviso('Business Manager conectado (simulado). Os clientes sob este BM já podem ser vinculados via agência na Ficha.')
  }
  function desconectar() {
    const novo: AgencyInstagramConfig = { conectado: false }
    setAgencyConfig(novo)
    setCfg(novo)
    setAviso(null)
  }
  function simular() {
    const ativos = getAllInstagramConnections()
    if (ativos.length === 0) {
      setAviso('Nenhum cliente conectado ainda. Conecte um cliente na Ficha (aba Métricas) para simular a sincronização.')
      return
    }
    for (const c of ativos) simularSincronizacao(c.clienteId)
    setNonce((n) => n + 1)
    setAviso(`Sincronização simulada para ${ativos.length} cliente(s) conectado(s) — métricas atualizadas.`)
  }

  return (
    <div className="space-y-4" key={nonce}>
      {/* Card explicativo + status */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
              <Instagram size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Instagram (Meta API)</h3>
              <p className="mt-0.5 max-w-xl text-[12px] text-muted">
                Conexão a nível de agência (Business Manager da Meta). Torna os clientes sob esse BM elegíveis a
                terem as métricas puxadas automaticamente, sem autorização individual (Modo B).
              </p>
            </div>
          </div>
          {cfg.conectado ? (
            <Badge tone="success">
              <CheckCircle2 size={11} /> Conectado{cfg.businessManager ? ` · ${cfg.businessManager}` : ''}
            </Badge>
          ) : (
            <Badge tone="neutral">Não configurado</Badge>
          )}
        </div>

        <p className="mt-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-[11px] text-muted">
          A conexão real com a API do Instagram depende de aprovação do App pela Meta. Esta tela já está pronta
          para quando a integração for ativada — basta trocar a fonte de dados mockada pela chamada real.
        </p>
      </div>

      {/* Conexão do BM */}
      <div className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
        <div className="max-w-md">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Business Manager da agência</label>
          <div className="flex gap-2">
            <Input value={bm} onChange={(e) => setBm(e.target.value)} placeholder="ex.: MovMed Agência" disabled={cfg.conectado} />
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
            <FlaskConical size={13} /> Simular Sincronização de Métricas
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
                <th className="px-3 py-2 font-semibold">Handle</th>
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
                  <td className="px-3 py-2 text-brand-300">@{state.handle}</td>
                  <td className="px-3 py-2">
                    <Badge tone={state.modoConexao === 'direta' ? 'info' : 'purple'}>{modoConexaoLabel[state.modoConexao]}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {state.modoConexao === 'direta' && state.tokenStatus ? (
                      <Badge tone={state.tokenStatus === 'valido' ? 'success' : 'warning'}>{tokenStatusLabel[state.tokenStatus]}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted">{fmtDataHora(state.ultimaSincronizacao)}</td>
                  <td className="px-3 py-2">
                    {state.modoConexao === 'direta' && state.tokenStatus !== 'expirado' ? (
                      <button
                        onClick={() => {
                          simularTokenExpirado(clienteId)
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
                    Nenhum cliente conectado. Conecte na Ficha do Cliente › Operacional Social › Métricas.
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
