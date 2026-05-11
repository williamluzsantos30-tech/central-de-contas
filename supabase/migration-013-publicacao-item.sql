-- =========================================================
-- Migration 013 — Marcar item como publicado (executado)
-- =========================================================
-- O playbook (3.3 e KPI #1) cobra "% de posts publicados no prazo".
-- Pra isso a Social Media precisa marcar quando um post foi de
-- fato pro ar. Adiciona em `producoes_social_media_items`:
--
--   • publicado_url : link da publicação no Instagram (evidência)
--   • publicado_em  : timestamp de quando foi marcado como publicado
--   • publicado_por : quem da equipe marcou
--
-- O status `conclusao` continua sendo a fonte de verdade pra
-- "está publicado". Esses campos enriquecem com evidência e auditoria.
-- =========================================================

alter table producoes_social_media_items
  add column if not exists publicado_url   text,
  add column if not exists publicado_em    timestamptz,
  add column if not exists publicado_por   uuid references profiles(id) on delete set null;

-- Confirmação
select
  count(*) filter (where status = 'conclusao') as marcados_concluidos,
  count(*) filter (where publicado_em is not null) as com_data_publicacao,
  count(*) filter (where publicado_url is not null) as com_url_evidencia
from producoes_social_media_items;
