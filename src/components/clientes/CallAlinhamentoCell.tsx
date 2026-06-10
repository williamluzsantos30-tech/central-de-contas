/**
 * Célula da Call de Alinhamento mensal (usada nas tabelas /clientes e
 * /social/clientes). Mostra a próxima data agendada com indicador visual:
 *   - 🔴 vermelho: passou da data (atrasada)
 *   - 🟡 âmbar: hoje ou nos próximos 3 dias
 *   - 🟢 verde: futura (>3 dias)
 *   - cinza pontilhado: nunca cadastrada
 *
 * Clique abre um popover compacto com input de data + botão
 * "Marcar realizada" (que dispara RPC marcar_call_alinhamento_realizada
 * e auto-avança a data em 30 dias).
 */
import { useEffect, useRef, useState } from 'react'
import { CalendarClock, CheckCircle2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Props {
  clienteId: string
  proxima: string | null
  ultima: string | null
  podeEditar: boolean
  onChanged: () => void
}

function parseDate(iso: string | null): Date | null {
  if (!iso) return null
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setHours(12, 0, 0, 0)
  return d
}

function formatBR(iso: string | null): string {
  const d = parseDate(iso)
  return d
    ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—'
}

function diasUntil(iso: string | null): number | null {
  const d = parseDate(iso)
  if (!d) return null
  // Normaliza AMBAS as datas pra meia-noite local. Senao a diferenca vira
  // 12h (0.5 dia) quando e o mesmo dia, e Math.round(0.5) arredonda pra 1.
  d.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function labelRelativo(dias: number | null): string {
  if (dias === null) return ''
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias === -1) return 'ontem'
  if (dias < 0) return `${Math.abs(dias)}d atrasada`
  return `em ${dias}d`
}

export function CallAlinhamentoCell({
  clienteId,
  proxima,
  ultima,
  podeEditar,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [novaData, setNovaData] = useState(proxima ?? '')
  const [saving, setSaving] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNovaData(proxima ?? '')
  }, [proxima])

  // Fecha popover ao clicar fora
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const dias = diasUntil(proxima)
  const cor =
    proxima === null
      ? 'border-dashed border-border bg-bg-soft text-muted'
      : dias === null
        ? 'border-border bg-bg-soft text-zinc-300'
        : dias < 0
          ? 'border-red-500/50 bg-red-500/15 text-red-200'
          : dias <= 3
            ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'

  async function salvarData() {
    setSaving(true)
    const valor = novaData || null
    const { error } = await supabase
      .from('clientes')
      .update({ proxima_call_alinhamento: valor })
      .eq('id', clienteId)
    setSaving(false)
    if (error) {
      alert(`Erro ao salvar: ${error.message}`)
      return
    }
    setOpen(false)
    onChanged()
  }

  async function marcarRealizada() {
    setSaving(true)
    const { error } = await supabase.rpc('marcar_call_alinhamento_realizada', {
      p_cliente_id: clienteId,
    })
    setSaving(false)
    if (error) {
      alert(`Erro ao marcar realizada: ${error.message}`)
      return
    }
    setOpen(false)
    onChanged()
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          if (podeEditar) setOpen((v) => !v)
        }}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
          cor,
          podeEditar && 'cursor-pointer hover:opacity-90',
          !podeEditar && 'cursor-default',
        )}
        title={
          proxima
            ? ultima
              ? `Última call: ${formatBR(ultima)}`
              : 'Sem registro de última call ainda'
            : 'Sem call agendada'
        }
      >
        <CalendarClock size={11} />
        {proxima ? (
          <>
            <span className="tabular-nums">{formatBR(proxima)}</span>
            {dias !== null && (
              <span className="opacity-80">· {labelRelativo(dias)}</span>
            )}
          </>
        ) : (
          <span className="italic">sem agenda</span>
        )}
      </button>

      {open && podeEditar && (
        <div
          ref={popRef}
          className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-border bg-bg-card p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-zinc-100">
              Call de alinhamento
            </h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-bg-elev hover:text-zinc-200"
              title="Fechar"
            >
              <X size={11} />
            </button>
          </div>

          {ultima && (
            <p className="mb-2 text-[10px] text-muted">
              Última realizada em <span className="text-zinc-300">{formatBR(ultima)}</span>
            </p>
          )}

          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
            Próxima call
          </label>
          <input
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            disabled={saving}
            className="mb-2 w-full rounded-md border border-border bg-bg-soft px-2 py-1.5 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={salvarData}
              disabled={saving || novaData === (proxima ?? '')}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-soft px-2 py-1 text-[11px] text-zinc-200 transition-colors hover:border-brand-500/40 hover:text-brand-300 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar data'}
            </button>
            <button
              type="button"
              onClick={marcarRealizada}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
              title="Marca a data de hoje como última call e agenda a próxima daqui 30 dias"
            >
              <CheckCircle2 size={11} />
              Marcar realizada
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
