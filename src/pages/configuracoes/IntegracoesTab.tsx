/**
 * Configurações › Integrações — painel de integrações.
 *
 * Esquerda: lista por área (Comercial, Financeiro, Social, Tráfego) com o
 * STATUS de cada uma à vista. Direita: só a integração selecionada. O CRM,
 * que é o maior, tem seções internas (Conexão · Campos · Sincronização ·
 * Histórico) e as ações de teste no cabeçalho.
 *
 * Todos os painéis ficam MONTADOS (só o ativo aparece): alguns guardam a
 * config em estado local (ex.: Financeiro) e perderiam o que foi preenchido
 * ao trocar de integração. Deep link: ?aba=integracoes&integracao=meta-ads.
 *
 * CRM: integração configurável por conta (SaaS multi-tenant). Os botões
 * "Testar" e "Simular" usam o webhook mockado (receiveWebhookLead) pra jogar
 * um lead na Caixa de Entrada do Comercial, sem CRM real.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Plug,
  Copy,
  Check,
  RefreshCw,
  Zap,
  FlaskConical,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowLeftRight,
  Info,
  Wallet,
  Instagram,
  History,
  Link2,
  ListTree,
} from 'lucide-react'
import { PrimaryButton, OutlineButton, Input, Select, Badge } from '@/components/ds'
import { cn } from '@/lib/utils'
import { StatusMappingTable } from '@/components/comercial/StatusMappingTable'
import { SyncStatusPanel } from '@/components/comercial/SyncStatusPanel'
import { FinancialIntegrationBlock } from '@/components/financeiro/FinancialIntegrationBlock'
import { AgencyInstagramSettings } from '@/components/social/AgencyInstagramSettings'
import { EVENTO_AGENCIA_INSTAGRAM, getAgencyConfig as getInstagramAgency } from '@/components/social/mockInstagram'
import { AgencyAdsSettings } from '@/components/ads/AgencyAdsSettings'
import { EVENTO_AGENCIA_ADS, type AdsPlatformAdapter } from '@/components/ads/adsPlatform'
import { googleAdsAdapter } from '@/components/ads/googleAds'
import { metaAdsAdapter } from '@/components/ads/metaAds'
import { MetaCriativosSyncBlock } from '@/components/comercial/MetaCriativosSyncBlock'
import { useComercial } from '@/pages/comercial/store'
import {
  CAMPOS_INTERNOS,
  CRM_PRESETS,
  SAIDA_POR_PROVEDOR,
  fakeWebhookPayload,
  gerarToken,
  gerarWebhookUrl,
  presetLabel,
  receiveWebhookLead,
  type CampoInterno,
  type CrmProvider,
} from '@/pages/comercial/mockIntegrations'

const ACCOUNT_ID = 'acc_movmed_demo'

type IntegracaoId = 'crm' | 'financeiro' | 'instagram' | 'google-ads' | 'meta-ads'

interface ItemLista {
  id: IntegracaoId
  area: string
  nome: string
  sub: string
  icon: ReactNode
  iconCls: string
  conectado: boolean
  detalhe?: string
}

/** Status das conexões de agência (Instagram/Ads), re-lido quando mudam. */
function useStatusAgencias() {
  const ler = () => ({
    instagram: !!getInstagramAgency().conectado,
    google: googleAdsAdapter.getAgencyConfig().conectado,
    meta: metaAdsAdapter.getAgencyConfig().conectado,
  })
  const [st, setSt] = useState(ler)
  useEffect(() => {
    const reler = () => setSt(ler())
    window.addEventListener(EVENTO_AGENCIA_INSTAGRAM, reler)
    window.addEventListener(EVENTO_AGENCIA_ADS, reler)
    return () => {
      window.removeEventListener(EVENTO_AGENCIA_INSTAGRAM, reler)
      window.removeEventListener(EVENTO_AGENCIA_ADS, reler)
    }
  }, [])
  return st
}

const ADS_ICON = (a: AdsPlatformAdapter) => {
  const Icon = a.icon
  return <Icon size={15} />
}

