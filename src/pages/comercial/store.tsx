/**
 * Store do setor COMERCIAL.
 *
 * Mantém os Leads em memória (mock) e centraliza as transições do funil
 * (handoffs) — assim um lead enviado no Social Selling aparece na fila do
 * SDR, e o qualificado aparece pro Closer, sem cada tela ter estado próprio.
 *
 * Quando o Closer fecha, `registrarResultado` cria um Cliente REAL na fonte
 * central (tabela `clientes`, status Onboarding) e grava `clienteId` no lead
 * — reaproveitando a mesma criação usada no modal "Novo Cliente", sem
 * formulário paralelo. Clientes segue sendo a fonte única de clientes ativos;
 * o Comercial é a origem que a alimenta.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import {
  MOCK_LEADS,
  type BantQualificacao,
  type Lead,
  type ReuniaoAgendada,
} from './mockLeads'

const todayISO = () => new Date().toISOString().slice(0, 10)

/** Dados vindos da tela "Cadastrar lead qualificado" (SDR). */
export interface DadosQualificacao {
  nomeMedico: string
  especialidade: string
  instagram: string
  site: string
  canalAquisicao: string
  reuniao: ReuniaoAgendada
  resumoConversa: string
  bant: BantQualificacao
}

/** Cadastro manual de um lead captado (modal "Novo Lead" do Social Selling). */
export interface NovoLeadInput {
  nomeContato: string
  empresa: string
  telefone: string
  email?: string
  origem: string
  observacaoCaptacao?: string
  socialSellerId: string
}

/** Resultado da call registrado pelo Closer. */
export type ResultadoCall =
  | {
      fechou: true
      valorProposta: number
      ticketMensal: number
      squad: string
      tipoServico: string
    }
  | { fechou: false; motivoPerda: string }

interface ComercialCtx {
  leads: Lead[]
  /** Social Selling: cadastra manualmente um lead captado (etapa "prospectado"). */
  criarLead: (dados: NovoLeadInput) => void
  /** Social Selling → Caixa de Entrada unificada (sem SDR pré-atribuído). */
  enviarParaCaixa: (leadId: string) => void
  /** CRM externo (webhook): injeta um lead já montado direto na Caixa. */
  receberLeadExterno: (lead: Lead) => void
  /** Caixa de Entrada: um SDR "puxa" o lead e assume o atendimento. */
  iniciarAtendimento: (leadId: string, sdrId: string) => void
  /** SDR: salva a qualificação estruturada e envia pro Closer. */
  qualificarLead: (leadId: string, dados: DadosQualificacao) => void
  /** SDR: desqualifica o lead (vira "perdido"). */
  desqualificarLead: (leadId: string, motivo: string) => void
  /** Closer: registra o resultado da call. Se fechar, cria o Cliente real. */
  registrarResultado: (leadId: string, resultado: ResultadoCall) => Promise<void>
}

const Ctx = createContext<ComercialCtx | null>(null)

export function ComercialProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)

  const patchLead = useCallback((leadId: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)))
  }, [])

  const criarLead = useCallback((dados: NovoLeadInput) => {
    const novo: Lead = {
      id: `lead-${Date.now()}`,
      nomeContato: dados.nomeContato.trim(),
      empresa: dados.empresa.trim(),
      telefone: dados.telefone.trim(),
      email: dados.email?.trim() || undefined,
      origem: dados.origem,
      etapaFunil: 'prospectado',
      origemEntrada: 'social_selling',
      canalOriginal: dados.origem,
      socialSellerId: dados.socialSellerId,
      dataCaptacao: todayISO(),
      observacaoCaptacao: dados.observacaoCaptacao?.trim() || undefined,
      qualificado: false,
    }
    setLeads((prev) => [novo, ...prev])
  }, [])

  const enviarParaCaixa = useCallback(
    (leadId: string) => {
      patchLead(leadId, {
        etapaFunil: 'caixa_entrada',
        origemEntrada: 'social_selling',
        dataEntrada: todayISO(),
      })
    },
    [patchLead],
  )

  const receberLeadExterno = useCallback((lead: Lead) => {
    setLeads((prev) => [lead, ...prev])
  }, [])

  const iniciarAtendimento = useCallback(
    (leadId: string, sdrId: string) => {
      patchLead(leadId, {
        etapaFunil: 'em_qualificacao',
        sdrId,
        dataEnvioSDR: todayISO(),
      })
    },
    [patchLead],
  )

  const qualificarLead = useCallback(
    (leadId: string, d: DadosQualificacao) => {
      const hoje = todayISO()
      patchLead(leadId, {
        etapaFunil: 'reuniao_agendada',
        qualificado: true,
        nomeMedico: d.nomeMedico,
        especialidade: d.especialidade,
        instagram: d.instagram,
        site: d.site,
        canalAquisicao: d.canalAquisicao,
        origem: d.canalAquisicao || undefined,
        reuniao: d.reuniao,
        resumoConversa: d.resumoConversa,
        bant: d.bant,
        // Briefing que o Closer vê = resumo da conversa (BANT vai junto no lead).
        briefingQualificacao: d.resumoConversa,
        closerId: d.reuniao.closerId,
        dataReuniaoAgendada: d.reuniao.data,
        dataEnvioCloser: hoje,
        motivoDesqualificacao: undefined,
      })
    },
    [patchLead],
  )

  const desqualificarLead = useCallback(
    (leadId: string, motivo: string) => {
      patchLead(leadId, {
        etapaFunil: 'perdido',
        qualificado: false,
        motivoDesqualificacao: motivo,
      })
    },
    [patchLead],
  )

  const registrarResultado = useCallback(
    async (leadId: string, r: ResultadoCall) => {
      const lead = leads.find((l) => l.id === leadId)
      if (!lead) throw new Error('Lead não encontrado.')
      const hoje = todayISO()

      if (!r.fechou) {
        patchLead(leadId, { etapaFunil: 'perdido', motivoPerda: r.motivoPerda, dataFechamento: hoje })
        return
      }

      // Fechou → cria o Cliente real (mesma tabela/lógica do "Novo Cliente"),
      // já em Onboarding, com os dados coletados no funil.
      const payload = {
        nome: lead.empresa.trim() || lead.nomeContato.trim(),
        squad: r.squad || null,
        tipo: r.tipoServico || null,
        modulos: ['trafego'],
        status: 'ativo',
        jornada: 'onboarding',
        verba_mensal: r.ticketMensal,
        data_inicio: hoje,
        fonte_crm: 'nativo',
        observacoes: `Origem: Comercial · fechado por ${lead.closerId ?? '—'} (lead ${lead.id})`,
      }
      const { data, error } = await supabase.from('clientes').insert(payload).select('id').single()
      if (error) throw error

      patchLead(leadId, {
        etapaFunil: 'fechado',
        valorProposta: r.valorProposta,
        dataFechamento: hoje,
        clienteId: (data?.id as string) ?? undefined,
      })
    },
    [leads, patchLead],
  )

  const value = useMemo<ComercialCtx>(
    () => ({
      leads,
      criarLead,
      enviarParaCaixa,
      receberLeadExterno,
      iniciarAtendimento,
      qualificarLead,
      desqualificarLead,
      registrarResultado,
    }),
    [
      leads,
      criarLead,
      enviarParaCaixa,
      receberLeadExterno,
      iniciarAtendimento,
      qualificarLead,
      desqualificarLead,
      registrarResultado,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useComercial(): ComercialCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useComercial precisa do ComercialProvider')
  return c
}
