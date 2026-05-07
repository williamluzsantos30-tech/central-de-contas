-- =========================================================
-- RESET de dados — Opção B (TOTAL / DO ZERO)
-- =========================================================
-- Apaga TUDO de dados operacionais + equipe + squads + templates.
-- MANTÉM apenas:
--   - auth.users (logins do Supabase Auth — quem você convidou
--     continua podendo logar; só não vai ter profile vinculado
--     até cadastrar de novo em Admin → Equipe)
--
-- ⚠️ USE SÓ SE QUER COMEÇAR DO ZERO COMPLETAMENTE.
-- ⚠️ Você vai precisar recadastrar:
--      • todos os profiles (Admin → Equipe → Novo membro)
--      • todos os squads (Admin → Squads)
--      • todos os templates de tarefa
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- =========================================================

begin;

-- 1) Dados operacionais (mesma ordem da Opção A)
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

-- 2) Estrutura organizacional
delete from task_templates;

-- squad_membros se existir como tabela separada (ignore erro se não existir)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'squad_membros') then
    execute 'delete from squad_membros';
  end if;
end$$;

delete from squads;

-- 3) Equipe (profiles) — exceto o admin que você está usando agora
-- ⚠️ Troque o email abaixo pelo SEU email de admin pra não se trancar fora!
delete from profiles
where email <> 'admin@movmed.com.br';   -- 👈 AJUSTE AQUI antes de rodar

commit;

-- Confirma
select 'profiles restantes' as info, count(*) as total from profiles
union all select 'squads', count(*) from squads
union all select 'task_templates', count(*) from task_templates
union all select 'clientes', count(*) from clientes
union all select 'tarefas', count(*) from tarefas
union all select 'criacoes', count(*) from criacoes;
