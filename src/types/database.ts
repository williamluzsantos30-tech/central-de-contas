export type UserRole = 'admin' | 'gestor' | 'supervisor'
// Controle do Head de Tráfego
export type StatusSaudeConta = 'estavel' | 'instavel' | 'critico'
export type StatusPlanoAcao = 'aberto' | 'em_andamento' | 'concluido'
export type PlataformaTrafego = 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'youtube_ads'
export type PlataformaAds = 'google_ads' | 'meta_ads' | 'ambos'
export type FonteCrm = 'kommo' | 'nativo'
export type StatusCliente = 'ativo' | 'atencao' | 'pausado' | 'churn'
export type TipoCliente = 'assessoria' | 'consultoria'
export type JornadaCliente = 'onboarding' | 'otimizacao' | 'expansao' | 'retencao'
export type JornadaSocial = 'onboarding' | 'postando'
export type SemaforoCliente = 'verde' | 'amarelo' | 'laranja' | 'vermelho'
export type FrequenciaTarefa = 'diaria' | 'semanal' | 'mensal' | 'esporadica'
export type PrioridadeTarefa = 'baixa' | 'media' | 'alta'
export type StatusTarefa = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
export type TipoAtivo =
  | 'meta_pixel'
  | 'ga4'
  | 'google_meu_negocio'
  | 'bio_estruturada'
  | 'publicos_meta_ads'
export type StatusAtivo = 'pendente' | 'configurado' | 'funcional' | 'com_problema'
export type TipoOtimizacao =
  | 'ajuste_lance'
  | 'pausa_campanha'
  | 'novo_criativo'
  | 'ajuste_publico'
  | 'ajuste_orcamento'
  | 'teste_ab'
  | 'outro'
export type OrigemLead = 'kommo' | 'manual' | 'importacao' | 'google_sheets'
export type TipoCriacao = 'copy_lp' | 'planejamento' | 'roteiro' | 'copy_criativos'
export type StatusCriacao = 'rascunho' | 'em_revisao' | 'aprovado' | 'publicado'
export type TipoProjetoWebdesign = 'site_institucional' | 'landing_page' | 'ecommerce' | 'blog' | 'outro'
export type StatusProjetoWebdesign =
  | 'copy'
  | 'aprovacao_copy'
  | 'design'
  | 'aprovacao_design'
  | 'implementacao'
  | 'conclusao'
  | 'pausado'
export type FormatoCriativo =
  | 'feed_estatico'
  | 'story'
  | 'carrossel'
  | 'outro'
  | 'feed_estatico_story'
export type StatusCriativoWebdesign =
  | 'pendente'
  | 'design'
  | 'design_finalizado'
  | 'aprovacao_design'
  | 'alteracao'
  | 'conclusao'
export type FormatoSocialMedia = 'carrossel' | 'estatico' | 'reel' | 'outro'
export type StatusSocialMedia =
  | 'pendente'
  | 'design'
  | 'design_finalizado'
  | 'alteracao'
  | 'em_aprovacao'
  | 'conclusao'

export type StatusEdicaoVideo =
  | 'pendente'
  | 'em_edicao'
  | 'em_aprovacao'
  | 'em_alteracao'
  | 'conclusao'

/** Tipo de referência (origem do material/inspiração). */
export type TipoReferenciaVideo = 'drive' | 'youtube' | 'vimeo' | 'link'

export interface EdicaoReferencia {
  tipo: TipoReferenciaVideo
  url: string
  descricao?: string | null
}

export interface EdicaoArquivo {
  nome: string
  tamanho: number
  tipo: string
  url: string
}

export interface EdicaoVideo {
  id: string
  cliente_id: string
  titulo: string | null
  status: StatusEdicaoVideo
  responsavel_id: string | null
  ordem: number
  /** Auto-calculado pelo trigger: lote=2 vídeos × 3 dias úteis a partir de aprovado_em (ou created_at). */
  prazo: string | null
  aprovado_em: string | null
  briefing: string | null
  referencias: EdicaoReferencia[]
  arquivos: EdicaoArquivo[]
  video_final_url: string | null
  observacoes: string | null
  /** O que o cliente pediu pra mudar quando o video vai pra status=em_alteracao (migration 060). */
  descricao_alteracao: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente | null
  responsavel?: Profile | null
}

