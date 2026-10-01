/**
 * Painel "Tarefas do dia" da lista Clientes · Tráfego: "Para hoje" e
 * "Atrasadas", com checkbox pra concluir a ocorrência sem abrir o cliente.
 * Diárias perdidas não entram aqui — aparecem como "⚠ N perdidas" no cliente.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Clock } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, frequenciaLabel } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { rotuloData, type ItemDoDia } from '@/lib/ocorrencias'
import { concluirOcorrencia } from '@/lib/ocorrenciasStore'
import type { TarefasDoDia } from '@/lib/tarefasDoDia'

export function TodayTasksPanel({ resumo, hoje, onChanged }: { resumo: TarefasDoDia; hoje: string; onChanged: () => Promise<void> | void }) {
  const { hoje: paraHoje, atrasadas } = resumo
  const [erro, setErro] = useState<string | null>(null)
  const vazio = paraHoje.length === 0 && atrasadas.length === 0

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Tarefas do dia</CardTitle>
        <Link to="/minhas-tarefas" className="text-xs text-brand-300 hover:underline">
          ver todas
        </Link>
      </CardHeader>
      <CardBody className="max-h-[360px] space-y-4 overflow-y-auto">
        {erro && <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{erro}</p>}
        {vazio ? (
          <EmptyState title="Nenhuma tarefa pra hoje" description="Você está em dia 🎉" />
        ) : (
          <>
            <Grupo
              titulo="Para hoje"
              icone={<Clock size={12} />}
              itens={paraHoje}
              hoje={hoje}
              onChanged={onChanged}
              onErro={setErro}
              vazio="Nada previsto pra hoje."
            />
            <Grupo
              titulo="Atrasadas"
              icone={<AlertTriangle size={12} />}
              itens={atrasadas}
              hoje={hoje}
              atrasada
              onChanged={onChanged}
              onErro={setErro}
              vazio="Nenhuma atrasada."
            />
          </>
        )}
      </CardBody>
    </Card>
  )
}

function Grupo({
  titulo,
  icone,
  itens,
  hoje,
  atrasada,
  vazio,
  onChanged,
  onErro,
}: {
  titulo: string
  icone: React.ReactNode
  itens: ItemDoDia[]
  hoje: string
  atrasada?: boolean
  vazio: string
  onChanged: () => Promise<void> | void
  onErro: (e: string | null) => void
}) {
  return (
    <div className="space-y-2">
      <p
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider',
          atrasada && itens.length ? 'text-red-300' : 'text-muted',
        )}
      >
        {icone} {titulo} · {itens.length}
      </p>
      {itens.length === 0 ? (
        <p className="text-[11px] text-muted">{vazio}</p>
      ) : (
        itens.map((i) => <Linha key={`${i.tarefa.id}|${i.ocorrencia.dataPrevista}`} item={i} hoje={hoje} atrasada={atrasada} onChanged={onChanged} onErro={onErro} />)
      )}
    </div>
  )
}

function Linha({
  item,
  hoje,
  atrasada,
  onChanged,
  onErro,
}: {
  item: ItemDoDia
  hoje: string
  atrasada?: boolean
  onChanged: () => Promise<void> | void
  onErro: (e: string | null) => void
}) {
  const { profile } = useAuth()
  const [feita, setFeita] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const { tarefa: t, ocorrencia: oc } = item
  const recorrente = t.frequencia !== 'esporadica'

  async function concluir() {
    setSalvando(true)
    setFeita(true)
    onErro(null)
    try {
      await concluirOcorrencia(t, oc, profile?.id ?? null)
      // Deixa o "✓" aparecer antes de a linha sair da lista.
      setTimeout(() => void onChanged(), 600)
    } catch (e) {
      setFeita(false)
      onErro(`Não foi possível concluir "${t.nome}": ${e instanceof Error ? e.message : 'erro'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
        atrasada ? 'border-red-500/40 bg-red-500/[0.05]' : 'border-border bg-bg-soft',
        feita && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={feita}
        disabled={feita || salvando}
        onChange={() => void concluir()}
        className="h-4 w-4 shrink-0 accent-brand-500"
        title={recorrente ? `Concluir a ocorrência de ${rotuloData(oc.dataPrevista, hoje)}` : 'Concluir tarefa'}
        aria-label={`Concluir ${t.nome}`}
      />
      <Link to={`/clientes/${t.cliente_id}?aba=operacional-trafego`} className="min-w-0 flex-1 hover:text-brand-300">
        <p className={cn('truncate text-sm font-medium', feita && 'line-through')}>{t.nome}</p>
        <p className="truncate text-xs text-muted">
          {t.cliente?.nome ?? '—'} · {frequenciaLabel[t.frequencia]}
        </p>
      </Link>
      {atrasada ? (
        <span className="shrink-0 text-right">
          <span className="block rounded border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-200">
            Atrasada {item.diasAtraso}d
          </span>
          {recorrente && oc.fimPeriodo && (
            <span className="mt-0.5 block text-[10px] text-muted" title="Depois disso a ocorrência vira perdida">
              dá até {rotuloData(oc.fimPeriodo, hoje)}
            </span>
          )}
        </span>
      ) : (
        <span className="shrink-0 rounded border border-brand-500/50 bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-200">
          {feita ? '✓ Feita' : 'Hoje'}
        </span>
      )}
    </div>
  )
}
