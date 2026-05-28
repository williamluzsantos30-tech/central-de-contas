-- =============================================================
-- Migration 043 — Controle do Head de Tráfego (Fase 2A: base)
-- =============================================================
-- Adiciona infraestrutura pro painel /trafego/controle-head:
--   1. Coluna status_saude_geral + status_geral_desde em clientes (cache)
--   2. Tabela cliente_saude_plataforma (saúde + métricas por plataforma)
--   3. Tabela verificacoes_conta (problema + plano de ação registrados pelo head)
--   4. Trigger que recalcula o status_saude_geral do cliente automaticamente
--      como o PIOR status entre as plataformas, e zera status_geral_desde
--      quando o status muda
--   5. RLS: SELECT pra qualquer autenticado; WRITE só pra head/diretoria/admin
--
-- Próxima fase (2B): modal de editar métricas no front
-- Próxima fase (2C): tabelas de destinatários + notificações pra email
-- =============================================================
begin;

-- ----------------------------------------------------------------
-- 1. Colunas no clientes (cache do worst-case + timer de escalonamento)
-- ----------------------------------------------------------------
alter table clientes
  add column if not exists status_saude_geral text default 'estavel';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_status_saude_geral_chk'
  ) then
    alter table clientes
      add constraint clientes_status_saude_geral_chk
      check (status_saude_geral in ('estavel','instavel','critico'));
  end if;
end$$;

alter table clientes
  add column if not exists status_geral_desde timestamptz default now();

-- Inicializa pra clientes existentes (caso a coluna já existisse com null)
update clientes set status_saude_geral = 'estavel' where status_saude_geral is null;
update clientes set status_geral_desde = now() where status_geral_desde is null;

-- ----------------------------------------------------------------
-- 2. Saúde por plataforma (cliente × plataforma com métricas)
-- ----------------------------------------------------------------
create table if not exists cliente_saude_plataforma (
  cliente_id uuid not null references clientes(id) on delete cascade,
  plataforma text not null,
  status_saude text not null default 'estavel',
  leads_30d integer not null default 0,
  cpl numeric(10,2) not null default 0,
  verba_gasta numeric(12,2) not null default 0,
  verba_orcamento numeric(12,2) not null default 0,
  tendencia_pct integer not null default 0,
  observacao text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null,
  primary key (cliente_id, plataforma),
  constraint csp_plataforma_chk check (
    plataforma in ('meta_ads','google_ads','tiktok_ads','youtube_ads')
  ),
  constraint csp_status_chk check (
    status_saude in ('estavel','instavel','critico')
  )
);

create index if not exists idx_csp_status on cliente_saude_plataforma(status_saude);
create index if not exists idx_csp_cliente on cliente_saude_plataforma(cliente_id);

-- ----------------------------------------------------------------
-- 3. Verificações registradas pelo head (problema + plano de ação)
-- ----------------------------------------------------------------
create table if not exists verificacoes_conta (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  plataforma text not null,
  autor_id uuid not null references profiles(id) on delete restrict,
  problema text not null,
  plano_acao text not null,
  status_plano text not null default 'aberto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verif_plataforma_chk check (
    plataforma in ('meta_ads','google_ads','tiktok_ads','youtube_ads')
  ),
  constraint verif_status_plano_chk check (
    status_plano in ('aberto','em_andamento','concluido')
  )
);

create index if not exists idx_verif_cliente_data
  on verificacoes_conta(cliente_id, created_at desc);
create index if not exists idx_verif_status_plano
  on verificacoes_conta(status_plano)
  where status_plano <> 'concluido';

-- Trigger pra manter updated_at em sync
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_csp_updated_at on cliente_saude_plataforma;
create trigger trg_csp_updated_at
  before update on cliente_saude_plataforma
  for each row execute function set_updated_at();

