/**
 * Painel do Head · Social Media — Kanban de follow-ups
 * -----------------------------------------------------
 * Reformulado pra dar ACAO ao head, nao so listar.
 *
 * Cada pendencia (item pra aprovar, publicar, call vencida, setup
 * incompleto) vira um card num kanban por status de follow-up:
 *
 *   NAO COBRADO   -> pendencia detectada, nada feito ainda
 *   AGUARDANDO    -> cobrei, esperando cliente
 *   AGENDADO      -> retorno marcado pra data X
 *   ESCALADO      -> cliente sumiu, precisa outra abordagem
 *
 * Ate a pessoa clicar "Cobrar" ou "Escalar" pela primeira vez, o card
 * fica em NAO COBRADO (sem row no banco). Ao primeiro click, cria-se
 * a row social_followup e o card se move de lane.
 *
 * Acoes inline em cada card:
 *   - "Cobrar via WhatsApp"  -> abre wa.me + registra tentativa
 *   - "Marquei cobrado"       -> registra sem abrir link
 *   - "Agendar retorno"       -> escolhe data e joga em AGENDADO
 *   - "Escalar"               -> joga em ESCALADO
 *   - "Resolvido"             -> tira do kanban
 *
 * Fonte de dados dos cards: derivado dos items/clientes (nao_cobrado)
 * + rows do social_followup (aguardando/agendado/escalado/resolvido).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Clock,
  Send,
  Calendar as CalendarIcon,
  PhoneCall,
  Sparkles,
  MessageCircle,
  Check,
  ArrowRight,
  X,
  RotateCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { formatDateBR } from '@/lib/dates'
import type {
  Cliente,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
  Profile,
  ClientePerfilSetup,
} from '@/types/database'

/* ============================================================
   Tipos
   ============================================================ */

type TipoFollowup = 'aprovacao' | 'publicacao' | 'call' | 'setup' | 'geral'
type StatusFollowup =
  | 'nao_cobrado'
  | 'aguardando'
  | 'agendado'
  | 'escalado'
  | 'resolvido'

interface SocialFollowup {
  id: string
  cliente_id: string
  tipo: TipoFollowup
  ref_id: string | null
  status: StatusFollowup
  ultima_cobranca_em: string | null
  proximo_followup: string | null
  tentativas: number
  canal: string | null
  observacao: string | null
  autor_ultima_id: string | null
  created_at: string
  updated_at: string
}

interface ClienteLite {
  id: string
  nome: string
  status: string
  /** Link do grupo WhatsApp do cliente. Usado pelo botao "WhatsApp"
   *  do card. Se null, botao fica desabilitado. */
  link_grupo: string | null
  social_media_id: string | null
  proxima_call_alinhamento: string | null
  ultima_call_alinhamento: string | null
}

interface Pendencia {
  chave: string // cliente_id + tipo + ref_id
  cliente: ClienteLite
  tipo: TipoFollowup
  refId: string | null
  titulo: string // display
  subtitulo?: string
  contexto?: string // ex.: "3d parada em em_aprovacao"
  urgencia: number // usada pra ordenar dentro da lane
  followup?: SocialFollowup // se ja existe row no banco
}

/* ============================================================
   Utilitarios
   ============================================================ */

const TIPO_LABEL: Record<TipoFollowup, string> = {
  aprovacao: 'Aprovação',
  publicacao: 'Publicação',
  call: 'Call de alinhamento',
  setup: 'Setup do perfil',
  geral: 'Geral',
}

const TIPO_TONE: Record<TipoFollowup, 'brand' | 'warning' | 'danger' | 'neutral' | 'success'> = {
  aprovacao: 'warning',
  publicacao: 'brand',
  call: 'danger',
  setup: 'neutral',
  geral: 'neutral',
}

function chave(cliente_id: string, tipo: TipoFollowup, ref_id: string | null): string {
  return `${cliente_id}__${tipo}__${ref_id ?? ''}`
}

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24))
}

