/**
 * Operacional › Gestão › Performance — desempenho de cada colaborador
 * (tarefas, design, social) por função e período. Veio da aba Performance
 * do Admin (26/09/2026); a aba "Geral" do Admin era uma versão simplificada
 * disto (+ tabela de usuários duplicada de Gerenciar Acessos) e saiu.
 * Só admin (rota e menu), como era no Admin.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Trophy, Target, CheckCircle2, AlertCircle, CircleDot } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CARGOS, cargoLabel, funcaoPrincipal, temAlgumCargo, temCargo, type Cargo } from '@/lib/cargos'
import { buscarProfilesComPapel } from '@/lib/profilesComPapel'
import type { Profile } from '@/types/database'

export default function PerformanceEquipe() {
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  useEffect(() => {
    // Com o papel (Equipe Operacional): a função de cada um sai de temCargo/funcaoPrincipal.
    buscarProfilesComPapel((sel) => supabase.from('profiles').select(sel).order('nome')).then(({ data }) =>
      setUsuarios(data.filter((u) => u.aprovado)),
    )
  }, [])
  return (
    <div>
      <PageHeader title="Performance da Equipe" description="Entregas, atrasos e ritmo de cada colaborador por função" />
      <PerformanceTab usuarios={usuarios} />
    </div>
  )
}

/* Cores por cargo (usadas na aba Performance) */
const cargoAccent: Record<Cargo, { dot: string; text: string }> = {
  gestor_trafego: { dot: 'bg-brand-400', text: 'text-brand-200' },
  account_manager: { dot: 'bg-sky-400', text: 'text-sky-200' },
  designer: { dot: 'bg-violet-400', text: 'text-violet-200' },
  social_media: { dot: 'bg-pink-400', text: 'text-pink-200' },
  diretoria: { dot: 'bg-emerald-400', text: 'text-emerald-200' },
  head: { dot: 'bg-amber-400', text: 'text-amber-200' },
}

/* =========================================================
   Tab: Performance
   ========================================================= */

type Periodo = '7d' | '30d' | '90d' | 'all'

interface ColaboradorStats {
  user: Profile
  total: number
  concluidas: number
  pendentes: number
  atrasadas: number
  noPrazo: number
  forada: number
  taxaConclusao: number // 0..100
  taxaPontualidade: number // 0..100
  score: number // 0..100 (composição ponderada)
  porFrequencia: { diaria: number; semanal: number; mensal: number; esporadica: number }
}

/**
 * Item de trabalho unificado pra cálculo de performance.
 * Mapeia tarefas + projetos_webdesign + criativos_webdesign + edicoes_video
 * + producoes_social_media_items pra uma estrutura comum.
 */
interface WorkItem {
  id: string
  origem: 'tarefa' | 'projeto' | 'criativo' | 'edicao_video' | 'social_item'
  responsavel_id: string | null
  cliente_id: string | null
  // Status normalizado: 'concluida' | outro
  concluida: boolean
  // Prazo (data limite) — pode ser data_vencimento (tarefa) ou prazo (demais)
  prazo: string | null
  // Quando foi concluída (data_conclusao da tarefa OU updated_at dos demais
  // se status=conclusao). Usado pra calcular pontualidade.
  data_conclusao: string | null
  frequencia?: string
}

/**
 * Item de publicação pro cálculo de social_media. Um item pertence a UM
 * social media (cascata: item.responsavel_id > planejamento.responsavel_id
 * > cliente.social_media_id). Só interessa: prazo (data marcada) e
 * publicado_em (data real). Se prazo já venceu e não publicou, tambem
 * conta como avaliavel (atraso puro).
 */
interface PubItem {
  id: string
  responsavel_id: string | null
  prazo: string | null
  publicado_em: string | null
}

