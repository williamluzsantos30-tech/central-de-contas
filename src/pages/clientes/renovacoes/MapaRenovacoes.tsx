/**
 * Mapa de renovações — cada cliente é um ponto: X = dias até vencer (vencidos
 * à esquerda), faixa = risco do cliente (semáforo), tamanho = MRR. O canto
 * superior esquerdo (crítico + vencendo) é onde agir primeiro.
 *
 * HTML posicionado em % (não SVG com viewBox) pra os textos não esticarem.
 * Pontos com anel de 2px na cor do fundo (sobreposição legível) e alvo de
 * hover ≥ 20px; tooltip por ponto; clique abre o contrato na Ficha.
 */
import { useMemo, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { FAIXAS, RISCO_COR, faixaDe, fmtBRL0, textoDias } from './faixasRenovacao'
import type { LinhaRenovacao } from './useRenovacoesData'

const MIN = -30
const MAX = 180
const pos = (dias: number) => ((Math.min(MAX, Math.max(MIN, dias)) - MIN) / (MAX - MIN)) * 100

/** Zonas de fundo = faixas de urgência (tinta bem leve, mesma cor da faixa). */
const ZONAS = [
  { de: MIN, ate: 0, faixa: 'vencido' },
  { de: 0, ate: 15, faixa: 'ate15' },
  { de: 15, ate: 30, faixa: 'ate30' },
  { de: 90, ate: MAX, faixa: 'emDia' },
] as const
const MARCAS = [
  { dias: MIN, label: `${MIN}d` },
  { dias: 0, label: 'hoje' },
  { dias: 15, label: '15d' },
  { dias: 30, label: '30d' },
  { dias: 90, label: '90d' },
  { dias: MAX, label: `${MAX}d+` },
]
const RAIAS = (['vermelho', 'laranja', 'amarelo', 'verde'] as const).map((k) => ({ key: k, ...RISCO_COR[k] }))
const ALTURA_RAIA = 44

/** Desloca pontos colados na vertical, de forma estável (por id). */
function jitter(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 13) - 6
}

export function MapaRenovacoes({ linhas, onAbrir }: { linhas: LinhaRenovacao[]; onAbrir: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const maxMrr = Math.max(1, ...linhas.map((l) => l.mrr))
  // Maiores primeiro → os pequenos ficam por cima e continuam clicáveis.
  const pontos = useMemo(() => [...linhas].sort((a, b) => b.mrr - a.mrr), [linhas])
  const hovered = linhas.find((l) => l.id === hover)

  return (
    <section className="rounded-xl border border-border bg-bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Mapa de renovações</h3>
          <p className="mt-0.5 text-[11px] text-muted">Risco do cliente × dias até vencer — o canto superior esquerdo é renovar já.</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-400" />
            <span className="h-3.5 w-3.5 rounded-full bg-zinc-400" /> tamanho = MRR
          </span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick size={11} /> clique abre o contrato
          </span>
        </div>
      </div>

      <div className="flex">
        {/* Rótulos das raias (risco) */}
        <div className="w-20 shrink-0">
          {RAIAS.map((r) => (
            <div key={r.key} className="flex items-center gap-1.5 text-[11px] text-zinc-300" style={{ height: ALTURA_RAIA }}>
              <span className="h-2 w-2 rounded-full" style={{ background: r.cor }} />
              {r.label}
            </div>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Plot */}
          <div className="relative overflow-visible rounded-md border border-border" style={{ height: ALTURA_RAIA * RAIAS.length }}>
            {ZONAS.map((z) => {
              const cor = FAIXAS.find((f) => f.id === z.faixa)!.cor
              return (
                <div
                  key={z.faixa}
                  className="absolute inset-y-0"
                  style={{ left: `${pos(z.de)}%`, width: `${pos(z.ate) - pos(z.de)}%`, background: `${cor}${z.faixa === 'emDia' ? '0d' : '17'}` }}
                />
              )
            })}
            {RAIAS.slice(0, -1).map((r, i) => (
              <div key={r.key} className="absolute inset-x-0 border-b border-border/50" style={{ top: ALTURA_RAIA * (i + 1) }} />
            ))}
            {MARCAS.slice(1, -1).map((m) => (
              <div key={m.dias} className="absolute inset-y-0 border-l border-dashed border-border" style={{ left: `${pos(m.dias)}%` }} />
            ))}
            <span className="pointer-events-none absolute left-1.5 top-1 text-[9px] font-semibold uppercase tracking-wider text-muted">
              agir já
            </span>

            {pontos.map((l) => {
              const raia = RISCO_COR[l.semaforo ?? 'verde']
              const d = 10 + 12 * Math.sqrt(l.mrr / maxMrr)
              const alvo = Math.max(20, d)
              const ativo = hover === l.id
              return (
                <button
                  key={l.id}
                  type="button"
                  onMouseEnter={() => setHover(l.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(l.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => onAbrir(l.id)}
                  aria-label={`${l.nome}: ${textoDias(l.diasRestantes)}, ${fmtBRL0(l.mrr)} por mês, semáforo ${raia.label}`}
                  className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center focus:outline-none"
                  style={{
                    left: `${pos(l.diasRestantes)}%`,
                    top: ALTURA_RAIA * raia.ordem + ALTURA_RAIA / 2 + jitter(l.id),
                    width: alvo,
                    height: alvo,
                    zIndex: ativo ? 20 : 1,
                  }}
                >
                  <span
                    className="rounded-full transition-transform"
                    style={{
                      width: d,
                      height: d,
                      background: raia.cor,
                      boxShadow: ativo
                        ? '0 0 0 2px rgb(var(--bg-card)), 0 0 0 4px rgb(139 92 246 / 0.8)'
                        : '0 0 0 2px rgb(var(--bg-card))',
                    }}
                  />
                </button>
              )
            })}

            {/* Tooltip do ponto em foco */}
            {hovered && (
              <div
                className="pointer-events-none absolute z-30 w-56 rounded-lg border border-border bg-bg-elev p-2.5 text-[11px] shadow-xl"
                style={{
                  left: `${pos(hovered.diasRestantes)}%`,
                  top: ALTURA_RAIA * RISCO_COR[hovered.semaforo ?? 'verde'].ordem + ALTURA_RAIA / 2,
                  transform: `translate(${pos(hovered.diasRestantes) > 65 ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
                }}
              >
                <p className="truncate font-semibold text-zinc-100">{hovered.nome}</p>
                <p className="mt-1 flex items-center gap-1.5 text-zinc-300">
                  <span className="h-2 w-2 rounded-full" style={{ background: faixaDe(hovered.diasRestantes).cor }} />
                  {textoDias(hovered.diasRestantes)} · vence {hovered.contratoFim.split('-').reverse().join('/')}
                </p>
                <p className="mt-0.5 tabular-nums text-zinc-300">{fmtBRL0(hovered.mrr)}/mês</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: RISCO_COR[hovered.semaforo ?? 'verde'].cor }} />
                  {RISCO_COR[hovered.semaforo ?? 'verde'].label}
                  {hovered.accountManager ? ` · ${hovered.accountManager}` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Eixo X */}
          <div className="relative mt-1.5 h-4 text-[10px] tabular-nums text-muted">
            {MARCAS.map((m, i) => (
              <span
                key={m.dias}
                className="absolute"
                style={{ left: `${pos(m.dias)}%`, transform: i === 0 ? 'none' : i === MARCAS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
