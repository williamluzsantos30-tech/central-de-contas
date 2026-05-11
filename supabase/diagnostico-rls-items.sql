-- =========================================================
-- Diagnóstico RLS — por que o app não vê os 28 items?
-- =========================================================
-- O SQL Editor roda como postgres (bypassa RLS), por isso
-- vê tudo. Mas o app usa role `authenticated` e está vendo 0.
-- Provável que a policy SELECT esteja faltando/quebrada.
-- =========================================================

-- 1) RLS está ativo na tabela?
select schemaname, tablename, rowsecurity
from pg_tables
where tablename = 'producoes_social_media_items';

-- 2) Quais policies existem nessa tabela?
select polname, polpermissive, polroles, polcmd, polqual::text, polwithcheck::text
from pg_policy
where polrelid = 'producoes_social_media_items'::regclass;

-- 3) Mesmo pra tabela "producoes_social_media" (de comparação — essa funciona)
select polname, polcmd, polqual::text
from pg_policy
where polrelid = 'producoes_social_media'::regclass;
