import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { cn, isDueToday, isOverdue, prioridadeLabel, relativeDueLabel } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { FrequenciaTarefa, Tarefa } from '@/types/database'

const freqRowStyle: Record<FrequenciaTarefa, string> = {
  diaria:
    'border-red-500/25 bg-red-500/5 border-l-2 border-l-red-400/70 hover:bg-red-500/10 hover:border-red-500/40',
  semanal:
    'border-orange-500/25 bg-orange-500/5 border-l-2 border-l-orange-400/70 hover:bg-orange-500/10 hover:border-orange-500/40',
  mensal:
    'border-pink-500/25 bg-pink-500/5 border-l-2 border-l-pink-400/70 hover:bg-pink-500/10 hover:border-pink-500/40',
  esporadica: 'border-border bg-bg-soft hover:bg-bg-elev',
}

const freqAccent: Record<FrequenciaTarefa, string> = {
  diaria: 'accent-red-400',
  semanal: 'accent-orange-400',
  mensal: 'accent-pink-400',
  esporadica: 'accent-brand-500',
}

interface Props {
  tarefa: Tarefa
  onChange: () => void
  onOpen: (t: Tarefa) => void
  comentariosCount?: number
}

/** Se a data cair em sáb/dom, empurra pra segunda. Não mexe em dias úteis. */
function skipWeekend(d: Date): Date {
  const dow = d.getDay() // 0=dom, 6=sab
  if (dow === 6) d.setDate(d.getDate() + 2)
  else if (dow === 0) d.setDate(d.getDate() + 1)
  return d
}

/** Calcula a próxima data de vencimento baseada na frequência + template.
 *  Pula sáb/dom em todas as frequências recorrentes. */
function computeNextDueDate(tarefa: Tarefa): string | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (tarefa.frequencia === 'diaria') {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return skipWeekend(d).toISOString().slice(0, 10)
  }

  if (tarefa.frequencia === 'semanal') {
    const dias = tarefa.template?.dias_semana ?? []
    if (dias.length === 0) {
      const d = new Date(today)
      d.setDate(d.getDate() + 7)
      return skipWeekend(d).toISOString().slice(0, 10)
    }
    // Se o usuário escolheu dias específicos, respeita a escolha — mas se
    // mesmo assim cair em fds (config errada), empurra pra segunda.
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      if (dias.includes(d.getDay())) return skipWeekend(d).toISOString().slice(0, 10)
    }
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return skipWeekend(d).toISOString().slice(0, 10)
  }

  if (tarefa.frequencia === 'mensal') {
    const diaMes = tarefa.template?.dia_mes ?? today.getDate()
    const next = new Date(today.getFullYear(), today.getMonth() + 1, diaMes)
    return skipWeekend(next).toISOString().slice(0, 10)
  }

  return null
}

export function TarefaItem({ tarefa, onChange, onOpen, comentariosCount }: Props) {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1200)
    return () => clearTimeout(t)
  }, [flash])

  async function toggle() {
    if (tarefa.status === 'concluida') {
      // Desmarcar — só volta pra pendente
      await supabase
        .from('tarefas')
        .update({ status: 'pendente', data_conclusao: null })
        .eq('id', tarefa.id)
      onChange()
      return
    }

    // Feedback visual imediato
    setFlash(true)

    if (tarefa.frequencia === 'esporadica') {
      // Esporádica conclui e some da lista
      await supabase
        .from('tarefas')
        .update({ status: 'concluida', data_conclusao: new Date().toISOString() })
        .eq('id', tarefa.id)
    } else {
      // Recorrente: avança a própria tarefa para a próxima data (sem duplicar)
      const nextDate = computeNextDueDate(tarefa)
      await supabase
        .from('tarefas')
        .update({
          status: 'pendente',
          data_conclusao: new Date().toISOString(),
          data_vencimento: nextDate,
        })
        .eq('id', tarefa.id)
    }

    // Pequeno delay pro usuário ver o "✓ concluída" antes da lista atualizar
    setTimeout(() => onChange(), 900)
  }

  const done = tarefa.status === 'concluida' || flash
  const overdue = !done && isOverdue(tarefa.data_vencimento)
  const dueToday = !done && !overdue && isDueToday(tarefa.data_vencimento)

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
        freqRowStyle[tarefa.frequencia],
        done && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        className={cn('h-4 w-4', freqAccent[tarefa.frequencia])}
      />
      <button
        onClick={() => onOpen(tarefa)}
        className={cn(
          'flex-1 text-left text-sm',
          done && 'line-through text-muted',
        )}
      >
        {tarefa.nome}
      </button>
      <div className="flex items-center gap-2">
        {comentariosCount ? (
          <span className="flex items-center gap-1 text-xs text-muted">
            <MessageSquare size={12} />
            {comentariosCount}
          </span>
        ) : null}
        <Badge
          tone={
            tarefa.prioridade === 'alta'
              ? 'danger'
              : tarefa.prioridade === 'media'
              ? 'warning'
              : 'neutral'
          }
        >
          {prioridadeLabel[tarefa.prioridade]}
        </Badge>
        <Badge
          tone={
            flash || done
              ? 'success'
              : overdue
              ? 'danger'
              : dueToday
              ? 'warning'
              : 'neutral'
          }
        >
          {flash ? '✓ Concluída!' : done ? 'Concluída' : relativeDueLabel(tarefa.data_vencimento)}
        </Badge>
        {tarefa.responsavel && <Avatar name={tarefa.responsavel.nome} size="sm" />}
      </div>
    </div>
  )
}
