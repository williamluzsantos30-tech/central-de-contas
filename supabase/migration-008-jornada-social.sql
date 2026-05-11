-- =========================================================
-- Migration 008 — Jornada separada para Social Media
-- =========================================================
-- O cliente que está em Tráfego segue jornadas: onboarding,
-- otimizacao, expansao, retencao. Mas em Social Media o playbook
-- prevê um fluxo diferente: o cliente está em ONBOARDING (perfil
-- sendo otimizado, primeiro planejamento sendo feito) ou já está
-- POSTANDO (operação em ritmo).
--
-- Em vez de poluir a coluna `jornada` (usada por Tráfego), criamos
-- uma coluna `jornada_social` específica.
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- =========================================================

alter table clientes
  add column if not exists jornada_social text;

-- Default: clientes que já têm o módulo 'social_media' começam
-- como 'onboarding' (estado inicial seguro).
update clientes
   set jornada_social = 'onboarding'
 where jornada_social is null
   and modulos @> array['social_media'];

-- Validação: aceita só os 2 valores definidos pelo playbook.
alter table clientes
  drop constraint if exists clientes_jornada_social_check;

alter table clientes
  add constraint clientes_jornada_social_check
  check (jornada_social is null or jornada_social in ('onboarding', 'postando'));

-- Confirmação
select
  jornada_social,
  count(*) as registros
from clientes
where modulos @> array['social_media']
group by 1
order by 1;
