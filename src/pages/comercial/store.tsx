/**
 * Store do setor COMERCIAL.
 *
 * Centraliza os Leads e as transições do funil (handoffs) — um lead enviado
 * no Social Selling aparece na fila do SDR, o qualificado aparece pro Closer.
 *
 * PERSISTÊNCIA (migration 088): comercial_leads (JSONB), investimentos_marketing,
 * metas_comerciais e comercial_config (SLA/Metas Marketing/Integração;
 * taxas de conversão ideal na coluna taxas_conversao_ideal, migration 095).
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
  TAXAS_CONVERSAO_IDEAL_INICIAL,
  normalizarTaxasIdeais,
  type SlaConfigComercial,
  type MetasMarketing,
  type TaxasConversaoIdeal,
} from './mockComercialConfig'
import { MOCK_INVESTIMENTOS, type InvestimentoMarketing } from './mockInvestimentos'
import { MOCK_METAS_COMERCIAIS, type MetaComercial } from './mockMetasComerciais'
import {
  INTEGRACAO_INICIAL,
  escritaHabilitada,
  normalizarIntegracao,
  type IntegracaoConfig,
} from './mockIntegrations'
import {
  novoLogId,
  statusSaidaDoLead,
  syncLeadToCRM,
  vinculadoAoCrmAtivo,
  type LogSincronizacaoCRM,
  type ResultadoSync,
  type TipoSync,
} from './crmSync'
import { MOCK_SYNC_LOGS } from './mockSyncLogs'

const todayISO = () => new Date().toISOString().slice(0, 10)

// ── Log de sincronização com CRM (tabela crm_sync_logs, migration 093) ─────
const LOGS_KEY = 'crm-sync-logs'
const MAX_LOGS = 300
type LogRow = {
  id: string
  lead_id: string
  lead_nome: string
  tipo: TipoSync
  status: 'sucesso' | 'erro'
  provider: string
  payload_enviado: Record<string, unknown>
  resposta_erro: string | null
  created_at: string
}
const rowToLog = (r: LogRow): LogSincronizacaoCRM => ({
  id: r.id,
  leadId: r.lead_id,
  leadNome: r.lead_nome,
  tipo: r.tipo,
  status: r.status,
  provider: r.provider as LogSincronizacaoCRM['provider'],
  payloadEnviado: r.payload_enviado ?? {},
  respostaErro: r.resposta_erro ?? undefined,
  timestamp: r.created_at,
})
const logToRow = (l: LogSincronizacaoCRM): LogRow => ({
  id: l.id,
  lead_id: l.leadId,
  lead_nome: l.leadNome,
  tipo: l.tipo,
  status: l.status,
  provider: l.provider,
  payload_enviado: l.payloadEnviado,
  resposta_erro: l.respostaErro ?? null,
  created_at: l.timestamp,
})
function lerLogsLocal(): LogSincronizacaoCRM[] | null {
  try {
    const raw = window.localStorage.getItem(LOGS_KEY)
    return raw ? (JSON.parse(raw) as LogSincronizacaoCRM[]) : null
  } catch {
    return null
  }
}
function gravarLogsLocal(logs: LogSincronizacaoCRM[]) {
  try {
    window.localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)))
  } catch {
    /* indisponível */
  }
}

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
  /** Taxas de conversão ideal entre etapas (Ideal Recalculado em Comercial › Marketing). */
  taxasConversaoIdeal: TaxasConversaoIdeal
  setTaxasConversaoIdeal: (t: TaxasConversaoIdeal) => void
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
  // ── Integração com CRM (entrada + saída/bidirecional) ────────────────────
  integracaoCrm: IntegracaoConfig
  setIntegracaoCrm: (next: IntegracaoConfig | ((c: IntegracaoConfig) => IntegracaoConfig)) => void
  /** Histórico de envios ao CRM (mais recente primeiro). */
  syncLogs: LogSincronizacaoCRM[]
  /** Retry manual: re-envia o lead ao CRM (cria se ainda não tem vínculo). */
  sincronizarLead: (leadId: string) => Promise<void>
  /** Ferramenta de dev (Configurações): força um envio de sucesso ou falha. Devolve a mensagem pro aviso. */
  simularSincronizacaoCRM: (modo: 'sucesso' | 'erro') => Promise<string>
}

const Ctx = createContext<ComercialCtx | null>(null)

