/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock in-memory database + Supabase-like client.
// Usado quando VITE_SUPABASE_URL/ANON_KEY não estão definidos — permite rodar
// o app inteiro com dados fictícios realistas.

type Row = Record<string, any>
type Tables =
  | 'profiles'
  | 'squads'
  | 'clientes'
  | 'task_templates'
  | 'tarefas'
  | 'tarefa_comentarios'
  | 'ativos'
  | 'logins_acessos'
  | 'otimizacoes'
  | 'leads'
  | 'metas'
  | 'criacoes'
  | 'projetos_webdesign'
  | 'criativos_webdesign'
  | 'producoes_social_media'
  | 'producoes_social_media_items'
  | 'cliente_perfil_setup'
  | 'cliente_metricas_social'
  | 'cliente_ideias_social'

let counter = 0
const uid = () => `m-${(++counter).toString().padStart(5, '0')}`
const nowISO = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)
const daysISO = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ---------- SEED DATA ----------

const pAdmin = 'p-admin'
const pAmanda = 'p-amanda'
const pBruno = 'p-bruno'
const pCarla = 'p-carla'

const c1 = 'c-1'
const c2 = 'c-2'
const c3 = 'c-3'
const c4 = 'c-4'
const c5 = 'c-5'
const c6 = 'c-6'

const sqBlackOps = 's-blackops'
const sqDelta = 's-delta'
const sqAlpha = 's-alpha'
const sqBeta = 's-beta'
const sqMovSeals = 's-movseals'

const squads: Row[] = [
  { id: sqBlackOps, nome: 'BlackOps', descricao: 'Squad principal de tráfego e performance.', lider_id: pAdmin, ativo: true, created_at: daysISO(-200) + 'T10:00:00Z', updated_at: nowISO() },
  { id: sqDelta, nome: 'Delta', descricao: 'Squad focado em consultorias e clientes pontuais.', lider_id: pAmanda, ativo: true, created_at: daysISO(-180) + 'T10:00:00Z', updated_at: nowISO() },
  { id: sqAlpha, nome: 'Alpha', descricao: 'Squad de assessorias premium.', lider_id: pBruno, ativo: true, created_at: daysISO(-160) + 'T10:00:00Z', updated_at: nowISO() },
  { id: sqBeta, nome: 'Beta', descricao: 'Squad de onboarding.', lider_id: null, ativo: true, created_at: daysISO(-140) + 'T10:00:00Z', updated_at: nowISO() },
  { id: sqMovSeals, nome: 'MovSeals', descricao: 'Squad de operações especiais.', lider_id: pCarla, ativo: true, created_at: daysISO(-120) + 'T10:00:00Z', updated_at: nowISO() },
  { id: 's-archive', nome: 'Diretoria', descricao: 'Squad de diretoria — desativado.', lider_id: pAdmin, ativo: false, created_at: daysISO(-300) + 'T10:00:00Z', updated_at: daysISO(-30) + 'T10:00:00Z' },
]

const profiles: Row[] = [
  { id: pAdmin, nome: 'Willian Gomes', email: 'willian@movmed.com', role: 'admin', cargo: 'diretoria', squad_id: sqBlackOps, avatar_url: null, ativo: true, aprovado: true, created_at: daysISO(-180) + 'T10:00:00Z' },
  { id: pAmanda, nome: 'Amanda Costa', email: 'amanda@movmed.com', role: 'gestor', cargo: 'gestor_trafego', squad_id: sqDelta, avatar_url: null, ativo: true, aprovado: true, created_at: daysISO(-150) + 'T10:00:00Z' },
  { id: pBruno, nome: 'Bruno Tavares', email: 'bruno@movmed.com', role: 'gestor', cargo: 'gestor_trafego', squad_id: sqAlpha, avatar_url: null, ativo: true, aprovado: true, created_at: daysISO(-120) + 'T10:00:00Z' },
  { id: pCarla, nome: 'Carla Lima', email: 'carla@movmed.com', role: 'supervisor', cargo: 'account_manager', squad_id: sqMovSeals, avatar_url: null, ativo: true, aprovado: true, created_at: daysISO(-100) + 'T10:00:00Z' },
  // Solicitações de acesso pendentes (demo)
  { id: 'p-pend-1', nome: 'Lucas Almeida', email: 'lucas.almeida@movmed.com', role: 'gestor', cargo: 'designer', squad_id: null, avatar_url: null, ativo: true, aprovado: false, created_at: daysISO(-2) + 'T14:30:00Z' },
  { id: 'p-pend-2', nome: 'Patrícia Souza', email: 'patricia.souza@movmed.com', role: 'gestor', cargo: 'social_media', squad_id: null, avatar_url: null, ativo: true, aprovado: false, created_at: daysISO(-1) + 'T09:15:00Z' },
]

const task_templates: Row[] = [
  { id: 'tpl-1', nome: 'Análise diária do gerenciador', descricao: 'Checar desempenho das campanhas', frequencia: 'diaria', prioridade: 'alta', dias_semana: [], dia_mes: null, ativo: true, created_at: nowISO() },
  { id: 'tpl-2', nome: 'Revisão semanal de orçamento', descricao: 'Revisar e ajustar orçamento', frequencia: 'semanal', prioridade: 'alta', dias_semana: [1], dia_mes: null, ativo: true, created_at: nowISO() },
  { id: 'tpl-3', nome: 'Envio de relatório manual no grupo', descricao: 'Relatório semanal consolidado', frequencia: 'semanal', prioridade: 'alta', dias_semana: [5], dia_mes: null, ativo: true, created_at: nowISO() },
  { id: 'tpl-4', nome: 'Coleta de feedback com cliente/secretária', descricao: 'Alinhar agenda e pendências', frequencia: 'semanal', prioridade: 'media', dias_semana: [3], dia_mes: null, ativo: true, created_at: nowISO() },
  { id: 'tpl-5', nome: 'Revisão/atualização do Google Meu Negócio', descricao: 'Fotos, posts, horários', frequencia: 'mensal', prioridade: 'media', dias_semana: [], dia_mes: 10, ativo: true, created_at: nowISO() },
  { id: 'tpl-6', nome: 'Revisão de públicos Meta Ads', descricao: 'Validar públicos customizados', frequencia: 'mensal', prioridade: 'media', dias_semana: [], dia_mes: 15, ativo: true, created_at: nowISO() },
  { id: 'tpl-7', nome: 'Coleta de 12 criativos de tráfego', descricao: 'Banco mensal de referências', frequencia: 'mensal', prioridade: 'media', dias_semana: [], dia_mes: 20, ativo: true, created_at: nowISO() },
]

const clientes: Row[] = [
  { id: c1, nome: 'Dra. Fernanda Reis', nicho: 'Dermatologia', squad: 'BlackOps', tipo: 'assessoria', modulos: ['trafego', 'social_media'], gestor_id: pAmanda, account_manager_id: pAdmin, social_media_id: pAmanda, status: 'ativo', jornada: 'otimizacao', jornada_social: 'postando', nps: 9, semaforo: 'verde', data_inicio: daysISO(-120), plataformas: 'ambos', verba_mensal: 6000, verba_google: 3500, verba_meta: 2500, fonte_crm: 'nativo', kommo_account_id: null, link_grupo: 'https://chat.whatsapp.com/demo-fernanda', observacoes: 'Atendimento particular, foco em botox e rejuvenescimento.', created_at: daysISO(-120) + 'T00:00:00Z', updated_at: daysISO(-2) + 'T00:00:00Z' },
  { id: c2, nome: 'Clínica Olhar Claro', nicho: 'Oftalmologia', squad: 'BlackOps', tipo: 'assessoria', modulos: ['trafego'], gestor_id: pBruno, account_manager_id: pAdmin, social_media_id: pBruno, status: 'atencao', jornada: 'escala', jornada_social: null, nps: 6, semaforo: 'laranja', data_inicio: daysISO(-200), plataformas: 'google_ads', verba_mensal: 4500, verba_google: 4500, verba_meta: 0, fonte_crm: 'kommo', kommo_account_id: 'kommo-1234', link_grupo: 'https://chat.whatsapp.com/demo-olhar', observacoes: 'Foco em catarata e lentes premium.', created_at: daysISO(-200) + 'T00:00:00Z', updated_at: daysISO(-1) + 'T00:00:00Z' },
  { id: c3, nome: 'Dr. Rafael Azevedo', nicho: 'Ortopedia', squad: 'Delta', tipo: 'consultoria', modulos: ['trafego', 'social_media'], gestor_id: pAmanda, account_manager_id: pAmanda, social_media_id: pAmanda, status: 'ativo', jornada: 'onboarding', jornada_social: 'onboarding', nps: 8, semaforo: 'verde', data_inicio: daysISO(-60), plataformas: 'meta_ads', verba_mensal: 3200, verba_google: 0, verba_meta: 3200, fonte_crm: 'nativo', kommo_account_id: null, link_grupo: null, observacoes: 'Especialista em joelho e esporte.', created_at: daysISO(-60) + 'T00:00:00Z', updated_at: daysISO(-5) + 'T00:00:00Z' },
  { id: c4, nome: 'Instituto Neuro+', nicho: 'Neurologia', squad: 'Alpha', tipo: 'assessoria', modulos: ['trafego', 'social_media'], gestor_id: pBruno, account_manager_id: pAdmin, social_media_id: pBruno, status: 'ativo', jornada: 'escala', jornada_social: 'postando', nps: 10, semaforo: 'verde', data_inicio: daysISO(-310), plataformas: 'ambos', verba_mensal: 8500, verba_google: 5000, verba_meta: 3500, fonte_crm: 'kommo', kommo_account_id: 'kommo-5678', link_grupo: 'https://chat.whatsapp.com/demo-neuro', observacoes: 'Cliente-âncora. Envolve 3 neurologistas.', created_at: daysISO(-310) + 'T00:00:00Z', updated_at: daysISO(-3) + 'T00:00:00Z' },
  { id: c5, nome: 'Estética Renascer', nicho: 'Cirurgia plástica', squad: 'Beta', tipo: 'assessoria', modulos: ['social_media'], gestor_id: pAmanda, account_manager_id: pAmanda, social_media_id: pAmanda, status: 'pausado', jornada: 'onboarding', jornada_social: 'onboarding', nps: null, semaforo: 'amarelo', data_inicio: daysISO(-25), plataformas: null, verba_mensal: null, verba_google: null, verba_meta: null, fonte_crm: 'nativo', kommo_account_id: null, link_grupo: null, observacoes: 'Em onboarding — só Social Media.', created_at: daysISO(-25) + 'T00:00:00Z', updated_at: daysISO(-10) + 'T00:00:00Z' },
  { id: c6, nome: 'Dr. Daniel Oliveira', nicho: 'Gastroenterologia', squad: 'BlackOps', tipo: 'assessoria', modulos: ['trafego', 'social_media'], gestor_id: pAmanda, account_manager_id: pAdmin, social_media_id: pAmanda, status: 'atencao', jornada: 'otimizacao', jornada_social: 'postando', nps: 7, semaforo: 'laranja', data_inicio: daysISO(-180), plataformas: 'ambos', verba_mensal: 7500, verba_google: 4500, verba_meta: 3000, fonte_crm: 'nativo', kommo_account_id: null, link_grupo: 'https://chat.whatsapp.com/demo-daniel', observacoes: 'Cirurgião do aparelho digestivo.', created_at: daysISO(-180) + 'T00:00:00Z', updated_at: daysISO(-1) + 'T00:00:00Z' },
]

