/**
 * Esteira de produção da Landing Page — as 6 etapas de sempre, cada uma com
 * responsável e data. Clicar numa etapa de produção move o projeto; clicar
 * numa etapa de aprovação abre o painel de Aprovar/Reprovar.
 */
import { useState } from 'react'
import { Check, Pause, Play, RotateCcw, User } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { temAlgumCargo } from '@/lib/cargos'
import { cn, statusProjetoWebdesignLabel } from '@/lib/utils'
import type { Profile, ProjetoWebdesign } from '@/types/database'
import { APROVACAO_DE, ETAPAS_LP, etapaAtual, responsavelDaEtapa, type EtapaLP, type FluxoLP } from './fluxoLP'

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Quem faz sentido sugerir pra etapa (o resto da equipe continua disponível). */
function sugerido(p: Profile, etapa: EtapaLP): boolean {
  if (etapa === 'aprovacao_copy' || etapa === 'aprovacao_design') return temAlgumCargo(p, ['account_manager', 'head', 'diretoria'])
  if (etapa === 'conclusao') return false
  const papel = semAcento(p.papel?.nome ?? '')
  return temAlgumCargo(p, ['designer', 'social_media']) || /design|copy|criativ|video|web|dev/.test(papel)
}

export function EsteiraLP({
  projeto,
  fluxo,
  equipe,
  onMover,
  onAprovacao,
  onResponsavel,
  onPausar,
  onRetomar,
}: {
  projeto: ProjetoWebdesign
  fluxo: FluxoLP
  equipe: Map<string, Profile>
  onMover: (para: EtapaLP) => void
  onAprovacao: (etapa: EtapaLP) => void
  onResponsavel: (etapa: EtapaLP, id: string | null) => void
  onPausar: () => void
  onRetomar: () => void
}) {
  const pausado = projeto.status === 'pausado'
  const atual = etapaAtual(projeto, fluxo)
  const iAtual = ETAPAS_LP.indexOf(atual)

  return (
    <div>
      {pausado && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2">
          <p className="text-xs text-zinc-100">
            <Pause size={12} className="mr-1 inline text-yellow-400" />
            <strong>Pausado</strong>
            {fluxo.pausa ? <> — {fluxo.pausa.motivo}</> : ' — sem motivo registrado'}
            {fluxo.pausa && (
              <span className="text-muted">
                {' '}· desde {dataCurta(fluxo.pausa.em)} · parou em {statusProjetoWebdesignLabel[fluxo.pausa.etapa]}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={onRetomar}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-card px-2.5 py-1 text-[11px] font-medium text-zinc-100 hover:border-brand-500/50"
          >
            <Play size={11} /> Retomar projeto
          </button>
        </div>
      )}

      <div className={cn('grid grid-cols-3 gap-y-4 sm:grid-cols-6', pausado && 'pointer-events-none opacity-50')}>
        {ETAPAS_LP.map((etapa, i) => (
          <EsteiraEtapaCard
            key={etapa}
            numero={i + 1}
            etapa={etapa}
            estado={i < iAtual ? 'feita' : i === iAtual ? 'atual' : 'futura'}
            ultima={i === ETAPAS_LP.length - 1}
            info={fluxo.etapas[etapa]}
            emRevisao={i === iAtual && fluxo.emRevisao === etapa}
            responsavelId={responsavelDaEtapa(projeto, fluxo, etapa)}
            equipe={equipe}
            onClick={() => (APROVACAO_DE[etapa] ? onAprovacao(etapa) : onMover(etapa))}
            onResponsavel={(id) => onResponsavel(etapa, id)}
          />
        ))}
      </div>

      {!pausado && atual !== 'conclusao' && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onPausar}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted hover:text-zinc-200"
          >
            <Pause size={11} /> Pausar projeto
          </button>
        </div>
      )}
    </div>
  )
}