function PerformanceTab({ usuarios }: { usuarios: Profile[] }) {
  const [items, setItems] = useState<WorkItem[]>([])
  const [pubItems, setPubItems] = useState<PubItem[]>([])
  const [clientesMap, setClientesMap] = useState<
    Record<string, {
      account_manager_id: string | null
      gestor_id: string | null
      social_media_id: string | null
      status: string | null
      arquivado_em: string | null
      ultima_call_alinhamento: string | null
    }>
  >({})
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('30d')

  async function load() {
    setLoading(true)
    // Carrega tarefas + os 4 tipos de "trabalho" do design + clientes +
    // planejamentos SM (pra cascata de atribuicao no calculo do social media)
    const [tRes, pRes, crRes, evRes, smRes, cRes, planRes] = await Promise.all([
      supabase
        .from('tarefas')
        .select('id, status, data_vencimento, data_conclusao, responsavel_id, cliente_id, frequencia'),
      supabase
        .from('projetos_webdesign')
        .select('id, status, prazo, responsavel_id, cliente_id, updated_at'),
      supabase
        .from('criativos_webdesign')
        .select('id, status, prazo, responsavel_id, cliente_id, updated_at'),
      supabase
        .from('edicoes_video')
        .select('id, status, prazo, responsavel_id, cliente_id, updated_at'),
      supabase
        .from('producoes_social_media_items')
        .select('id, status, prazo, publicado_em, responsavel_id, producao_id, updated_at'),
      supabase
        .from('clientes')
        .select(
          'id, account_manager_id, gestor_id, social_media_id, status, arquivado_em, ultima_call_alinhamento',
        ),
      supabase
        .from('producoes_social_media')
        .select('id, cliente_id, responsavel_id'),
    ])

    const unified: WorkItem[] = []

    // tarefas
    for (const t of (tRes.data ?? []) as Array<{
      id: string
      status: string
      data_vencimento: string | null
      data_conclusao: string | null
      responsavel_id: string | null
      cliente_id: string
      frequencia: string
    }>) {
      unified.push({
        id: t.id,
        origem: 'tarefa',
        responsavel_id: t.responsavel_id,
        cliente_id: t.cliente_id,
        concluida: t.status === 'concluida',
        prazo: t.data_vencimento,
        data_conclusao: t.data_conclusao,
        frequencia: t.frequencia,
      })
    }

    function mapDesign(
      rows: Array<{
        id: string
        status: string
        prazo: string | null
        responsavel_id: string | null
        cliente_id: string | null
        updated_at: string | null
      }>,
      origem: WorkItem['origem'],
    ) {
      for (const r of rows) {
        const concluida = r.status === 'conclusao'
        unified.push({
          id: r.id,
          origem,
          responsavel_id: r.responsavel_id,
          cliente_id: r.cliente_id,
          concluida,
          prazo: r.prazo,
          // Sem campo data_conclusao explícito — usa updated_at como proxy
          // quando o status já é 'conclusao'.
          data_conclusao: concluida ? r.updated_at : null,
        })
      }
    }

    mapDesign((pRes.data ?? []) as Parameters<typeof mapDesign>[0], 'projeto')
    mapDesign((crRes.data ?? []) as Parameters<typeof mapDesign>[0], 'criativo')
    mapDesign((evRes.data ?? []) as Parameters<typeof mapDesign>[0], 'edicao_video')

    // Constroi o mapa de clientes primeiro pra usar na cascata de social media
    // e nos calculos de saude/calls do AM
    const map: typeof clientesMap = {}
    for (const c of (cRes.data ?? []) as Array<{
      id: string
      account_manager_id: string | null
      gestor_id: string | null
      social_media_id: string | null
      status: string | null
      arquivado_em: string | null
      ultima_call_alinhamento: string | null
    }>) {
      map[c.id] = {
        account_manager_id: c.account_manager_id,
        gestor_id: c.gestor_id,
        social_media_id: c.social_media_id,
        status: c.status,
        arquivado_em: c.arquivado_em,
        ultima_call_alinhamento: c.ultima_call_alinhamento,
      }
    }

    // Planejamentos SM: producao_id -> {cliente_id, responsavel_id} pra
    // resolver a cascata de atribuicao dos items
    const planoMap = new Map<
      string,
      { cliente_id: string | null; responsavel_id: string | null }
    >()
    for (const p of (planRes.data ?? []) as Array<{
      id: string
      cliente_id: string | null
      responsavel_id: string | null
    }>) {
      planoMap.set(p.id, {
        cliente_id: p.cliente_id,
        responsavel_id: p.responsavel_id,
      })
    }

    // social_item: alimenta AMBOS unified (calc antigo) e pubItems (calc
    // novo pro cargo social_media). Cascata de atribuicao pra pubItems:
    // item.responsavel_id > planejamento.responsavel_id > cliente.social_media_id
    const pubs: PubItem[] = []
    for (const i of (smRes.data ?? []) as Array<{
      id: string
      status: string
      prazo: string | null
      publicado_em: string | null
      responsavel_id: string | null
      producao_id: string
      updated_at: string | null
    }>) {
      const concluida = i.status === 'conclusao'
      unified.push({
        id: i.id,
        origem: 'social_item',
        responsavel_id: i.responsavel_id,
        cliente_id: null,
        concluida,
        prazo: i.prazo,
        data_conclusao: concluida ? i.updated_at : null,
      })

      // Cascata: item -> planejamento -> cliente.social_media_id
      const plano = planoMap.get(i.producao_id)
      const clienteId = plano?.cliente_id ?? null
      const cliente = clienteId ? map[clienteId] : null
      const responsavel =
        i.responsavel_id ??
        plano?.responsavel_id ??
        cliente?.social_media_id ??
        null
      pubs.push({
        id: i.id,
        responsavel_id: responsavel,
        prazo: i.prazo,
        publicado_em: i.publicado_em,
      })
    }

    setItems(unified)
    setPubItems(pubs)
    setClientesMap(map)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo<ColaboradorStats[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff =
      periodo === 'all'
        ? null
        : (() => {
            const d = new Date(today)
            d.setDate(d.getDate() - (periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90))
            return d.toISOString().slice(0, 10)
          })()

    const itemsFiltrados = cutoff
      ? items.filter((it) => {
          // Inclui items concluídos no período OU com prazo no período
          if (it.data_conclusao && it.data_conclusao.slice(0, 10) >= cutoff) return true
          if (it.prazo && it.prazo >= cutoff) return true
          return false
        })
      : items

    const todayStr = today.toISOString().slice(0, 10)

    // Items de publicacao filtrados por periodo (usados so pra cargo=social_media).
    // Filtro: prazo dentro do periodo OU publicado_em no periodo.
    const pubsFiltrados = cutoff
      ? pubItems.filter((it) => {
          if (it.publicado_em && it.publicado_em.slice(0, 10) >= cutoff) return true
          if (it.prazo && it.prazo >= cutoff) return true
          return false
        })
      : pubItems

    return usuarios
      .map<ColaboradorStats>((u) => {
        // -------- SOCIAL MEDIA: metrica so de pontualidade de publicacao --------
        // Social media nao produz o post (isso e' o designer). O que a gente
        // mede e' se ela publicou na data marcada.
        //   • no prazo  = publicado_em::date <= prazo
        //   • atrasado  = publicou depois OU nunca publicou apesar do prazo ja ter vencido
        //   • ignora    = item com prazo futuro sem publicacao (ainda nao da pra medir)
        if (temCargo(u, 'social_media')) {
          const meus = pubsFiltrados.filter((it) => it.responsavel_id === u.id)
          const avaliaveis = meus.filter((it) => {
            if (!it.prazo) return false
            // Ja publicado → sempre da pra avaliar
            if (it.publicado_em) return true
            // Nao publicado → so avalia se o prazo ja passou (perdeu)
            return it.prazo < todayStr
          })
          const noPrazoCount = avaliaveis.filter(
            (it) =>
              !!it.publicado_em &&
              it.publicado_em.slice(0, 10) <= (it.prazo ?? ''),
          ).length
          const atrasadasCount = avaliaveis.length - noPrazoCount

          const taxa =
            avaliaveis.length > 0 ? (noPrazoCount / avaliaveis.length) * 100 : 0
          const scoreSm = Math.round(taxa)

          return {
            user: u,
            total: avaliaveis.length,          // "denominador" — publicacoes com prazo ja avaliavel
            concluidas: noPrazoCount,           // publicadas no prazo
            pendentes: 0,
            atrasadas: atrasadasCount,          // publicou tarde OU nao publicou apos prazo
            noPrazo: noPrazoCount,
            forada: atrasadasCount,
            taxaConclusao: taxa,
            taxaPontualidade: taxa,
            score: scoreSm,
            porFrequencia: { diaria: 0, semanal: 0, mensal: 0, esporadica: 0 },
          }
        }

        // -------- ACCOUNT MANAGER / GESTOR DE TRAFEGO: 3 componentes (20/50/30) --------
        // Score = 20% calls + 50% tarefas diretas no prazo + 30% saude do portfolio
        // Motivacao: gestor de trafego e AM sao a MESMA pessoa nessa operacao —
        // a pessoa supervisiona o cliente + faz otimizacao de trafego +
        // rotina operacional propria + zela pela retencao. As tarefas
        // herdadas via cliente inflam o denominador com trabalho do gestor,
        // entao AQUI a gente conta SO tarefas com responsavel_id = user
        // (nao herda). Vale pros dois cargos.
        if (temAlgumCargo(u, ['account_manager', 'gestor_trafego'])) {
          // 1) Calls no prazo — quantos clientes ativos sob a pessoa tiveram
          //    call realizada nos ultimos 30 dias
          //    Consideramos "sob a pessoa" = account_manager_id OU gestor_id
          //    (ja que sao o mesmo cargo na pratica)
          const cutoff30d = (() => {
            const d = new Date(today)
            d.setDate(d.getDate() - 30)
            return d.toISOString().slice(0, 10)
          })()
          const clientesSobAm = Object.values(clientesMap).filter(
            (c) => c.account_manager_id === u.id || c.gestor_id === u.id,
          )
          const clientesAtivosSobAm = clientesSobAm.filter(
            (c) => c.status !== 'churn' && !c.arquivado_em,
          )
          const clientesComCallRecente = clientesAtivosSobAm.filter(
            (c) =>
              c.ultima_call_alinhamento &&
              c.ultima_call_alinhamento >= cutoff30d,
          )
          const taxaCalls =
            clientesAtivosSobAm.length > 0
              ? (clientesComCallRecente.length / clientesAtivosSobAm.length) *
                100
              : 0

          // 2) Tarefas diretas no prazo — SO tarefas com responsavel_id = AM
          //    (nao herda via cliente.account_manager_id). Mesma logica do
          //    social media: avaliaveis = concluidas + pendentes ja vencidas.
          const tarefasDiretas = itemsFiltrados.filter(
            (it) => it.origem === 'tarefa' && it.responsavel_id === u.id,
          )
          const avaliaveisTarefas = tarefasDiretas.filter((it) => {
            if (!it.prazo) return false
            if (it.concluida) return true
            return it.prazo < todayStr
          })
          const tarefasNoPrazoCount = avaliaveisTarefas.filter(
            (it) =>
              it.concluida &&
              (it.data_conclusao ?? '').slice(0, 10) <= (it.prazo ?? ''),
          ).length
          const taxaTarefas =
            avaliaveisTarefas.length > 0
              ? (tarefasNoPrazoCount / avaliaveisTarefas.length) * 100
              : 0

          // 3) Saude do portfolio — clientes ativo ÷ (ativo + atencao + pausado + churn_recente)
          //    churn_recente = arquivado_em nos ultimos 30 dias (churn antigo nao pesa)
          const numeradorSaude = clientesSobAm.filter(
            (c) => c.status === 'ativo' && !c.arquivado_em,
          ).length
          const denomSaude = clientesSobAm.filter(
            (c) =>
              c.status === 'ativo' ||
              c.status === 'atencao' ||
              c.status === 'pausado' ||
              (c.status === 'churn' &&
                c.arquivado_em &&
                c.arquivado_em.slice(0, 10) >= cutoff30d),
          ).length
          const taxaSaude =
            denomSaude > 0 ? (numeradorSaude / denomSaude) * 100 : 0

          const scoreAm = Math.max(
            0,
            Math.round(taxaCalls * 0.2 + taxaTarefas * 0.5 + taxaSaude * 0.3),
          )

          // Repurpose dos campos: total = tarefas avaliaveis, concluidas =
          // tarefas no prazo (o principal), atrasadas = tarefas fora do prazo.
          // Pontualidade exibida = a taxa de tarefas (componente principal).
          const atrasadasTarefas = avaliaveisTarefas.length - tarefasNoPrazoCount

          return {
            user: u,
            total: avaliaveisTarefas.length,
            concluidas: tarefasNoPrazoCount,
            pendentes: 0,
            atrasadas: atrasadasTarefas,
            noPrazo: tarefasNoPrazoCount,
            forada: atrasadasTarefas,
            taxaConclusao: taxaTarefas,
            taxaPontualidade: taxaTarefas,
            score: scoreAm,
            porFrequencia: { diaria: 0, semanal: 0, mensal: 0, esporadica: 0 },
          }
        }

        // -------- DEMAIS CARGOS: formula original (60/30/-10) --------
        // Conta um item de trabalho pro colaborador se ELE é:
        //  • Responsável direto (responsavel_id), OU
        //  • AM / Gestor / Social Media do cliente (só pra tarefas — pros
        //    items de design o responsavel é direto)
        const minhas = itemsFiltrados.filter((it) => {
          if (it.responsavel_id === u.id) return true
          // Pra itens de design (projeto/criativo/edicao/social_item),
          // só conta se for responsavel direto. Pra tarefas, vale também
          // o papel no cliente.
          if (it.origem !== 'tarefa') return false
          if (!it.cliente_id) return false
          const c = clientesMap[it.cliente_id]
          if (!c) return false
          return (
            c.account_manager_id === u.id ||
            c.gestor_id === u.id ||
            c.social_media_id === u.id
          )
        })
        const total = minhas.length
        const concluidas = minhas.filter((it) => it.concluida).length
        const pendentes = minhas.filter(
          (it) => !it.concluida && (!it.prazo || it.prazo >= todayStr),
        ).length
        const atrasadas = minhas.filter(
          (it) => !it.concluida && it.prazo && it.prazo < todayStr,
        ).length

        const concluidasComDatas = minhas.filter(
          (it) => it.concluida && it.data_conclusao && it.prazo,
        )
        const noPrazo = concluidasComDatas.filter(
          (it) => (it.data_conclusao ?? '').slice(0, 10) <= (it.prazo ?? ''),
        ).length
        const forada = concluidasComDatas.length - noPrazo

        const taxaConclusao = total > 0 ? (concluidas / total) * 100 : 0
        const taxaPontualidade =
          concluidasComDatas.length > 0 ? (noPrazo / concluidasComDatas.length) * 100 : 0
        const penalidade = total > 0 ? (atrasadas / total) * 100 : 0
        const score = Math.max(
          0,
          Math.round(taxaConclusao * 0.6 + taxaPontualidade * 0.3 - penalidade * 0.1),
        )

        const porFrequencia = {
          diaria: minhas.filter((it) => it.frequencia === 'diaria').length,
          semanal: minhas.filter((it) => it.frequencia === 'semanal').length,
          mensal: minhas.filter((it) => it.frequencia === 'mensal').length,
          esporadica: minhas.filter((it) => it.frequencia === 'esporadica').length,
        }

        return {
          user: u,
          total,
          concluidas,
          pendentes,
          atrasadas,
          noPrazo,
          forada,
          taxaConclusao,
          taxaPontualidade,
          score,
          porFrequencia,
        }
      })
      .sort((a, b) => b.score - a.score || b.concluidas - a.concluidas)
  }, [usuarios, items, pubItems, clientesMap, periodo])

  // KPIs do time todo
  const teamKpis = useMemo(() => {
    const totalTarefas = stats.reduce((s, c) => s + c.total, 0)
    const totalConcluidas = stats.reduce((s, c) => s + c.concluidas, 0)
    const totalAtrasadas = stats.reduce((s, c) => s + c.atrasadas, 0)
    const taxaTime = totalTarefas > 0 ? Math.round((totalConcluidas / totalTarefas) * 100) : 0
    // Score médio só considera quem TEM tarefas no período — pessoas
    // sem tarefas (score = 0) puxariam a média artificialmente pra baixo.
    const ativos = stats.filter((c) => c.total > 0)
    const scoreMedio =
      ativos.length > 0
        ? Math.round(ativos.reduce((s, c) => s + c.score, 0) / ativos.length)
        : 0
    const top = stats[0]
    return {
      totalTarefas,
      totalConcluidas,
      totalAtrasadas,
      taxaTime,
      scoreMedio,
      ativosCount: ativos.length,
      top,
    }
  }, [stats])

  if (loading) {
    return <p className="text-sm text-muted">Carregando...</p>
  }

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <span className="text-zinc-300">Score</span> = 60% conclusão + 30% pontualidade − 10% atraso ·{' '}
          <span className="text-pink-300">Social Media</span> = publicações no prazo ÷ avaliáveis ·{' '}
          <span className="text-sky-300">AM / Gestor</span> = 50% tarefas + 30% saúde do portfolio + 20% calls.
        </p>
        <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
          {(['7d', '30d', '90d', 'all'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                'px-3 py-1 text-[11px] font-medium rounded-md transition-colors',
                periodo === p
                  ? 'bg-bg-elev text-zinc-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)]'
                  : 'text-muted hover:text-zinc-200',
              )}
            >
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Todo período'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs do time */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<Target size={15} />}
          label="Score médio do time"
          value={`${teamKpis.scoreMedio}%`}
          subtitle={`${teamKpis.ativosCount} ativo(s) no período`}
          tone={teamKpis.scoreMedio >= 75 ? 'success' : teamKpis.scoreMedio >= 50 ? 'warning' : 'danger'}
        />
        <KpiCard
          icon={<CheckCircle2 size={15} />}
          label="Tarefas concluídas"
          value={teamKpis.totalConcluidas.toString()}
          subtitle={`de ${teamKpis.totalTarefas} no período`}
          tone="neutral"
        />
        <KpiCard
          icon={<AlertCircle size={15} />}
          label="Atrasadas"
          value={teamKpis.totalAtrasadas.toString()}
          tone={teamKpis.totalAtrasadas > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          icon={<Trophy size={15} />}
          label="Destaque"
          value={teamKpis.top?.user.nome.split(' ')[0] ?? '—'}
          subtitle={teamKpis.top ? `Score ${teamKpis.top.score}%` : ''}
          tone="brand"
        />
      </div>

      {/* Ranking geral */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border bg-bg-soft/40 px-5 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/15 text-brand-300">
            <Trophy size={15} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-100 leading-tight">
              Ranking geral
            </h3>
            <p className="text-[11px] text-muted leading-tight mt-0.5">
              {stats.length} colaboradores · ordenados por score
            </p>
          </div>
        </div>
        <CardBody className="p-4 space-y-3">
          {stats.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">
              Sem colaboradores aprovados.
            </p>
          ) : (
            stats.map((s, idx) => <PerformanceRow key={s.user.id} stats={s} rank={idx + 1} />)
          )}
        </CardBody>
      </Card>

      {/* Seções por cargo */}
      <CargoBreakdown stats={stats} />
    </div>
  )
}

function CargoBreakdown({ stats }: { stats: ColaboradorStats[] }) {
  const grupos = useMemo(() => {
    const map = new Map<Cargo, ColaboradorStats[]>()
    for (const s of stats) {
      const funcao = funcaoPrincipal(s.user)
      if (!funcao) continue
      const arr = map.get(funcao) ?? []
      arr.push(s)
      map.set(funcao, arr)
    }
    // Ordena dentro do cargo por score
    for (const arr of map.values()) {
      arr.sort((a, b) => b.score - a.score || b.concluidas - a.concluidas)
    }
    // Retorna cargos na ordem do CARGOS
    return CARGOS.filter((c) => (map.get(c) ?? []).length > 0).map((c) => ({
      cargo: c,
      pessoas: map.get(c) as ColaboradorStats[],
    }))
  }, [stats])

  if (grupos.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Performance por cargo
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-border via-border to-transparent" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {grupos.map(({ cargo, pessoas }) => (
          <CargoCard key={cargo} cargo={cargo} pessoas={pessoas} />
        ))}
      </div>
    </div>
  )
}