const tarefas: Row[] = []
// gerar 1 diária, 2 semanais, 2 mensais por cliente (mix de status e vencimentos)
const porCliente: [string, string, string[]][] = [
  [c1, pAmanda, ['pendente', 'concluida', 'pendente', 'em_andamento', 'concluida']],
  [c2, pBruno, ['pendente', 'pendente', 'concluida', 'pendente', 'pendente']],
  [c3, pAmanda, ['concluida', 'pendente', 'pendente', 'em_andamento', 'pendente']],
  [c4, pBruno, ['pendente', 'concluida', 'concluida', 'pendente', 'em_andamento']],
  [c5, pAmanda, ['pendente', 'pendente', 'pendente', 'pendente', 'pendente']],
]
const tplsAplicar = [task_templates[0], task_templates[1], task_templates[3], task_templates[4], task_templates[6]]
const vencimentos = [0, 2, -1, 14, 22] // diária hoje, semanal +2, semanal atrasada, mensal +14, mensal +22

for (const [cid, resp, statuses] of porCliente) {
  tplsAplicar.forEach((t, i) => {
    const st = statuses[i]
    const due = daysISO(vencimentos[i])
    tarefas.push({
      id: uid(),
      cliente_id: cid,
      template_id: t.id,
      nome: t.nome,
      descricao: t.descricao,
      frequencia: t.frequencia,
      prioridade: t.prioridade,
      status: st,
      responsavel_id: resp,
      data_vencimento: due,
      data_conclusao: st === 'concluida' ? daysISO(-1) + 'T10:00:00Z' : null,
      created_at: nowISO(),
      updated_at: nowISO(),
    })
  })
}

// Algumas esporádicas
tarefas.push(
  { id: uid(), cliente_id: c1, template_id: null, nome: 'Gravar vídeo tutorial com a Dra.', descricao: 'Pauta pendente desde a última reunião', frequencia: 'esporadica', prioridade: 'media', status: 'pendente', responsavel_id: pAmanda, data_vencimento: daysISO(7), data_conclusao: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, template_id: null, nome: 'Reunião trimestral de estratégia', descricao: null, frequencia: 'esporadica', prioridade: 'alta', status: 'pendente', responsavel_id: pBruno, data_vencimento: daysISO(10), data_conclusao: null, created_at: nowISO(), updated_at: nowISO() },
)

// Tarefas do admin (Willian) para a aba "Minhas tarefas" ficar com conteúdo
tarefas.push(
  { id: uid(), cliente_id: c1, template_id: null, nome: 'Revisar estratégia trimestral com gestor', descricao: 'Sync de metas Q2', frequencia: 'esporadica', prioridade: 'alta', status: 'pendente', responsavel_id: pAdmin, data_vencimento: today(), data_conclusao: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, template_id: null, nome: 'Aprovar orçamento de R$ 2k para teste de criativo', descricao: null, frequencia: 'esporadica', prioridade: 'alta', status: 'pendente', responsavel_id: pAdmin, data_vencimento: today(), data_conclusao: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c2, template_id: null, nome: 'Ligar para o médico sobre churn risk', descricao: 'Cliente reclamou da performance', frequencia: 'esporadica', prioridade: 'alta', status: 'pendente', responsavel_id: pAdmin, data_vencimento: daysISO(-1), data_conclusao: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c3, template_id: null, nome: 'Definir aumento de verba para próximo mês', descricao: null, frequencia: 'esporadica', prioridade: 'media', status: 'pendente', responsavel_id: pAdmin, data_vencimento: daysISO(3), data_conclusao: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, template_id: null, nome: 'Review do portfólio de clientes dermato', descricao: null, frequencia: 'esporadica', prioridade: 'media', status: 'concluida', responsavel_id: pAdmin, data_vencimento: daysISO(-2), data_conclusao: daysISO(-2) + 'T14:00:00Z', created_at: nowISO(), updated_at: nowISO() },
)

const ativos: Row[] = []
const ativosPorCliente: Record<string, Record<string, string>> = {
  [c1]: { meta_pixel: 'funcional', ga4: 'funcional', google_meu_negocio: 'configurado', bio_estruturada: 'pendente', publicos_meta_ads: 'funcional' },
  [c2]: { meta_pixel: 'com_problema', ga4: 'funcional', google_meu_negocio: 'funcional', bio_estruturada: 'configurado', publicos_meta_ads: 'pendente' },
  [c3]: { meta_pixel: 'funcional', ga4: 'funcional', google_meu_negocio: 'funcional', bio_estruturada: 'funcional', publicos_meta_ads: 'funcional' },
  [c4]: { meta_pixel: 'funcional', ga4: 'com_problema', google_meu_negocio: 'funcional', bio_estruturada: 'funcional', publicos_meta_ads: 'configurado' },
  [c5]: { meta_pixel: 'pendente', ga4: 'pendente', google_meu_negocio: 'pendente', bio_estruturada: 'pendente', publicos_meta_ads: 'pendente' },
}
for (const [cid, tipos] of Object.entries(ativosPorCliente)) {
  for (const [tipo, status] of Object.entries(tipos)) {
    ativos.push({
      id: uid(),
      cliente_id: cid,
      tipo,
      status,
      link: status === 'funcional' || status === 'configurado' ? `https://exemplo.com/${tipo}` : null,
      ultima_verificacao: status !== 'pendente' ? daysISO(-5) + 'T09:00:00Z' : null,
      verificado_por: status !== 'pendente' ? pAmanda : null,
      observacoes: status === 'com_problema' ? 'Evento não está disparando corretamente. Investigar.' : null,
      created_at: nowISO(),
      updated_at: nowISO(),
    })
  }
}

const logins_acessos: Row[] = [
  {
    id: uid(),
    cliente_id: c1,
    plataforma: 'Google Ads',
    login: 'fernanda.reis@dermaclinica.com.br',
    senha: 'Fer2025@Ads',
    url: 'https://ads.google.com',
    notas: 'MCC vinculado à conta principal.',
    created_at: daysISO(-40) + 'T10:00:00Z',
    updated_at: daysISO(-10) + 'T14:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c1,
    plataforma: 'Meta Business',
    login: 'fernanda@dermaclinica.com.br',
    senha: 'MetaFer!2025',
    url: 'https://business.facebook.com',
    notas: 'Admin — BM compartilhado com a agência.',
    created_at: daysISO(-40) + 'T10:05:00Z',
    updated_at: daysISO(-40) + 'T10:05:00Z',
  },
  {
    id: uid(),
    cliente_id: c1,
    plataforma: 'Instagram',
    login: '@dra.fernandareis',
    senha: 'Insta#Fer2025',
    url: 'https://instagram.com/dra.fernandareis',
    notas: null,
    created_at: daysISO(-30) + 'T09:00:00Z',
    updated_at: daysISO(-30) + 'T09:00:00Z',
  },
]

const otimizacoes: Row[] = [
  { id: uid(), cliente_id: c1, responsavel_id: pAmanda, data_otimizacao: daysISO(-1), plataforma: 'meta_ads', tipo: 'ajuste_lance', descricao: 'Subi lance em 15% no conjunto de botox feminino 35-55 para recuperar volume de leads.', resultado: 'CPL caiu de R$ 48 para R$ 39 em 24h.', created_at: nowISO() },
  { id: uid(), cliente_id: c1, responsavel_id: pAmanda, data_otimizacao: daysISO(-4), plataforma: 'google_ads', tipo: 'novo_criativo', descricao: 'Adicionei 3 novos headlines com gatilhos de dor para campanha de rejuvenescimento.', resultado: null, created_at: nowISO() },
  { id: uid(), cliente_id: c1, responsavel_id: pAmanda, data_otimizacao: daysISO(-10), plataforma: 'ambos', tipo: 'ajuste_orcamento', descricao: 'Realoquei 30% do orçamento Google para Meta após análise de CPL.', resultado: 'Volume subiu 22%, CPL estável.', created_at: nowISO() },
  { id: uid(), cliente_id: c2, responsavel_id: pBruno, data_otimizacao: daysISO(-2), plataforma: 'google_ads', tipo: 'pausa_campanha', descricao: 'Pausei campanha de lentes premium — CPL 3x acima da meta.', resultado: null, created_at: nowISO() },
  { id: uid(), cliente_id: c2, responsavel_id: pBruno, data_otimizacao: daysISO(-7), plataforma: 'google_ads', tipo: 'ajuste_publico', descricao: 'Adicionei audiência de remarketing 30d para campanha de catarata.', resultado: 'CTR subiu 18%.', created_at: nowISO() },
  { id: uid(), cliente_id: c4, responsavel_id: pBruno, data_otimizacao: daysISO(-3), plataforma: 'meta_ads', tipo: 'teste_ab', descricao: 'Teste A/B de criativo vídeo vs. estático para campanha de cefaleia.', resultado: 'Vídeo ganhou com CPL 32% menor.', created_at: nowISO() },
  { id: uid(), cliente_id: c4, responsavel_id: pBruno, data_otimizacao: daysISO(-12), plataforma: 'ambos', tipo: 'ajuste_orcamento', descricao: 'Aumentei budget geral em 20% após fechamento de novo contrato.', resultado: null, created_at: nowISO() },
  { id: uid(), cliente_id: c3, responsavel_id: pAmanda, data_otimizacao: daysISO(-6), plataforma: 'meta_ads', tipo: 'novo_criativo', descricao: 'Gravei 4 criativos novos com o médico explicando dor no joelho.', resultado: 'Taxa de clique dobrou.', created_at: nowISO() },
]

