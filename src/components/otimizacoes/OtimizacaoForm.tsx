import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
  clienteId: string
  onCreated: () => void
}

export function OtimizacaoForm({ open, onClose, clienteId, onCreated }: Props) {
  const { profile } = useAuth()
  const [plataforma, setPlataforma] = useState('ambos')
  const [tipo, setTipo] = useState('ajuste_lance')
  const [descricao, setDescricao] = useState('')
  const [resultado, setResultado] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!descricao.trim()) return
    setSaving(true)
    await supabase.from('otimizacoes').insert({
      cliente_id: clienteId,
      responsavel_id: profile?.id ?? null,
      plataforma,
      tipo,
      descricao: descricao.trim(),
      resultado: resultado.trim() || null,
      data_otimizacao: data,
    })
    setSaving(false)
    setDescricao('')
    setResultado('')
    onCreated()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova otimização"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !descricao.trim()}>
            {saving ? 'Salvando...' : 'Registrar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Data</span>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Plataforma</span>
            <Select value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
              <option value="google_ads">Google Ads</option>
              <option value="meta_ads">Meta Ads</option>
              <option value="ambos">Ambos</option>
            </Select>
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Tipo</span>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="ajuste_lance">Ajuste de lance</option>
              <option value="pausa_campanha">Pausa de campanha</option>
              <option value="novo_criativo">Novo criativo</option>
              <option value="ajuste_publico">Ajuste de público</option>
              <option value="ajuste_orcamento">Ajuste de orçamento</option>
              <option value="teste_ab">Teste A/B</option>
              <option value="outro">Outro</option>
            </Select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Descrição</span>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que foi feito?"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Resultado observado (opcional)
          </span>
          <Textarea
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            placeholder="Variação de CPL, leads, etc."
          />
        </label>
      </div>
    </Modal>
  )
}
