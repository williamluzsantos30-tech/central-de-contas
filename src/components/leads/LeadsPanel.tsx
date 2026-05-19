import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Upload,
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
  Send,
  CircleAlert,
  CircleCheck,
  CircleDot,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import type { Cliente, Lead } from '@/types/database'

interface IngestLogRow {
  id: string
  ts: string
  http_status: number | null
  ok: boolean
  lead_id: string | null
  acao: string | null
  erro: string | null
  payload: Record<string, unknown> | null
  fonte: string | null
}

interface CrmSheetsStatusRow {
  cliente_id: string
  has_token: boolean
  crm_sheets_url: string | null
  last_event_at: string | null
  last_success_at: string | null
  last_error_at: string | null
  last_error_msg: string | null
  eventos_24h: number
  eventos_7d: number
  sucesso_24h: number
}

interface Props {
  cliente: Cliente
}

export function LeadsPanel({ cliente }: Props) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [sheetsOpen, setSheetsOpen] = useState(false)

  const readonly = cliente.fonte_crm === 'kommo'

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('data_entrada', { ascending: false })
    setLeads((data as Lead[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [cliente.id])

  const etapas = useMemo(
    () => Array.from(new Set(leads.map((l) => l.etapa).filter(Boolean))) as string[],
    [leads],
  )

  const filtered = leads.filter((l) => !filtroEtapa || l.etapa === filtroEtapa)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)} className="w-48">
            <option value="">Todas etapas</option>
            {etapas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Badge tone={readonly ? 'info' : 'brand'}>
            {readonly ? 'Fonte: Kommo (read-only)' : 'Fonte: Nativo'}
          </Badge>
        </div>
        {!readonly && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSheetsOpen(true)}>
              <FileSpreadsheet size={14} />
              Conectar Google Sheets
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <Upload size={14} />
              Importar CSV
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} />
              Novo lead
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft">
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Nenhum lead.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-bg-soft">
                  <td className="px-3 py-2">{l.nome ?? '—'}</td>
                  <td className="px-3 py-2">{l.telefone ?? '—'}</td>
                  <td className="px-3 py-2">
                    {l.etapa ? <Badge tone="info">{l.etapa}</Badge> : '—'}
                  </td>
                  <td className="px-3 py-2">{formatDate(l.data_entrada)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(l.valor ?? null)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readonly && (
        <>
          <LeadForm
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            clienteId={cliente.id}
            onSaved={load}
          />
          <ImportCsv
            open={importOpen}
            onClose={() => setImportOpen(false)}
            clienteId={cliente.id}
            onSaved={load}
          />
          <ConectarGoogleSheetsModal
            open={sheetsOpen}
            onClose={() => setSheetsOpen(false)}
            cliente={cliente}
            onSaved={load}
          />
        </>
      )}
    </div>
  )
}

function LeadForm({
  open,
  onClose,
  clienteId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  clienteId: string
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    etapa: '',
    valor: '',
    data_entrada: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('leads').insert({
      cliente_id: clienteId,
      origem: 'manual',
      nome: form.nome || null,
      telefone: form.telefone || null,
      email: form.email || null,
      etapa: form.etapa || null,
      valor: form.valor === '' ? null : Number(form.valor),
      data_entrada: form.data_entrada,
    })
    setSaving(false)
    onSaved()
    onClose()
    setForm({ nome: '', telefone: '', email: '', etapa: '', valor: '', data_entrada: new Date().toISOString().slice(0, 10) })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo lead"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Criar'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <Input placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="Etapa" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })} />
        <Input placeholder="Valor" type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
        <Input type="date" value={form.data_entrada} onChange={(e) => setForm({ ...form, data_entrada: e.target.value })} />
      </div>
    </Modal>
  )
}