const leads: Row[] = [
  // c1 (nativo) — 5 leads
  { id: uid(), cliente_id: c1, origem: 'manual', kommo_lead_id: null, nome: 'Patrícia Almeida', telefone: '(11) 98765-4321', email: 'patricia@email.com', etapa: 'Agendado', valor: 800, responsavel_id: pAmanda, data_entrada: daysISO(-1), observacoes: 'Interessada em preenchimento labial.', created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, origem: 'manual', kommo_lead_id: null, nome: 'Juliana Martins', telefone: '(11) 99888-7766', email: null, etapa: 'Novo', valor: null, responsavel_id: pAmanda, data_entrada: daysISO(-2), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, origem: 'manual', kommo_lead_id: null, nome: 'Roberta Menezes', telefone: '(11) 95555-4444', email: 'roberta@email.com', etapa: 'Qualificado', valor: 1500, responsavel_id: pAmanda, data_entrada: daysISO(-5), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, origem: 'manual', kommo_lead_id: null, nome: 'Fernanda Silva', telefone: '(11) 97777-6655', email: null, etapa: 'Ganho', valor: 2400, responsavel_id: pAmanda, data_entrada: daysISO(-8), observacoes: 'Pacote premium fechado.', created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, origem: 'manual', kommo_lead_id: null, nome: 'Carla Ribeiro', telefone: '(11) 96666-5544', email: null, etapa: 'Perdido', valor: null, responsavel_id: pAmanda, data_entrada: daysISO(-12), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  // c2 (kommo) — 4 leads
  { id: uid(), cliente_id: c2, origem: 'kommo', kommo_lead_id: 'kl-1001', nome: 'José Nogueira', telefone: '(21) 98888-7777', email: null, etapa: 'Primeira consulta', valor: 600, responsavel_id: pBruno, data_entrada: daysISO(-1), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c2, origem: 'kommo', kommo_lead_id: 'kl-1002', nome: 'Márcia Lopes', telefone: '(21) 97777-8888', email: null, etapa: 'Cirurgia agendada', valor: 12000, responsavel_id: pBruno, data_entrada: daysISO(-3), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c2, origem: 'kommo', kommo_lead_id: 'kl-1003', nome: 'Otávio Campos', telefone: '(21) 96666-9999', email: null, etapa: 'Primeira consulta', valor: 600, responsavel_id: pBruno, data_entrada: daysISO(-6), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c2, origem: 'kommo', kommo_lead_id: 'kl-1004', nome: 'Sandra Peixoto', telefone: '(21) 95555-1111', email: null, etapa: 'Perdido', valor: null, responsavel_id: pBruno, data_entrada: daysISO(-15), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  // c3 (nativo) — 3 leads
  { id: uid(), cliente_id: c3, origem: 'manual', kommo_lead_id: null, nome: 'Lucas Pereira', telefone: '(31) 94444-3333', email: null, etapa: 'Novo', valor: null, responsavel_id: pAmanda, data_entrada: daysISO(-2), observacoes: 'Dor no joelho direito.', created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c3, origem: 'manual', kommo_lead_id: null, nome: 'Diego Farias', telefone: '(31) 93333-2222', email: null, etapa: 'Agendado', valor: 450, responsavel_id: pAmanda, data_entrada: daysISO(-4), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c3, origem: 'manual', kommo_lead_id: null, nome: 'Thiago Carvalho', telefone: '(31) 92222-1111', email: null, etapa: 'Ganho', valor: 800, responsavel_id: pAmanda, data_entrada: daysISO(-9), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  // c4 (kommo) — 6 leads
  { id: uid(), cliente_id: c4, origem: 'kommo', kommo_lead_id: 'kl-2001', nome: 'Regina Falcão', telefone: '(41) 98888-1111', email: null, etapa: 'Primeira consulta', valor: 900, responsavel_id: pBruno, data_entrada: daysISO(0), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, origem: 'kommo', kommo_lead_id: 'kl-2002', nome: 'Fernando Araújo', telefone: '(41) 97777-2222', email: null, etapa: 'Exame solicitado', valor: 900, responsavel_id: pBruno, data_entrada: daysISO(-1), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, origem: 'kommo', kommo_lead_id: 'kl-2003', nome: 'Vanessa Torres', telefone: '(41) 96666-3333', email: null, etapa: 'Retorno', valor: 450, responsavel_id: pBruno, data_entrada: daysISO(-3), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, origem: 'kommo', kommo_lead_id: 'kl-2004', nome: 'Paulo Henrique', telefone: '(41) 95555-4444', email: null, etapa: 'Primeira consulta', valor: 900, responsavel_id: pBruno, data_entrada: daysISO(-6), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, origem: 'kommo', kommo_lead_id: 'kl-2005', nome: 'Isabela Medeiros', telefone: '(41) 94444-5555', email: null, etapa: 'Tratamento contínuo', valor: 2400, responsavel_id: pBruno, data_entrada: daysISO(-10), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, origem: 'kommo', kommo_lead_id: 'kl-2006', nome: 'Mateus Vilela', telefone: '(41) 93333-6666', email: null, etapa: 'Perdido', valor: null, responsavel_id: pBruno, data_entrada: daysISO(-20), observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  // c5 — 1 lead só
  { id: uid(), cliente_id: c5, origem: 'manual', kommo_lead_id: null, nome: 'Aline Ramos', telefone: '(11) 91111-2222', email: null, etapa: 'Novo', valor: null, responsavel_id: pAmanda, data_entrada: daysISO(-1), observacoes: 'Cliente em onboarding.', created_at: nowISO(), updated_at: nowISO() },
]

const monthFirst = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const prevMonthFirst = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10)
}

const metas: Row[] = [
  {
    id: uid(),
    cliente_id: c1,
    mes_ano: monthFirst(),
    meta_data: {
      google: {
        investimento: 1400,
        custo_mensagem: 15,
        mensagens_qualificadas: 47,
        numero_consultas: 20,
        tm_consulta: 500,
        numero_procedimentos: 4,
        tm_procedimento: 5000,
      },
      meta: {
        investimento: 900,
        custo_mensagem: 12,
        mensagens_qualificadas: 32,
        numero_consultas: 12,
        tm_consulta: 450,
        numero_procedimentos: 2,
        tm_procedimento: 4500,
      },
    },
    resultado_data: {
      google: {
        investimento: 1280,
        custo_mensagem: 16,
        mensagens_qualificadas: 38,
        numero_consultas: 16,
        tm_consulta: 480,
        numero_procedimentos: 3,
        tm_procedimento: 4800,
      },
      meta: {
        investimento: 820,
        custo_mensagem: 13,
        mensagens_qualificadas: 24,
        numero_consultas: 8,
        tm_consulta: 440,
        numero_procedimentos: 1,
        tm_procedimento: 4200,
      },
    },
    verba_planejada: 6000,
    meta_leads: 80,
    meta_cpl: 75,
    meta_vendas: 20,
    observacoes: null,
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  { id: uid(), cliente_id: c1, mes_ano: '2026-03-01', meta_data: { google: { investimento: 1100, custo_mensagem: 10, mensagens_qualificadas: 55, numero_consultas: 27, tm_consulta: 480, numero_procedimentos: 15, tm_procedimento: 800 }, meta: { investimento: 700, custo_mensagem: 11, mensagens_qualificadas: 35, numero_consultas: 14, tm_consulta: 450, numero_procedimentos: 6, tm_procedimento: 750 } }, resultado_data: { google: { investimento: 1110, custo_mensagem: 10, mensagens_qualificadas: 54, numero_consultas: 27, tm_consulta: 480, numero_procedimentos: 15, tm_procedimento: 800 }, meta: { investimento: 680, custo_mensagem: 12, mensagens_qualificadas: 30, numero_consultas: 11, tm_consulta: 440, numero_procedimentos: 4, tm_procedimento: 720 } }, verba_planejada: 1100, meta_leads: 110, meta_cpl: 10, meta_vendas: 15, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, mes_ano: '2026-02-01', meta_data: { google: { investimento: 1100, custo_mensagem: 10, mensagens_qualificadas: 52, numero_consultas: 20, tm_consulta: 460, numero_procedimentos: 5, tm_procedimento: 150 }, meta: { investimento: 650, custo_mensagem: 12, mensagens_qualificadas: 25, numero_consultas: 8, tm_consulta: 430, numero_procedimentos: 2, tm_procedimento: 200 } }, resultado_data: { google: { investimento: 1072, custo_mensagem: 9, mensagens_qualificadas: 48, numero_consultas: 16, tm_consulta: 460, numero_procedimentos: 4, tm_procedimento: 638 }, meta: { investimento: 620, custo_mensagem: 13, mensagens_qualificadas: 21, numero_consultas: 6, tm_consulta: 420, numero_procedimentos: 1, tm_procedimento: 500 } }, verba_planejada: 1100, meta_leads: 110, meta_cpl: 10, meta_vendas: 5, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, mes_ano: '2026-01-01', meta_data: { google: { investimento: 1100, custo_mensagem: 10, mensagens_qualificadas: 60, numero_consultas: 30, tm_consulta: 500, numero_procedimentos: 15, tm_procedimento: 1200 }, meta: { investimento: 750, custo_mensagem: 11, mensagens_qualificadas: 40, numero_consultas: 15, tm_consulta: 470, numero_procedimentos: 6, tm_procedimento: 1100 } }, resultado_data: { google: { investimento: 1110, custo_mensagem: 10, mensagens_qualificadas: 62, numero_consultas: 42, tm_consulta: 520, numero_procedimentos: 17, tm_procedimento: 420 }, meta: { investimento: 770, custo_mensagem: 11, mensagens_qualificadas: 43, numero_consultas: 18, tm_consulta: 480, numero_procedimentos: 8, tm_procedimento: 380 } }, verba_planejada: 1100, meta_leads: 110, meta_cpl: 10, meta_vendas: 17, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, mes_ano: '2025-12-01', meta_data: { google: { investimento: 1000, custo_mensagem: 11, mensagens_qualificadas: 40, numero_consultas: 15, tm_consulta: 500, numero_procedimentos: 10, tm_procedimento: 500 }, meta: { investimento: 600, custo_mensagem: 13, mensagens_qualificadas: 22, numero_consultas: 7, tm_consulta: 460, numero_procedimentos: 4, tm_procedimento: 480 } }, resultado_data: { google: { investimento: 978, custo_mensagem: 12, mensagens_qualificadas: 33, numero_consultas: 11, tm_consulta: 556, numero_procedimentos: 7, tm_procedimento: 380 }, meta: { investimento: 580, custo_mensagem: 14, mensagens_qualificadas: 18, numero_consultas: 5, tm_consulta: 500, numero_procedimentos: 3, tm_procedimento: 350 } }, verba_planejada: 1000, meta_leads: 90, meta_cpl: 11, meta_vendas: 10, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, mes_ano: '2025-11-01', meta_data: { google: { investimento: 1400, custo_mensagem: 9, mensagens_qualificadas: 70, numero_consultas: 30, tm_consulta: 480, numero_procedimentos: 10, tm_procedimento: 100 }, meta: { investimento: 800, custo_mensagem: 11, mensagens_qualificadas: 40, numero_consultas: 13, tm_consulta: 450, numero_procedimentos: 4, tm_procedimento: 180 } }, resultado_data: { google: { investimento: 1352, custo_mensagem: 9, mensagens_qualificadas: 69, numero_consultas: 23, tm_consulta: 510, numero_procedimentos: 5, tm_procedimento: 760 }, meta: { investimento: 780, custo_mensagem: 12, mensagens_qualificadas: 38, numero_consultas: 10, tm_consulta: 470, numero_procedimentos: 2, tm_procedimento: 700 } }, verba_planejada: 1400, meta_leads: 140, meta_cpl: 10, meta_vendas: 10, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, mes_ano: '2025-10-01', meta_data: { google: { investimento: 900, custo_mensagem: 11, mensagens_qualificadas: 40, numero_consultas: 20, tm_consulta: 480, numero_procedimentos: 10, tm_procedimento: 300 }, meta: { investimento: 550, custo_mensagem: 13, mensagens_qualificadas: 22, numero_consultas: 9, tm_consulta: 440, numero_procedimentos: 4, tm_procedimento: 320 } }, resultado_data: { google: { investimento: 917, custo_mensagem: 11, mensagens_qualificadas: 38, numero_consultas: 23, tm_consulta: 480, numero_procedimentos: 10, tm_procedimento: 108 }, meta: { investimento: 560, custo_mensagem: 13, mensagens_qualificadas: 20, numero_consultas: 10, tm_consulta: 440, numero_procedimentos: 4, tm_procedimento: 300 } }, verba_planejada: 900, meta_leads: 80, meta_cpl: 11, meta_vendas: 10, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c1, mes_ano: '2025-09-01', meta_data: { google: { investimento: 1100, custo_mensagem: 11, mensagens_qualificadas: 50, numero_consultas: 20, tm_consulta: 500, numero_procedimentos: 13, tm_procedimento: 800 }, meta: { investimento: 700, custo_mensagem: 12, mensagens_qualificadas: 32, numero_consultas: 10, tm_consulta: 460, numero_procedimentos: 5, tm_procedimento: 760 } }, resultado_data: { google: { investimento: 1102, custo_mensagem: 11, mensagens_qualificadas: 48, numero_consultas: 15, tm_consulta: 500, numero_procedimentos: 13, tm_procedimento: 1000 }, meta: { investimento: 720, custo_mensagem: 12, mensagens_qualificadas: 30, numero_consultas: 8, tm_consulta: 460, numero_procedimentos: 4, tm_procedimento: 900 } }, verba_planejada: 1100, meta_leads: 100, meta_cpl: 11, meta_vendas: 13, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c2, mes_ano: monthFirst(), meta_data: {}, resultado_data: {}, verba_planejada: 4500, meta_leads: 60, meta_cpl: 75, meta_vendas: 12, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, mes_ano: monthFirst(), meta_data: {}, resultado_data: {}, verba_planejada: 8500, meta_leads: 110, meta_cpl: 78, meta_vendas: 30, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c4, mes_ano: prevMonthFirst(), meta_data: {}, resultado_data: {}, verba_planejada: 8000, meta_leads: 100, meta_cpl: 80, meta_vendas: 28, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), cliente_id: c3, mes_ano: monthFirst(), meta_data: {}, resultado_data: {}, verba_planejada: 3200, meta_leads: 45, meta_cpl: 72, meta_vendas: 10, observacoes: null, created_at: nowISO(), updated_at: nowISO() },
]

const tarefa_comentarios: Row[] = [
  { id: uid(), tarefa_id: tarefas[0].id, autor_id: pAmanda, texto: 'CPL subiu 10% desde ontem, precisa de atenção.', created_at: daysISO(-1) + 'T10:00:00Z' },
  { id: uid(), tarefa_id: tarefas[0].id, autor_id: pCarla, texto: 'Já pedi relatório detalhado.', created_at: daysISO(-1) + 'T12:00:00Z' },
  { id: uid(), tarefa_id: tarefas[5].id, autor_id: pBruno, texto: 'Cliente ainda não respondeu sobre o horário.', created_at: daysISO(-2) + 'T14:00:00Z' },
]

const criacoes: Row[] = [
  {
    id: uid(),
    cliente_id: c1,
    tipo: 'copy_lp',
    titulo: 'LP — Rejuvenescimento facial (H1 2026)',
    briefing:
      'Público: mulheres 35-55, foco em Zona Sul SP. Dor: sinais de envelhecimento, perda de firmeza. Diferencial: Dra. Fernanda tem 12 anos de experiência, atendimento humanizado, resultados naturais.',
    conteudo:
      'HEADLINE: Recupere o brilho da sua pele sem cirurgia — com a naturalidade que você merece.\n\nSUBHEADLINE: A Dra. Fernanda Reis já ajudou mais de 2.400 mulheres a rejuvenescerem com segurança em consultas personalizadas.\n\nBENEFÍCIOS:\n✓ Avaliação personalizada de pele\n✓ Protocolos com tecnologia de ponta\n✓ Resultado natural em até 7 dias\n✓ Acompanhamento por 6 meses\n\nCTA: Agende sua avaliação com a Dra. Fernanda',
    status: 'aprovado',
    responsavel_id: pAmanda,
    created_at: daysISO(-8) + 'T10:00:00Z',
    updated_at: daysISO(-3) + 'T15:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c1,
    tipo: 'copy_criativos',
    titulo: 'Criativos Meta — botox feminino 35-55',
    briefing: 'Teste de dor + solução, tom conversacional. 3 variações para A/B test.',
    conteudo:
      'VARIAÇÃO A (dor):\nHeadline: Espelho não mente. Mas você pode mudar isso.\nTexto: 3 em cada 4 mulheres sentem que envelhecem mais rápido que os amigos. A Dra. Fernanda explica por quê — e como reverter.\nCTA: Quero uma avaliação\n\nVARIAÇÃO B (prova social):\nHeadline: "Voltei a receber elogios depois de 10 anos."\nTexto: O depoimento da Patrícia é igual ao de centenas de pacientes da Dra. Fernanda. Que tal o seu?\nCTA: Agendar agora\n\nVARIAÇÃO C (solução):\nHeadline: Rejuvenescimento natural em 7 dias.\nTexto: Sem cirurgia, sem afastamento do trabalho. A abordagem da Dra. Fernanda é feita pra mulher moderna.\nCTA: Falar com a Dra.',
    status: 'em_revisao',
    responsavel_id: pAmanda,
    created_at: daysISO(-2) + 'T14:00:00Z',
    updated_at: daysISO(-1) + 'T09:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c4,
    tipo: 'planejamento',
    titulo: 'Planejamento Q2 — Instituto Neuro+',
    briefing: 'Cliente quer crescer 30% em primeiras consultas no Q2. Budget R$8.500/mês. Foco em cefaleia crônica e esclerose múltipla.',
    conteudo:
      'OBJETIVO Q2:\nCrescer 30% em primeiras consultas (de ~85/mês para ~110/mês) mantendo CPL abaixo de R$78.\n\nESTRATÉGIA:\n1. Google Ads (40% do budget) — palavras-chave de alta intenção para cefaleia e neuro especializado.\n2. Meta Ads (60% do budget) — campanhas de awareness + retargeting educativo.\n\nKPIs:\n- CPL meta: < R$78\n- Taxa de qualificação: > 65%\n- CAC: < R$220\n\nCRONOGRAMA:\n- Semana 1-2: setup de novas campanhas\n- Semana 3-4: primeiros testes A/B de criativos\n- Mês 2: otimização baseada em dados\n- Mês 3: escala do que funcionou',
    status: 'aprovado',
    responsavel_id: pBruno,
    created_at: daysISO(-12) + 'T09:00:00Z',
    updated_at: daysISO(-7) + 'T11:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c2,
    tipo: 'roteiro',
    titulo: 'Roteiro vídeo — cirurgia de catarata',
    briefing: 'Vídeo de 60s para Reels. Dr. explica cirurgia em linguagem simples, tranquilizando paciente idoso.',
    conteudo:
      'ABERTURA (0-5s):\nDr. olhando pra câmera: "Você sabia que a catarata pode ser resolvida em 15 minutos?"\n\nDESENVOLVIMENTO (5-40s):\n- 5-15s: explica o que é catarata (visual: animação do olho)\n- 15-25s: mostra consultório e equipamentos\n- 25-40s: depoimento rápido de paciente feliz\n\nCTA (40-60s):\nDr. direto: "Se você tem mais de 60 anos e sente vista embaçada, agende uma avaliação. Primeira consulta é coberta pela maioria dos planos. Link na bio."',
    status: 'rascunho',
    responsavel_id: pBruno,
    created_at: daysISO(-1) + 'T16:00:00Z',
    updated_at: daysISO(-1) + 'T16:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c3,
    tipo: 'copy_criativos',
    titulo: 'Criativos Meta — dor no joelho',
    briefing: 'Público 40+. Dor: incômodo ao subir escada. Foco em ortopedia moderna sem cirurgia de primeira.',
    conteudo: null,
    status: 'rascunho',
    responsavel_id: pAmanda,
    created_at: daysISO(0) + 'T10:00:00Z',
    updated_at: daysISO(0) + 'T10:00:00Z',
  },
]

const projetos_webdesign: Row[] = [
  {
    id: uid(),
    cliente_id: c1,
    titulo: 'Site institucional Dra. Fernanda Reis',
    tipo: 'site_institucional',
    status: 'design',
    responsavel_id: pAmanda,
    prazo: daysISO(30),
    url_producao: null,
    briefing: 'Site one-page com hero, serviços (4 áreas), depoimentos, bio da médica, agendamento via WhatsApp. Visual clean com tons neutros.',
    briefing_pdf_url: 'https://drive.google.com/file/d/demo-briefing-fernanda/view',
    identidade_visual_url: 'https://drive.google.com/drive/folders/demo-identidade-fernanda',
    identidade_visual_urls: [
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400',
      'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400',
      'https://drive.google.com/drive/folders/demo-manual-marca-fernanda',
    ],
    fotos: [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400',
      'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400',
    ],
    copy_texto:
      'HERO:\nTransforme sua pele. Transforme sua autoestima.\n\nSERVIÇOS:\n• Botox — rugas dinâmicas e linhas de expressão\n• Preenchimento — volume e contorno\n• Skinbooster — hidratação profunda\n• Bioestimuladores — firmeza duradoura\n\nSOBRE A DRA.:\n12 anos tratando mulheres que querem envelhecer com graça.',
    observacoes: 'Homolog em staging aguardando revisão da paleta.',
    created_at: daysISO(-15) + 'T09:00:00Z',
    updated_at: daysISO(-2) + 'T14:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c2,
    titulo: 'LP — Catarata Premium',
    tipo: 'landing_page',
    status: 'implementacao',
    responsavel_id: pBruno,
    prazo: daysISO(10),
    url_producao: null,
    briefing: 'LP de conversão para campanha de catarata com lentes premium. CTA: agendar consulta. Precisa ter formulário de contato e integração com Google Tag Manager.',
    briefing_pdf_url: null,
    identidade_visual_url: 'https://drive.google.com/drive/folders/demo-identidade-olhar',
    fotos: ['https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400'],
    copy_texto:
      'HEADLINE:\nVolte a enxergar com nitidez — em menos de 15 minutos de cirurgia.\n\nBENEFÍCIOS:\n✓ Lentes premium com garantia de 10 anos\n✓ Sem pontos, sem internação\n✓ Retorno às atividades em 48h\n\nCTA: Agende sua avaliação gratuita',
    observacoes: null,
    created_at: daysISO(-20) + 'T11:00:00Z',
    updated_at: daysISO(-1) + 'T10:30:00Z',
  },
  {
    id: uid(),
    cliente_id: c4,
    titulo: 'Site completo Instituto Neuro+ com blog',
    tipo: 'site_institucional',
    status: 'copy',
    responsavel_id: pBruno,
    prazo: daysISO(60),
    url_producao: null,
    briefing: 'Reformular site atual do instituto. Precisa de: homepage, páginas para cada neurologista (3), área de artigos/blog, formulário de agendamento.',
    briefing_pdf_url: 'https://drive.google.com/file/d/demo-briefing-neuro/view',
    identidade_visual_url: null,
    fotos: [],
    copy_texto: null,
    observacoes: 'Briefing recebido — começando a redação da copy.',
    created_at: daysISO(-3) + 'T16:00:00Z',
    updated_at: daysISO(-3) + 'T16:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c3,
    titulo: 'LP — Ortopedia Esportiva',
    tipo: 'landing_page',
    status: 'conclusao',
    responsavel_id: pAmanda,
    prazo: daysISO(-10),
    url_producao: 'https://rafaelazevedo.example.com/esportiva',
    briefing: 'LP focada em atletas amadores com dor no joelho. Formulário de consulta.',
    briefing_pdf_url: 'https://drive.google.com/file/d/demo-briefing-rafael/view',
    identidade_visual_url: 'https://drive.google.com/drive/folders/demo-identidade-rafael',
    fotos: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=400',
      'https://images.unsplash.com/photo-1579684453377-48ec05c6b30a?w=400',
    ],
    copy_texto:
      'HEADLINE:\nVolte a correr sem dor no joelho.\n\nSUBHEADLINE:\nTratamento moderno, sem cirurgia de primeira linha. Dr. Rafael Azevedo — 10 anos cuidando de atletas amadores.',
    observacoes: 'Concluído e rodando tráfego há 2 semanas.',
    created_at: daysISO(-50) + 'T10:00:00Z',
    updated_at: daysISO(-10) + 'T18:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c5,
    titulo: 'Site + LP Estética Renascer',
    tipo: 'site_institucional',
    status: 'aprovacao_copy',
    responsavel_id: pAmanda,
    prazo: daysISO(45),
    url_producao: null,
    briefing: 'Site institucional com foco em cirurgia plástica feminina. LPs específicas para lipo e mamoplastia.',
    briefing_pdf_url: 'https://drive.google.com/file/d/demo-briefing-renascer/view',
    identidade_visual_url: 'https://drive.google.com/drive/folders/demo-identidade-renascer',
    fotos: [],
    copy_texto:
      'HERO:\nRenasça. Com a segurança que você merece.\n\n(aguardando aprovação do cliente)',
    observacoes: 'Copy enviada — aguardando feedback da cliente.',
    created_at: daysISO(-8) + 'T14:00:00Z',
    updated_at: daysISO(-4) + 'T09:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c1,
    titulo: 'LP Black Friday — pacotes estéticos',
    tipo: 'landing_page',
    status: 'aprovacao_design',
    responsavel_id: pAmanda,
    prazo: daysISO(5),
    url_producao: null,
    briefing: 'LP promocional com contador regressivo, 3 pacotes de preço, FAQ e formulário. Válida só em novembro.',
    briefing_pdf_url: null,
    identidade_visual_url: 'https://drive.google.com/drive/folders/demo-identidade-fernanda',
    fotos: ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400'],
    copy_texto:
      'HEADLINE:\nBlack November da Dra. Fernanda — até 40% off nos tratamentos mais queridos.\n\n3 PACOTES:\n1. Essencial (botox) — de R$ 2.400 por R$ 1.680\n2. Completo (botox + skinbooster) — de R$ 3.800 por R$ 2.660\n3. Premium (pacote 5 sessões) — de R$ 6.000 por R$ 3.900',
    observacoes: 'Cliente pediu ajuste no hero. Segunda rodada de revisão de design.',
    created_at: daysISO(-7) + 'T11:00:00Z',
    updated_at: daysISO(-1) + 'T17:00:00Z',
  },
]

const criativos_webdesign: Row[] = [
  {
    id: uid(),
    cliente_id: c1,
    titulo: 'Rejuvenescimento facial 35-55',
    formato: 'feed_estatico',
    status: 'design',
    responsavel_id: pAmanda,
    prazo: daysISO(3),
    url_criativo: null,
    briefing: 'Criativo de campanha de rejuvenescimento facial. Antes/depois, tom empoderador.',
    briefing_pdf_url: null,
    identidade_visual_url: 'https://drive.google.com/drive/folders/demo-identidade-fernanda',
    fotos: ['https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400'],
    copy_texto:
      'Headline: Recupere o brilho da sua pele.\nCTA: Quero avaliação',
    observacoes: 'Primeiro draft indo pra cliente.',
    created_at: daysISO(-4) + 'T09:00:00Z',
    updated_at: daysISO(-1) + 'T14:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c2,
    titulo: 'Catarata: 15 minutos de cirurgia',
    formato: 'story',
    status: 'design_finalizado',
    responsavel_id: pBruno,
    prazo: daysISO(2),
    url_criativo: null,
    briefing:
      'Reels 30s sobre cirurgia de catarata. Doutor explicando em linguagem simples, tom tranquilizador.',
    briefing_pdf_url: null,
    identidade_visual_url: null,
    fotos: [],
    copy_texto:
      'Legenda: Catarata? 15 minutos e você enxerga de novo. Agende sua avaliação.',
    observacoes: null,
    created_at: daysISO(-6) + 'T11:00:00Z',
    updated_at: daysISO(-1) + 'T10:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c4,
    titulo: 'Cefaleia crônica: 70% nunca foi ao neuro',
    formato: 'carrossel',
    status: 'aprovacao_design',
    responsavel_id: pBruno,
    prazo: daysISO(1),
    url_criativo: null,
    briefing: 'Carrossel educativo sobre cefaleia crônica. 8 cards. Tom informativo + CTA final.',
    briefing_pdf_url: 'https://drive.google.com/file/d/demo-briefing-carrossel/view',
    identidade_visual_url: null,
    fotos: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400',
    ],
    copy_texto:
      'Card 1: Você sabia que 70% das pessoas com cefaleia nunca foram ao neuro?\n...',
    observacoes: 'Enviado para aprovação do neurologista responsável.',
    created_at: daysISO(-8) + 'T14:00:00Z',
    updated_at: daysISO(-2) + 'T09:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c3,
    titulo: 'Joelho: volte a correr sem dor',
    formato: 'carrossel',
    status: 'alteracao',
    responsavel_id: pAmanda,
    prazo: daysISO(-1),
    url_criativo: null,
    briefing: 'Vídeo do médico explicando dor no joelho. Formato 1:1.',
    briefing_pdf_url: null,
    identidade_visual_url: null,
    fotos: [],
    copy_texto: 'Headline: Seu joelho pode voltar a te acompanhar nas trilhas.',
    observacoes: 'Cliente pediu mudar a música de fundo — muito intensa.',
    created_at: daysISO(-10) + 'T10:00:00Z',
    updated_at: daysISO(-1) + 'T17:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c1,
    titulo: 'Story Black Friday botox',
    formato: 'story',
    status: 'conclusao',
    responsavel_id: pAmanda,
    prazo: daysISO(-5),
    url_criativo: 'https://drive.google.com/file/d/demo-criativo-story-botox',
    briefing: 'Story de 15s para Meta — promoção de botox relâmpago.',
    briefing_pdf_url: null,
    identidade_visual_url: null,
    fotos: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400'],
    copy_texto: 'BOTOX por R$ 1.200 | só nesta semana',
    observacoes: 'Entregue e rodando em campanha.',
    created_at: daysISO(-14) + 'T12:00:00Z',
    updated_at: daysISO(-5) + 'T18:00:00Z',
  },
  {
    id: uid(),
    cliente_id: c4,
    titulo: 'Criativo institucional esclerose múltipla',
    formato: 'feed_estatico',
    status: 'pendente',
    responsavel_id: null,
    prazo: daysISO(7),
    url_criativo: null,
    briefing: 'Criativo institucional para esclerose múltipla. Briefing pendente do cliente.',
    briefing_pdf_url: null,
    identidade_visual_url: null,
    fotos: [],
    copy_texto: null,
    observacoes: 'Aguardando brief detalhado do neurologista.',
    created_at: daysISO(-1) + 'T10:00:00Z',
    updated_at: daysISO(-1) + 'T10:00:00Z',
  },
]

