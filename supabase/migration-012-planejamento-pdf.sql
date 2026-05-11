-- =========================================================
-- Migration 012 — Estrutura para gerar PDF do Planejamento Mensal
-- =========================================================
-- Adiciona em `producoes_social_media`:
--   • texto_introducao   : texto da "página 2" do PDF (filosofia
--                           do mês, funil, cadência conceitual)
--   • cadencia           : descrição da frequência ("3 posts/semana —
--                           Seg/Qua/Sex")
--   • data_envio_aprovacao: data prevista pra enviar PDF no grupo
--   • aprovado_em        : timestamptz de quando o cliente aprovou
--
-- Adiciona em `producoes_social_media_items`:
--   • ideia_conteudo     : descrição do conteúdo (2ª coluna "IDEIA"
--                           do PDF). O `titulo` já existente é a HEADLINE
--                           (1ª coluna).
-- =========================================================

alter table producoes_social_media
  add column if not exists texto_introducao    text,
  add column if not exists cadencia            text,
  add column if not exists data_envio_aprovacao date,
  add column if not exists aprovado_em         timestamptz;

alter table producoes_social_media_items
  add column if not exists ideia_conteudo      text;

-- Confirmação
select
  count(*) as total_planos,
  count(*) filter (where texto_introducao is not null) as com_intro,
  count(*) filter (where cadencia is not null) as com_cadencia,
  count(*) filter (where data_envio_aprovacao is not null) as com_data_envio,
  count(*) filter (where aprovado_em is not null) as aprovados
from producoes_social_media;