function ImportCsv({
  open,
  onClose,
  clienteId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  clienteId: string
  onSaved: () => void
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function importar() {
    setSaving(true)
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) {
      setSaving(false)
      return
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(',')
      const obj: Record<string, string> = {}
      header.forEach((h, i) => (obj[h] = parts[i]?.trim() ?? ''))
      return {
        cliente_id: clienteId,
        origem: 'importacao' as const,
        nome: obj.nome || null,
        telefone: obj.telefone || null,
        email: obj.email || null,
        etapa: obj.etapa || null,
        valor: obj.valor ? Number(obj.valor) : null,
        data_entrada: obj.data_entrada || new Date().toISOString().slice(0, 10),
      }
    })
    await supabase.from('leads').insert(rows)
    setSaving(false)
    onSaved()
    onClose()
    setText('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar leads (CSV)"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={saving || !text.trim()}>
            {saving ? 'Importando...' : 'Importar'}
          </Button>
        </div>
      }
    >
      <p className="mb-2 text-xs text-muted">
        Cole o CSV (primeira linha como cabeçalho). Colunas aceitas: nome, telefone, email, etapa,
        valor, data_entrada.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-48 w-full rounded-lg border border-border bg-bg-soft p-3 font-mono text-xs"
        placeholder="nome,telefone,etapa,data_entrada&#10;João,11999999,Novo,2026-04-01"
      />
    </Modal>
  )
}

/* =========================================================
   Modal: Conectar Google Sheets — v2
   - Status header (verde/amarelo/vermelho)
   - Token + endpoint visíveis (copy)
   - Testar conexão (dispara POST de teste real)
   - Apps Script v2 (com Authorization Bearer)
   - Painel de últimos eventos
========================================================= */

