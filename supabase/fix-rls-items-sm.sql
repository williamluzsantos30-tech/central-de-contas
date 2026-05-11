-- =========================================================
-- FIX — RLS da tabela producoes_social_media_items
-- =========================================================
-- O app não consegue ler os items porque a policy SELECT
-- sumiu/quebrou. Reativamos tudo do zero.
-- 100% idempotente — pode rodar quantas vezes quiser.
-- =========================================================

-- Garante RLS ativo
alter table producoes_social_media_items enable row level security;

-- Limpa policies antigas (se houver) e recria do jeito certo
drop policy if exists "auth read producoes_sm_items" on producoes_social_media_items;
drop policy if exists "auth write producoes_sm_items" on producoes_social_media_items;

create policy "auth read producoes_sm_items"
  on producoes_social_media_items
  for select
  using (auth.role() = 'authenticated');

create policy "auth write producoes_sm_items"
  on producoes_social_media_items
  for all
  using (auth.role() = 'authenticated');

-- Confirmação: deve listar 2 policies
select polname,
  case polcmd
    when 'r' then 'SELECT' when '*' then 'ALL' else polcmd::text
  end as comando
from pg_policy
where polrelid = 'producoes_social_media_items'::regclass;
