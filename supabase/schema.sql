-- =====================================================
-- CENTRAL DE CONTAS MOVMED — SCHEMA
-- =====================================================

-- ENUMS
create type user_role as enum ('admin', 'gestor', 'supervisor');
create type plataforma_ads as enum ('google_ads', 'meta_ads', 'ambos');
create type fonte_crm as enum ('kommo', 'nativo');
create type status_cliente as enum ('ativo', 'atencao', 'pausado', 'churn');
create type tipo_cliente as enum ('assessoria', 'consultoria');
create type jornada_cliente as enum ('onboarding', 'otimizacao', 'expansao', 'retencao');
create type semaforo_cliente as enum ('verde', 'amarelo', 'laranja', 'vermelho');
create type frequencia_tarefa as enum ('diaria', 'semanal', 'mensal', 'esporadica');
create type prioridade_tarefa as enum ('baixa', 'media', 'alta');
create type status_tarefa as enum ('pendente', 'em_andamento', 'concluida', 'cancelada');
create type tipo_ativo as enum ('meta_pixel', 'ga4', 'google_meu_negocio', 'bio_estruturada', 'publicos_meta_ads');
create type status_ativo as enum ('pendente', 'configurado', 'funcional', 'com_problema');
create type tipo_otimizacao as enum ('ajuste_lance', 'pausa_campanha', 'novo_criativo', 'ajuste_publico', 'ajuste_orcamento', 'teste_ab', 'outro');
create type origem_lead as enum ('kommo', 'manual', 'importacao');
create type tipo_criacao as enum ('copy_lp', 'planejamento', 'roteiro', 'copy_criativos');
create type status_criacao as enum ('rascunho', 'em_revisao', 'aprovado', 'publicado');
create type tipo_projeto_webdesign as enum ('site_institucional', 'landing_page', 'ecommerce', 'blog', 'outro');
create type status_projeto_webdesign as enum ('copy', 'aprovacao_copy', 'design', 'aprovacao_design', 'implementacao', 'conclusao', 'pausado');
create type formato_criativo as enum (
  'feed_estatico',
  'story',
  'carrossel',
  'outro',
  'feed_estatico_story'
);
create type status_criativo_webdesign as enum ('pendente', 'design', 'design_finalizado', 'aprovacao_design', 'alteracao', 'conclusao');
create type formato_social_media as enum ('carrossel', 'estatico', 'reel', 'outro');
create type status_social_media as enum ('pendente', 'design', 'design_finalizado', 'alteracao', 'em_aprovacao', 'conclusao');

-- PERFIS DE USUÁRIO
create type cargo as enum (
  'gestor_trafego',
  'account_manager',
  'designer',
  'social_media',
  'diretoria',
  'head'
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  -- auth_user_id é opcional: profile pode existir sem login (cadastro pelo admin)
  -- e é vinculado quando o usuário se registra via Auth com o mesmo e-mail.
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  email text not null unique,
  role user_role not null default 'gestor',
  cargo cargo,
  squad_id uuid,
  avatar_url text,
  ativo boolean default true,
  aprovado boolean default false,
  created_at timestamptz default now()
);
create index idx_profiles_auth_user_id on profiles(auth_user_id);
create index idx_profiles_email on profiles(lower(email));

-- SQUADS (times operacionais)
create table squads (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  lider_id uuid references profiles(id) on delete set null,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles add constraint profiles_squad_fk
  foreign key (squad_id) references squads(id) on delete set null;

-- CLIENTES
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nicho text,
  squad text,
  tipo tipo_cliente,
  gestor_id uuid references profiles(id),
  account_manager_id uuid references profiles(id),
  social_media_id uuid references profiles(id),
  status status_cliente default 'ativo',
  jornada jornada_cliente,
  nps int check (nps between 0 and 10),
  semaforo semaforo_cliente,
  data_inicio date default current_date,
  plataformas plataforma_ads,
  verba_mensal numeric(12,2),
  verba_google numeric(12,2),
  verba_meta numeric(12,2),
  fonte_crm fonte_crm default 'nativo',
  kommo_account_id text,
  link_grupo text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TEMPLATES DE TAREFAS
create table task_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  frequencia frequencia_tarefa not null,
  prioridade prioridade_tarefa default 'media',
  dias_semana jsonb default '[]'::jsonb,
  dia_mes int check (dia_mes between 1 and 31),
  ativo boolean default true,
  created_at timestamptz default now()
);

