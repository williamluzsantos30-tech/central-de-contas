-- =========================================================
-- Migration 080 — Contrato do cliente
-- =========================================================
-- Contrato e' informacao comercial estruturada — tipo, datas de
-- inicio/fim, responsavel pela renovacao. Alem de ficar visivel na
-- Ficha, essa data vai alimentar automaticamente o modulo Financeiro
-- (v2): quando o contrato estiver perto do fim, dispara alertas de
-- renovacao; quando estiver ativo, entra nas projeccoes de MRR do
-- proximo periodo.
--
-- Colunas em clientes:
--   contrato_tipo             text ('mensal', '3_meses', '6_meses',
--                                    '12_meses', 'anual', 'indefinido')
--   contrato_inicio           date
--   contrato_fim              date
--   contrato_status           text ('ativo', 'renovado', 'encerrado',
--                                    'pausado')
--   contrato_responsavel_id   uuid → profiles(id) — responsavel pela
--                             renovacao
--
-- Sem enum — mantem flexivel pra novos tipos entrarem sem migration
-- (mesmo padrao de servicos_contratados).
--
-- O trigger auto-log ja captura mudancas em varios campos de clientes;
-- vou adicionar as colunas de contrato a esse trigger na proxima
-- migration (nao aqui — separado pra manter contexto pequeno).
--
-- Idempotente — todos os add column IF NOT EXISTS.
-- =========================================================
begin;

alter table clientes
  add column if not exists contrato_tipo text,
  add column if not exists contrato_inicio date,
  add column if not exists contrato_fim date,
  add column if not exists contrato_status text,
  add column if not exists contrato_responsavel_id uuid references profiles(id) on delete set null;

comment on column clientes.contrato_tipo is 'Tipo do contrato: mensal | 3_meses | 6_meses | 12_meses | anual | indefinido';
comment on column clientes.contrato_inicio is 'Data de inicio do contrato atual (renovacoes atualizam esse campo)';
comment on column clientes.contrato_fim is 'Data de fim do contrato. Usado pra calcular dias restantes e alertar renovacao';
comment on column clientes.contrato_status is 'Status: ativo | renovado | encerrado | pausado';
comment on column clientes.contrato_responsavel_id is 'Profile responsavel pela renovacao do contrato — pode ser diferente do AM';

create index if not exists idx_clientes_contrato_fim
  on clientes (contrato_fim)
  where contrato_fim is not null;

commit;
