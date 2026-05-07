import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Eye,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
  Plus,
  Pencil,
} from 'lucide-react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { supabase } from '@/lib/supabase'
import {
  cn,
  formatDate,
  JORNADAS_CLIENTE,
  jornadaClienteLabel,
  statusClienteLabel,
  tipoClienteLabel,
} from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Cliente,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
  Profile,
} from '@/types/database'

interface ClienteSocialStats {
  cliente: Cliente
  postagensMes: number
  concluidasMes: number
  atrasadas: number
}

export default function SocialClientes() {
  const { profile } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [items, setItems] = useState<ItemSocialMedia[]>([])
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoSocialMedia[]>([])
  const [responsaveis, setResponsaveis] = useState<Profile[]>([])
  const [q, setQ] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fSocial, setFSocial] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fJornada, setFJornada] = useState('')
  const [escopo, setEscopo] = useState<'meus' | 'todos'>(
    profile?.cargo === 'social_media' ? 'meus' : 'todos',
  )
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const { nomes: squadsAtivos } = useSquads()

  async function load() {
    setLoading(true)
    const [cRes, pRes, iRes, profRes] = await Promise.all([
      supabase
        .from('clientes')
        .select(
          '*, account_manager:profiles!account_manager_id(*), social_media:profiles!social_media_id(*)',
        )
        // Mostra só clientes do módulo social_media (separado de tráfego)
        .contains('modulos', ['social_media'])
        .order('nome'),
      supabase.from('producoes_social_media').select('*'),
      supabase.from('producoes_social_media_items').select('*'),
      supabase.from('profiles').select('*').eq('ativo', true).eq('aprovado', true).order('nome'),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setPlanejamentos((pRes.data as PlanejamentoSocialMedia[]) ?? [])
    setItems((iRes.data as ItemSocialMedia[]) ?? [])
    setResponsaveis((profRes.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Stats por cliente: artes do mês corrente, concluídas e atrasadas
  const statsByCliente = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)
    const planById = new Map(planejamentos.map((p) => [p.id, p]))
    const map = new Map<string, ClienteSocialStats>()
    for (const c of clientes) map.set(c.id, { cliente: c, postagensMes: 0, concluidasMes: 0, atrasadas: 0 })

    for (const it of items) {
      const plan = planById.get(it.producao_id)
      if (!plan) continue
      const stat = map.get(plan.cliente_id)
      if (!stat) continue
      // Vencimento dentro do mês corrente
      if (it.prazo) {
        const d = new Date(it.prazo)
        if (d >= monthStart && d <= monthEnd) {
          stat.postagensMes++
          if (it.status === 'conclusao') stat.concluidasMes++
        }
      }
      // Atrasada (independente do mês)
      if (it.status !== 'conclusao' && it.prazo && it.prazo.slice(0, 10) < todayStr) {
        stat.atrasadas++
      }
    }
    return map
  }, [clientes, planejamentos, items])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q.toLowerCase())) return false
      if (fSquad && c.squad !== fSquad) return false
      if (fSocial && c.social_media_id !== fSocial) return false
      if (fStatus && c.status !== fStatus) return false
      if (fJornada && c.jornada !== fJornada) return false
      if (escopo === 'meus' && profile && c.social_media_id !== profile.id) return false
      return true
    })
  }, [clientes, q, fSquad, fSocial, fStatus, fJornada, escopo, profile])

  return (
    <div>
      <PageHeader
        title="Clientes · Social Media"
        description={`${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'} sob acompanhamento`}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus size={14} /> Novo cliente
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          {/* Toggle pessoal */}
          <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
            <button
              onClick={() => setEscopo('meus')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                escopo === 'meus'
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              Apenas meus
            </button>
            <button
              onClick={() => setEscopo('todos')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                escopo === 'todos'
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              Todo o time
            </button>
          </div>

          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={fSquad} onChange={(e) => setFSquad(e.target.value)} className="w-36">
            <option value="">Todas squads</option>
            {squadsAtivos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={fSocial} onChange={(e) => setFSocial(e.target.value)} className="w-44">
            <option value="">Todos social media</option>
            {responsaveis.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-32">
            <option value="">Todos status</option>
            <option value="ativo">Ativo</option>
            <option value="atencao">Atenção</option>
            <option value="pausado">Pausado</option>
            <option value="churn">Churn</option>
          </Select>
          <Select value={fJornada} onChange={(e) => setFJornada(e.target.value)} className="w-36">
            <option value="">Todas jornadas</option>
            {JORNADAS_CLIENTE.map((j) => (
              <option key={j} value={j}>
                {jornadaClienteLabel[j]}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      <ClienteForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        cliente={editing}
        onSaved={load}
        defaultModulo="social_media"
      />

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-soft">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Squad</th>
                  <th className="px-3 py-2.5">Account Manager</th>
                  <th className="px-3 py-2.5">Social Media</th>
                  <th className="px-3 py-2.5">Postagens do mês</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Jornada</th>
                  <th className="px-3 py-2.5">Última atualização</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const stat = statsByCliente.get(c.id)
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-bg-soft">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/clientes/${c.id}`}
                              className="text-sm font-medium text-zinc-100 hover:text-pink-300"
                            >
                              {c.nome}
                            </Link>
                            {c.tipo && (
                              <Badge tone="neutral" className="shrink-0">
                                {tipoClienteLabel[c.tipo]}
                              </Badge>
                            )}
                          </div>
                          {c.nicho && <p className="text-[11px] text-muted">{c.nicho}</p>}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">{c.squad ?? '—'}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {c.account_manager?.nome ?? '—'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {c.social_media ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={c.social_media.nome} size="sm" />
                              <span className="text-sm text-zinc-200">{c.social_media.nome}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">— sem responsável —</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <PostsCell stats={stat} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Badge tone={statusTone(c.status)}>{statusClienteLabel[c.status]}</Badge>
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {c.jornada ? jornadaClienteLabel[c.jornada] : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted whitespace-nowrap">
                          {formatDate(c.updated_at)}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => {
                                setEditing(c)
                                setFormOpen(true)
                              }}
                              className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-pink-300"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <Link
                              to={`/clientes/${c.id}`}
                              className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-pink-300"
                              title="Abrir detalhes"
                            >
                              <Eye size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function PostsCell({ stats }: { stats?: ClienteSocialStats }) {
  if (!stats || stats.postagensMes === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
        <Sparkles size={11} className="opacity-50" />
        sem produção
      </span>
    )
  }
  const pct = Math.round((stats.concluidasMes / stats.postagensMes) * 100)
  const corPct =
    pct >= 80
      ? 'text-emerald-300'
      : pct >= 50
      ? 'text-amber-300'
      : 'text-zinc-200'

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1">
        <ImageIcon size={11} className="text-pink-300/70" />
        <span className="font-semibold text-zinc-100 tabular-nums">{stats.postagensMes}</span>
      </div>
      <span className="text-muted">·</span>
      <span className={cn('inline-flex items-center gap-0.5 tabular-nums', corPct)}>
        <CheckCircle2 size={10} />
        {pct}%
      </span>
      {stats.atrasadas > 0 && (
        <>
          <span className="text-muted">·</span>
          <span className="inline-flex items-center gap-0.5 tabular-nums text-red-300">
            <AlertCircle size={10} />
            {stats.atrasadas}
          </span>
        </>
      )}
    </div>
  )
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
