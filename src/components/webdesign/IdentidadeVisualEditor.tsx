import { useState } from 'react'
import { ExternalLink, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Props {
  urls: string[]
  onAdd: (url: string) => void
  onRemove: (index: number) => void
  onUpload: (files: FileList | null) => void
  busy?: boolean
}

/**
 * Editor multi-arquivo de Identidade Visual — usado em
 * CriativosWebdesign, ProjetosWebdesign e SocialMedia.
 * Mostra um input de URL + botão de upload + grid de previews.
 */
export function IdentidadeVisualEditor({ urls, onAdd, onRemove, onUpload, busy }: Props) {
  const [novaUrl, setNovaUrl] = useState('')

  function add() {
    const u = novaUrl.trim()
    if (!u) return
    onAdd(u)
    setNovaUrl('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={novaUrl}
          onChange={(e) => setNovaUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Cole um URL e Enter, OU use Upload ao lado"
          className="flex-1 min-w-[200px]"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!novaUrl.trim()}>
          <Plus size={12} /> URL
        </Button>
        <UploadMultiplo onUpload={onUpload} busy={busy} />
      </div>

      {urls.length === 0 ? (
        <p className="text-xs text-muted">Nenhum arquivo anexado ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="group relative overflow-hidden rounded-lg border border-border bg-bg-soft"
            >
              {isImageUrl(url) ? (
                <img
                  src={url}
                  alt={`identidade ${i + 1}`}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="flex h-24 items-center justify-center px-2 text-center text-[10px] text-muted">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline hover:text-zinc-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shortUrl(url)}
                  </a>
                </div>
              )}
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remover"
              >
                <X size={10} />
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Abrir"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={10} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function isImageUrl(url: string): boolean {
  return (
    /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url) ||
    /images\.unsplash\.com/i.test(url)
  )
}

function shortUrl(url: string): string {
  if (url.length <= 40) return url
  return `${url.slice(0, 30)}...${url.slice(-7)}`
}

function UploadMultiplo({
  onUpload,
  busy,
}: {
  onUpload: (files: FileList | null) => void
  busy?: boolean
}) {
  return (
    <label
      className={
        'inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border px-3 text-xs text-zinc-200 hover:bg-bg-elev ' +
        (busy ? 'opacity-50 pointer-events-none' : '')
      }
    >
      <input
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onUpload(e.target.files)}
      />
      {busy ? 'Enviando...' : '↑ Upload'}
    </label>
  )
}
