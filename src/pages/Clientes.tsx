import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, DataTable, FilterBar, FilterPill, badgeTone, type Column, type RowTone, type Tone } from '@/components/ds'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { baixarCsv } from '@/lib/csv'
import { temAlgumCargo } from '@/lib/cargos'
import {
  cn,
  formatCurrency,
  formatDate,
  JORNADAS_CLIENTE,
  jornadaClienteLabel,
  tipoClienteLabel,
} from '@/lib/utils'
import { useSquads } from '@/hooks/useSquads'
import { useAuth } from '@/contexts/AuthContext'
import type { Cliente, Profile } from '@/types/database'

// Meses de casa inteiros — o mes em curso conta (entrou hoje = 1).
// Usado como "LT" (lifetime months) na tabela. Mesma regra da Ficha.
function mesesCasa(iso: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44))) + 1
}

export default function Clientes({ filtroOperacao }: { filtroOperacao?: 'trafego' | 'social' } = {}) {
  const { profile } = useAuth()
  // Mesma lista/tabela central de clientes. Com `filtroOperacao` vira a visão
  // de Execução: 'trafego' → só clientes com Gestor de Tráfego vinculado;
  // 'social' → só com Social Media vinculado. Sem prop = lista completa.
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
  // Qualquer usuario aprovado edita a call de alinhamento (migration 057).
  // Quem faz a call sabe melhor quando ela foi/quando remarcar.
  const podeEditarCall = !!profile
  const isAdmin = profile?.role === 'admin'
  const podeVerArquivados =
    isAdmin || temAlgumCargo(profile, ['diretoria', 'head'])
  const [escopo, setEscopo] = useState<'meus' | 'todos'>(
    !isAdmin && cargoOperacional ? 'meus' : 'todos',
  )
  // Por padrão esconde arquivados (churn). Admin pode ligar.
  const [mostrarArquivados, setMostrarArquivados] = useState(false)

  /**
   * `silent=true` = nao dispara o placeholder "Carregando..." — usa a
   * ultima leitura como fundo e substitui em background quando chega a
   * nova. Sem isso, o refresh de 60s piscava a tabela toda uma vez por
   * minuto.
   */
  async function load(silent = false) {
    if (!silent) setLoading(true)
    const [cRes, gRes] = await Promise.all([
      // Carrega TODA a base — a lista geral mostra todos os clientes.
      supabase
        .from('clientes')
        .select(
          '*, gestor:profiles!gestor_id(*), account_manager:profiles!account_manager_id(*), social_media:profiles!social_media_id(*)',
        )
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
    // Refresh a cada 60s em background — silent=true nao pisca o loading
    const id = setInterval(() => load(true), 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      // Visão de Execução: filtra pela operação (responsável vinculado).
      if (filtroOperacao === 'trafego' && !c.gestor_id) return false
      if (filtroOperacao === 'social' && !c.social_media_id) return false
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
  }, [clientes, filtroOperacao, q, fSquad, fGestor, fStatus, fJornada, escopo, profile, mostrarArquivados])

  return (
    <div>
      <PageHeader
        title={
          mostrarArquivados
            ? 'Clientes arquivados'
            : filtroOperacao === 'trafego'
              ? 'Clientes · Tráfego'
              : filtroOperacao === 'social'
                ? 'Clientes · Social Media'
                : 'Lista de Clientes'
        }
        description={
          mostrarArquivados
            ? 'Arquivados (churn)'
            : filtroOperacao === 'trafego'
              ? 'Clientes com Gestor de Tráfego vinculado'
              : filtroOperacao === 'social'
                ? 'Clientes com Social Media vinculado'
                : 'Clientes ativos na base'
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportarClientes(filtered)}
              disabled={loading || filtered.length === 0}
              title="Exporta os clientes filtrados (CSV pro Excel)"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-soft px-3 py-2 text-xs font-medium text-zinc-200 hover:border-brand-500/40 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={12} /> Exportar
            </button>
            {/* Criação só na lista completa (ponto único). Execução não cria. */}
            {!filtroOperacao && (
              <Button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus size={14} /> Novo cliente
              </Button>
            )}
          </div>
        }
      />

      {/* Escopo + filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Toggle Meus/Time como pill segmentada */}
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          {(['meus', 'todos'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setEscopo(k)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                escopo === k ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200',
              )}
            >
              {k === 'meus' ? 'Apenas meus' : 'Todo o time'}
            </button>
          ))}
        </div>
        <FilterBar className="flex-1">
          <FilterPill value={fSquad} onChange={setFSquad} placeholder="Todas as Squads" options={squadsAtivos.map((s) => ({ value: s, label: s }))} />
          <FilterPill value={fGestor} onChange={setFGestor} placeholder="Todos os Gestores" options={gestores.map((g) => ({ value: g.id, label: g.nome }))} />
          <FilterPill
            value={fStatus}
            onChange={setFStatus}
            placeholder="Todos os Status"
            options={[
              { value: 'ativo', label: 'Ativo' },
              { value: 'atencao', label: 'Atenção' },
              { value: 'pausado', label: 'Pausado' },
              { value: 'churn', label: 'Churn' },
            ]}
          />
          <FilterPill
            value={fJornada}
            onChange={setFJornada}
            placeholder="Todas as Jornadas"
            options={JORNADAS_CLIENTE.map((j) => ({ value: j, label: jornadaClienteLabel[j] }))}
          />
          {podeVerArquivados && (
            <button
              type="button"
              onClick={() => setMostrarArquivados((v) => !v)}
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors',
                mostrarArquivados
                  ? 'border-brand-500/40 bg-brand-500/10 text-brand-200'
                  : 'border-border text-muted hover:border-brand-500/40 hover:text-zinc-200',
              )}
            >
              {mostrarArquivados ? 'Voltar pra ativos' : 'Ver arquivados'}
            </button>
          )}
        </FilterBar>
      </div>

      <DataTable
        columns={colunasClientes((c) => {
          setEditing(c)
          setFormOpen(true)
        })}
        rows={loading ? [] : filtered}
        rowKey={(c) => c.id}
        rowTone={tomDoCliente}
        defaultSort={{ key: 'cliente', dir: 'asc' }}
        minWidth={1040}
        search={{ value: q, onChange: setQ, placeholder: 'Buscar cliente...' }}
        emptyLabel={loading ? 'Carregando…' : 'Nenhum cliente encontrado com esses filtros.'}
      />

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

