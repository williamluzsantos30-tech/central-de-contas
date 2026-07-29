-- =========================================================
-- Migration 059 — Descricao da alteracao em items de social media
-- =========================================================
-- Quando o cliente pede uma alteracao numa arte, o designer precisa
-- saber EXATAMENTE o que mudar. Ate agora isso ficava enterrado em
-- observacoes (campo geral) ou pior, so no WhatsApp/chat.
--
-- Nova coluna `descricao_alteracao` em producoes_social_media_items
-- (opcional, mas destacada na UI quando status='alteracao').
--
-- Fluxo no front:
--   - User muda status pra "Alteracao"
--   - Item auto-expande + campo "Descricao da alteracao" abre em
--     destaque (borda vermelha), auto-focus
--   - Se ficar vazio, um ⚠ aparece na linha do item (visivel colapsado)
--   - Ao voltar de "alteracao" pra outro status, a descricao NAO e' apagada
--     (fica de historico caso precise reabrir)
--
-- Idempotente.
-- =========================================================
begin;

alter table producoes_social_media_items
  add column if not exists descricao_alteracao text;

comment on column producoes_social_media_items.descricao_alteracao is
  'O que o cliente pediu pra mudar quando o item esta em status=alteracao. Preenchido pela pessoa que muda o status. Fica de historico mesmo depois que sai de alteracao.';

commit;
