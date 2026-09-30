/**
 * GoalsTable — Meta × Realizado de UMA plataforma numa tabela só:
 * Métrica | Meta | Realizado | % atingido, agrupada nas seções do funil.
 */
import { Activity, AlertTriangle, MessageSquare, RefreshCw, Stethoscope, Trophy, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { SaveIndicator, type EstadoSalvar } from '@/components/trafego/TrafegoUI'
import type { DadoMidia } from '@/lib/trafegoCliente'
import type { MetasValores } from '@/types/database'
import { formatarValor, montarTabelaMetas, nivelPct, type Celula, type GrupoMeta, type LinhaMeta } from './metasTabela'

const ICONE: Record<GrupoMeta['key'], typeof Wallet> = {
  investimento: Wallet,
  mensagens: MessageSquare,
  consultas: Stethoscope,
  procedimentos: Activity,
  resultado: Trophy,
}

const COR_PCT = { bom: 'text-emerald-400', medio: 'text-orange-400', ruim: 'text-red-400' }

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export function GoalsTable({
  titulo,
  nomePlataforma,
  corTitulo,
  meta,
  real,
  midia,
  semVerba,
  estado,
  onRetry,
  onMeta,
  onReal,
  onBlur,
}: {
  titulo: string
  nomePlataforma: string
  corTitulo: string
  meta: MetasValores
  real: MetasValores
  midia: DadoMidia
  /** Cliente sem verba nesta plataforma — sem aviso de "integração desconectada". */
  semVerba?: boolean
  estado: EstadoSalvar
  onRetry: () => void
  onMeta: (campo: keyof MetasValores, valor: number | null) => void
  onReal: (campo: keyof MetasValores, valor: number | null) => void
  onBlur: () => void
}) {
  const grupos = montarTabelaMetas(meta, real, midia)

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className={cn('text-[11px] font-bold uppercase tracking-widest', corTitulo)}>{titulo}</h3>
          {midia.conectado ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted" title={`Investimento, cliques e mensagens vêm do ${nomePlataforma}`}>
              <RefreshCw size={10} className="text-emerald-400" /> Sincronizado com o {nomePlataforma} · {dataHora(midia.ultimaSincronizacao)}
            </p>
          ) : semVerba ? (
            <p className="mt-0.5 text-[11px] text-muted">Sem verba de {nomePlataforma} neste cliente — preencha só se houver investimento.</p>
          ) : (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-orange-300">
              <AlertTriangle size={10} /> Integração desconectada — investimento, cliques e mensagens do Realizado são digitados à mão (conecte na aba {nomePlataforma}).
            </p>
          )}
        </div>
        <SaveIndicator estado={estado} onRetry={onRetry} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
              <th className="px-4 py-2">Métrica</th>
              <th className="w-40 px-3 py-2 text-right">Meta</th>
              <th className="w-40 px-3 py-2 text-right">Realizado</th>
              <th className="w-28 px-4 py-2 text-right">% atingido</th>
            </tr>
          </thead>
          {grupos.map((g) => {
            const Icon = ICONE[g.key]
            return (
              <tbody key={g.key}>
                <tr className="bg-bg-soft/30">
                  <td colSpan={4} className="px-4 py-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                      <Icon size={11} className="text-brand-300" /> {g.label}
                    </span>
                  </td>
                </tr>
                {g.linhas.map((l) => (
                  <Linha key={l.key} linha={l} nomePlataforma={nomePlataforma} onMeta={onMeta} onReal={onReal} onBlur={onBlur} />
                ))}
              </tbody>
            )
          })}
        </table>
      </div>
    </Card>
  )
}

function Linha({
  linha,
  nomePlataforma,
  onMeta,
  onReal,
  onBlur,
}: {
  linha: LinhaMeta
  nomePlataforma: string
  onMeta: (campo: keyof MetasValores, valor: number | null) => void
  onReal: (campo: keyof MetasValores, valor: number | null) => void
  onBlur: () => void
}) {
  const nivel = linha.pct != null && !linha.neutro ? nivelPct(linha.pct) : null
  return (
    <tr className="border-t border-border/40 hover:bg-bg-soft/30">
      <td className="px-4 py-1.5">
        <p className={cn('text-[12.5px]', linha.destaque ? 'font-semibold text-zinc-100' : 'text-zinc-200')}>{linha.label}</p>
        {/* Fórmula sem itálico: o "÷" pequeno em itálico parecia "+". */}
        {linha.formula && <p className="text-[10.5px] text-muted">= {linha.formula}</p>}
      </td>
      <td className="px-3 py-1.5 text-right">
        <Valor celula={linha.meta} formato={linha.formato} destaque={linha.destaque} nomePlataforma={nomePlataforma} onChange={onMeta} onBlur={onBlur} />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Valor celula={linha.real} formato={linha.formato} destaque={linha.destaque} nomePlataforma={nomePlataforma} onChange={onReal} onBlur={onBlur} />
      </td>
      <td className="px-4 py-1.5 text-right">
        {linha.pct == null ? (
          <span className="text-muted" title="Precisa de meta e realizado">—</span>
        ) : (
          <span
            className={cn('text-[12.5px] font-semibold tabular-nums', nivel ? COR_PCT[nivel] : 'text-zinc-300')}
            title={linha.custo ? 'Métrica de custo: menor é melhor (meta ÷ realizado)' : linha.neutro ? 'Execução da verba' : 'Realizado ÷ meta'}
          >
            {Math.round(linha.pct)}%
          </span>
        )}
      </td>
    </tr>
  )
}

function Valor({
  celula,
  formato,
  destaque,
  nomePlataforma,
  onChange,
  onBlur,
}: {
  celula: Celula
  formato: LinhaMeta['formato']
  destaque?: boolean
  nomePlataforma: string
  onChange: (campo: keyof MetasValores, valor: number | null) => void
  onBlur: () => void
}) {
  if (celula.tipo === 'vazio') return <span className="text-muted">—</span>
  if (celula.tipo === 'input' && celula.campo) {
    const campo = celula.campo
    return (
      <div className="ml-auto flex w-36 items-center gap-1">
        {formato === 'money' && <span className="shrink-0 text-[10.5px] text-muted">R$</span>}
        <input
          type="number"
          step={formato === 'money' ? '0.01' : '1'}
          value={celula.valor ?? ''}
          onChange={(e) => onChange(campo, e.target.value === '' ? null : Number(e.target.value))}
          onBlur={onBlur}
          placeholder="—"
          className="h-7 w-full rounded-md border border-transparent bg-bg-soft/60 px-2 text-right text-[12.5px] font-medium text-zinc-100 placeholder:text-muted/50 hover:border-border focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
    )
  }
  const vazio = celula.valor == null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-end gap-1 text-[12.5px] tabular-nums',
        vazio ? 'text-muted' : destaque ? 'font-semibold text-emerald-300' : 'font-medium text-zinc-100',
      )}
      title={celula.tipo === 'integracao' ? `Vem do ${nomePlataforma} (não editável)` : vazio ? 'Ainda não informado' : 'Calculado'}
    >
      {celula.tipo === 'integracao' && <RefreshCw size={10} className="text-emerald-400" />}
      {formatarValor(celula.valor, formato)}
    </span>
  )
}