export type PerfilItemStatus = 'pendente' | 'em_revisao' | 'ok'

export type Cargo =
  | 'gestor_trafego'
  | 'account_manager'
  | 'designer'
  | 'social_media'
  | 'diretoria'
  | 'head'

export interface Profile {
  id: string
  nome: string
  email: string
  role: UserRole
  cargo: Cargo | null
  /**
   * Cargos adicionais (além do principal). Ex: Paloma é `cargo=social_media`
   * + `cargos_extras=['designer']` → aparece tanto nos dropdowns de SM quanto
   * nos de design. Sempre use `temCargo(profile, X)` ao invés de comparar
   * `cargo === X` direto, pra incluir os extras.
   */
  cargos_extras: Cargo[]
  squad_id: string | null
  avatar_url: string | null
  ativo: boolean
  aprovado: boolean
  created_at: string
  squad?: Squad | null
}

export interface Squad {
  id: string
  nome: string
  descricao: string | null
  lider_id: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  lider?: Profile | null
}

export type ModuloCliente = 'trafego' | 'social_media'

export interface Cliente {
  id: string
  nome: string
  nicho: string | null
  squad: string | null
  tipo: TipoCliente | null
  modulos: ModuloCliente[]
  /**
   * Servicos comerciais contratados pelo cliente (migration 076).
   * Separado de modulos — modulos e' routing operacional, servicos_
   * contratados e' realidade comercial. Editavel via modal na Ficha.
   * Valores conhecidos: trafego_pago, social_media, landing_page,
   * comercial_crm, identidade_visual, salvia. Extensivel — nao ha
   * enum, e' text[] livre pra novos servicos entrarem sem migration.
   */
  servicos_contratados: string[]
  /**
   * Dados do contrato (migration 080). Vai alimentar o modulo
   * Financeiro (v2) — alertas de renovacao, projecoes de MRR, etc.
   * contrato_tipo: mensal|3_meses|6_meses|12_meses|anual|indefinido
   * contrato_status: ativo|renovado|encerrado|pausado
   */
  contrato_tipo: string | null
  contrato_inicio: string | null
  contrato_fim: string | null
  contrato_status: string | null
  contrato_responsavel_id: string | null
  /**
   * Portal do Cliente (migration 081). Token do link publico
   * /publico/portal/<token>. Regerar via RPC gerar_portal_token.
   */
  portal_token: string | null
  /**
   * Progresso do onboarding: {etapa_key: {concluido_em}}. Template
   * das etapas em src/lib/onboardingTemplate.ts.
   */
  onboarding_etapas: Record<string, { concluido_em: string | null }>
  /** Cobranca — dia do mes (1-31) em que o pagamento vence. */
  dia_vencimento: number | null
  /** Cobranca — pix | boleto | cartao | transferencia | outro */
  forma_pagamento: string | null
  gestor_id: string | null
  account_manager_id: string | null
  social_media_id: string | null
  status: StatusCliente
  /**
   * Timestamp de quando o cliente foi arquivado (=virou churn). Null = ativo
   * nas listas. Não-null = some por padrão, só visível com toggle (admin).
   * Sincronizado automaticamente pelo trigger sync_arquivado_em com `status`.
   */
  arquivado_em: string | null
  jornada: JornadaCliente | null
  jornada_social: JornadaSocial | null
  nps: number | null
  semaforo: SemaforoCliente | null
  data_inicio: string
  plataformas: PlataformaAds | null
  /**
   * Cache do pior status_saude entre as plataformas do cliente (migration 043).
   * Atualizado por trigger quando cliente_saude_plataforma muda.
   * Default 'estavel'.
   */
  status_saude_geral: StatusSaudeConta
  /** Timestamp de quando o cliente entrou no status_saude_geral atual. Reseta no trigger. */
  status_geral_desde: string
  /**
   * Call de alinhamento mensal do TIME TRÁFEGO (migration 045). A partir
   * da migration 069, social media tem call independente (proxima_call_social).
   */
  proxima_call_alinhamento: string | null
  ultima_call_alinhamento: string | null
  /**
   * ID do evento no Google Calendar (migration 047). Retornado pelo n8n
   * após criar o evento. Usado pra atualizar/cancelar o mesmo evento
   * quando a data muda, em vez de criar duplicatas.
   */
  gcal_event_id: string | null
  /**
   * Call de alinhamento mensal do TIME SOCIAL MEDIA (migration 069).
   * Separada da call de tráfego — cada time agenda sua propria reunião.
   */
  proxima_call_social: string | null
  ultima_call_social: string | null
  gcal_event_id_social: string | null
  verba_mensal: number | null
  verba_google: number | null
  verba_meta: number | null
  fonte_crm: FonteCrm
  kommo_account_id: string | null
  /** Token secreto usado pelo Apps Script da planilha pra postar leads na RPC. Gerado automaticamente. */
  crm_sheets_token: string
  /** URL da planilha do Google Sheets — só pra referência (não é usado pelo Apps Script). */
  crm_sheets_url: string | null
  /**
   * Token do link público do calendário de postagens (migration 050).
   * Gerado sob demanda via RPC `gerar_token_calendario_publico`.
   * O link fica em `/publico/calendario/{token}` — read-only pro cliente.
   * Gerar novo token invalida o link anterior.
   */
  calendario_publico_token: string | null
  link_grupo: string | null
  observacoes: string | null
  // Campos de Social Media
  instagram_handle: string | null
  instagram_user_id: string | null
  instagram_token_id: string | null
  created_at: string
  updated_at: string
  gestor?: Profile | null
  account_manager?: Profile | null
  social_media?: Profile | null
}