drop trigger if exists trg_verif_updated_at on verificacoes_conta;
create trigger trg_verif_updated_at
  before update on verificacoes_conta
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- 4. Trigger que recalcula status_saude_geral (pior das plataformas)
--    e reseta status_geral_desde quando o status_geral muda
-- ----------------------------------------------------------------
create or replace function recalcular_status_geral_cliente()
returns trigger language plpgsql as $$
declare
  v_cliente_id uuid := coalesce(new.cliente_id, old.cliente_id);
  v_pior text;
  v_atual text;
begin
  -- Pior status entre todas as plataformas do cliente
  select case
    when bool_or(status_saude = 'critico') then 'critico'
    when bool_or(status_saude = 'instavel') then 'instavel'
    else 'estavel'
  end into v_pior
  from cliente_saude_plataforma
  where cliente_id = v_cliente_id;

  -- Se o cliente não tem mais nenhuma plataforma (delete) → volta pra estável
  if v_pior is null then
    v_pior := 'estavel';
  end if;

  -- Status_geral atual do cliente
  select status_saude_geral into v_atual from clientes where id = v_cliente_id;

  -- Se mudou, atualiza ambos (status + timer); senão só status
  if v_atual is null or v_atual <> v_pior then
    update clientes
       set status_saude_geral = v_pior,
           status_geral_desde = now()
     where id = v_cliente_id;
  end if;

  return null;
end$$;

drop trigger if exists trg_recalcular_status_geral on cliente_saude_plataforma;
create trigger trg_recalcular_status_geral
  after insert or update of status_saude or delete on cliente_saude_plataforma
  for each row execute function recalcular_status_geral_cliente();

-- ----------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------
alter table cliente_saude_plataforma enable row level security;
alter table verificacoes_conta enable row level security;

-- Helper: usuário tem cargo de head, diretoria ou é admin?
create or replace function eh_head_ou_diretoria()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.aprovado
      and p.ativo
      and (
        p.role::text = 'admin'
        or p.cargo::text in ('head','diretoria')
        -- cargos_extras é text[]: compara com array de text (sem cast pra enum)
        or p.cargos_extras && array['head','diretoria']
      )
  );
$$;

-- cliente_saude_plataforma: leitura aberta, escrita só head/diretoria/admin
drop policy if exists csp_select on cliente_saude_plataforma;
create policy csp_select on cliente_saude_plataforma
  for select to authenticated using (true);

drop policy if exists csp_insert on cliente_saude_plataforma;
create policy csp_insert on cliente_saude_plataforma
  for insert to authenticated with check (eh_head_ou_diretoria());

drop policy if exists csp_update on cliente_saude_plataforma;
create policy csp_update on cliente_saude_plataforma
  for update to authenticated
  using (eh_head_ou_diretoria())
  with check (eh_head_ou_diretoria());

drop policy if exists csp_delete on cliente_saude_plataforma;
create policy csp_delete on cliente_saude_plataforma
  for delete to authenticated using (eh_head_ou_diretoria());

-- verificacoes_conta: leitura aberta, escrita só head/diretoria/admin
drop policy if exists verif_select on verificacoes_conta;
create policy verif_select on verificacoes_conta
  for select to authenticated using (true);

drop policy if exists verif_insert on verificacoes_conta;
create policy verif_insert on verificacoes_conta
  for insert to authenticated with check (eh_head_ou_diretoria());

drop policy if exists verif_update on verificacoes_conta;
create policy verif_update on verificacoes_conta
  for update to authenticated
  using (eh_head_ou_diretoria())
  with check (eh_head_ou_diretoria());

drop policy if exists verif_delete on verificacoes_conta;
create policy verif_delete on verificacoes_conta
  for delete to authenticated using (eh_head_ou_diretoria());

commit;

-- =============================================================
-- Como rodar:
--   1. Cole o arquivo no SQL Editor do Supabase
--   2. Run
--   3. Confere se as tabelas existem em Table Editor:
--      - cliente_saude_plataforma
--      - verificacoes_conta
--      - clientes (com status_saude_geral e status_geral_desde)
-- =============================================================
