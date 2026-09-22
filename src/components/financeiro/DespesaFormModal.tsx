/**
 * DespesaFormModal — cadastro/edição de despesa.
 *
 * Regras:
 *  - Recorrência mensal (fixa/variável) mostra aviso + "Repetir até" (ou
 *    Indeterminado).
 *  - Status "Atrasado" é sugerido quando a competência já passou e a despesa
 *    segue pendente sem pagamento.
 *  - Despesa de origem "integração externa": só categoria e setor são
 *    editáveis (o resto é a fonte de verdade da ferramenta externa).
 *  - Editar uma projeção de recorrência a materializa como despesa real.
 */
import { useEffect, useState } from 'react'
import { Info, Plug } from 'lucide-react'
import { Modal, Input, Select, Textarea, PrimaryButton, OutlineButton } from '@/components/ds'
import {
  CATEGORIAS,
  RECORRENCIAS,
  STATUS_DESPESA,
  SETORES_DESPESA,
  type Despesa,
  type CategoriaDespesa,
  type StatusDespesa,
  type TipoRecorrencia,
} from '@/pages/financeiro/mockDespesas'
import { mesAtualISO } from '@/pages/financeiro/despesasCalculator'
import { useFinanceiro } from '@/pages/financeiro/store'

/** Despesa a editar; null = nova. periodoPadrao pré-preenche a competência de uma nova. */
export function DespesaFormModal({
  open,
  onClose,
  despesa,
  periodoPadrao,
}: {
  open: boolean
  onClose: () => void
  despesa: Despesa | null
  periodoPadrao?: string
}) {
  const { salvarDespesa } = useFinanceiro()
  const bloqueado = despesa?.origem === 'integracao_externa'
  const editando = !!despesa && !despesa.projecao

  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaDespesa>('custo_fixo')
  const [setor, setSetor] = useState('Geral')
  const [valor, setValor] = useState('')
  const [recorrencia, setRecorrencia] = useState<TipoRecorrencia>('unica')
  const [indeterminado, setIndeterminado] = useState(true)
  const [repetirAte, setRepetirAte] = useState('')
  const [competencia, setCompetencia] = useState(mesAtualISO())
  const [pagamento, setPagamento] = useState('')
  const [status, setStatus] = useState<StatusDespesa>('pendente')
  const [fornecedor, setFornecedor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    if (despesa) {
      setDescricao(despesa.descricao)
      setCategoria(despesa.categoria)
      setSetor(despesa.setor || 'Geral')
      setValor(String(despesa.valor))
      setRecorrencia(despesa.tipoRecorrencia)
      setIndeterminado(despesa.repetirAte == null)
      setRepetirAte(despesa.repetirAte ?? '')
      setCompetencia(despesa.dataCompetencia)
      setPagamento(despesa.dataPagamento ?? '')
      setStatus(despesa.status)
      setFornecedor(despesa.fornecedor ?? '')
      setObservacao(despesa.observacao ?? '')
    } else {
      setDescricao('')
      setCategoria('custo_fixo')
      setSetor('Geral')
      setValor('')
      setRecorrencia('unica')
      setIndeterminado(true)
      setRepetirAte('')
      setCompetencia(periodoPadrao || mesAtualISO())
      setPagamento('')
      setStatus('pendente')
      setFornecedor('')
      setObservacao('')
    }
  }, [open, despesa, periodoPadrao])

  const recorrente = recorrencia !== 'unica'
  // Sugestão de "Atrasado": competência passada, pendente e sem pagamento.
  const sugereAtrasado = status === 'pendente' && !pagamento && competencia < mesAtualISO()

  function salvar() {
    if (!descricao.trim() || !competencia || !(Number(valor) > 0)) {
      setErro('Preencha descrição, valor (> 0) e competência.')
      return
    }
    const base: Despesa = {
      id: despesa?.id ?? '',
      descricao: descricao.trim(),
      categoria,
      setor: setor || 'Geral',
      valor: Number(valor),
      tipoRecorrencia: recorrencia,
      dataCompetencia: competencia,
      dataPagamento: pagamento || undefined,
      status,
      fornecedor: fornecedor.trim() || undefined,
      observacao: observacao.trim() || undefined,
      repetirAte: recorrente ? (indeterminado ? null : repetirAte || null) : undefined,
      origem: despesa?.origem ?? 'manual',
      origemDetalhe: despesa?.origemDetalhe,
      recorrenciaModeloId: despesa?.recorrenciaModeloId,
      projecao: despesa?.projecao,
    }
    salvarDespesa(base)
    onClose()
  }

  const titulo = despesa
    ? despesa.projecao
      ? 'Confirmar despesa recorrente'
      : 'Editar despesa'
    : 'Nova despesa'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo}
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <OutlineButton size="sm" onClick={onClose}>Cancelar</OutlineButton>
          <PrimaryButton size="sm" onClick={salvar}>Salvar</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        {bloqueado && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-[11px] text-blue-200">
            <Plug size={13} className="mt-0.5 shrink-0" />
            <span>
              Despesa recebida via <strong>{despesa?.origemDetalhe?.provedor}</strong>. Os dados financeiros são
              gerenciados na ferramenta de origem — aqui você ajusta só <strong>categoria</strong> e <strong>setor</strong> (metadados internos).
            </span>
          </div>
        )}
        {despesa?.projecao && (
          <div className="flex items-start gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 p-3 text-[11px] text-brand-200">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>Lançamento gerado automaticamente pela recorrência. Ao salvar, ele é confirmado neste mês (o modelo e os meses anteriores não mudam).</span>
          </div>
        )}

        <Campo label="Descrição *">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: Folha de Pagamento — Setembro" disabled={bloqueado} />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Categoria *">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDespesa)}>
              {CATEGORIAS.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>
          </Campo>
          <Campo label="Setor">
            <Select value={setor} onChange={(e) => setSetor(e.target.value)}>
              {SETORES_DESPESA.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Campo>
          <Campo label="Valor (R$) *">
            <Input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" disabled={bloqueado} />
          </Campo>
          <Campo label="Tipo de recorrência *">
            <Select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as TipoRecorrencia)} disabled={bloqueado}>
              {RECORRENCIAS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </Select>
          </Campo>
        </div>

        {recorrente && !bloqueado && (
          <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
            <p className="mb-2 flex items-start gap-1.5 text-[11px] text-muted">
              <Info size={12} className="mt-0.5 shrink-0 text-brand-300" />
              Esta despesa será considerada automaticamente todo mês a partir da competência informada
              {recorrencia === 'mensal_variavel' && ' (o valor pode ser ajustado a cada mês)'}.
            </p>
            <label className="flex items-center gap-2 text-[11px] text-zinc-300">
              <input type="checkbox" checked={indeterminado} onChange={(e) => setIndeterminado(e.target.checked)} className="accent-brand-500" />
              Repetir por tempo indeterminado
            </label>
            {!indeterminado && (
              <div className="mt-2 max-w-xs">
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Repetir até</label>
                <Input type="month" value={repetirAte} onChange={(e) => setRepetirAte(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Competência *">
            <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} disabled={bloqueado} />
          </Campo>
          <Campo label="Data de pagamento">
            <Input type="date" value={pagamento} onChange={(e) => setPagamento(e.target.value)} disabled={bloqueado} />
          </Campo>
        </div>

        <Campo label="Status *">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusDespesa)} disabled={bloqueado}>
            {STATUS_DESPESA.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </Select>
          {sugereAtrasado && (
            <p className="mt-1 text-[10px] text-red-300">
              A competência já passou e não há pagamento — sugerido marcar como <strong>Atrasado</strong>.
            </p>
          )}
        </Campo>

        {!bloqueado && (
          <Campo label="Fornecedor">
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="opcional" />
          </Campo>
        )}
        {!bloqueado && (
          <Campo label="Observação">
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="opcional" />
          </Campo>
        )}

        {editando && <p className="text-[10px] text-muted">Editando um lançamento já existente — meses anteriores não são afetados.</p>}
        {erro && <p className="text-xs text-red-300">{erro}</p>}
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
