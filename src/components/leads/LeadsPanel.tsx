import { useEffect, useMemo, useState } from 'react'
import { Plus, Upload, FileSpreadsheet, Copy, Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Cliente, Lead } from '@/types/database'

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
   Modal: Conectar Google Sheets (webhook via Apps Script)
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

  useEffect(() => {
    setSheetsUrl(cliente.crm_sheets_url ?? '')
  }, [cliente.crm_sheets_url])

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
    // Gera token novo (32 chars hex) no banco
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

  const appsScriptCode = `/**
 * MovMed CRM — envio automático de leads pro Central de Contas.
 * Toda vez que uma nova linha for adicionada na planilha (manual,
 * Google Forms, automação), este script POSTa o lead pra plataforma.
 *
 * Mapeamento de colunas: o script lê a primeira linha (headers) e
 * tenta detectar nome/telefone/email/etapa/valor automaticamente.
 *
 * Configure o trigger em Acionadores → onEdit (ou onFormSubmit
 * se a planilha estiver ligada a um Google Forms).
 */
const SUPABASE_URL = ${JSON.stringify(rpcUrl)};
const ANON_KEY = ${JSON.stringify(ANON_KEY ?? 'CONFIGURE_VITE_SUPABASE_ANON_KEY')};
const TOKEN = ${JSON.stringify(cliente.crm_sheets_token)};

function enviarParaCRM(e) {
  try {
    const sheet = e ? e.range.getSheet() : SpreadsheetApp.getActiveSheet();
    const row = e ? e.range.getRow() : sheet.getLastRow();
    if (row < 2) return; // pula header

    // Lê headers (linha 1) e a linha de dados
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h =>
      String(h || '').toLowerCase().trim()
    );
    const values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    // Helper: encontra coluna pelo nome (com sinônimos)
    function find(...nomes) {
      for (const n of nomes) {
        const i = headers.indexOf(n);
        if (i >= 0) return values[i];
      }
      return null;
    }

    const nome = find('nome', 'nome completo', 'cliente');
    const telefone = find('telefone', 'whatsapp', 'celular', 'fone');
    const email = find('email', 'e-mail');
    const etapa = find('etapa', 'status', 'fase');
    const valorBruto = find('valor', 'ticket', 'preço', 'preco');
    const valor = valorBruto ? Number(String(valorBruto).replace(/[^\\d,.-]/g, '').replace(',', '.')) : null;
    const data = find('data', 'data de entrada', 'carimbo de data/hora');
    const observacoes = find('observações', 'observacoes', 'notas', 'obs');

    // Não envia se não tem nem nome nem telefone (linha em branco)
    if (!nome && !telefone) return;

    const payload = {
      p_token: TOKEN,
      p_nome: nome ? String(nome) : null,
      p_telefone: telefone ? String(telefone) : null,
      p_email: email ? String(email) : null,
      p_etapa: etapa ? String(etapa) : null,
      p_valor: isNaN(valor) ? null : valor,
      p_data_entrada: data ? new Date(data).toISOString() : null,
      p_observacoes: observacoes ? String(observacoes) : null,
    };

    const response = UrlFetchApp.fetch(SUPABASE_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': ANON_KEY,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    Logger.log('Status: ' + response.getResponseCode());
    Logger.log('Body: ' + response.getContentText());
  } catch (err) {
    Logger.log('Erro: ' + err);
  }
}
`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conectar Google Sheets — CRM"
      className="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3 text-xs leading-relaxed text-brand-200">
          <strong>Como funciona:</strong> você instala um pequeno script na planilha
          desse cliente. Toda vez que uma linha nova for adicionada, o script POSTa
          o lead direto pra essa página em tempo real. Sem importar CSV manualmente.
        </div>

        {/* Passo 1: URL da planilha (referência) */}
        <Section numero="1" titulo="URL da planilha (opcional, só pra referência)">
          <div className="flex gap-2">
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
        </Section>

        {/* Passo 2: token (read-only, copy) */}
        <Section
          numero="2"
          titulo="Token deste cliente (secreto)"
          extra={
            <button
              type="button"
              onClick={regenerarToken}
              disabled={regenerating}
              className="text-[10px] text-muted hover:text-red-300 underline-offset-2 hover:underline"
              title="Cria um token novo e invalida o atual"
            >
              <RefreshCw size={10} className="inline" /> Regenerar
            </button>
          }
        >
          <div className="flex gap-2">
            <Input
              value={cliente.crm_sheets_token}
              readOnly
              className="flex-1 font-mono text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(cliente.crm_sheets_token, 'token')}
            >
              {copying === 'token' ? (
                <>
                  <Check size={12} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={12} /> Copiar
                </>
              )}
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Cada cliente tem um token único. Não compartilhe — é o que autoriza o envio
            de leads pra esse cliente específico.
          </p>
        </Section>

        {/* Passo 3: instruções + código */}
        <Section
          numero="3"
          titulo="Código do Apps Script (copia e cola na planilha)"
          extra={
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
          }
        >
          <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-bg-soft p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
            {appsScriptCode}
          </pre>
        </Section>

        {/* Passo a passo */}
        <Section numero="4" titulo="Passo a passo na planilha">
          <ol className="space-y-1.5 text-xs leading-relaxed text-zinc-300">
            <li>
              <strong>1.</strong> Abra a planilha do cliente no Google Sheets
            </li>
            <li>
              <strong>2.</strong> Menu <em>Extensões → Apps Script</em>
            </li>
            <li>
              <strong>3.</strong> Apague o código padrão e cole o código acima
            </li>
            <li>
              <strong>4.</strong> Clique em <em>Salvar</em> (ícone de disquete) — dê o nome{' '}
              <code className="rounded bg-bg-elev px-1 py-0.5 text-[10px]">MovMed CRM</code>
            </li>
            <li>
              <strong>5.</strong> Na barra lateral, clique em <em>Acionadores</em> (ícone
              de relógio)
            </li>
            <li>
              <strong>6.</strong> <em>+ Adicionar acionador</em> →
              Função: <code className="rounded bg-bg-elev px-1 py-0.5 text-[10px]">enviarParaCRM</code> →
              Evento: <strong>Em edição</strong> (ou <strong>No envio do formulário</strong> se for Google Forms)
            </li>
            <li>
              <strong>7.</strong> Salvar → autorizar permissões (Google vai pedir 1 vez)
            </li>
            <li>
              <strong>8.</strong> Pronto. Adicione uma linha na planilha pra testar — o
              lead deve aparecer aqui na hora.
            </li>
          </ol>
        </Section>

        <Section numero="5" titulo="Cabeçalhos esperados na planilha (linha 1)">
          <div className="rounded-lg border border-border bg-bg-soft p-3 text-xs leading-relaxed text-muted">
            <p className="mb-2">
              O script detecta as colunas automaticamente pelo nome do cabeçalho. Use
              qualquer um destes (case-insensitive):
            </p>
            <ul className="space-y-0.5 font-mono text-[11px]">
              <li>• <strong className="text-zinc-200">Nome</strong> — "Nome", "Nome completo", "Cliente"</li>
              <li>• <strong className="text-zinc-200">Telefone</strong> — "Telefone", "WhatsApp", "Celular", "Fone"</li>
              <li>• <strong className="text-zinc-200">Email</strong> — "Email", "E-mail"</li>
              <li>• <strong className="text-zinc-200">Etapa</strong> — "Etapa", "Status", "Fase"</li>
              <li>• <strong className="text-zinc-200">Valor</strong> — "Valor", "Ticket", "Preço"</li>
              <li>• <strong className="text-zinc-200">Data</strong> — "Data", "Data de entrada", "Carimbo de data/hora"</li>
              <li>• <strong className="text-zinc-200">Observações</strong> — "Observações", "Notas", "Obs"</li>
            </ul>
          </div>
        </Section>
      </div>
    </Modal>
  )
}

function Section({
  numero,
  titulo,
  extra,
  children,
}: {
  numero: string
  titulo: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-200">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-500/15 text-[10px] font-bold text-brand-300">
            {numero}
          </span>
          {titulo}
        </h4>
        {extra}
      </div>
      {children}
    </div>
  )
}
