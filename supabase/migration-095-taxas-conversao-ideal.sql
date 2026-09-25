-- =========================================================
-- Migration 095: taxas de conversão ideal entre etapas (Comercial › Metas)
-- =========================================================
-- Guarda em comercial_config (linha id='default') as taxas usadas no
-- "Ideal Recalculado" dos cards de meta:
--   { sdr: 30, noShow: 25, closer: 33,
--     overridesPorCanal: { "Meta Ads": { sdr: 25 } },
--     overridesPorResponsavel: { "sdr-1": { sdr: 35 } } }
-- Editável em Configurações › Geral › Metas Comerciais.
--
-- Sem esta coluna o app usa os defaults (30/25/33) e só não persiste a
-- edição — nada mais quebra.
--
-- Depende da 088 (comercial_config). Idempotente (IF NOT EXISTS).
-- COMO RODAR: SQL Editor do projeto do DOMUS.
-- =========================================================

alter table comercial_config add column if not exists taxas_conversao_ideal jsonb;
