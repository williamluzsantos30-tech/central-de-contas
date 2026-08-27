-- =========================================================
-- Migration 068 — programado_em em items de social media
-- =========================================================
-- Fluxo tipico de um post:
--   design -> design_finalizado -> em_aprovacao -> conclusao (arte
--   pronta e aprovada) -> PROGRAMADO (agendado no Meta Business Suite/
--   scheduler pra publicar em data futura) -> PUBLICADO (foi ao ar)
--
-- Ate agora so tinhamos publicado_em. Agora adicionamos programado_em
-- pra metrificar quantos posts sao agendados antes de irem pro ar
-- (indicador de rotina bem estabelecida vs bombeiro).
--
-- Nao mexe em status — o item continua com seu status atual (geralmente
-- conclusao quando ja tem arte pronta). programado_em fica como flag
-- paralelo indicando que ja foi agendado.
--
-- Idempotente.
-- =========================================================
begin;

alter table producoes_social_media_items
  add column if not exists programado_em timestamptz,
  add column if not exists programado_por uuid references profiles(id) on delete set null;

comment on column producoes_social_media_items.programado_em is
  'Timestamp de quando o post foi agendado no scheduler (Meta Business Suite / Buffer / etc). null = nao programado ainda. Diferente de publicado_em (que so preenche depois que o post foi ao ar).';

comment on column producoes_social_media_items.programado_por is
  'Profile que registrou o agendamento. Null = anonimo/apagado.';

commit;
