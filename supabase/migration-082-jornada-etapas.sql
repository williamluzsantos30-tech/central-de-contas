-- Migration 082 — Jornada do cliente: etapas onboarding/otimizacao/escala/churn
--
-- A jornada de Trafego (coluna `clientes.jornada`, texto livre) passa a ter
-- apenas 4 etapas oficiais:
--   onboarding -> otimizacao -> escala -> churn
--
-- Antes existiam 'expansao' e 'retencao'. Remapeamos os dados existentes:
--   expansao  -> escala   (escalar o que funciona)
--   retencao  -> escala   (sustentacao vira parte da fase de escala)
--
-- ⚠ CORREÇÃO (25/09): `jornada` é o ENUM jornada_cliente, que não tinha
-- 'escala' — rode a migration 094 ANTES desta (ela adiciona escala/churn).
-- Idempotente.

begin;
update clientes
   set jornada = 'escala'
 where jornada in ('expansao', 'retencao');
commit;

-- Relatorio pos-migration
select jornada, count(*)
  from clientes
 group by jornada
 order by count(*) desc;