function CargoCard({ cargo, pessoas }: { cargo: Cargo; pessoas: ColaboradorStats[] }) {
  const accent = cargoAccent[cargo]
  const ehSocialMedia = cargo === 'social_media'
  const ehAM = cargo === 'account_manager' || cargo === 'gestor_trafego'
  const totalTarefas = pessoas.reduce((s, p) => s + p.total, 0)
  const totalConcluidas = pessoas.reduce((s, p) => s + p.concluidas, 0)
  const totalAtrasadas = pessoas.reduce((s, p) => s + p.atrasadas, 0)
  const scoreMedio =
    pessoas.length > 0
      ? Math.round(pessoas.reduce((s, p) => s + p.score, 0) / pessoas.length)
      : 0
  const labelSubtotal = ehSocialMedia
    ? 'no prazo'
    : ehAM
      ? 'tarefas próprias no prazo'
      : 'concluídas'
  const labelAtraso = ehSocialMedia
    ? `${totalAtrasadas} publicação(ões) fora do prazo no cargo`
    : ehAM
      ? `${totalAtrasadas} tarefa(s) própria(s) fora do prazo no cargo`
      : `${totalAtrasadas} tarefa(s) atrasada(s) no cargo`

  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between border-b border-border px-5 py-3',
          'bg-gradient-to-r from-bg-soft/80 via-bg-soft/40 to-transparent',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn('h-2.5 w-2.5 rounded-full shrink-0', accent.dot)}
            style={{ boxShadow: '0 0 8px currentColor' }}
          />
          <div>
            <h3 className={cn('text-[13px] font-semibold leading-tight', accent.text)}>
              {cargoLabel[cargo]}
            </h3>
            <p className="text-[11px] text-muted leading-tight mt-0.5">
              {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'} ·{' '}
              {totalConcluidas}/{totalTarefas} {labelSubtotal}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted uppercase tracking-wider">Score médio</p>
          <p
            className={cn(
              'text-lg font-bold tabular-nums',
              scoreMedio >= 80
                ? 'text-emerald-300'
                : scoreMedio >= 60
                ? 'text-lime-300'
                : scoreMedio >= 40
                ? 'text-amber-300'
                : 'text-red-300',
            )}
          >
            {scoreMedio}%
          </p>
        </div>
      </div>
      <CardBody className="p-3 space-y-2">
        {totalAtrasadas > 0 && (
          <div className="flex items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/5 px-2.5 py-1 text-[11px] text-red-300">
            <AlertCircle size={11} /> {labelAtraso}
          </div>
        )}
        {pessoas.map((p, idx) => (
          <CargoMemberRow key={p.user.id} stats={p} rank={idx + 1} />
        ))}
      </CardBody>
    </Card>
  )
}

