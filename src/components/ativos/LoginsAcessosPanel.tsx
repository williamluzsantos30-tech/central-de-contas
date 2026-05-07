import { useEffect, useState } from 'react'
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { supabase } from '@/lib/supabase'
import type { LoginAcesso } from '@/types/database'

interface Props {
  clienteId: string
}

export function LoginsAcessosPanel({ clienteId }: Props) {
  const [items, setItems] = useState<LoginAcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LoginAcesso | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('logins_acessos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('plataforma')
    setItems((data as LoginAcesso[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [clienteId])

  async function excluir(id: string) {
    if (!confirm('Excluir este login?')) return
    await supabase.from('logins_acessos').delete().eq('id', id)
    load()
  }

  return (
    <Card className="group/asset relative flex flex-col overflow-hidden">
      {/* corner gradient */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br from-brand-500/15 to-transparent blur-3xl opacity-70"
      />

      <CardBody className="relative flex flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-500/30 bg-brand-500/10 transition-all duration-300 group-hover/asset:scale-105 group-hover/asset:shadow-[0_0_25px_-6px_rgba(249,115,22,0.6)]">
              <KeyRound size={18} className="text-brand-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-100 leading-tight">Logins e Acessos</h3>
              <p className="mt-0.5 text-[11px] text-muted">
                {items.length === 0
                  ? 'Nenhum cadastrado'
                  : `${items.length} ${items.length === 1 ? 'credencial' : 'credenciais'}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft px-2 py-1 text-[11px] text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300"
            title="Adicionar login"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-muted">Carregando...</p>
          ) : items.length === 0 ? (
            <div className="flex h-full min-h-[100px] items-center justify-center rounded-md border border-dashed border-border bg-bg-soft/50 p-3 text-center text-xs text-muted">
              Nenhum login cadastrado.<br />Clique em "Adicionar" para começar.
            </div>
          ) : (
            items.map((item) => (
              <LoginRow
                key={item.id}
                item={item}
                onEdit={() => {
                  setEditing(item)
                  setModalOpen(true)
                }}
                onDelete={() => excluir(item.id)}
              />
            ))
          )}
        </div>
      </CardBody>

      <LoginModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clienteId={clienteId}
        item={editing}
        onSaved={load}
      />
    </Card>
  )
}

function LoginRow({
  item,
  onEdit,
  onDelete,
}: {
  item: LoginAcesso
  onEdit: () => void
  onDelete: () => void
}) {
  const [reveal, setReveal] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(field)
      setTimeout(() => setCopied((v) => (v === field ? null : v)), 1200)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-soft p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{item.plataforma}</span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-brand-300 hover:underline"
              >
                <ExternalLink size={10} /> abrir
              </a>
            )}
          </div>
          <div className="mt-2 grid gap-1.5 text-xs">
            <CredField
              label="Login"
              value={item.login}
              copied={copied === 'login'}
              onCopy={() => copy(item.login, 'login')}
            />
            {item.senha && (
              <CredField
                label="Senha"
                value={item.senha}
                masked={!reveal}
                copied={copied === 'senha'}
                onCopy={() => copy(item.senha!, 'senha')}
                onToggleReveal={() => setReveal((v) => !v)}
                revealed={reveal}
              />
            )}
          </div>
          {item.notas && (
            <p className="mt-2 text-[11px] text-muted whitespace-pre-wrap">{item.notas}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-brand-300"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-red-300"
            title="Excluir"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CredField({
  label,
  value,
  masked,
  onCopy,
  onToggleReveal,
  revealed,
  copied,
}: {
  label: string
  value: string
  masked?: boolean
  onCopy: () => void
  onToggleReveal?: () => void
  revealed?: boolean
  copied: boolean
}) {
  const display = masked ? '•'.repeat(Math.min(value.length, 12)) : value
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </span>
      <code className="flex-1 truncate rounded border border-border bg-bg-elev px-2 py-1 font-mono text-[12px] text-zinc-200">
        {display}
      </code>
      {onToggleReveal && (
        <button
          onClick={onToggleReveal}
          className="rounded p-1 text-muted hover:bg-bg-elev hover:text-brand-300"
          title={revealed ? 'Ocultar' : 'Mostrar'}
        >
          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
      <button
        onClick={onCopy}
        className={
          copied
            ? 'inline-flex items-center gap-1 rounded bg-emerald-500/15 p-1 text-[10px] text-emerald-300'
            : 'rounded p-1 text-muted hover:bg-bg-elev hover:text-brand-300'
        }
        title="Copiar"
      >
        {copied ? (
          <span className="px-0.5">copiado</span>
        ) : (
          <Copy size={12} />
        )}
      </button>
    </div>
  )
}

function LoginModal({
  open,
  onClose,
  clienteId,
  item,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  clienteId: string
  item: LoginAcesso | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    plataforma: '',
    login: '',
    senha: '',
    url: '',
    notas: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (item) {
      setForm({
        plataforma: item.plataforma,
        login: item.login,
        senha: item.senha ?? '',
        url: item.url ?? '',
        notas: item.notas ?? '',
      })
    } else {
      setForm({ plataforma: '', login: '', senha: '', url: '', notas: '' })
    }
    setError(null)
  }, [open, item])

  async function save() {
    if (!form.plataforma.trim()) {
      setError('Plataforma é obrigatória')
      return
    }
    if (!form.login.trim()) {
      setError('Login / Email é obrigatório')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      cliente_id: clienteId,
      plataforma: form.plataforma.trim(),
      login: form.login.trim(),
      senha: form.senha || null,
      url: form.url || null,
      notas: form.notas || null,
    }
    const { error: err } = item
      ? await supabase.from('logins_acessos').update(payload).eq('id', item.id)
      : await supabase.from('logins_acessos').insert(payload)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Editar Login' : 'Adicionar Login'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-muted">
        Preencha as credenciais de acesso da plataforma.
      </p>
      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <Field label="Plataforma" required>
          <Input
            value={form.plataforma}
            onChange={(e) => setForm({ ...form, plataforma: e.target.value })}
            placeholder="Ex: Google Ads, Meta Business"
            autoFocus
          />
        </Field>
        <Field label="Login / Email" required>
          <Input
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value })}
            placeholder="usuario@email.com"
          />
        </Field>
        <Field label="Senha">
          <Input
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            placeholder="Senha de acesso"
            type="text"
          />
        </Field>
        <Field label="URL de acesso">
          <Input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <Field label="Notas">
          <Textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Observações adicionais"
            className="min-h-[70px]"
          />
        </Field>
      </div>
    </Modal>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
        {required && <span className="ml-0.5 text-red-300">*</span>}
      </span>
      {children}
    </label>
  )
}