-- TAREFAS
create table tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  template_id uuid references task_templates(id) on delete set null,
  nome text not null,
  descricao text,
  frequencia frequencia_tarefa not null,
  prioridade prioridade_tarefa default 'media',
  status status_tarefa default 'pendente',
  responsavel_id uuid references profiles(id),
  data_vencimento date,
  data_conclusao timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COMENTÁRIOS
create table tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid references tarefas(id) on delete cascade,
  autor_id uuid references profiles(id),
  texto text not null,
  created_at timestamptz default now()
);

-- ATIVOS
create table ativos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo tipo_ativo not null,
  status status_ativo default 'pendente',
  link text,
  ultima_verificacao timestamptz,
  verificado_por uuid references profiles(id),
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cliente_id, tipo)
);

-- LOGINS E ACESSOS (credenciais enviadas pelos clientes)
create table logins_acessos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  plataforma text not null,
  login text not null,
  senha text,
  url text,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- OTIMIZAÇÕES
create table otimizacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  responsavel_id uuid references profiles(id),
  data_otimizacao date default current_date,
  plataforma plataforma_ads not null,
  tipo tipo_otimizacao not null,
  descricao text not null,
  resultado text,
  created_at timestamptz default now()
);

-- LEADS
create table leads (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  origem origem_lead default 'manual',
  kommo_lead_id text,
  nome text,
  telefone text,
  email text,
  etapa text,
  valor numeric(12,2),
  responsavel_id uuid references profiles(id),
  data_entrada date default current_date,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- METAS
create table metas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  mes_ano date not null,
  meta_data jsonb default '{}'::jsonb,
  resultado_data jsonb default '{}'::jsonb,
  verba_planejada numeric(12,2),
  meta_leads int,
  meta_cpl numeric(12,2),
  meta_vendas int,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cliente_id, mes_ano)
);

