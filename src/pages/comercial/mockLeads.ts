/**
 * Modelo de dados do setor COMERCIAL + mock inicial.
 *
 * Um Lead é a FONTE ÚNICA que atravessa as 3 telas do funil
 * (Social Selling → SDR → Closer), mudando de etapa e de responsável
 * conforme avança. Quando o Closer fecha, o Lead gera um Cliente real na
 * fonte central de Clientes (status Onboarding) e guarda `clienteId` pra
 * rastreabilidade — o Comercial é a ORIGEM que alimenta Clientes, não um
 * cadastro paralelo.
 *
 * Persistência: em memória (mock) via ComercialProvider. Datas em ISO
 * (string), coerente com o resto do app (Cliente/itens usam string).
 */
import type { CrmProvider } from './mockIntegrations'
import { CRIATIVOS_REFERENCIA, MES_REFERENCIA_CRIATIVOS, qualificadosNaEscala } from './criativosReferencia'

export type EtapaFunil =
  | 'prospectado' // captado no Social Selling, aguardando envio à Caixa
  | 'caixa_entrada' // na Caixa de Entrada unificada, aguardando o SDR puxar
  | 'em_qualificacao' // SDR assumiu e está qualificando
  | 'reuniao_agendada' // qualificado (SQL), reunião marcada com o Closer
  | 'em_negociacao' // reunião realizada, proposta em aberto
  | 'fechado' // venda fechada → virou Cliente
  | 'perdido' // desqualificado pelo SDR ou perdido pelo Closer

/** Como o lead entrou na Caixa de Entrada unificada. */
export type OrigemEntrada = 'crm_externo' | 'social_selling'

/** Resultado de uma tentativa de contato do SDR (follow-up pré-qualificação). */
export type ResultadoTentativa =
  | 'nao_atendeu'
  | 'caixa_postal'
  | 'pediu_retorno'
  | 'em_analise'
  | 'numero_invalido'
  | 'outro'

export interface TentativaContato {
  id: string
  data: string // ISO datetime da tentativa
  resultado: ResultadoTentativa
  observacao?: string
  sdrId: string
}

/**
 * Resposta bruta do formulário/CRM de origem. Schema LIVRE — `campo` e
 * `grupo` variam por campanha/formulário. SÓ pra leitura/contexto humano:
 * NUNCA usar em lógica (cálculo, filtro, validação, regra condicional).
 */
export interface DadoOriginalCRM {
  campo: string
  valor: string
  grupo?: string
}

export const RESULTADO_TENTATIVA_OPCOES: { key: ResultadoTentativa; label: string }[] = [
  { key: 'nao_atendeu', label: 'Não atendeu' },
  { key: 'caixa_postal', label: 'Caixa postal' },
  { key: 'pediu_retorno', label: 'Pediu para ligar depois' },
  { key: 'em_analise', label: 'Em análise/decidindo' },
  { key: 'numero_invalido', label: 'Número errado/inválido' },
  { key: 'outro', label: 'Outro' },
]

export function resultadoTentativaLabel(r: ResultadoTentativa): string {
  return RESULTADO_TENTATIVA_OPCOES.find((o) => o.key === r)?.label ?? r
}

/** Tipo de abordagem do Social Selling (prospecção antes do envio à Caixa). */
export type TipoAbordagemSocial =
  | 'dm_enviada'
  | 'comentario'
  | 'engajamento'
  | 'conexao'
  | 'resposta_recebida'
  | 'sem_resposta'
  | 'outro'

export interface TentativaAbordagemSocial {
  id: string
  data: string // ISO datetime
  tipo: TipoAbordagemSocial
  observacao?: string
  socialSellerId: string
}

export const TIPOS_ABORDAGEM_OPCOES: { key: TipoAbordagemSocial; label: string }[] = [
  { key: 'dm_enviada', label: 'DM enviada' },
  { key: 'comentario', label: 'Comentário em post' },
  { key: 'engajamento', label: 'Curtida/Engajamento' },
  { key: 'conexao', label: 'Conexão solicitada' },
  { key: 'resposta_recebida', label: 'Resposta recebida' },
  { key: 'sem_resposta', label: 'Sem resposta' },
  { key: 'outro', label: 'Outro' },
]

export function tipoAbordagemLabel(t: TipoAbordagemSocial): string {
  return TIPOS_ABORDAGEM_OPCOES.find((o) => o.key === t)?.label ?? t
}

export interface CriterioQualificacao {
  pergunta: string
  resposta: string
}

/** Reunião agendada pelo SDR pro Closer. */
export interface ReuniaoAgendada {
  data: string // ISO yyyy-mm-dd
  hora: string // HH:mm
  linkCall: string
  closerId: string
}

/**
 * Estado da sincronização Sistema → CRM externo (bidirecional).
 *   nao_aplicavel — sem CRM com escrita ativa, ou lead sem vínculo no CRM
 *   pendente      — envio em andamento / aguardando
 *   sincronizado  — último envio aceito pelo CRM
 *   erro          — último envio falhou (retry disponível)
 */
export type StatusSincronizacaoCRM = 'nao_aplicavel' | 'pendente' | 'sincronizado' | 'erro'

/**
 * Classificação do lead que chega PRONTA do CRM externo ("LEAD A", "Lead B",
 * "C"…), via mapeamento de campos da integração. O sistema não classifica.
 */
export type ClassificacaoLead = 'A' | 'B' | 'C'

/** Anúncio que originou o lead — vem do CRM (utm_content / ad_name / ad_id). */
export interface CriativoOrigem {
  /** Ex.: "Ad119 - Review 40 consultas" ou "link_in_bio". */
  nomeAnuncio: string
  /** ad_id na Meta Ads, quando disponível (casa com o gasto do criativo). */
  idAnuncioMeta?: string
}

