/**
 * ClienteIdentidade — topo do cabeçalho do cliente: nome + status + nicho +
 * badges editáveis (Status / Jornada / Tipo) + botão de editar.
 *
 * COMPARTILHADO pela Ficha e pelo Operacional Tráfego, pra os dois cabeçalhos
 * serem sempre a mesma coisa. `direita` = conteúdo do canto direito (Verba
 * mensal no Operacional, NPS na Ficha).
 */
import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { usePermissoes, PERM } from '@/hooks/usePermissoes'
import { JORNADAS_CLIENTE, jornadaClienteLabel, TIPOS_CLIENTE, tipoClienteLabel } from '@/lib/utils'
import { CONTRATO_INFO, SAUDE_INFO, contratoDoCliente, saudeDaConta } from '@/lib/trafegoCliente'
import { StatusBadges } from '@/components/trafego/TrafegoUI'
import type { Tone } from '@/components/ds'
import type { Cliente } from '@/types/database'

const TOM_BADGE: Partial<Record<Tone, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  success: 'success',
  attention: 'warning',
  warning: 'warning',
  danger: 'danger',
  neutral: 'neutral',
}

export function ClienteIdentidade({
  cliente,
  onChanged,
  onEdit,
  direita,
}: {
  cliente: Cliente
  onChanged: () => void
  onEdit?: () => void
  direita?: ReactNode
}) {
  const { can } = usePermissoes()
  const contrato = contratoDoCliente(cliente)
  const saude = saudeDaConta(cliente)

  async function updateField(field: string, val: string | null) {
    await supabase.from('clientes').update({ [field]: val }).eq('id', cliente.id)
    onChanged()
  }

  return (
    <>
      {/* Top: nome + status + (canto direito) */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-100">{cliente.nome}</h1>
            {/* Dois conceitos separados: contrato × saúde da conta. */}
            <StatusBadges cliente={cliente} />
          </div>
          {cliente.nicho && <p className="mt-1 text-sm text-muted">{cliente.nicho}</p>}
        </div>
        {(direita || onEdit) && (
          <div className="flex items-start gap-2">
            {direita}
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded-md p-1.5 text-muted hover:bg-bg-elev hover:text-brand-300"
                title="Editar cliente"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Badges editáveis */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
        <InlineEditBadge
          label="Contrato"
          value={contrato}
          render={CONTRATO_INFO[contrato].label}
          readOnly={!can(PERM.editarStatus)}
          options={[
            { value: 'ativo', label: 'Ativo' },
            { value: 'pausado', label: 'Pausado' },
            { value: 'encerrado', label: 'Encerrado (churn)' },
          ]}
          onChange={(v) =>
            // Contrato Ativo mantém a marcação de atenção, se houver.
            updateField('status', v === 'pausado' ? 'pausado' : v === 'encerrado' ? 'churn' : cliente.status === 'atencao' ? 'atencao' : 'ativo')
          }
          tone={TOM_BADGE[CONTRATO_INFO[contrato].tone] ?? 'neutral'}
        />
        <InlineEditBadge
          label="Saúde"
          value={saude}
          render={SAUDE_INFO[saude].label}
          // Crítico vem do Controle do Head; saúde só se marca com contrato ativo.
          readOnly={!can(PERM.editarStatus) || contrato !== 'ativo' || saude === 'critico'}
          options={[
            { value: 'estavel', label: 'Estável' },
            { value: 'atencao', label: 'Atenção' },
          ]}
          onChange={(v) => updateField('status', v === 'atencao' ? 'atencao' : 'ativo')}
          tone={TOM_BADGE[SAUDE_INFO[saude].tone] ?? 'neutral'}
        />
        <InlineEditBadge
          label="Jornada"
          value={cliente.jornada ?? ''}
          render={cliente.jornada ? jornadaClienteLabel[cliente.jornada] : '—'}
          options={[
            { value: '', label: '—' },
            ...JORNADAS_CLIENTE.map((j) => ({ value: j, label: jornadaClienteLabel[j] })),
          ]}
          onChange={(v) => updateField('jornada', v || null)}
          tone="info"
        />
        <InlineEditBadge
          label="Tipo"
          value={cliente.tipo ?? ''}
          render={cliente.tipo ? tipoClienteLabel[cliente.tipo] : '—'}
          options={[
            { value: '', label: '—' },
            ...TIPOS_CLIENTE.map((t) => ({ value: t, label: tipoClienteLabel[t] })),
          ]}
          onChange={(v) => updateField('tipo', v || null)}
          tone="brand"
        />
      </div>
    </>
  )
}

export function InlineEditBadge({
  label,
  value,
  render,
  options,
  onChange,
  tone,
  readOnly = false,
}: {
  label: string
  value: string
  render: string
  options: { value: string; label: string }[]
  onChange: (v: string) => Promise<void>
  tone: 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  // Sem permissão de edição → mostra só o badge, sem lápis nem select.
  if (readOnly) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-muted">{label}:</span>
        <Badge tone={tone}>{render}</Badge>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted">{label}:</span>
      {editing ? (
        <select
          autoFocus
          value={value}
          onChange={async (e) => {
            await onChange(e.target.value)
            setEditing(false)
          }}
          onBlur={() => setEditing(false)}
          className="h-6 rounded-md border border-brand-500 bg-bg-soft px-1.5 text-[11px] text-zinc-100 focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <Badge tone={tone}>{render}</Badge>
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-muted hover:bg-bg-elev hover:text-brand-300"
            title={`Editar ${label.toLowerCase()}`}
          >
            <Pencil size={10} />
          </button>
        </>
      )}
    </div>
  )
}