// ============================================================
// Componentes auxiliares
// ============================================================

/**
 * Situação do cliente pro chip da coluna STATUS. Cliente em onboarding
 * ganha destaque (fase de entrada); fora disso, mapeia o status:
 * estável, atenção, pausado, churn. `tone` = tom do DS; `cls` = classes
 * prontas (mantidas pra quem monta o chip à mão, ex.: ClientesTrafego).
 */
export function situacaoCliente(c: Cliente): { label: string; cls: string; tone: Tone } {
  const s: { label: string; tone: Tone } =
    c.jornada === 'onboarding'
      ? { label: 'Onboarding', tone: 'info' }
      : ({
          ativo: { label: 'Estável', tone: 'success' },
          atencao: { label: 'Atenção', tone: 'attention' },
          pausado: { label: 'Pausado', tone: 'neutral' },
          churn: { label: 'Churn', tone: 'danger' },
        } as const)[c.status]
  return { ...s, cls: badgeTone[s.tone] }
}

const SEMAFORO: Record<NonNullable<Cliente['semaforo']>, { label: string; dot: string; ordem: number }> = {
  vermelho: { label: 'Crítico', dot: 'bg-red-500', ordem: 0 },
  laranja: { label: 'Risco', dot: 'bg-orange-500', ordem: 1 },
  amarelo: { label: 'Atenção', dot: 'bg-yellow-500', ordem: 2 },
  verde: { label: 'Estável', dot: 'bg-green-500', ordem: 3 },
}

/** CSV dos clientes na tela (respeita filtros e busca). */
function exportarClientes(lista: Cliente[]) {
  // Data LOCAL no nome (toISOString é UTC: depois das 21h viraria o dia seguinte).
  const d = new Date()
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  baixarCsv(
    `clientes-${hoje}.csv`,
    ['Cliente', 'Tipo', 'Nicho', 'Squad', 'Account Manager', 'Social Media', 'Gestor de Tráfego', 'Ticket mensal (R$)', 'LT (meses)', 'Status', 'Jornada', 'NPS', 'Semáforo', 'Início', 'Última atualização'],
    lista.map((c) => [
      c.nome,
      c.tipo ? tipoClienteLabel[c.tipo] : '',
      c.nicho,
      c.squad,
      c.account_manager?.nome,
      c.social_media?.nome,
      c.gestor?.nome,
      c.verba_mensal ?? 0,
      mesesCasa(c.data_inicio),
      situacaoCliente(c).label,
      c.jornada ? jornadaClienteLabel[c.jornada] : '',
      c.nps,
      SEMAFORO[c.semaforo ?? 'verde'].label,
      c.data_inicio?.slice(0, 10),
      c.updated_at?.slice(0, 10),
    ]),
  )
}

/** Linha tingida só pra cliente em risco (semáforo vermelho/laranja). */
function tomDoCliente(c: Cliente): RowTone | undefined {
  if (c.semaforo === 'vermelho') return 'danger'
  if (c.semaforo === 'laranja') return 'warning'
  return undefined
}

