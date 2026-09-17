/**
 * Componentes da Gestão de Flags: FlagTipoBadge, RegisterFlagModal,
 * FlagHistoryCard.
 */
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Modal, FormField, Select, Textarea, PrimaryButton, OutlineButton, Badge } from '@/components/ds'
import { cn } from '@/lib/utils'
import {
  CATEGORIAS_FLAG,
  MOTIVOS_FLAG,
  type Colaborador,
  type Flag,
  type StatusFlag,
  type TipoFlag,
} from './mockFlags'
import type { NovaFlag } from './store'

export function dataHoraBR(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function dataBR(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** Badge "AMARELA"/"VERMELHA". */
export function FlagTipoBadge({ tipo }: { tipo: TipoFlag }) {
  return (
    <Badge tone={tipo === 'amarela' ? 'attention' : 'danger'} className="uppercase tracking-wider">
      <span className={cn('h-1.5 w-1.5 rounded-full', tipo === 'amarela' ? 'bg-yellow-400' : 'bg-red-500')} />
      {tipo === 'amarela' ? 'Amarela' : 'Vermelha'}
    </Badge>
  )
}

// ============================================================
// RegisterFlagModal (Tela 3)
// ============================================================
export function RegisterFlagModal({
  open,
  onClose,
  colaboradores,
  colabFixo,
  onRegister,
}: {
  open: boolean
  onClose: () => void
  colaboradores: Colaborador[]
  colabFixo?: string
  onRegister: (colabId: string, nova: NovaFlag) => void
}) {
  const [colabId, setColabId] = useState(colabFixo ?? colaboradores[0]?.id ?? '')
  const [tipo, setTipo] = useState<TipoFlag>('amarela')
  const [categoria, setCategoria] = useState('')
  const [motivo, setMotivo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tentou, setTentou] = useState(false)

  useEffect(() => {
    if (!open) return
    setColabId(colabFixo ?? colaboradores[0]?.id ?? '')
    setTipo('amarela')
    setCategoria('')
    setMotivo('')
    setDescricao('')
    setTentou(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, colabFixo])

  function registrar() {
    setTentou(true)
    if (!colabId || !categoria || !motivo) return
    onRegister(colabId, { tipo, categoria, motivo, descricao: descricao.trim() || undefined })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar Flag"
      footer={
        <div className="flex justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>
            Cancelar
          </OutlineButton>
          <PrimaryButton size="sm" onClick={registrar}>
            Registrar Flag
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3.5">
        <FormField label="Colaborador" required>
          <Select value={colabId} onChange={(e) => setColabId(e.target.value)} disabled={!!colabFixo}>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </FormField>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            Tipo de Flag <span className="text-brand-400">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <RadioTipo ativo={tipo === 'amarela'} onClick={() => setTipo('amarela')} cor="bg-yellow-400" label="Amarela (expira em 60 dias)" />
            <RadioTipo ativo={tipo === 'vermelha'} onClick={() => setTipo('vermelha')} cor="bg-red-500" label="Vermelha (não expira)" />
          </div>
        </div>

        <FormField label="Categoria" required>
          <Select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={cn(tentou && !categoria && 'border-orange-500 focus:border-orange-500')}
          >
            <option value="">Selecione a categoria</option>
            {CATEGORIAS_FLAG.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Motivo" required>
          <Select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={cn(tentou && !motivo && 'border-orange-500 focus:border-orange-500')}
          >
            <option value="">Selecione o motivo</option>
            {MOTIVOS_FLAG.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Descrição (opcional)">
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes adicionais sobre a ocorrência..."
            className="min-h-[80px]"
          />
        </FormField>
      </div>
    </Modal>
  )
}

function RadioTipo({ ativo, onClick, cor, label }: { ativo: boolean; onClick: () => void; cor: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        ativo ? 'border-brand-500/50 bg-brand-500/10 text-zinc-100' : 'border-border bg-bg-elev text-muted hover:text-zinc-200',
      )}
    >
      <span className={cn('grid h-3.5 w-3.5 place-items-center rounded-full border', ativo ? 'border-brand-400' : 'border-zinc-500')}>
        {ativo && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
      </span>
      <span className={cn('h-2 w-2 rounded-full', cor)} />
      {label}
    </button>
  )
}

// ============================================================
// FlagHistoryCard (Tela 2)
// ============================================================
const STATUS_SECUNDARIO: Record<StatusFlag, { label: string; tone: 'neutral' | 'success' }> = {
  ativa: { label: 'Ativa', tone: 'neutral' },
  revertida: { label: 'Revertida', tone: 'success' },
}

export function FlagHistoryCard({ flag }: { flag: Flag }) {
  const st = STATUS_SECUNDARIO[flag.status]
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <FlagTipoBadge tipo={flag.tipo} />
        <span className="text-[11px] tabular-nums text-muted">{dataHoraBR(flag.criadaEm)}</span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="space-y-0.5 text-xs">
        <p className="text-muted">
          Categoria: <span className="text-zinc-200">{flag.categoria}</span>
        </p>
        <p className="text-muted">
          Motivo: <span className="font-medium text-sky-300">{flag.motivo}</span>
        </p>
        {flag.descricao && (
          <p className="text-muted">
            Descrição: <span className="text-zinc-300">{flag.descricao}</span>
          </p>
        )}
      </div>
      {flag.tipo === 'amarela' && flag.expiraEm && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted">
          <Clock size={11} /> Expira em: {dataBR(flag.expiraEm)}
        </p>
      )}
    </div>
  )
}
