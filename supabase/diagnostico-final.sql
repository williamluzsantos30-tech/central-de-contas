-- =========================================================
-- Diagnóstico final — depois do fix RLS, os items aparecem?
-- =========================================================

-- 1) RLS está ativo + policies certas?
select
  c.relname as tabela,
  c.relrowsecurity as rls_ativo,
  (select count(*) from pg_policy where polrelid = c.oid) as qtd_policies
from pg_class c
where c.relname in ('producoes_social_media', 'producoes_social_media_items');

-- 2) Items ainda estão lá (28)?
select count(*) as total_items from producoes_social_media_items;

-- 3) Confirma que items.responsavel_id aponta pra profiles existentes
-- (se algum apontar pra profile deletado, pode quebrar o join no front)
select
  count(*) filter (where i.responsavel_id is null) as sem_responsavel,
  count(*) filter (where i.responsavel_id is not null and p.id is null) as responsavel_inexistente,
  count(*) filter (where i.responsavel_id is not null and p.id is not null) as responsavel_ok
from producoes_social_media_items i
left join profiles p on p.id = i.responsavel_id;
