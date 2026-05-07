-- =========================================================
-- DIAGNÓSTICO: por que "Jorge" não vê os clientes dele?
-- =========================================================
-- Roda este SQL no Supabase (SQL Editor) e me manda o
-- resultado das 3 queries. Em <2s a gente identifica o
-- que está acontecendo.
--
-- Antes de rodar, troque 'jorge@movmed.com' pelo e-mail
-- REAL com que o Jorge faz login.
-- =========================================================

-- 1) Existe MAIS DE UM profile com esse e-mail?
--    Se vier 2+ linhas → tem profile duplicado
--    (um criado por você no Admin, outro auto-criado quando
--    o Jorge logou pela primeira vez antes do trigger linkar).
select
  id,
  nome,
  email,
  cargo,
  ativo,
  aprovado,
  auth_user_id,
  created_at
from profiles
where lower(email) = lower('jorge@movmed.com')
order by created_at;

-- 2) Quantos clientes estão atribuídos a esse e-mail (por qualquer
--    relacionamento) e em qual coluna?
select
  c.id,
  c.nome,
  c.modulos,
  case
    when p_g.id is not null then 'gestor_trafego'
    when p_a.id is not null then 'account_manager'
    when p_s.id is not null then 'social_media'
  end as papel,
  coalesce(p_g.id, p_a.id, p_s.id) as profile_id_atribuido,
  coalesce(p_g.email, p_a.email, p_s.email) as email_atribuido
from clientes c
  left join profiles p_g on p_g.id = c.gestor_id and lower(p_g.email) = lower('jorge@movmed.com')
  left join profiles p_a on p_a.id = c.account_manager_id and lower(p_a.email) = lower('jorge@movmed.com')
  left join profiles p_s on p_s.id = c.social_media_id and lower(p_s.email) = lower('jorge@movmed.com')
where coalesce(p_g.id, p_a.id, p_s.id) is not null
order by c.nome;

-- 3) Confere se o auth.user do Jorge está LINKADO ao profile certo
select
  u.id as auth_user_id,
  u.email as auth_email,
  p.id as profile_id,
  p.nome as profile_nome,
  p.cargo,
  p.aprovado,
  p.ativo
from auth.users u
  left join profiles p on p.auth_user_id = u.id
where lower(u.email) = lower('jorge@movmed.com');

-- =========================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
--
-- Cenário A — query 1 retorna 1 linha + query 3 retorna 1 linha
--   com profile_id preenchido + query 2 retorna os clientes
--   esperados:
--   → Tudo certo no banco. O problema era SÓ a falta do
--     filtro "Apenas meus" — corrigido nesta release.
--
-- Cenário B — query 1 retorna 2+ linhas (profiles duplicados):
--   → Tem profile duplicado. Rode o cleanup abaixo (depois
--     de revisar manualmente qual dos 2 manter).
--
-- Cenário C — query 3 retorna profile_id NULL:
--   → O auth.user do Jorge NÃO está linkado a nenhum profile.
--     Rode o cleanup abaixo pra forçar o link por e-mail.
-- =========================================================


-- =========================================================
-- CLEANUP — Cenário B (profile duplicado)
-- =========================================================
-- ATENÇÃO: revise a query 1 antes. Você precisa decidir
-- qual dos 2 profiles MANTER (geralmente o que tem cargo
-- preenchido e aprovado=true). O outro será removido depois
-- de mover qualquer atribuição pra ele.
--
-- DESCOMENTE e ajuste os UUIDs antes de rodar:
--
-- begin;
--   -- Move tudo do profile DUPLICADO pro profile BOM
--   update clientes set gestor_id          = '<UUID_BOM>' where gestor_id          = '<UUID_DUPLICADO>';
--   update clientes set account_manager_id = '<UUID_BOM>' where account_manager_id = '<UUID_DUPLICADO>';
--   update clientes set social_media_id    = '<UUID_BOM>' where social_media_id    = '<UUID_DUPLICADO>';
--   update tarefas  set responsavel_id     = '<UUID_BOM>' where responsavel_id     = '<UUID_DUPLICADO>';
--   -- Garante que o profile BOM tem o auth_user_id linkado
--   update profiles
--      set auth_user_id = (select id from auth.users where lower(email) = lower('jorge@movmed.com') limit 1)
--    where id = '<UUID_BOM>';
--   -- Apaga o duplicado
--   delete from profiles where id = '<UUID_DUPLICADO>';
-- commit;


-- =========================================================
-- CLEANUP — Cenário C (auth.user sem profile linkado)
-- =========================================================
-- Liga o auth.user do Jorge ao profile com mesmo e-mail.
-- Pode rodar à vontade — só preenche se estiver vazio.
--
-- update profiles
--    set auth_user_id = u.id
--   from auth.users u
--  where lower(profiles.email) = lower(u.email)
--    and lower(profiles.email) = lower('jorge@movmed.com')
--    and profiles.auth_user_id is null;
