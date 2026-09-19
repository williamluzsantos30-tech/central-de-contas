/**
 * Modal do MOTOR DE IMPORTAÇÃO de conteúdos do calendário.
 *
 * Cola uma lista de conteúdos estruturados (blocos rotulados ou planilha),
 * dá um preview do que vai virar item e, ao confirmar, cria os itens em lote
 * no planejamento do cliente — cada um no mês da sua DATA (cria o
 * planejamento do mês se ainda não existir). Reaproveita
 * producoes_social_media_items; não há entidade "Postagem" separada.
 */
import { useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, CalendarClock, FileWarning, Link2, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { parseConteudos, type CategoriaImport, type ItemParseado } from '@/lib/importarConteudos'
import type { Cliente, FormatoSocialMedia } from '@/types/database'

const EXEMPLO = `CATEGORIA: Reels
DATA: 22/09/2026
TÍTULO: 3 erros que travam seu financeiro
ROTEIRO: Abre com o gancho "todo mundo erra nisso"...
LEGENDA: Salva esse post pra não esquecer 👆
LINK DO DRIVE: https://drive.google.com/xxxxx

CATEGORIA: Carrossel
DATA: 24/09/2026
TÍTULO: Passo a passo do fluxo de caixa
CONTEÚDO: Slide 1: capa / Slide 2: ...
LEGENDA: PENDENTE

CATEGORIA: Backlog
TÍTULO: Depoimento cliente X
CONTEÚDO: Reserva pra semana sem gravação`

const catInfo: Record<CategoriaImport, { label: string; cls: string }> = {
  carrossel: { label: 'Carrossel', cls: 'border-brand-500/50 bg-brand-500/15 text-brand-200' },
  reel: { label: 'Reels', cls: 'border-pink-500/50 bg-pink-500/15 text-pink-200' },
  estatico: { label: 'Estático', cls: 'border-sky-500/50 bg-sky-500/15 text-sky-200' },
  backlog: { label: 'Backlog', cls: 'border-zinc-500/50 bg-zinc-500/15 text-zinc-300' },
}

type NovoItem = {
  producao_id: string
  formato: FormatoSocialMedia
  titulo: string
  ideia_conteudo: string | null
  legenda: string | null
  link_drive_video: string | null
  prazo: string | null
  status: 'pendente'
  ordem: number
  artes_prontas: string[]
  is_backlog: boolean
  observacoes: string | null
}

function labelMes(mes01: string): string {
  const [y, m] = mes01.split('-').map(Number)
  return new Date(y, m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

function dataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export function ImportarConteudosModal({
  open,
  onClose,
  cliente,
  mesISO,
  onImported,
}: {
  open: boolean
  onClose: () => void
  cliente: Cliente
  /** Mês selecionado no painel (YYYY-MM-01). Fallback pra itens sem data/backlog. */
  mesISO: string
  onImported: () => void
}) {
  const [raw, setRaw] = useState('')
  const [importing, setImporting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { itens, rejeitados } = useMemo(() => parseConteudos(raw), [raw])
  const comPendencia = itens.filter((i) => i.pendencias.length > 0).length

  async function planoIdParaMes(mes01: string): Promise<string> {
    const { data } = await supabase
      .from('producoes_social_media')
      .select('id')
      .eq('cliente_id', cliente.id)
      .eq('mes_referencia', mes01)
      .order('created_at', { ascending: true })
      .limit(1)
    if (data && data[0]) return data[0].id as string
    const titulo = `[${cliente.nome.toUpperCase()}] PLANEJAMENTO ${labelMes(mes01)}`
    const { data: novo, error } = await supabase
      .from('producoes_social_media')
      .insert({ cliente_id: cliente.id, titulo, mes_referencia: mes01, pilares: [], referencias: [] })
      .select('id')
      .single()
    if (error || !novo) throw error ?? new Error('Falha ao criar planejamento do mês.')
    return novo.id as string
  }

  async function baseOrdem(planoId: string): Promise<number> {
    const { data } = await supabase
      .from('producoes_social_media_items')
      .select('ordem')
      .eq('producao_id', planoId)
      .order('ordem', { ascending: false })
      .limit(1)
    return data && data[0] ? (data[0].ordem as number) : 0
  }

  async function importar() {
    if (itens.length === 0) return
    setImporting(true)
    setErro(null)
    try {
      // Agrupa por mês de destino (data do item; backlog/sem data -> mês atual).
      const grupos = new Map<string, ItemParseado[]>()
      for (const it of itens) {
        const mes01 = it.data ? `${it.data.slice(0, 7)}-01` : mesISO
        const arr = grupos.get(mes01)
        if (arr) arr.push(it)
        else grupos.set(mes01, [it])
      }

      const rows: NovoItem[] = []
      for (const [mes01, lista] of grupos) {
        const planoId = await planoIdParaMes(mes01)
        let ord = await baseOrdem(planoId)
        for (const it of lista) {
          ord += 1
          rows.push({
            producao_id: planoId,
            formato: it.formato,
            titulo: it.titulo,
            ideia_conteudo: it.conteudo,
            legenda: it.legenda,
            link_drive_video: it.linkDrive,
            prazo: it.data,
            status: 'pendente',
            ordem: ord,
            artes_prontas: [],
            is_backlog: it.isBacklog,
            observacoes: it.pendencias.length
              ? `⚠ Importado — pendências: ${it.pendencias.join(', ')}`
              : null,
          })
        }
      }

      const { error } = await supabase.from('producoes_social_media_items').insert(rows)
      if (error) throw error
      setRaw('')
      onImported()
      onClose()
    } catch (e) {
      setErro((e as Error)?.message ?? 'Falha ao importar os conteúdos.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Importar conteúdos · ${cliente.nome}`}
      className="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">
            {itens.length > 0 ? (
              <>
                <strong className="text-zinc-200">{itens.length}</strong> item(ns) prontos
                {comPendencia > 0 && <> · {comPendencia} com pendência</>}
                {rejeitados.length > 0 && (
                  <> · <span className="text-red-300">{rejeitados.length} rejeitado(s)</span></>
                )}
              </>
            ) : (
              'Cole os conteúdos pra ver o preview'
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={importing}>
              Cancelar
            </Button>
            <Button size="sm" onClick={importar} disabled={importing || itens.length === 0}>
              {importing ? 'Importando…' : `Importar ${itens.length || ''} item(ns)`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Instrução / mapeamento */}
        <div className="rounded-lg border border-border bg-bg-soft/40 p-3 text-[11px] leading-relaxed text-muted">
          <p className="mb-1 text-zinc-300">
            Cole uma lista de conteúdos — em <strong>blocos rotulados</strong> ou colando de uma{' '}
            <strong>planilha</strong> (com cabeçalho). Cada bloco vira um item do calendário.
          </p>
          <p>
            Rótulos: <code>CATEGORIA</code> · <code>DATA</code> · <code>TÍTULO/TEMA</code> ·{' '}
            <code>CONTEÚDO/ROTEIRO</code> · <code>LEGENDA</code> · <code>LINK DO DRIVE</code>. Categorias
            aceitas: <strong>Carrossel · Reels · Estático · Backlog</strong>. Campo{' '}
            <code>PENDENTE</code> cria o item e sinaliza a pendência.
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-wider text-muted">Conteúdos</label>
            {!raw && (
              <button
                type="button"
                onClick={() => setRaw(EXEMPLO)}
                className="text-[11px] text-brand-300 hover:underline"
              >
                usar exemplo
              </button>
            )}
          </div>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={EXEMPLO}
            className="font-mono text-xs"
          />
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Preview dos itens */}
        {itens.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted">
              Preview ({itens.length})
            </div>
            {itens.map((it, i) => (
              <ItemPreview key={i} item={it} />
            ))}
          </div>
        )}

        {/* Rejeitados */}
        {rejeitados.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-red-300">
              <FileWarning size={12} /> Rejeitados ({rejeitados.length})
            </div>
            {rejeitados.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-[11px] text-red-200/90"
              >
                <div className="font-medium">{r.motivo}</div>
                <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-muted">{r.raw}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function ItemPreview({ item }: { item: ItemParseado }) {
  const info = catInfo[item.categoria]
  const isReel = item.categoria === 'reel'
  return (
    <div className="rounded-lg border border-border bg-bg-soft/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            info.cls,
          )}
        >
          {info.label}
        </span>
        {item.data ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-300">
            <CalendarClock size={11} className="text-brand-300" />
            {dataBR(item.data)}
          </span>
        ) : item.isBacklog ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <Sparkles size={11} /> reserva (sem data)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
            <CalendarClock size={11} /> data pendente
          </span>
        )}
        <span className="truncate text-sm font-medium text-zinc-100">{item.titulo}</span>
      </div>

      {item.conteudo && (
        <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted">
          {item.conteudo}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
        {item.legenda && (
          <span className="inline-flex items-center gap-1 text-emerald-300/90">
            <CheckCircle2 size={10} /> legenda
          </span>
        )}
        {item.linkDrive && (
          <a
            href={item.linkDrive}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex items-center gap-1 hover:underline',
              isReel
                ? 'rounded border border-pink-500/50 bg-pink-500/15 px-1.5 py-0.5 font-semibold text-pink-200'
                : 'text-sky-300',
            )}
          >
            <Link2 size={10} /> {isReel ? 'LINK DO DRIVE' : 'link'}
          </a>
        )}
        {item.pendencias.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-200"
          >
            <AlertTriangle size={9} /> {p}
          </span>
        ))}
      </div>
    </div>
  )
}
