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

// Email da Service Account do Google que lê as planilhas dos clientes.
// Configurável via VITE_CRM_SHEETS_SA_EMAIL no .env (fallback hardcoded).
const SHEETS_SA_EMAIL =
  (import.meta.env.VITE_CRM_SHEETS_SA_EMAIL as string | undefined) ??
  'movmed-sheets-reader@movmed-crm.iam.gserviceaccount.com'

interface Props {
  cliente: Cliente
}

export function LeadsPanel({ cliente }: Props) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroCanal, setFiltroCanal] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [sheetsOpen, setSheetsOpen] = useState(false)
  const [leadDetalhe, setLeadDetalhe] = useState<Lead | null>(null)

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

  // Meses únicos a partir das datas (formato YYYY-MM ordenado desc)
  const meses = useMemo(() => {
    const set = new Set<string>()
    for (const l of leads) {
      if (!l.data_entrada) continue
      const mes = l.data_entrada.slice(0, 7) // YYYY-MM
      if (mes.length === 7) set.add(mes)
    }
    return Array.from(set).sort().reverse()
  }, [leads])

  // Canais únicos extraídos de dados_extras.canal
  const canais = useMemo(() => {
    const set = new Set<string>()
    for (const l of leads) {
      const c = l.dados_extras?.canal
      if (c && String(c).trim()) set.add(String(c).trim())
    }
    return Array.from(set).sort()
  }, [leads])

  function nomeMes(ym: string): string {
    const [y, m] = ym.split('-')
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${nomes[+m - 1] ?? m}/${y}`
  }

  const filtered = leads.filter((l) => {
    if (filtroEtapa && l.etapa !== filtroEtapa) return false
    if (filtroMes) {
      if (!l.data_entrada || l.data_entrada.slice(0, 7) !== filtroMes) return false
    }
    if (filtroCanal) {
      const c = l.dados_extras?.canal
      if (!c || String(c).trim() !== filtroCanal) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="w-32"
          >
            <option value="">Todos meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nomeMes(m)}
              </option>
            ))}
          </Select>
          <Select
            value={filtroCanal}
            onChange={(e) => setFiltroCanal(e.target.value)}
            className="w-40"
          >
            <option value="">Todas plataformas</option>
            {canais.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)}
            className="w-44"
          >
            <option value="">Todas etapas</option>
            {etapas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          {(filtroMes || filtroCanal || filtroEtapa) && (
            <button
              type="button"
              onClick={() => {
                setFiltroMes('')
                setFiltroCanal('')
                setFiltroEtapa('')
              }}
              className="text-[11px] text-muted underline-offset-2 hover:text-zinc-200 hover:underline"
            >
              Limpar filtros
            </button>
          )}
          <Badge tone={readonly ? 'info' : 'brand'}>
            {readonly ? 'Fonte: Kommo (read-only)' : 'Fonte: Nativo'}
          </Badge>
          <span className="text-[11px] text-muted">
            {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
          </span>
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

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-bg-soft">
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5">Data</th>
              <th className="px-3 py-2.5">Nome</th>
              <th className="px-3 py-2.5">Contato</th>
              <th className="px-3 py-2.5">De onde veio?</th>
              <th className="px-3 py-2.5">Contato perdido / Motivo?</th>
              <th className="px-3 py-2.5 text-center">Agendou?</th>
              <th className="px-3 py-2.5 text-center">Realizada?</th>
              <th className="px-3 py-2.5 text-center">Fechado?</th>
              <th className="px-3 py-2.5 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted">
                  Nenhum lead.
                </td>
              </tr>
            ) : (
              filtered.map((l) => {
                const extras = l.dados_extras ?? {}
                const canal = (extras.canal as string | undefined) ?? null
                const motivo = (extras.motivo_perdido as string | undefined) ?? null
                const agendou = extras.agendou_consulta as boolean | null | undefined
                const realizou = extras.consulta_realizada as boolean | null | undefined
                const fechou = extras.tratamento_fechado as boolean | null | undefined

                return (
                  <tr
                    key={l.id}
                    className="cursor-pointer border-t border-border hover:bg-bg-soft"
                    onClick={() => setLeadDetalhe(l)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-300">
                      {formatDate(l.data_entrada)}
                    </td>
                    <td className="px-3 py-2 font-medium">{l.nome ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-300">
                      {l.telefone ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <CanalCell canal={canal} />
                    </td>
                    <td className="px-3 py-2">
                      <MotivoCell motivo={motivo} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <SimNaoCell value={agendou} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <SimNaoCell value={realizou} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <SimNaoCell value={fechou} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300">
                      {formatCurrency(l.valor ?? null)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <LeadDetalheModal
        lead={leadDetalhe}
        onClose={() => setLeadDetalhe(null)}
      />

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
   Celulas coloridas — reproduzem visual da planilha do cliente
========================================================= */

function CanalCell({ canal }: { canal: string | null | undefined }) {
  if (!canal) return <span className="text-muted">—</span>
  const c = canal.toLowerCase().trim()
  // Cores semanticas por canal — replica visual do Google Sheets
  let cls = 'bg-zinc-700 text-zinc-100'
  if (c.includes('google')) cls = 'bg-emerald-600/90 text-emerald-50'
  else if (c.includes('meta') || c.includes('facebook')) cls = 'bg-sky-600/90 text-sky-50'
  else if (c.includes('instagram')) cls = 'bg-blue-600/90 text-blue-50'
  else if (c.includes('tiktok')) cls = 'bg-pink-600/90 text-pink-50'
  else if (c.includes('whatsapp')) cls = 'bg-emerald-500/90 text-emerald-50'
  else if (c.includes('indica')) cls = 'bg-purple-600/90 text-purple-50'
  return (
    <span
      className={
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ' + cls
      }
    >
      {canal}
    </span>
  )
}

function MotivoCell({ motivo }: { motivo: string | null | undefined }) {
  if (!motivo) return <span className="text-muted">—</span>
  return (
    <span className="inline-flex items-center rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-200">
      {motivo}
    </span>
  )
}

function SimNaoCell({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-muted">—</span>
  }
  if (value) {
    return (
      <span className="inline-flex items-center rounded bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-50">
        Sim
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold uppercase text-red-50">
      Não
    </span>
  )
}

/* =========================================================
   Modal: Detalhes do lead — mostra campos basicos + dados_extras
========================================================= */

function LeadDetalheModal({
  lead,
  onClose,
}: {
  lead: Lead | null
  onClose: () => void
}) {
  if (!lead) return null

  const extras = (lead.dados_extras ?? {}) as Record<string, unknown>
  const extrasOrdenados: Array<[string, unknown]> = [
    ['Canal', extras.canal],
    ['Motivo perdido', extras.motivo_perdido],
    ['Agendou consulta', extras.agendou_consulta],
    ['Consulta realizada', extras.consulta_realizada],
    ['Tratamento fechado', extras.tratamento_fechado],
    ['Mensagem de confirmação', extras.mensagem_confirmacao],
  ]
  // Campos extras não previstos (caso a planilha tenha colunas novas)
  const camposConhecidos = new Set([
    'canal',
    'motivo_perdido',
    'agendou_consulta',
    'consulta_realizada',
    'tratamento_fechado',
    'mensagem_confirmacao',
  ])
  for (const [k, v] of Object.entries(extras)) {
    if (!camposConhecidos.has(k)) {
      extrasOrdenados.push([k, v])
    }
  }

  function formatExtra(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—'
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
    return String(v)
  }

  return (
    <Modal
      open={!!lead}
      onClose={onClose}
      title="Detalhes do lead"
      className="max-w-2xl"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Cabeçalho — info principal */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={lead.nome ?? '—'} />
          <Field label="Telefone" value={lead.telefone ?? '—'} />
          <Field label="Email" value={lead.email ?? '—'} />
          <Field label="Etapa" value={lead.etapa ?? '—'} />
          <Field label="Valor" value={formatCurrency(lead.valor ?? null)} />
          <Field label="Data de entrada" value={formatDate(lead.data_entrada)} />
        </div>

        {/* Dados extras da planilha */}
        {extrasOrdenados.some(([, v]) => v !== null && v !== undefined && v !== '') && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Detalhes da planilha
            </h4>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-bg-soft p-3">
              {extrasOrdenados.map(([label, v]) => (
                <Field key={label} label={label} value={formatExtra(v)} />
              ))}
            </div>
          </div>
        )}

        {/* Observações */}
        {lead.observacoes && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Observações
            </h4>
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-bg-soft p-3 text-xs text-zinc-300">
              {lead.observacoes}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="border-t border-border pt-2 text-[10px] text-muted">
          Fonte: <strong>{lead.origem}</strong>
          {lead.external_ref && (
            <>
              {' · '}
              <span className="font-mono">{lead.external_ref}</span>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-200">{value}</p>
    </div>
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
  // (URL da Edge Function não é mais exposta na UI — n8n consome
  //  internamente. Mantemos SHEETS_SA_EMAIL no topo do arquivo.)

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
      title="Conectar Google Sheets (via n8n)"
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
                    <>Configure os 2 passos abaixo. Quando o n8n rodar (≤2min), os leads aparecem aqui.</>
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
                Compartilhar planilha com
              </span>
              <span className="text-[10px] text-muted">Leitor</span>
            </div>
            <div className="flex gap-1.5">
              <Input value={SHEETS_SA_EMAIL} readOnly className="flex-1 font-mono text-[11px]" />
              <Button size="sm" variant="outline" onClick={() => copy(SHEETS_SA_EMAIL, 'sa')}>
                {copying === 'sa' ? <Check size={12} /> : <Copy size={12} />}
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted">
              Cliente compartilha a planilha com esse email (Permissão: Leitor).
            </p>
          </div>
        </div>

        {/* URL DA PLANILHA — obrigatorio agora */}
        <div className="rounded-lg border border-border bg-bg-soft p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              URL da planilha do cliente
            </span>
            <span className="text-[10px] text-brand-300">obrigatório</span>
          </div>
          <div className="flex gap-1.5">
            <Input
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
              className="flex-1 font-mono text-[11px]"
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
          <p className="mt-1 text-[10px] text-muted">
            Copie da barra de endereço enquanto está na aba dos leads —
            o <code className="rounded bg-bg-elev px-1">gid</code> identifica a aba certa.
          </p>
        </div>

        {/* PASSO A PASSO — fluxo n8n */}
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3 text-xs">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-200">
            <FileSpreadsheet size={14} />
            Como conectar
          </h4>
          <ol className="space-y-1.5 text-zinc-300">
            <li>
              <strong className="text-brand-300">1.</strong> Cliente abre a planilha → clica em{' '}
              <em>Compartilhar</em> → cola o email da Service Account (acima) → permissão{' '}
              <strong>Leitor</strong> → Enviar
            </li>
            <li>
              <strong className="text-brand-300">2.</strong> Cole a URL da planilha no campo{' '}
              <em>"URL da planilha"</em> acima → Salvar
              <span className="ml-1 text-muted">
                (de preferência copie da barra de endereço estando na aba certa — o
                <code className="mx-0.5 rounded bg-bg-elev px-1 text-[10px]">gid</code>
                identifica qual aba ler)
              </span>
            </li>
            <li>
              <strong className="text-brand-300">3.</strong> Aguarde até{' '}
              <strong>2 minutos</strong> — o n8n vai puxar as linhas e os leads vão aparecer no
              CRM acima. O status no topo deste modal vai virar verde.
            </li>
          </ol>

          <div className="mt-3 rounded border border-border bg-bg-elev p-2 text-[10.5px] text-muted">
            <p className="mb-1 font-semibold text-zinc-300">Cabeçalhos reconhecidos na planilha:</p>
            <span className="text-zinc-300">Nome</span>, <span className="text-zinc-300">Telefone</span>,{' '}
            <span className="text-zinc-300">Email</span>, <span className="text-zinc-300">Etapa</span>,{' '}
            <span className="text-zinc-300">Valor</span>, <span className="text-zinc-300">Data</span>,{' '}
            <span className="text-zinc-300">Observações</span> + sinônimos comuns (WhatsApp, Contato,
            E-mail, Status, Ticket, etc). Campos extras (de onde veio, motivo perdido, agendou, etc)
            entram em "Detalhes da planilha" automaticamente.
          </div>

          <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[10.5px] text-amber-200">
            <strong>⚠ Importante:</strong> a planilha precisa estar em formato{' '}
            <strong>Google Sheets nativo</strong> (não Excel .xlsx).
            Se o cliente compartilhar um .xlsx do Drive, abra a planilha e use{' '}
            <em>Arquivo → Salvar como Planilha Google</em> antes.
          </div>
        </div>

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
