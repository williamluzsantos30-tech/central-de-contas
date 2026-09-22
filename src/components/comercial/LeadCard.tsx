/**
 * LeadCard — ficha de contexto ACUMULATIVA do lead, usada nas telas onde ele
 * é trabalhado. Cresce ao longo do funil sem sobrescrever nada:
 *   Seção 1 "Dados Originais" (CRM/form, 100% data-driven — só leitura)
 *   Seção 2 "Qualificação SDR" (BANT + dados + tentativas)
 *   Seção 3 "Resultado Closer" (desfecho da call)
 * Cada seção só renderiza quando incluída em `secoes`; quando incluída mas
 * ainda sem dado, mostra um placeholder "aguardando".
 */
import { useState } from 'react'
import { ChevronDown, FileText, Phone, Target } from 'lucide-react'
import { Badge, type Tone } from '@/components/ds'
import { cn } from '@/lib/utils'
import { fmtBRL } from './LeadsTable'
import { etapaLabel, type DadoOriginalCRM, type Lead } from '@/pages/comercial/mockLeads'

type Secao = 'originais' | 'sdr' | 'closer'

export function LeadCard({ lead, secoes = ['originais', 'sdr', 'closer'] }: { lead: Lead; secoes?: Secao[] }) {
  return (
    <div className="space-y-3">
      {secoes.includes('originais') && <SecaoOriginais lead={lead} />}
      {secoes.includes('sdr') && <SecaoSDR lead={lead} />}
      {secoes.includes('closer') && <SecaoCloser lead={lead} />}
    </div>
  )
}

function Bloco({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
        <span className="text-brand-300">{icon}</span> {titulo}
      </div>
      {children}
    </div>
  )
}

function Linha({ campo, valor }: { campo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/40 py-1.5 last:border-b-0">
      <span className="text-[10px] uppercase tracking-wider text-muted">{campo}</span>
      <span className="whitespace-pre-wrap text-xs text-zinc-200">{valor || '—'}</span>
    </div>
  )
}

// ── Seção 1: Dados Originais (dinâmica) ─────────────────────────────────────
function SecaoOriginais({ lead }: { lead: Lead }) {
  const dados = lead.dadosOriginaisCRM ?? []
  const soltos = dados.filter((d) => !d.grupo)
  const grupos = new Map<string, DadoOriginalCRM[]>()
  for (const d of dados) {
    if (!d.grupo) continue
    if (!grupos.has(d.grupo)) grupos.set(d.grupo, [])
    grupos.get(d.grupo)!.push(d)
  }

  return (
    <Bloco titulo="Dados originais" icon={<FileText size={14} />}>
      {dados.length === 0 ? (
        <p className="text-[11px] text-muted">Sem dados do formulário/CRM de origem.</p>
      ) : (
        <div className="space-y-2">
          {lead.crmProvider && (
            <p className="text-[10px] text-muted">
              via <span className="text-zinc-300">{lead.crmProvider}</span>
            </p>
          )}
          {soltos.length > 0 && (
            <div>
              {soltos.map((d, i) => (
                <Linha key={`s-${i}`} campo={d.campo} valor={d.valor} />
              ))}
            </div>
          )}
          {[...grupos.entries()].map(([nome, campos]) => (
            <GrupoColapsavel key={nome} nome={nome} campos={campos} />
          ))}
        </div>
      )}
    </Bloco>
  )
}

