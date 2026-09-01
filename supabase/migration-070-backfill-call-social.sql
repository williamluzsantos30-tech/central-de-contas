-- =========================================================
-- Migration 070 — Backfill inicial das calls social a partir da trafego
-- =========================================================
-- A migration 069 criou as colunas independentes `proxima_call_social` /
-- `ultima_call_social`, mas iniciou tudo NULL. Isso fez a lista
-- /social/clientes mostrar "sem agenda" pra todos os clientes que
-- na verdade JA tinham data marcada (na coluna de trafego).
--
-- Esta migration faz o seed: copia proxima_call_alinhamento ->
-- proxima_call_social e ultima_call_alinhamento -> ultima_call_social,
-- SO PRA CLIENTES onde a coluna social esta null (nao sobrescreve
-- quem ja tiver data social propria).
--
-- Depois desse backfill, os dois times ficam com a mesma data inicial;
-- a partir dai cada um pode ir remarcando independente.
--
-- Idempotente — rodar mais de uma vez nao dobra nada (WHERE null limita).
-- =========================================================
begin;

update clientes
   set proxima_call_social = proxima_call_alinhamento
 where proxima_call_social is null
   and proxima_call_alinhamento is not null;

update clientes
   set ultima_call_social = ultima_call_alinhamento
 where ultima_call_social is null
   and ultima_call_alinhamento is not null;

-- Confirmacao — mostra quantos ganharam data via backfill
select
  count(*) filter (where proxima_call_social is not null) as com_proxima_social,
  count(*) filter (where ultima_call_social is not null) as com_ultima_social,
  count(*) as total_clientes
from clientes;

commit;