export function IntegracoesTab() {
  const { integracaoCrm: cfg } = useComercial()
  const agencias = useStatusAgencias()
  const [finConectado, setFinConectado] = useState(false)
  const onFinStatus = useCallback((c: boolean) => setFinConectado(c), [])
  const [ativa, setAtiva] = useState<IntegracaoId>(() => {
    const q = new URLSearchParams(window.location.search).get('integracao')
    return (['crm', 'financeiro', 'instagram', 'google-ads', 'meta-ads'] as const).find((x) => x === q) ?? 'crm'
  })

  const itens: ItemLista[] = [
    {
      id: 'crm',
      area: 'Comercial',
      nome: 'CRM',
      sub: presetLabel(cfg.provider),
      icon: <Plug size={15} />,
      iconCls: 'bg-brand-500/15 text-brand-300',
      conectado: cfg.status === 'conectado',
      detalhe: cfg.ultimoLeadEm ? `último lead ${fmtBR(cfg.ultimoLeadEm)}` : undefined,
    },
    {
      id: 'financeiro',
      area: 'Financeiro',
      nome: 'Financeiro',
      sub: 'ERP / contas a pagar',
      icon: <Wallet size={15} />,
      iconCls: 'bg-green-500/15 text-green-300',
      conectado: finConectado,
    },
    {
      id: 'instagram',
      area: 'Social',
      nome: 'Instagram',
      sub: 'Meta API · publicação e métricas',
      icon: <Instagram size={15} />,
      iconCls: 'bg-purple-500/15 text-purple-300',
      conectado: agencias.instagram,
    },
    {
      id: 'google-ads',
      area: 'Tráfego',
      nome: 'Google Ads',
      sub: 'Conta MCC da agência',
      icon: ADS_ICON(googleAdsAdapter),
      iconCls: cn(googleAdsAdapter.cores.fundoIcone, googleAdsAdapter.cores.texto),
      conectado: agencias.google,
    },
    {
      id: 'meta-ads',
      area: 'Tráfego',
      nome: 'Meta Ads',
      sub: 'Business Manager + criativos',
      icon: ADS_ICON(metaAdsAdapter),
      iconCls: cn(metaAdsAdapter.cores.fundoIcone, metaAdsAdapter.cores.texto),
      conectado: agencias.meta,
    },
  ]
  const areas = [...new Set(itens.map((i) => i.area))]
  const conectadas = itens.filter((i) => i.conectado).length

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Lista de integrações (status à vista) */}
      <nav aria-label="Integrações" className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-border bg-bg-card p-2">
          <p className="px-2 pb-2 pt-1 text-[11px] text-muted">
            <span className="font-semibold tabular-nums text-zinc-200">{conectadas}</span> de {itens.length} conectadas
          </p>
          {areas.map((area) => (
            <div key={area} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{area}</p>
              {itens
                .filter((i) => i.area === area)
                .map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setAtiva(i.id)}
                    aria-current={ativa === i.id ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                      ativa === i.id ? 'bg-brand-500/10 shadow-[inset_2px_0_0_0_#7c3aed]' : 'hover:bg-bg-elev',
                    )}
                  >
                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', i.iconCls)}>{i.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-zinc-100">{i.nome}</span>
                      <span className="block truncate text-[10px] text-muted">{i.sub}</span>
                    </span>
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', i.conectado ? 'bg-green-500' : 'bg-zinc-500/60')}
                      title={i.conectado ? 'Conectado' : 'Não configurado'}
                    />
                  </button>
                ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Detalhe — todos montados, só o ativo aparece (preserva estado local) */}
      <div className="min-w-0">
        <div className={cn(ativa !== 'crm' && 'hidden')}>
          <PainelCrm />
        </div>
        <div className={cn(ativa !== 'financeiro' && 'hidden')}>
          <FinancialIntegrationBlock onStatusChange={onFinStatus} />
        </div>
        <div className={cn(ativa !== 'instagram' && 'hidden')}>
          <AgencyInstagramSettings />
        </div>
        <div className={cn(ativa !== 'google-ads' && 'hidden')}>
          <AgencyAdsSettings adapter={googleAdsAdapter} />
        </div>
        <div className={cn('space-y-4', ativa !== 'meta-ads' && 'hidden')}>
          <AgencyAdsSettings adapter={metaAdsAdapter} />
          <MetaCriativosSyncBlock />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CRM — cabeçalho com status e ações + seções internas
// ============================================================================
type SecaoCrm = 'conexao' | 'campos' | 'sincronizacao' | 'historico'

function PainelCrm() {
  // Config compartilhada (store do Comercial, persistida em
  // comercial_config.integracao_crm): Social Selling e Closer leem dela pra
  // sincronizar de volta com o CRM.
  const { receberLeadExterno, integracaoCrm: cfg, setIntegracaoCrm: setCfg, syncLogs } = useComercial()
  const [secao, setSecao] = useState<SecaoCrm>('conexao')
  const [copiado, setCopiado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const preset = CRM_PRESETS.find((p) => p.provider === cfg.provider)
  const saida = SAIDA_POR_PROVEDOR[cfg.provider]
  const errosSync = syncLogs.filter((l) => l.status === 'erro').length

  function trocarProvedor(provider: CrmProvider) {
    const p = CRM_PRESETS.find((x) => x.provider === provider)!
    setCfg((c) => ({
      ...c,
      provider,
      mapeamento: p.mapeamentoSugerido,
      mapeamentoStatus: { ...SAIDA_POR_PROVEDOR[provider].statusSugerido },
      status: 'nao_configurado',
    }))
    setAviso(null)
  }

  function copiar() {
    try {
      navigator.clipboard?.writeText(cfg.webhookUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  function regenerarToken() {
    const token = gerarToken()
    setCfg((c) => ({ ...c, token, webhookUrl: gerarWebhookUrl(ACCOUNT_ID, token) }))
  }

  function setMapExterno(i: number, externo: string) {
    setCfg((c) => ({ ...c, mapeamento: c.mapeamento.map((m, idx) => (idx === i ? { ...m, externo } : m)) }))
  }
  function setMapInterno(i: number, interno: CampoInterno) {
    setCfg((c) => ({ ...c, mapeamento: c.mapeamento.map((m, idx) => (idx === i ? { ...m, interno } : m)) }))
  }
  function addMap() {
    setCfg((c) => ({ ...c, mapeamento: [...c.mapeamento, { externo: '', interno: 'nomeContato' }] }))
  }
  function removeMap(i: number) {
    setCfg((c) => ({ ...c, mapeamento: c.mapeamento.filter((_, idx) => idx !== i) }))
  }

  /** Recebe um lead fake via o webhook mockado e joga na Caixa de Entrada. */
  function dispararLeadTeste(origemLabel: string) {
    const payload = fakeWebhookPayload(cfg.provider)
    const lead = receiveWebhookLead(payload, cfg)
    receberLeadExterno(lead)
    const hoje = new Date().toISOString().slice(0, 10)
    setCfg((c) => ({ ...c, status: 'conectado', ultimoLeadEm: hoje }))
    setAviso(`${origemLabel}: "${lead.nomeContato}" (${lead.empresa}) entrou na Caixa de Entrada.`)
  }

  const secoes: { id: SecaoCrm; label: string; icon: ReactNode; extra?: ReactNode }[] = [
    { id: 'conexao', label: 'Conexão', icon: <Link2 size={13} /> },
    {
      id: 'campos',
      label: 'Campos',
      icon: <ListTree size={13} />,
      extra: <span className="rounded bg-bg-elev px-1 text-[10px] tabular-nums text-muted">{cfg.mapeamento.length}</span>,
    },
    {
      id: 'sincronizacao',
      label: 'Sincronização',
      icon: <ArrowLeftRight size={13} />,
      extra: (
        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.escritaAtiva && saida.suportaEscrita ? 'bg-green-500' : 'bg-zinc-500/60')} />
      ),
    },
    {
      id: 'historico',
      label: 'Histórico',
      icon: <History size={13} />,
      extra: errosSync ? (
        <span className="rounded bg-red-500/15 px-1 text-[10px] font-semibold tabular-nums text-red-300">{errosSync}</span>
      ) : undefined,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Cabeçalho: o que é, status e ações de teste */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
              <Plug size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">CRM · {presetLabel(cfg.provider)}</h3>
                {cfg.status === 'conectado' ? (
                  <Badge tone="success">
                    <CheckCircle2 size={11} /> Conectado
                    {cfg.ultimoLeadEm && ` · último lead ${fmtBR(cfg.ultimoLeadEm)}`}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Não configurado</Badge>
                )}
              </div>
              <p className="mt-1 max-w-xl text-[12px] text-muted">
                Leads do CRM entram sozinhos na Caixa de Entrada do Comercial; com a sincronização ligada, o que o
                Social Selling capta e o resultado do Closer voltam pro CRM.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <OutlineButton size="sm" onClick={() => dispararLeadTeste('Webhook simulado')} title="Gera um lead fictício na Caixa de Entrada">
              <FlaskConical size={13} /> Simular lead
            </OutlineButton>
            <PrimaryButton size="sm" onClick={() => dispararLeadTeste('Teste de integração')}>
              <Zap size={13} /> Testar integração
            </PrimaryButton>
          </div>
        </div>
        {aviso && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-200">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> <span>{aviso}</span>
          </div>
        )}

        {/* Seções internas */}
        <div className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3" role="tablist">
          {secoes.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={secao === s.id}
              onClick={() => setSecao(s.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                secao === s.id ? 'bg-brand-500/15 text-brand-200' : 'text-muted hover:bg-bg-elev hover:text-zinc-200',
              )}
            >
              {s.icon}
              {s.label}
              {s.extra}
            </button>
          ))}
        </div>
      </div>

      {/* Conexão: provedor, webhook e token */}
      {secao === 'conexao' && (
        <div className="space-y-4 rounded-xl border border-border bg-bg-card p-4">
          <div className="max-w-md">
            <Label>Provedor de CRM</Label>
            <Select value={cfg.provider} onChange={(e) => trocarProvedor(e.target.value as CrmProvider)}>
              {CRM_PRESETS.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>URL de Webhook (desta conta)</Label>
            <div className="flex gap-2">
              <Input readOnly value={cfg.webhookUrl} className="font-mono text-xs" />
              <OutlineButton size="sm" onClick={copiar} className="shrink-0">
                {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar'}
              </OutlineButton>
            </div>
            {preset && (
              <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-[11px] text-muted">
                <Info size={12} className="mt-0.5 shrink-0 text-brand-300" />
                <span>
                  <strong className="text-zinc-300">{preset.label}:</strong> {preset.instrucoes}
                </span>
              </p>
            )}
          </div>

          <div className="max-w-md">
            <Label>Chave secreta / token</Label>
            <div className="flex gap-2">
              <Input readOnly value={cfg.token} className="font-mono text-xs" />
              <OutlineButton size="sm" onClick={regenerarToken} className="shrink-0">
                <RefreshCw size={13} /> Regenerar
              </OutlineButton>
            </div>
          </div>
        </div>
      )}

      {/* Campos: mapeamento CRM → Lead */}
      {secao === 'campos' && (
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Mapeamento de campos</h3>
            <OutlineButton size="sm" onClick={addMap}>
              <Plus size={13} /> Adicionar
            </OutlineButton>
          </div>
          <p className="mb-3 text-[11px] text-muted">
            Cada CRM nomeia os campos de um jeito. Diga qual campo do {presetLabel(cfg.provider)} alimenta cada campo do Lead.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-soft/60 text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-semibold">Campo no CRM</th>
                  <th className="w-8 px-1 py-2" />
                  <th className="px-3 py-2 font-semibold">Campo do Lead</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cfg.mapeamento.map((m, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-b-0">
                    <td className="px-3 py-1.5">
                      <Input value={m.externo} onChange={(e) => setMapExterno(i, e.target.value)} placeholder="ex.: name" className="font-mono text-xs" />
                    </td>
                    <td className="px-1 py-1.5 text-center text-muted">→</td>
                    <td className="px-3 py-1.5">
                      <Select value={m.interno} onChange={(e) => setMapInterno(i, e.target.value as CampoInterno)}>
                        {CAMPOS_INTERNOS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => removeMap(i)}
                        className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-red-300"
                        title="Remover"
                        aria-label="Remover campo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cfg.mapeamento.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[11px] text-muted">
                      Nenhum campo mapeado. Adicione ao menos o nome e o telefone.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sincronização bidirecional (Sistema → CRM) */}
      {secao === 'sincronizacao' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Enviar dados de volta ao CRM</h3>
                <p className="mt-0.5 max-w-xl text-[12px] text-muted">
                  O Social Selling cria o lead no {presetLabel(cfg.provider)} ao cadastrar, e o Closer atualiza o status do
                  negócio ao registrar o resultado da call — automaticamente. Se o CRM falhar, nada trava aqui: o lead fica
                  marcado com ⚠ pra tentar de novo.
                </p>
              </div>
              <label
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 text-xs',
                  saida.suportaEscrita ? 'cursor-pointer text-zinc-200' : 'cursor-not-allowed text-muted',
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-500"
                  checked={cfg.escritaAtiva && saida.suportaEscrita}
                  disabled={!saida.suportaEscrita}
                  onChange={(e) => setCfg((c) => ({ ...c, escritaAtiva: e.target.checked }))}
                />
                {cfg.escritaAtiva && saida.suportaEscrita ? 'Ligada' : 'Desligada'}
              </label>
            </div>
            {!saida.suportaEscrita && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-2.5 text-[11px] text-yellow-200">
                <Info size={12} className="mt-0.5 shrink-0" /> {saida.dica}
              </p>
            )}
            {cfg.provider === 'webhook_generico' && saida.suportaEscrita && (
              <div className="mt-3 max-w-xl">
                <Label>URL de saída (eventos enviados pelo sistema)</Label>
                <Input
                  value={cfg.webhookSaidaUrl ?? ''}
                  onChange={(e) => setCfg((c) => ({ ...c, webhookSaidaUrl: e.target.value }))}
                  placeholder="https://seu-sistema.com/webhooks/crm"
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
          <StatusMappingTable cfg={cfg} onChange={(mapeamentoStatus) => setCfg((c) => ({ ...c, mapeamentoStatus }))} />
        </div>
      )}

      {/* Histórico / auditoria da saída Sistema → CRM */}
      {secao === 'historico' && <SyncStatusPanel />}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{children}</label>
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
