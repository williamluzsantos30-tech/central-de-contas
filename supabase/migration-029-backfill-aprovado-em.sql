-- =========================================================
-- Migration 029 — Backfill: marca planejamentos antigos como aprovados
-- =========================================================
-- A esteira /webdesign/social-media agora filtra só planejamentos
-- com aprovado_em preenchido (commit 01ab8ce). Esse comportamento
-- vale pra NOVOS planejamentos a partir de hoje — cada um precisa
-- ser explicitamente aprovado pra aparecer.
--
-- Mas os planejamentos QUE JÁ EXISTEM antes dessa mudança não devem
-- sumir. Esta migration retroativa marca todos eles como aprovados,
-- usando created_at como data de aprovação (proxy razoável).
--
-- Idempotente: roda só nos que ainda não têm aprovado_em.
-- =========================================================

update producoes_social_media
   set aprovado_em = coalesce(aprovado_em, created_at, now())
 where aprovado_em is null;

-- Confirmação
select
  count(*) filter (where aprovado_em is not null) as aprovados,
  count(*) filter (where aprovado_em is null) as nao_aprovados,
  count(*) as total
from producoes_social_media;