/**
 * Timeline de alterações do cliente (migration 077).
 * Fonte manual (registros na Ficha) + automática (trigger em
 * clientes UPDATE). Lida na aba Ficha, ordenado por criado_em desc.
 */
export interface ClienteEvento {
  id: string
  cliente_id: string
  tipo: string
  titulo: string
  descricao: string | null
  meta: Record<string, unknown> | null
  arquivos: string[]
  criado_por: string | null
  criado_em: string
  autor?: Profile | null
}

export interface ClientePerfilSetup {
  cliente_id: string
  foto_status: PerfilItemStatus
  foto_url: string | null
  foto_obs: string | null
  bio_status: PerfilItemStatus
  bio_texto: string | null
  bio_obs: string | null
  destaques_status: PerfilItemStatus
  destaques_obs: string | null
  contato_status: PerfilItemStatus
  contato_obs: string | null
  ultima_revisao_em: string | null
  ultima_revisao_por: string | null
  created_at: string
  updated_at: string
}

export interface CriacaoAnexo {
  nome: string
  tamanho: number
  tipo: string
  url: string
}

/**
 * Estrutura usada quando `Criacao.tipo === 'planejamento'`.
 * Modelo "Por canal/plataforma" — uma seção por canal (Meta, Google,
 * Orgânico) + visão geral + KPIs alvo.
 * Todos os campos são opcionais — o PDF/UI tolera campos vazios.
 */
export interface PlanejamentoEstrutura {
  visao_geral?: {
    mes?: string
    objetivo?: string
    orcamento_total?: string
  }
  meta_ads?: {
    objetivo?: string
    publico?: string
    criativos_previstos?: string[]
    budget?: string
  }
  google_ads?: {
    objetivo?: string
    segmentacao?: string
    budget?: string
  }
  organico?: {
    pilares?: string[]
    frequencia?: string
  }
  kpis?: {
    cpl?: string
    ctr?: string
    cpc?: string
    conversoes?: string
  }
}

/**
 * Estrutura usada quando `Criacao.tipo === 'roteiro'`.
 * Modelo "3 atos" — Gancho → Desenvolvimento → Fechamento.
 */
export interface RoteiroEstrutura {
  formato?: 'reel' | 'carrossel' | 'tiktok' | 'story' | 'outro'
  duracao?: string
  gancho?: {
    texto?: string
    direcao?: string
  }
  desenvolvimento?: {
    texto?: string
    acoes?: string
  }
  fechamento?: {
    texto?: string
    cta?: string
  }
  trilha?: string
}

/**
 * Estrutura usada quando `Criacao.tipo === 'copy_criativos'`.
 * Mesma linha do Roteiro (3 atos), adaptada pra peças estáticas.
 */
export interface CopyCriativosEstrutura {
  formato?: 'feed_estatico' | 'story' | 'carrossel' | 'outro'
  plataforma?: string
  headline?: {
    texto?: string
    subheadline?: string
  }
  corpo?: {
    texto?: string
    pontos_chave?: string[]
  }
  cta?: {
    texto?: string
    link?: string
  }
  hashtags?: string
}

