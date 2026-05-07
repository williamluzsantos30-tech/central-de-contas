import { useEffect, useMemo, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
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
