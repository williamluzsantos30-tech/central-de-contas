/**
 * MetaFormModal — cria/edita uma Meta Comercial. Escopo condicional
 * (Geral / Canal / Responsável). Semanal mostra a meta mensal equivalente;
 * mensal oferece dividir automaticamente em metas semanais.
 */
import { useEffect, useState } from 'react'
import { Modal, PrimaryButton, OutlineButton, Input, Select } from '@/components/ds'
import { EQUIPE_COMERCIAL } from '@/pages/comercial/mockLeads'
import { CANAIS_MARKETING } from '@/pages/comercial/mockInvestimentos'
import { semanasDoMes, weekRefOf } from '@/pages/comercial/marketingCalculator'
import {
  METRICAS_META,
  formatMetaValor,
  metricaInfo,
  type MetaComercial,
  type MetricaMeta,
  type Periodicidade,
} from '@/pages/comercial/mockMetasComerciais'
import { useComercial } from '@/pages/comercial/store'

type Escopo = 'geral' | 'canal' | 'responsavel'

const mesAtual = new Date().toISOString().slice(0, 7)

export function MetaFormModal({
  open,
  onClose,
  meta,
  periodicidadePadrao = 'mensal',
}: {
  open: boolean
  onClose: () => void
  meta: MetaComercial | null
  periodicidadePadrao?: Periodicidade
}) {
  const { criarMetas, atualizarMeta } = useComercial()
  const edit = !!meta

  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(periodicidadePadrao)
  const [metrica, setMetrica] = useState<MetricaMeta>('leads')
  const [escopo, setEscopo] = useState<Escopo>('geral')
  const [canal, setCanal] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [valor, setValor] = useState('')
  const [dividir, setDividir] = useState(false)

  useEffect(() => {
    if (!open) return
    if (meta) {
      setPeriodicidade(meta.periodicidade)
      setMetrica(meta.metrica)
      setEscopo(meta.canal ? 'canal' : meta.responsavelId ? 'responsavel' : 'geral')
      setCanal(meta.canal ?? '')
      setResponsavelId(meta.responsavelId ?? '')
      setValor(String(meta.valorMeta))
      setDividir(false)
    } else {
      setPeriodicidade(periodicidadePadrao)
      setMetrica('leads')
      setEscopo('geral')
      setCanal('')
      setResponsavelId('')
      setValor('')
      setDividir(false)
    }
  }, [open, meta, periodicidadePadrao])

  const info = metricaInfo(metrica)
  const nSemanas = semanasDoMes(mesAtual).length
  const valorNum = Number(valor) || 0
  const metaMensalEquivalente = valorNum * nSemanas

  function salvar() {
    if (valorNum <= 0) return
    const base: Omit<MetaComercial, 'id'> = {
      periodicidade,
      metrica,
      canal: escopo === 'canal' ? canal || undefined : undefined,
      responsavelId: escopo === 'responsavel' ? responsavelId || undefined : undefined,
      valorMeta: valorNum,
      periodoReferencia: meta?.periodoReferencia ?? (periodicidade === 'mensal' ? mesAtual : weekRefOf()),
    }
    if (edit && meta) {
      atualizarMeta(meta.id, base)
    } else if (periodicidade === 'mensal' && dividir) {
      // Meta mensal + divisão proporcional em metas semanais do mês.
      const porSemana = Math.round(valorNum / nSemanas)
      const semanais: Omit<MetaComercial, 'id'>[] = semanasDoMes(mesAtual).map((ref) => ({
        ...base,
        periodicidade: 'semanal',
        valorMeta: porSemana,
        periodoReferencia: ref,
      }))
      criarMetas([base, ...semanais])
    } else {
      criarMetas([base])
    }
    onClose()
  }

  const podeSalvar =
    valorNum > 0 && (escopo !== 'canal' || !!canal) && (escopo !== 'responsavel' || !!responsavelId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? 'Editar meta' : 'Nova meta'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar} disabled={!podeSalvar}>Salvar</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Periodicidade">
            <Select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)} disabled={edit}>
              <option value="mensal">Mensal</option>
              <option value="semanal">Semanal</option>
            </Select>
          </Campo>
          <Campo label="Métrica">
            <Select value={metrica} onChange={(e) => setMetrica(e.target.value as MetricaMeta)}>
              {METRICAS_META.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </Select>
          </Campo>
        </div>

        <Campo label="Escopo">
          <Select value={escopo} onChange={(e) => setEscopo(e.target.value as Escopo)}>
            <option value="geral">Geral</option>
            <option value="canal">Por Canal</option>
            <option value="responsavel">Por Responsável</option>
          </Select>
        </Campo>

        {escopo === 'canal' && (
          <Campo label="Canal">
            <Select value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="">Selecione</option>
              {CANAIS_MARKETING.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Campo>
        )}
        {escopo === 'responsavel' && (
          <Campo label="Responsável">
            <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">Selecione</option>
              <optgroup label="SDR">
                {EQUIPE_COMERCIAL.sdrs.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </optgroup>
              <optgroup label="Closer">
                {EQUIPE_COMERCIAL.closers.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </optgroup>
            </Select>
          </Campo>
        )}

        <Campo label={`Valor da meta${info.formato === 'brl' ? ' (R$)' : info.formato === 'pct' ? ' (%)' : ''}`}>
          <Input type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" />
        </Campo>

        {periodicidade === 'semanal' && valorNum > 0 && (
          <p className="text-[11px] text-muted">
            Meta mensal equivalente (× {nSemanas} semanas): {' '}
            <strong className="text-zinc-200">{formatMetaValor(metrica, metaMensalEquivalente)}</strong> — informativo.
          </p>
        )}

        {!edit && periodicidade === 'mensal' && (
          <label className="flex items-center gap-2 text-[11px] text-zinc-300">
            <input type="checkbox" checked={dividir} onChange={(e) => setDividir(e.target.checked)} className="accent-brand-500" />
            Dividir automaticamente em {nSemanas} metas semanais ({valorNum > 0 ? formatMetaValor(metrica, Math.round(valorNum / nSemanas)) : '—'}/semana)
          </label>
        )}
      </div>
    </Modal>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{label}</label>
      {children}
    </div>
  )
}