const monthFirstDate = (() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
})()

const prod1Id = 'prod-1'
const prod2Id = 'prod-2'
const prod3Id = 'prod-3'

const producoes_social_media: Row[] = [
  {
    id: prod1Id,
    cliente_id: c6,
    titulo: '[DR DANIEL OLIVEIRA] PLANEJAMENTO ABR/26',
    mes_referencia: monthFirstDate,
    responsavel_id: pAmanda,
    prazo: daysISO(14),
    briefing_pdf_url: 'https://drive.google.com/file/d/demo-briefing-daniel/view',
    referencias: [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400',
    ],
    observacoes: '12 posts planejados para abril. Foco em cirurgia do refluxo e bariátrica.',
    tema_mes: 'Bariátrica humanizada — quebrando estigmas',
    pilares: ['educacional', 'transformação', 'oferta'],
    ganchos_para_ads:
      '• Carrossel "Bariátrica X Canetas emagrecedoras" — alto potencial de saves\n• Reel da consulta com paciente real (autorizado)\n• Estático "10 causas silenciosas do refluxo" pode virar ad de TOFU',
    campanha_ativa_url: 'https://ads.google.com/aw/campaigns/demo-daniel-bariatrica',
    texto_introducao:
      'Nós trabalharemos com um funil de conteúdo, intercalando entre Conexão, Objeções e Autoridade. O posicionamento do Dr. Daniel será reforçado através de conteúdos que mostrem casos reais e desmistifiquem a bariátrica.',
    cadencia: '3 posts/semana — Seg, Qua e Sex',
    data_envio_aprovacao: daysISO(-3),
    aprovado_em: daysISO(-1) + 'T16:00:00Z',
    created_at: daysISO(-10) + 'T09:00:00Z',
    updated_at: daysISO(-1) + 'T14:00:00Z',
  },
  {
    id: prod2Id,
    cliente_id: c1,
    titulo: '[DRA. FERNANDA REIS] PLANEJAMENTO ABR/26',
    mes_referencia: monthFirstDate,
    responsavel_id: pAmanda,
    prazo: daysISO(20),
    briefing_pdf_url: null,
    referencias: [],
    observacoes: 'Planejamento mensal de dermato — foco em rejuvenescimento.',
    tema_mes: 'Rejuvenescimento sem invasão — protocolo combinado',
    pilares: ['educacional', 'prova social', 'institucional'],
    ganchos_para_ads:
      '• Antes/depois (com autorização) tem alto CTR\n• Mitos sobre botox vira lookalike de mulheres 35-50\n• Depoimento em vídeo — testar como ad de retargeting',
    campanha_ativa_url: null,
    texto_introducao:
      'Trabalharemos com um funil de Conexão → Objeções → Autoridade. O foco do mês é desmistificar tratamentos estéticos e mostrar casos reais com aprovação.',
    cadencia: '3 posts/semana — Ter, Qui e Sáb',
    data_envio_aprovacao: daysISO(2),
    aprovado_em: null,
    created_at: daysISO(-7) + 'T10:00:00Z',
    updated_at: daysISO(-2) + 'T11:00:00Z',
  },
  {
    id: prod3Id,
    cliente_id: c4,
    titulo: '[INSTITUTO NEURO+] PLANEJAMENTO ABR/26',
    mes_referencia: monthFirstDate,
    responsavel_id: pBruno,
    prazo: daysISO(18),
    briefing_pdf_url: null,
    referencias: [],
    observacoes: 'Conteúdo educativo sobre cefaleia e esclerose múltipla.',
    tema_mes: 'Cefaleia primária — quando suspeitar e quando tratar',
    pilares: ['educacional', 'autoridade'],
    ganchos_para_ads: '• Carrossel "5 sinais de cefaleia que precisam de neuro" — gancho TOFU clássico',
    campanha_ativa_url: null,
    texto_introducao:
      'O mês foca em educar o público sobre cefaleia primária. Posts intercalam entre conteúdo educacional e demonstração de autoridade clínica.',
    cadencia: '2 posts/semana — Seg e Qui',
    data_envio_aprovacao: daysISO(5),
    aprovado_em: null,
    created_at: daysISO(-5) + 'T09:00:00Z',
    updated_at: daysISO(-1) + 'T15:00:00Z',
  },
  {
    id: 'prod-4',
    cliente_id: c3,
    titulo: '[DR. RAFAEL AZEVEDO] PLANEJAMENTO MAR/26',
    mes_referencia: '2026-03-01',
    responsavel_id: pAmanda,
    prazo: daysISO(-15),
    briefing_pdf_url: null,
    referencias: [],
    observacoes: 'Mês fechado — todas as artes aprovadas e publicadas.',
    tema_mes: 'Lesões esportivas — primeira consulta',
    pilares: ['educacional', 'institucional'],
    ganchos_para_ads: null,
    campanha_ativa_url: null,
    texto_introducao: 'Mês de onboarding. Primeiros posts introduzem o Dr. Rafael e seu posicionamento.',
    cadencia: '2 posts/semana — Ter e Sex',
    data_envio_aprovacao: daysISO(-25),
    aprovado_em: daysISO(-22) + 'T11:00:00Z',
    created_at: daysISO(-30) + 'T09:00:00Z',
    updated_at: daysISO(-15) + 'T18:00:00Z',
  },
]

