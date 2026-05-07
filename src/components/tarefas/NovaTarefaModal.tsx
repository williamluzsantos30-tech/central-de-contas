import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import type { FrequenciaTarefa, Profile } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  clienteId: string
  frequencia: FrequenciaTarefa
  onCreated: () => void
}

export function NovaTarefaModal({ open, onClose, clienteId, frequencia, onCreated }: Props) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [responsavelId, setResponsavelId] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNome('')
    setDescricao('')
    setPrioridade('media')
    setResponsavelId('')
    setVencimento('')
    supabase
      .from('profiles')
      .select('*')
      .eq('ativo', true)
      .eq('aprovado', true)
      .order('nome')
      .then(({ data }) => setResponsaveis((data as Profile[]) ?? []))
  }, [open])

  async function save() {
    if (!nome.trim()) return
    setSaving(true)
    await supabase.from('tarefas').insert({
      cliente_id: clienteId,
      nome: nome.trim(),
      descricao: descricao || null,
      frequencia,
      prioridade,
      responsavel_id: responsavelId || null,
      data_vencimento: vencimento || null,
    })
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova tarefa"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !nome.trim()}>
            {saving ? 'Criando...' : 'Criar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input placeholder="Nome da tarefa" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Textarea
          placeholder="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </Select>
          <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  )
}
