-- =========================================================
-- Migration 037 — View crm_sheets_to_poll pro n8n
-- =========================================================
-- Migracao do CRM de Apps Script pra n8n: o n8n vai fazer polling
-- a cada N minutos. Pra saber QUAIS planilhas processar, consulta
-- essa view via REST API (com service_role key).
--
-- A view devolve:
--   • cliente_id, cliente_nome
--   • crm_sheets_token (vai no header X-CRM-Token pra Edge Function)
--   • crm_sheets_url   (n8n extrai o spreadsheet_id daqui)
--
-- Filtra:
--   • Clientes ATIVOS (status='ativo' ou 'atencao'), nao arquivados
--   • Que tem crm_sheets_url preenchida (sinal de "configurado pra n8n")
--
-- Idempotente.
-- =========================================================

create or replace view crm_sheets_to_poll as
select
  c.id              as cliente_id,
  c.nome            as cliente_nome,
  c.crm_sheets_token,
  c.crm_sheets_url,
  c.modulos,
  -- Extrai o spreadsheet_id da URL (formato Google Sheets standard:
  -- https://docs.google.com/spreadsheets/d/<ID>/edit...)
  substring(c.crm_sheets_url from '/spreadsheets/d/([a-zA-Z0-9_-]+)')
                    as spreadsheet_id
from clientes c
where c.status in ('ativo', 'atencao')
  and c.arquivado_em is null
  and c.crm_sheets_url is not null
  and length(trim(c.crm_sheets_url)) > 0;

comment on view crm_sheets_to_poll is
  'Lista de planilhas pra n8n processar. Acesso via service_role key.';

-- Grant pra service_role (bypassa RLS) — n8n vai usar essa key
grant select on crm_sheets_to_poll to service_role, authenticated;

-- Confirmacao
select count(*) as planilhas_configuradas from crm_sheets_to_poll;
