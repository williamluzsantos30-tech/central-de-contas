/**
 * Linha de tarefa na aba Tarefas do cliente. Recorrente: checkbox = SÓ a
 * ocorrência atual, trilha das últimas ocorrências, "8 de 9 feitas" e a
 * próxima data. Esporádica: checkbox = a tarefa, "Atrasada {n}d" quando
 * passou do prazo. Clique na linha abre o histórico.
 */
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  diasEntre,
  getCompletionRate,
  ocorrenciaAtual,
  proximaDataPrevista,
  rotuloData,
  rotuloRecorrencia,
  trilhaDeCumprimento,
  type OcorrenciaTarefa,
  type RegistroOcorrencia,
  type TarefaModelo,
} from '@/lib/ocorrencias'
import { PrioridadeBadge, ResponsavelPicker, TrilhaCumprimento } from './TarefaUI'
import type { Profile, Tarefa } from '@/types/database'

interface Props {
  tarefa: Tarefa
  modelo: TarefaModelo
  registros: RegistroOcorrencia[]
  hoje: string
  pessoas: Profile[]
  comentarios?: number
  onToggle: (oc: OcorrenciaTarefa, concluir: boolean) => Promise<void>
  onResponsavel: (id: string | null) => Promise<void>
  onOpen: () => void
}

export function TaskRow({ tarefa, modelo, registros, hoje, pessoas, comentarios, onToggle, onResponsavel, onOpen }: Props) {
  const [salvando, setSalvando] = useState(false)
  const [otimista, setOtimista] = useState<boolean | null>(null)
  const recorrente = modelo.frequencia !== 'esporadica'
  const atual = ocorrenciaAtual(modelo, registros, hoje)
  const feita = otimista ?? atual?.status === 'feita'

  async function alternar() {
    if (!atual || salvando) return
    setSalvando(true)
    setOtimista(!feita)
    try {
      await onToggle(atual, !feita)
    } finally {
      setSalvando(false)
      setOtimista(null)
    }
  }

  const trilha = recorrente ? trilhaDeCumprimento(modelo, registros, hoje) : []
  const taxa = getCompletionRate(trilha)
  const proxima = recorrente ? proximaDataPrevista(modelo, registros, hoje) : null
  const atrasoAberto = recorrente && atual && !feita && atual.dataPrevista < hoje ? diasEntre(atual.dataPrevista, hoje) : 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      className={cn(
        'group flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 transition-colors hover:border-brand-500/30 hover:bg-bg-elev',
        feita && !recorrente && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={feita}
        disabled={!atual || salvando}
        onClick={(e) => e.stopPropagation()}
        onChange={() => void alternar()}
        className="h-4 w-4 shrink-0 accent-brand-500"
        title={
          !atual
            ? 'Sem prazo definido'
            : recorrente
              ? `${feita ? 'Desfazer' : 'Concluir'} a ocorrência de ${rotuloData(atual.dataPrevista, hoje)}`
              : feita
                ? 'Reabrir tarefa'
                : 'Concluir tarefa'
        }
        aria-label={`Concluir ${tarefa.nome}`}
      />

      <div className="min-w-[180px] flex-1">
        <p className={cn('text-sm text-zinc-100', feita && !recorrente && 'text-muted line-through')}>{tarefa.nome}</p>
        {recorrente && <p className="text-[11px] text-muted">{rotuloRecorrencia(modelo)}</p>}
      </div>

      {/* Metadados num bloco só: em tela estreita descem juntos pra 2ª linha. */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <PrioridadeBadge prioridade={tarefa.prioridade} />

        {recorrente ? (
          <>
            <span className="inline-flex items-center gap-2" title="Últimas ocorrências (mais antiga à esquerda)">
              <TrilhaCumprimento ocorrencias={trilha} hoje={hoje} />
              <span className="w-[5.5rem] text-[11px] tabular-nums text-muted">
                {taxa.avaliadas ? `${taxa.feitas} de ${taxa.avaliadas}${modelo.frequencia === 'diaria' ? ' feitas' : ''}` : 'sem histórico'}
              </span>
            </span>
            <span className={cn(PRAZO, 'tabular-nums', atrasoAberto ? 'font-medium text-red-400' : 'text-muted')}>
              {atrasoAberto && atual
                ? `Atrasada ${atrasoAberto}d · até ${rotuloData(atual.fimPeriodo ?? atual.dataPrevista, hoje)}`
                : proxima
                  ? `Próxima: ${rotuloData(proxima, hoje)}`
                  : '—'}
            </span>
          </>
        ) : (
          <PrazoEsporadica tarefa={tarefa} feita={feita} hoje={hoje} />
        )}

        <span className="inline-flex w-7 items-center gap-1 text-[11px] text-muted" title={comentarios ? `${comentarios} comentário(s)` : undefined}>
          {comentarios ? (
            <>
              <MessageSquare size={11} /> {comentarios}
            </>
          ) : null}
        </span>

        <ResponsavelPicker responsavel={tarefa.responsavel} pessoas={pessoas} onChange={onResponsavel} />
      </div>
    </div>
  )
}

const PRAZO = 'min-w-[7rem] whitespace-nowrap text-right text-[11px]'

function PrazoEsporadica({ tarefa, feita, hoje }: { tarefa: Tarefa; feita: boolean; hoje: string }) {
  const prazo = tarefa.data_vencimento?.slice(0, 10)
  if (feita) return <span className={cn(PRAZO, 'text-emerald-400')}>Concluída</span>
  if (!prazo) return <span className={cn(PRAZO, 'text-muted')}>Sem prazo</span>
  const d = diasEntre(prazo, hoje)
  if (d > 0) return <span className={cn(PRAZO, 'font-medium text-red-400')}>Atrasada {d}d</span>
  return <span className={cn(PRAZO, 'text-muted')}>{d === 0 ? 'Vence hoje' : `Prazo: ${rotuloData(prazo, hoje)}`}</span>
}
