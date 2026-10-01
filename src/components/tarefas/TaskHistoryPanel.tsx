/**
 * Painel lateral da tarefa: histórico completo de ocorrências (data, status,
 * quem concluiu, observação) + aba Detalhes (edição e comentários).
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, MessageSquarePlus, Pencil, X } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  getCompletionRate,
  historicoCompleto,
  modeloDaTarefa,
  nomeDiaSemana,
  parseDia,
  rotuloRecorrencia,
  type OcorrenciaTarefa,
  type RegistroOcorrencia,
} from '@/lib/ocorrencias'
import { carregarRegistros, desdeFallback, salvarObservacao } from '@/lib/ocorrenciasStore'
import { PrioridadeBadge } from './TarefaUI'
import { TarefaDetalhes } from './TarefaDetalhes'
import type { Tarefa } from '@/types/database'

const POR_PAGINA = 60
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const horaBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const mesAno = (iso: string) => parseDia(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

export function TaskHistoryPanel({
  tarefa,
  hoje,
  onClose,
  onChanged,
}: {
  tarefa: Tarefa | null
  hoje: string
  onClose: () => void
  onChanged: () => void
}) {
  const [aba, setAba] = useState<'historico' | 'detalhes'>('historico')
  const [registros, setRegistros] = useState<RegistroOcorrencia[] | null>(null)
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [limite, setLimite] = useState(POR_PAGINA)

  async function recarregar(t: Tarefa) {
    const m = await carregarRegistros({ tarefaIds: [t.id] })
    setRegistros(m.get(t.id) ?? [])
  }

  useEffect(() => {
    if (!tarefa) return
    setAba('historico')
    setLimite(POR_PAGINA)
    setRegistros(null)
    void recarregar(tarefa)
    supabase
      .from('profiles')
      .select('id, nome')
      .then(({ data }) => setNomes(new Map(((data as { id: string; nome: string }[]) ?? []).map((p) => [p.id, p.nome]))))
  }, [tarefa?.id])

  const modelo = useMemo(() => (tarefa ? modeloDaTarefa(tarefa, desdeFallback()) : null), [tarefa, registros])
  const historico = useMemo(() => (modelo && registros ? historicoCompleto(modelo, registros, hoje) : []), [modelo, registros, hoje])
  const taxa = getCompletionRate(historico)

  return (
    <Drawer open={!!tarefa} onClose={onClose} title={tarefa?.nome ?? 'Tarefa'} className="max-w-lg">
      {tarefa && modelo && (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-border bg-bg-soft p-0.5">
            {(
              [
                ['historico', 'Histórico'],
                ['detalhes', 'Detalhes e comentários'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAba(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                  aba === k ? 'bg-bg-elev text-zinc-100' : 'text-muted hover:text-zinc-200',
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {aba === 'detalhes' ? (
            <TarefaDetalhes tarefa={tarefa} onChanged={onChanged} onExcluida={onClose} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span className="text-zinc-300">{rotuloRecorrencia(modelo)}</span>
                <PrioridadeBadge prioridade={tarefa.prioridade} />
                <span>· {tarefa.responsavel?.nome ?? 'Sem responsável'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Resumo label="Feitas" valor={taxa.feitas} cls="text-emerald-300" />
                <Resumo label={modelo.frequencia === 'esporadica' ? 'Atrasada' : 'Perdidas'} valor={modelo.frequencia === 'esporadica' ? atrasoEsporadica(historico, hoje) : taxa.perdidas} cls="text-red-300" />
                <Resumo label="Cumprimento" valor={taxa.pct == null ? '—' : `${Math.round(taxa.pct)}%`} cls="text-zinc-100" />
              </div>
              <p className="text-[10px] text-muted">
                Ocorrências contadas desde {dataBR(modelo.desde)}. Ocorrência não feita até o fim do período vira “perdida” — não acumula atraso.
              </p>

              {registros == null ? (
                <p className="py-6 text-center text-xs text-muted">Carregando…</p>
              ) : historico.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted">Nenhuma ocorrência ainda.</p>
              ) : (
                <ol className="space-y-1.5">
                  {historico.slice(0, limite).map((o, i, arr) => (
                    <li key={o.id}>
                      {(i === 0 || arr[i - 1].dataPrevista.slice(0, 7) !== o.dataPrevista.slice(0, 7)) && (
                        <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted first:mt-0">{mesAno(o.dataPrevista)}</p>
                      )}
                      <LinhaOcorrencia
                        oc={o}
                        hoje={hoje}
                        esporadica={modelo.frequencia === 'esporadica'}
                        nomeQuemConcluiu={o.concluidaPor ? (nomes.get(o.concluidaPor) ?? '—') : null}
                        onObservacao={async (txt) => {
                          await salvarObservacao(tarefa.id, o, txt)
                          await recarregar(tarefa)
                        }}
                      />
                    </li>
                  ))}
                </ol>
              )}
              {historico.length > limite && (
                <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full text-center text-[11px] text-brand-300 hover:underline">
                  Mostrar mais ({historico.length - limite})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Drawer>
  )
}

function atrasoEsporadica(historico: OcorrenciaTarefa[], hoje: string): string {
  const o = historico[0]
  if (!o || o.status === 'feita' || o.dataPrevista >= hoje) return '—'
  return `${Math.round((parseDia(hoje).getTime() - parseDia(o.dataPrevista).getTime()) / 86400000)}d`
}

function Resumo({ label, valor, cls }: { label: string; valor: number | string; cls: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', cls)}>{valor}</p>
    </div>
  )
}

const STATUS_CHIP = {
  feita: { label: 'Feita', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  perdida: { label: 'Perdida', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
  pendente: { label: 'Em aberto', cls: 'border-zinc-500/40 text-zinc-300' },
} as const

function LinhaOcorrencia({
  oc,
  hoje,
  esporadica,
  nomeQuemConcluiu,
  onObservacao,
}: {
  oc: OcorrenciaTarefa
  hoje: string
  esporadica: boolean
  nomeQuemConcluiu: string | null
  onObservacao: (texto: string) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(oc.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const atrasada = esporadica && oc.status === 'pendente' && oc.dataPrevista < hoje
  const chip = atrasada ? { label: 'Atrasada', cls: 'border-red-500/40 bg-red-500/10 text-red-300' } : STATUS_CHIP[oc.status]

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await onObservacao(texto)
      setEditando(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="w-12 text-xs font-medium tabular-nums text-zinc-100">{`${oc.dataPrevista.slice(8, 10)}/${oc.dataPrevista.slice(5, 7)}`}</span>
        <span className="w-14 text-[11px] text-muted">{nomeDiaSemana(oc.dataPrevista)}</span>
        <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium', chip.cls)}>{chip.label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted">
          {oc.status === 'feita' && (nomeQuemConcluiu || oc.concluidaEm) ? `${nomeQuemConcluiu ?? '—'}${oc.concluidaEm ? ` · ${horaBR(oc.concluidaEm)}` : ''}` : ''}
        </span>
        {!editando && (
          <button
            type="button"
            onClick={() => {
              setTexto(oc.observacao ?? '')
              setEditando(true)
            }}
            className="rounded p-1 text-muted hover:bg-bg-elev hover:text-brand-300"
            title={oc.observacao ? 'Editar observação' : 'Adicionar observação'}
            aria-label={oc.observacao ? 'Editar observação' : 'Adicionar observação'}
          >
            {oc.observacao ? <Pencil size={11} /> : <MessageSquarePlus size={11} />}
          </button>
        )}
      </div>
      {!editando && oc.observacao && <p className="mt-1 whitespace-pre-wrap pl-[6.5rem] text-[11px] text-zinc-300">{oc.observacao}</p>}
      {editando && (
        <div className="mt-2 space-y-1.5">
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Ex.: cliente sem acesso ao gerenciador nesse dia"
            className="w-full rounded-md border border-border bg-bg-soft px-2 py-1.5 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
          />
          {erro && <p className="text-[11px] text-red-300">{erro}</p>}
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setEditando(false)} disabled={salvando}>
              <X size={11} /> Cancelar
            </Button>
            <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
              <Check size={11} /> {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