export interface Criacao {
  id: string
  cliente_id: string
  tipo: TipoCriacao
  titulo: string
  briefing: string | null
  prompt: string | null
  anexos: CriacaoAnexo[] | null
  conteudo: string | null
  /** Schema estruturado pro PDF do Planejamento. Null para outros tipos. */
  planejamento_estrutura: PlanejamentoEstrutura | null
  /** Schema estruturado pro PDF do Roteiro. Null para outros tipos. */
  roteiro_estrutura: RoteiroEstrutura | null
  /** Schema estruturado pro PDF da Copy Criativos. Null para outros tipos. */
  copy_criativos_estrutura: CopyCriativosEstrutura | null
  status: StatusCriacao
  responsavel_id: string | null
  /**
   * Quando essa criação foi promovida pra produção (gerou um projeto webdesign
   * ou criativo). Null = ainda não foi. Usado pra evitar duplicar caso o status
   * oscile aprovado→rascunho→aprovado.
   */
  enviado_para_producao_em: string | null
  /**
   * Override do texto "Sobre essa entrega" que aparece no PDF. Quando null,
   * o PDF usa o template global em `config_criacoes_intros`.
   */
  introducao_pdf: string | null
  created_at: string
  updated_at: string
  responsavel?: Profile | null
}

/**
 * Template global do bloco "Sobre essa entrega" que aparece no PDF.
 * Uma linha por TipoCriacao. Editável em Admin > Configurações de Criações.
 */
export interface ConfigCriacaoIntro {
  tipo: TipoCriacao
  titulo: string
  paragrafos: string[]
  updated_at: string
}

export interface ProjetoWebdesign {
  id: string
  cliente_id: string
  titulo: string | null
  tipo: TipoProjetoWebdesign
  status: StatusProjetoWebdesign
  responsavel_id: string | null
  prazo: string | null
  url_producao: string | null
  briefing: string | null
  briefing_pdf_url: string | null
  /** @deprecated usar identidade_visual_urls (array). Legado retroativo. */
  identidade_visual_url: string | null
  identidade_visual_urls: string[]
  fotos: string[]
  copy_arquivo_url: string | null
  /** Array de arquivos de copy (PDFs/DOCs). Migration 065. Substitui
   *  copy_arquivo_url no frontend (o singular fica de backward compat). */
  copy_arquivos: string[]
  /** Texto da copy quando o projeto veio de uma Criação tipo copy_lp aprovada. */
  copy_texto: string | null
  /** Criação (copy_lp) que gerou esse projeto. Null se foi criado manual. */
  criacao_origem_id: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente | null
  responsavel?: Profile | null
}

export interface CriativoWebdesign {
  id: string
  cliente_id: string
  titulo: string | null
  formato: FormatoCriativo
  status: StatusCriativoWebdesign
  responsavel_id: string | null
  prazo: string | null
  url_criativo: string | null
  /** @deprecated usar identidade_visual_urls (array). Legado retroativo. */
  identidade_visual_url: string | null
  identidade_visual_urls: string[]
  fotos: string[]
  copy_texto: string | null
  copy_arquivo_url: string | null
  /** Criação (copy_criativos) que gerou esse criativo. Null se foi criado manual. */
  criacao_origem_id: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente | null
  responsavel?: Profile | null
}

export interface PlanejamentoSocialMedia {
  id: string
  cliente_id: string
  titulo: string
  mes_referencia: string | null
  responsavel_id: string | null
  prazo: string | null
  briefing_pdf_url: string | null
  referencias: string[]
  identidade_visual_urls: string[]
  observacoes: string | null
  // Camada estratégica (playbook 3.2, 3.4, 3.5)
  tema_mes: string | null
  pilares: string[]
  ganchos_para_ads: string | null
  campanha_ativa_url: string | null
  // Camada do PDF de planejamento (template do cliente)
  texto_introducao: string | null
  cadencia: string | null
  data_envio_aprovacao: string | null
  aprovado_em: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente | null
  responsavel?: Profile | null
}