-- PRODUÇÃO SOCIAL MEDIA (planejamento mensal + items)
create table producoes_social_media (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  titulo text not null,
  mes_referencia date,
  responsavel_id uuid references profiles(id),
  prazo date,
  briefing_pdf_url text,
  referencias jsonb default '[]'::jsonb,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table producoes_social_media_items (
  id uuid primary key default gen_random_uuid(),
  producao_id uuid references producoes_social_media(id) on delete cascade,
  formato formato_social_media not null default 'estatico',
  titulo text not null,
  status status_social_media not null default 'pendente',
  responsavel_id uuid references profiles(id),
  prazo date,
  copy_texto text,
  copy_arquivo_url text,
  artes_prontas jsonb default '[]'::jsonb,
  observacoes text,
  ordem int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CRIATIVOS WEBDESIGN
create table criativos_webdesign (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  titulo text,
  formato formato_criativo not null default 'feed_estatico',
  status status_criativo_webdesign not null default 'pendente',
  responsavel_id uuid references profiles(id),
  prazo date,
  url_criativo text,
  identidade_visual_url text,
  fotos jsonb default '[]'::jsonb,
  copy_texto text,
  copy_arquivo_url text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROJETOS WEBDESIGN
create table projetos_webdesign (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  titulo text,
  tipo tipo_projeto_webdesign not null default 'site_institucional',
  status status_projeto_webdesign not null default 'copy',
  responsavel_id uuid references profiles(id),
  prazo date,
  url_producao text,
  briefing text,
  briefing_pdf_url text,
  identidade_visual_url text,
  fotos jsonb default '[]'::jsonb,
  copy_arquivo_url text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CRIAÇÕES (copy LP, planejamento, roteiro, copy criativos)
create table criacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo tipo_criacao not null,
  titulo text not null,
  briefing text,
  prompt text,
  anexos jsonb,
  conteudo text,
  status status_criacao default 'rascunho',
  responsavel_id uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- INDEXES
create index idx_tarefas_cliente on tarefas(cliente_id);
create index idx_tarefas_responsavel on tarefas(responsavel_id);
create index idx_tarefas_vencimento on tarefas(data_vencimento);
create index idx_tarefas_status on tarefas(status);
create index idx_ativos_cliente on ativos(cliente_id);
create index idx_logins_acessos_cliente on logins_acessos(cliente_id);
create index idx_otimizacoes_cliente on otimizacoes(cliente_id);
create index idx_otimizacoes_data on otimizacoes(data_otimizacao);
create index idx_leads_cliente on leads(cliente_id);
create index idx_leads_kommo on leads(kommo_lead_id);
create index idx_metas_cliente on metas(cliente_id);
create index idx_criacoes_cliente on criacoes(cliente_id);
create index idx_criacoes_tipo on criacoes(tipo);
create index idx_clientes_squad on clientes(squad);
create index idx_projetos_webdesign_cliente on projetos_webdesign(cliente_id);
create index idx_projetos_webdesign_status on projetos_webdesign(status);
create index idx_criativos_webdesign_cliente on criativos_webdesign(cliente_id);
create index idx_criativos_webdesign_status on criativos_webdesign(status);
create index idx_producoes_social_media_cliente on producoes_social_media(cliente_id);
create index idx_producoes_social_media_items_prod on producoes_social_media_items(producao_id);
create index idx_producoes_social_media_items_status on producoes_social_media_items(status);

-- RLS
alter table profiles enable row level security;
alter table clientes enable row level security;
alter table task_templates enable row level security;
alter table tarefas enable row level security;
alter table tarefa_comentarios enable row level security;
alter table ativos enable row level security;
alter table logins_acessos enable row level security;
alter table otimizacoes enable row level security;
alter table leads enable row level security;
alter table metas enable row level security;
alter table criacoes enable row level security;
alter table projetos_webdesign enable row level security;
alter table criativos_webdesign enable row level security;
alter table producoes_social_media enable row level security;
alter table producoes_social_media_items enable row level security;

create policy "auth read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "auth write profiles" on profiles for all using (auth.role() = 'authenticated');
create policy "auth read clientes" on clientes for select using (auth.role() = 'authenticated');
create policy "auth write clientes" on clientes for all using (auth.role() = 'authenticated');
create policy "auth read templates" on task_templates for select using (auth.role() = 'authenticated');
create policy "auth write templates" on task_templates for all using (auth.role() = 'authenticated');
create policy "auth read tarefas" on tarefas for select using (auth.role() = 'authenticated');
create policy "auth write tarefas" on tarefas for all using (auth.role() = 'authenticated');
create policy "auth read comentarios" on tarefa_comentarios for select using (auth.role() = 'authenticated');
create policy "auth write comentarios" on tarefa_comentarios for all using (auth.role() = 'authenticated');
create policy "auth read ativos" on ativos for select using (auth.role() = 'authenticated');
create policy "auth write ativos" on ativos for all using (auth.role() = 'authenticated');
create policy "auth read logins_acessos" on logins_acessos for select using (auth.role() = 'authenticated');
create policy "auth write logins_acessos" on logins_acessos for all using (auth.role() = 'authenticated');
create policy "auth read otimizacoes" on otimizacoes for select using (auth.role() = 'authenticated');
create policy "auth write otimizacoes" on otimizacoes for all using (auth.role() = 'authenticated');
create policy "auth read leads" on leads for select using (auth.role() = 'authenticated');
create policy "auth write leads" on leads for all using (auth.role() = 'authenticated');
create policy "auth read metas" on metas for select using (auth.role() = 'authenticated');
create policy "auth write metas" on metas for all using (auth.role() = 'authenticated');
create policy "auth read criacoes" on criacoes for select using (auth.role() = 'authenticated');
create policy "auth write criacoes" on criacoes for all using (auth.role() = 'authenticated');
create policy "auth read projetos_webdesign" on projetos_webdesign for select using (auth.role() = 'authenticated');
create policy "auth write projetos_webdesign" on projetos_webdesign for all using (auth.role() = 'authenticated');
create policy "auth read criativos_webdesign" on criativos_webdesign for select using (auth.role() = 'authenticated');
create policy "auth write criativos_webdesign" on criativos_webdesign for all using (auth.role() = 'authenticated');
create policy "auth read producoes_sm" on producoes_social_media for select using (auth.role() = 'authenticated');
create policy "auth write producoes_sm" on producoes_social_media for all using (auth.role() = 'authenticated');
create policy "auth read producoes_sm_items" on producoes_social_media_items for select using (auth.role() = 'authenticated');
create policy "auth write producoes_sm_items" on producoes_social_media_items for all using (auth.role() = 'authenticated');

-- TRIGGER updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_clientes_updated before update on clientes for each row execute function set_updated_at();
create trigger trg_tarefas_updated before update on tarefas for each row execute function set_updated_at();
create trigger trg_ativos_updated before update on ativos for each row execute function set_updated_at();
create trigger trg_logins_acessos_updated before update on logins_acessos for each row execute function set_updated_at();
create trigger trg_leads_updated before update on leads for each row execute function set_updated_at();
create trigger trg_metas_updated before update on metas for each row execute function set_updated_at();
create trigger trg_criacoes_updated before update on criacoes for each row execute function set_updated_at();
create trigger trg_projetos_webdesign_updated before update on projetos_webdesign for each row execute function set_updated_at();
create trigger trg_criativos_webdesign_updated before update on criativos_webdesign for each row execute function set_updated_at();
create trigger trg_producoes_sm_updated before update on producoes_social_media for each row execute function set_updated_at();
create trigger trg_producoes_sm_items_updated before update on producoes_social_media_items for each row execute function set_updated_at();

-- AUTO-CREATE/LINK PROFILE ON SIGNUP
-- Quando um auth.user é criado, tenta linkar a um profile existente com mesmo e-mail
-- (caso o admin já tenha cadastrado o membro pela UI). Se não houver, cria um novo profile.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  matched_profile_id uuid;
begin
  select id into matched_profile_id
    from public.profiles
   where lower(email) = lower(new.email) and auth_user_id is null
   limit 1;

  if matched_profile_id is not null then
    update public.profiles set auth_user_id = new.id where id = matched_profile_id;
  else
    insert into public.profiles (auth_user_id, nome, email, role, aprovado, ativo)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
      new.email,
      'gestor',
      false,
      true
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- AUTO-APLICAR TEMPLATES E ATIVOS AO CRIAR CLIENTE
create or replace function public.apply_client_bootstrap()
returns trigger as $$
declare
  t record;
  due date;
begin
  for t in select * from task_templates where ativo = true loop
    due := case t.frequencia
      when 'diaria' then current_date
      when 'semanal' then current_date + 7
      when 'mensal' then current_date + 30
      else null
    end;
    insert into tarefas(cliente_id, template_id, nome, descricao, frequencia, prioridade, data_vencimento)
    values (new.id, t.id, t.nome, t.descricao, t.frequencia, t.prioridade, due);
  end loop;

  insert into ativos(cliente_id, tipo, status) values
    (new.id, 'meta_pixel', 'pendente'),
    (new.id, 'ga4', 'pendente'),
    (new.id, 'google_meu_negocio', 'pendente'),
    (new.id, 'bio_estruturada', 'pendente'),
    (new.id, 'publicos_meta_ads', 'pendente');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cliente_bootstrap on clientes;
create trigger trg_cliente_bootstrap
  after insert on clientes
  for each row execute function public.apply_client_bootstrap();