function GrupoColapsavel({ nome, campos }: { nome: string; campos: DadoOriginalCRM[] }) {
  const [aberto, setAberto] = useState(true)
  return (
    <div className="rounded-lg border border-border/60 bg-bg-soft/30">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-zinc-200"
      >
        {nome}
        <ChevronDown size={13} className={cn('transition-transform', aberto ? '' : '-rotate-90')} />
      </button>
      {aberto && (
        <div className="px-2.5 pb-1.5">
          {campos.map((d, i) => (
            <Linha key={i} campo={d.campo} valor={d.valor} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Seção 2: Qualificação SDR ───────────────────────────────────────────────
function SecaoSDR({ lead }: { lead: Lead }) {
  const linhas: { campo: string; valor: string }[] = []
  if (lead.nomeMedico) linhas.push({ campo: 'Nome do médico', valor: lead.nomeMedico })
  if (lead.especialidade) linhas.push({ campo: 'Especialidade', valor: lead.especialidade })
  if (lead.canalAquisicao) linhas.push({ campo: 'Canal de aquisição', valor: lead.canalAquisicao })
  if (lead.resumoConversa) linhas.push({ campo: 'Resumo da conversa', valor: lead.resumoConversa })
  if (lead.bant) {
    const b = lead.bant
    if (b.orcamento) linhas.push({ campo: 'B — Orçamento', valor: b.orcamento })
    if (b.autoridade) linhas.push({ campo: 'A — Autoridade', valor: b.autoridade })
    if (b.necessidade) linhas.push({ campo: 'N — Necessidade', valor: b.necessidade })
    if (b.tempoUrgencia) linhas.push({ campo: 'T — Tempo/Urgência', valor: b.tempoUrgencia })
    if (b.investimentoMensal != null) linhas.push({ campo: 'Investimento mensal', valor: fmtBRL(b.investimentoMensal) })
    if (b.classificacaoLead) linhas.push({ campo: 'Classificação', valor: b.classificacaoLead })
  }
  const nTentativas = lead.tentativasContato?.length ?? 0

  return (
    <Bloco titulo="Qualificação SDR" icon={<Target size={14} />}>
      {linhas.length === 0 && nTentativas === 0 ? (
        <p className="text-[11px] text-muted">Aguardando qualificação do SDR.</p>
      ) : (
        <div>
          {nTentativas > 0 && (
            <p className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-orange-300">
              <Phone size={11} /> {nTentativas} tentativa{nTentativas > 1 ? 's' : ''} de contato
            </p>
          )}
          {linhas.map((l, i) => (
            <Linha key={i} campo={l.campo} valor={l.valor} />
          ))}
        </div>
      )}
    </Bloco>
  )
}

// ── Seção 3: Resultado Closer ───────────────────────────────────────────────
function SecaoCloser({ lead }: { lead: Lead }) {
  const linhas: { campo: string; valor: string }[] = []
  if (lead.etapaFunil === 'fechado') {
    if (lead.mrr != null) linhas.push({ campo: 'MRR', valor: fmtBRL(lead.mrr) })
    if (lead.caixaRecolhido != null) linhas.push({ campo: 'Caixa recolhido', valor: fmtBRL(lead.caixaRecolhido) })
    if (lead.contratoFechado != null) linhas.push({ campo: 'Contrato fechado', valor: fmtBRL(lead.contratoFechado) })
  } else if (lead.etapaFunil === 'perdido') {
    const motivo = lead.motivoPerda ?? lead.motivoDesqualificacao
    if (motivo) linhas.push({ campo: 'Motivo', valor: motivo })
  } else if (lead.subStatusNegociacao === 'no_show') {
    linhas.push({ campo: 'No-show', valor: `${lead.contadorNoShow ?? 1}x — reagendado` })
  } else if (lead.subStatusNegociacao === 'em_followup' && lead.dataProximoContato) {
    linhas.push({ campo: 'Follow-up', valor: `Próximo contato ${lead.dataProximoContato}` })
  }

  const desfecho: Tone =
    lead.etapaFunil === 'fechado' ? 'success' : lead.etapaFunil === 'perdido' ? 'danger' : 'info'

  return (
    <Bloco titulo="Resultado Closer" icon={<Target size={14} />}>
      {linhas.length === 0 ? (
        <p className="text-[11px] text-muted">Aguardando resultado da call.</p>
      ) : (
        <div>
          <Badge tone={desfecho}>{etapaLabel[lead.etapaFunil]}</Badge>
          <div className="mt-1.5">
            {linhas.map((l, i) => (
              <Linha key={i} campo={l.campo} valor={l.valor} />
            ))}
          </div>
        </div>
      )}
    </Bloco>
  )
}
