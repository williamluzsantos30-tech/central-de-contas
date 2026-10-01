import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { frequenciaLabel } from '@/lib/utils'
import { hojeISO, modeloDaTarefa, ocorrenciaAtual } from '@/lib/ocorrencias'
import { ocorrenciasNoBanco } from '@/lib/ocorrenciasStore'
import { carregarResponsaveisTarefa } from './TarefaUI'
import type { FrequenciaTarefa, Profile, Tarefa } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  clienteId: string
  frequencia: FrequenciaTarefa
  /** Já vem selecionado (gestor de tráfego do cliente). */
  responsavelPadrao?: string | null
  onCreated: () => void
}

const DIAS = [
  [1, 'Segunda'],
  [2, 'Terça'],
  [3, 'Quarta'],
  [4, 'Quinta'],
  [5, 'Sexta'],
] as const

export function NovaTarefaModal({ open, onClose, clienteId, frequencia, responsavelPadrao, onCreated }: Props) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState<Tarefa['prioridade']>('media')
  const [responsavelId, setResponsavelId] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [dia, setDia] = useState(1)
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNome('')
    setDescricao('')
    setPrioridade('media')
    setResponsavelId(responsavelPadrao ?? '')
    setVencimento('')
    setDia(frequencia === 'mensal' ? new Date().getDate() : 1)
    setErro(null)
    carregarResponsaveisTarefa().then(setResponsaveis)
  }, [open, frequencia, responsavelPadrao])

  async function save() {
    if (!nome.trim()) return
    setSaving(true)
    setErro(null)
    const hoje = hojeISO()
    const recorrente = frequencia !== 'esporadica'
    // Vencimento legado = 1ª ocorrência (outras telas ainda leem esse campo).
    const primeira = recorrente
      ? ocorrenciaAtual(
          modeloDaTarefa({
            id: 'nova',
            cliente_id: clienteId,
            template_id: null,
            nome,
            descricao: null,
            frequencia,
            prioridade,
            status: 'pendente',
            responsavel_id: null,
            data_vencimento: null,
            data_conclusao: null,
            dia_referencia: frequencia === 'diaria' ? null : dia,
            ocorrencias_desde: hoje,
            created_at: hoje,
            updated_at: hoje,
          }),
          [],
          hoje,
        )?.dataPrevista ?? null
      : null
    const { error } = await supabase.from('tarefas').insert({
      cliente_id: clienteId,
      nome: nome.trim(),
      descricao: descricao || null,
      frequencia,
      prioridade,
      status: 'pendente',
      responsavel_id: responsavelId || null,
      data_vencimento: recorrente ? primeira : vencimento || null,
      // Colunas da migration 098 só quando ela já rodou.
      ...(recorrente && ocorrenciasNoBanco() === true
        ? { dia_referencia: frequencia === 'diaria' ? null : dia, ocorrencias_desde: hoje }
        : {}),
    })
    setSaving(false)
    if (error) {
      setErro(`Não foi possível criar: ${error.message}`)
      return
    }
    onCreated()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Nova tarefa · ${frequenciaLabel[frequencia]}`}
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
        <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Tarefa['prioridade'])} aria-label="Prioridade">
            <option value="baixa">Prioridade baixa</option>
            <option value="media">Prioridade média</option>
            <option value="alta">Prioridade alta</option>
          </Select>
          {frequencia === 'esporadica' && (
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} aria-label="Prazo" title="Prazo" />
          )}
          {frequencia === 'semanal' && (
            <Select value={String(dia)} onChange={(e) => setDia(Number(e.target.value))} aria-label="Dia da semana">
              {DIAS.map(([v, l]) => (
                <option key={v} value={v}>
                  Toda {l.toLowerCase()}
                </option>
              ))}
            </Select>
          )}
          {frequencia === 'mensal' && (
            <label className="flex items-center gap-2 text-xs text-muted">
              Todo dia
              <Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} className="w-20" />
            </label>
          )}
          {frequencia === 'diaria' && <p className="self-center text-xs text-muted">Uma ocorrência por dia útil.</p>}
          <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} aria-label="Responsável">
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
        </div>
        {erro && <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{erro}</p>}
      </div>
    </Modal>
  )
}
