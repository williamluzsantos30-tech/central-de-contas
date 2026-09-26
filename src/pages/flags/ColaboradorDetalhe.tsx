/**
 * Gestão de Flags — Detalhe do Colaborador (Tela 2).
 * Badges de status + Resumo + Histórico de flags. "Registrar Flag" já
 * abre com o colaborador travado.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react'
import { PrimaryButton, Badge } from '@/components/ds'
import { useFlags } from './store'
import { RegisterFlagModal, FlagHistoryCard, FlagTipoBadge, dataBR } from './components'
import { derivar, LIMITE_CRITICO_AMARELAS } from './mockFlags'

export default function ColaboradorDetalhe() {
  const { colabId } = useParams()
  const { colaboradores, registrarFlag, reverterFlag } = useFlags()
  const [modalOpen, setModalOpen] = useState(false)

  const colab = colaboradores.find((c) => c.id === colabId)

  if (!colab) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-zinc-200">Colaborador não encontrado.</p>
        <Link to="/flags" className="mt-2 inline-block text-xs text-brand-300 hover:text-brand-200">
          ← Voltar
        </Link>
      </div>
    )
  }

  const d = derivar(colab)
  const flagsOrdenadas = [...colab.flags].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
  const ultima = flagsOrdenadas[0] ?? null

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <Link to="/flags" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-zinc-100">
            <ArrowLeft size={15} /> Voltar
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100">{colab.nome}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {colab.cargo}
            {colab.squad ? ` | ${colab.squad}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="attention">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              Amarelas ativas: {d.amarelasAtivas}/{LIMITE_CRITICO_AMARELAS}
            </Badge>
            <Badge tone={d.vermelhaAtiva ? 'danger' : 'neutral'}>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Vermelha ativa: {d.vermelhaAtiva ? 'Sim' : 'Não'}
            </Badge>
            {d.elegivelDesligamento ? (
              <Badge tone="danger">Elegível a Desligamento</Badge>
            ) : (
              <Badge tone="warning">Ativo</Badge>
            )}
          </div>
        </div>
        <PrimaryButton onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Registrar Flag
        </PrimaryButton>
      </div>

      {/* Alerta: a 1 flag do limite */}
      {!d.elegivelDesligamento && d.amarelasAtivas === LIMITE_CRITICO_AMARELAS - 1 && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-orange-500/40 bg-orange-500/[0.06] px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-orange-300" />
          <div>
            <p className="text-xs font-semibold text-orange-200">Alerta: próxima flag implica desligamento</p>
            <p className="mt-0.5 text-[11px] text-orange-200/80">
              Este colaborador possui {d.amarelasAtivas} flags amarelas ativas. Uma próxima flag o
              tornará elegível para desligamento.
            </p>
          </div>
        </div>
      )}

      {/* Resumo */}
      <section className="mb-5 rounded-lg border border-border bg-bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-100">Resumo</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Última flag</p>
            {ultima ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FlagTipoBadge tipo={ultima.tipo} />
                  <span className="text-sm text-zinc-200">{ultima.motivo}</span>
                </div>
                <p className="text-[11px] tabular-nums text-muted">{dataBR(ultima.criadaEm)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhuma flag.</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Flags nos últimos 30 dias</p>
            <p className="text-3xl font-bold tabular-nums text-zinc-100">{d.flags30d}</p>
          </div>
          <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Total de flags (histórico)</p>
            <p className="text-3xl font-bold tabular-nums text-zinc-100">{d.totalHistorico}</p>
          </div>
        </div>
      </section>

      {/* Histórico */}
      <section className="rounded-lg border border-border bg-bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-100">Histórico de Flags</h2>
        {flagsOrdenadas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nenhuma flag registrada.</p>
        ) : (
          <div className="space-y-3">
            {flagsOrdenadas.map((f) => (
              <FlagHistoryCard key={f.id} flag={f} onReverter={() => reverterFlag(colab.id, f.id)} />
            ))}
          </div>
        )}
      </section>

      <RegisterFlagModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        colaboradores={colaboradores}
        colabFixo={colab.id}
        onRegister={registrarFlag}
      />
    </div>
  )
}
