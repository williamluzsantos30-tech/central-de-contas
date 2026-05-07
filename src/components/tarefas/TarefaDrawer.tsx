import { useEffect, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'
import { formatDateTime, frequenciaLabel } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, Tarefa, TarefaComentario } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  tarefa: Tarefa | null
  onChanged: () => void
}

export function TarefaDrawer({ open, onClose, tarefa, onChanged }: Props) {
  const { profile } = useAuth()
  const [form, setForm] = useState<Partial<Tarefa>>({})
  const [comentarios, setComentarios] = useState<TarefaComentario[]>([])
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [novo, setNovo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tarefa) return
    setForm({
      nome: tarefa.nome,
      descricao: tarefa.descricao ?? '',
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      responsavel_id: tarefa.responsavel_id,
      data_vencimento: tarefa.data_vencimento,
    })
    loadComentarios(tarefa.id)
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
  }, [tarefa])

  async function loadComentarios(tid: string) {
    const { data } = await supabase
      .from('tarefa_comentarios')
      .select('*, autor:profiles(*)')
      .eq('tarefa_id', tid)
      .order('created_at', { ascending: false })
    setComentarios((data as TarefaComentario[]) ?? [])
  }

  async function salvar() {
    if (!tarefa) return
    setSaving(true)
    await supabase
      .from('tarefas')
      .update({
        nome: form.nome,
        descricao: form.descricao || null,
        prioridade: form.prioridade,
        status: form.status,
        responsavel_id: form.responsavel_id || null,
        data_vencimento: form.data_vencimento || null,
        data_conclusao: form.status === 'concluida' ? new Date().toISOString() : null,
      })
      .eq('id', tarefa.id)
    setSaving(false)
    onChanged()
  }

  async function addComentario() {
    if (!tarefa || !profile || !novo.trim()) return
    await supabase
      .from('tarefa_comentarios')
      .insert({ tarefa_id: tarefa.id, autor_id: profile.id, texto: novo.trim() })
    setNovo('')
    loadComentarios(tarefa.id)
  }

  async function excluir() {
    if (!tarefa) return
    if (!confirm('Excluir esta tarefa?')) return
    await supabase.from('tarefas').delete().eq('id', tarefa.id)
    onChanged()
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={tarefa?.nome ?? 'Tarefa'}>
      {!tarefa ? null : (
        <div className="space-y-5">
          <div className="text-xs text-muted">
            {frequenciaLabel[tarefa.frequencia]} • criada em {formatDateTime(tarefa.created_at)}
          </div>

          <Field label="Nome">
            <Input value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>

          <Field label="Descrição">
            <Textarea
              value={form.descricao ?? ''}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={form.status ?? 'pendente'}
                onChange={(e) => setForm({ ...form, status: e.target.value as Tarefa['status'] })}
              >
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select
                value={form.prioridade ?? 'media'}
                onChange={(e) =>
                  setForm({ ...form, prioridade: e.target.value as Tarefa['prioridade'] })
                }
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </Select>
            </Field>
            <Field label="Responsável">
              <Select
                value={form.responsavel_id ?? ''}
                onChange={(e) => setForm({ ...form, responsavel_id: e.target.value || null })}
              >
                <option value="">—</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vencimento">
              <Input
                type="date"
                value={form.data_vencimento ?? ''}
                onChange={(e) => setForm({ ...form, data_vencimento: e.target.value || null })}
              />
            </Field>
          </div>

          <div className="flex justify-between">
            <Button variant="danger" size="sm" onClick={excluir}>
              Excluir
            </Button>
            <Button onClick={salvar} disabled={saving} size="sm">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Comentários
            </p>
            <div className="flex gap-2">
              <Textarea
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                placeholder="Escreva um comentário..."
                className="min-h-[60px]"
              />
              <Button onClick={addComentario} size="sm" className="self-end">
                Enviar
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {comentarios.map((c) => (
                <div
                  key={c.id}
                  className="flex gap-2 rounded-lg border border-border bg-bg-soft p-2"
                >
                  <Avatar name={c.autor?.nome} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{c.autor?.nome ?? '—'}</span>
                      <span className="text-muted">{formatDateTime(c.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.texto}</p>
                  </div>
                </div>
              ))}
              {comentarios.length === 0 && (
                <p className="text-center text-xs text-muted py-4">Nenhum comentário ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