/** Qualificação BANT — padrão obrigatório pra entregar um SQL. */
export interface BantQualificacao {
  orcamento: string // B — disponibilidade de crédito
  autoridade: string // A — decisor único / compartilhado / não é decisor
  necessidade: string // N — produto conduzido
  tempoUrgencia: string // T — imediato / 30 / 60 dias / sem urgência
  investimentoMensal: number | null
  classificacaoLead: string // Quente / Morno / Frio
}

export interface Lead {
  id: string
  nomeContato: string
  empresa: string // nome da clínica/negócio
  telefone: string
  email?: string
  origem: string
  etapaFunil: EtapaFunil

  // Entrada na Caixa unificada (CRM externo ou prospecção do Social Selling)
  origemEntrada?: OrigemEntrada
  /** Canal/fonte original (ex.: "Anúncio Meta", "Indicação", "Prospecção Instagram"). */
  canalOriginal?: string
  /** Nome do CRM de origem quando origemEntrada = 'crm_externo' (ex.: "RD Station"). */
  crmProvider?: string
  /** Quando o lead entrou na Caixa de Entrada (ISO). */
  dataEntrada?: string
  /** Respostas brutas do formulário/CRM de origem (schema livre, só contexto). */
  dadosOriginaisCRM?: DadoOriginalCRM[]

  // Social Selling
  socialSellerId: string // quem captou (só quando origemEntrada = 'social_selling')
  dataCaptacao: string
  observacaoCaptacao?: string
  // Follow-up de abordagem (prospecção antes de enviar à Caixa)
  tentativasAbordagemSocial?: TentativaAbordagemSocial[]
  proximaAbordagem?: string
  contadorTentativasSocial?: number
  /** Prospecção arquivada (não engajou) — sai da lista ativa do Social Selling. */
  arquivado?: boolean

  // SDR
  sdrId?: string
  dataEnvioSDR?: string
  qualificado: boolean
  criteriosQualificacao?: CriterioQualificacao[]
  dataReuniaoAgendada?: string
  motivoDesqualificacao?: string
  // Follow-up do SDR (tentativas de contato antes de qualificar/desqualificar)
  tentativasContato?: TentativaContato[]
  /** Próxima tentativa agendada (ISO datetime). */
  proximoContato?: string
  contadorTentativas?: number

  // Closer
  closerId?: string
  dataEnvioCloser?: string
  briefingQualificacao?: string
  // Valores do fechamento (preenchidos pelo Closer ao marcar "Fechou").
  /** MRR — receita recorrente mensal do negócio (vira o ticket do Cliente). */
  mrr?: number
  /** Caixa recolhido no ato do fechamento (entrada/1ª parcela/implantação). */
  caixaRecolhido?: number
  /** Valor total do contrato assinado (ex.: ticket × meses + taxas). */
  contratoFechado?: number
  dataFechamento?: string
  motivoPerda?: string
  clienteId?: string // preenchido quando fechado → vira Cliente

  // Pós-reunião do Closer — sub-status DENTRO de 'em_negociacao' (não é etapa
  // nova no funil): no-show (não compareceu) e follow-up (proposta enviada,
  // aguardando retorno).
  subStatusNegociacao?: 'no_show' | 'em_followup'
  contadorNoShow?: number
  dataProximoContato?: string // follow-up: quando o Closer deve retornar
  historicoFollowups?: { data: string; observacao: string }[]

  // Cadastro estruturado do SDR (tela "Cadastrar lead qualificado")
  nomeMedico?: string
  especialidade?: string
  instagram?: string
  site?: string
  canalAquisicao?: string
  reuniao?: ReuniaoAgendada
  resumoConversa?: string
  bant?: BantQualificacao

  // Sincronização bidirecional com o CRM externo (Sistema → CRM)
  /** ID do registro/negócio no CRM (vem do webhook de entrada ou da criação via Social Selling). */
  crmExternoId?: string
  /** Provedor que guarda esse registro — atualizações só vão pro mesmo CRM. */
  crmExternoProvider?: CrmProvider
  /** Ausente = 'nao_aplicavel' (leads anteriores à sincronização). */
  sincronizacaoCRM?: StatusSincronizacaoCRM
  /** Última tentativa de envio ao CRM (ISO datetime). */
  ultimaSincronizacaoCRM?: string
  /** Mensagem do último erro (quando sincronizacaoCRM = 'erro'). */
  erroSincronizacaoCRM?: string

  // Tráfego pago (Funil Tráfego) — chegam PRONTOS do CRM, não calculados
  classificacaoCRM?: ClassificacaoLead
  criativoOrigem?: CriativoOrigem
}

/** Pessoa do time comercial (mock — no real seria um profile/papel). */
export interface PessoaComercial {
  id: string
  nome: string
}

export const EQUIPE_COMERCIAL: {
  socialSellers: PessoaComercial[]
  sdrs: PessoaComercial[]
  closers: PessoaComercial[]
} = {
  socialSellers: [
    { id: 'ss-1', nome: 'Marina Alves' },
    { id: 'ss-2', nome: 'Rafael Lima' },
  ],
  sdrs: [
    { id: 'sdr-1', nome: 'Bruno Costa' },
    { id: 'sdr-2', nome: 'Carla Dias' },
  ],
  closers: [
    { id: 'cl-1', nome: 'Diego Souza' },
    { id: 'cl-2', nome: 'Elisa Rocha' },
  ],
}

/** Nome de qualquer pessoa do time comercial por id. */
export function pessoaComercialNome(id?: string | null): string {
  if (!id) return '—'
  const todos = [
    ...EQUIPE_COMERCIAL.socialSellers,
    ...EQUIPE_COMERCIAL.sdrs,
    ...EQUIPE_COMERCIAL.closers,
  ]
  return todos.find((p) => p.id === id)?.nome ?? '—'
}

