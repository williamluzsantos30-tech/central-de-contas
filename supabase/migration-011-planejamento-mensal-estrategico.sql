-- =========================================================
-- Migration 011 — Camada estratégica do Planejamento Mensal
-- =========================================================
-- O playbook (3.2, 3.4, 3.5) define que o planejamento mensal
-- não é só lista de posts: tem tema, pilares, e identificação
-- de conteúdos com potencial de virar anúncio.
--
-- Adiciona em `producoes_social_media`:
--   • tema_mes        : tema central do mês (ex.: "Lançamento Bariátrica")
--   • pilares         : array de pilares de conteúdo (ex.: ["educacional", "transformação", "oferta"])
--   • ganchos_para_ads: texto com posts que podem virar criativos pagos
--   • campanha_ativa_url: link da campanha de tráfego que esse mês alimenta
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- (Idempotente.)
-- =========================================================

alter table producoes_social_media
  add column if not exists tema_mes          text,
  add column if not exists pilares           jsonb default '[]'::jsonb,
  add column if not exists ganchos_para_ads  text,
  add column if not exists campanha_ativa_url text;

-- Confirmação
select
  count(*) as total,
  count(*) filter (where tema_mes is not null) as com_tema,
  count(*) filter (where jsonb_array_length(coalesce(pilares, '[]'::jsonb)) > 0) as com_pilares,
  count(*) filter (where ganchos_para_ads is not null) as com_ganchos
from producoes_social_media;
