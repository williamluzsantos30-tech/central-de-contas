import { useEffect, useState } from 'react'
import {
  Instagram,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Save,
  X,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { cn, JORNADAS_SOCIAL, jornadaSocialLabel, statusClienteLabel } from '@/lib/utils'
import type { Cliente, ClientePerfilSetup, ItemSocialMedia, JornadaSocial } from '@/types/database'

interface Props {
  cliente: Cliente
  perfilSetup: ClientePerfilSetup | null
  itemsDoMes: ItemSocialMedia[]
  onChanged: () => void
}

/**
 * Header reformulado pra modo Social Media. Substitui o header
 * padrão (com Verba, Plataformas, Gestor de Tráfego) por:
 *   - Status + Jornada Social inline-editável
 *   - 3 KPIs no canto: posts do mês, próximo post, % setup
 *   - Linha de info: Squad, AM, SM, @Instagram (editável)
 */
export function SocialClienteHeader({ cliente, perfilSetup, itemsDoMes, onChanged }: Props) {
  const total = itemsDoMes.length
  const concluidos = itemsDoMes.filter((i) => i.status === 'conclusao').length
  const today = new Date().toISOString().slice(0, 10)
  const atrasados = itemsDoMes.filter(
    (i) => i.status !== 'conclusao' && i.prazo && i.prazo.slice(0, 10) < today,
  ).length
  const proximoPost = itemsDoMes
    .filter((i) => i.status !== 'conclusao' && i.prazo && i.prazo.slice(0, 10) >= today)
    .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))[0]

  // Cálculo de progresso do setup do perfil (4 itens × 33% por etapa)
  const setupProgresso = perfilSetup
    ? Math.round(
        ((statusToValor(perfilSetup.foto_status) +
          statusToValor(perfilSetup.bio_status) +
          statusToValor(perfilSetup.destaques_status) +
          statusToValor(perfilSetup.contato_status)) /
          4) *
          100,
      )
    : 0

  return (
    <Card className="mb-4 overflow-hidden">
      <CardBody className="space-y-4">
        {/* Linha 1: nome + status + jornada + KPIs no canto */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={cliente.nome} size="lg" />
            <div>
              <h1 className="text-xl font-semibold text-zinc-100 leading-tight">
                {cliente.nome}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(cliente.status)}>{statusClienteLabel[cliente.status]}</Badge>
                <JornadaSocialBadge cliente={cliente} onChanged={onChanged} />
                {cliente.nicho && (
                  <span className="text-xs text-muted">· {cliente.nicho}</span>
                )}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="flex flex-wrap items-stretch gap-2">
            <KpiBox
              label="Posts do mês"
              value={`${concluidos}/${total}`}
              sub={atrasados > 0 ? `${atrasados} atrasado(s)` : 'em dia'}
              tone={atrasados > 0 ? 'danger' : 'success'}
            />
            <KpiBox
              label="Próximo post"
              value={
                proximoPost?.prazo
                  ? new Date(proximoPost.prazo).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })
                  : '—'
              }
              sub={proximoPost?.formato ?? 'sem agenda'}
              tone="brand"
            />
            <KpiBox
              label="Setup do perfil"
              value={`${setupProgresso}%`}
              sub={setupProgresso === 100 ? 'completo' : 'em revisão'}
              tone={setupProgresso === 100 ? 'success' : 'warning'}
            />
          </div>
        </div>

        {/* Linha 2: info compacta */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs md:grid-cols-4">
          <Info label="Squad" value={cliente.squad ?? '—'} />
          <Info label="Account Manager" value={cliente.account_manager?.nome ?? '—'} />
          <Info label="Social Media" value={cliente.social_media?.nome ?? '— sem responsável —'} />
          <InstagramInline cliente={cliente} onChanged={onChanged} />
        </div>
      </CardBody>
    </Card>
  )
}