const producoes_social_media_items: Row[] = [
  // Planejamento do Dr. Daniel — 12 items variados (inspirado no print)
  { id: uid(), producao_id: prod1Id, formato: 'carrossel', titulo: '4 conselhos que eu, como cirurgião do aparelho digestivo, sempre dou', ideia_conteudo: 'Lista didática com 4 dicas práticas que reforçam autoridade e geram identificação com quem tem desconfortos digestivos.', status: 'design', responsavel_id: pAmanda, prazo: daysISO(3), copy_texto: 'Slide 1: Você sabia que 3 em cada 10 brasileiros sofrem de refluxo?\nSlide 2: Conselho 1 — não deite logo após comer\n...', copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 1, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'carrossel', titulo: 'Tudo o que você precisa saber antes de fazer uma cirurgia bariátrica', ideia_conteudo: 'Quebra de objeções clássicas sobre bariátrica. Requisitos, expectativas e pós-cirúrgico em linguagem acessível.', status: 'em_aprovacao', responsavel_id: pAmanda, prazo: daysISO(3), copy_texto: 'Carrossel informativo 8 slides.', copy_arquivo_url: null, fotos: [], observacoes: 'Enviado pro médico há 2 dias.', ordem: 2, reaproveitado_para_ad: true, reaproveitado_url: 'https://business.facebook.com/ads/manager/demo-ad-123', created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'carrossel', titulo: 'Você tem refluxo, e mesmo tratando ele sempre volta?', ideia_conteudo: 'Conexão com quem já tentou tudo. Mostrar que muitas vezes o problema é estrutural e tem solução cirúrgica.', status: 'pendente', responsavel_id: null, prazo: daysISO(3), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 3, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'carrossel', titulo: 'Os benefícios da Cirurgia videolaparoscópica', ideia_conteudo: 'Autoridade técnica. Explicar de forma simples por que é menos invasiva e tem recuperação melhor.', status: 'pendente', responsavel_id: null, prazo: daysISO(6), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 4, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'estatico', titulo: '10 principais causas do refluxo', ideia_conteudo: 'Checklist visual e direto. Posts estáticos do tipo gancho — alto índice de saves.', status: 'em_aprovacao', responsavel_id: pAmanda, prazo: daysISO(6), copy_texto: '1. Alimentação desregulada\n2. Sobrepeso...', copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 5, reaproveitado_para_ad: true, reaproveitado_url: null, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'estatico', titulo: 'O que torna um Aparelho digestivo saudável', ideia_conteudo: 'Infográfico circular com 5 pilares — descanso, alimentação, hidratação, movimento, acompanhamento.', status: 'em_aprovacao', responsavel_id: pAmanda, prazo: daysISO(6), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 6, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'estatico', titulo: 'Toda dor e desconforto tem uma causa', ideia_conteudo: 'Frase de impacto com linguagem direta. Quebra a auto-medicação e leva à consulta.', status: 'pendente', responsavel_id: null, prazo: daysISO(9), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 7, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'estatico', titulo: 'Dor no estômago: o que geralmente acham X o que realmente é', ideia_conteudo: 'Comparação visual entre crenças populares e diagnósticos reais. Posicionamento de autoridade.', status: 'pendente', responsavel_id: null, prazo: daysISO(9), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 8, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'reel', titulo: 'Cirurgia videolaparoscópica: como é feita?', ideia_conteudo: 'Reel curto mostrando o procedimento de forma didática. Transparência gera confiança.', status: 'pendente', responsavel_id: null, prazo: daysISO(9), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 9, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'reel', titulo: 'Bariátrica X Canetas emagrecedoras: qual é a opção mais indicada?', ideia_conteudo: 'Comparação direta entre tratamentos. Quebra de objeção do tipo "vou fazer caneta porque é mais fácil".', status: 'pendente', responsavel_id: null, prazo: daysISO(12), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 10, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'reel', titulo: '[CAIXINHA DE PERGUNTA] "Fui diagnosticado com hérnia..."', ideia_conteudo: 'Resposta a uma pergunta real do público. Conexão e autoridade.', status: 'pendente', responsavel_id: null, prazo: daysISO(12), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 11, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod1Id, formato: 'estatico', titulo: 'Agende sua consulta — primeira avaliação humanizada', ideia_conteudo: 'CTA do mês. Post estático com link da bio e fala calorosa pra o paciente.', status: 'conclusao', responsavel_id: pAmanda, prazo: daysISO(-2), copy_texto: 'CTA final do mês.', copy_arquivo_url: null, fotos: [], observacoes: 'Já programado.', ordem: 12, publicado_url: 'https://instagram.com/p/DEMO_DR_DANIEL_CTA/', publicado_em: daysISO(-2) + 'T18:30:00Z', publicado_por: pAmanda, created_at: nowISO(), updated_at: nowISO() },

  // Planejamento Dra. Fernanda — 6 items
  { id: uid(), producao_id: prod2Id, formato: 'carrossel', titulo: '5 mitos sobre botox que você ainda acredita', status: 'design_finalizado', responsavel_id: pAmanda, prazo: daysISO(2), copy_texto: 'Carrossel 6 slides, desmitificando crenças comuns.', copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 1, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod2Id, formato: 'estatico', titulo: 'Antes e depois — preenchimento labial', status: 'alteracao', responsavel_id: pAmanda, prazo: daysISO(2), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: 'Cliente pediu trocar a modelo do before/after.', ordem: 2, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod2Id, formato: 'reel', titulo: 'Um dia na clínica com a Dra. Fernanda', status: 'design', responsavel_id: pAmanda, prazo: daysISO(2), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 3, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod2Id, formato: 'estatico', titulo: 'Skinbooster — o que é e pra quem é indicado', status: 'pendente', responsavel_id: null, prazo: daysISO(5), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 4, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod2Id, formato: 'carrossel', titulo: 'Rotina de skincare da Dra. — passo a passo', status: 'em_aprovacao', responsavel_id: pAmanda, prazo: daysISO(5), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 5, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod2Id, formato: 'reel', titulo: 'Depoimento paciente Patrícia — 3 meses de acompanhamento', status: 'conclusao', responsavel_id: pAmanda, prazo: daysISO(5), copy_texto: 'Vídeo gravado e editado. Postagem programada.', copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 6, created_at: nowISO(), updated_at: nowISO() },

  // Planejamento Neuro — 4 items
  { id: uid(), producao_id: prod3Id, formato: 'carrossel', titulo: 'Cefaleia crônica vs enxaqueca — entenda a diferença', status: 'design', responsavel_id: pBruno, prazo: daysISO(4), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 1, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod3Id, formato: 'reel', titulo: 'Quando ir ao neurologista? 4 sinais de alerta', status: 'em_aprovacao', responsavel_id: pBruno, prazo: daysISO(4), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 2, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod3Id, formato: 'estatico', titulo: 'Mitos e verdades sobre esclerose múltipla', status: 'pendente', responsavel_id: null, prazo: daysISO(4), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 3, created_at: nowISO(), updated_at: nowISO() },
  { id: uid(), producao_id: prod3Id, formato: 'carrossel', titulo: 'Dicas para melhorar a qualidade do sono', status: 'conclusao', responsavel_id: pBruno, prazo: daysISO(7), copy_texto: null, copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 4, created_at: nowISO(), updated_at: nowISO() },
  // Planejamento Dr. Rafael (mês fechado) — 3 items todos concluídos (vai pra "Concluídos")
  { id: uid(), producao_id: 'prod-4', formato: 'carrossel', titulo: 'Joelho que estala: quando se preocupar?', status: 'conclusao', responsavel_id: pAmanda, prazo: daysISO(-25), copy_texto: 'Carrossel publicado em 15/03.', copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 1, created_at: daysISO(-30) + 'T09:00:00Z', updated_at: daysISO(-25) + 'T15:00:00Z' },
  { id: uid(), producao_id: 'prod-4', formato: 'reel', titulo: '3 exercícios para fortalecer o joelho em casa', status: 'conclusao', responsavel_id: pAmanda, prazo: daysISO(-22), copy_texto: 'Reel gravado e publicado.', copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 2, created_at: daysISO(-30) + 'T09:00:00Z', updated_at: daysISO(-22) + 'T11:00:00Z' },
  { id: uid(), producao_id: 'prod-4', formato: 'estatico', titulo: 'Dor crônica no joelho: causas e tratamentos', status: 'conclusao', responsavel_id: pAmanda, prazo: daysISO(-18), copy_texto: 'Estático informativo.', copy_arquivo_url: null, fotos: [], observacoes: null, ordem: 3, created_at: daysISO(-30) + 'T09:00:00Z', updated_at: daysISO(-18) + 'T16:00:00Z' },
]