export interface ItemSocialMedia {
  id: string
  producao_id: string
  formato: FormatoSocialMedia
  titulo: string
  /** Descrição da "ideia do conteúdo" — 2ª coluna do PDF de planejamento */
  ideia_conteudo: string | null
  status: StatusSocialMedia
  responsavel_id: string | null
  /** Data de POSTAGEM (quando a arte vai pro Instagram). Definida no planejamento. */
  prazo: string | null
  /**
   * Prazo de PRODUÇÃO (deadline do designer pra entregar a arte).
   * Auto-calculado pelo trigger a partir de `producoes_social_media.aprovado_em`,
   * em lotes de 3 posts × 3 dias úteis. Difere de `prazo` (data de postagem).
   */
  prazo_producao: string | null
  copy_texto: string | null
  copy_arquivo_url: string | null
  /** Caption do post no Instagram (texto que aparece FORA da arte,
   *  como descrição da publicação). Migration 067. */
  legenda: string | null
  artes_prontas: string[]
  /**
   * Link do arquivo do vídeo no Drive (Google Drive, Dropbox, etc).
   * Só relevante quando formato='reel'. Migration 072. Aparece no link
   * público do calendário como botão "Abrir vídeo no Drive" quando o
   * item está em aprovação/concluído, pra o cliente conseguir baixar
   * o master.
   */
  link_drive_video: string | null
  /**
   * Referências por arte (Drive, YouTube, Vimeo, links). Mesma estrutura
   * usada em edicoes_video.referencias. Cada entrada: {tipo, url, descricao}.
   */
  referencias: EdicaoReferencia[]
  observacoes: string | null
  /** O que o cliente pediu pra mudar quando o item vai pra status=alteracao (migration 059). */
  descricao_alteracao: string | null
  ordem: number
  /**
   * Item de backlog — conteúdo estático organizado como reserva pra
   * publicar caso o cliente não grave os videos alinhados (migration
   * 075). Fica na aba de Planejamento separado, não vai pro calendário
   * público. Vira post normal quando o time desativa o flag + define
   * prazo.
   */
  is_backlog: boolean
  // Marcação de publicação (playbook 3.3 e KPI #1)
  publicado_url: string | null
  publicado_em: string | null
  publicado_por: string | null
  // Marcação de agendamento (migration 068) — post foi programado no
  // scheduler mas ainda não foi ao ar
  programado_em: string | null
  programado_por: string | null
  // Reaproveitamento pra tráfego (KPI #4)
  reaproveitado_para_ad: boolean
  reaproveitado_url: string | null
  created_at: string
  updated_at: string
  responsavel?: Profile | null
}