function statusToValor(s: string): number {
  if (s === 'ok') return 1
  if (s === 'em_revisao') return 0.5
  return 0
}

function statusTone(status: Cliente['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ativo':
      return 'success'
    case 'atencao':
      return 'warning'
    case 'pausado':
      return 'neutral'
    case 'churn':
      return 'danger'
  }
}

function KpiBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: 'success' | 'warning' | 'danger' | 'brand'
}) {
  const colorMap = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-red-500/30 bg-red-500/10 text-red-200',
    brand: 'border-pink-500/30 bg-pink-500/10 text-pink-200',
  }
  return (
    <div className={cn('min-w-[120px] rounded-lg border px-3 py-2', colorMap[tone])}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] opacity-70">{sub}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-zinc-100">{value}</p>
    </div>
  )
}

/** Editor inline da jornada social — clica e abre dropdown */
function JornadaSocialBadge({ cliente, onChanged }: { cliente: Cliente; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState<JornadaSocial | ''>(cliente.jornada_social ?? '')
  const [saving, setSaving] = useState(false)

  async function save(novo: JornadaSocial | '') {
    setSaving(true)
    await supabase
      .from('clientes')
      .update({ jornada_social: novo || null })
      .eq('id', cliente.id)
    setSaving(false)
    setEditing(false)
    onChanged()
  }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <Select
          value={val}
          onChange={(e) => {
            const v = e.target.value as JornadaSocial | ''
            setVal(v)
            save(v)
          }}
          className="h-7 text-xs"
          disabled={saving}
        >
          <option value="">—</option>
          {JORNADAS_SOCIAL.map((j) => (
            <option key={j} value={j}>
              {jornadaSocialLabel[j]}
            </option>
          ))}
        </Select>
        <button
          onClick={() => setEditing(false)}
          className="rounded p-1 text-muted hover:text-zinc-200"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 hover:opacity-80"
      title="Clique pra editar"
    >
      {cliente.jornada_social ? (
        <Badge tone={cliente.jornada_social === 'postando' ? 'success' : 'brand'}>
          {jornadaSocialLabel[cliente.jornada_social]}
        </Badge>
      ) : (
        <Badge tone="neutral">— jornada —</Badge>
      )}
      <Pencil size={11} className="text-muted" />
    </button>
  )
}

/** Editor inline do @Instagram. Clica → input → save no blur/enter */
function InstagramInline({ cliente, onChanged }: { cliente: Cliente; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(cliente.instagram_handle ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setVal(cliente.instagram_handle ?? '')
  }, [cliente.instagram_handle])

  async function save() {
    if (val === (cliente.instagram_handle ?? '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    const handle = val.trim().replace(/^@/, '') // normaliza "@nome" -> "nome"
    await supabase
      .from('clientes')
      .update({ instagram_handle: handle || null })
      .eq('id', cliente.id)
    setSaving(false)
    setEditing(false)
    onChanged()
  }

  if (editing) {
    return (
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-muted">@ Instagram</p>
        <div className="flex items-center gap-1">
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setVal(cliente.instagram_handle ?? '')
                setEditing(false)
              }
            }}
            placeholder="dra.fernanda"
            className="h-7 text-xs"
            autoFocus
            disabled={saving}
          />
          <button
            onClick={save}
            className="rounded p-1 text-muted hover:text-pink-300"
            disabled={saving}
          >
            <Save size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted">@ Instagram</p>
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-zinc-100 hover:text-pink-300"
      >
        <Instagram size={12} />
        {cliente.instagram_handle ? (
          <a
            href={`https://instagram.com/${cliente.instagram_handle.replace(/^@/, '')}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline-offset-2 hover:underline"
          >
            @{cliente.instagram_handle.replace(/^@/, '')}
          </a>
        ) : (
          <span className="text-muted">— adicionar @ —</span>
        )}
        <Pencil size={10} className="text-muted opacity-70" />
      </button>
    </div>
  )
}