// Métricas mensais de Social Media — dados realistas pra alimentar
// o dashboard de KPIs do playbook 7. Geramos pros últimos 3 meses
// dos clientes que estão "postando".
const cliente_metricas_social: Row[] = (() => {
  const out: Row[] = []
  const hoje = new Date()
  const clientesPostando = clientes.filter(
    (c) =>
      Array.isArray(c.modulos) && c.modulos.includes('social_media') && c.jornada_social === 'postando',
  )
  for (const c of clientesPostando) {
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - offset, 1)
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      // Engajamento médio cresce um pouco por mês (efeito de aprendizado)
      const baseEng = 3.2 + (3 - offset) * 0.4 + Math.random() * 0.5
      out.push({
        cliente_id: c.id,
        mes_referencia: mes,
        engajamento_medio: Number(baseEng.toFixed(2)),
        alcance_medio: Math.round(8000 + (3 - offset) * 1500 + Math.random() * 2000),
        seguidores: Math.round(12000 + (3 - offset) * 280 + Math.random() * 100),
        nota_qualitativa: offset === 0 ? null : 7 + Math.floor(Math.random() * 3), // mês corrente vazio (ainda não avaliado)
        observacoes:
          offset === 0
            ? null
            : offset === 1
            ? 'Reels começaram a engajar mais. Continuar testando formato em primeira pessoa.'
            : 'Mês de adaptação. Identidade visual ainda em ajuste.',
        created_at: d.toISOString(),
        updated_at: d.toISOString(),
      })
    }
  }
  return out
})()

