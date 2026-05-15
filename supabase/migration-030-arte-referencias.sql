-- =========================================================
-- Migration 030 — Referências por arte do planejamento mensal
-- =========================================================
-- Cada item (arte) do planejamento ganha um campo de referências:
-- lista de links com tipo + descrição. Mesma estrutura usada em
-- edicoes_video.referencias.
--
-- Esquema:
-- [
--   { "tipo": "drive" | "youtube" | "vimeo" | "link",
--     "url": "https://...",
--     "descricao": "Pasta brutos" (opcional) }
-- ]
--
-- Idempotente.
-- =========================================================

alter table producoes_social_media_items
  add column if not exists referencias jsonb not null default '[]'::jsonb;

comment on column producoes_social_media_items.referencias is
  'Lista de referências por arte: [{tipo, url, descricao}]. Mesma estrutura que edicoes_video.referencias.';

-- Confirmação
select count(*) filter (where jsonb_array_length(referencias) > 0) as com_referencias,
       count(*) as total_items
from producoes_social_media_items;
