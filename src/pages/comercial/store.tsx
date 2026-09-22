/**
 * Store do setor COMERCIAL.
 *
 * Centraliza os Leads e as transições do funil (handoffs) — um lead enviado
 * no Social Selling aparece na fila do SDR, o qualificado aparece pro Closer.
 *
 * PERSISTÊNCIA (migration 088): comercial_leads (JSONB), investimentos_marketing,
 * metas_comerciais e comercial_config (SLA/Metas Marketing/Integração).
 * FALLBACK: se as tabelas ainda não existirem, roda no mock em memória (não
 * quebra). Na 1ª carga com banco vazio, faz BOOTSTRAP do mock (grava e passa
 * a persistir). O estado local continua sendo a fonte pro render; cada
 * mutação atualiza o estado E grava no banco (quando disponível).
 *
 * Ao fechar, `registrarResultado` cria um Cliente REAL (tabela `clientes`,
 * Onboarding) e grava `clienteId` no lead — Clientes segue a fonte única.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

// ── Mappers banco ↔ app (investimentos e metas usam colunas reais) ──────────
type InvestRow = { id: string; periodo: string; canal: string; valor: number }
const rowToInvest = (r: InvestRow): InvestimentoMarketing => ({ id: r.id, periodo: r.periodo, canal: r.canal, valor: Number(r.valor) })
const investToRow = (i: InvestimentoMarketing): InvestRow => ({ id: i.id, periodo: i.periodo, canal: i.canal, valor: i.valor })

type MetaRow = { id: string; periodicidade: string; metrica: string; canal: string | null; responsavel_id: string | null; valor_meta: number; periodo_referencia: string }
const rowToMeta = (r: MetaRow): MetaComercial => ({
  id: r.id,
  periodicidade: r.periodicidade as MetaComercial['periodicidade'],
  metrica: r.metrica as MetaComercial['metrica'],
  canal: r.canal ?? undefined,
  responsavelId: r.responsavel_id ?? undefined,
  valorMeta: Number(r.valor_meta),
  periodoReferencia: r.periodo_referencia,
})
const metaToRow = (m: MetaComercial) => ({
  id: m.id,
  periodicidade: m.periodicidade,
  metrica: m.metrica,
  canal: m.canal ?? null,
  responsavel_id: m.responsavelId ?? null,
  valor_meta: m.valorMeta,
  periodo_referencia: m.periodoReferencia,
})

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
  /** true enquanto carrega do banco na 1ª vez. */
  carregando: boolean
  slaConfig: SlaConfigComercial
  setSlaConfig: (cfg: SlaConfigComercial) => void
  investimentos: InvestimentoMarketing[]
  registrarInvestimentos: (periodo: string, lancamentos: LancamentoInvestimento[]) => void
  metasMarketing: MetasMarketing
  setMetasMarketing: (m: MetasMarketing) => void
  metasComerciais: MetaComercial[]
  criarMetas: (metas: Omit<MetaComercial, 'id'>[]) => void
  atualizarMeta: (id: string, patch: Partial<Omit<MetaComercial, 'id'>>) => void
  excluirMeta: (id: string) => void
  criarLead: (dados: NovoLeadInput) => void
  registrarAbordagemSocial: (
    leadId: string,
    dados: { tipo: TipoAbordagemSocial; observacao?: string; proximaAbordagem?: string },
  ) => void
  arquivarLead: (leadId: string) => void
  enviarParaCaixa: (leadId: string) => void
  receberLeadExterno: (lead: Lead) => void
  iniciarAtendimento: (leadId: string, sdrId: string) => void
  qualificarLead: (leadId: string, dados: DadosQualificacao) => void
  registrarTentativa: (
    leadId: string,
    dados: { resultado: ResultadoTentativa; observacao?: string; proximoContato?: string },
  ) => void
  desqualificarLead: (leadId: string, motivo: string) => void
  registrarResultado: (leadId: string, resultado: ResultadoCall) => Promise<void>
}

const Ctx = createContext<ComercialCtx | null>(null)