// Banco de ideias / referências (playbook 3.4 — Inovação)
const cliente_ideias_social: Row[] = (() => {
  const out: Row[] = []
  // Apenas clientes com módulo social_media
  const clientesSM = clientes.filter(
    (c) => Array.isArray(c.modulos) && c.modulos.includes('social_media'),
  )

  // Algumas ideias variadas pro Dr. Daniel (mais ricas)
  const ideiasDaniel = [
    {
      titulo: 'Carrossel de "antes do sintoma"',
      descricao:
        'Mostrar comportamentos que precedem sintomas digestivos por anos. Inspiração: @dra.lifestyleclinical.',
      url: 'https://www.instagram.com/reel/REF_LIFESTYLE/',
      formato_alvo: 'carrossel',
      status: 'a_testar',
      tags: ['educacional', 'gancho'],
    },
    {
      titulo: 'Reel de bastidor — sala de cirurgia',
      descricao: 'Vídeo de 30s mostrando a equipe se preparando, com voz over explicando procedimento.',
      url: null,
      formato_alvo: 'reel',
      status: 'em_teste',
      tags: ['bastidores', 'autoridade'],
    },
    {
      titulo: 'Estático "antes vs depois" da consulta',
      descricao:
        'Comparativo de "como você chega ansioso" vs "como sai com plano de tratamento". Estilo split-screen.',
      url: null,
      formato_alvo: 'estatico',
      status: 'testado',
      tags: ['conexão', 'transformação'],
    },
  ]

  for (const ideia of ideiasDaniel) {
    out.push({
      id: uid(),
      cliente_id: clientesSM.find((c) => c.nome.includes('Daniel'))?.id ?? clientesSM[0]?.id,
      ...ideia,
      criado_por: pAmanda,
      created_at: daysISO(-12) + 'T10:00:00Z',
      updated_at: daysISO(-3) + 'T15:00:00Z',
    })
  }

  // Uma ideia genérica pros outros clientes SM
  for (const c of clientesSM) {
    if (c.nome.includes('Daniel')) continue
    out.push({
      id: uid(),
      cliente_id: c.id,
      titulo: 'Trend "POV: você está saindo da consulta..."',
      descricao: 'Aproveitar trend atual com áudio engraçado pra humanizar a experiência médica.',
      url: 'https://www.instagram.com/reel/DEMO_TREND/',
      formato_alvo: 'reel',
      status: 'a_testar',
      tags: ['trend', 'humanização'],
      criado_por: c.social_media_id ?? pAmanda,
      created_at: daysISO(-5) + 'T11:00:00Z',
      updated_at: daysISO(-5) + 'T11:00:00Z',
    })
  }

  return out
})()

// Setup do perfil — uma linha por cliente que tem o módulo social_media.
// Inicia tudo como pendente (estado real do dia-a-dia).
const cliente_perfil_setup: Row[] = clientes
  .filter((c) => Array.isArray(c.modulos) && c.modulos.includes('social_media'))
  .map((c) => {
    // Pra demo: clientes "postando" já têm setup completo, "onboarding" ainda incompleto
    const completo = c.jornada_social === 'postando'
    return {
      cliente_id: c.id,
      foto_status: completo ? 'ok' : 'em_revisao',
      foto_url: completo ? 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=200' : null,
      foto_obs: completo ? 'Foto profissional aprovada em sessão.' : 'Aguardando nova foto profissional.',
      bio_status: completo ? 'ok' : 'pendente',
      bio_texto: completo ? `${c.nome} — especialista em ${c.nicho ?? 'medicina'}.\n📍 Atendimento humanizado\n📞 WhatsApp na bio` : null,
      bio_obs: completo ? 'Bio reescrita com foco em autoridade.' : null,
      destaques_status: completo ? 'ok' : 'pendente',
      destaques_obs: completo ? '6 destaques organizados: Sobre, Procedimentos, Depoimentos, Antes/Depois, Equipe, FAQ' : null,
      contato_status: completo ? 'ok' : 'pendente',
      contato_obs: completo ? 'Endereço, WhatsApp e e-mail validados.' : null,
      ultima_revisao_em: completo ? daysISO(-15) + 'T10:00:00Z' : null,
      ultima_revisao_por: completo ? c.social_media_id : null,
      created_at: c.created_at,
      updated_at: completo ? daysISO(-15) + 'T10:00:00Z' : nowISO(),
    }
  })

const db: Record<Tables, Row[]> = {
  profiles,
  squads,
  task_templates,
  clientes,
  tarefas,
  tarefa_comentarios,
  ativos,
  logins_acessos,
  otimizacoes,
  leads,
  metas,
  criacoes,
  projetos_webdesign,
  criativos_webdesign,
  producoes_social_media,
  producoes_social_media_items,
  cliente_perfil_setup,
  cliente_metricas_social,
  cliente_ideias_social,
}

// ---------- Persistência em localStorage (demo) ----------
// As tabelas marcadas aqui sobrevivem a F5/refresh. As demais usam só o seed.
// (tarefas usam datas relativas a "hoje", então reinicializam a cada sessão.)
const PERSISTED_TABLES: Tables[] = [
  'profiles',
  'squads',
  'clientes',
  'ativos',
  'logins_acessos',
  'metas',
  'criacoes',
  'otimizacoes',
  'leads',
  'projetos_webdesign',
  'criativos_webdesign',
  'producoes_social_media',
  'producoes_social_media_items',
]
// v3 — adicionou modulos, jornada_social, social_media_id em cliente,
// cliente_perfil_setup, métricas social, ideias, items.publicado_*, etc.
// Bump pra invalidar caches antigos sem esses campos.
const STORAGE_KEY = 'movmed-mockdb-v3'

function hydrateFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<Record<Tables, Row[]>>
    for (const key of PERSISTED_TABLES) {
      const rows = saved[key]
      if (Array.isArray(rows)) {
        db[key].length = 0
        db[key].push(...rows)
      }
    }
  } catch {
    /* silencia — se der erro, mantém o seed */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function persistToStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return
  // Debounce para não escrever em cada keystroke
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      const snapshot: Record<string, Row[]> = {}
      for (const key of PERSISTED_TABLES) snapshot[key] = db[key]
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      /* quota excedida ou contexto sem storage */
    }
  }, 200)
}

function persistIfTracked(table: Tables) {
  if (PERSISTED_TABLES.includes(table)) persistToStorage()
}

hydrateFromStorage()

// ---------- Query builder ----------