function diasAte(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null
  const target = new Date(dateISO + 'T12:00:00').getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((target - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Resolve o link pra abrir uma conversa/grupo do cliente.
 *   - Se `link_grupo` ja e' uma URL (chat.whatsapp.com, wa.me, http)
 *     abre direto.
 *   - Se e' um numero de telefone (so digitos), monta wa.me/<tel>?text=...
 *   - Senao retorna '#' e o botao fica desabilitado.
 * A mensagem eh usada so quando montamos o wa.me — em link de grupo
 * o WA nao aceita texto pre-preenchido.
 */
function whatsappUrl(linkGrupo: string | null, mensagem: string): string {
  if (!linkGrupo) return '#'
  const trimmed = linkGrupo.trim()
  // Ja e' URL — abre direto (grupo do WhatsApp, wa.me pronto, etc)
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // Numero puro — normaliza e monta wa.me
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 0) return '#'
  const numero = digits.length >= 12 ? digits : `55${digits}`
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

/* ============================================================
   Componente principal
   ============================================================ */

export default function HeadSocial() {
  const { profile } = useAuth()
  const [clientes, setClientes] = useState<ClienteLite[]>([])
  const [items, setItems] = useState<
    Array<ItemSocialMedia & { cliente_id: string }>
  >([])
  const [setups, setSetups] = useState<Map<string, ClientePerfilSetup>>(new Map())
  const [followups, setFollowups] = useState<SocialFollowup[]>([])
  const [socialMedias, setSocialMedias] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroSM, setFiltroSM] = useState<string>('')
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false)

  /**
   * Auto-resolve followups quando a operacao ja resolveu por outra via.
   * Roda depois do fetch inicial. Compara: cada followup ativo (status !=
   * resolvido) contra a lista atual de chaves de pendencia. Se a chave
   * do followup nao aparece mais, a pendencia foi sanada — marca como
   * resolvido com observacao "auto-resolvido".
   *
   * Ex.: head cobrou aprovacao -> cliente aprovou -> item saiu de
   * em_aprovacao -> pendencia some -> followup fica preso. Com esta
   * funcao, o followup vira resolvido sozinho na proxima carga.
   */
  async function autoResolverPendenciasSanadas(
    followupsAtivos: SocialFollowup[],
    pendenciasChaves: Set<string>,
  ) {
    const orphans = followupsAtivos.filter(
      (f) =>
        f.status !== 'resolvido' &&
        !pendenciasChaves.has(chave(f.cliente_id, f.tipo, f.ref_id)),
    )
    if (orphans.length === 0) return
    await supabase
      .from('social_followup')
      .update({
        status: 'resolvido',
        observacao: 'Resolvido automaticamente (operação já sanou a pendência)',
      })
      .in(
        'id',
        orphans.map((o) => o.id),
      )
  }

  async function load() {
    setLoading(true)
    const [cRes, pRes, iRes, sRes, smRes, fRes] = await Promise.all([
      supabase
        .from('clientes')
        .select(
          'id, nome, status, link_grupo, social_media_id, proxima_call_alinhamento, ultima_call_alinhamento',
        )
        .contains('modulos', ['social_media'])
        .in('status', ['ativo', 'atencao'])
        .is('arquivado_em', null),
      supabase.from('producoes_social_media').select('id, cliente_id'),
      supabase.from('producoes_social_media_items').select('*'),
      supabase.from('cliente_perfil_setup').select('*'),
      supabase
        .from('profiles')
        .select('*')
        .eq('ativo', true)
        .eq('aprovado', true)
        .or('cargo.eq.social_media,cargos_extras.cs.{social_media}')
        .order('nome'),
      supabase.from('social_followup').select('*'),
    ])

    const clientesArr = (cRes.data as ClienteLite[]) ?? []
    const planos = (pRes.data as PlanejamentoSocialMedia[]) ?? []
    const itemsRaw = (iRes.data as ItemSocialMedia[]) ?? []
    const setupsArr = (sRes.data as ClientePerfilSetup[]) ?? []
    const smArr = (smRes.data as Profile[]) ?? []
    // Se tabela social_followup nao existe (migration 066 nao rodada),
    // trata como lista vazia e loga aviso — nao quebra o resto do painel.
    const fArr = (fRes.data as SocialFollowup[]) ?? []
    if (fRes.error) {
      console.warn(
        '[HeadSocial] Falha ao carregar social_followup — a migration 066 foi rodada? Erro:',
        fRes.error,
      )
    }
    // Log de diagnostico rapido no console pra debug de "painel vazio"
    console.info('[HeadSocial] carregado:', {
      clientes: clientesArr.length,
      planos: planos.length,
      items: itemsRaw.length,
      items_em_aprovacao: itemsRaw.filter((i) => i.status === 'em_aprovacao').length,
      items_prontos: itemsRaw.filter(
        (i) =>
          (i.status === 'design_finalizado' || i.status === 'conclusao') &&
          !i.publicado_em,
      ).length,
      setups: setupsArr.length,
      social_medias: smArr.length,
      followups: fArr.length,
    })

    const planoIdToCliente = new Map<string, string>()
    for (const p of planos) planoIdToCliente.set(p.id, p.cliente_id)

    const itemsEnriched = itemsRaw
      .map((it) => {
        const cid = planoIdToCliente.get(it.producao_id)
        if (!cid) return null
        return { ...it, cliente_id: cid }
      })
      .filter((x): x is ItemSocialMedia & { cliente_id: string } => x !== null)

    // Antes de setar o state, roda auto-resolve dos followups cuja
    // pendencia ja foi sanada pela operacao (item aprovado, publicado,
    // call remarcada, setup completo). Precisa fazer aqui pra pegar
    // os dados frescos, e depois refetchar os followups.
    const clienteAtivos = new Set(clientesArr.map((c) => c.id))
    const hoje = new Date().toISOString().slice(0, 10)
    const chavesAtivas = new Set<string>()

    // aprovacao
    for (const it of itemsEnriched) {
      if (it.status === 'em_aprovacao' && clienteAtivos.has(it.cliente_id)) {
        chavesAtivas.add(chave(it.cliente_id, 'aprovacao', it.id))
      }
    }
    // publicacao
    for (const it of itemsEnriched) {
      const pronta =
        (it.status === 'design_finalizado' || it.status === 'conclusao') &&
        !it.publicado_em &&
        it.prazo &&
        it.prazo.slice(0, 10) >= hoje
      if (pronta && clienteAtivos.has(it.cliente_id)) {
        chavesAtivas.add(chave(it.cliente_id, 'publicacao', it.id))
      }
    }
    // call
    for (const c of clientesArr) {
      const prox = c.proxima_call_alinhamento
      if (!prox || prox < hoje) {
        chavesAtivas.add(chave(c.id, 'call', null))
      }
    }
    // setup
    const setupsMap = new Map(setupsArr.map((s) => [s.cliente_id, s]))
    for (const c of clientesArr) {
      const s = setupsMap.get(c.id)
      const faltando = s
        ? [s.foto_status, s.bio_status, s.destaques_status, s.contato_status].filter(
            (v) => v !== 'ok',
          ).length
        : 4
      if (faltando > 0) {
        chavesAtivas.add(chave(c.id, 'setup', null))
      }
    }

    await autoResolverPendenciasSanadas(fArr, chavesAtivas)

    // Refetcha os followups pra pegar o que foi auto-resolvido
    const { data: fArrFinal } = await supabase.from('social_followup').select('*')

    setClientes(clientesArr)
    setItems(itemsEnriched)
    setSetups(setupsMap)
    setSocialMedias(smArr)
    setFollowups((fArrFinal as SocialFollowup[]) ?? fArr)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const followupByChave = useMemo(() => {
    const m = new Map<string, SocialFollowup>()
    for (const f of followups) m.set(chave(f.cliente_id, f.tipo, f.ref_id), f)
    return m
  }, [followups])

  // Filtra clientes pelo social media selecionado
  const clientesFiltrados = useMemo(() => {
    if (!filtroSM) return clientes
    return clientes.filter((c) => c.social_media_id === filtroSM)
  }, [clientes, filtroSM])
  const clientesById = useMemo(
    () => new Map(clientesFiltrados.map((c) => [c.id, c])),
    [clientesFiltrados],
  )

  // ============ DERIVA PENDENCIAS ============
  const pendencias = useMemo<Pendencia[]>(() => {
    const out: Pendencia[] = []
    const hoje = new Date().toISOString().slice(0, 10)

    // 1) Items em aprovacao
    for (const it of items) {
      if (it.status !== 'em_aprovacao') continue
      const cliente = clientesById.get(it.cliente_id)
      if (!cliente) continue
      const dias = diasDesde(it.updated_at) ?? 0
      const ch = chave(cliente.id, 'aprovacao', it.id)
      out.push({
        chave: ch,
        cliente,
        tipo: 'aprovacao',
        refId: it.id,
        titulo: it.titulo || 'Sem título',
        subtitulo: (it.formato ?? '').toUpperCase(),
        contexto: `${dias}d parada em aprovação`,
        urgencia: dias,
        followup: followupByChave.get(ch),
      })
    }

    // 2) Prontas pra publicar (design_finalizado + conclusao)
    for (const it of items) {
      const pronta =
        (it.status === 'design_finalizado' || it.status === 'conclusao') &&
        !it.publicado_em &&
        it.prazo &&
        it.prazo.slice(0, 10) >= hoje
      if (!pronta) continue
      const cliente = clientesById.get(it.cliente_id)
      if (!cliente) continue
      const dias = diasAte(it.prazo ?? '') ?? 999
      const ch = chave(cliente.id, 'publicacao', it.id)
      const contextoLabel =
        dias === 0 ? 'publica hoje' : dias === 1 ? 'publica amanhã' : `publica em ${dias}d`
      out.push({
        chave: ch,
        cliente,
        tipo: 'publicacao',
        refId: it.id,
        titulo: it.titulo || 'Sem título',
        subtitulo: (it.formato ?? '').toUpperCase(),
        contexto: `${contextoLabel} · ${it.prazo ? formatDateBR(it.prazo) : ''}`,
        urgencia: 100 - dias, // quanto menos dias, maior urgencia
        followup: followupByChave.get(ch),
      })
    }

    // 3) Calls vencidas / sem agenda
    for (const c of clientesFiltrados) {
      const prox = c.proxima_call_alinhamento
      const vencida = prox && prox < hoje
      const semAgenda = !prox
      if (!vencida && !semAgenda) continue
      const ch = chave(c.id, 'call', null)
      const dias = vencida ? Math.abs(diasAte(prox) ?? 0) : 0
      out.push({
        chave: ch,
        cliente: c,
        tipo: 'call',
        refId: null,
        titulo: vencida ? `Call venceu em ${formatDateBR(prox)}` : 'Sem call agendada',
        contexto: vencida ? `${dias}d atrasada` : '—',
        urgencia: vencida ? 30 + dias : 20,
        followup: followupByChave.get(ch),
      })
    }

    // 4) Setup incompleto
    for (const c of clientesFiltrados) {
      const s = setups.get(c.id)
      const faltando = s
        ? [s.foto_status, s.bio_status, s.destaques_status, s.contato_status].filter(
            (v) => v !== 'ok',
          ).length
        : 4
      if (faltando === 0) continue
      const ch = chave(c.id, 'setup', null)
      out.push({
        chave: ch,
        cliente: c,
        tipo: 'setup',
        refId: null,
        titulo: `${faltando}/4 itens do setup pendentes`,
        contexto: 'foto · bio · destaques · contato',
        urgencia: faltando * 5,
        followup: followupByChave.get(ch),
      })
    }

    // Ordena por urgencia (maior primeiro)
    out.sort((a, b) => b.urgencia - a.urgencia)
    return out
  }, [items, clientesFiltrados, clientesById, setups, followupByChave])

  // ============ AGRUPA POR STATUS DE FOLLOWUP ============
  const lanes = useMemo(() => {
    const naoCobrado: Pendencia[] = []
    const aguardando: Pendencia[] = []
    const agendado: Pendencia[] = []
    const escalado: Pendencia[] = []
    const resolvido: Pendencia[] = []
    for (const p of pendencias) {
      const st = p.followup?.status ?? 'nao_cobrado'
      if (st === 'nao_cobrado') naoCobrado.push(p)
      else if (st === 'aguardando') aguardando.push(p)
      else if (st === 'agendado') agendado.push(p)
      else if (st === 'escalado') escalado.push(p)
      else if (st === 'resolvido') resolvido.push(p)
    }
    return { naoCobrado, aguardando, agendado, escalado, resolvido }
  }, [pendencias])

  // ============ ACOES ============

  /** Upsert do followup no banco. Se nao existe, cria; se existe, atualiza. */
  async function upsertFollowup(
    p: Pendencia,
    patch: Partial<SocialFollowup>,
  ): Promise<void> {
    const existing = p.followup
    if (existing) {
      await supabase
        .from('social_followup')
        .update({ ...patch, autor_ultima_id: profile?.id ?? null })
        .eq('id', existing.id)
    } else {
      await supabase.from('social_followup').insert({
        cliente_id: p.cliente.id,
        tipo: p.tipo,
        ref_id: p.refId,
        autor_ultima_id: profile?.id ?? null,
        ...patch,
      })
    }
    await load()
  }

  /** Registra cobranca — incrementa tentativas + timestamp + status aguardando. */
  async function registrarCobranca(p: Pendencia, canal: string) {
    const now = new Date().toISOString()
    await upsertFollowup(p, {
      status: 'aguardando',
      ultima_cobranca_em: now,
      tentativas: (p.followup?.tentativas ?? 0) + 1,
      canal,
    })
  }

  async function abrirWhatsapp(p: Pendencia) {
    const mensagem = mensagemPadrao(p)
    const url = whatsappUrl(p.cliente.link_grupo, mensagem)
    if (url === '#') {
      alert(
        `Cliente ${p.cliente.nome} não tem link do grupo WhatsApp cadastrado. Adicione em Clientes → detalhe → link_grupo.`,
      )
      return
    }
    // Abre em nova aba
    window.open(url, '_blank', 'noopener,noreferrer')
    // Registra cobranca
    await registrarCobranca(p, 'whatsapp')
  }

  async function marcarCobradoManual(p: Pendencia, canal: string) {
    await registrarCobranca(p, canal)
  }

  async function agendarRetorno(p: Pendencia) {
    const data = prompt('Data do retorno (YYYY-MM-DD):')
    if (!data) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      alert('Formato inválido. Use YYYY-MM-DD (ex.: 2026-08-25)')
      return
    }
    await upsertFollowup(p, { status: 'agendado', proximo_followup: data })
  }

  async function escalarClienteBloqueado(p: Pendencia) {
    if (!confirm(`Escalar "${p.cliente.nome}"? Isso sinaliza que precisa de outra abordagem (diretoria/AM).`))
      return
    await upsertFollowup(p, { status: 'escalado' })
  }

  async function resolverPendencia(p: Pendencia) {
    await upsertFollowup(p, { status: 'resolvido' })
  }

  async function reabrirPendencia(p: Pendencia) {
    await upsertFollowup(p, { status: 'nao_cobrado' })
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Painel do Head · Social Media"
          description="Follow-up de cobrança e relacionamento"
        />
        <Card>
          <CardBody className="p-12 text-center text-sm text-muted">
            Carregando...
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Painel do Head · Social Media"
        description="Follow-up de cobrança e relacionamento com o cliente"
        actions={
          <Select
            value={filtroSM}
            onChange={(e) => setFiltroSM(e.target.value)}
            className="min-w-[200px]"
          >
            <option value="">Todos social media</option>
            {socialMedias.map((sm) => (
              <option key={sm.id} value={sm.id}>
                {sm.nome}
              </option>
            ))}
          </Select>
        }
      />

      {/* Barra de diagnostico — sempre visivel pra saber o que foi carregado */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-[11px] text-muted">
        <span>
          <b className="text-zinc-100">{clientesFiltrados.length}</b> clientes acompanhados
        </span>
        <span>·</span>
        <span>
          <b className="text-zinc-100">{items.length}</b> items no pipeline
        </span>
        <span>·</span>
        <span>
          <b className="text-zinc-100">{pendencias.length}</b> pendências detectadas
        </span>
        <span>·</span>
        <span>
          <b className="text-zinc-100">{followups.length}</b> followups salvos
        </span>
        {pendencias.length === 0 && (
          <span className="ml-auto text-amber-300">
            ⚠ 0 pendências — se ta com dado no sistema, algo pode estar bloqueando (ex: migration 066 não rodada)
          </span>
        )}
      </div>

      {/* Kanban horizontal — 4 lanes */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Lane
          titulo="Não cobrado"
          descricao="pendências novas, ainda sem ação"
          icone={<AlertCircle size={14} />}
          cor="border-red-500/40 bg-red-500/5"
          count={lanes.naoCobrado.length}
        >
          {lanes.naoCobrado.map((p) => (
            <FollowupCard
              key={p.chave}
              p={p}
              onWhatsapp={() => abrirWhatsapp(p)}
              onMarcarCobrado={() => marcarCobradoManual(p, 'call')}
              onEscalar={() => escalarClienteBloqueado(p)}
              onResolver={() => resolverPendencia(p)}
            />
          ))}
        </Lane>

        <Lane
          titulo="Aguardando"
          descricao="cobrei, esperando cliente"
          icone={<Clock size={14} />}
          cor="border-amber-500/40 bg-amber-500/5"
          count={lanes.aguardando.length}
        >
          {lanes.aguardando.map((p) => (
            <FollowupCard
              key={p.chave}
              p={p}
              modo="aguardando"
              onWhatsapp={() => abrirWhatsapp(p)}
              onMarcarCobrado={() => marcarCobradoManual(p, 'call')}
              onAgendar={() => agendarRetorno(p)}
              onEscalar={() => escalarClienteBloqueado(p)}
              onResolver={() => resolverPendencia(p)}
            />
          ))}
        </Lane>

        <Lane
          titulo="Agendado"
          descricao="retorno marcado"
          icone={<CalendarIcon size={14} />}
          cor="border-brand-500/40 bg-brand-500/5"
          count={lanes.agendado.length}
        >
          {lanes.agendado.map((p) => (
            <FollowupCard
              key={p.chave}
              p={p}
              modo="agendado"
              onWhatsapp={() => abrirWhatsapp(p)}
              onMarcarCobrado={() => marcarCobradoManual(p, 'call')}
              onAgendar={() => agendarRetorno(p)}
              onResolver={() => resolverPendencia(p)}
            />
          ))}
        </Lane>

        <Lane
          titulo="Escalado"
          descricao="bloqueado, precisa outra abordagem"
          icone={<PhoneCall size={14} />}
          cor="border-violet-500/40 bg-violet-500/5"
          count={lanes.escalado.length}
        >
          {lanes.escalado.map((p) => (
            <FollowupCard
              key={p.chave}
              p={p}
              modo="escalado"
              onWhatsapp={() => abrirWhatsapp(p)}
              onReabrir={() => reabrirPendencia(p)}
              onResolver={() => resolverPendencia(p)}
            />
          ))}
        </Lane>
      </div>

      {/* Resolvidos — accordion abaixo */}
      {lanes.resolvido.length > 0 && (
        <Card>
          <button
            onClick={() => setMostrarResolvidos((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-bg-soft/40"
          >
            <Check size={14} className="text-emerald-300" />
            <span className="flex-1 text-sm font-semibold">
              Resolvidos
              <Badge tone="success" className="ml-2">
                {lanes.resolvido.length}
              </Badge>
            </span>
            {mostrarResolvidos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {mostrarResolvidos && (
            <CardBody className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              {lanes.resolvido.map((p) => (
                <FollowupCard
                  key={p.chave}
                  p={p}
                  modo="resolvido"
                  onReabrir={() => reabrirPendencia(p)}
                />
              ))}
            </CardBody>
          )}
        </Card>
      )}

      <p className="text-[10px] text-muted italic">
        Pendências detectadas automaticamente. Ao clicar em "Cobrar", "Agendar",
        "Escalar" ou "Resolvido", o estado fica salvo por cliente + tipo.
      </p>
    </div>
  )
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function Lane({
  titulo,
  descricao,
  icone,
  cor,
  count,
  children,
}: {
  titulo: string
  descricao: string
  icone: React.ReactNode
  cor: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border p-2.5', cor)}>
      <div className="mb-2 flex items-center gap-2 px-1">
        {icone}
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider">{titulo}</p>
          <p className="text-[10px] text-muted">{descricao}</p>
        </div>
        <Badge tone={count > 0 ? 'brand' : 'neutral'}>{count}</Badge>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function FollowupCard({
  p,
  modo = 'nao_cobrado',
  onWhatsapp,
  onMarcarCobrado,
  onAgendar,
  onEscalar,
  onResolver,
  onReabrir,
}: {
  p: Pendencia
  modo?: 'nao_cobrado' | 'aguardando' | 'agendado' | 'escalado' | 'resolvido'
  onWhatsapp?: () => void
  onMarcarCobrado?: () => void
  onAgendar?: () => void
  onEscalar?: () => void
  onResolver?: () => void
  onReabrir?: () => void
}) {
  const f = p.followup
  const cobradoDias = diasDesde(f?.ultima_cobranca_em)
  const proxDias = f?.proximo_followup ? diasAte(f.proximo_followup) : null

  return (
    <div className="rounded-lg border border-border bg-bg-card p-2.5 shadow-sm">
      {/* Cabecalho: tipo + cliente */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <Badge tone={TIPO_TONE[p.tipo]} className="!text-[9px]">
          {TIPO_LABEL[p.tipo]}
        </Badge>
        <Link
          to={`/social/clientes/${p.cliente.id}`}
          className="min-w-0 flex-1 truncate text-[11px] font-medium text-brand-300 hover:underline"
        >
          {p.cliente.nome}
        </Link>
      </div>

      {/* Titulo + subtitulo */}
      <p className="line-clamp-2 text-xs text-zinc-100">{p.titulo}</p>
      {p.subtitulo && (
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
          {p.subtitulo}
        </p>
      )}

      {/* Contexto */}
      {p.contexto && (
        <p className="mt-1 text-[10px] text-muted">· {p.contexto}</p>
      )}

      {/* Estado do followup */}
      {f && (
        <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] text-muted">
          {f.tentativas > 0 && (
            <span className="rounded bg-bg-elev px-1.5 py-0.5">
              {f.tentativas}× cobrado
            </span>
          )}
          {cobradoDias !== null && (
            <span className="rounded bg-bg-elev px-1.5 py-0.5">
              {cobradoDias === 0 ? 'cobrei hoje' : `${cobradoDias}d desde última`}
            </span>
          )}
          {modo === 'agendado' && f.proximo_followup && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5',
                proxDias !== null && proxDias < 0
                  ? 'bg-red-500/20 text-red-200'
                  : 'bg-brand-500/20 text-brand-200',
              )}
            >
              retorno {formatDateBR(f.proximo_followup)}
              {proxDias !== null &&
                (proxDias < 0
                  ? ` · ${Math.abs(proxDias)}d atrasado`
                  : proxDias === 0
                    ? ' · hoje'
                    : ` · em ${proxDias}d`)}
            </span>
          )}
        </div>
      )}

      {/* Acoes */}
      <div className="mt-2 flex flex-wrap gap-1">
        {modo !== 'resolvido' && (
          <>
            <button
              onClick={onWhatsapp}
              disabled={!p.cliente.link_grupo}
              className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                p.cliente.link_grupo
                  ? 'Abre o grupo/conversa do cliente no WhatsApp e registra a tentativa'
                  : 'Cliente sem link_grupo cadastrado — preencha em Clientes'
              }
            >
              <MessageCircle size={10} />
              WhatsApp
            </button>
            <button
              onClick={onMarcarCobrado}
              className="inline-flex items-center gap-1 rounded border border-border bg-bg-soft px-2 py-1 text-[10px] text-zinc-200 hover:border-brand-500/40"
              title="Marcar como cobrado (outros canais)"
            >
              <Check size={10} />
              Cobrei
            </button>
            {(modo === 'nao_cobrado' || modo === 'aguardando') && onAgendar && (
              <button
                onClick={onAgendar}
                className="inline-flex items-center gap-1 rounded border border-border bg-bg-soft px-2 py-1 text-[10px] text-zinc-200 hover:border-brand-500/40"
                title="Agendar retorno pra data específica"
              >
                <CalendarIcon size={10} />
                Agendar
              </button>
            )}
            {modo !== 'escalado' && onEscalar && (
              <button
                onClick={onEscalar}
                className="inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-500/20"
                title="Escalar — cliente sumiu, precisa outra abordagem"
              >
                <ArrowRight size={10} />
                Escalar
              </button>
            )}
            <button
              onClick={onResolver}
              className="inline-flex items-center gap-1 rounded border border-border bg-bg-soft px-2 py-1 text-[10px] text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-200"
              title="Pendência resolvida (cliente aprovou / publicamos / call feita)"
            >
              <Check size={10} />
              Resolvido
            </button>
          </>
        )}
        {modo === 'resolvido' && (
          <button
            onClick={onReabrir}
            className="inline-flex items-center gap-1 rounded border border-border bg-bg-soft px-2 py-1 text-[10px] text-zinc-200 hover:border-brand-500/40"
            title="Reabrir esse followup"
          >
            <RotateCw size={10} />
            Reabrir
          </button>
        )}
        {modo === 'escalado' && onReabrir && (
          <button
            onClick={onReabrir}
            className="inline-flex items-center gap-1 rounded border border-border bg-bg-soft px-2 py-1 text-[10px] text-zinc-200 hover:border-brand-500/40"
            title="Voltar pra fila de cobrança normal"
          >
            <RotateCw size={10} />
            Voltar
          </button>
        )}
      </div>
    </div>
  )
}

/** Gera mensagem base pro WhatsApp de acordo com o tipo. */
function mensagemPadrao(p: Pendencia): string {
  const nome = p.cliente.nome
  switch (p.tipo) {
    case 'aprovacao':
      return `Oi ${nome}! Passei aqui pra lembrar da arte "${p.titulo}" que tá aguardando sua aprovação. Consegue dar uma olhada?`
    case 'publicacao':
      return `Oi ${nome}! O post "${p.titulo}" já está pronto pra ir ao ar. Confirma pra publicarmos?`
    case 'call':
      return `Oi ${nome}! Podemos marcar nossa call de alinhamento? Qual dia da semana funciona melhor?`
    case 'setup':
      return `Oi ${nome}! Falta pouco pra finalizar o setup do seu perfil. Consegue enviar as pendências pra gente concluir?`
    default:
      return `Oi ${nome}! Podemos alinhar rapidinho por aqui?`
  }
}

// Suprime warnings de import nao usado — Sparkles/Send/X ficam pra iterar depois
void Sparkles
void Send
void X