export function ComercialProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [slaConfig, setSlaConfigState] = useState<SlaConfigComercial>(SLA_CONFIG_INICIAL)
  const [investimentos, setInvestimentos] = useState<InvestimentoMarketing[]>(MOCK_INVESTIMENTOS)
  const [metasMarketing, setMetasMarketingState] = useState<MetasMarketing>(METAS_MARKETING_INICIAL)
  const [metasComerciais, setMetasComerciais] = useState<MetaComercial[]>(MOCK_METAS_COMERCIAIS)
  const [carregando, setCarregando] = useState(true)
  // true quando as tabelas existem (persiste); false = fallback mock em memória.
  const modoBanco = useRef(false)

  // ── Carga inicial: banco → estado, ou bootstrap do mock, ou fallback ──────
  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const { data: cfg, error } = await supabase.from('comercial_config').select('*').eq('id', 'default').maybeSingle()
        if (error) throw error // tabela não existe → cai no catch (mock)
        modoBanco.current = true
        if (!cfg) {
          // Banco fresco → bootstrap do mock (upsert = idempotente contra StrictMode).
          await Promise.all([
            supabase.from('comercial_leads').upsert(MOCK_LEADS.map((l) => ({ id: l.id, data: l }))),
            supabase.from('investimentos_marketing').upsert(MOCK_INVESTIMENTOS.map(investToRow)),
            supabase.from('metas_comerciais').upsert(MOCK_METAS_COMERCIAIS.map(metaToRow)),
            supabase.from('comercial_config').upsert({ id: 'default', sla: SLA_CONFIG_INICIAL, metas_marketing: METAS_MARKETING_INICIAL, integracao_crm: null }),
          ])
          // estado já está com os mocks (init) — nada a trocar
        } else {
          const [lRes, iRes, mRes] = await Promise.all([
            supabase.from('comercial_leads').select('data'),
            supabase.from('investimentos_marketing').select('*'),
            supabase.from('metas_comerciais').select('*'),
          ])
          if (cancel) return
          setLeads(((lRes.data as { data: Lead }[]) ?? []).map((r) => r.data))
          setInvestimentos(((iRes.data as InvestRow[]) ?? []).map(rowToInvest))
          setMetasComerciais(((mRes.data as MetaRow[]) ?? []).map(rowToMeta))
          setSlaConfigState({ ...SLA_CONFIG_INICIAL, ...((cfg.sla as Partial<SlaConfigComercial>) ?? {}) })
          setMetasMarketingState({ ...METAS_MARKETING_INICIAL, ...((cfg.metas_marketing as Partial<MetasMarketing>) ?? {}) })
        }
      } catch {
        // Tabelas ainda não existem (migration 088 não rodada) → mock em memória.
        modoBanco.current = false
      } finally {
        if (!cancel) setCarregando(false)
      }
    }
    load()
    return () => {
      cancel = true
    }
  }, [])

  // ── Persistência (só quando o banco está disponível) ──────────────────────
  const persistLead = useCallback((lead: Lead) => {
    if (!modoBanco.current) return
    void supabase.from('comercial_leads').upsert({ id: lead.id, data: lead }).then(({ error }) => {
      if (error) console.warn('[comercial] persistLead', error.message)
    })
  }, [])
  const persistConfig = useCallback((patch: Record<string, unknown>) => {
    if (!modoBanco.current) return
    void supabase.from('comercial_config').upsert({ id: 'default', ...patch }).then(({ error }) => {
      if (error) console.warn('[comercial] persistConfig', error.message)
    })
  }, [])

  const setSlaConfig = useCallback((cfg: SlaConfigComercial) => {
    setSlaConfigState(cfg)
    persistConfig({ sla: cfg })
  }, [persistConfig])
  const setMetasMarketing = useCallback((m: MetasMarketing) => {
    setMetasMarketingState(m)
    persistConfig({ metas_marketing: m })
  }, [persistConfig])

  // ── Metas comerciais ──────────────────────────────────────────────────────
  const criarMetas = useCallback((metas: Omit<MetaComercial, 'id'>[]) => {
    const novas: MetaComercial[] = metas.map((m, i) => ({ ...m, id: `meta-${Date.now()}-${i}` }))
    setMetasComerciais((prev) => [...prev, ...novas])
    if (modoBanco.current) {
      void supabase.from('metas_comerciais').insert(novas.map(metaToRow)).then(({ error }) => {
        if (error) console.warn('[comercial] criarMetas', error.message)
      })
    }
  }, [])
  const atualizarMeta = useCallback((id: string, patch: Partial<Omit<MetaComercial, 'id'>>) => {
    setMetasComerciais((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    if (modoBanco.current) {
      const row: Record<string, unknown> = {}
      if ('periodicidade' in patch) row.periodicidade = patch.periodicidade
      if ('metrica' in patch) row.metrica = patch.metrica
      if ('canal' in patch) row.canal = patch.canal ?? null
      if ('responsavelId' in patch) row.responsavel_id = patch.responsavelId ?? null
      if ('valorMeta' in patch) row.valor_meta = patch.valorMeta
      if ('periodoReferencia' in patch) row.periodo_referencia = patch.periodoReferencia
      void supabase.from('metas_comerciais').update(row).eq('id', id).then(({ error }) => {
        if (error) console.warn('[comercial] atualizarMeta', error.message)
      })
    }
  }, [])
  const excluirMeta = useCallback((id: string) => {
    setMetasComerciais((prev) => prev.filter((m) => m.id !== id))
    if (modoBanco.current) {
      void supabase.from('metas_comerciais').delete().eq('id', id).then(({ error }) => {
        if (error) console.warn('[comercial] excluirMeta', error.message)
      })
    }
  }, [])

  const registrarInvestimentos = useCallback((periodo: string, lancamentos: LancamentoInvestimento[]) => {
    const rows: InvestimentoMarketing[] = lancamentos.map((l) => ({ id: `inv-${periodo}-${l.canal}`, periodo, canal: l.canal, valor: l.valor }))
    setInvestimentos((prev) => [...prev.filter((i) => i.periodo !== periodo), ...rows])
    if (modoBanco.current) {
      void (async () => {
        await supabase.from('investimentos_marketing').delete().eq('periodo', periodo)
        const { error } = await supabase.from('investimentos_marketing').insert(rows.map(investToRow))
        if (error) console.warn('[comercial] registrarInvestimentos', error.message)
      })()
    }
  }, [])

  // ── Leads ─────────────────────────────────────────────────────────────────
  const patchLead = useCallback((leadId: string, patch: Partial<Lead>) => {
    setLeads((prev) => {
      let alvo: Lead | undefined
      const next = prev.map((l) => {
        if (l.id !== leadId) return l
        alvo = { ...l, ...patch }
        return alvo
      })
      if (alvo) persistLead(alvo)
      return next
    })
  }, [persistLead])

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
    persistLead(novo)
  }, [persistLead])

  const registrarAbordagemSocial = useCallback(
    (leadId: string, dados: { tipo: TipoAbordagemSocial; observacao?: string; proximaAbordagem?: string }) => {
      setLeads((prev) => {
        let alvo: Lead | undefined
        const next = prev.map((l) => {
          if (l.id !== leadId) return l
          const nova: TentativaAbordagemSocial = {
            id: `abord-${Date.now()}`,
            data: new Date().toISOString(),
            tipo: dados.tipo,
            observacao: dados.observacao?.trim() || undefined,
            socialSellerId: l.socialSellerId,
          }
          alvo = {
            ...l,
            tentativasAbordagemSocial: [...(l.tentativasAbordagemSocial ?? []), nova],
            contadorTentativasSocial: (l.contadorTentativasSocial ?? 0) + 1,
            proximaAbordagem: dados.proximaAbordagem || undefined,
          }
          return alvo
        })
        if (alvo) persistLead(alvo)
        return next
      })
    },
    [persistLead],
  )

  const arquivarLead = useCallback((leadId: string) => patchLead(leadId, { arquivado: true }), [patchLead])

  const enviarParaCaixa = useCallback(
    (leadId: string) => {
      patchLead(leadId, { etapaFunil: 'caixa_entrada', origemEntrada: 'social_selling', dataEntrada: todayISO() })
    },
    [patchLead],
  )

  const receberLeadExterno = useCallback((lead: Lead) => {
    setLeads((prev) => [lead, ...prev])
    persistLead(lead)
  }, [persistLead])

  const iniciarAtendimento = useCallback(
    (leadId: string, sdrId: string) => {
      patchLead(leadId, { etapaFunil: 'em_qualificacao', sdrId, dataEnvioSDR: todayISO() })
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
    (leadId: string, dados: { resultado: ResultadoTentativa; observacao?: string; proximoContato?: string }) => {
      setLeads((prev) => {
        let alvo: Lead | undefined
        const next = prev.map((l) => {
          if (l.id !== leadId) return l
          const nova: TentativaContato = {
            id: `tent-${Date.now()}`,
            data: new Date().toISOString(),
            resultado: dados.resultado,
            observacao: dados.observacao?.trim() || undefined,
            sdrId: l.sdrId ?? '',
          }
          alvo = {
            ...l,
            etapaFunil: 'em_qualificacao',
            tentativasContato: [...(l.tentativasContato ?? []), nova],
            contadorTentativas: (l.contadorTentativas ?? 0) + 1,
            proximoContato: dados.proximoContato || undefined,
          }
          return alvo
        })
        if (alvo) persistLead(alvo)
        return next
      })
    },
    [persistLead],
  )

  const desqualificarLead = useCallback(
    (leadId: string, motivo: string) => {
      patchLead(leadId, { etapaFunil: 'perdido', qualificado: false, motivoDesqualificacao: motivo })
    },
    [patchLead],
  )

  const registrarResultado = useCallback(
    async (leadId: string, r: ResultadoCall) => {
      const lead = leads.find((l) => l.id === leadId)
      if (!lead) throw new Error('Lead não encontrado.')
      const hoje = todayISO()

      if (r.tipo === 'perdido') {
        patchLead(leadId, { etapaFunil: 'perdido', motivoPerda: r.motivoPerda, dataFechamento: hoje, subStatusNegociacao: undefined })
        return
      }
      if (r.tipo === 'no_show') {
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
          historicoFollowups: [...(lead.historicoFollowups ?? []), { data: hoje, observacao: r.observacao }],
        })
        return
      }

      // Fechou → cria o Cliente real (mesma tabela/lógica do "Novo Cliente").
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
      carregando,
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
      carregando,
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
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useComercial(): ComercialCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useComercial precisa do ComercialProvider')
  return c
}