function ConectarGoogleSheetsModal({
  open,
  onClose,
  cliente,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  cliente: Cliente
  onSaved: () => void
}) {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  const rpcUrl = SUPABASE_URL
    ? `${SUPABASE_URL}/rest/v1/rpc/intake_lead_from_sheets`
    : 'CONFIGURE_VITE_SUPABASE_URL_NO_AMBIENTE'

  const [sheetsUrl, setSheetsUrl] = useState(cliente.crm_sheets_url ?? '')
  const [copying, setCopying] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [savingUrl, setSavingUrl] = useState(false)
  const [status, setStatus] = useState<CrmSheetsStatusRow | null>(null)
  const [logs, setLogs] = useState<IngestLogRow[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<
    | { ok: true; msg: string }
    | { ok: false; msg: string }
    | null
  >(null)

  useEffect(() => {
    setSheetsUrl(cliente.crm_sheets_url ?? '')
  }, [cliente.crm_sheets_url])

  const carregarStatus = useCallback(async () => {
    setLoadingLogs(true)
    const [statusRes, logsRes] = await Promise.all([
      supabase
        .from('crm_sheets_status')
        .select('*')
        .eq('cliente_id', cliente.id)
        .maybeSingle(),
      supabase
        .from('crm_sheets_ingest_log')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('ts', { ascending: false })
        .limit(20),
    ])
    setStatus((statusRes.data as CrmSheetsStatusRow) ?? null)
    setLogs((logsRes.data as IngestLogRow[]) ?? [])
    setLoadingLogs(false)
  }, [cliente.id])

  useEffect(() => {
    if (open) {
      void carregarStatus()
      setTestResult(null)
    }
  }, [open, carregarStatus])

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopying(key)
    setTimeout(() => setCopying(null), 1500)
  }

  async function regenerarToken() {
    if (
      !confirm(
        'Regenerar o token vai INVALIDAR o Apps Script atual da planilha. Você vai precisar atualizar o código na planilha. Continuar?',
      )
    )
      return
    setRegenerating(true)
    const novoToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    await supabase
      .from('clientes')
      .update({ crm_sheets_token: novoToken })
      .eq('id', cliente.id)
    setRegenerating(false)
    onSaved()
    alert('Token regenerado. Atualize o código na planilha com o novo token.')
  }

  async function salvarUrlPlanilha() {
    setSavingUrl(true)
    await supabase
      .from('clientes')
      .update({ crm_sheets_url: sheetsUrl.trim() || null })
      .eq('id', cliente.id)
    setSavingUrl(false)
    onSaved()
  }

  async function testarConexao() {
    setTesting(true)
    setTestResult(null)
    const stamp = new Date()
      .toLocaleTimeString('pt-BR', { hour12: false })
      .replace(/:/g, '')
    const { data, error } = await supabase.rpc('intake_lead_from_sheets', {
      p_token: cliente.crm_sheets_token,
      p_nome: `TESTE — ${stamp}`,
      p_telefone: `+55 11 9TESTE${stamp}`,
      p_email: null,
      p_etapa: 'Teste de integração',
      p_valor: null,
      p_data_entrada: new Date().toISOString(),
      p_observacoes: 'Lead de teste disparado pela plataforma (não é real)',
      p_fonte: 'test',
    })
    setTesting(false)
    if (error) {
      setTestResult({ ok: false, msg: error.message })
    } else {
      setTestResult({
        ok: true,
        msg: `Lead de teste criado (id ${String(data).slice(0, 8)}…). Veja na lista de leads.`,
      })
      onSaved()
    }
    void carregarStatus()
  }

  const appsScriptCode = `/**
 * MovMed CRM — envio automático de leads pro Central de Contas (v3)
 *
 * 2 funções:
 *   1) enviarParaCRM(e)   — chamada pelo trigger "Em edição"
 *   2) testarConexao()    — rode manualmente pra debugar (não usa planilha)
 *
 * Logs aparecem em Apps Script → Execuções → clicar na linha.
 */
const RPC_URL = ${JSON.stringify(rpcUrl)};
const ANON_KEY = ${JSON.stringify(ANON_KEY ?? 'CONFIGURE_VITE_SUPABASE_ANON_KEY')};
const TOKEN = ${JSON.stringify(cliente.crm_sheets_token)};

/**
 * Dispara um lead FAKE direto pra plataforma, sem depender da planilha.
 * Use pra confirmar que a URL/token/permissões estão corretas.
 *
 * Como rodar: dropdown ao lado do botão Executar → escolhe testarConexao → ▶
 */
function testarConexao() {
  console.log('[testarConexao] Iniciando...');
  console.log('[testarConexao] RPC_URL =', RPC_URL);
  console.log('[testarConexao] TOKEN (primeiros 8 chars) =', TOKEN.substring(0, 8) + '...');

  var payload = {
    p_token: TOKEN,
    p_nome: 'TESTE MANUAL Apps Script',
    p_telefone: '+55 11 9' + new Date().getTime().toString().slice(-8),
    p_email: null,
    p_etapa: 'Teste manual do script',
    p_valor: null,
    p_data_entrada: new Date().toISOString(),
    p_observacoes: 'Disparado pela função testarConexao do Apps Script',
    p_fonte: 'sheets'
  };

  console.log('[testarConexao] Payload:', JSON.stringify(payload));

  var response = UrlFetchApp.fetch(RPC_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': ANON_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  console.log('[testarConexao] Status HTTP:', response.getResponseCode());
  console.log('[testarConexao] Body:', response.getContentText());

  if (response.getResponseCode() === 200) {
    console.log('[testarConexao] ✅ SUCESSO — lead criado na plataforma');
  } else {
    console.log('[testarConexao] ❌ FALHA — verifique URL/token/permissões');
  }
}

/**
 * Trigger "Em edição": detecta colunas pelo nome do cabeçalho (linha 1)
 * e envia o lead pra plataforma.
 */
function enviarParaCRM(e) {
  console.log('[enviarParaCRM] Trigger disparado');

  try {
    var sheet = e && e.range ? e.range.getSheet() : SpreadsheetApp.getActiveSheet();
    var row = e && e.range ? e.range.getRow() : sheet.getLastRow();
    console.log('[enviarParaCRM] Sheet:', sheet.getName(), '| Row editada:', row);

    if (row < 2) {
      console.log('[enviarParaCRM] ⊘ Linha 1 (cabeçalho) — ignorando');
      return;
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
      return String(h || '').toLowerCase().trim();
    });
    var values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
    console.log('[enviarParaCRM] Headers detectados:', JSON.stringify(headers));
    console.log('[enviarParaCRM] Values da linha ' + row + ':', JSON.stringify(values));

    function find() {
      for (var i = 0; i < arguments.length; i++) {
        var idx = headers.indexOf(arguments[i]);
        if (idx >= 0) return values[idx];
      }
      return null;
    }

    var nome = find('nome', 'nome completo', 'cliente');
    var telefone = find('telefone', 'whatsapp', 'celular', 'fone');
    var email = find('email', 'e-mail');
    var etapa = find('etapa', 'status', 'fase');
    var valorBruto = find('valor', 'ticket', 'preço', 'preco');
    var valor = valorBruto
      ? Number(String(valorBruto).replace(/[^\\d,.-]/g, '').replace(',', '.'))
      : null;
    var data = find('data', 'data de entrada', 'carimbo de data/hora');
    var observacoes = find('observações', 'observacoes', 'notas', 'obs');

    console.log('[enviarParaCRM] Extraído — nome:', nome, '| telefone:', telefone, '| etapa:', etapa);

    if (!nome && !telefone) {
      console.log('[enviarParaCRM] ⊘ Linha sem nome nem telefone — ignorando. Verifique os cabeçalhos da linha 1.');
      return;
    }

    var payload = {
      p_token: TOKEN,
      p_nome: nome ? String(nome) : null,
      p_telefone: telefone ? String(telefone) : null,
      p_email: email ? String(email) : null,
      p_etapa: etapa ? String(etapa) : null,
      p_valor: valor && !isNaN(valor) ? valor : null,
      p_data_entrada: data ? new Date(data).toISOString() : null,
      p_observacoes: observacoes ? String(observacoes) : null,
      p_fonte: 'sheets'
    };
    console.log('[enviarParaCRM] Enviando POST...');

    var response = UrlFetchApp.fetch(RPC_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    console.log('[enviarParaCRM] Status HTTP:', response.getResponseCode());
    console.log('[enviarParaCRM] Body:', response.getContentText());

    if (response.getResponseCode() === 200) {
      console.log('[enviarParaCRM] ✅ Lead enviado com sucesso');
    } else {
      console.log('[enviarParaCRM] ❌ Falha — verifique a aba "Últimos eventos" na plataforma');
    }
  } catch (err) {
    console.log('[enviarParaCRM] ❌ Exception:', err.toString());
  }
}
`

  // Status visual
  const hasEvents = !!status?.last_event_at
  const lastEventAgo = status?.last_event_at
    ? minutosAtras(status.last_event_at)
    : null
  const tone: 'success' | 'warning' | 'danger' | 'neutral' = !hasEvents
    ? 'neutral'
    : (lastEventAgo ?? 99999) < 60 * 24 && (status?.sucesso_24h ?? 0) > 0
    ? 'success'
    : status?.last_error_at && lastEventAgo !== null && lastEventAgo < 60 * 6
    ? 'danger'
    : 'warning'

  const statusLabel = !hasEvents
    ? 'Sem eventos ainda'
    : tone === 'success'
    ? 'Conectado e funcionando'
    : tone === 'danger'
    ? 'Erro no último evento'
    : 'Sem eventos recentes'

  const StatusIcon =
    tone === 'success' ? CircleCheck : tone === 'danger' ? CircleAlert : CircleDot

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="CRM Google Sheets — Integração"
      className="max-w-4xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* STATUS HEADER */}
        <div
          className={
            'rounded-lg border p-3 ' +
            (tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : tone === 'danger'
              ? 'border-red-500/30 bg-red-500/5'
              : tone === 'warning'
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border bg-bg-soft')
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <StatusIcon
                size={20}
                className={
                  tone === 'success'
                    ? 'text-emerald-400'
                    : tone === 'danger'
                    ? 'text-red-400'
                    : tone === 'warning'
                    ? 'text-amber-400'
                    : 'text-muted'
                }
              />
              <div>
                <p className="text-sm font-semibold text-zinc-100">{statusLabel}</p>
                <p className="text-[11px] text-muted">
                  {hasEvents ? (
                    <>
                      Último evento{' '}
                      <strong className="text-zinc-300">
                        {agoLabel(status?.last_event_at)}
                      </strong>{' '}
                      · {status?.sucesso_24h ?? 0} sucesso(s) nas últimas 24h
                      {(status?.eventos_24h ?? 0) - (status?.sucesso_24h ?? 0) > 0 && (
                        <>
                          {' '}· {(status?.eventos_24h ?? 0) - (status?.sucesso_24h ?? 0)}{' '}
                          erro(s)
                        </>
                      )}
                    </>
                  ) : (
                    <>Configure o Apps Script abaixo. Quando começar a chegar lead, aparece aqui.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void carregarStatus()}
                disabled={loadingLogs}
              >
                <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
                Atualizar
              </Button>
              <Button size="sm" onClick={testarConexao} disabled={testing}>
                <Send size={12} />
                {testing ? 'Enviando...' : 'Testar conexão'}
              </Button>
            </div>
          </div>
          {testResult && (
            <div
              className={
                'mt-2 rounded border px-2 py-1.5 text-[11px] ' +
                (testResult.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-200')
              }
            >
              {testResult.ok ? '✓ ' : '✗ '} {testResult.msg}
            </div>
          )}
          {status?.last_error_msg && tone !== 'success' && (
            <div className="mt-2 rounded border border-red-500/20 bg-red-500/5 px-2 py-1.5 font-mono text-[10px] text-red-300">
              Último erro: {status.last_error_msg}
            </div>
          )}
        </div>

        {/* CREDENCIAIS — token + endpoint */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-bg-soft p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Token do cliente
              </span>
              <button
                type="button"
                onClick={regenerarToken}
                disabled={regenerating}
                className="text-[10px] text-muted hover:text-red-300 underline-offset-2 hover:underline"
              >
                <RefreshCw size={9} className="inline" /> Regenerar
              </button>
            </div>
            <div className="flex gap-1.5">
              <Input
                value={cliente.crm_sheets_token}
                readOnly
                className="flex-1 font-mono text-[11px]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(cliente.crm_sheets_token, 'token')}
              >
                {copying === 'token' ? <Check size={12} /> : <Copy size={12} />}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg-soft p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Endpoint RPC
              </span>
              <span className="text-[10px] text-muted">readonly</span>
            </div>
            <div className="flex gap-1.5">
              <Input value={rpcUrl} readOnly className="flex-1 font-mono text-[11px]" />
              <Button size="sm" variant="outline" onClick={() => copy(rpcUrl, 'url')}>
                {copying === 'url' ? <Check size={12} /> : <Copy size={12} />}
              </Button>
            </div>
          </div>
        </div>

        {/* URL DA PLANILHA — referência */}
        <div className="rounded-lg border border-border bg-bg-soft p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              URL da planilha (referência — opcional)
            </span>
          </div>
          <div className="flex gap-1.5">
            <Input
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={salvarUrlPlanilha}
              disabled={savingUrl}
            >
              {savingUrl ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* APPS SCRIPT CODE */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-200">
              <FileSpreadsheet size={14} className="text-brand-300" />
              Código Apps Script (v2)
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(appsScriptCode, 'code')}
            >
              {copying === 'code' ? (
                <>
                  <Check size={12} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={12} /> Copiar código
                </>
              )}
            </Button>
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-bg-soft p-3 font-mono text-[10.5px] leading-relaxed text-zinc-200">
            {appsScriptCode}
          </pre>
        </div>

        {/* PASSO A PASSO — conciso */}
        <details className="rounded-lg border border-border bg-bg-soft p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-zinc-200">
            Passo a passo de instalação na planilha
          </summary>
          <ol className="mt-2 space-y-1 text-zinc-300">
            <li>
              <strong>1.</strong> Planilha → <em>Extensões → Apps Script</em>
            </li>
            <li>
              <strong>2.</strong> Apague o código padrão e cole o código acima → <em>Salvar</em> (Ctrl+S)
            </li>
            <li>
              <strong>3.</strong> No dropdown ao lado do <em>Executar</em>, selecione{' '}
              <code className="rounded bg-bg-elev px-1 py-0.5 text-[10px]">enviarParaCRM</code>{' '}
              → <em>Executar</em> (vai dar erro — é esperado, é só pra disparar a permissão).{' '}
              <em>Revisar permissões</em> → escolha sua conta → <em>Avançado → Acessar (não seguro) → Permitir</em>.
            </li>
            <li>
              <strong>4.</strong> Barra lateral → <em>Acionadores</em> ⏰ →{' '}
              <em>+ Adicionar acionador</em>. Função:{' '}
              <code className="rounded bg-bg-elev px-1 py-0.5 text-[10px]">enviarParaCRM</code>.
              Implantação: <em>Head</em>. Origem: <em>Da planilha</em>. Tipo de evento:{' '}
              <strong>Em edição</strong>{' '}
              (ou <strong>No envio de formulário</strong> se for planilha de Forms). Salvar.
            </li>
            <li>
              <strong>5.</strong> Volta aqui e clica em <em>Testar conexão</em> (ou adiciona uma linha na planilha).
              O status acima muda pra <span className="text-emerald-400">verde</span> e o evento aparece no painel abaixo.
            </li>
          </ol>
          <div className="mt-3 rounded border border-border bg-bg-elev p-2 text-[10.5px] text-muted">
            <p className="mb-1 font-semibold text-zinc-300">Cabeçalhos detectados (linha 1):</p>
            Nome / Telefone / Email / Etapa / Valor / Data / Observações (e sinônimos: WhatsApp, Celular, E-mail, Status, Fase, Ticket, Preço, etc).
          </div>
        </details>

        {/* LOG DE EVENTOS */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-200">
              Últimos eventos
              {logs.length > 0 && (
                <span className="rounded bg-bg-elev px-1.5 py-0.5 text-[10px] font-normal text-muted">
                  {logs.length}
                </span>
              )}
            </h4>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-bg-soft">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-2 py-1.5">Quando</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Ação</th>
                  <th className="px-2 py-1.5">Fonte</th>
                  <th className="px-2 py-1.5">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-muted">
                      Nenhum evento ainda. Faça um teste ou aguarde uma linha nova na planilha.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => {
                    const payload = (l.payload ?? {}) as Record<string, unknown>
                    const nomeNoPayload =
                      (payload['nome'] as string | undefined) ?? null
                    return (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted">
                          {formatDateTime(l.ts)}
                        </td>
                        <td className="px-2 py-1.5">
                          <Badge tone={l.ok ? 'success' : 'danger'}>
                            {l.http_status ?? (l.ok ? 'ok' : 'err')}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-[11px] capitalize">
                          {l.acao ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-[11px]">{l.fonte ?? '—'}</td>
                        <td className="px-2 py-1.5 text-[11px]">
                          {l.ok ? (
                            <span className="text-zinc-300">
                              {nomeNoPayload ?? <em className="text-muted">sem nome</em>}
                            </span>
                          ) : (
                            <span className="font-mono text-[10.5px] text-red-300">
                              {l.erro ?? '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {logs.length >= 20 && (
            <p className="mt-1.5 text-[10px] text-muted">
              Mostrando os 20 eventos mais recentes.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** "5min atrás", "2h atrás", "ontem 14:32"... */
function agoLabel(ts: string | null | undefined): string {
  if (!ts) return '—'
  const mins = minutosAtras(ts)
  if (mins === null) return '—'
  if (mins < 1) return 'agora há pouco'
  if (mins < 60) return `${mins}min atrás`
  const horas = Math.floor(mins / 60)
  if (horas < 24) return `${horas}h atrás`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ontem'
  return `${dias} dias atrás`
}

function minutosAtras(ts: string | null | undefined): number | null {
  if (!ts) return null
  try {
    const d = new Date(ts).getTime()
    return Math.floor((Date.now() - d) / 60000)
  } catch {
    return null
  }
}
