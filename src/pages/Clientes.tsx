import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { supabase } from '@/lib/supabase'
import { temAlgumCargo } from '@/lib/cargos'
import {
  cn,
  formatCurrency,
  formatDate,
  JORNADAS_CLIENTE,
  jornadaClienteLabel,
  statusClienteLabel,
  tipoClienteLabel,
} from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { useAuth } from '@/contexts/AuthContext'
import type { Cliente, Profile } from '@/types/database'

export default function Clientes() {
  const { profile } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [gestores, setGestores] = useState<Profile[]>([])
  const { nomes: squadsAtivos } = useSquads()
  const [q, setQ] = useState('')
  const [fSquad, setFSquad] = useState('')
  const [fGestor, setFGestor] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fJornada, setFJornada] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)

  // Cargos operacionais começam vendo só "os meus". Diretoria/head/admin veem todos.
  const cargoOperacional = temAlgumCargo(profile, ['gestor_trafego', 'account_manager'])
  const isAdmin = profile?.role === 'admin'
  const podeVerArquivados =
    isAdmin || temAlgumCargo(profile, ['diretoria', 'head'])
  const [escopo, setEscopo] = useState<'meus' | 'todos'>(
    !isAdmin && cargoOperacional ? 'meus' : 'todos',
  )
  // Por padrão esconde arquivados (churn). Admin pode ligar.
  const [mostrarArquivados, setMostrarArquivados] = useState(false)

  async function load() {
    setLoading(true)
    const [cRes, gRes] = await Promise.all([
      supabase
        .from('clientes')
        .select(
          '*, gestor:profiles!gestor_id(*), account_manager:profiles!account_manager_id(*), social_media:profiles!social_media_id(*)',
        )
        // Tráfego mostra só os clientes do módulo trafego (legados sem modulos
        // ainda assim aparecem porque a migration faz backfill com {trafego})
        .contains('modulos', ['trafego'])
        .order('nome'),
      // Filtro "Todos gestores" só lista cargo gestor_trafego
      supabase
        .from('profiles')
        .select('*')
        .eq('ativo', true)
        .eq('aprovado', true)
        .eq('cargo', 'gestor_trafego')
        .order('nome'),
    ])
    setClientes((cRes.data as Cliente[]) ?? [])
    setGestores((gRes.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      // Arquivados (churn) ficam ocultos por padrão. Toggle mostra apenas eles.
      const eArquivado = !!c.arquivado_em
      if (mostrarArquivados && !eArquivado) return false
      if (!mostrarArquivados && eArquivado) return false
      if (q && !c.nome.toLowerCase().includes(q.toLowerCase())) return false
      if (fSquad && c.squad !== fSquad) return false
      if (fGestor && c.gestor_id !== fGestor) return false
      if (fStatus && c.status !== fStatus) return false
      if (fJornada && c.jornada !== fJornada) return false
      // Apenas meus = sou gestor de tráfego OU account manager OU social media do cliente
      if (escopo === 'meus' && profile) {
        const eMeu =
          c.gestor_id === profile.id ||
          c.account_manager_id === profile.id ||
          c.social_media_id === profile.id
        if (!eMeu) return false
      }
      return true
    })
  }, [clientes, q, fSquad, fGestor, fStatus, fJornada, escopo, profile, mostrarArquivados])

  return (
    <div>
      <PageHeader
        title={mostrarArquivados ? 'Clientes arquivados' : 'Clientes'}
        description={`${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'}${
          mostrarArquivados
            ? ' arquivados (churn)'
            : escopo === 'meus'
            ? ' atribuídos a você'
            : ' cadastrados'
        }`}
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
          {/* Toggle Apenas meus / Todo o time */}
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
          <Select value={fGestor} onChange={(e) => setFGestor(e.target.value)} className="w-44">
            <option value="">Todos gestores</option>
            {gestores.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-36">
            <option value="">Todos status</option>
            <option value="ativo">Ativo</option>
            <option value="atencao">Atenção</option>
            <option value="pausado">Pausado</option>
            <option value="churn">Churn</option>
          </Select>
          <Select value={fJornada} onChange={(e) => setFJornada(e.target.value)} className="w-40">
            <option value="">Todas jornadas</option>
            {JORNADAS_CLIENTE.map((j) => (
              <option key={j} value={j}>
                {jornadaClienteLabel[j]}
              </option>
            ))}
          </Select>
          {podeVerArquivados && (
            <button
              type="button"
              onClick={() => setMostrarArquivados((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors',
                mostrarArquivados
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                  : 'border-border bg-bg-soft text-muted hover:border-amber-500/40 hover:text-amber-200',
              )}
              title="Mostrar apenas clientes arquivados (churn)"
            >
              {mostrarArquivados ? '↻ Voltar pra ativos' : '📁 Ver arquivados'}
            </button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-soft">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Squad</th>
                  <th className="px-3 py-2.5">Account Manager</th>
                  <th className="px-3 py-2.5">Gestor de Tráfego</th>
                  <th className="px-3 py-2.5">Verba</th>
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
                  filtered.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-bg-soft">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/clientes/${c.id}`}
                            className="text-sm font-medium text-zinc-100 hover:text-brand-300"
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
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {c.gestor?.nome ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-emerald-300 whitespace-nowrap">
                        {formatCurrency(
                          (c.verba_google ?? 0) + (c.verba_meta ?? 0) || c.verba_mensal,
                        )}
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
                            className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-brand-300"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <Link
                            to={`/clientes/${c.id}`}
                            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300"
                            title="Abrir detalhes"
                          >
                            <Eye size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
      />
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