function parseJoins(selectStr: string) {
  const joins: { alias: string; table: string }[] = []
  let depth = 0
  let buf = ''
  const parts: string[] = []
  for (const ch of selectStr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim())
      buf = ''
    } else buf += ch
  }
  if (buf.trim()) parts.push(buf.trim())
  for (const p of parts) {
    const m = p.match(/^(\w+):(\w+)\(([^)]*)\)$/)
    if (m) joins.push({ alias: m[1], table: m[2] })
  }
  return joins
}

function fkFor(alias: string): string {
  // maps the alias used in select() to the FK column on the current row
  const map: Record<string, string> = {
    gestor: 'gestor_id',
    cliente: 'cliente_id',
    responsavel: 'responsavel_id',
    autor: 'autor_id',
    verificado_por: 'verificado_por',
    profiles: 'id',
    template: 'template_id',
  }
  return map[alias] ?? `${alias}_id`
}

function hydrate(row: Row, joins: { alias: string; table: string }[]) {
  const out: Row = { ...row }
  for (const j of joins) {
    const fk = fkFor(j.alias)
    const val = row[fk]
    out[j.alias] = val ? (db[j.table as Tables]?.find((x) => x.id === val) ?? null) : null
  }
  return out
}

class Q {
  table: Tables
  _select = '*'
  _count: string | undefined
  _head = false
  _filters: Array<(r: Row) => boolean> = []
  _orders: { field: string; asc: boolean }[] = []
  _limit: number | null = null
  _mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  _payload: any = null
  _onConflict: string[] = []

  constructor(table: Tables) {
    this.table = table
  }

  select(s = '*', opts: { count?: string; head?: boolean } = {}) {
    this._select = s
    this._count = opts.count
    this._head = !!opts.head
    return this
  }
  insert(payload: any) {
    this._mode = 'insert'
    this._payload = payload
    return this
  }
  update(payload: any) {
    this._mode = 'update'
    this._payload = payload
    return this
  }
  upsert(payload: any, opts: { onConflict?: string } = {}) {
    this._mode = 'upsert'
    this._payload = payload
    this._onConflict = opts.onConflict?.split(',').map((s) => s.trim()) ?? []
    return this
  }
  delete() {
    this._mode = 'delete'
    return this
  }

  eq(f: string, v: any) { this._filters.push((r) => r[f] === v); return this }
  neq(f: string, v: any) { this._filters.push((r) => r[f] !== v); return this }
  gt(f: string, v: any) { this._filters.push((r) => r[f] > v); return this }
  gte(f: string, v: any) { this._filters.push((r) => r[f] >= v); return this }
  lt(f: string, v: any) { this._filters.push((r) => r[f] < v); return this }
  lte(f: string, v: any) { this._filters.push((r) => r[f] <= v); return this }
  in(f: string, arr: any[]) { this._filters.push((r) => arr.includes(r[f])); return this }
  /** `.is(field, null)` — filtra registros onde o campo é null/undefined */
  is(f: string, v: any) {
    this._filters.push((r) => {
      if (v === null) return r[f] === null || r[f] === undefined
      return r[f] === v
    })
    return this
  }
  /**
   * Equivalente a `.not(field, 'is', null)` ou `.not(field, 'eq', value)`.
   * Suporta o que a gente realmente usa no app.
   */
  not(f: string, op: string, v: any) {
    this._filters.push((r) => {
      const val = r[f]
      if (op === 'is') {
        if (v === null) return val !== null && val !== undefined
        return val !== v
      }
      if (op === 'eq') return val !== v
      if (op === 'in') return Array.isArray(v) ? !v.includes(val) : true
      return true
    })
    return this
  }
  /**
   * Filtra arrays/jsonb que contenham todos os valores informados.
   * Equivale ao operador `@>` do Postgres usado pra `modulos`, `fotos`, etc.
   */
  contains(f: string, arr: any[]) {
    this._filters.push((r) => {
      const v = r[f]
      if (!Array.isArray(v)) return false
      return arr.every((x: any) => v.includes(x))
    })
    return this
  }
  order(f: string, o: { ascending?: boolean } = {}) {
    this._orders.push({ field: f, asc: o.ascending !== false })
    return this
  }
  limit(n: number) { this._limit = n; return this }

  single() { return this._run().then((r) => ({ data: (r.data as Row[])?.[0] ?? null, error: null })) }
  maybeSingle() { return this.single() }

  then<T = any, E = any>(onFulfilled?: (v: any) => T, onRejected?: (e: any) => E): Promise<T | E> {
    return this._run().then(onFulfilled as any, onRejected as any)
  }

  private _run(): Promise<{ data: any; error: any; count: number }> {
    return new Promise((resolve) => {
      const table = db[this.table]
      if (this._mode === 'insert') {
        const rows = (Array.isArray(this._payload) ? this._payload : [this._payload]).map((r: any) => ({
          id: uid(),
          created_at: nowISO(),
          updated_at: nowISO(),
          ...r,
        }))
        table.push(...rows)
        onAfterInsert(this.table, rows)
        persistIfTracked(this.table)
        return resolve({ data: rows, error: null, count: rows.length })
      }
      if (this._mode === 'update') {
        const matched = table.filter((r) => this._filters.every((f) => f(r)))
        matched.forEach((r) => Object.assign(r, this._payload, { updated_at: nowISO() }))
        if (matched.length > 0) persistIfTracked(this.table)
        return resolve({ data: matched, error: null, count: matched.length })
      }
      if (this._mode === 'upsert') {
        const rows = Array.isArray(this._payload) ? this._payload : [this._payload]
        const results: Row[] = []
        for (const r of rows) {
          let existing: Row | undefined
          if (this._onConflict.length > 0) {
            existing = table.find((ex) => this._onConflict.every((k) => ex[k] === r[k]))
          }
          if (existing) {
            Object.assign(existing, r, { updated_at: nowISO() })
            results.push(existing)
          } else {
            const newRow = { id: uid(), created_at: nowISO(), updated_at: nowISO(), ...r }
            table.push(newRow)
            results.push(newRow)
          }
        }
        persistIfTracked(this.table)
        return resolve({ data: results, error: null, count: results.length })
      }
      if (this._mode === 'delete') {
        let deleted = 0
        for (let i = table.length - 1; i >= 0; i--) {
          if (this._filters.every((f) => f(table[i]))) {
            table.splice(i, 1)
            deleted++
          }
        }
        if (deleted > 0) persistIfTracked(this.table)
        return resolve({ data: null, error: null, count: 0 })
      }
      // select
      let filtered = table.filter((r) => this._filters.every((f) => f(r)))
      if (this._orders.length > 0) {
        filtered = [...filtered].sort((a, b) => {
          for (const o of this._orders) {
            const av = a[o.field], bv = b[o.field]
            if (av === bv) continue
            if (av == null) return 1
            if (bv == null) return -1
            return (av < bv ? -1 : 1) * (o.asc ? 1 : -1)
          }
          return 0
        })
      }
      if (this._limit) filtered = filtered.slice(0, this._limit)
      const count = filtered.length
      if (this._head) return resolve({ data: null, error: null, count })
      const joins = parseJoins(this._select)
      const data = filtered.map((r) => (joins.length > 0 ? hydrate(r, joins) : r))
      resolve({ data, error: null, count })
    })
  }
}

// Trigger "apply_client_bootstrap" — ao inserir cliente, cria tarefas (a partir de templates ativos) e 5 ativos
function onAfterInsert(table: Tables, rows: Row[]) {
  if (table !== 'clientes') return
  for (const cliente of rows) {
    const actives = db.task_templates.filter((t) => t.ativo)
    for (const t of actives) {
      const due =
        t.frequencia === 'diaria' ? today()
        : t.frequencia === 'semanal' ? daysISO(7)
        : t.frequencia === 'mensal' ? daysISO(30)
        : null
      db.tarefas.push({
        id: uid(),
        cliente_id: cliente.id,
        template_id: t.id,
        nome: t.nome,
        descricao: t.descricao,
        frequencia: t.frequencia,
        prioridade: t.prioridade,
        status: 'pendente',
        responsavel_id: cliente.gestor_id ?? null,
        data_vencimento: due,
        data_conclusao: null,
        created_at: nowISO(),
        updated_at: nowISO(),
      })
    }
    const tipos = ['meta_pixel', 'ga4', 'google_meu_negocio', 'bio_estruturada', 'publicos_meta_ads']
    for (const tipo of tipos) {
      db.ativos.push({
        id: uid(),
        cliente_id: cliente.id,
        tipo,
        status: 'pendente',
        link: null,
        ultima_verificacao: null,
        verificado_por: null,
        observacoes: null,
        created_at: nowISO(),
        updated_at: nowISO(),
      })
    }
  }
}

// ---------- Auth ----------

type Session = { user: { id: string; email: string } } | null
let currentSession: Session = { user: { id: pAdmin, email: 'willian@movmed.com' } }
const authSubs: Array<(event: string, s: Session) => void> = []
function notify(event: string) {
  authSubs.forEach((cb) => cb(event, currentSession))
}

const mockAuth = {
  getSession: async () => ({ data: { session: currentSession }, error: null }),
  onAuthStateChange: (cb: (event: string, s: Session) => void) => {
    authSubs.push(cb)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const i = authSubs.indexOf(cb)
            if (i >= 0) authSubs.splice(i, 1)
          },
        },
      },
    }
  },
  signInWithPassword: async ({ email }: { email: string; password: string }) => {
    const p = db.profiles.find((x) => x.email === email)
    if (!p) {
      return {
        data: { session: null },
        error: { message: 'E-mail não encontrado. Use willian@movmed.com (admin), amanda@movmed.com, bruno@movmed.com ou carla@movmed.com — qualquer senha.' },
      }
    }
    currentSession = { user: { id: p.id, email: p.email } }
    notify('SIGNED_IN')
    return { data: { session: currentSession }, error: null }
  },
  signUp: async ({ email, options }: any) => {
    if (db.profiles.some((p) => p.email === email))
      return { data: null, error: { message: 'E-mail já cadastrado.' } }
    const nome = options?.data?.nome ?? email.split('@')[0]
    const profile = { id: uid(), nome, email, role: 'gestor', avatar_url: null, ativo: true, created_at: nowISO() }
    db.profiles.push(profile)
    currentSession = { user: { id: profile.id, email: profile.email } }
    notify('SIGNED_IN')
    return { data: { session: currentSession }, error: null }
  },
  signOut: async () => {
    currentSession = null
    notify('SIGNED_OUT')
    return { error: null }
  },
}

export const mockClient = {
  from: (table: Tables) => new Q(table),
  auth: mockAuth,
}

export const MOCK_BANNER =
  'Você está em modo DEMO com dados fictícios. Crie um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o Supabase real.'
