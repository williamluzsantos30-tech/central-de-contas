-- =========================================================
-- Migration 009 — Setup do Perfil de Social Media
-- =========================================================
-- O playbook (3.0) define como OBRIGATÓRIO um checklist de 4 itens
-- antes E durante a operação:
--   1. Foto de perfil
--   2. Bio estratégica
--   3. Destaques
--   4. Endereço e informações de contato
--
-- Esta tabela armazena o status, evidência e observações de cada
-- item por cliente. Uma linha por cliente.
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- (Idempotente.)
-- =========================================================

-- Status possível em cada item do checklist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'perfil_item_status') then
    create type perfil_item_status as enum ('pendente', 'em_revisao', 'ok');
  end if;
end$$;

create table if not exists cliente_perfil_setup (
  cliente_id    uuid primary key references clientes(id) on delete cascade,

  -- 1. Foto de perfil
  foto_status   perfil_item_status not null default 'pendente',
  foto_url      text,
  foto_obs      text,

  -- 2. Bio estratégica
  bio_status    perfil_item_status not null default 'pendente',
  bio_texto     text,
  bio_obs       text,

  -- 3. Destaques (capas + organização)
  destaques_status perfil_item_status not null default 'pendente',
  destaques_obs    text,

  -- 4. Contato (endereço, WhatsApp, e-mail, padronização)
  contato_status perfil_item_status not null default 'pendente',
  contato_obs    text,

  ultima_revisao_em timestamptz,
  ultima_revisao_por uuid references profiles(id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Trigger pra atualizar updated_at
drop trigger if exists trg_cliente_perfil_setup_updated on cliente_perfil_setup;
create trigger trg_cliente_perfil_setup_updated
  before update on cliente_perfil_setup
  for each row execute function set_updated_at();

-- RLS
alter table cliente_perfil_setup enable row level security;

drop policy if exists "auth read perfil_setup" on cliente_perfil_setup;
drop policy if exists "auth write perfil_setup" on cliente_perfil_setup;

create policy "auth read perfil_setup"
  on cliente_perfil_setup for select
  using (auth.role() = 'authenticated');

create policy "auth write perfil_setup"
  on cliente_perfil_setup for all
  using (auth.role() = 'authenticated');

-- Cria a linha automaticamente quando um cliente novo é cadastrado
-- com o módulo social_media
create or replace function public.ensure_perfil_setup_row()
returns trigger as $$
begin
  if new.modulos @> array['social_media'] then
    insert into cliente_perfil_setup (cliente_id)
    values (new.id)
    on conflict (cliente_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ensure_perfil_setup on clientes;
create trigger trg_ensure_perfil_setup
  after insert or update of modulos on clientes
  for each row execute function public.ensure_perfil_setup_row();

-- Backfill: cria linha pra clientes SM já existentes
insert into cliente_perfil_setup (cliente_id)
select id from clientes
where modulos @> array['social_media']
on conflict (cliente_id) do nothing;

-- Confirmação
select
  count(*) as total_setups,
  count(*) filter (where foto_status = 'ok' and bio_status = 'ok' and destaques_status = 'ok' and contato_status = 'ok') as completos,
  count(*) filter (where foto_status = 'pendente' or bio_status = 'pendente' or destaques_status = 'pendente' or contato_status = 'pendente') as pendentes
from cliente_perfil_setup;
