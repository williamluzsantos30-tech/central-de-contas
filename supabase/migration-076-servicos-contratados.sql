-- =========================================================
-- Migration 076 — Servicos Contratados por cliente
-- =========================================================
-- Ate agora "servicos contratados" era derivado de clientes.modulos
-- (trafego + social_media), mas isso mistura 2 conceitos:
--   modulos           = ROUTING operacional (quais esteiras esse
--                        cliente participa: trafego, social_media)
--   servicos_contratados = REALIDADE COMERCIAL (o que ele contratou:
--                        trafego pago, landing page, CRM, id.
--                        visual, salvia, etc)
--
-- Os dois nao sao 1:1. Um cliente pode ter contratado "Landing Page"
-- (servico) mas nao esta em nenhuma esteira operacional de landing
-- (ele so contratou pra ter o pacote). O contrario tambem existe.
--
-- Solucao: array text[] separado. Sem enum — os servicos vao mudando
-- com o tempo (novos produtos entram, outros saem), text[] deixa
-- flexivel sem migration cada vez.
--
-- Backfill: clientes com modulo 'trafego' ja tinham vendido trafego,
-- entao ganham 'trafego_pago' automatico. Idem 'social_media'.
--
-- Idempotente — add column IF NOT EXISTS + WHERE null-safe no
-- backfill.
-- =========================================================
begin;

alter table clientes
  add column if not exists servicos_contratados text[] not null default array[]::text[];

comment on column clientes.servicos_contratados is
  'Servicos comerciais contratados pelo cliente: trafego_pago, social_media, landing_page, comercial_crm, identidade_visual, salvia, etc. Separado de modulos (que e routing operacional).';

-- Backfill baseado nos modulos existentes
update clientes
   set servicos_contratados = array_append(servicos_contratados, 'trafego_pago')
 where 'trafego' = any(modulos)
   and not ('trafego_pago' = any(servicos_contratados));

update clientes
   set servicos_contratados = array_append(servicos_contratados, 'social_media')
 where 'social_media' = any(modulos)
   and not ('social_media' = any(servicos_contratados));

-- Confirma o backfill
select
  count(*) filter (where 'trafego_pago' = any(servicos_contratados)) as com_trafego,
  count(*) filter (where 'social_media' = any(servicos_contratados)) as com_social,
  count(*) as total_clientes
from clientes;

commit;