export function ComercialProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [slaConfig, setSlaConfigState] = useState<SlaConfigComercial>(SLA_CONFIG_INICIAL)
  const [investimentos, setInvestimentos] = useState<InvestimentoMarketing[]>(MOCK_INVESTIMENTOS)
  const [metasMarketing, setMetasMarketingState] = useState<MetasMarketing>(METAS_MARKETING_INICIAL)
  const [taxasConversaoIdeal, setTaxasState] = useState<TaxasConversaoIdeal>(TAXAS_CONVERSAO_IDEAL_INICIAL)
  const taxasTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [metasComerciais, setMetasComerciais] = useState<MetaComercial[]>(MOCK_METAS_COMERCIAIS)
  const [carregando, setCarregando] = useState(true)
  // true quando as tabelas existem (persiste); false = fallback mock em memória.
  const modoBanco = useRef(false)

  // Integração com CRM (config compartilhada: Configurações edita, Social
  // Selling/Closer usam pra sincronizar). Refs = leitura sempre atual dentro
  // dos callbacks assíncronos, sem recriar os callbacks a cada mudança.
  const [integracaoCrm, setIntegracaoState] = useState<IntegracaoConfig>(INTEGRACAO_INICIAL)
  const integracaoRef = useRef<IntegracaoConfig>(INTEGRACAO_INICIAL)
  const cfgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [syncLogs, setSyncLogs] = useState<LogSincronizacaoCRM[]>(MOCK_SYNC_LOGS)
  // true quando crm_sync_logs existe (migration 093); senão log vai pro localStorage.
  const logsBanco = useRef(false)
  const leadsRef = useRef<Lead[]>(leads)
  leadsRef.current = leads

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
            supabase.from('comercial_config').upsert({ id: 'default', sla: SLA_CONFIG_INICIAL, metas_marketing: METAS_MARKETING_INICIAL, integracao_crm: INTEGRACAO_INICIAL }),
          ])
          // Log de exemplo acompanha os leads mock (coerente com os estados deles).
          const { error: logErr } = await supabase.from('crm_sync_logs').upsert(MOCK_SYNC_LOGS.map(logToRow))
          logsBanco.current = !logErr
          if (logErr) gravarLogsLocal(MOCK_SYNC_LOGS)
          // estado já está com os mocks (init) — nada a trocar
        } else {
          const [lRes, iRes, mRes, logRes] = await Promise.all([
            supabase.from('comercial_leads').select('data'),
            supabase.from('investimentos_marketing').select('*'),
            supabase.from('metas_comerciais').select('*'),
            supabase.from('crm_sync_logs').select('*').order('created_at', { ascending: false }).limit(MAX_LOGS),
          ])
          if (cancel) return
          setLeads(((lRes.data as { data: Lead }[]) ?? []).map((r) => r.data))
          setInvestimentos(((iRes.data as InvestRow[]) ?? []).map(rowToInvest))
          setMetasComerciais(((mRes.data as MetaRow[]) ?? []).map(rowToMeta))
          setSlaConfigState({ ...SLA_CONFIG_INICIAL, ...((cfg.sla as Partial<SlaConfigComercial>) ?? {}) })
          setMetasMarketingState({ ...METAS_MARKETING_INICIAL, ...((cfg.metas_marketing as Partial<MetasMarketing>) ?? {}) })
          // Coluna da 095 ausente → undefined → defaults.
          setTaxasState(normalizarTaxasIdeais(cfg.taxas_conversao_ideal as Partial<TaxasConversaoIdeal> | null))
          const integ = normalizarIntegracao(cfg.integracao_crm as Partial<IntegracaoConfig> | null)
          integracaoRef.current = integ
          setIntegracaoState(integ)
          // Sem a tabela de log (093 não rodada) → log local, começando vazio
          // (o log de exemplo só faz sentido junto dos leads mock).
          logsBanco.current = !logRes.error
          setSyncLogs(logRes.error ? (lerLogsLocal() ?? []) : ((logRes.data as LogRow[]) ?? []).map(rowToLog))
        }
      } catch {
        // Tabelas ainda não existem (migration 088 não rodada) → mock em memória.
        modoBanco.current = false
        const local = lerLogsLocal()
        if (local && !cancel) setSyncLogs(local)
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
  const setTaxasConversaoIdeal = useCallback((t: TaxasConversaoIdeal) => {
    setTaxasState(t)
    // Debounce (inputs mudam a cada tecla). Upsert SÓ desta coluna: sem a
    // migration 095 falha sozinho, sem afetar SLA/metas/integração.
    if (taxasTimer.current) clearTimeout(taxasTimer.current)
    taxasTimer.current = setTimeout(() => persistConfig({ taxas_conversao_ideal: t }), 600)
  }, [persistConfig])

  // ── Integração CRM: config + log ──────────────────────────────────────────
  const setIntegracaoCrm = useCallback(
    (next: IntegracaoConfig | ((c: IntegracaoConfig) => IntegracaoConfig)) => {
      const valor = typeof next === 'function' ? next(integracaoRef.current) : next
      integracaoRef.current = valor
      setIntegracaoState(valor)
      // Debounce: inputs do mapeamento mudam a cada tecla.
      if (cfgTimer.current) clearTimeout(cfgTimer.current)
      cfgTimer.current = setTimeout(() => persistConfig({ integracao_crm: valor }), 600)
    },
    [persistConfig],
  )

  const registrarLog = useCallback((log: LogSincronizacaoCRM) => {
    setSyncLogs((prev) => {
      const next = [log, ...prev].slice(0, MAX_LOGS)
      if (!logsBanco.current) gravarLogsLocal(next)
      return next
    })
    if (logsBanco.current) {
      void supabase.from('crm_sync_logs').insert(logToRow(log)).then(({ error }) => {
        if (error) console.warn('[comercial] registrarLog', error.message)
      })
    }
  }, [])

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

  // ── Sincronização de saída (Sistema → CRM) ────────────────────────────────
  // Nunca bloqueia a operação interna: o lead/resultado já foi salvo antes;
  // o envio roda em paralelo e só marca o status da sincronização no lead.
  const executarSync = useCallback(
    async (lead: Lead, tipo: TipoSync, opts?: { forcar?: 'sucesso' | 'erro' }): Promise<ResultadoSync> => {
      const cfg = integracaoRef.current
      const r = await syncLeadToCRM(lead, tipo, cfg, opts)
      const agora = new Date().toISOString()
      registrarLog({
        id: novoLogId(),
        leadId: lead.id,
        leadNome: lead.nomeContato,
        tipo,
        status: r.ok ? 'sucesso' : 'erro',
        provider: cfg.provider,
        payloadEnviado: r.payload,
        respostaErro: r.ok ? undefined : r.erro,
        timestamp: agora,
      })
      if (r.ok) {
        patchLead(lead.id, {
          crmExternoId: r.crmExternoId,
          crmExternoProvider: cfg.provider,
          sincronizacaoCRM: 'sincronizado',
          ultimaSincronizacaoCRM: agora,
          erroSincronizacaoCRM: undefined,
        })
      } else {
        patchLead(lead.id, { sincronizacaoCRM: 'erro', ultimaSincronizacaoCRM: agora, erroSincronizacaoCRM: r.erro })
      }
      return r
    },
    [patchLead, registrarLog],
  )

  /** Após o Closer registrar o resultado: atualiza o negócio no CRM (se vinculado). */
  const sincronizarAtualizacao = useCallback(
    (leadAtualizado: Lead) => {
      const cfg = integracaoRef.current
      if (!escritaHabilitada(cfg) || !vinculadoAoCrmAtivo(leadAtualizado, cfg)) return
      patchLead(leadAtualizado.id, { sincronizacaoCRM: 'pendente' })
      void executarSync(leadAtualizado, 'atualizacao')
    },
    [executarSync, patchLead],
  )

  const sincronizarLead = useCallback(
    async (leadId: string) => {
      const lead = leadsRef.current.find((l) => l.id === leadId)
      if (!lead) return
      const cfg = integracaoRef.current
      patchLead(leadId, { sincronizacaoCRM: 'pendente' })
      if (vinculadoAoCrmAtivo(lead, cfg)) {
        await executarSync(lead, 'atualizacao')
        return
      }
      // Ainda não existe no CRM ativo → cria; se já tem desfecho do Closer,
      // em seguida atualiza o status do negócio recém-criado.
      const r = await executarSync(lead, 'criacao')
      if (r.ok && statusSaidaDoLead(lead)) {
        await executarSync({ ...lead, crmExternoId: r.crmExternoId, crmExternoProvider: cfg.provider }, 'atualizacao')
      }
    },
    [executarSync, patchLead],
  )

  const simularSincronizacaoCRM = useCallback(
    async (modo: 'sucesso' | 'erro'): Promise<string> => {
      const cfg = integracaoRef.current
      if (!escritaHabilitada(cfg)) {
        return 'Ative a sincronização bidirecional (integração conectada + escrita ligada) pra simular.'
      }
      const ativos = leadsRef.current.filter((l) => !l.arquivado)
      const doSocial = (l: Lead) => l.origemEntrada !== 'crm_externo'
      const alvo =
        modo === 'sucesso'
          ? // Prefere um lead do Social Selling ainda não espelhado no CRM (criação).
            (ativos.find((l) => doSocial(l) && !vinculadoAoCrmAtivo(l, cfg)) ??
            ativos.find((l) => vinculadoAoCrmAtivo(l, cfg)))
          : // Falha num lead visível no Social Selling, pra exercitar o ⚠ + retry.
            (ativos.find((l) => doSocial(l) && l.etapaFunil === 'prospectado' && l.sincronizacaoCRM !== 'erro') ??
            ativos.find((l) => vinculadoAoCrmAtivo(l, cfg) && l.sincronizacaoCRM !== 'erro'))
      if (!alvo) return 'Nenhum lead disponível pra simular.'
      const tipo: TipoSync = vinculadoAoCrmAtivo(alvo, cfg) ? 'atualizacao' : 'criacao'
      patchLead(alvo.id, { sincronizacaoCRM: 'pendente' })
      const r = await executarSync(alvo, tipo, { forcar: modo })
      const oque = tipo === 'criacao' ? 'criação' : 'atualização'
      const tela = alvo.etapaFunil === 'prospectado' ? 'Social Selling' : 'Closer'
      return r.ok
        ? `✓ Envio simulado (${oque}) de "${alvo.nomeContato}" — ID no CRM: ${r.crmExternoId}.`
        : `Falha simulada (${oque}) em "${alvo.nomeContato}": ${r.erro} Veja o aviso na tela ${tela} e use "Tentar novamente".`
    },
    [executarSync, patchLead],
  )

  const criarLead = useCallback((dados: NovoLeadInput) => {
    const escrever = escritaHabilitada(integracaoRef.current)
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
      sincronizacaoCRM: escrever ? 'pendente' : 'nao_aplicavel',
    }
    setLeads((prev) => [novo, ...prev])
    persistLead(novo)
    // Cria o registro no CRM em paralelo — o lead já está salvo aqui.
    if (escrever) void executarSync(novo, 'criacao')
  }, [persistLead, executarSync])

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

      // Cada desfecho: salva local PRIMEIRO, depois reflete no CRM (se vinculado).
      const aplicar = (patch: Partial<Lead>) => {
        patchLead(leadId, patch)
        sincronizarAtualizacao({ ...lead, ...patch })
      }

      if (r.tipo === 'perdido') {
        aplicar({ etapaFunil: 'perdido', motivoPerda: r.motivoPerda, dataFechamento: hoje, subStatusNegociacao: undefined })
        return
      }
      if (r.tipo === 'no_show') {
        aplicar({
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
        aplicar({
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

      aplicar({
        etapaFunil: 'fechado',
        mrr: r.mrr,
        caixaRecolhido: r.caixaRecolhido,
        contratoFechado: r.contratoFechado,
        dataFechamento: hoje,
        clienteId: (data?.id as string) ?? undefined,
        subStatusNegociacao: undefined,
      })
    },
    [leads, patchLead, sincronizarAtualizacao],
  )

  // Envios que ficaram 'pendente' (ex.: a aba foi fechada no meio do envio)
  // são reprocessados uma vez após a carga. Na API real, usar chave de
  // idempotência pra não duplicar registro no CRM.
  const pendentesReprocessados = useRef(false)
  useEffect(() => {
    if (carregando || pendentesReprocessados.current) return
    pendentesReprocessados.current = true
    for (const l of leadsRef.current) {
      if (l.sincronizacaoCRM === 'pendente') void sincronizarLead(l.id)
    }
  }, [carregando, sincronizarLead])

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
      taxasConversaoIdeal,
      setTaxasConversaoIdeal,
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
      integracaoCrm,
      setIntegracaoCrm,
      syncLogs,
      sincronizarLead,
      simularSincronizacaoCRM,
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
      taxasConversaoIdeal,
      setTaxasConversaoIdeal,
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
      integracaoCrm,
      setIntegracaoCrm,
      syncLogs,
      sincronizarLead,
      simularSincronizacaoCRM,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useComercial(): ComercialCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useComercial precisa do ComercialProvider')
  return c
}
