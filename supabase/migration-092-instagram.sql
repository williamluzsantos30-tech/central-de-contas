-- =========================================================
-- Migration 092: Integração Instagram (Meta API) — persistência real
-- =========================================================
-- Tira o estado de conexão do Instagram do localStorage e leva pro banco:
--   1. cliente_instagram: estado de conexão por cliente (1:1) — modo (direta/
--      agência), handle, token, últimas datas.
--   2. instagram_config: conexão a nível de agência (Business Manager), 1 linha.
--   3. instagram_metricas: histórico mês a mês das métricas puxadas (por ora
--      snapshots do mock; quando o App Meta for aprovado, alimentado pela API).
--
-- A conexão REAL com a Meta ainda não existe (depende da aprovação do App);
-- o app continua simulando os dados, mas agora o ESTADO de conexão persiste.
--
-- Fallback: se estas tabelas não existirem, o app cai no localStorage (não
-- quebra). RLS: qualquer autenticado lê/escreve (o time de Social monitora
-- todas as contas).
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

-- 1. Conexão por cliente (1:1)
create table if not exists cliente_instagram (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  handle text not null default '',
  modo_conexao text not null default 'nao_conectado', -- direta | agencia | nao_conectado
  conta_conectada_em timestamptz,
  ultima_sincronizacao timestamptz,
  token_status text,                                    -- valido | expirado | revogado
  updated_at timestamptz default now()
);
alter table cliente_instagram enable row level security;
drop policy if exists "auth read ig conn" on cliente_instagram;
drop policy if exists "auth write ig conn" on cliente_instagram;
create policy "auth read ig conn" on cliente_instagram for select using (auth.role() = 'authenticated');
create policy "auth write ig conn" on cliente_instagram for all using (auth.role() = 'authenticated');
drop trigger if exists trg_ig_conn_updated on cliente_instagram;
create trigger trg_ig_conn_updated before update on cliente_instagram
  for each row execute function set_updated_at();

-- 2. Config de agência (linha única)
create table if not exists instagram_config (
  id text primary key default 'default',
  conectado boolean not null default false,
  business_manager text,
  conectado_em timestamptz,
  updated_at timestamptz default now()
);
alter table instagram_config enable row level security;
drop policy if exists "auth read ig cfg" on instagram_config;
drop policy if exists "auth write ig cfg" on instagram_config;
create policy "auth read ig cfg" on instagram_config for select using (auth.role() = 'authenticated');
create policy "auth write ig cfg" on instagram_config for all using (auth.role() = 'authenticated');
drop trigger if exists trg_ig_cfg_updated on instagram_config;
create trigger trg_ig_cfg_updated before update on instagram_config
  for each row execute function set_updated_at();

-- 3. Métricas mês a mês
create table if not exists instagram_metricas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  periodo text not null,                    -- "YYYY-MM"
  posts_publicados int,
  alcance_medio int,
  seguidores int,
  seguidores_variacao int,
  engajamento_medio numeric,
  fonte_dado text default 'api_instagram',
  sincronizado_em timestamptz,
  updated_at timestamptz default now(),
  unique (cliente_id, periodo)
);
create index if not exists idx_ig_metricas_cliente on instagram_metricas (cliente_id);
alter table instagram_metricas enable row level security;
drop policy if exists "auth read ig met" on instagram_metricas;
drop policy if exists "auth write ig met" on instagram_metricas;
create policy "auth read ig met" on instagram_metricas for select using (auth.role() = 'authenticated');
create policy "auth write ig met" on instagram_metricas for all using (auth.role() = 'authenticated');
drop trigger if exists trg_ig_met_updated on instagram_metricas;
create trigger trg_ig_met_updated before update on instagram_metricas
  for each row execute function set_updated_at();
