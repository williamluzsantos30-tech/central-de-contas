import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Plus, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { TarefaItem } from '@/components/tarefas/TarefaItem'
import { TarefaDrawer } from '@/components/tarefas/TarefaDrawer'
import { NovaTarefaModal } from '@/components/tarefas/NovaTarefaModal'
import { AtivoCard } from '@/components/ativos/AtivoCard'
import { LoginsAcessosPanel } from '@/components/ativos/LoginsAcessosPanel'
import { OtimizacaoTimeline } from '@/components/otimizacoes/OtimizacaoTimeline'
import { OtimizacaoForm } from '@/components/otimizacoes/OtimizacaoForm'
import { MetasPanel } from '@/components/metas/MetasPanel'
import { ClienteIdentidade } from '@/components/clientes/ClienteIdentidade'
import { AdsPlatformPanel } from '@/components/ads/AdsPlatformPanel'
import { FunilClienteCard } from '@/components/ads/FunilClienteCard'
import { googleAdsAdapter } from '@/components/ads/googleAds'
import { metaAdsAdapter } from '@/components/ads/metaAds'
import { SocialClienteHeader } from '@/components/social/SocialClienteHeader'
import { SetupPerfilPanel } from '@/components/social/SetupPerfilPanel'
import { PainelSocial } from '@/components/social/PainelSocial'
import { PlanejamentoMensalPanel } from '@/components/social/PlanejamentoMensalPanel'
import { CalendarioSocialPanel } from '@/components/social/CalendarioSocialPanel'
import { MetricasSocialPanel } from '@/components/social/MetricasSocialPanel'
import { IdeiasSocialPanel } from '@/components/social/IdeiasSocialPanel'
import { ClienteFicha } from '@/pages/ClienteFicha'
import { usePermissoes, PERM } from '@/hooks/usePermissoes'
import { supabase } from '@/lib/supabase'
import {
  cn,
  formatCurrency,
  formatDate,
  frequenciaLabel,
  plataformaLabel,
  TIPOS_ATIVO,
} from '@/lib/utils'
import type {
  Ativo,
  Cliente,
  ClientePerfilSetup,
  FrequenciaTarefa,
  ItemSocialMedia,
  Otimizacao,
  PlanejamentoSocialMedia,
  TipoAtivo,
  Tarefa,
} from '@/types/database'

type Tab = 'visao' | 'google_ads' | 'meta_ads' | 'tarefas' | 'ativos' | 'metas' | 'log'
type SocialTab = 'painel' | 'setup' | 'planejamento' | 'calendario' | 'metricas' | 'ideias'
// Nav top-level do cliente: Ficha (comercial) + UM operacional por vez
// (Tráfego OU Social), como era nas páginas separadas. Qual operacional
// aparece é resolvido por serviço do cliente ∩ setor do usuário.
type TopView = 'ficha' | 'operacional'

