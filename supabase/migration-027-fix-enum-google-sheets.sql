-- =========================================================
-- Migration 027 — Fix: adiciona 'google_sheets' ao enum origem_lead
-- =========================================================
-- A migration 025 tentou alterar um CHECK constraint que não existia
-- (a coluna leads.origem é um enum, não text livre). Resultado: a RPC
-- intake_lead_from_sheets falha com erro 22P02 ao tentar inserir
-- com origem='google_sheets'.
--
-- Esta migration adiciona o valor ao enum.
--
-- Idempotente (ADD VALUE IF NOT EXISTS).
-- =========================================================

alter type origem_lead add value if not exists 'google_sheets';

-- Confirmação
select unnest(enum_range(null::origem_lead)) as origens_validas;