/** Avatar circular com iniciais (neutro — a cor fica pro que exige ação). */
function AvatarInicial({ nome, destaque, size = 'sm' }: { nome: string | null | undefined; destaque?: boolean; size?: 'sm' | 'xs' }) {
  if (!nome) return <span className="text-muted">—</span>
  const inic = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums',
        destaque ? 'border-brand-500/40 bg-brand-500/15 text-brand-300' : 'border-border bg-bg-elev text-zinc-300',
        size === 'xs' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]',
      )}
      title={nome}
    >
      {inic}
    </span>
  )
}

function Pessoa({ nome }: { nome: string | null | undefined }) {
  if (!nome) return <span className="text-muted">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <AvatarInicial nome={nome} size="xs" />
      <span className="text-zinc-200">{nome}</span>
    </span>
  )
}

/** Colunas da lista de clientes (DataTable do DS — ordenáveis). */
function colunasClientes(onEditar: (c: Cliente) => void): Column<Cliente>[] {
  return [
    {
      key: 'cliente',
      header: 'Cliente',
      sortValue: (c) => c.nome,
      render: (c) => (
        <div className="flex items-center gap-2">
          <AvatarInicial nome={c.nome} destaque />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link to={`/clientes/${c.id}`} className="truncate text-xs font-semibold text-zinc-100 hover:text-brand-300">
                {c.nome}
              </Link>
              {c.tipo && (
                <span className="inline-flex items-center rounded border border-border bg-bg-elev px-1.5 py-0.5 text-[9px] font-medium text-zinc-300">
                  {tipoClienteLabel[c.tipo]}
                </span>
              )}
            </div>
            {c.nicho && <p className="truncate text-[10px] text-muted">{c.nicho}</p>}
          </div>
        </div>
      ),
    },
    { key: 'squad', header: 'Squad', sortValue: (c) => c.squad, render: (c) => <span className="whitespace-nowrap text-zinc-200">{c.squad ?? '—'}</span> },
    { key: 'am', header: 'AM', sortValue: (c) => c.account_manager?.nome, render: (c) => <Pessoa nome={c.account_manager?.nome} /> },
    { key: 'social', header: 'Social Media', sortValue: (c) => c.social_media?.nome, render: (c) => <Pessoa nome={c.social_media?.nome} /> },
    {
      key: 'ticket',
      header: 'Ticket',
      align: 'right',
      sortValue: (c) => c.verba_mensal ?? 0,
      render: (c) => <span className="whitespace-nowrap font-semibold tabular-nums text-zinc-100">{formatCurrency(c.verba_mensal ?? 0)}</span>,
    },
    {
      key: 'lt',
      header: 'LT',
      align: 'right',
      sortValue: (c) => mesesCasa(c.data_inicio),
      render: (c) => <span className="tabular-nums text-zinc-200">{mesesCasa(c.data_inicio)}m</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (c) => situacaoCliente(c).label,
      render: (c) => {
        const st = situacaoCliente(c)
        // Estável é o normal → texto; as exceções ganham badge.
        return st.tone === 'success' ? <span className="text-zinc-300">{st.label}</span> : <Badge tone={st.tone}>{st.label}</Badge>
      },
    },
    {
      key: 'jornada',
      header: 'Jornada',
      sortValue: (c) => (c.jornada ? jornadaClienteLabel[c.jornada] : null),
      render: (c) => <span className="whitespace-nowrap text-zinc-200">{c.jornada ? jornadaClienteLabel[c.jornada] : '—'}</span>,
    },
    {
      key: 'nps',
      header: 'NPS',
      align: 'right',
      sortValue: (c) => c.nps,
      render: (c) =>
        typeof c.nps === 'number' ? (
          <span className={cn('font-semibold tabular-nums', c.nps >= 9 ? 'text-green-300' : c.nps >= 7 ? 'text-yellow-300' : 'text-red-300')}>
            {c.nps}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'semaforo',
      header: 'Semáforo',
      sortValue: (c) => SEMAFORO[c.semaforo ?? 'verde'].ordem,
      render: (c) => {
        const sm = SEMAFORO[c.semaforo ?? 'verde']
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-300" title={sm.label}>
            <span className={cn('h-2 w-2 rounded-full', sm.dot)} />
            {sm.label}
          </span>
        )
      },
    },
    {
      key: 'atualizacao',
      header: 'Atualizado',
      sortValue: (c) => c.updated_at,
      render: (c) => <span className="whitespace-nowrap text-[10px] tabular-nums text-muted">{formatDate(c.updated_at)}</span>,
    },
    {
      key: 'acoes',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="inline-flex gap-0.5">
          <button onClick={() => onEditar(c)} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300" title="Editar">
            <Pencil size={12} />
          </button>
          <Link to={`/clientes/${c.id}`} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bg-elev hover:text-brand-300" title="Abrir Ficha">
            <Eye size={12} />
          </Link>
        </div>
      ),
    },
  ]
}
