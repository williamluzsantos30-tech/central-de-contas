-- =========================================================
-- Migration 087: metas de squad no banco
-- =========================================================
-- A tabela squads (migration 002) só tinha nome/descricao/lider/ativo. As
-- metas de squad viviam em mock (mockSettings.ts). Esta migration dá casa no
-- banco pras metas, pra a tabela de Squads em Configurações virar a fonte
-- única (criar/editar squad + metas propaga pra todo o sistema).
--
-- clientes/MRR e o "atual" de churn/NRR NÃO viram coluna — continuam
-- calculados em tempo real a partir dos clientes vinculados (cliente.squad).
-- Aqui ficam só os alvos (metas) e os "atuais" que são entrada manual
-- (indicações e nova receita manual).
--
-- COMO RODAR: Supabase → SQL Editor → cole e Run.
-- =========================================================

alter table squads add column if not exists meta_indicacoes integer not null default 0;
alter table squads add column if not exists meta_nova_receita numeric(12,2) not null default 0;
alter table squads add column if not exists meta_nrr numeric(5,2) not null default 95;
alter table squads add column if not exists meta_logo_churn integer not null default 0;
alter table squads add column if not exists meta_rev_churn numeric(12,2) not null default 0;

-- "Atuais" que são entrada manual (o resto é calculado dos clientes)
alter table squads add column if not exists atual_indicacoes integer not null default 0;
alter table squads add column if not exists atual_nova_receita numeric(12,2) not null default 0;
alter table squads add column if not exists atual_nova_receita_desc text;

-- =========================================================
-- ROLLBACK:
-- alter table squads
--   drop column if exists meta_indicacoes,
--   drop column if exists meta_nova_receita,
--   drop column if exists meta_nrr,
--   drop column if exists meta_logo_churn,
--   drop column if exists meta_rev_churn,
--   drop column if exists atual_indicacoes,
--   drop column if exists atual_nova_receita,
--   drop column if exists atual_nova_receita_desc;
-- =========================================================