export const ORIGENS_LEAD = [
  'Instagram',
  'Indicação',
  'Prospecção Ativa',
  'Inbound',
  'Google',
  'Outro',
] as const

export const CANAIS_AQUISICAO = [
  'Instagram',
  'Indicação',
  'Prospecção Ativa (Social Selling)',
  'Inbound',
  'Google',
  'Outro',
] as const

export const AUTORIDADE_OPCOES = [
  'Decisor único',
  'Decisor compartilhado',
  'Não é decisor',
] as const

export const TEMPO_URGENCIA_OPCOES = ['Imediato', '30 dias', '60 dias', 'Sem urgência'] as const

export const CLASSIFICACAO_OPCOES = ['Quente', 'Morno', 'Frio'] as const

export const MOTIVOS_PERDA = ['Preço', 'Timing', 'Concorrência', 'Não teve fit', 'Outro'] as const

/** Rótulo curto da etapa do funil. */
export const etapaLabel: Record<EtapaFunil, string> = {
  prospectado: 'Prospectado',
  caixa_entrada: 'Caixa de entrada',
  em_qualificacao: 'Em qualificação',
  reuniao_agendada: 'Reunião agendada',
  em_negociacao: 'Em negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

/**
 * Uma qualificação BANT só é "completa" (SQL válido) quando todos os campos
 * do framework estão preenchidos — regra de liberação pro Closer.
 */
export function bantCompleto(b?: BantQualificacao | null): boolean {
  if (!b) return false
  return (
    b.orcamento.trim() !== '' &&
    b.autoridade.trim() !== '' &&
    b.necessidade.trim() !== '' &&
    b.tempoUrgencia.trim() !== '' &&
    b.investimentoMensal != null &&
    b.classificacaoLead.trim() !== ''
  )
}

// ── Seed mock: leads distribuídos pelas 6 etapas ──────────────────────────
export const MOCK_LEADS: Lead[] = [
  // Caixa de Entrada — chegou via CRM externo (webhook), não contatado
  {
    id: 'lead-9',
    nomeContato: 'Dra. Renata If',
    empresa: 'Clínica Equilíbrio',
    telefone: '(11) 90000-9090',
    email: 'renata@equilibrio.com',
    origem: 'Anúncio Meta',
    etapaFunil: 'caixa_entrada',
    origemEntrada: 'crm_externo',
    crmProvider: 'RD Station',
    canalOriginal: 'Anúncio Meta',
    dataEntrada: '2026-09-20',
    socialSellerId: '',
    dataCaptacao: '2026-09-20',
    qualificado: false,
    // Formulário com grupo (um dos formatos possíveis) + 1 campo solto.
    dadosOriginaisCRM: [
      { grupo: 'FORM NATIVO MOV', campo: 'Você é', valor: 'Médico(a)' },
      { grupo: 'FORM NATIVO MOV', campo: 'Especialidade', valor: 'Psiquiatria' },
      { grupo: 'FORM NATIVO MOV', campo: 'Quanto você fatura por mês', valor: 'R$ 40 a 60 mil' },
      { grupo: 'FORM NATIVO MOV', campo: 'Já investe em tráfego pago?', valor: 'Sim, no Meta' },
      { campo: 'UTM Campanha', valor: 'set26-psiquiatria-frio' },
    ],
  },
  {
    id: 'lead-10',
    nomeContato: 'Dr. Sérgio Almeida',
    empresa: 'Ortopedia Almeida',
    telefone: '(47) 90000-1122',
    origem: 'Anúncio Google',
    etapaFunil: 'caixa_entrada',
    origemEntrada: 'crm_externo',
    crmProvider: 'HubSpot',
    canalOriginal: 'Anúncio Google',
    dataEntrada: '2026-09-19',
    socialSellerId: '',
    dataCaptacao: '2026-09-19',
    qualificado: false,
    // Conjunto DIFERENTE: menos campos, sem grupo, nomes distintos.
    dadosOriginaisCRM: [
      { campo: 'Nome da clínica', valor: 'Ortopedia Almeida' },
      { campo: 'Cidade', valor: 'Joinville - SC' },
      { campo: 'Melhor horário pra contato', valor: 'À tarde' },
    ],
  },
  // Caixa de Entrada — veio da prospecção ativa (Social Selling)
  {
    id: 'lead-11',
    nomeContato: 'Dra. Beatriz Lopes',
    empresa: 'Clínica Sorriso Real',
    telefone: '(85) 90000-3344',
    origem: 'Prospecção Instagram',
    etapaFunil: 'caixa_entrada',
    origemEntrada: 'social_selling',
    canalOriginal: 'Prospecção Instagram',
    dataEntrada: '2026-09-20',
    socialSellerId: 'ss-2',
    dataCaptacao: '2026-09-17',
    observacaoCaptacao: 'Prospecção via DM. Pediu pra ligarem à tarde.',
    qualificado: false,
  },
  // Topo do funil — captado no Social Selling, aguardando envio à Caixa
  {
    id: 'lead-1',
    nomeContato: 'Dra. Helena Marques',
    empresa: 'Clínica Bem Viver',
    telefone: '(11) 98888-1010',
    email: 'helena@bemviver.com',
    origem: 'Instagram',
    etapaFunil: 'prospectado',
    origemEntrada: 'social_selling',
    canalOriginal: 'Prospecção Instagram',
    socialSellerId: 'ss-1',
    dataCaptacao: '2026-09-16',
    observacaoCaptacao: 'Respondeu story sobre gestão de agenda. Demonstrou interesse.',
    qualificado: false,
    // Em abordagem: 2 tentativas, próxima abordagem vencida
    contadorTentativasSocial: 2,
    proximaAbordagem: '2026-09-19',
    tentativasAbordagemSocial: [
      { id: 'a1', data: '2026-09-16T10:00', tipo: 'dm_enviada', observacao: 'Enviei DM apresentando o serviço.', socialSellerId: 'ss-1' },
      { id: 'a2', data: '2026-09-18T14:00', tipo: 'sem_resposta', socialSellerId: 'ss-1' },
    ],
  },
  {
    id: 'lead-2',
    nomeContato: 'Dr. Paulo Rezende',
    empresa: 'Instituto Rezende',
    telefone: '(21) 97777-2020',
    origem: 'Prospecção Ativa',
    etapaFunil: 'prospectado',
    origemEntrada: 'social_selling',
    canalOriginal: 'Prospecção Ativa',
    socialSellerId: 'ss-2',
    dataCaptacao: '2026-09-18',
    qualificado: false,
    // Perto do limite (3 de 4) — dispara aviso de descarte
    contadorTentativasSocial: 3,
    proximaAbordagem: '2026-09-20',
    tentativasAbordagemSocial: [
      { id: 'b1', data: '2026-09-12T09:00', tipo: 'conexao', socialSellerId: 'ss-2' },
      { id: 'b2', data: '2026-09-15T11:00', tipo: 'dm_enviada', socialSellerId: 'ss-2' },
      { id: 'b3', data: '2026-09-18T16:00', tipo: 'sem_resposta', observacao: 'Visualizou e não respondeu.', socialSellerId: 'ss-2' },
    ],
  },
  // Em atendimento pelo SDR — puxado da Caixa (veio via CRM)
  {
    id: 'lead-3',
    nomeContato: 'Dra. Camila Torres',
    empresa: 'Espaço Saúde Integrada',
    telefone: '(31) 96666-3030',
    email: 'camila@saudeintegrada.com',
    origem: 'Indicação',
    etapaFunil: 'em_qualificacao',
    origemEntrada: 'crm_externo',
    crmProvider: 'RD Station',
    canalOriginal: 'Indicação',
    dataEntrada: '2026-09-13',
    socialSellerId: '',
    dataCaptacao: '2026-09-12',
    sdrId: 'sdr-1',
    dataEnvioSDR: '2026-09-14',
    qualificado: false,
    // Em follow-up: 2 tentativas, próximo contato agendado (vencido)
    contadorTentativas: 2,
    proximoContato: '2026-09-19T10:00',
    tentativasContato: [
      { id: 't1', data: '2026-09-15T09:30', resultado: 'nao_atendeu', sdrId: 'sdr-1' },
      { id: 't2', data: '2026-09-17T14:00', resultado: 'pediu_retorno', observacao: 'Pediu pra ligar segunda de manhã.', sdrId: 'sdr-1' },
    ],
  },
  // Qualificado (SQL) — reunião agendada com o Closer
  {
    id: 'lead-4',
    nomeContato: 'Dr. André Fontes',
    empresa: 'Clínica NeuroVida',
    telefone: '(41) 95555-4040',
    email: 'andre@neurovida.com',
    origem: 'Instagram',
    etapaFunil: 'reuniao_agendada',
    socialSellerId: 'ss-2',
    dataCaptacao: '2026-09-08',
    sdrId: 'sdr-2',
    dataEnvioSDR: '2026-09-10',
    qualificado: true,
    dataReuniaoAgendada: '2026-09-22',
    closerId: 'cl-1',
    dataEnvioCloser: '2026-09-15',
    briefingQualificacao:
      'Clínica de neurologia com 3 médicos. Dor: agenda desorganizada e sem previsibilidade de faturamento. Quer estruturar captação e recepção. Faturamento atual ~R$ 80k/mês.',
    nomeMedico: 'Dr. André Fontes',
    especialidade: 'Neurologia',
    instagram: '@neurovida',
    site: 'neurovida.com',
    canalAquisicao: 'Instagram',
    reuniao: { data: '2026-09-22', hora: '14:30', linkCall: 'https://meet.google.com/abc-defg-hij', closerId: 'cl-1' },
    resumoConversa:
      'Situação: agenda cheia mas caótica. Deseja previsibilidade e recepção estruturada. Faturamento ~80k/mês. Alinhado ticket de gestão.',
    bant: {
      orcamento: 'Tem crédito disponível',
      autoridade: 'Decisor único',
      necessidade: 'Gestão de agenda + captação',
      tempoUrgencia: 'Imediato',
      investimentoMensal: 2500,
      classificacaoLead: 'Quente',
    },
  },
  // Reunião realizada — em negociação
  {
    id: 'lead-5',
    nomeContato: 'Dra. Lívia Nunes',
    empresa: 'Clínica Derma&Co',
    telefone: '(51) 94444-5050',
    email: 'livia@dermaco.com',
    origem: 'Inbound',
    etapaFunil: 'em_negociacao',
    socialSellerId: 'ss-1',
    dataCaptacao: '2026-09-02',
    sdrId: 'sdr-1',
    dataEnvioSDR: '2026-09-03',
    qualificado: true,
    dataReuniaoAgendada: '2026-09-11',
    closerId: 'cl-2',
    dataEnvioCloser: '2026-09-08',
    briefingQualificacao:
      'Dermatologia estética, 2 unidades. Quer escalar aquisição paga e social. Já tem verba definida. Decisão compartilhada com o sócio.',
    nomeMedico: 'Dra. Lívia Nunes',
    especialidade: 'Dermatologia',
    instagram: '@dermaco',
    canalAquisicao: 'Inbound',
    reuniao: { data: '2026-09-11', hora: '10:00', linkCall: 'https://meet.google.com/xyz-1234-lmn', closerId: 'cl-2' },
    resumoConversa: 'Quer escalar tráfego + social. Verba definida. Decisão com o sócio (fechamento em 2ª call).',
    subStatusNegociacao: 'em_followup',
    dataProximoContato: '2026-09-18', // vencido (hoje = 20/09) → sobe no topo
    historicoFollowups: [
      { data: '2026-09-12', observacao: 'Proposta enviada. Cliente pediu pra alinhar com o sócio.' },
    ],
    bant: {
      orcamento: 'R$ 5k/mês pra mídia + fee',
      autoridade: 'Decisor compartilhado',
      necessidade: 'Tráfego pago + social media',
      tempoUrgencia: '30 dias',
      investimentoMensal: 3500,
      classificacaoLead: 'Quente',
    },
  },
  // Fechado — já virou Cliente (clienteId ligado)
  {
    id: 'lead-6',
    nomeContato: 'Dr. Marcelo Vidal',
    empresa: 'Clínica Vida Plena',
    telefone: '(11) 93333-6060',
    email: 'marcelo@vidaplena.com',
    origem: 'Indicação',
    etapaFunil: 'fechado',
    socialSellerId: 'ss-2',
    dataCaptacao: '2026-08-20',
    sdrId: 'sdr-2',
    dataEnvioSDR: '2026-08-21',
    qualificado: true,
    dataReuniaoAgendada: '2026-08-28',
    closerId: 'cl-1',
    dataEnvioCloser: '2026-08-25',
    briefingQualificacao:
      'Clínica geral consolidada. Quer terceirizar marketing por completo. Alta urgência — concorrente crescendo na região.',
    nomeMedico: 'Dr. Marcelo Vidal',
    especialidade: 'Clínica Geral',
    instagram: '@vidaplena',
    canalAquisicao: 'Indicação',
    reuniao: { data: '2026-08-28', hora: '16:00', linkCall: 'https://meet.google.com/vp-2233-abc', closerId: 'cl-1' },
    resumoConversa: 'Terceirização completa de marketing. Urgência alta por concorrência local.',
    bant: {
      orcamento: 'Aprovado até R$ 6k/mês',
      autoridade: 'Decisor único',
      necessidade: 'Assessoria completa (tráfego + social)',
      tempoUrgencia: 'Imediato',
      investimentoMensal: 4000,
      classificacaoLead: 'Quente',
    },
    mrr: 4000,
    caixaRecolhido: 4200,
    contratoFechado: 48000,
    dataFechamento: '2026-09-05',
    clienteId: 'cliente-demo-vidaplena',
  },
  // Perdido pelo Closer (não fechou)
  {
    id: 'lead-7',
    nomeContato: 'Dr. Otávio Prado',
    empresa: 'Consultório Prado',
    telefone: '(19) 92222-7070',
    origem: 'Google',
    etapaFunil: 'perdido',
    socialSellerId: 'ss-1',
    dataCaptacao: '2026-08-15',
    sdrId: 'sdr-1',
    dataEnvioSDR: '2026-08-16',
    qualificado: true,
    dataReuniaoAgendada: '2026-08-24',
    closerId: 'cl-2',
    dataEnvioCloser: '2026-08-20',
    briefingQualificacao: 'Consultório solo. Orçamento apertado, achou o ticket alto.',
    reuniao: { data: '2026-08-24', hora: '09:30', linkCall: 'https://meet.google.com/op-9988-xyz', closerId: 'cl-2' },
    resumoConversa: 'Interesse real, mas orçamento limitado.',
    bant: {
      orcamento: 'Limitado',
      autoridade: 'Decisor único',
      necessidade: 'Social media',
      tempoUrgencia: '60 dias',
      investimentoMensal: 1200,
      classificacaoLead: 'Morno',
    },
    motivoPerda: 'Preço',
    dataFechamento: '2026-09-01',
  },
  // Desqualificado pelo SDR (não avançou)
  {
    id: 'lead-8',
    nomeContato: 'Sr. Jonas Ribeiro',
    empresa: 'Farmácia Popular Centro',
    telefone: '(11) 91111-8080',
    origem: 'Outro',
    etapaFunil: 'perdido',
    socialSellerId: 'ss-2',
    dataCaptacao: '2026-09-05',
    sdrId: 'sdr-2',
    dataEnvioSDR: '2026-09-06',
    qualificado: false,
    motivoDesqualificacao: 'Fora do ICP — não é clínica/consultório médico.',
  },
  // Em negociação com no-show registrado (reagendado) — 1 falta até agora
  {
    id: 'lead-12',
    nomeContato: 'Dr. Gustavo Pinto',
    empresa: 'Clínica Movimento',
    telefone: '(11) 90000-5566',
    email: 'gustavo@movimento.com',
    origem: 'Anúncio Meta',
    etapaFunil: 'em_negociacao',
    origemEntrada: 'crm_externo',
    crmProvider: 'RD Station',
    canalOriginal: 'Anúncio Meta',
    dataEntrada: '2026-09-09',
    socialSellerId: '',
    dataCaptacao: '2026-09-09',
    sdrId: 'sdr-1',
    dataEnvioSDR: '2026-09-10',
    qualificado: true,
    dataReuniaoAgendada: '2026-09-16',
    closerId: 'cl-1',
    dataEnvioCloser: '2026-09-14',
    briefingQualificacao: 'Clínica de fisioterapia. Interesse alto, mas faltou na 1ª call. Reagendado.',
    reuniao: { data: '2026-09-23', hora: '11:00', linkCall: 'https://meet.google.com/mv-7788-abc', closerId: 'cl-1' },
    resumoConversa: 'Interessado, faltou na 1ª call (no-show). Reagendado.',
    bant: {
      orcamento: 'Confirmar na call',
      autoridade: 'Decisor único',
      necessidade: 'Social media + tráfego',
      tempoUrgencia: '30 dias',
      investimentoMensal: 2000,
      classificacaoLead: 'Morno',
    },
    subStatusNegociacao: 'no_show',
    contadorNoShow: 1,
  },
  // Fechado no mês, canal Meta Ads (alimenta ROAS do canal pago)
  {
    id: 'lead-13',
    nomeContato: 'Dra. Tânia Moreira',
    empresa: 'Clínica Moreira Kids',
    telefone: '(11) 90000-2244',
    email: 'tania@moreirakids.com',
    origem: 'Anúncio Meta',
    etapaFunil: 'fechado',
    origemEntrada: 'crm_externo',
    crmProvider: 'RD Station',
    canalOriginal: 'Anúncio Meta',
    dataEntrada: '2026-09-04',
    socialSellerId: '',
    dataCaptacao: '2026-09-04',
    sdrId: 'sdr-2',
    dataEnvioSDR: '2026-09-05',
    qualificado: true,
    dataReuniaoAgendada: '2026-09-11',
    closerId: 'cl-2',
    dataEnvioCloser: '2026-09-08',
    briefingQualificacao: 'Pediatria, quer previsibilidade de agenda. Fechou no plano intermediário.',
    reuniao: { data: '2026-09-11', hora: '15:00', linkCall: 'https://meet.google.com/mk-1010-abc', closerId: 'cl-2' },
    resumoConversa: 'Fechou plano intermediário. Boa fit.',
    bant: {
      orcamento: 'Aprovado',
      autoridade: 'Decisor único',
      necessidade: 'Tráfego + social',
      tempoUrgencia: 'Imediato',
      investimentoMensal: 3000,
      classificacaoLead: 'Quente',
    },
    mrr: 3000,
    caixaRecolhido: 3200,
    contratoFechado: 36000,
    dataFechamento: '2026-09-12',
    clienteId: 'cliente-demo-moreirakids',
  },
  // Em qualificação, PERTO DO LIMITE de tentativas (4 de 5) — dispara o aviso
  {
    id: 'lead-16',
    nomeContato: 'Dr. Ricardo Mota',
    empresa: 'Clínica Mota',
    telefone: '(11) 90000-4455',
    origem: 'Anúncio Google',
    etapaFunil: 'em_qualificacao',
    origemEntrada: 'crm_externo',
    crmProvider: 'HubSpot',
    canalOriginal: 'Anúncio Google',
    dataEntrada: '2026-09-10',
    socialSellerId: '',
    dataCaptacao: '2026-09-10',
    sdrId: 'sdr-2',
    dataEnvioSDR: '2026-09-11',
    qualificado: false,
    contadorTentativas: 4,
    proximoContato: '2026-09-20T16:00',
    tentativasContato: [
      { id: 'r1', data: '2026-09-12T10:00', resultado: 'nao_atendeu', sdrId: 'sdr-2' },
      { id: 'r2', data: '2026-09-14T11:00', resultado: 'caixa_postal', sdrId: 'sdr-2' },
      { id: 'r3', data: '2026-09-16T15:30', resultado: 'nao_atendeu', sdrId: 'sdr-2' },
      { id: 'r4', data: '2026-09-18T09:00', resultado: 'em_analise', observacao: 'Atendeu, disse que está avaliando com o sócio.', sdrId: 'sdr-2' },
    ],
  },
  // Lead via CRM SEM origem identificada (gap de rastreamento na integração)
  {
    id: 'lead-14',
    nomeContato: 'Dr. Fábio Nogueira',
    empresa: 'Clínica Nogueira',
    telefone: '(11) 90000-0001',
    origem: 'Sem Origem Identificada',
    etapaFunil: 'caixa_entrada',
    origemEntrada: 'crm_externo',
    crmProvider: 'RD Station',
    dataEntrada: '2026-09-20',
    socialSellerId: '',
    dataCaptacao: '2026-09-20',
    qualificado: false,
  },
]

/**
 * Estados de exemplo da sincronização bidirecional com o CRM (RD Station é o
 * provedor da config inicial). Aplicados sobre os leads acima pra cobrir:
 * sincronizado (vindos do CRM e criados via Social Selling), pendente e erro
 * (na criação — lead-1 — e na atualização do Closer — lead-7).
 */
const SYNC_MOCK: Record<string, Partial<Lead>> = {
  // Vindos do CRM via webhook: já nascem vinculados ao registro de lá.
  'lead-9': { crmExternoId: 'rd_48213', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-19T14:02:00' },
  'lead-3': { crmExternoId: 'rd_47901', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-15T10:21:00' },
  'lead-12': { crmExternoId: 'rd_47655', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-22T16:40:00' },
  'lead-13': { crmExternoId: 'rd_47402', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-18T11:05:00' },
  'lead-14': { crmExternoId: 'rd_48377', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-20T09:12:00' },
  // Vindos de outro CRM (HubSpot) — não recebem atualização enquanto o ativo é o RD.
  'lead-10': { crmExternoId: 'hs_7788120', crmExternoProvider: 'hubspot', sincronizacaoCRM: 'nao_aplicavel' },
  'lead-16': { crmExternoId: 'hs_7790341', crmExternoProvider: 'hubspot', sincronizacaoCRM: 'nao_aplicavel' },
  // Criados no Social Selling e enviados ao CRM.
  'lead-11': { crmExternoId: 'rd_48390', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-21T15:30:00' },
  'lead-2': { sincronizacaoCRM: 'pendente', ultimaSincronizacaoCRM: '2026-09-24T18:02:00' },
  'lead-1': {
    sincronizacaoCRM: 'erro',
    ultimaSincronizacaoCRM: '2026-09-24T17:48:00',
    erroSincronizacaoCRM: 'Token de acesso expirado (401). Reautentique a integração no CRM.',
  },
  // Resultados do Closer já refletidos no CRM (ou com falha pra retry).
  'lead-5': { crmExternoId: 'rd_47120', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-23T12:10:00' },
  'lead-6': { crmExternoId: 'rd_46988', crmExternoProvider: 'rd_station', sincronizacaoCRM: 'sincronizado', ultimaSincronizacaoCRM: '2026-09-17T17:55:00' },
  'lead-7': {
    crmExternoId: 'rd_46851',
    crmExternoProvider: 'rd_station',
    sincronizacaoCRM: 'erro',
    ultimaSincronizacaoCRM: '2026-09-24T11:31:00',
    erroSincronizacaoCRM: 'CRM indisponível no momento (503). Tente novamente em instantes.',
  },
}
for (const l of MOCK_LEADS) Object.assign(l, SYNC_MOCK[l.id] ?? {})

// ─────────────────────────────────────────────────────────────────────────────
// Leads de exemplo do FUNIL TRÁFEGO (Meta Ads da agência → CRM → funil).
// Gerados de forma DETERMINÍSTICA a partir de criativosReferencia.ts: cada
// criativo tem exatamente `qualificadosNaEscala` leads qualificados no mês de
// referência (o ranking e o custo por qualificado batem com o gasto do mock).
// Classificação A/B/C e criativo vêm "do CRM" (RD Station).
// Cada criativo tem um perfil de qualidade diferente — ex.: Ad137 traz
// qualificados mas muito lead C (fecha pouco), pra o cruzamento criativo ×
// classificação mostrar algo acionável.
// ─────────────────────────────────────────────────────────────────────────────

/** Existentes vindos do CRM também ganham classificação (sem criativo: sem utm). */
const CLASSIF_MOCK: Record<string, ClassificacaoLead> = {
  'lead-3': 'A',
  'lead-9': 'B',
  'lead-10': 'B',
  'lead-12': 'B',
  'lead-13': 'A',
  'lead-14': 'C',
  'lead-16': 'C',
}
for (const l of MOCK_LEADS) if (CLASSIF_MOCK[l.id]) l.classificacaoCRM = CLASSIF_MOCK[l.id]

/** Probabilidade de A / B (o resto é C) dos leads de cada criativo. */
const PERFIL_CRIATIVO: Record<string, [number, number]> = {
  'Ad119 - Review 40 consultas': [0.45, 0.4],
  'Ad134 - Tráfego P Médico Sem Bullets': [0.25, 0.5],
  link_in_bio: [0.4, 0.4],
  'Ad137 - Nina Tela Dividida': [0.08, 0.3],
  'Ad91 - Noele Rerformulado': [0.35, 0.45],
  'Ad117 - Review 42k': [0, 0],
}
/** Chance de fechar, entre os que chegaram ao Closer, por classificação. */
const CHANCE_FECHAR: Record<ClassificacaoLead, number> = { A: 0.55, B: 0.28, C: 0.08 }

const NOMES_F = ['Ana', 'Carla', 'Eduarda', 'Gabriela', 'Isabela', 'Karina', 'Mariana', 'Olívia', 'Renata', 'Sofia', 'Luiza', 'Yasmin']
const NOMES_M = ['Bruno', 'Daniel', 'Fábio', 'Henrique', 'João', 'Lucas', 'Nicolas', 'Paulo', 'Renato', 'Tiago', 'Vinícius', 'Otávio']
const SOBRENOMES = ['Almeida', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Freitas', 'Gomes', 'Leal', 'Macedo', 'Nogueira', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira', 'Teixeira', 'Vasconcelos']
const ESPECIALIDADES = ['Dermatologia', 'Ortopedia', 'Cardiologia', 'Oftalmologia', 'Odontologia', 'Ginecologia', 'Nutrologia', 'Pediatria']
const MOTIVOS_DESQ = ['Sem orçamento', 'Fora do perfil', 'Não é o decisor', 'Contato inválido']
const PREFIXOS_EMPRESA = ['Clínica', 'Instituto', 'Consultório', 'Centro Médico']

/** PRNG determinístico (0..1) a partir de um inteiro. */
function rnd(seed: number): number {
  let x = Math.imul(seed, 2654435761) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b) >>> 0
  // `^` devolve int32 COM sinal — `>>> 0` garante 0..1 (senão pick() lê índice negativo).
  x = (x ^ (x >>> 16)) >>> 0
  return x / 4294967296
}
function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.floor(r * arr.length) % arr.length]
}
function diaDoMes(mes: string, dia: number): string {
  return `${mes}-${String(Math.max(1, Math.min(dia, 30))).padStart(2, '0')}`
}

function gerarLeadsTrafego(): Lead[] {
  const mes = MES_REFERENCIA_CRIATIVOS
  const out: Lead[] = []
  let n = 0
  CRIATIVOS_REFERENCIA.forEach((c, ci) => {
    const [pA, pB] = PERFIL_CRIATIVO[c.nomeAnuncio] ?? [0.33, 0.33]
    const qualificados = qualificadosNaEscala(c)
    const naoQualificados = Math.round(qualificados * 0.3) + 1
    const total = qualificados + naoQualificados
    for (let k = 0; k < total; k++) {
      n++
      const s = ci * 1000 + k * 7 + 13
      const qualificado = k < qualificados
      const rc = rnd(s + 1)
      const classe: ClassificacaoLead = qualificado
        ? rc < pA
          ? 'A'
          : rc < pA + pB
            ? 'B'
            : 'C'
        : rc < pA * 0.4
          ? 'A'
          : rc < pA * 0.4 + pB * 0.8
            ? 'B'
            : 'C'
      const feminino = rnd(s + 2) < 0.5
      const primeiro = pick(feminino ? NOMES_F : NOMES_M, rnd(s + 3))
      const sobrenome = pick(SOBRENOMES, rnd(s + 4))
      const especialidade = pick(ESPECIALIDADES, rnd(s + 5))
      const diaEntrada = 1 + Math.floor(rnd(s + 6) * 22) // 01–22
      const dataEntrada = diaDoMes(mes, diaEntrada)
      const organico = c.idAnuncioMeta == null
      const origem = organico ? 'Instagram (link na bio)' : 'Anúncio Meta'
      const sdrId = rnd(s + 7) < 0.5 ? 'sdr-1' : 'sdr-2'
      const closerId = rnd(s + 8) < 0.5 ? 'cl-1' : 'cl-2'

      const lead: Lead = {
        id: `lead-trf-${String(n).padStart(3, '0')}`,
        nomeContato: `${feminino ? 'Dra.' : 'Dr.'} ${primeiro} ${sobrenome}`,
        empresa: `${pick(PREFIXOS_EMPRESA, rnd(s + 9))} ${sobrenome}`,
        telefone: `(11) 9${1000 + Math.floor(rnd(s + 10) * 8999)}-${1000 + Math.floor(rnd(s + 11) * 8999)}`,
        origem,
        canalOriginal: origem,
        etapaFunil: 'caixa_entrada',
        origemEntrada: 'crm_externo',
        crmProvider: 'RD Station',
        dataEntrada,
        socialSellerId: '',
        dataCaptacao: dataEntrada,
        qualificado,
        especialidade,
        classificacaoCRM: classe,
        criativoOrigem: c.idAnuncioMeta
          ? { nomeAnuncio: c.nomeAnuncio, idAnuncioMeta: c.idAnuncioMeta }
          : { nomeAnuncio: c.nomeAnuncio },
        crmExternoId: `rd_6${String(n).padStart(4, '0')}`,
        crmExternoProvider: 'rd_station',
        sincronizacaoCRM: 'sincronizado',
        ultimaSincronizacaoCRM: `${dataEntrada}T10:00:00`,
      }

      if (!qualificado) {
        // Ainda no SDR ou desqualificado.
        const r = rnd(s + 12)
        if (r < 0.4) {
          lead.etapaFunil = 'caixa_entrada'
        } else if (r < 0.65) {
          Object.assign(lead, { etapaFunil: 'em_qualificacao', sdrId, dataEnvioSDR: diaDoMes(mes, diaEntrada + 1) })
        } else {
          Object.assign(lead, {
            etapaFunil: 'perdido',
            sdrId,
            dataEnvioSDR: diaDoMes(mes, diaEntrada + 1),
            motivoDesqualificacao: pick(MOTIVOS_DESQ, rnd(s + 13)),
          })
        }
        out.push(lead)
        continue
      }

      // Qualificado pelo SDR → reunião com o Closer.
      const diaReuniao = diaEntrada + 3 + Math.floor(rnd(s + 14) * 4)
      const r = rnd(s + 15)
      const futura = r < 0.12
      const dataReuniao = futura ? diaDoMes(mes, 26 + Math.floor(rnd(s + 16) * 4)) : diaDoMes(mes, diaReuniao)
      Object.assign(lead, {
        sdrId,
        dataEnvioSDR: diaDoMes(mes, diaEntrada + 1),
        closerId,
        dataEnvioCloser: diaDoMes(mes, diaEntrada + 2),
        dataReuniaoAgendada: dataReuniao,
        reuniao: { data: dataReuniao, hora: `${9 + Math.floor(rnd(s + 17) * 9)}:00`, linkCall: 'https://meet.google.com/trf-demo', closerId },
        briefingQualificacao: `Lead ${classe} (classificação do CRM) vindo do criativo "${c.nomeAnuncio}". Interesse em ${especialidade.toLowerCase()}.`,
      })

      if (futura) {
        lead.etapaFunil = 'reuniao_agendada'
      } else if (r < 0.2) {
        Object.assign(lead, { etapaFunil: 'em_negociacao', subStatusNegociacao: 'no_show', contadorNoShow: 1 })
      } else if (rnd(s + 18) < CHANCE_FECHAR[classe]) {
        const mrr = 2500 + Math.round(rnd(s + 19) * 35) * 100
        Object.assign(lead, {
          etapaFunil: 'fechado',
          mrr,
          caixaRecolhido: mrr,
          contratoFechado: mrr * 12,
          dataFechamento: diaDoMes(mes, Math.min(diaReuniao + 2 + Math.floor(rnd(s + 20) * 3), 25)),
        })
      } else if (rnd(s + 21) < 0.35) {
        Object.assign(lead, {
          etapaFunil: 'em_negociacao',
          subStatusNegociacao: 'em_followup',
          dataProximoContato: diaDoMes(mes, 28),
          historicoFollowups: [{ data: diaDoMes(mes, diaReuniao), observacao: 'Proposta enviada; pediu uns dias pra decidir.' }],
        })
      } else {
        Object.assign(lead, {
          etapaFunil: 'perdido',
          motivoPerda: pick(MOTIVOS_PERDA, rnd(s + 22)),
          dataFechamento: diaDoMes(mes, Math.min(diaReuniao + 1, 25)),
        })
      }
      out.push(lead)
    }
  })
  return out
}

MOCK_LEADS.push(...gerarLeadsTrafego())
