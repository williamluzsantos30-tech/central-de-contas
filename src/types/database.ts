export type UserRole = 'admin' | 'gestor' | 'supervisor'
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
export type OrigemLead = 'kommo' | 'manual' | 'importacao'
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
  gestor_id: string | null
  account_manager_id: string | null
  social_media_id: string | null
  status: StatusCliente
  jornada: JornadaCliente | null
  jornada_social: JornadaSocial | null
  nps: number | null
  semaforo: SemaforoCliente | null
  data_inicio: string
  plataformas: PlataformaAds | null
  verba_mensal: number | null
  verba_google: number | null
  verba_meta: number | null
  fonte_crm: FonteCrm
  kommo_account_id: string | null
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

export interface Criacao {
  id: string
  cliente_id: string
  tipo: TipoCriacao
  titulo: string
  briefing: string | null
  prompt: string | null
  anexos: CriacaoAnexo[] | null
  conteudo: string | null
  status: StatusCriacao
  responsavel_id: string | null
  created_at: string
  updated_at: string
  responsavel?: Profile | null
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
  artes_prontas: string[]
  observacoes: string | null
  ordem: number
  // Marcação de publicação (playbook 3.3 e KPI #1)
  publicado_url: string | null
  publicado_em: string | null
  publicado_por: string | null
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
  created_at: string
  updated_at: string
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
  created_at: string
  updated_at: string
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
