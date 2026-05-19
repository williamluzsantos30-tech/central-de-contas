import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { frequenciaLabel, prioridadeLabel } from '@/lib/utils'
import type { TaskTemplate } from '@/types/database'

export default function Templates() {
  return (
    <div>
      <PageHeader
        title="Templates de tarefas"
        description="Aplicados automaticamente ao criar novos clientes"
      />
      <TemplatesTab />
    </div>
  )
}

export function TemplatesTab() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .order('frequencia')
      .order('nome')
    setTemplates((data as TaskTemplate[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleAtivo(t: TaskTemplate) {
    await supabase.from('task_templates').update({ ativo: !t.ativo }).eq('id', t.id)
    load()
  }

  async function remover(t: TaskTemplate) {
    if (!confirm(`Excluir template "${t.nome}"?`)) return
    await supabase.from('task_templates').delete().eq('id', t.id)
    load()
  }

  async function sincronizar() {
    if (
      !confirm(
        'Sincronizar templates: pra cada cliente ativo, vai CRIAR as tarefas faltantes (baseadas nos templates ativos). Não duplica trabalho em aberto. Continuar?',
      )
    )
      return
    setSyncing(true)
    const { data, error } = await supabase.rpc('sync_tarefas_faltantes')
    setSyncing(false)
    if (error) {
      alert('Erro ao sincronizar: ' + error.message)
      return
    }
    const n = Array.isArray(data) ? data.length : 0
    if (n === 0) {
      alert('Nenhuma tarefa faltando — está tudo sincronizado.')
    } else {
      // Resumo por cliente
      const porCliente: Record<string, number> = {}
      for (const row of data as { cliente_nome: string }[]) {
        porCliente[row.cliente_nome] = (porCliente[row.cliente_nome] ?? 0) + 1
      }
      const resumo = Object.entries(porCliente)
        .map(([nome, qtd]) => `• ${nome}: ${qtd} tarefa(s)`)
        .join('\n')
      alert(`${n} tarefa(s) criada(s):\n\n${resumo}`)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Templates ativos são aplicados automaticamente quando um novo cliente é cadastrado.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={sincronizar}
            disabled={syncing}
            title="Cria tarefas faltantes pra todos os clientes ativos. Útil quando alguém deletou tarefa por engano ou quando um template novo foi adicionado."
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar clientes'}
          </Button>
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus size={14} /> Novo template
          </Button>
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-bg-soft">
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">Frequência</th>
                <th className="px-4 py-2.5">Prioridade</th>
                <th className="px-4 py-2.5">Ativo</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    Carregando...
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    Nenhum template criado.
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{t.nome}</p>
                      {t.descricao && <p className="text-[11px] text-muted">{t.descricao}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="info">{frequenciaLabel[t.frequencia]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          t.prioridade === 'alta'
                            ? 'danger'
                            : t.prioridade === 'media'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {prioridadeLabel[t.prioridade]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.ativo}
                          onChange={() => toggleAtivo(t)}
                          className="h-4 w-4 accent-brand-500"
                        />
                        <span className="text-xs text-muted">{t.ativo ? 'Sim' : 'Não'}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(t)
                            setModalOpen(true)
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remover(t)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <TemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        template={editing}
        onSaved={load}
      />
    </div>
  )
}

function TemplateModal({
  open,
  onClose,
  template,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  template: TaskTemplate | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    frequencia: 'diaria',
    prioridade: 'media',
    dias_semana: [] as number[],
    dia_mes: '',
    ativo: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (template) {
      setForm({
        nome: template.nome,
        descricao: template.descricao ?? '',
        frequencia: template.frequencia,
        prioridade: template.prioridade,
        dias_semana: [...(template.dias_semana ?? [])],
        dia_mes: template.dia_mes?.toString() ?? '',
        ativo: template.ativo,
      })
    } else {
      setForm({
        nome: '',
        descricao: '',
        frequencia: 'diaria',
        prioridade: 'media',
        dias_semana: [],
        dia_mes: '',
        ativo: true,
      })
    }
  }, [open, template])

  function toggleDia(n: number) {
    setForm((f) => ({
      ...f,
      dias_semana: f.dias_semana.includes(n)
        ? f.dias_semana.filter((d) => d !== n)
        : [...f.dias_semana, n].sort((a, b) => a - b),
    }))
  }

  async function save() {
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      frequencia: form.frequencia,
      prioridade: form.prioridade,
      dias_semana: form.frequencia === 'semanal' ? form.dias_semana : [],
      dia_mes: form.dia_mes ? Number(form.dia_mes) : null,
      ativo: form.ativo,
    }
    if (template) {
      await supabase.from('task_templates').update(payload).eq('id', template.id)
      // Propaga as alterações pras tarefas pendentes (não mexe nas concluídas).
      // Nome, descrição, prioridade e frequência são herdados do template.
      // data_vencimento NÃO é alterado — é específico de cada ocorrência.
      await supabase
        .from('tarefas')
        .update({
          nome: payload.nome,
          descricao: payload.descricao,
          prioridade: payload.prioridade,
          frequencia: payload.frequencia,
        })
        .eq('template_id', template.id)
        .neq('status', 'concluida')
    } else {
      await supabase.from('task_templates').insert(payload)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? 'Editar template' : 'Novo template'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !form.nome.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <Textarea
          placeholder="Descrição"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Frequência
            </label>
            <Select value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: e.target.value })}>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="esporadica">Esporádica</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Prioridade
            </label>
            <Select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </Select>
          </div>
        </div>

        {form.frequencia === 'semanal' && (
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Dias da semana (pode selecionar múltiplos)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['Dom', 0],
                ['Seg', 1],
                ['Ter', 2],
                ['Qua', 3],
                ['Qui', 4],
                ['Sex', 5],
                ['Sáb', 6],
              ].map(([label, n]) => {
                const selected = form.dias_semana.includes(n as number)
                return (
                  <button
                    key={n as number}
                    type="button"
                    onClick={() => toggleDia(n as number)}
                    className={
                      selected
                        ? 'rounded-md border border-brand-500 bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-200'
                        : 'rounded-md border border-border bg-bg-soft px-3 py-1 text-xs text-zinc-300 hover:border-brand-500/40'
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {form.frequencia === 'mensal' && (
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Dia do mês{' '}
              {form.dia_mes && (
                <span className="ml-1 text-brand-300 normal-case">
                  · todo dia {form.dia_mes}
                  {Number(form.dia_mes) >= 29 && (
                    <span className="ml-1 text-amber-300">
                      (em meses curtos cai no último dia disponível)
                    </span>
                  )}
                </span>
              )}
            </label>
            <DiaMesGrid
              selected={form.dia_mes ? Number(form.dia_mes) : null}
              onSelect={(d) =>
                setForm((f) => ({ ...f, dia_mes: d === null ? '' : String(d) }))
              }
            />
          </div>
        )}

        {form.frequencia === 'esporadica' && (
          <p className="rounded-md border border-border bg-bg-soft px-3 py-2 text-[11px] text-muted">
            Esporádica: a tarefa é criada manualmente quando precisar — sem
            recorrência automática.
          </p>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            className="h-4 w-4 accent-brand-500"
          />
          Ativo (aplicar em novos clientes)
        </label>
      </div>
    </Modal>
  )
}

/**
 * Grid visual 1..31 pra escolher o dia do mês.
 * Clicar em um dia já selecionado o desmarca.
 */
function DiaMesGrid({
  selected,
  onSelect,
}: {
  selected: number | null
  onSelect: (d: number | null) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft p-2">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
          const isSelected = selected === d
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(isSelected ? null : d)}
              className={
                isSelected
                  ? 'aspect-square rounded-md border border-brand-500 bg-brand-500/25 text-xs font-semibold text-brand-100 shadow-[0_0_0_1px_rgba(249,115,22,0.4)]'
                  : 'aspect-square rounded-md border border-border bg-bg-elev text-xs text-zinc-300 hover:border-brand-500/40 hover:text-zinc-100'
              }
            >
              {d}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
        <span>
          {selected
            ? `Selecionado: dia ${selected}`
            : 'Clique no dia em que a tarefa deve ser criada todo mês'}
        </span>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-brand-300 hover:underline"
          >
            limpar
          </button>
        )}
      </div>
    </div>
  )
}