function CargoMemberRow({ stats, rank }: { stats: ColaboradorStats; rank: number }) {
  const { user, total, concluidas, atrasadas, score, taxaPontualidade } = stats
  const ehSocialMedia = temCargo(user, 'social_media')
  const ehAM =
    temAlgumCargo(user, ['account_manager', 'gestor_trafego'])
  const ehTaxaSimples = ehSocialMedia || ehAM

  const scoreColor =
    score >= 80
      ? 'text-emerald-300'
      : score >= 60
      ? 'text-lime-300'
      : score >= 40
      ? 'text-amber-300'
      : 'text-red-300'
  const barColor =
    score >= 80
      ? 'bg-emerald-400'
      : score >= 60
      ? 'bg-lime-400'
      : score >= 40
      ? 'bg-amber-400'
      : 'bg-red-400'

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft/30 px-3 py-2 transition-colors hover:bg-bg-soft/60">
      <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-bg-elev text-[10px] font-bold text-muted shrink-0">
        {rank}
      </span>
      <Avatar name={user.nome} url={user.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-100 truncate">{user.nome}</p>
          <span className={cn('text-sm font-bold tabular-nums shrink-0', scoreColor)}>
            {score}%
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-bg-elev overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: total > 0 ? `${(concluidas / total) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] text-muted tabular-nums shrink-0">
            {concluidas}/{total}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px]">
          <span className="text-emerald-400/80">
            ✓ {Math.round(taxaPontualidade)}% {ehTaxaSimples ? 'no prazo' : 'pontualidade'}
          </span>
          {atrasadas > 0 ? (
            <span className="text-red-400/80">
              ⚠ {atrasadas} {ehTaxaSimples ? 'fora do prazo' : 'atrasada(s)'}
            </span>
          ) : (
            <span className="text-muted">— sem atrasos</span>
          )}
        </div>
      </div>
    </div>
  )
}

function PerformanceRow({ stats, rank }: { stats: ColaboradorStats; rank: number }) {
  const { user, total, concluidas, pendentes, atrasadas, noPrazo, score, taxaPontualidade, porFrequencia } =
    stats
  const ehSocialMedia = temCargo(user, 'social_media')
  const ehAM =
    temAlgumCargo(user, ['account_manager', 'gestor_trafego'])
  const ehTaxaSimples = ehSocialMedia || ehAM
  const barraTitulo = ehSocialMedia
    ? 'Publicações no prazo'
    : ehAM
      ? 'Tarefas próprias no prazo'
      : 'Tarefas concluídas'

  const scoreColor =
    score >= 80
      ? { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', bar: 'bg-emerald-400' }
      : score >= 60
      ? { text: 'text-lime-300', bg: 'bg-lime-500/15', border: 'border-lime-500/40', bar: 'bg-lime-400' }
      : score >= 40
      ? { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/40', bar: 'bg-amber-400' }
      : { text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/40', bar: 'bg-red-400' }

  const trendIcon =
    score >= 70 ? (
      <TrendingUp size={12} className="text-emerald-400" />
    ) : score >= 40 ? (
      <Minus size={12} className="text-amber-400" />
    ) : (
      <TrendingDown size={12} className="text-red-400" />
    )

  return (
    <div className="rounded-xl border border-border bg-bg-soft/40 p-4 transition-colors hover:bg-bg-soft/70">
      <div className="flex items-center gap-3">
        {/* Rank + avatar */}
        <div className="relative">
          <Avatar name={user.nome} url={user.avatar_url} size="md" />
          <span
            className={cn(
              'absolute -top-1.5 -left-1.5 grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold',
              rank === 1
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                : rank === 2
                ? 'border-zinc-400/70 bg-zinc-500/30 text-zinc-100'
                : rank === 3
                ? 'border-orange-400/70 bg-orange-700/30 text-orange-200'
                : 'border-border bg-bg-elev text-muted',
            )}
            title={`Posição ${rank}`}
          >
            {rank}
          </span>
        </div>

        {/* Nome + cargo */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-100 truncate">{user.nome}</p>
            {funcaoPrincipal(user) && (
              <Badge tone="neutral" className="text-[10px]">
                {cargoLabel[funcaoPrincipal(user)!]}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted truncate">{user.email}</p>
        </div>

        {/* Score */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5',
            scoreColor.bg,
            scoreColor.border,
          )}
        >
          {trendIcon}
          <span className={cn('text-base font-bold tabular-nums', scoreColor.text)}>{score}</span>
          <span className={cn('text-xs', scoreColor.text)}>%</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted mb-1">
          <span>{barraTitulo}</span>
          <span className="tabular-nums">
            {concluidas}/{total}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elev overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreColor.bar)}
            style={{ width: total > 0 ? `${(concluidas / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Mini-stats */}
      <div className={cn('mt-3 grid gap-2', ehTaxaSimples ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
        <Pill
          icon={<CheckCircle2 size={11} className="text-emerald-400" />}
          label="No prazo"
          value={noPrazo}
        />
        {!ehTaxaSimples && (
          <Pill
            icon={<CircleDot size={11} className="text-zinc-400" />}
            label="Pendentes"
            value={pendentes}
          />
        )}
        <Pill
          icon={<AlertCircle size={11} className="text-red-400" />}
          label={ehTaxaSimples ? 'Fora do prazo' : 'Atrasadas'}
          value={atrasadas}
          highlight={atrasadas > 0 ? 'danger' : undefined}
        />
        <Pill
          icon={<Target size={11} className="text-brand-300" />}
          label="Pontualidade"
          value={`${Math.round(taxaPontualidade)}%`}
        />
      </div>

      {/* Distribuição por frequência (visual sutil) */}
      {total > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
          {porFrequencia.diaria > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-500/25 bg-red-500/5 px-1.5 py-0.5 text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {porFrequencia.diaria} diária(s)
            </span>
          )}
          {porFrequencia.semanal > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/25 bg-orange-500/5 px-1.5 py-0.5 text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {porFrequencia.semanal} semanal(is)
            </span>
          )}
          {porFrequencia.mensal > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-pink-500/25 bg-pink-500/5 px-1.5 py-0.5 text-pink-300">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              {porFrequencia.mensal} mensal(is)
            </span>
          )}
          {porFrequencia.esporadica > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/40 px-1.5 py-0.5 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              {porFrequencia.esporadica} esporádica(s)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Pill({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  highlight?: 'danger'
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5',
        highlight === 'danger'
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-border bg-bg-soft/60',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-muted">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          'text-xs font-semibold tabular-nums',
          highlight === 'danger' ? 'text-red-300' : 'text-zinc-100',
        )}
      >
        {value}
      </span>
    </div>
  )
}

type KpiTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

const kpiToneStyles: Record<KpiTone, { box: string; iconBox: string; text: string }> = {
  neutral: {
    box: 'border-border',
    iconBox: 'border-border bg-bg-elev text-zinc-300',
    text: 'text-zinc-100',
  },
  brand: {
    box: 'border-brand-500/30',
    iconBox: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
    text: 'text-brand-200',
  },
  success: {
    box: 'border-emerald-500/30',
    iconBox: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    text: 'text-emerald-300',
  },
  warning: {
    box: 'border-amber-500/30',
    iconBox: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    text: 'text-amber-300',
  },
  danger: {
    box: 'border-red-500/30',
    iconBox: 'border-red-500/40 bg-red-500/10 text-red-300',
    text: 'text-red-300',
  },
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  tone: KpiTone
}) {
  const s = kpiToneStyles[tone]
  return (
    <Card className={cn('overflow-hidden', s.box)}>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums truncate', s.text)}>{value}</p>
          {subtitle && <p className="mt-0.5 text-[10.5px] text-muted truncate">{subtitle}</p>}
        </div>
        <div
          className={cn(
            'shrink-0 grid h-9 w-9 place-items-center rounded-lg border',
            s.iconBox,
          )}
        >
          {icon}
        </div>
      </CardBody>
    </Card>
  )
}
