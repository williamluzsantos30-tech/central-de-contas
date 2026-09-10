import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  ExternalLink,
  Plus,
  X,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Pencil,
  FileDown,
  Send,
  Image as ImageIcon,
  Film,
  LayoutGrid,
  AlertCircle,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatDateBR } from '@/lib/dates'
import { useAuth } from '@/contexts/AuthContext'
import { PublicarItemBotao, PublicacaoInfo } from './PublicarItemDialog'
// PDF lib é pesada (~1.5MB), carrega só quando o user clica em "Baixar PDF"
// pra não inflar o bundle inicial.
//
// Chunk stale: quando o app fica aberto no browser durante um deploy novo,
// o nome do chunk lazy muda (hash diferente) e o import() falha com
// "Failed to fetch dynamically imported module". Nesse caso, a unica
// saida e recarregar a pagina — quando ela recarregar, vai baixar o
// index.html novo com o mapa correto de chunks e funciona. Detecto o
// erro pela mensagem, aviso o usuario e faco reload automatico.
async function downloadPlanejamentoPDFLazy(args: {
  cliente: Cliente
  plano: PlanejamentoSocialMedia
  items: ItemSocialMedia[]
}) {
  try {
    const mod = await import('./PlanejamentoPDF')
    return mod.downloadPlanejamentoPDF(args)
  } catch (err) {
    const msg = (err as Error)?.message ?? ''
    const eChunkStale =
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg) ||
      /error loading dynamically imported/i.test(msg)
    if (eChunkStale) {
      alert(
        'O sistema foi atualizado enquanto essa aba estava aberta. Vou recarregar a página pra pegar a versão nova — depois é só clicar em "Baixar PDF" de novo.',
      )
      window.location.reload()
      // Nunca chega aqui — reload substitui a pagina inteira. Return so
      // pra o TS parar de reclamar do fluxo.
      return
    }
    throw err
  }
}
import type {
  Cliente,
  FormatoSocialMedia,
  ItemSocialMedia,
  PlanejamentoSocialMedia,
} from '@/types/database'

interface Props {
  cliente: Cliente
  planejamentos: PlanejamentoSocialMedia[]
  items: ItemSocialMedia[]
  onChanged: () => void
}

const PILARES_SUGERIDOS = [
  'conexão',
  'objeções',
  'autoridade',
  'educacional',
  'institucional',
  'oferta',
  'transformação',
  'prova social',
]

const formatosLista: { key: FormatoSocialMedia; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'carrossel', label: 'Carrosséis', icon: LayoutGrid },
  { key: 'estatico', label: 'Estáticos', icon: ImageIcon },
  { key: 'reel', label: 'Reels', icon: Film },
]

