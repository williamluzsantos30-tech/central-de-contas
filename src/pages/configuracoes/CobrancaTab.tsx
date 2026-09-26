/**
 * Configurações › Cobrança — dados de cobrança da agência (PIX, razão social,
 * CNPJ, instruções) usados no Portal do Cliente. Veio do Admin (26/09/2026).
 * Só admin (aba filtrada em Configuracoes.tsx).
 */
import React, { useEffect, useState } from 'react'
import { CheckCircle2, Wallet, Copy } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/Textarea'

// ============================================================
// Cobranca — dados de pagamento da agencia (PIX, razao social, CNPJ)
// ============================================================
//
// Persistido em configuracoes_agencia (chave='cobranca', valor jsonb).
// Aparece no Portal do Cliente na secao Pagamento pra o cliente
// executar o PIX. Semente do modulo Financeiro.

interface CobrancaForm {
  pix_chave: string
  pix_tipo: string
  pix_nome: string
  razao_social: string
  cnpj: string
  instrucoes: string
}

const COBRANCA_VAZIA: CobrancaForm = {
  pix_chave: '',
  pix_tipo: '',
  pix_nome: '',
  razao_social: '',
  cnpj: '',
  instrucoes: '',
}

export function CobrancaTab() {
  const [form, setForm] = useState<CobrancaForm>(COBRANCA_VAZIA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    supabase
      .from('configuracoes_agencia')
      .select('valor')
      .eq('chave', 'cobranca')
      .maybeSingle()
      .then(({ data }) => {
        const v = (data?.valor ?? {}) as Partial<CobrancaForm>
        setForm({ ...COBRANCA_VAZIA, ...v })
        setLoading(false)
      })
  }, [])

  async function salvar() {
    setError(null)
    setSaving(true)
    // Limpa strings vazias pra nao poluir o jsonb
    const valor: Record<string, string> = {}
    for (const [k, v] of Object.entries(form)) {
      if (v && v.trim()) valor[k] = v.trim()
    }
    const { error: err } = await supabase
      .from('configuracoes_agencia')
      .upsert({ chave: 'cobranca', valor, atualizado_em: new Date().toISOString() })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  async function copiarPix() {
    if (!form.pix_chave) return
    try {
      await navigator.clipboard.writeText(form.pix_chave)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      /* noop */
    }
  }

  const set = (k: keyof CobrancaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  if (loading) {
    return <p className="py-8 text-center text-xs text-muted">Carregando…</p>
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet size={14} className="text-emerald-300" />
            Dados de cobrança da agência
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-muted">
            Esses dados aparecem no <strong className="text-zinc-200">Portal do Cliente</strong>{' '}
            na seção Pagamento, pra o cliente executar o PIX sem precisar perguntar. O dia de
            vencimento e a forma de pagamento são configurados por cliente, na Ficha → Contrato.
          </p>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* PIX */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">PIX</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Chave PIX
                </label>
                <div className="flex gap-2">
                  <Input
                    value={form.pix_chave}
                    onChange={set('pix_chave')}
                    placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                    className="flex-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={copiarPix}
                    disabled={!form.pix_chave}
                    className={cn(
                      'grid w-10 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-40',
                      copiado
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-border bg-bg-soft text-muted hover:text-brand-300',
                    )}
                    title="Copiar chave"
                  >
                    {copiado ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Tipo da chave
                </label>
                <Select value={form.pix_tipo} onChange={set('pix_tipo')}>
                  <option value="">—</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Aleatória</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                Nome do favorecido
              </label>
              <Input
                value={form.pix_nome}
                onChange={set('pix_nome')}
                placeholder="Como aparece no app do banco do cliente"
              />
            </div>
          </div>

          {/* Dados fiscais */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                Razão social
              </label>
              <Input value={form.razao_social} onChange={set('razao_social')} placeholder="Agência LTDA" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                CNPJ
              </label>
              <Input
                value={form.cnpj}
                onChange={set('cnpj')}
                placeholder="00.000.000/0001-00"
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Instruções pro cliente
            </label>
            <Textarea
              value={form.instrucoes}
              onChange={set('instrucoes')}
              placeholder="Ex: Envie o comprovante no grupo do WhatsApp. Emitimos NF em até 2 dias úteis."
              className="min-h-[70px]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            {salvo && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <CheckCircle2 size={12} /> Salvo
              </span>
            )}
            <Button onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="rounded-xl border border-dashed border-border bg-bg-soft/30 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Módulo Financeiro (em breve)
        </p>
        <ul className="mt-2 space-y-1 text-[11px] text-muted">
          <li>· Histórico de faturas e pagamentos por cliente</li>
          <li>· Status em dia / atrasado visível na Ficha e no Portal</li>
          <li>· Alertas de vencimento e de contrato acabando</li>
        </ul>
      </div>
    </div>
  )
}
