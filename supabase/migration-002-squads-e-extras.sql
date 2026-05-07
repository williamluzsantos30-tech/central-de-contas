-- =========================================================
-- Migration 002: tabela squads + colunas adicionadas após o schema inicial
-- =========================================================
-- Roda essa migration DEPOIS da 001 (a de profiles independente).
--
-- COMO RODAR:
-- 1. Abra o painel do Supabase do seu projeto
-- 2. Vá em SQL Editor → New query
-- 3. Cole tudo abaixo e clique em "Run"
-- =========================================================

-- 1. Tipo Cargo (caso ainda não exista)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cargo') then
    create type cargo as enum (
      'gestor_trafego',
      'account_manager',
      'designer',
      'social_media',
      'diretoria',
      'head'
    );
  end if;
end$$;

-- 2. Adiciona colunas no profiles (se não existirem)
alter table profiles add column if not exists cargo cargo;
alter table profiles add column if not exists aprovado boolean default false;
alter table profiles add column if not exists squad_id uuid;

-- 3. Cria tabela squads
create table if not exists squads (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  lider_id uuid references profiles(id) on delete set null,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. FK de profiles.squad_id → squads.id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_squad_fk'
  ) then
    alter table profiles add constraint profiles_squad_fk
      foreign key (squad_id) references squads(id) on delete set null;
  end if;
end$$;

-- 5. Adiciona verba_google e verba_meta no clientes (se não existirem)
alter table clientes add column if not exists verba_google numeric(12,2);
alter table clientes add column if not exists verba_meta numeric(12,2);

-- 6. Adiciona prompt e anexos no criacoes (se não existirem)
alter table criacoes add column if not exists prompt text;
alter table criacoes add column if not exists anexos jsonb;

-- 7. Cria tabela logins_acessos (caso não exista)
create table if not exists logins_acessos (
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

-- 8. RLS pra novas tabelas (Supabase precisa)
alter table squads enable row level security;
alter table logins_acessos enable row level security;

-- Policies (idempotentes — drop antes de criar)
drop policy if exists "auth read squads" on squads;
drop policy if exists "auth write squads" on squads;
create policy "auth read squads" on squads for select using (auth.role() = 'authenticated');
create policy "auth write squads" on squads for all using (auth.role() = 'authenticated');

drop policy if exists "auth read logins_acessos" on logins_acessos;
drop policy if exists "auth write logins_acessos" on logins_acessos;
create policy "auth read logins_acessos" on logins_acessos for select using (auth.role() = 'authenticated');
create policy "auth write logins_acessos" on logins_acessos for all using (auth.role() = 'authenticated');

-- 9. Triggers de updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_squads_updated on squads;
create trigger trg_squads_updated before update on squads
  for each row execute function set_updated_at();

drop trigger if exists trg_logins_acessos_updated on logins_acessos;
create trigger trg_logins_acessos_updated before update on logins_acessos
  for each row execute function set_updated_at();

-- 10. Indexes
create index if not exists idx_squads_ativo on squads(ativo);
create index if not exists idx_logins_acessos_cliente on logins_acessos(cliente_id);

-- =========================================================
-- Pronto! Após rodar:
-- - "Squads" e "Membros da Equipe" voltam a aparecer no Admin → Equipe Operacional
-- - Você consegue criar squads e ter usuários no dropdown de líder
-- - Logins/Acessos por cliente funciona
-- - Verba Google/Meta separadas, criações com prompt/anexos, etc.
-- =========================================================
