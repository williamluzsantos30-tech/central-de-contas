-- =========================================================
-- Migration 064 — Rastreio de origem das metricas social
-- =========================================================
-- Adiciona 2 campos em cliente_metricas_social pra saber se cada
-- registro veio da integracao com Meta ou foi preenchido a mao:
--
--   sync_source        text  — 'manual' (default) | 'meta_api'
--   sincronizado_em    timestamptz — ultima sync bem sucedida
--
-- Usos:
--   1. UI mostra "⟳ Sincronizado ha X" ou "✎ Preenchido manualmente"
--   2. Sync do Meta so sobrescreve registros source=manual se o user
--      pedir explicitamente ("re-sincronizar este mes") — respeita
--      overrides manuais.
--   3. Auditoria: saber quando foi a ultima vez que dados vieram da API.
--
-- Idempotente.
-- =========================================================
begin;

alter table cliente_metricas_social
  add column if not exists sync_source     text not null default 'manual',
  add column if not exists sincronizado_em timestamptz;

comment on column cliente_metricas_social.sync_source is
  'Origem dos dados: manual (preenchido pela pessoa) ou meta_api (buscado da Meta Graph API automaticamente).';

comment on column cliente_metricas_social.sincronizado_em is
  'Timestamp da ultima sincronizacao bem-sucedida com Meta API. Null pra registros preenchidos manualmente.';

-- idempotente: permite rodar de novo sem "constraint already exists"
alter table cliente_metricas_social
  drop constraint if exists sync_source_valido;
alter table cliente_metricas_social
  add constraint sync_source_valido
    check (sync_source in ('manual', 'meta_api'));

commit;
