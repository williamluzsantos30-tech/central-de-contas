-- =========================================================
-- Migration 003 — separar clientes por módulo
-- =========================================================
-- Adiciona a coluna `modulos` em `clientes` pra que a mesma
-- tabela sirva tanto Tráfego quanto Social Media SEM uma lista
-- vazar pra outra.
--
-- Cada cliente passa a ter um array que diz onde ele aparece:
--   { 'trafego' }                 → só na operação de tráfego
--   { 'social_media' }            → só na operação de social media
--   { 'trafego', 'social_media' } → nas duas (cliente que contrata os dois serviços)
--
-- Clientes existentes (criados antes desta migration) ficam só
-- em 'trafego' por padrão, pois é onde foram cadastrados.
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- (Idempotente — pode rodar mais de uma vez sem problema.)
-- =========================================================

-- 1) Cria a coluna com default 'trafego' (não quebra clientes legados)
alter table clientes
  add column if not exists modulos text[] not null default array['trafego']::text[];

-- 2) Backfill: garante que clientes pré-existentes tenham pelo menos 'trafego'
update clientes
set modulos = array['trafego']::text[]
where modulos is null
   or array_length(modulos, 1) is null
   or array_length(modulos, 1) = 0;

-- 3) Index GIN pra que queries com `contains` (`@>`) sejam rápidas
create index if not exists idx_clientes_modulos on clientes using gin (modulos);

-- 4) Confirmação visual
select
  unnest(modulos) as modulo,
  count(*) as total
from clientes
group by 1
order by 1;
