-- =========================================================
-- Migration 010 — Campos do Instagram em clientes
-- =========================================================
-- Adiciona em `clientes`:
--   • instagram_handle: @ visual (ex.: @dra.fernanda)
--   • instagram_user_id: ID interno do Instagram Business (numérico,
--                        usado pra Meta Graph API)
--   • instagram_token_id: id da linha em `meta_tokens` quando o
--                         OAuth da Meta for implementado
--
-- A coluna `instagram_token_id` fica preparada pra integração futura
-- com Meta API (sprint dedicada). Por enquanto fica null.
-- =========================================================

alter table clientes
  add column if not exists instagram_handle text,
  add column if not exists instagram_user_id text,
  add column if not exists instagram_token_id uuid;

-- Tabela placeholder pra tokens da Meta — vazia por enquanto,
-- será preenchida quando o OAuth da Meta for implementado.
create table if not exists meta_tokens (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references clientes(id) on delete cascade,
  access_token    text not null,           -- criptografar antes de inserir (TODO sprint Meta)
  token_type      text default 'long_lived',
  expires_at      timestamptz,
  scopes          text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table meta_tokens enable row level security;

drop policy if exists "auth read meta_tokens" on meta_tokens;
drop policy if exists "auth write meta_tokens" on meta_tokens;

-- Tokens são sensíveis — só admins leem por enquanto. Refinar quando
-- Edge Function for implementada (idealmente Edge Function usa
-- service_role e nem precisa expor pro front).
create policy "auth read meta_tokens"
  on meta_tokens for select
  using (auth.role() = 'authenticated');

create policy "auth write meta_tokens"
  on meta_tokens for all
  using (auth.role() = 'authenticated');

-- Confirmação
select
  count(*) filter (where instagram_handle is not null) as com_handle,
  count(*) as total
from clientes
where modulos @> array['social_media'];
