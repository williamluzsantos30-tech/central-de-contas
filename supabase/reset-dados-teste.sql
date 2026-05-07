-- =========================================================
-- RESET de dados de teste — Opção A (SUAVE)
-- =========================================================
-- Apaga clientes, tarefas, criações, projetos, social media etc.
-- MANTÉM:
--   - profiles (sua equipe e admin continuam)
--   - squads (squads criados)
--   - task_templates (templates de tarefas)
--   - auth.users (logins continuam funcionando)
--
-- COMO RODAR:
-- 1. Abra Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Clique em "Run"
-- 4. Vai aparecer "Success" depois de ~1-2 segundos
--
-- ⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL. Os dados apagados não
-- voltam. Faça backup antes se houver coisa que queira preservar.
-- =========================================================

begin;

-- Tabelas filhas primeiro (pra não quebrar foreign keys)
delete from producoes_social_media_items;
delete from producoes_social_media;

delete from criativos_webdesign;
delete from projetos_webdesign;

delete from criacoes;

delete from logins_acessos;
delete from otimizacoes;
delete from ativos;
delete from leads;
delete from metas;

delete from tarefa_comentarios;
delete from tarefas;

delete from clientes;

commit;

-- Confirma que zerou
select
  'clientes' as tabela, count(*) as registros from clientes
union all select 'tarefas', count(*) from tarefas
union all select 'criacoes', count(*) from criacoes
union all select 'projetos_webdesign', count(*) from projetos_webdesign
union all select 'criativos_webdesign', count(*) from criativos_webdesign
union all select 'producoes_social_media', count(*) from producoes_social_media
union all select 'logins_acessos', count(*) from logins_acessos
union all select 'metas', count(*) from metas
union all select 'leads', count(*) from leads
union all select 'otimizacoes', count(*) from otimizacoes
union all select 'ativos', count(*) from ativos
-- (estes ficam preservados:)
union all select '✅ profiles (preservados)', count(*) from profiles
union all select '✅ squads (preservados)', count(*) from squads
union all select '✅ task_templates (preservados)', count(*) from task_templates;
