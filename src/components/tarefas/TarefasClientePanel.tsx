/**
 * Aba "Tarefas" do cliente (Operacional Tráfego): tarefas agrupadas por
 * frequência, cada recorrente com a ocorrência atual + trilha de
 * cumprimento; histórico no painel lateral; "Restaurar padrões" com
 * confirmação.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Plus, RotateCcw } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn, frequenciaLabel } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { modeloDaTarefa, ocorrenciaAtual, resumirDoDia, type OcorrenciaTarefa, type RegistroOcorrencia } from '@/lib/ocorrencias'
import { concluirOcorrencia, desdeFallback, desfazerOcorrencia, ocorrenciasNoBanco } from '@/lib/ocorrenciasStore'
import type { ResultadoRestauracao } from '@/lib/restaurarTarefas'
import { TaskRow } from './TaskRow'
import { TaskHistoryPanel } from './TaskHistoryPanel'
import { RestoreDefaultsModal } from './RestoreDefaultsModal'
import { NovaTarefaModal } from './NovaTarefaModal'
import { carregarResponsaveisTarefa } from './TarefaUI'
import type { Cliente, FrequenciaTarefa, Profile, Tarefa } from '@/types/database'

const FREQUENCIAS: FrequenciaTarefa[] = ['diaria', 'semanal', 'mensal', 'esporadica']
const PESO_PRIORIDADE = { alta: 0, media: 1, baixa: 2 }

const freqStyle: Record<FrequenciaTarefa, { borderLeft: string; title: string; dot: string }> = {
  diaria: { borderLeft: 'border-l-red-500/70', title: 'text-red-300', dot: 'bg-red-400' },
  semanal: { borderLeft: 'border-l-orange-500/70', title: 'text-orange-300', dot: 'bg-orange-400' },
  mensal: { borderLeft: 'border-l-pink-500/70', title: 'text-pink-300', dot: 'bg-pink-400' },
  esporadica: { borderLeft: 'border-l-brand-500/70', title: 'text-brand-300', dot: 'bg-brand-400' },
}

export function TarefasClientePanel({
  cliente,
  tarefas,
  registros,
  comentariosCount,
  hoje,
  onChanged,
}: {
  cliente: Cliente
  tarefas: Tarefa[]
  registros: Map<string, RegistroOcorrencia[]>
  comentariosCount: Map<string, number>
  hoje: string
  onChanged: () => Promise<void> | void
}) {
  const { profile } = useAuth()
  const [pessoas, setPessoas] = useState<Profile[]>([])
  const [aberta, setAberta] = useState<Tarefa | null>(null)
  const [novaFreq, setNovaFreq] = useState<FrequenciaTarefa | null>(null)
  const [restaurarAberto, setRestaurarAberto] = useState(false)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    carregarResponsaveisTarefa().then(setPessoas)
  }, [])

  useEffect(() => {
    if (!aviso || aviso.tom === 'erro') return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  // A tarefa aberta no painel acompanha o reload.
  useEffect(() => {
    if (aberta) setAberta(tarefas.find((t) => t.id === aberta.id) ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas])

  const fallback = desdeFallback()
  const visiveis = useMemo(
    () => tarefas.filter((t) => (t.frequencia === 'esporadica' ? t.status === 'pendente' || t.status === 'em_andamento' : modeloDaTarefa(t).ativa)),
    [tarefas],
  )
  const resumo = useMemo(() => resumirDoDia(visiveis, registros, hoje, fallback), [visiveis, registros, hoje, fallback])

  const grupos = useMemo(() => {
    const g: Record<FrequenciaTarefa, { tarefa: Tarefa; feitaAgora: boolean }[]> = { diaria: [], semanal: [], mensal: [], esporadica: [] }
    for (const t of visiveis) {
      const atual = ocorrenciaAtual(modeloDaTarefa(t, fallback), registros.get(t.id) ?? [], hoje)
      g[t.frequencia].push({ tarefa: t, feitaAgora: atual?.status === 'feita' })
    }
    for (const f of FREQUENCIAS)
      g[f].sort(
        (a, b) =>
          Number(a.feitaAgora) - Number(b.feitaAgora) ||
          PESO_PRIORIDADE[a.tarefa.prioridade] - PESO_PRIORIDADE[b.tarefa.prioridade] ||
          a.tarefa.nome.localeCompare(b.tarefa.nome),
      )
    return g
  }, [visiveis, registros, hoje, fallback])

  async function alternar(t: Tarefa, oc: OcorrenciaTarefa, concluir: boolean) {
    try {
      if (concluir) await concluirOcorrencia(t, oc, profile?.id ?? null)
      else await desfazerOcorrencia(t, oc)
      await onChanged()
    } catch (e) {
      setAviso({ tom: 'erro', texto: `Não foi possível salvar: ${e instanceof Error ? e.message : 'erro desconhecido'}` })
    }
  }

  async function trocarResponsavel(t: Tarefa, id: string | null) {
    const { error } = await supabase.from('tarefas').update({ responsavel_id: id }).eq('id', t.id)
    if (error) setAviso({ tom: 'erro', texto: `Não foi possível trocar o responsável: ${error.message}` })
    await onChanged()
  }

  function aoRestaurar(r: ResultadoRestauracao) {
    const partes = [
      r.restauradas && `${r.restauradas} padrão restaurada${r.restauradas > 1 ? 's' : ''}`,
      r.criadas && `${r.criadas} criada${r.criadas > 1 ? 's' : ''}`,
      r.removidas && `${r.removidas} personalizada${r.removidas > 1 ? 's' : ''} removida${r.removidas > 1 ? 's' : ''}`,
    ].filter(Boolean)
    setAviso({ tom: 'ok', texto: partes.length ? `Tarefas padrão restauradas: ${partes.join(', ')}.` : 'As tarefas já estavam no padrão.' })
    void onChanged()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip icon={<Clock size={12} />} label="Para hoje" valor={resumo.hoje.length} />
        <Chip icon={<AlertTriangle size={12} />} label="Atrasadas" valor={resumo.atrasadas.length} tom={resumo.atrasadas.length ? 'danger' : undefined} />
        <Chip
          icon={<AlertTriangle size={12} />}
          label="Perdidas (7 dias)"
          valor={resumo.perdidasSemana}
          tom={resumo.perdidasSemana ? 'warning' : undefined}
          title="Ocorrências de tarefas recorrentes que passaram do período sem ser feitas"
        />
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setRestaurarAberto(true)} title="Volta as tarefas padrão às configurações originais">
          <RotateCcw size={12} /> Restaurar padrões
        </Button>
      </div>

      {ocorrenciasNoBanco() === false && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          Histórico de ocorrências salvo só neste navegador — rode a migration 098 no Supabase pra ele ficar no banco.
        </p>
      )}
      {aviso && (
        <p
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-3 py-2 text-[11px]',
            aviso.tom === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200',
          )}
        >
          {aviso.tom === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {aviso.texto}
        </p>
      )}

      {FREQUENCIAS.map((freq) => {
        const style = freqStyle[freq]
        const itens = grupos[freq]
        const feitasAgora = itens.filter((i) => i.feitaAgora).length
        return (
          <Card key={freq} className={cn('border-l-2', style.borderLeft)}>
            <CardHeader>
              <CardTitle className={style.title}>
                <span aria-hidden className={cn('mr-2 inline-block h-2 w-2 rounded-full align-middle', style.dot)} />
                {frequenciaLabel[freq]}
                {freq !== 'esporadica' && itens.length > 0 && (
                  <span className="ml-2 text-[11px] font-normal text-muted">
                    {feitasAgora} de {itens.length} {freq === 'diaria' ? 'feitas hoje' : freq === 'semanal' ? 'feitas nesta semana' : 'feitas neste mês'}
                  </span>
                )}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setNovaFreq(freq)}>
                <Plus size={12} /> Nova
              </Button>
            </CardHeader>
            <CardBody className="space-y-2">
              {itens.length === 0 ? (
                <p className="text-xs text-muted">Sem tarefas nessa frequência.</p>
              ) : (
                itens.map(({ tarefa: t }) => (
                  <TaskRow
                    key={t.id}
                    tarefa={t}
                    modelo={modeloDaTarefa(t, fallback)}
                    registros={registros.get(t.id) ?? []}
                    hoje={hoje}
                    pessoas={pessoas}
                    comentarios={comentariosCount.get(t.id)}
                    onToggle={(oc, concluir) => alternar(t, oc, concluir)}
                    onResponsavel={(id) => trocarResponsavel(t, id)}
                    onOpen={() => setAberta(t)}
                  />
                ))
              )}
            </CardBody>
          </Card>
        )
      })}

      <TaskHistoryPanel tarefa={aberta} hoje={hoje} onClose={() => setAberta(null)} onChanged={() => void onChanged()} />
      <RestoreDefaultsModal open={restaurarAberto} cliente={cliente} onClose={() => setRestaurarAberto(false)} onRestaurado={aoRestaurar} />
      {novaFreq && (
        <NovaTarefaModal
          open={!!novaFreq}
          onClose={() => setNovaFreq(null)}
          clienteId={cliente.id}
          frequencia={novaFreq}
          responsavelPadrao={cliente.gestor_id ?? cliente.account_manager_id ?? null}
          onCreated={() => void onChanged()}
        />
      )}
    </div>
  )
}

function Chip({ icon, label, valor, tom, title }: { icon: React.ReactNode; label: string; valor: number; tom?: 'danger' | 'warning'; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px]',
        tom === 'danger' ? 'border-red-500/40 bg-red-500/10 text-red-300' : tom === 'warning' ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' : 'border-border bg-bg-soft text-zinc-300',
      )}
    >
      {icon} {label} · <strong className="tabular-nums">{valor}</strong>
    </span>
  )
}
