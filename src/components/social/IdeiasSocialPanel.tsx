import { useEffect, useState } from 'react'
import {
  Plus,
  ExternalLink,
  Sparkles,
  Pencil,
  Trash2,
  Tag,
  X,
  CheckCircle2,
  Clock,
  Lightbulb,
  FlaskConical,
  Image as ImageIcon,
  Film,
  LayoutGrid,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Cliente, IdeiaSocial, StatusIdeiaSocial } from '@/types/database'

interface Props {
  cliente: Cliente
}

const statusMeta: Record<StatusIdeiaSocial, { label: string; tone: 'brand' | 'warning' | 'success' | 'neutral'; icon: React.ComponentType<{ size?: number }> }> = {
  a_testar: { label: 'A testar', tone: 'brand', icon: Lightbulb },
  em_teste: { label: 'Em teste', tone: 'warning', icon: FlaskConical },
  testado: { label: 'Testado', tone: 'success', icon: CheckCircle2 },
  descartado: { label: 'Descartado', tone: 'neutral', icon: X },
}

const formatosIcon = {
  carrossel: LayoutGrid,
  estatico: ImageIcon,
  reel: Film,
} as const

/**
 * Banco de ideias e referências por cliente — playbook 3.4
 * (Inovação & Evolução do Perfil).
 */
export function IdeiasSocialPanel({ cliente }: Props) {
  const [ideias, setIdeias] = useState<IdeiaSocial[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<StatusIdeiaSocial | 'todas'>('todas')
  const [novoOpen, setNovoOpen] = useState(false)
  const [editando, setEditando] = useState<IdeiaSocial | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cliente_ideias_social')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
    setIdeias((data as IdeiaSocial[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id])

  const filtradas = ideias.filter((i) => filtroStatus === 'todas' || i.status === filtroStatus)
  const contagem = {
    todas: ideias.length,
    a_testar: ideias.filter((i) => i.status === 'a_testar').length,
    em_teste: ideias.filter((i) => i.status === 'em_teste').length,
    testado: ideias.filter((i) => i.status === 'testado').length,
    descartado: ideias.filter((i) => i.status === 'descartado').length,
  }

  return (
    <div className="space-y-4">
      {/* Header com filtros + ação */}
      <div className="flex flex-wrap items-center gap-2">
        <FiltroChip
          ativo={filtroStatus === 'todas'}
          onClick={() => setFiltroStatus('todas')}
          label={`Todas · ${contagem.todas}`}
        />
        <FiltroChip
          ativo={filtroStatus === 'a_testar'}
          onClick={() => setFiltroStatus('a_testar')}
          label={`A testar · ${contagem.a_testar}`}
          icon={Lightbulb}
        />
        <FiltroChip
          ativo={filtroStatus === 'em_teste'}
          onClick={() => setFiltroStatus('em_teste')}
          label={`Em teste · ${contagem.em_teste}`}
          icon={FlaskConical}
        />
        <FiltroChip
          ativo={filtroStatus === 'testado'}
          onClick={() => setFiltroStatus('testado')}
          label={`Testado · ${contagem.testado}`}
          icon={CheckCircle2}
        />
        {contagem.descartado > 0 && (
          <FiltroChip
            ativo={filtroStatus === 'descartado'}
            onClick={() => setFiltroStatus('descartado')}
            label={`Descartado · ${contagem.descartado}`}
            icon={X}
          />
        )}
        <Button size="sm" onClick={() => setNovoOpen(true)} className="ml-auto">
          <Plus size={13} /> Nova ideia
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted">Carregando...</CardBody>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <Sparkles size={32} className="text-muted" />
            <p className="text-sm text-muted max-w-sm">
              {filtroStatus === 'todas'
                ? 'Nenhuma ideia cadastrada ainda. Esse banco apoia a inovação contínua do perfil — playbook 3.4.'
                : 'Nenhuma ideia nesse status.'}
            </p>
            <Button onClick={() => setNovoOpen(true)} variant="outline">
              <Plus size={13} /> Adicionar primeira ideia
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((i) => (
            <IdeiaCard
              key={i.id}
              ideia={i}
              onEdit={() => setEditando(i)}
              onChanged={load}
            />
          ))}
        </div>
      )}

      <IdeiaModal
        open={novoOpen || !!editando}
        onClose={() => {
          setNovoOpen(false)
          setEditando(null)
        }}
        ideia={editando}
        clienteId={cliente.id}
        onSaved={load}
      />
    </div>
  )
}

function FiltroChip({
  ativo,
  onClick,
  label,
  icon: Icon,
}: {
  ativo: boolean
  onClick: () => void
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
        ativo
          ? 'border-pink-500/40 bg-pink-500/15 text-pink-200'
          : 'border-border bg-bg-soft text-muted hover:text-zinc-200 hover:border-zinc-500',
      )}
    >
      {Icon && <Icon size={11} />}
      {label}
    </button>
  )
}