export function PlanejamentoMensalPanel({ cliente, planejamentos, items, onChanged }: Props) {
  const [mesISO, setMesISO] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })

  const planoDoMes = useMemo(
    () =>
      planejamentos.find(
        (p) => p.mes_referencia && p.mes_referencia.slice(0, 7) === mesISO.slice(0, 7),
      ) ?? null,
    [planejamentos, mesISO],
  )

  const itemsDoMes = useMemo(() => {
    if (!planoDoMes) return []
    return items
      .filter((i) => i.producao_id === planoDoMes.id)
      .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '') || a.ordem - b.ordem)
  }, [items, planoDoMes])

  function shiftMes(delta: number) {
    const [y, m] = mesISO.split('-').map(Number)
    const novaData = new Date(y, m - 1 + delta, 1)
    setMesISO(`${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const mesLabel = formatDateBR(mesISO, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Header com seletor + ações principais */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => shiftMes(-1)}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:border-pink-500/40 hover:text-pink-300"
        >
          <ChevronLeft size={14} />
        </button>
        <h2 className="px-2 text-lg font-semibold capitalize">{mesLabel}</h2>
        <button
          onClick={() => shiftMes(1)}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:border-pink-500/40 hover:text-pink-300"
        >
          <ChevronRight size={14} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          {planoDoMes ? (
            <>
              <Badge tone={planoDoMes.aprovado_em ? 'success' : 'warning'}>
                {planoDoMes.aprovado_em ? '✓ Aprovado' : 'Aguardando aprovação'}
              </Badge>
              <BaixarPDFButton cliente={cliente} plano={planoDoMes} items={itemsDoMes} />
            </>
          ) : (
            <Badge tone="neutral">Sem planejamento</Badge>
          )}
        </div>
      </div>

      {!planoDoMes ? (
        <SemPlano cliente={cliente} mesISO={mesISO} mesLabel={mesLabel} onCreated={onChanged} />
      ) : (
        <>
          <DatasAprovacao plano={planoDoMes} onChanged={onChanged} />
          <IntroCadencia plano={planoDoMes} onChanged={onChanged} />
          <EstrategiaPanel plano={planoDoMes} onChanged={onChanged} />
          <IdeiasPorFormato plano={planoDoMes} items={itemsDoMes} onChanged={onChanged} />
        </>
      )}
    </div>
  )
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function BaixarPDFButton({
  cliente,
  plano,
  items,
}: {
  cliente: Cliente
  plano: PlanejamentoSocialMedia
  items: ItemSocialMedia[]
}) {
  const [loading, setLoading] = useState(false)
  async function gerar() {
    setLoading(true)
    try {
      await downloadPlanejamentoPDFLazy({ cliente, plano, items })
    } catch (err) {
      alert('Falha ao gerar PDF: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={gerar} disabled={loading}>
      <FileDown size={13} />
      {loading ? 'Gerando...' : 'Baixar PDF'}
    </Button>
  )
}

function SemPlano({
  cliente,
  mesISO,
  mesLabel,
  onCreated,
}: {
  cliente: Cliente
  mesISO: string
  mesLabel: string
  onCreated: () => void
}) {
  const [creating, setCreating] = useState(false)

  async function criar() {
    setCreating(true)
    const titulo = `[${cliente.nome.toUpperCase()}] PLANEJAMENTO ${mesLabel.toUpperCase()}`
    await supabase.from('producoes_social_media').insert({
      cliente_id: cliente.id,
      titulo,
      mes_referencia: mesISO,
      pilares: [],
      referencias: [],
    })
    setCreating(false)
    onCreated()
  }

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
        <Calendar size={36} className="text-muted" />
        <h3 className="text-base font-semibold">Sem planejamento pra {mesLabel}</h3>
        <p className="max-w-md text-sm text-muted">
          Crie o planejamento pra começar a montar o documento estratégico do mês.
        </p>
        <Button onClick={criar} disabled={creating}>
          <Plus size={14} /> {creating ? 'Criando...' : 'Criar planejamento'}
        </Button>
      </CardBody>
    </Card>
  )
}

function DatasAprovacao({
  plano,
  onChanged,
}: {
  plano: PlanejamentoSocialMedia
  onChanged: () => void
}) {
  const { profile } = useAuth()
  const [data, setData] = useState(plano.data_envio_aprovacao ?? '')
  const [savingField, setSavingField] = useState<string | null>(null)

  useEffect(() => setData(plano.data_envio_aprovacao ?? ''), [plano.data_envio_aprovacao])

  async function saveField(field: string, value: unknown) {
    setSavingField(field)
    await supabase.from('producoes_social_media').update({ [field]: value }).eq('id', plano.id)
    setSavingField(null)
    onChanged()
  }

  async function toggleAprovado() {
    const aprovando = !plano.aprovado_em
    const novoValor = aprovando ? new Date().toISOString() : null
    await saveField('aprovado_em', novoValor)
    if (aprovando) {
      alert(
        '✓ Planejamento aprovado!\n\nAs ideias agora aparecem na esteira de produção em Operacional Webdesign · Produção social media.',
      )
    }
  }

  const hojeStr = new Date().toISOString().slice(0, 10)
  const dataPassou = data && data < hojeStr && !plano.aprovado_em

  return (
    <Card>
      <CardBody className="grid gap-4 md:grid-cols-2">
        {/* Data de envio pra aprovação */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
            <Send size={12} className="text-pink-300" />
            Data de envio para aprovação
            {savingField === 'data_envio_aprovacao' && (
              <span className="text-[10px] normal-case opacity-70">salvando...</span>
            )}
          </div>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            onBlur={() =>
              data !== (plano.data_envio_aprovacao ?? '') &&
              saveField('data_envio_aprovacao', data || null)
            }
          />
          {data && (
            <p
              className={cn(
                'mt-1 text-[10px]',
                dataPassou ? 'text-red-300' : 'text-muted',
              )}
            >
              {dataPassou
                ? `⚠️ Data passou e o planejamento ainda não foi aprovado`
                : `Será enviado em ${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}`}
            </p>
          )}
        </div>

        {/* Status de aprovação */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
            <CheckCircle2 size={12} className="text-pink-300" />
            Aprovação do cliente
            {savingField === 'aprovado_em' && (
              <span className="text-[10px] normal-case opacity-70">salvando...</span>
            )}
          </div>
          {plano.aprovado_em ? (
            <div className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-emerald-200">✓ Aprovado</p>
                <p className="text-[10px] text-emerald-300/80">
                  {new Date(plano.aprovado_em).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={toggleAprovado}>
                Reabrir
              </Button>
            </div>
          ) : (
            <Button onClick={toggleAprovado} className="w-full" disabled={!profile}>
              <CheckCircle2 size={14} /> Marcar como aprovado
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function IntroCadencia({
  plano,
  onChanged,
}: {
  plano: PlanejamentoSocialMedia
  onChanged: () => void
}) {
  const [intro, setIntro] = useState(plano.texto_introducao ?? '')
  const [cadencia, setCadencia] = useState(plano.cadencia ?? '')
  const [savingField, setSavingField] = useState<string | null>(null)

  useEffect(() => {
    setIntro(plano.texto_introducao ?? '')
    setCadencia(plano.cadencia ?? '')
  }, [plano])

  async function saveField(field: string, value: unknown) {
    setSavingField(field)
    await supabase.from('producoes_social_media').update({ [field]: value }).eq('id', plano.id)
    setSavingField(null)
    onChanged()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={14} className="text-pink-300" />
          Introdução do planejamento
        </CardTitle>
        <span className="text-[10px] text-muted">
          {savingField ? 'salvando...' : 'aparece na página 2 do PDF'}
        </span>
      </CardHeader>
      <CardBody className="space-y-3">
        <Textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          onBlur={() =>
            intro !== (plano.texto_introducao ?? '') &&
            saveField('texto_introducao', intro || null)
          }
          placeholder="Ex: 'Trabalharemos com um funil de conteúdo, intercalando entre Conexão, Objeções e Autoridade...'"
          className="min-h-[120px] text-sm leading-relaxed"
        />
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Cadência de postagens
          </label>
          <Input
            value={cadencia}
            onChange={(e) => setCadencia(e.target.value)}
            onBlur={() =>
              cadencia !== (plano.cadencia ?? '') && saveField('cadencia', cadencia || null)
            }
            placeholder="Ex: '3 posts/semana — Seg, Qua e Sex'"
          />
        </div>
      </CardBody>
    </Card>
  )
}

function EstrategiaPanel({
  plano,
  onChanged,
}: {
  plano: PlanejamentoSocialMedia
  onChanged: () => void
}) {
  const [tema, setTema] = useState(plano.tema_mes ?? '')
  const [pilares, setPilares] = useState<string[]>(plano.pilares ?? [])
  const [novoPilar, setNovoPilar] = useState('')
  const [savingField, setSavingField] = useState<string | null>(null)

  useEffect(() => {
    setTema(plano.tema_mes ?? '')
    setPilares(plano.pilares ?? [])
  }, [plano])

  async function saveField(field: string, value: unknown) {
    setSavingField(field)
    await supabase.from('producoes_social_media').update({ [field]: value }).eq('id', plano.id)
    setSavingField(null)
    onChanged()
  }

  function togglePilar(p: string) {
    const novo = pilares.includes(p) ? pilares.filter((x) => x !== p) : [...pilares, p]
    setPilares(novo)
    saveField('pilares', novo)
  }

  function addPilarCustom() {
    const p = novoPilar.trim().toLowerCase()
    if (!p || pilares.includes(p)) return
    const novo = [...pilares, p]
    setPilares(novo)
    setNovoPilar('')
    saveField('pilares', novo)
  }

  function removePilar(p: string) {
    const novo = pilares.filter((x) => x !== p)
    setPilares(novo)
    saveField('pilares', novo)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target size={14} className="text-pink-300" />
            Tema do mês
          </CardTitle>
          <span className="text-[10px] text-muted">{savingField === 'tema_mes' ? 'salvando...' : ''}</span>
        </CardHeader>
        <CardBody>
          <Input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            onBlur={() => tema !== (plano.tema_mes ?? '') && saveField('tema_mes', tema || null)}
            placeholder='"Lançamento Bariátrica humanizada", "Outubro Rosa"...'
            className="text-base"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles size={14} className="text-pink-300" />
            Pilares de conteúdo
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {pilares.length === 0 ? (
            <p className="text-xs text-muted">Nenhum pilar selecionado.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pilares.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-md border border-pink-500/40 bg-pink-500/15 px-2 py-1 text-xs text-pink-200"
                >
                  {p}
                  <button
                    onClick={() => removePilar(p)}
                    className="rounded p-0.5 hover:bg-pink-500/20"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Sugestões</p>
            <div className="flex flex-wrap gap-1.5">
              {PILARES_SUGERIDOS.filter((p) => !pilares.includes(p)).map((p) => (
                <button
                  key={p}
                  onClick={() => togglePilar(p)}
                  className="rounded-md border border-border bg-bg-soft px-2 py-1 text-xs text-zinc-300 hover:border-pink-500/40 hover:text-pink-300"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={novoPilar}
              onChange={(e) => setNovoPilar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPilarCustom()}
              placeholder="Adicionar pilar customizado"
              className="text-xs"
            />
            <Button size="sm" variant="outline" onClick={addPilarCustom} disabled={!novoPilar.trim()}>
              <Plus size={11} />
            </Button>
          </div>
        </CardBody>
      </Card>

    </div>
  )
}

function IdeiasPorFormato({
  plano,
  items,
  onChanged,
}: {
  plano: PlanejamentoSocialMedia
  items: ItemSocialMedia[]
  onChanged: () => void
}) {
  // Backlog = items com flag is_backlog=true, agrupados aparte. Nao
  // entram nas contagens de Carrossel/Estatico/Reel pra nao poluir
  // metricas do calendario.
  const backlog = items.filter((i) => i.is_backlog)

  return (
    <div className="space-y-4">
      {formatosLista.map(({ key, label, icon: Icon }) => {
        const itens = items.filter((i) => i.formato === key && !i.is_backlog)
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon size={14} className="text-pink-300" />
                {label} ({itens.length})
              </CardTitle>
              <NovaIdeiaButton plano={plano} formato={key} ordemSugerida={items.length + 1} onCreated={onChanged} />
            </CardHeader>
            <CardBody className="space-y-2">
              {itens.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">
                  Nenhum {label.toLowerCase().replace(/s$/, '')} planejado ainda.
                </p>
              ) : (
                itens.map((it) => <IdeiaCard key={it.id} item={it} onChanged={onChanged} />)
              )}
            </CardBody>
          </Card>
        )
      })}

      {/* Backlog — reserva de conteudos estaticos pra publicar se o
          cliente nao gravar os videos. Nao aparece no calendario nem
          pro cliente. Migration 075. */}
      <Card className="border-amber-500/30 bg-amber-500/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive size={14} className="text-amber-300" />
            Backlog ({backlog.length})
            <span className="text-[10px] font-normal text-muted normal-case">
              — reserva pra publicar caso o cliente não grave os vídeos
            </span>
          </CardTitle>
          <NovaIdeiaButton
            plano={plano}
            formato="estatico"
            ordemSugerida={items.length + 1}
            isBacklog
            onCreated={onChanged}
          />
        </CardHeader>
        <CardBody className="space-y-2">
          {backlog.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">
              Nenhum conteúdo no backlog. Use quando quiser deixar algo
              pronto pra publicar sem depender de gravação do cliente.
            </p>
          ) : (
            backlog.map((it) => <IdeiaCard key={it.id} item={it} onChanged={onChanged} />)
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function NovaIdeiaButton({
  plano,
  formato,
  ordemSugerida,
  onCreated,
  isBacklog = false,
}: {
  plano: PlanejamentoSocialMedia
  formato: FormatoSocialMedia
  ordemSugerida: number
  onCreated: () => void
  isBacklog?: boolean
}) {
  const [creating, setCreating] = useState(false)
  async function criar() {
    setCreating(true)
    await supabase.from('producoes_social_media_items').insert({
      producao_id: plano.id,
      formato,
      titulo: isBacklog ? 'Novo backlog' : 'Nova ideia',
      ideia_conteudo: '',
      status: 'pendente',
      ordem: ordemSugerida,
      artes_prontas: [],
      is_backlog: isBacklog,
    })
    setCreating(false)
    onCreated()
  }
  return (
    <Button size="sm" variant="outline" onClick={criar} disabled={creating}>
      <Plus size={12} /> {creating ? 'Criando...' : 'Adicionar'}
    </Button>
  )
}

function IdeiaCard({ item, onChanged }: { item: ItemSocialMedia; onChanged: () => void }) {
  const [editing, setEditing] = useState(item.titulo === 'Nova ideia')
  const [headline, setHeadline] = useState(item.titulo)
  const [ideia, setIdeia] = useState(item.ideia_conteudo ?? '')
  const [copy, setCopy] = useState(item.copy_texto ?? '')
  const [legenda, setLegenda] = useState(item.legenda ?? '')
  const [prazo, setPrazo] = useState(item.prazo?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setHeadline(item.titulo)
    setIdeia(item.ideia_conteudo ?? '')
    setCopy(item.copy_texto ?? '')
    setLegenda(item.legenda ?? '')
    setPrazo(item.prazo?.slice(0, 10) ?? '')
  }, [item])

  async function save() {
    setSaving(true)
    await supabase
      .from('producoes_social_media_items')
      .update({
        titulo: headline.trim() || 'Sem título',
        ideia_conteudo: ideia.trim() || null,
        copy_texto: copy.trim() || null,
        legenda: legenda.trim() || null,
        prazo: prazo || null,
      })
      .eq('id', item.id)
    setSaving(false)
    setEditing(false)
    onChanged()
  }

  async function excluir() {
    if (!confirm('Excluir essa ideia?')) return
    await supabase.from('producoes_social_media_items').delete().eq('id', item.id)
    onChanged()
  }

  /** Move um item entre Backlog e planejamento ativo. Confirma antes
   *  pra evitar clique acidental — mover ativa/desativa o item na
   *  esteira e no calendario, e' uma acao com efeito visivel. */
  async function toggleBacklog() {
    const proxState = !item.is_backlog
    const msg = proxState
      ? 'Mover pro Backlog? O item sai do planejamento ativo e não aparece no calendário/link do cliente até você trazê-lo de volta.'
      : 'Trazer do Backlog pro planejamento ativo? Lembra de definir a data de postagem depois — sem prazo, o cliente ainda não vê no link.'
    if (!confirm(msg)) return
    await supabase
      .from('producoes_social_media_items')
      .update({ is_backlog: proxState })
      .eq('id', item.id)
    onChanged()
  }

  const today = new Date().toISOString().slice(0, 10)
  const atrasada = item.status !== 'conclusao' && item.prazo && item.prazo.slice(0, 10) < today

  if (editing) {
    return (
      <div className="rounded-lg border border-pink-500/40 bg-bg-soft p-3 space-y-2.5">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Headline (título do post)
          </label>
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder='Ex: "Prazer, sou a Dra. Maria Adélia. Que bom ter você aqui."'
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Ideia do conteúdo
          </label>
          <Textarea
            value={ideia}
            onChange={(e) => setIdeia(e.target.value)}
            placeholder="Ex: 'Se apresentar, gerar autoridade e conexão contando sua trajetória. Este carrossel ficará fixado no perfil.'"
            className="min-h-[70px] text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Copy do post — texto dos slides / arte
          </label>
          <Textarea
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            placeholder={'Slide 1:\n...\n\nSlide 2:\n...\n\nSlide 3:\n...'}
            className="min-h-[120px] text-sm font-mono"
          />
          <p className="mt-1 text-[10px] text-muted">
            Texto que vai <b>DENTRO</b> da arte (slides do carrossel, script do reel).
            Aparece em "Texto da copy" na esteira de produção.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-sky-300/80">
            Legenda do post (caption do Instagram)
          </label>
          <Textarea
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder={
              'Ex.: Você sabia que 3 em cada 5 pacientes...\n\nComenta aqui se já ouviu esse diagnóstico ✋\n\n#dorlombar #ortopedia'
            }
            className="min-h-[100px] text-sm border-sky-500/30 focus:border-sky-500/60"
          />
          <p className="mt-1 text-[10px] text-muted">
            Texto que vai <b>FORA</b> da arte (descrição do post no Instagram).
            Aparece no link público do calendário quando o item estiver em aprovação/concluído.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Data de postagem
          </label>
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !headline.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group rounded-md border bg-bg-soft p-3 hover:border-pink-500/40',
        atrasada ? 'border-red-500/30' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-zinc-100 text-sm leading-snug">{item.titulo}</p>
            <div className="flex flex-shrink-0 items-center gap-1">
              {/* Badge de formato — so em backlog. Nas secoes de formato
                  o dado ja e implicito pelo container, aqui e util. */}
              {item.is_backlog && (
                <Badge tone="neutral" className="!text-[9px] capitalize">
                  {item.formato}
                </Badge>
              )}
              {atrasada && !item.publicado_em && (
                <Badge tone="danger" className="!text-[9px]">
                  atrasado
                </Badge>
              )}
            </div>
          </div>
          {item.ideia_conteudo && (
            <p className="mt-1 text-xs text-muted leading-relaxed">{item.ideia_conteudo}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
            {item.prazo && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={10} />
                {formatDateBR(item.prazo, {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
            )}
            {item.copy_texto && (
              <span
                className="inline-flex items-center gap-1 text-pink-300"
                title="Copy do post (texto dos slides) preenchida"
              >
                <Sparkles size={10} />
                copy
              </span>
            )}
            {item.legenda && (
              <span
                className="inline-flex items-center gap-1 text-sky-300"
                title="Legenda (caption do Instagram) preenchida"
              >
                <Sparkles size={10} />
                legenda
              </span>
            )}
            <span className="capitalize">· {item.status.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          <PublicarItemBotao item={item} onChanged={onChanged} compact />
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-pink-300"
              title="Editar"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={toggleBacklog}
              className="rounded p-1.5 text-muted hover:bg-bg-elev hover:text-amber-300"
              title={item.is_backlog ? 'Trazer pro planejamento ativo' : 'Mover pro Backlog'}
            >
              {item.is_backlog ? <ArchiveRestore size={12} /> : <Archive size={12} />}
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
      </div>
      <PublicacaoInfo item={item} />
    </div>
  )
}
