-- =============================================================
-- Migration 047 — Persiste o ID do evento no Google Calendar
-- =============================================================
-- Guarda o gcal_event_id (retornado pelo n8n após criar o evento)
-- pra permitir que futuros marcar-realizada / editar-data ATUALIZEM
-- o evento existente em vez de criar duplicatas.
-- =============================================================
begin;

alter table clientes
  add column if not exists gcal_event_id text;

commit;
