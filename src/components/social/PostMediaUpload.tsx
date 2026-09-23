import { useMemo, useRef, useState } from 'react'
import { Upload, Image as ImageIcon, Film, X } from 'lucide-react'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import { getPostPub, setPostMedia, LIMITE_LEGENDA, type MidiaFinal } from './mockPosts'
import type { ItemSocialMedia } from '@/types/database'

interface Preview {
  name: string
  objectUrl: string
  isVideo: boolean
}

/**
 * "Mídia Final" + "Legenda Final" de um post.
 *
 * SIMULAÇÃO: não há storage real. Usamos `URL.createObjectURL` só pra preview
 * em memória e guardamos os NOMES dos arquivos em `midiaFinal.urls` (no lugar
 * das URLs que a API/Storage devolveria). Ao trocar pela integração real, aqui
 * é onde entra o upload pro bucket e o retorno das URLs públicas.
 */
export function PostMediaUpload({
  item,
  onChange,
}: {
  item: ItemSocialMedia
  onChange: () => void
}) {
  const inicial = useMemo(() => getPostPub(item.id), [item.id])
  const multiplo = item.formato === 'carrossel'
  const inputRef = useRef<HTMLInputElement>(null)

  const [midia, setMidia] = useState<MidiaFinal | undefined>(inicial.midiaFinal)
  const [previews, setPreviews] = useState<Preview[]>([])
  const [legenda, setLegenda] = useState(inicial.legendaFinal ?? '')

  function persist(m: MidiaFinal | undefined, l: string) {
    setPostMedia(item.id, m, l.trim() ? l : undefined)
    onChange()
  }

  function inferirTipo(ps: Preview[]): 'imagem' | 'video' {
    return ps.some((p) => p.isVideo) ? 'video' : 'imagem'
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const novos: Preview[] = Array.from(files).map((f) => ({
      name: f.name,
      objectUrl: URL.createObjectURL(f),
      isVideo: f.type.startsWith('video'),
    }))
    const proximos = multiplo ? [...previews, ...novos] : novos
    setPreviews(proximos)
    const m: MidiaFinal = { urls: proximos.map((p) => p.name), tipoArquivo: inferirTipo(proximos) }
    setMidia(m)
    persist(m, legenda)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removerPreview(idx: number) {
    const proximos = previews.filter((_, i) => i !== idx)
    setPreviews(proximos)
    const m: MidiaFinal | undefined = proximos.length
      ? { urls: proximos.map((p) => p.name), tipoArquivo: inferirTipo(proximos) }
      : undefined
    setMidia(m)
    persist(m, legenda)
  }

  function onLegenda(v: string) {
    // Bloqueia ao passar do limite (corta no máximo permitido).
    const val = v.slice(0, LIMITE_LEGENDA)
    setLegenda(val)
    persist(midia, val)
  }

  const restante = LIMITE_LEGENDA - legenda.length
  const noLimite = restante === 0
  // Nomes persistidos (reabertura) sem preview vivo em memória.
  const nomesPersistidos = previews.length === 0 ? midia?.urls ?? [] : []

  return (
    <div className="space-y-4">
      {/* Mídia final */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          <ImageIcon size={11} className="text-sky-300" />
          Mídia final {multiplo && <span className="text-muted/70">(carrossel — vários arquivos)</span>}
        </label>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-bg-soft/40 px-3 py-4 text-center transition-colors duration-150 hover:border-sky-500/40 hover:bg-bg-soft"
        >
          <Upload size={16} className="text-muted" />
          <span className="text-xs text-zinc-200">Selecionar arquivo{multiplo ? 's' : ''}</span>
          <span className="text-[10px] text-muted">imagem ou vídeo · preview em memória (simulado)</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple={multiplo}
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />

        {previews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {previews.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="group relative h-16 w-16 overflow-hidden rounded-md border border-border bg-bg-elev"
              >
                {p.isVideo ? (
                  <div className="grid h-full w-full place-items-center text-muted">
                    <Film size={18} />
                  </div>
                ) : (
                  <img src={p.objectUrl} alt={p.name} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removerPreview(i)}
                  className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded bg-black/70 text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  title="Remover"
                  aria-label="Remover arquivo"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {nomesPersistidos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nomesPersistidos.map((nome, i) => (
              <span
                key={`${nome}-${i}`}
                className="inline-flex items-center gap-1 rounded border border-border bg-bg-soft px-1.5 py-0.5 text-[10px] text-muted"
              >
                {midia?.tipoArquivo === 'video' ? <Film size={9} /> : <ImageIcon size={9} />}
                {nome}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Legenda final */}
      <div>
        <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
          Legenda final
        </label>
        <Textarea
          value={legenda}
          onChange={(e) => onLegenda(e.target.value)}
          maxLength={LIMITE_LEGENDA}
          placeholder="Escreva a legenda que vai junto da publicação…"
          className="min-h-[96px]"
        />
        <div className="mt-1 flex items-center justify-between">
          <span
            className={cn(
              'text-[10px] tabular-nums',
              noLimite ? 'text-amber-300' : restante <= 100 ? 'text-amber-300/80' : 'text-muted',
            )}
          >
            {legenda.length.toLocaleString('pt-BR')}/{LIMITE_LEGENDA.toLocaleString('pt-BR')}
          </span>
          {noLimite && (
            <span className="text-[10px] text-amber-300">Limite de caracteres atingido</span>
          )}
        </div>
      </div>
    </div>
  )
}