function IdeiaCard({
  ideia,
  onEdit,
  onChanged,
}: {
  ideia: IdeiaSocial
  onEdit: () => void
  onChanged: () => void
}) {
  const meta = statusMeta[ideia.status]
  const FormatoIcon = ideia.formato_alvo ? formatosIcon[ideia.formato_alvo] : null

  async function avancarStatus() {
    const proximo: Record<StatusIdeiaSocial, StatusIdeiaSocial> = {
      a_testar: 'em_teste',
      em_teste: 'testado',
      testado: 'a_testar',
      descartado: 'a_testar',
    }
    await supabase
      .from('cliente_ideias_social')
      .update({ status: proximo[ideia.status] })
      .eq('id', ideia.id)
    onChanged()
  }

  async function excluir() {
    if (!confirm(`Excluir a ideia "${ideia.titulo}"?`)) return
    await supabase.from('cliente_ideias_social').delete().eq('id', ideia.id)
    onChanged()
  }

  return (
    <Card className="group">
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={avancarStatus}
            className="flex-shrink-0"
            title="Clique pra avançar o status"
          >
            <Badge tone={meta.tone}>
              <meta.icon size={10} className="mr-1 inline" />
              {meta.label}
            </Badge>
          </button>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-pink-300"
              title="Editar"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={excluir}
              className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-red-300"
              title="Excluir"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-zinc-100 leading-snug">{ideia.titulo}</h3>
        {ideia.descricao && (
          <p className="text-xs text-muted leading-relaxed">{ideia.descricao}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {FormatoIcon && (
            <Badge tone="neutral" className="!text-[9px]">
              <FormatoIcon size={9} className="mr-0.5 inline" />
              {ideia.formato_alvo}
            </Badge>
          )}
          {ideia.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-0.5 rounded border border-pink-500/20 bg-pink-500/5 px-1.5 py-0.5 text-[9px] text-pink-200/80"
            >
              <Tag size={8} />
              {t}
            </span>
          ))}
        </div>

        {ideia.url && (
          <a
            href={ideia.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-pink-300 hover:underline"
          >
            ver referência <ExternalLink size={10} />
          </a>
        )}
      </CardBody>
    </Card>
  )
}

function IdeiaModal({
  open,
  onClose,
  ideia,
  clienteId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  ideia: IdeiaSocial | null
  clienteId: string
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [url, setUrl] = useState('')
  const [formatoAlvo, setFormatoAlvo] = useState<'carrossel' | 'estatico' | 'reel' | ''>('')
  const [status, setStatus] = useState<StatusIdeiaSocial>('a_testar')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && ideia) {
      setTitulo(ideia.titulo)
      setDescricao(ideia.descricao ?? '')
      setUrl(ideia.url ?? '')
      setFormatoAlvo((ideia.formato_alvo as any) ?? '')
      setStatus(ideia.status)
      setTagsInput(ideia.tags.join(', '))
    } else if (open) {
      setTitulo('')
      setDescricao('')
      setUrl('')
      setFormatoAlvo('')
      setStatus('a_testar')
      setTagsInput('')
    }
  }, [open, ideia])

  async function salvar() {
    if (!titulo.trim()) return
    setSaving(true)
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const payload = {
      cliente_id: clienteId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      url: url.trim() || null,
      formato_alvo: formatoAlvo || null,
      status,
      tags,
      criado_por: profile?.id ?? null,
    }
    if (ideia) {
      await supabase.from('cliente_ideias_social').update(payload).eq('id', ideia.id)
    } else {
      await supabase.from('cliente_ideias_social').insert(payload)
    }
    setSaving(false)
    onClose()
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ideia ? 'Editar ideia' : 'Nova ideia'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving || !titulo.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Título
          </label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: 'Carrossel comparativo antes/depois'"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Descrição
          </label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe a ideia: contexto, hipótese de resultado, referências..."
            className="min-h-[80px] text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Link de referência (opcional)
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/..."
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
              Formato alvo
            </label>
            <Select
              value={formatoAlvo}
              onChange={(e) => setFormatoAlvo(e.target.value as any)}
            >
              <option value="">Sem definir</option>
              <option value="carrossel">Carrossel</option>
              <option value="estatico">Estático</option>
              <option value="reel">Reel</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
              Status
            </label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusIdeiaSocial)}
            >
              <option value="a_testar">A testar</option>
              <option value="em_teste">Em teste</option>
              <option value="testado">Testado</option>
              <option value="descartado">Descartado</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Tags (separadas por vírgula)
          </label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="ex: educacional, gancho, trend"
          />
        </div>
      </div>
    </Modal>
  )
}
