import type { Ativo, TipoAtivo } from '@/types/database'
import { cn, statusAtivoColor, statusAtivoLabel, tipoAtivoLabel, TIPOS_ATIVO } from '@/lib/utils'

/**
 * Abreviação de 3 letras pra exibir dentro do indicador.
 * Mantém a posição fixa (Pixel, GA4, GMN, Bio, Pub) — combina com a
 * legenda renderizada uma vez pela <AtivoHealthLegenda />.
 */
export const tipoAtivoSigla: Record<TipoAtivo, string> = {
  meta_pixel: 'PIX',
  ga4: 'GA4',
  google_meu_negocio: 'GMN',
  bio_estruturada: 'BIO',
  publicos_meta_ads: 'PUB',
}

/**
 * Texto fica branco em fundo escuro/saturado, e preto no amarelo
 * (configurado) pra manter contraste WCAG.
 */
const statusAtivoTextColor: Record<string, string> = {
  pendente: 'text-zinc-300',
  configurado: 'text-zinc-900',
  funcional: 'text-emerald-50',
  com_problema: 'text-red-50',
}

export function AtivoHealth({ ativos }: { ativos: Ativo[] }) {
  const byTipo = new Map(ativos.map((a) => [a.tipo, a]))
  return (
    <div className="flex items-center gap-1">
      {TIPOS_ATIVO.map((tipo) => {
        const a = byTipo.get(tipo)
        const bg = a ? statusAtivoColor[a.status] : 'bg-zinc-700'
        const fg = a ? statusAtivoTextColor[a.status] : 'text-zinc-400'
        const label = `${tipoAtivoLabel[tipo]}: ${a ? statusAtivoLabel[a.status] : 'Não iniciado'}`
        return (
          <span
            key={tipo}
            title={label}
            className={cn(
              'inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-none tracking-wider',
              bg,
              fg,
            )}
          >
            {tipoAtivoSigla[tipo]}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Legenda compacta dos 5 ativos + significado das cores.
 * Use uma vez no topo da seção que lista vários AtivoHealth.
 */
export function AtivoHealthLegenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
      <span className="font-semibold uppercase tracking-wider text-zinc-300">Legenda:</span>
      {TIPOS_ATIVO.map((tipo) => (
        <span key={tipo} className="inline-flex items-center gap-1">
          <span className="inline-flex h-3.5 items-center justify-center rounded-sm bg-bg-elev px-1 text-[8px] font-bold tracking-wider text-zinc-200">
            {tipoAtivoSigla[tipo]}
          </span>
          <span>{tipoAtivoLabel[tipo]}</span>
        </span>
      ))}
      <span className="ml-2 inline-flex items-center gap-2 border-l border-border pl-3">
        <LegendaCor cor="bg-emerald-500" label="Funcional" />
        <LegendaCor cor="bg-yellow-500" label="Configurado" />
        <LegendaCor cor="bg-red-500" label="Com problema" />
        <LegendaCor cor="bg-zinc-700" label="Pendente / Não iniciado" />
      </span>
    </div>
  )
}

function LegendaCor({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('h-2 w-2 rounded-full', cor)} />
      <span>{label}</span>
    </span>
  )
}
