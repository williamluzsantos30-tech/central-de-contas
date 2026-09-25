-- =========================================================
-- Migration 094: jornada do cliente aceita 'escala' e 'churn'
-- =========================================================
-- A coluna clientes.jornada é do tipo ENUM jornada_cliente (schema.sql),
-- com os valores antigos: onboarding | otimizacao | expansao | retencao.
-- O domus passou a usar onboarding | otimizacao | escala | churn (082), mas
-- o enum nunca ganhou os valores novos — então escolher "Escala" ou "Churn"
-- na Ficha era recusado pelo banco (22P02 invalid input value for enum).
-- (A 082 dizia que jornada era texto livre; não é.)
--
-- ⚠ RODE ANTES DA 082: ela converte expansao/retencao → escala, e o valor
-- novo só pode ser usado depois que ESTA migration for commitada.
--
-- Os valores antigos (expansao/retencao) continuam no enum — Postgres não
-- remove valor de enum sem recriar o tipo, e não há necessidade.
--
-- Idempotente (IF NOT EXISTS). COMO RODAR: SQL Editor do projeto do DOMUS.
-- =========================================================

begin;
alter type jornada_cliente add value if not exists 'escala';
alter type jornada_cliente add value if not exists 'churn';
commit;
