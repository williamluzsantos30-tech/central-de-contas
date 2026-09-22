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
  type ResultadoTentativa,
  type TentativaContato,
  type TipoAbordagemSocial,
  type TentativaAbordagemSocial,
} from './mockLeads'
import {
  SLA_CONFIG_INICIAL,
  METAS_MARKETING_INICIAL,
  type SlaConfigComercial,
  type MetasMarketing,
} from './mockComercialConfig'
import { MOCK_INVESTIMENTOS, type InvestimentoMarketing } from './mockInvestimentos'
import { MOCK_METAS_COMERCIAIS, type MetaComercial } from './mockMetasComerciais'

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

/** Resultado da call registrado pelo Closer (4 desfechos possíveis). */
export type ResultadoCall =
  | {
      tipo: 'fechou'
      mrr: number
      caixaRecolhido: number
      contratoFechado: number
      squad: string
      tipoServico: string
    }
  | { tipo: 'perdido'; motivoPerda: string }
  | { tipo: 'no_show'; novaData: string; novaHora: string }
  | { tipo: 'followup'; dataProximoContato: string; observacao: string }

/** Um lançamento de investimento de mídia (por canal) no modal. */
export interface LancamentoInvestimento {
  canal: string
  valor: number
}

interface ComercialCtx {
  leads: Lead[]
  /** Config de SLA por etapa (editável em Configurações › Geral). */
  slaConfig: SlaConfigComercial
  setSlaConfig: (cfg: SlaConfigComercial) => void
  /** Investimento de mídia por período/canal (input manual do Marketing). */
  investimentos: InvestimentoMarketing[]
  /** Substitui os lançamentos de um período pelos informados. */
  registrarInvestimentos: (periodo: string, lancamentos: LancamentoInvestimento[]) => void
  /** Metas de Marketing (editáveis em Configurações › Geral). */
  metasMarketing: MetasMarketing
  setMetasMarketing: (m: MetasMarketing) => void
  /** Metas Comerciais (mensais/semanais por métrica do funil). */
  metasComerciais: MetaComercial[]
  criarMetas: (metas: Omit<MetaComercial, 'id'>[]) => void
  atualizarMeta: (id: string, patch: Partial<Omit<MetaComercial, 'id'>>) => void
  excluirMeta: (id: string) => void
  /** Social Selling: cadastra manualmente um lead captado (etapa "prospectado"). */
  criarLead: (dados: NovoLeadInput) => void
  /** Social Selling: registra uma tentativa de abordagem (mantém "prospectado"). */
  registrarAbordagemSocial: (
    leadId: string,
    dados: { tipo: TipoAbordagemSocial; observacao?: string; proximaAbordagem?: string },
  ) => void
  /** Social Selling: arquiva a prospecção que não engajou. */
  arquivarLead: (leadId: string) => void
  /** Social Selling → Caixa de Entrada unificada (sem SDR pré-atribuído). */
  enviarParaCaixa: (leadId: string) => void
  /** CRM externo (webhook): injeta um lead já montado direto na Caixa. */
  receberLeadExterno: (lead: Lead) => void
  /** Caixa de Entrada: um SDR "puxa" o lead e assume o atendimento. */
  iniciarAtendimento: (leadId: string, sdrId: string) => void
  /** SDR: salva a qualificação estruturada e envia pro Closer. */
  qualificarLead: (leadId: string, dados: DadosQualificacao) => void
  /** SDR: registra uma tentativa de contato (mantém em "em_qualificacao"). */
  registrarTentativa: (
    leadId: string,
    dados: { resultado: ResultadoTentativa; observacao?: string; proximoContato?: string },
  ) => void
  /** SDR: desqualifica o lead (vira "perdido"). */
  desqualificarLead: (leadId: string, motivo: string) => void
  /** Closer: registra o resultado da call. Se fechar, cria o Cliente real. */
  registrarResultado: (leadId: string, resultado: ResultadoCall) => Promise<void>
}

const Ctx = createContext<ComercialCtx | null>(null)

