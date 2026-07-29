-- =========================================================
-- Migration 060 — Descricao da alteracao em edicoes_video
-- =========================================================
-- Espelho da migration 059 (que fez o mesmo pra items de social media).
-- Quando um video vai pra status='em_alteracao', o cliente pediu
-- alguma mudanca especifica que o editor precisa saber.
--
-- Antes: essa info ficava enterrada no `briefing` (campo geral do
-- video, misturado com o contexto original) ou no `observacoes` (idem)
-- ou nao ficava em lugar nenhum e chegava so por WhatsApp/reuniao.
--
-- Agora: campo dedicado `descricao_alteracao` que:
--   - So aparece no modal quando status=em_alteracao (destacado em vermelho)
--   - Se estiver vazio E status=em_alteracao, LinhaVideo mostra ⚠ na linha
--   - Fica de historico mesmo depois que sai de em_alteracao (util pra
--     auditoria e caso volte pra alteracao)
--
-- Idempotente.
-- =========================================================
begin;

alter table edicoes_video
  add column if not exists descricao_alteracao text;

comment on column edicoes_video.descricao_alteracao is
  'O que o cliente pediu pra mudar quando o video esta em status=em_alteracao. Preenchido pela pessoa que muda o status. Fica de historico mesmo depois de sair de em_alteracao.';

commit;