const freqStyle: Record<FrequenciaTarefa, { title: string; dot: string; borderLeft: string }> = {
  diaria: {
    title: 'text-red-300',
    dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]',
    borderLeft: 'border-l-red-400/60',
  },
  semanal: {
    title: 'text-orange-300',
    dot: 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]',
    borderLeft: 'border-l-orange-400/60',
  },
  mensal: {
    title: 'text-pink-300',
    dot: 'bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.6)]',
    borderLeft: 'border-l-pink-400/60',
  },
  esporadica: {
    title: 'text-zinc-300',
    dot: 'bg-zinc-500',
    borderLeft: 'border-l-zinc-600/60',
  },
}

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // ?aba=operacional-social | operacional-trafego — vindo das listas de
  // Execução (Social Media / Tráfego): abre direto no operacional certo.
  const abaParam = searchParams.get('aba')
  // Qual operacional abrir primeiro quando a página carrega. Só afeta o
  // estado inicial — depois o usuário troca de aba livremente. Links de
  // /social/clientes/:id (ou ?aba=operacional-social) abrem no social.
  const prefereSocial = location.pathname.startsWith('/social/') || abaParam === 'operacional-social'
  // Permissões do usuário logado — decidem quais operacionais ele vê na ficha.
  const { permissoes: minhasPermissoes, bypass: adminBypass } = usePermissoes()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [otimizacoes, setOtimizacoes] = useState<Otimizacao[]>([])
  const [comentariosCount, setComentariosCount] = useState<Map<string, number>>(new Map())
  const [tab, setTab] = useState<Tab>('visao')
  const [socialTab, setSocialTab] = useState<SocialTab>('painel')
  // Vindo de um contexto operacional (?aba=…), abre já na aba Operacional;
  // senão mantém o padrão "Ficha".
  const [topView, setTopView] = useState<TopView>(
    abaParam === 'operacional-social' || abaParam === 'operacional-trafego' ? 'operacional' : 'ficha',
  )
  const [editOpen, setEditOpen] = useState(false)
  const [novaFreq, setNovaFreq] = useState<FrequenciaTarefa | null>(null)
  const [drawerTarefa, setDrawerTarefa] = useState<Tarefa | null>(null)
  const [novaOtimOpen, setNovaOtimOpen] = useState(false)
  const [filtroPlatform, setFiltroPlatform] = useState('')
  const [restaurandoTarefas, setRestaurandoTarefas] = useState(false)

  // Dados específicos de Social Media
  const [perfilSetup, setPerfilSetup] = useState<ClientePerfilSetup | null>(null)
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoSocialMedia[]>([])
  const [itemsSocial, setItemsSocial] = useState<ItemSocialMedia[]>([])

  async function load() {
    if (!id) return
    const [cRes, tRes, aRes, oRes, ccRes, psRes, plRes] = await Promise.all([
      supabase
        .from('clientes')
        .select(
          '*, gestor:profiles!gestor_id(*), account_manager:profiles!account_manager_id(*), social_media:profiles!social_media_id(*)',
        )
        .eq('id', id)
        .single(),
      supabase
        .from('tarefas')
        .select('*, responsavel:profiles(*), template:task_templates(*)')
        .eq('cliente_id', id)
        .order('data_vencimento', { ascending: true }),
      supabase.from('ativos').select('*').eq('cliente_id', id),
      supabase
        .from('otimizacoes')
        .select('*, responsavel:profiles(*)')
        .eq('cliente_id', id)
        .order('data_otimizacao', { ascending: false }),
      supabase.from('tarefa_comentarios').select('tarefa_id'),
      supabase.from('cliente_perfil_setup').select('*').eq('cliente_id', id).maybeSingle(),
      supabase.from('producoes_social_media').select('*').eq('cliente_id', id),
    ])
    const cli = cRes.data as Cliente
    setCliente(cli)
    setTarefas((tRes.data as Tarefa[]) ?? [])
    setAtivos((aRes.data as Ativo[]) ?? [])
    setOtimizacoes((oRes.data as Otimizacao[]) ?? [])
    const map = new Map<string, number>()
    for (const row of (ccRes.data as { tarefa_id: string }[]) ?? []) {
      map.set(row.tarefa_id, (map.get(row.tarefa_id) ?? 0) + 1)
    }
    setComentariosCount(map)
    setPerfilSetup((psRes.data as ClientePerfilSetup | null) ?? null)
    const plans = (plRes.data as PlanejamentoSocialMedia[]) ?? []
    setPlanejamentos(plans)

    // Carrega items das produções desse cliente
    if (plans.length > 0) {
      const planIds = plans.map((p) => p.id)
      const itRes = await supabase
        .from('producoes_social_media_items')
        .select('*')
        .in('producao_id', planIds)
      setItemsSocial((itRes.data as ItemSocialMedia[]) ?? [])
    } else {
      setItemsSocial([])
    }

    // Modo é definido pela URL (modoUrl) — não muda aqui.
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function restaurarTarefasPadrao() {
    if (!id) return
    if (
      !confirm(
        'Restaurar tarefas padrão: vai criar as tarefas dos templates ativos que estão faltando pra esse cliente. Não duplica tarefas em aberto. Continuar?',
      )
    )
      return
    setRestaurandoTarefas(true)
    const { data, error } = await supabase.rpc('sync_tarefas_faltantes', {
      p_cliente_id: id,
    })
    setRestaurandoTarefas(false)
    if (error) {
      alert('Erro ao restaurar: ' + error.message)
      return
    }
    const n = Array.isArray(data) ? data.length : 0
    if (n === 0) {
      alert('Nenhuma tarefa faltando — as tarefas padrão desse cliente já estão todas em aberto.')
    } else {
      alert(`${n} tarefa(s) restaurada(s) a partir dos templates.`)
      await load()
    }
  }

  const grouped = useMemo(() => {
    const groups: Record<FrequenciaTarefa, Tarefa[]> = {
      diaria: [],
      semanal: [],
      mensal: [],
      esporadica: [],
    }
    // Esconde concluídas (recorrentes já avançam automaticamente)
    for (const t of tarefas) {
      if (t.status !== 'concluida') groups[t.frequencia].push(t)
    }
    return groups
  }, [tarefas])

  const ativosByTipo = useMemo(() => {
    const map = new Map<TipoAtivo, Ativo>()
    for (const a of ativos) map.set(a.tipo, a)
    return map
  }, [ativos])

  const otimizacoesFiltradas = useMemo(
    () => otimizacoes.filter((o) => !filtroPlatform || o.plataforma === filtroPlatform),
    [otimizacoes, filtroPlatform],
  )

  if (!cliente) {
    return <div className="text-muted">Carregando...</div>
  }


  const pendentes = tarefas.filter((t) => t.status !== 'concluida').length
  const atrasadas = tarefas.filter(
    (t) =>
      t.status !== 'concluida' &&
      t.data_vencimento &&
      new Date(t.data_vencimento) < new Date(new Date().toISOString().slice(0, 10)),
  ).length
  const ativosOk = ativos.filter((a) => a.status === 'funcional').length
  const ativosProblema = ativos.filter((a) => a.status === 'com_problema').length

  // Abas operacionais na ficha = (cliente vinculado à operação por um
  // RESPONSÁVEL) E (usuário pertence ao setor via papel).
  //   1) Vínculo: gestor_id preenchido → tráfego; social_media_id → social.
  //   2) Setor do usuário: se o papel carrega acessos operacionais, ele manda;
  //      senão (papel não configurado / sem papel) cai no fallback = mostra
  //      pelo vínculo. Admin vê tudo. Setor de Design (papel só com
  //      "Operacional Webdesign") nunca casa Tráfego/Social → só Ficha.
  const clienteTemTrafego = !!cliente.gestor_id
  const clienteTemSocial = !!cliente.social_media_id

  const SETOR_PERMS = [PERM.opTrafego, PERM.opWebdesign, PERM.opSocial]
  const papelDefineSetor = SETOR_PERMS.some((p) => minhasPermissoes.includes(p))
  const usuarioNoSetor = (perm: string) =>
    adminBypass || !papelDefineSetor || minhasPermissoes.includes(perm)

  const podeTrafego = clienteTemTrafego && usuarioNoSetor(PERM.opTrafego)
  const podeSocial = clienteTemSocial && usuarioNoSetor(PERM.opSocial)
  // UM operacional por vez. Se os dois se aplicam (ex.: admin em cliente com
  // tráfego + social), o contexto da URL decide (/social/clientes/:id → social).
  const modoOperacional: 'trafego' | 'social' | null =
    podeTrafego && podeSocial
      ? prefereSocial
        ? 'social'
        : 'trafego'
      : podeTrafego
        ? 'trafego'
        : podeSocial
          ? 'social'
          : null

  const mostrarOperacional = topView === 'operacional' && modoOperacional !== null
  const opTrafegoAtivo = mostrarOperacional && modoOperacional === 'trafego'
  const opSocialAtivo = mostrarOperacional && modoOperacional === 'social'

  return (
    <div>
      <Link
        to="/clientes"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-zinc-200"
      >
        <ChevronLeft size={14} /> voltar aos clientes
      </Link>

      {/* Tab bar de topo: Ficha (comercial) + UM operacional por vez
          (Tráfego OU Social, conforme o serviço do cliente e o setor do
          usuário). */}
      <div className="mb-6 inline-flex rounded-lg border border-border bg-bg-soft p-1">
        <button
          onClick={() => setTopView('ficha')}
          className={cn(
            'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
            !mostrarOperacional
              ? 'bg-bg-elev text-brand-300 shadow-sm'
              : 'text-muted hover:text-zinc-200',
          )}
        >
          📇 Ficha
        </button>
        {modoOperacional && (
          <button
            onClick={() => setTopView('operacional')}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
              mostrarOperacional
                ? modoOperacional === 'social'
                  ? 'bg-bg-elev text-pink-300 shadow-sm'
                  : 'bg-bg-elev text-brand-300 shadow-sm'
                : 'text-muted hover:text-zinc-200',
            )}
          >
            {modoOperacional === 'social' ? '📱 Operacional Social' : '📊 Operacional Tráfego'}
          </button>
        )}
      </div>

      {/* Ficha view — visao comercial padrao */}
      {!mostrarOperacional && (
        <ClienteFicha
          cliente={cliente}
          onChanged={load}
          onEdit={() => setEditOpen(true)}
        />
      )}

      {/* Modo Tráfego: header + tabs originais */}
      {opTrafegoAtivo && (
        <>
          <ClienteHeader cliente={cliente} onChanged={load} onEdit={() => setEditOpen(true)} />
          <div className="mb-6 flex gap-1 border-b border-border">
            {([
              ['visao', 'Visão geral'],
              ['google_ads', 'Google Ads'],
              ['meta_ads', 'Meta Ads'],
              ['tarefas', 'Tarefas'],
              ['ativos', 'Ativos'],
              ['metas', 'Metas'],
              ['log', 'Log de otimização'],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'relative px-4 py-2 text-sm -mb-px border-b-2 transition-all duration-200',
                  tab === key
                    ? 'border-brand-500 text-brand-200 drop-shadow-[0_0_4px_rgba(124, 58, 237,0.4)]'
                    : 'border-transparent text-muted hover:text-zinc-200 hover:border-brand-500/30',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Modo Social Media: header SM + tabs SM */}
      {opSocialAtivo && (
        <>
          <SocialClienteHeader
            cliente={cliente}
            perfilSetup={perfilSetup}
            itemsDoMes={itemsSocial.filter((i) => {
              if (!i.prazo) return false
              const m = new Date().toISOString().slice(0, 7)
              return i.prazo.slice(0, 7) === m
            })}
            onChanged={load}
          />
          <div className="mb-6 flex gap-1 border-b border-border overflow-x-auto">
            {([
              ['painel', 'Painel'],
              ['setup', 'Setup do perfil'],
              ['planejamento', 'Planejamento mensal'],
              ['calendario', 'Calendário'],
              ['metricas', 'Métricas'],
              ['ideias', 'Ideias e referências'],
            ] as [SocialTab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSocialTab(key)}
                className={cn(
                  'relative whitespace-nowrap px-4 py-2 text-sm -mb-px border-b-2 transition-all duration-200',
                  socialTab === key
                    ? 'border-pink-500 text-pink-200 drop-shadow-[0_0_4px_rgba(236,72,153,0.4)]'
                    : 'border-transparent text-muted hover:text-zinc-200 hover:border-pink-500/30',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {socialTab === 'painel' && (
            <PainelSocial
              cliente={cliente}
              setup={perfilSetup}
              items={itemsSocial}
              planejamentos={planejamentos}
            />
          )}

          {socialTab === 'setup' && (
            <SetupPerfilPanel cliente={cliente} setup={perfilSetup} onChanged={load} />
          )}

          {socialTab === 'planejamento' && (
            <PlanejamentoMensalPanel
              cliente={cliente}
              planejamentos={planejamentos}
              items={itemsSocial}
              onChanged={load}
            />
          )}

          {socialTab === 'calendario' && (
            <CalendarioSocialPanel
              cliente={cliente}
              items={itemsSocial}
              planejamentos={planejamentos}
              onChanged={load}
            />
          )}

          {socialTab === 'metricas' && (
            <MetricasSocialPanel cliente={cliente} items={itemsSocial} />
          )}

          {socialTab === 'ideias' && <IdeiasSocialPanel cliente={cliente} />}
        </>
      )}

      {/* Plataformas de anúncio — mesma UI, muda só o adapter. */}
      {opTrafegoAtivo && tab === 'google_ads' && (
        <AdsPlatformPanel adapter={googleAdsAdapter} clienteId={cliente.id} nomeCliente={cliente.nome} />
      )}
      {opTrafegoAtivo && tab === 'meta_ads' && (
        <AdsPlatformPanel adapter={metaAdsAdapter} clienteId={cliente.id} nomeCliente={cliente.nome} />
      )}

      {opTrafegoAtivo && tab === 'visao' && (
        <div className="space-y-4">
          <FunilClienteCard clienteId={cliente.id} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Tarefas</CardTitle>
              </CardHeader>
            <CardBody className="space-y-1 text-sm">
              <Row label="Pendentes" value={pendentes} />
              <Row label="Atrasadas" value={atrasadas} tone={atrasadas > 0 ? 'danger' : undefined} />
              <Row label="Total" value={tarefas.length} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ativos</CardTitle>
            </CardHeader>
            <CardBody className="space-y-1 text-sm">
              <Row label="Funcionais" value={`${ativosOk}/5`} tone="success" />
              <Row
                label="Com problema"
                value={ativosProblema}
                tone={ativosProblema > 0 ? 'danger' : undefined}
              />
              <Row
                label="Pendentes"
                value={ativos.filter((a) => a.status === 'pendente').length}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Últimas otimizações</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {otimizacoes.slice(0, 3).map((o) => (
                <div key={o.id} className="rounded-md border border-border bg-bg-soft p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge tone="brand">{o.tipo}</Badge>
                    <span className="text-muted">{formatDate(o.data_otimizacao)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2">{o.descricao}</p>
                </div>
              ))}
              {otimizacoes.length === 0 && (
                <p className="text-muted text-xs">Nenhuma otimização registrada.</p>
              )}
            </CardBody>
          </Card>
          </div>
        </div>
      )}

      {opTrafegoAtivo && tab === 'tarefas' && (
        <div className="space-y-5">
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={restaurarTarefasPadrao}
              disabled={restaurandoTarefas}
              title="Cria as tarefas dos templates que estão faltando pra esse cliente. Não duplica tarefas em aberto."
            >
              <RefreshCw size={12} className={restaurandoTarefas ? 'animate-spin' : ''} />
              {restaurandoTarefas ? 'Restaurando...' : 'Restaurar padrões'}
            </Button>
          </div>
          {(['diaria', 'semanal', 'mensal', 'esporadica'] as FrequenciaTarefa[]).map((freq) => {
            const style = freqStyle[freq]
            return (
              <Card key={freq} className={cn('border-l-2', style.borderLeft)}>
                <CardHeader>
                  <CardTitle className={style.title}>
                    <span
                      aria-hidden
                      className={cn('mr-2 inline-block h-2 w-2 rounded-full align-middle', style.dot)}
                    />
                    {frequenciaLabel[freq]}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setNovaFreq(freq)}>
                    <Plus size={12} /> Nova
                  </Button>
                </CardHeader>
                <CardBody className="space-y-2">
                  {grouped[freq].length === 0 ? (
                    <p className="text-xs text-muted">Sem tarefas nessa frequência.</p>
                  ) : (
                    grouped[freq].map((t) => (
                      <TarefaItem
                        key={t.id}
                        tarefa={t}
                        onChange={load}
                        onOpen={setDrawerTarefa}
                        comentariosCount={comentariosCount.get(t.id)}
                      />
                    ))
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {opTrafegoAtivo && tab === 'ativos' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TIPOS_ATIVO.map((tipo) => {
            const a = ativosByTipo.get(tipo)
            if (!a) return null
            return <AtivoCard key={a.id} ativo={a} onSaved={load} />
          })}
          <LoginsAcessosPanel clienteId={cliente.id} />
        </div>
      )}

      {opTrafegoAtivo && tab === 'metas' && (
        <MetasPanel clienteId={cliente.id} cliente={cliente} />
      )}

      {opTrafegoAtivo && tab === 'log' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Select
              value={filtroPlatform}
              onChange={(e) => setFiltroPlatform(e.target.value)}
              className="w-44"
            >
              <option value="">Todas plataformas</option>
              <option value="google_ads">Google Ads</option>
              <option value="meta_ads">Meta Ads</option>
              <option value="ambos">Ambos</option>
            </Select>
            <Button onClick={() => setNovaOtimOpen(true)}>
              <Plus size={14} /> Nova otimização
            </Button>
          </div>
          <OtimizacaoTimeline otimizacoes={otimizacoesFiltradas} />
        </div>
      )}

      <ClienteForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        cliente={cliente}
        onSaved={load}
      />
      <NovaTarefaModal
        open={!!novaFreq}
        onClose={() => setNovaFreq(null)}
        clienteId={cliente.id}
        frequencia={novaFreq ?? 'diaria'}
        onCreated={load}
      />
      <TarefaDrawer
        open={!!drawerTarefa}
        onClose={() => setDrawerTarefa(null)}
        tarefa={drawerTarefa}
        onChanged={load}
      />
      <OtimizacaoForm
        open={novaOtimOpen}
        onClose={() => setNovaOtimOpen(false)}
        clienteId={cliente.id}
        onCreated={load}
      />
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'success' | 'danger'
}) {
  const color = tone === 'danger' ? 'text-red-400' : tone === 'success' ? 'text-emerald-400' : ''
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <span className={cn('font-semibold', color)}>{value}</span>
    </div>
  )
}

/* =========================================================
   Novo header do cliente — layout "dashboard"
   ========================================================= */

function ClienteHeader({
  cliente,
  onChanged,
  onEdit,
}: {
  cliente: Cliente
  onChanged: () => void
  onEdit: () => void
}) {
  async function updateField(field: string, val: string | number | null) {
    await supabase.from('clientes').update({ [field]: val }).eq('id', cliente.id)
    onChanged()
  }

  return (
    <Card className="mb-5">
      <CardBody>
        {/* Topo compartilhado com a Ficha (nome, status, badges editáveis). */}
        <ClienteIdentidade
          cliente={cliente}
          onChanged={onChanged}
          onEdit={onEdit}
          direita={
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Verba Mensal
              </p>
              <p className="mt-0.5 text-3xl font-semibold text-emerald-300">
                {formatCurrency(
                  (cliente.verba_google ?? 0) + (cliente.verba_meta ?? 0) || cliente.verba_mensal,
                )}
              </p>
              <div className="mt-1 flex items-center justify-end gap-3 text-[11px] text-muted">
                <InlineVerba
                  label="Google"
                  value={cliente.verba_google}
                  onChange={(v) => updateField('verba_google', v)}
                />
                <span className="text-zinc-700">·</span>
                <InlineVerba
                  label="Meta"
                  value={cliente.verba_meta}
                  onChange={(v) => updateField('verba_meta', v)}
                />
              </div>
            </div>
          }
        />

        {/* Grid de info */}
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border pt-6 md:grid-cols-4">
          <InfoField label="Squad" value={cliente.squad ?? '—'} />
          <InfoField label="Account Manager" value={cliente.account_manager?.nome ?? '—'} />
          <InfoField label="Gestor de Tráfego" value={cliente.gestor?.nome ?? '—'} />
          <InfoField label="Data de Entrada" value={formatDate(cliente.data_inicio)} />
          <InfoField
            label="Plataformas"
            value={cliente.plataformas ? plataformaLabel[cliente.plataformas] : '—'}
          />
          <InfoField
            label="Fonte CRM"
            value={cliente.fonte_crm === 'kommo' ? 'Kommo' : 'Nativo'}
          />
          <InfoField label="Última atualização" value={formatDate(cliente.updated_at)} />
        </div>
      </CardBody>
    </Card>
  )
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-sm text-zinc-100">{value}</p>
    </div>
  )
}

function InlineVerba({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(value?.toString() ?? '')

  useEffect(() => {
    setInput(value?.toString() ?? '')
  }, [value])

  async function commit() {
    const val = input.trim() === '' ? null : Number(input)
    if (val === value) {
      setEditing(false)
      return
    }
    await onChange(val)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <span className="text-muted">{label}</span>
        <input
          type="number"
          step="0.01"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setInput(value?.toString() ?? '')
              setEditing(false)
            }
          }}
          className="h-6 w-24 rounded-md border border-brand-500 bg-bg-soft px-1.5 text-right text-[11px] text-zinc-100 focus:outline-none"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-bg-elev"
      title={`Editar verba ${label}`}
    >
      <span>{label}</span>
      <span className="font-medium text-emerald-300">
        {value !== null && value !== undefined ? formatCurrency(value) : '—'}
      </span>
      <Pencil size={9} className="opacity-50" />
    </button>
  )
}
