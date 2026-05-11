-- =========================================================
-- Migration 014 — Métricas mensais + Reaproveitamento + Ideias
-- =========================================================
-- Cobre playbook 3.4 (Inovação) e seção 7 (KPIs):
--   • % posts publicados no prazo            → calculado
--   • Engajamento médio                      → input manual mensal
--   • Conteúdos reaproveitados pra tráfego  → toggle em cada item
--   • Evolução qualitativa do perfil         → nota 1-10 mensal
--   • Banco de ideias/referências            → 3.4 (Inovação)
-- =========================================================

-- 1) Métricas mensais por cliente (uma linha por cliente × mês)
create table if not exists cliente_metricas_social (
  cliente_id        uuid not null references clientes(id) on delete cascade,
  mes_referencia    date not null,
  engajamento_medio numeric(5,2),            -- ex: 4.25%
  alcance_medio     bigint,                   -- alcance médio dos posts do mês
  seguidores        int,                      -- snapshot do n. de seguidores no fim do mês
  nota_qualitativa  int,
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (cliente_id, mes_referencia),
  constraint cliente_metricas_nota_check
    check (nota_qualitativa is null or (nota_qualitativa between 1 and 10))
);

drop trigger if exists trg_metricas_social_updated on cliente_metricas_social;
create trigger trg_metricas_social_updated
  before update on cliente_metricas_social
  for each row execute function set_updated_at();

alter table cliente_metricas_social enable row level security;

drop policy if exists "auth read metricas_social" on cliente_metricas_social;
drop policy if exists "auth write metricas_social" on cliente_metricas_social;
create policy "auth read metricas_social" on cliente_metricas_social
  for select using (auth.role() = 'authenticated');
create policy "auth write metricas_social" on cliente_metricas_social
  for all using (auth.role() = 'authenticated');

-- 2) Reaproveitamento pra tráfego (em cada item de social media)
alter table producoes_social_media_items
  add column if not exists reaproveitado_para_ad boolean not null default false,
  add column if not exists reaproveitado_url     text;

-- 3) Banco de ideias / referências (playbook 3.4)
create table if not exists cliente_ideias_social (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  url           text,
  formato_alvo  text,                                              -- 'carrossel' | 'estatico' | 'reel' | null
  status        text not null default 'a_testar',
  tags          text[] not null default '{}',
  criado_por    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ideias_status_check
    check (status in ('a_testar', 'em_teste', 'testado', 'descartado'))
);

drop trigger if exists trg_ideias_social_updated on cliente_ideias_social;
create trigger trg_ideias_social_updated
  before update on cliente_ideias_social
  for each row execute function set_updated_at();

alter table cliente_ideias_social enable row level security;

drop policy if exists "auth read ideias_social" on cliente_ideias_social;
drop policy if exists "auth write ideias_social" on cliente_ideias_social;
create policy "auth read ideias_social" on cliente_ideias_social
  for select using (auth.role() = 'authenticated');
create policy "auth write ideias_social" on cliente_ideias_social
  for all using (auth.role() = 'authenticated');

create index if not exists idx_ideias_social_cliente on cliente_ideias_social(cliente_id);

-- 4) Confirmação
select
  (select count(*) from cliente_metricas_social) as total_metricas_mensais,
  (select count(*) from cliente_ideias_social)   as total_ideias_banco,
  (select count(*) from producoes_social_media_items where reaproveitado_para_ad) as itens_reaproveitados;
