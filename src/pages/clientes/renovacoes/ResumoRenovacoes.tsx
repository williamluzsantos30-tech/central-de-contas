/**
 * Resumo das renovações: MRR em renovação nos próximos 90 dias + barra de
 * urgência (onde a carteira inteira está, de "vencido" a "em dia") + um bloco
 * por faixa. Passar o mouse detalha a faixa; clicar filtra a tabela.
 */
import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FAIXAS, FAIXA_POR_ID, fmtBRL0, type FaixaId } from './faixasRenovacao'
import type { ResumoRenovacoes as Resumo } from './useRenovacoesData'

const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

export function ResumoRenovacoes({
  resumo,
  filtro,
  onFiltro,
}: {
  resumo: Resumo
  filtro: FaixaId | null
  onFiltro: (f: FaixaId | null) => void
}) {
  const [hover, setHover] = useState<FaixaId | null>(null)
  const { carteira, janela90, porFaixa } = resumo
  const foco = hover ?? filtro
  const alternar = (id: FaixaId) => onFiltro(filtro === id ? null : id)

  return (
    <section className="rounded-xl border border-border bg-bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <CalendarClock size={12} className="text-brand-300" /> Receita em renovação · próximos 90 dias
          </p>
          <p className="mt-1.5 text-3xl font-bold tabular-nums text-zinc-100">
            {fmtBRL0(janela90.mrr)}
            <span className="ml-1 text-sm font-medium text-muted">/mês</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {janela90.qtd} de {carteira.qtd} contrato{carteira.qtd === 1 ? '' : 's'} · {pct(janela90.mrr, carteira.mrr)}% da receita com contrato
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Carteira com contrato</p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-zinc-100">
            {fmtBRL0(carteira.mrr)}
            <span className="ml-1 text-xs font-medium text-muted">/mês</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {carteira.qtd} contrato{carteira.qtd === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Barra de urgência — proporcional ao nº de contratos; 2px de fundo entre segmentos */}
      <div className="mt-4 flex h-3 gap-[2px]" onMouseLeave={() => setHover(null)} role="img" aria-label="Distribuição dos contratos por faixa de vencimento">
        {carteira.qtd === 0 ? (
          <div className="h-full w-full rounded-full bg-bg-elev" />
        ) : (
          FAIXAS.filter((f) => porFaixa[f.id].qtd > 0).map((f, i, arr) => (
            <button
              key={f.id}
              type="button"
              onMouseEnter={() => setHover(f.id)}
              onClick={() => alternar(f.id)}
              aria-label={`${f.label}: ${porFaixa[f.id].qtd} contrato(s)`}
              className={cn(
                'h-full min-w-[8px] transition-opacity',
                i === 0 && 'rounded-l-full',
                i === arr.length - 1 && 'rounded-r-full',
                foco && foco !== f.id && 'opacity-35',
              )}
              style={{ flexGrow: porFaixa[f.id].qtd, flexBasis: 0, background: f.cor }}
            />
          ))
        )}
      </div>
      <p className="mt-2 h-4 text-[11px] text-muted">
        {foco ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: FAIXA_POR_ID[foco].cor }} />
            <span className="font-medium text-zinc-200">{FAIXA_POR_ID[foco].label}</span>— {porFaixa[foco].qtd} contrato
            {porFaixa[foco].qtd === 1 ? '' : 's'} · {fmtBRL0(porFaixa[foco].mrr)}/mês · {FAIXA_POR_ID[foco].dica}
            {filtro === foco && <span className="text-brand-300">· filtrando a tabela</span>}
          </span>
        ) : (
          'Passe o mouse numa faixa para detalhar; clique para filtrar a tabela.'
        )}
      </p>

      {/* Um bloco por faixa (legenda + atalho de filtro) */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {FAIXAS.map((f) => {
          const v = porFaixa[f.id]
          const urgente = v.qtd > 0 && (f.id === 'vencido' || f.id === 'ate15')
          const ativo = filtro === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => alternar(f.id)}
              onMouseEnter={() => setHover(f.id)}
              onMouseLeave={() => setHover(null)}
              aria-pressed={ativo}
              className={cn(
                'rounded-lg border bg-bg-soft/40 px-3 py-2.5 text-left transition-colors',
                ativo ? 'border-brand-500/60 bg-brand-500/10' : 'border-border hover:border-zinc-500/60',
                v.qtd === 0 && !ativo && 'opacity-60',
              )}
              style={urgente && !ativo ? { borderColor: `${f.cor}80`, background: `${f.cor}12` } : undefined}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: f.cor }} />
                {f.label}
              </span>
              <span className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{v.qtd}</span>
              <span className="block text-[11px] tabular-nums text-muted">{v.qtd ? `${fmtBRL0(v.mrr)}/mês` : f.dica}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