export function EsteiraEtapaCard({
  numero,
  etapa,
  estado,
  ultima,
  info,
  emRevisao,
  responsavelId,
  equipe,
  onClick,
  onResponsavel,
}: {
  numero: number
  etapa: EtapaLP
  estado: 'feita' | 'atual' | 'futura'
  ultima: boolean
  info?: { iniciadaEm?: string | null; concluidaEm?: string | null }
  emRevisao: boolean
  responsavelId: string | null
  equipe: Map<string, Profile>
  onClick: () => void
  onResponsavel: (id: string | null) => void
}) {
  const [escolhendo, setEscolhendo] = useState(false)
  const pessoa = responsavelId ? equipe.get(responsavelId) : undefined
  const aprovacao = !!APROVACAO_DE[etapa]
  const pessoas = [...equipe.values()]
  const sugeridos = pessoas.filter((p) => sugerido(p, etapa))
  const demais = pessoas.filter((p) => !sugerido(p, etapa))

  return (
    <div className="flex flex-col items-center px-1 text-center">
      {/* Nó + conector */}
      <div className="relative flex w-full items-center justify-center">
        {numero > 1 && <span className={cn('absolute left-0 right-1/2 top-1/2 h-0.5', estado !== 'futura' ? 'bg-emerald-500/40' : 'bg-border')} />}
        {!ultima && <span className={cn('absolute left-1/2 right-0 top-1/2 h-0.5', estado === 'feita' ? 'bg-emerald-500/40' : 'bg-border')} />}
        <button
          type="button"
          onClick={onClick}
          title={aprovacao ? 'Abrir aprovação' : 'Mover o projeto pra esta etapa'}
          className={cn(
            'relative z-10 grid h-8 w-8 place-items-center rounded-full border text-[11px] font-semibold transition-colors',
            estado === 'feita' && 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300',
            estado === 'atual' && !emRevisao && 'border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/30',
            estado === 'atual' && emRevisao && 'border-orange-500 bg-orange-500 text-white',
            estado === 'futura' && 'border-border bg-bg-soft text-muted hover:text-zinc-200',
          )}
        >
          {estado === 'feita' ? <Check size={12} /> : emRevisao ? <RotateCcw size={12} /> : numero}
        </button>
      </div>

      <button
        type="button"
        onClick={onClick}
        className={cn(
          'mt-2 text-[10px] font-semibold uppercase leading-tight tracking-wider hover:text-zinc-100',
          estado === 'atual' ? 'text-brand-300' : 'text-muted',
        )}
      >
        {statusProjetoWebdesignLabel[etapa]}
      </button>

      {/* Responsável */}
      <div className="mt-1.5 h-6">
        {escolhendo ? (
          <select
            autoFocus
            value={responsavelId ?? ''}
            onChange={(e) => {
              setEscolhendo(false)
              onResponsavel(e.target.value || null)
            }}
            onBlur={() => setEscolhendo(false)}
            className="h-6 max-w-[8.5rem] rounded-md border border-brand-500 bg-bg-soft px-1 text-[10px] text-zinc-100 focus:outline-none"
          >
            <option value="">Sem responsável</option>
            {sugeridos.length > 0 && (
              <optgroup label="Sugeridos pra etapa">
                {sugeridos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={sugeridos.length ? 'Demais da equipe' : 'Equipe'}>
              {demais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </optgroup>
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setEscolhendo(true)}
            title={pessoa ? `${pessoa.nome} — clique pra trocar` : 'Atribuir responsável'}
            className={cn(
              'inline-flex h-6 max-w-[8.5rem] items-center gap-1 rounded-full text-[10px]',
              pessoa ? 'pr-1.5 text-zinc-200 hover:bg-bg-elev' : 'border border-dashed border-border px-1.5 text-muted hover:text-zinc-200',
            )}
          >
            {pessoa ? (
              <>
                <Avatar name={pessoa.nome} url={pessoa.avatar_url} size="sm" />
                <span className="truncate">{pessoa.nome.split(' ')[0]}</span>
              </>
            ) : (
              <>
                <User size={10} /> Sem responsável
              </>
            )}
          </button>
        )}
      </div>

      {/* Data */}
      <p className="mt-1 text-[10px] leading-tight text-muted">
        {estado === 'feita' && info?.concluidaEm ? (
          <span className="text-emerald-400">✓ Concluída em {dataCurta(info.concluidaEm)}</span>
        ) : estado === 'atual' && etapa === 'conclusao' && info?.concluidaEm ? (
          <span className="text-emerald-400">✓ Concluída em {dataCurta(info.concluidaEm)}</span>
        ) : estado === 'atual' && info?.iniciadaEm ? (
          `Desde ${dataCurta(info.iniciadaEm)}`
        ) : (
          '—'
        )}
      </p>
      {emRevisao && (
        <span className="mt-1 rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-300">
          Em revisão — reprovado
        </span>
      )}
      {aprovacao && estado === 'atual' && <span className="mt-1 text-[9px] text-brand-300">clique pra aprovar/reprovar</span>}
    </div>
  )
}
