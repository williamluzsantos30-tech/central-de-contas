-- =========================================================
-- Migration 038 — Drop versões antigas de intake_lead_from_sheets
-- =========================================================
-- Problema: cada migration anterior (025, 026, 035, 036) tentou usar
-- CREATE OR REPLACE FUNCTION, mas como adicionou args novos, o
-- Postgres criou funções SEPARADAS em vez de substituir. Resultado:
-- 3 versões coexistindo:
--
--   • intake_lead_from_sheets(text, text, text, text, text, numeric,
--     timestamptz, text)                                 — 8 args (025/026)
--   • intake_lead_from_sheets(text, text, text, text, text, numeric,
--     timestamptz, text, text)                           — 9 args (035, +p_fonte)
--   • intake_lead_from_sheets(text, text, text, text, text, numeric,
--     timestamptz, text, text, text)                     — 10 args (036, +p_external_ref)
--
-- Quando a Edge Function (ou n8n direto) chama com todos os args
-- nomeados, Postgres tenta encaixar e dá:
--   "Could not choose the best candidate function between..."
--
-- Solução: dropar as versões antigas explicitamente. Manter só a
-- de 10 args (versão atual, com todos os campos).
--
-- Idempotente.
-- =========================================================

-- Drop versão de 8 args (original — 025/026)
drop function if exists intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text
);

-- Drop versão de 9 args (035 — sem p_external_ref)
drop function if exists intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text, text
);

-- Confirmação: lista todas as funções com esse nome no schema public
-- Deve sobrar SO 1 — a de 10 args
select
  proname as funcao,
  pg_get_function_identity_arguments(oid) as assinatura
from pg_proc
where proname = 'intake_lead_from_sheets'
  and pronamespace = 'public'::regnamespace;