export function ComercialProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [slaConfig, setSlaConfig] = useState<SlaConfigComercial>(SLA_CONFIG_INICIAL)
  const [investimentos, setInvestimentos] = useState<InvestimentoMarketing[]>(MOCK_INVESTIMENTOS)
  const [metasMarketing, setMetasMarketing] = useState<MetasMarketing>(METAS_MARKETING_INICIAL)
  const [metasComerciais, setMetasComerciais] = useState<MetaComercial[]>(MOCK_METAS_COMERCIAIS)

  const criarMetas = useCallback((metas: Omit<MetaComercial, 'id'>[]) => {
    const novas = metas.map((m, i) => ({ ...m, id: `meta-${Date.now()}-${i}` }))
    setMetasComerciais((prev) => [...prev, ...novas])
  }, [])
  const atualizarMeta = useCallback((id: string, patch: Partial<Omit<MetaComercial, 'id'>>) => {
    setMetasComerciais((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])
  const excluirMeta = useCallback((id: string) => {
    setMetasComerciais((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const registrarInvestimentos = useCallback((periodo: string, lancamentos: LancamentoInvestimento[]) => {
    setInvestimentos((prev) => [
      ...prev.filter((i) => i.periodo !== periodo),
      ...lancamentos.map((l) => ({
        id: `inv-${periodo}-${l.canal}`,
        periodo,
        canal: l.canal,
        valor: l.valor,
      })),
    ])
  }, [])

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

  const registrarAbordagemSocial = useCallback(
    (leadId: string, dados: { tipo: TipoAbordagemSocial; observacao?: string; proximaAbordagem?: string }) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l
          const nova: TentativaAbordagemSocial = {
            id: `abord-${Date.now()}`,
            data: new Date().toISOString(),
            tipo: dados.tipo,
            observacao: dados.observacao?.trim() || undefined,
            socialSellerId: l.socialSellerId,
          }
          return {
            ...l,
            tentativasAbordagemSocial: [...(l.tentativasAbordagemSocial ?? []), nova],
            contadorTentativasSocial: (l.contadorTentativasSocial ?? 0) + 1,
            proximaAbordagem: dados.proximaAbordagem || undefined,
          }
        }),
      )
    },
    [],
  )

  const arquivarLead = useCallback(
    (leadId: string) => patchLead(leadId, { arquivado: true }),
    [patchLead],
  )

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

  const registrarTentativa = useCallback(
    (
      leadId: string,
      dados: { resultado: ResultadoTentativa; observacao?: string; proximoContato?: string },
    ) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l
          const nova: TentativaContato = {
            id: `tent-${Date.now()}`,
            data: new Date().toISOString(),
            resultado: dados.resultado,
            observacao: dados.observacao?.trim() || undefined,
            sdrId: l.sdrId ?? '',
          }
          return {
            ...l,
            etapaFunil: 'em_qualificacao',
            tentativasContato: [...(l.tentativasContato ?? []), nova],
            contadorTentativas: (l.contadorTentativas ?? 0) + 1,
            proximoContato: dados.proximoContato || undefined,
          }
        }),
      )
    },
    [],
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

      if (r.tipo === 'perdido') {
        patchLead(leadId, {
          etapaFunil: 'perdido',
          motivoPerda: r.motivoPerda,
          dataFechamento: hoje,
          subStatusNegociacao: undefined,
        })
        return
      }

      if (r.tipo === 'no_show') {
        // No-show: incrementa o contador e reagenda, mantendo o lead com o
        // mesmo Closer e briefing (não volta ao SDR).
        patchLead(leadId, {
          etapaFunil: 'em_negociacao',
          subStatusNegociacao: 'no_show',
          contadorNoShow: (lead.contadorNoShow ?? 0) + 1,
          dataReuniaoAgendada: r.novaData,
          reuniao: {
            data: r.novaData,
            hora: r.novaHora,
            linkCall: lead.reuniao?.linkCall ?? '',
            closerId: lead.closerId ?? lead.reuniao?.closerId ?? '',
          },
        })
        return
      }

      if (r.tipo === 'followup') {
        patchLead(leadId, {
          etapaFunil: 'em_negociacao',
          subStatusNegociacao: 'em_followup',
          dataProximoContato: r.dataProximoContato,
          historicoFollowups: [
            ...(lead.historicoFollowups ?? []),
            { data: hoje, observacao: r.observacao },
          ],
        })
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
        verba_mensal: r.mrr,
        data_inicio: hoje,
        fonte_crm: 'nativo',
        observacoes: `Origem: Comercial · fechado por ${lead.closerId ?? '—'} (lead ${lead.id})`,
      }
      const { data, error } = await supabase.from('clientes').insert(payload).select('id').single()
      if (error) throw error

      patchLead(leadId, {
        etapaFunil: 'fechado',
        mrr: r.mrr,
        caixaRecolhido: r.caixaRecolhido,
        contratoFechado: r.contratoFechado,
        dataFechamento: hoje,
        clienteId: (data?.id as string) ?? undefined,
        subStatusNegociacao: undefined,
      })
    },
    [leads, patchLead],
  )

  const value = useMemo<ComercialCtx>(
    () => ({
      leads,
      slaConfig,
      setSlaConfig,
      investimentos,
      registrarInvestimentos,
      metasMarketing,
      setMetasMarketing,
      metasComerciais,
      criarMetas,
      atualizarMeta,
      excluirMeta,
      criarLead,
      registrarAbordagemSocial,
      arquivarLead,
      enviarParaCaixa,
      receberLeadExterno,
      iniciarAtendimento,
      qualificarLead,
      registrarTentativa,
      desqualificarLead,
      registrarResultado,
    }),
    [
      leads,
      slaConfig,
      investimentos,
      registrarInvestimentos,
      metasMarketing,
      metasComerciais,
      criarMetas,
      atualizarMeta,
      excluirMeta,
      criarLead,
      registrarAbordagemSocial,
      arquivarLead,
      enviarParaCaixa,
      receberLeadExterno,
      iniciarAtendimento,
      qualificarLead,
      registrarTentativa,
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