export interface MetricasSocialMensal {
  cliente_id: string
  mes_referencia: string
  engajamento_medio: number | null
  alcance_medio: number | null
  seguidores: number | null
  nota_qualitativa: number | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type StatusIdeiaSocial = 'a_testar' | 'em_teste' | 'testado' | 'descartado'

export interface IdeiaSocial {
  id: string
  cliente_id: string
  titulo: string
  descricao: string | null
  url: string | null
  formato_alvo: 'carrossel' | 'estatico' | 'reel' | null
  status: StatusIdeiaSocial
  tags: string[]
  criado_por: string | null
  created_at: string
  updated_at: string
}

export interface TaskTemplate {
  id: string
  nome: string
  descricao: string | null
  frequencia: FrequenciaTarefa
  prioridade: PrioridadeTarefa
  dias_semana: number[]
  dia_mes: number | null
  ativo: boolean
  modulos: string[]
  created_at: string
}

export interface Tarefa {
  id: string
  cliente_id: string
  template_id: string | null
  nome: string
  descricao: string | null
  frequencia: FrequenciaTarefa
  prioridade: PrioridadeTarefa
  status: StatusTarefa
  responsavel_id: string | null
  data_vencimento: string | null
  data_conclusao: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente | null
  responsavel?: Profile | null
  template?: TaskTemplate | null
}

/**
 * Log de açoes em tarefas (atualmente: só exclusão).
 * Snapshot completo dos dados da tarefa antes da exclusão + quem fez.
 */
export interface TarefaLog {
  id: string
  acao: 'delete' | 'update' | 'insert'
  tarefa_id: string
  tarefa_data: Record<string, unknown>
  ator_user_id: string | null
  ator_nome: string | null
  ator_email: string | null
  cliente_id: string | null
  created_at: string
}

export interface TarefaComentario {
  id: string
  tarefa_id: string
  autor_id: string | null
  texto: string
  created_at: string
  autor?: Profile | null
}

export interface Ativo {
  id: string
  cliente_id: string
  tipo: TipoAtivo
  status: StatusAtivo
  link: string | null
  ultima_verificacao: string | null
  verificado_por: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface LoginAcesso {
  id: string
  cliente_id: string
  plataforma: string
  login: string
  senha: string | null
  url: string | null
  notas: string | null
  /** Se true, aparece no Portal do Cliente (migration 081). Default false. */
  visivel_portal: boolean
  created_at: string
  updated_at: string
}

/**
 * Configuracoes globais da agencia (migration 081). Key/value jsonb.
 * chave='cobranca' -> CobrancaAgencia.
 */
export interface ConfiguracaoAgencia {
  chave: string
  valor: Record<string, unknown>
  atualizado_em: string
  atualizado_por: string | null
}

export interface CobrancaAgencia {
  pix_chave?: string
  pix_tipo?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
  pix_nome?: string
  razao_social?: string
  cnpj?: string
  instrucoes?: string
}

export interface Otimizacao {
  id: string
  cliente_id: string
  responsavel_id: string | null
  data_otimizacao: string
  plataforma: PlataformaAds
  tipo: TipoOtimizacao
  descricao: string
  resultado: string | null
  created_at: string
  responsavel?: Profile | null
}

export interface Lead {
  id: string
  cliente_id: string
  origem: OrigemLead
  kommo_lead_id: string | null
  nome: string | null
  telefone: string | null
  email: string | null
  etapa: string | null
  valor: number | null
  responsavel_id: string | null
  data_entrada: string
  observacoes: string | null
  external_ref: string | null
  dados_extras: LeadDadosExtras | null
  created_at: string
  updated_at: string
}

export interface LeadDadosExtras {
  canal?: string | null
  motivo_perdido?: string | null
  agendou_consulta?: boolean | null
  consulta_realizada?: boolean | null
  tratamento_fechado?: boolean | null
  mensagem_confirmacao?: string | null
  [key: string]: unknown
}

export interface MetasValores {
  investimento: number | null
  custo_mensagem: number | null
  mensagens_qualificadas: number | null
  numero_consultas: number | null
  tm_consulta: number | null
  numero_procedimentos: number | null
  tm_procedimento: number | null
}

export interface MetasPorPlataforma {
  google: MetasValores
  meta: MetasValores
}

export interface Meta {
  id: string
  cliente_id: string
  mes_ano: string
  meta_data: MetasPorPlataforma | MetasValores
  resultado_data: MetasPorPlataforma | MetasValores
  verba_planejada: number | null
  meta_leads: number | null
  meta_cpl: number | null
  meta_vendas: number | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

// =========================================================
// Controle do Head de Tráfego (migration 043)
// =========================================================

/**
 * Saúde + métricas de um cliente em uma plataforma específica.
 * Um cliente pode ter 1+ linhas dessas (uma por plataforma).
 * Métricas (leads / CPL / verba) são preenchidas MANUALMENTE pelo head.
 */
export interface ClienteSaudePlataforma {
  cliente_id: string
  plataforma: PlataformaTrafego
  status_saude: StatusSaudeConta
  leads_30d: number
  cpl: number
  verba_gasta: number
  verba_orcamento: number
  tendencia_pct: number
  observacao: string | null
  updated_at: string
  updated_by: string | null
}

/**
 * Verificação registrada pelo head/diretoria. Cada uma cobre UMA plataforma
 * de UM cliente. Tem que ter problema + plano de ação preenchidos.
 */
export interface VerificacaoConta {
  id: string
  cliente_id: string
  plataforma: PlataformaTrafego
  autor_id: string
  problema: string
  plano_acao: string
  status_plano: StatusPlanoAcao
  created_at: string
  updated_at: string
  // Joins opcionais
  cliente?: Cliente | null
  autor?: Profile | null
}

/** Destinatário do email de escalonamento (configurável no Admin, migration 044). */
export interface EscalonamentoDestinatario {
  id: string
  nome: string
  email: string
  ativo: boolean
  created_at: string
  updated_at: string
}

/** Log de notificação de escalonamento enviada (migration 044). */
export interface EscalonamentoNotificacao {
  id: string
  cliente_id: string
  tipo: 'diretoria' | 'reclassificar'
  destinatarios: string[]
  enviado_em: string
  cliente?: Cliente | null
}
