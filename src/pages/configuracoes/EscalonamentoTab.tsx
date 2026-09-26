/**
 * Configurações › Escalonamento — destinatários do e-mail de escalonamento
 * (atrasos) e histórico de envios. Veio do Admin (26/09/2026). Só admin.
 */
import { useEffect, useState } from 'react'
import { Clock, Plus, Pencil, Trash2, AlertTriangle, Mail } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'
import type { EscalonamentoDestinatario, EscalonamentoNotificacao } from '@/types/database'

/* =========================================================
   Tab: Escalonamento (destinatários do email + histórico)
   ========================================================= */

export function EscalonamentoTab() {
  const [destinatarios, setDestinatarios] = useState<EscalonamentoDestinatario[]>([])
  const [notificacoes, setNotificacoes] = useState<EscalonamentoNotificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<EscalonamentoDestinatario | null>(null)

  async function load() {
    setLoading(true)
    const [dRes, nRes] = await Promise.all([
      supabase.from('escalonamento_destinatarios').select('*').order('nome'),
      supabase
        .from('escalonamento_notificacoes')
        .select('*, cliente:clientes(nome)')
        .order('enviado_em', { ascending: false })
        .limit(30),
    ])
    setDestinatarios((dRes.data as EscalonamentoDestinatario[]) ?? [])
    setNotificacoes((nRes.data as EscalonamentoNotificacao[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleAtivo(d: EscalonamentoDestinatario) {
    await supabase
      .from('escalonamento_destinatarios')
      .update({ ativo: !d.ativo })
      .eq('id', d.id)
    load()
  }

  async function excluir(d: EscalonamentoDestinatario) {
    if (!confirm(`Remover ${d.nome} (${d.email}) da lista de notificações?`)) return
    await supabase.from('escalonamento_destinatarios').delete().eq('id', d.id)
    load()
  }

  const ativos = destinatarios.filter((d) => d.ativo).length

  return (
    <div className="space-y-5">
      {/* Aviso sobre email pendente */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div>
          <strong>Envio de email ainda não ativado.</strong> Esta lista define{' '}
          <em>quem vai receber</em> os alertas de escalonamento (conta crítica há 2+
          semanas). O disparo automático (diário às 8h) é ligado quando o provedor de
          email (Resend) for configurado. Por ora, o alerta aparece no painel{' '}
          <strong>Controle do Head</strong>.
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail size={16} /> Destinatários ({ativos} ativo{ativos === 1 ? '' : 's'})
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditando(null)
              setModalOpen(true)
            }}
          >
            <Plus size={14} /> Adicionar destinatário
          </Button>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted">Carregando...</div>
          ) : destinatarios.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              Nenhum destinatário cadastrado ainda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-soft">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Nome</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {destinatarios.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-bg-soft">
                    <td className="px-4 py-3 font-medium text-zinc-100">{d.nome}</td>
                    <td className="px-3 py-3 text-zinc-300">{d.email}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => toggleAtivo(d)}>
                        <Badge tone={d.ativo ? 'success' : 'neutral'}>
                          {d.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditando(d)
                            setModalOpen(true)
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-brand-500/40 hover:text-brand-300"
                          title="Editar"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => excluir(d)}
                          className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-red-500/40 hover:text-red-400"
                          title="Remover"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Histórico de notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={16} /> Histórico de notificações
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {notificacoes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              Nenhuma notificação enviada ainda. Quando o email for ativado, os envios
              aparecem aqui.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-soft">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5">Destinatários</th>
                </tr>
              </thead>
              <tbody>
                {notificacoes.map((n) => (
                  <tr key={n.id} className="border-t border-border">
                    <td className="px-4 py-3 text-zinc-300">{formatDateTime(n.enviado_em)}</td>
                    <td className="px-3 py-3 text-zinc-100">{n.cliente?.nome ?? '—'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={n.tipo === 'diretoria' ? 'danger' : 'warning'}>
                        {n.tipo === 'diretoria' ? 'Diretoria' : 'Reclassificar'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-muted">
                      {(n.destinatarios ?? []).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <DestinatarioModal
        open={modalOpen}
        destinatario={editando}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          load()
        }}
      />
    </div>
  )
}

function DestinatarioModal({
  open,
  destinatario,
  onClose,
  onSaved,
}: {
  open: boolean
  destinatario: EscalonamentoDestinatario | null
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNome(destinatario?.nome ?? '')
    setEmail(destinatario?.email ?? '')
    setErro(null)
  }, [open, destinatario])

  async function salvar() {
    const n = nome.trim()
    const e = email.trim()
    if (!n || !e) {
      setErro('Preencha nome e email.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setErro('Email inválido.')
      return
    }
    setSaving(true)
    const payload = { nome: n, email: e }
    const res = destinatario
      ? await supabase
          .from('escalonamento_destinatarios')
          .update(payload)
          .eq('id', destinatario.id)
      : await supabase.from('escalonamento_destinatarios').insert(payload)
    setSaving(false)
    if (res.error) {
      setErro(
        res.error.message.includes('duplicate')
          ? 'Já existe um destinatário com esse email.'
          : res.error.message,
      )
      return
    }
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={destinatario ? 'Editar destinatário' : 'Novo destinatário'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {erro && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {erro}
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Nome
          </span>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Lucas Antonio" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Email
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="diretoria@empresa.com.br"
          />
        </label>
      </div>
    </Modal>
  )
}
