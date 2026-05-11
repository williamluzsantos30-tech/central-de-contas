-- =========================================================
-- Migration 015 — Múltiplos uploads de Identidade Visual
-- =========================================================
-- Antes: cada projeto/criativo tinha 1 único `identidade_visual_url`
-- (text, single value).
-- Agora: passa a ter `identidade_visual_urls` (jsonb array), permitindo
-- vários arquivos (logo, paleta, manual de marca, etc.).
--
-- O campo `identidade_visual_url` antigo continua existindo pra
-- backward-compat, mas o front escreve só no array.
--
-- Aplicado em:
--   • projetos_webdesign
--   • criativos_webdesign
--   • producoes_social_media (era só "referencias", agora separa)
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run (idempotente)
-- =========================================================

-- 1) Adicionar coluna array nas 3 tabelas
alter table projetos_webdesign
  add column if not exists identidade_visual_urls jsonb not null default '[]'::jsonb;

alter table criativos_webdesign
  add column if not exists identidade_visual_urls jsonb not null default '[]'::jsonb;

alter table producoes_social_media
  add column if not exists identidade_visual_urls jsonb not null default '[]'::jsonb;

-- 2) Backfill: copia o `identidade_visual_url` antigo pro array novo
update projetos_webdesign
   set identidade_visual_urls = jsonb_build_array(identidade_visual_url)
 where identidade_visual_url is not null
   and (identidade_visual_urls is null
        or jsonb_array_length(coalesce(identidade_visual_urls, '[]'::jsonb)) = 0);

update criativos_webdesign
   set identidade_visual_urls = jsonb_build_array(identidade_visual_url)
 where identidade_visual_url is not null
   and (identidade_visual_urls is null
        or jsonb_array_length(coalesce(identidade_visual_urls, '[]'::jsonb)) = 0);

-- 3) Confirmação
select
  'projetos' as origem,
  count(*) as total,
  count(*) filter (where jsonb_array_length(coalesce(identidade_visual_urls, '[]'::jsonb)) > 0) as com_identidade
from projetos_webdesign
union all
select
  'criativos',
  count(*),
  count(*) filter (where jsonb_array_length(coalesce(identidade_visual_urls, '[]'::jsonb)) > 0)
from criativos_webdesign
union all
select
  'social_media (planejamentos)',
  count(*),
  count(*) filter (where jsonb_array_length(coalesce(identidade_visual_urls, '[]'::jsonb)) > 0)
from producoes_social_media;
