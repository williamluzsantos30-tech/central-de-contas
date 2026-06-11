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
import { useAuth } from '@/contexts/AuthContext'
import { agendarCallNoGCal, gcalEstaConfigurado } from '@/lib/gcal'

interface Props {
  clienteId: string
  clienteNome: string
  proxima: string | null
  ultima: string | null
  gcalEventId: string | null
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

/** Dia da semana da data ISO (0=dom .. 6=sab) */
function diaSemanaIso(iso: string): number | null {
  const d = parseDate(iso)
  return d ? d.getDay() : null
}

/**
 * Espelha proximo_dia_util() do banco: se a data cai em sabado/domingo,
 * empurra pra segunda. Usado pra exibir a data corrigida no front antes
 * de salvar (o trigger no banco tambem ajusta, mas assim o usuario ja
 * ve o resultado correto sem precisar recarregar).
 */
function proximoDiaUtil(iso: string): string {
  const d = parseDate(iso)
  if (!d) return iso
  const dow = d.getDay()
  if (dow === 6) d.setDate(d.getDate() + 2) // sab → seg
  else if (dow === 0) d.setDate(d.getDate() + 1) // dom → seg
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
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
  clienteNome,
  proxima,
  ultima,
  gcalEventId,
  podeEditar,
  onChanged,
}: Props) {
  const { profile } = useAuth()
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
          : dias === 0
            ? 'border-brand-500/60 bg-brand-500/20 text-brand-200'
            : dias <= 3
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'

  // Se a data escolhida cai em fim de semana, a versão que vai pro banco
  // é a próxima segunda. Exibe o aviso pro usuário ver o resultado real.
  const dowEscolhido = novaData ? diaSemanaIso(novaData) : null
  const ehFimDeSemana = dowEscolhido === 0 || dowEscolhido === 6
  const dataAjustada = novaData ? proximoDiaUtil(novaData) : ''

  /** Best-effort: cria/atualiza o evento no Google Calendar via webhook n8n.
   *  Se VITE_GCAL_WEBHOOK_URL não está setada, vira no-op. Se o webhook
   *  falhar (rede, n8n offline, etc), só loga e continua — não desfaz o
   *  save da data. */
  async function disparaGCal(dataFinal: string) {
    if (!gcalEstaConfigurado()) return
    if (!profile?.email) return
    await agendarCallNoGCal({
      clienteId,
      clienteNome,
      data: dataFinal,
      autorEmail: profile.email,
      autorNome: profile.nome,
      eventoExistente: gcalEventId,
    })
  }

  async function salvarData() {
    setSaving(true)
    // Manda já ajustada (o trigger no banco tambem ajusta, mas assim a UI
    // ja reflete a data correta sem precisar recarregar).
    const valor = novaData ? proximoDiaUtil(novaData) : null
    const { error } = await supabase
      .from('clientes')
      .update({ proxima_call_alinhamento: valor })
      .eq('id', clienteId)
    if (error) {
      setSaving(false)
      alert(`Erro ao salvar: ${error.message}`)
      return
    }
    if (valor) await disparaGCal(valor)
    setSaving(false)
    setOpen(false)
    onChanged()
  }

  async function marcarRealizada() {
    setSaving(true)
    const { data, error } = await supabase.rpc(
      'marcar_call_alinhamento_realizada',
      { p_cliente_id: clienteId },
    )
    if (error) {
      setSaving(false)
      alert(`Erro ao marcar realizada: ${error.message}`)
      return
    }
    // RPC retorna [{ultima, proxima}] — pega a proxima pra disparar GCal
    const proxima = Array.isArray(data) && data[0]?.proxima ? data[0].proxima : null
    if (proxima) await disparaGCal(proxima)
    setSaving(false)
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
            className="mb-1 w-full rounded-md border border-border bg-bg-soft px-2 py-1.5 text-xs text-zinc-100 focus:border-brand-500/60 focus:outline-none"
          />
          {ehFimDeSemana && (
            <p className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
              {dowEscolhido === 6 ? 'Sábado' : 'Domingo'} — vai ser ajustada pra{' '}
              <strong>segunda ({formatBR(dataAjustada)})</strong>. Call só em dia útil.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={salvarData}
              disabled={
                saving || (novaData ? proximoDiaUtil(novaData) : '') === (proxima ?? '')
              }
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
