/**
 * FinancialIntegrationBlock — bloco "Integração Financeira" para a aba
 * Configurações › Integrações (renderizado abaixo do bloco de CRM, mesmo
 * padrão visual). Estrutura pronta pra futura integração real (Conta Azul,
 * Omie, Bling, Webhook genérico); por ora usa o webhook mockado
 * (receiveWebhookDespesa) pra injetar uma despesa de teste na tela de Despesas.
 */
import { useState } from 'react'
import { Wallet, Copy, Check, RefreshCw, Zap, FlaskConical, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { PrimaryButton, OutlineButton, Input, Select, Badge } from '@/components/ds'
import { useFinanceiro } from '@/pages/financeiro/store'
import {
  FIN_CAMPOS_INTERNOS,
  FIN_PRESETS,
  INTEGRACAO_FIN_INICIAL,
  fakeFinancialPayload,
  finPresetLabel,
  gerarTokenFin,
  gerarWebhookUrlFin,
  receiveWebhookDespesa,
  type FinCampoInterno,
  type FinIntegracaoConfig,
  type FinProvider,
} from '@/pages/financeiro/mockFinancialIntegration'

const ACCOUNT_ID = 'acc_movmed_demo'

export function FinancialIntegrationBlock() {
  const { receberDespesaExterna } = useFinanceiro()
  const [cfg, setCfg] = useState<FinIntegracaoConfig>(INTEGRACAO_FIN_INICIAL)
  const [copiado, setCopiado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const preset = FIN_PRESETS.find((p) => p.provider === cfg.provider)

  function trocarProvedor(provider: FinProvider) {
    const p = FIN_PRESETS.find((x) => x.provider === provider)!
    setCfg((c) => ({ ...c, provider, mapeamento: p.mapeamentoSugerido, status: 'nao_configurado' }))
    setAviso(null)
  }
  function copiar() {
    try {
      navigator.clipboard?.writeText(cfg.webhookUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      /* clipboard indisponível */
    }
  }
  function regenerarToken() {
    const token = gerarTokenFin()
    setCfg((c) => ({ ...c, token, webhookUrl: gerarWebhookUrlFin(ACCOUNT_ID, token) }))
  }
  const setMapExterno = (i: number, externo: string) =>
    setCfg((c) => ({ ...c, mapeamento: c.mapeamento.map((m, idx) => (idx === i ? { ...m, externo } : m)) }))
  const setMapInterno = (i: number, interno: FinCampoInterno) =>
    setCfg((c) => ({ ...c, mapeamento: c.mapeamento.map((m, idx) => (idx === i ? { ...m, interno } : m)) }))
  const addMap = () => setCfg((c) => ({ ...c, mapeamento: [...c.mapeamento, { externo: '', interno: 'descricao' }] }))
  const removeMap = (i: number) => setCfg((c) => ({ ...c, mapeamento: c.mapeamento.filter((_, idx) => idx !== i) }))

  function dispararDespesaTeste(origemLabel: string) {
    const payload = fakeFinancialPayload(cfg.provider)
    const despesa = receiveWebhookDespesa(payload, cfg)
    receberDespesaExterna(despesa)
    const hoje = new Date().toISOString().slice(0, 10)
    setCfg((c) => ({ ...c, status: 'conectado', ultimoEm: hoje }))
    setAviso(`${origemLabel}: "${despesa.descricao}" (${finPresetLabel(cfg.provider)}) entrou na tela de Despesas.`)
  }

  return (
    <div className="space-y-4">
      {/* Card explicativo + status */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
              <Wallet size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Integração Financeira</h3>
              <p className="mt-0.5 max-w-xl text-[12px] text-muted">
                Conecte a ferramenta financeira que sua equipe já usa. As despesas lançadas por lá
                entram automaticamente no módulo Financeiro (sem edição direta do registro).
              </p>
            </div>
          </div>
          {cfg.status === 'conectado' ? (
            <Badge tone="success">
              <CheckCircle2 size={11} /> Conectado
              {cfg.ultimoEm && ` · última despesa ${fmtBR(cfg.ultimoEm)}`}
            </Badge>
          ) : (
            <Badge tone="neutral">Não configurado</Badge>
          )}
        </div>
      </div>

      {/* Provedor + webhook */}
      <div className="rounded-xl border border-border bg-bg-card p-4 space-y-4">
        <div className="max-w-md">
          <Label>Ferramenta financeira</Label>
          <Select value={cfg.provider} onChange={(e) => trocarProvedor(e.target.value as FinProvider)}>
            {FIN_PRESETS.map((p) => (
              <option key={p.provider} value={p.provider}>{p.label}</option>
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
            <p className="mt-1.5 text-[11px] text-muted">
              <strong className="text-zinc-300">{preset.label}:</strong> {preset.instrucoes}
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

      {/* Mapeamento de campos */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Mapeamento de campos</h3>
          <OutlineButton size="sm" onClick={addMap}>
            <Plus size={13} /> Adicionar
          </OutlineButton>
        </div>
        <p className="mb-3 text-[11px] text-muted">
          Cada ferramenta nomeia os campos de um jeito. Diga qual campo alimenta cada campo interno da Despesa.
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-soft/40 text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-semibold">Campo na ferramenta</th>
                <th className="px-3 py-2 font-semibold">Campo interno (Despesa)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {cfg.mapeamento.map((m, i) => (
                <tr key={i} className="border-b border-border/60 last:border-b-0">
                  <td className="px-3 py-2">
                    <Input value={m.externo} onChange={(e) => setMapExterno(i, e.target.value)} placeholder="ex.: valor" className="font-mono text-xs" />
                  </td>
                  <td className="px-3 py-2">
                    <Select value={m.interno} onChange={(e) => setMapInterno(i, e.target.value as FinCampoInterno)}>
                      {FIN_CAMPOS_INTERNOS.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeMap(i)} className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-red-300" title="Remover">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {cfg.mapeamento.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-[11px] text-muted">
                    Nenhum campo mapeado. Adicione ao menos descrição e valor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton size="sm" onClick={() => dispararDespesaTeste('Teste de integração')}>
          <Zap size={13} /> Testar Integração
        </PrimaryButton>
        <OutlineButton size="sm" onClick={() => dispararDespesaTeste('Webhook simulado')}>
          <FlaskConical size={13} /> Simular Despesa Recebida via Integração
        </OutlineButton>
        <span className="text-[11px] text-muted">
          {finPresetLabel(cfg.provider)} · gera uma despesa fictícia no módulo Financeiro
        </span>
      </div>

      {aviso && (
        <div className="flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-200">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> <span>{aviso}</span>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{children}</label>
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
