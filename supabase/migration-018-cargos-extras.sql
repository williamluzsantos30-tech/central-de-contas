-- =========================================================
-- Migration 018 — Cargos adicionais por profile
-- =========================================================
-- Problema: profiles.cargo é um valor só. Quem trabalha em mais de
-- uma frente (ex: Paloma faz social media + design) ficava preso a
-- 1 cargo e não aparecia nos dropdowns da outra função.
--
-- Solução: adicionar profiles.cargos_extras text[] (default '{}').
-- O cargo principal continua sendo profiles.cargo (não muda nada).
-- Os cargos adicionais ficam aqui e somam acesso/visibilidade.
--
-- Filtros agora consideram: cargo = X OR X = ANY(cargos_extras)
--
-- Idempotente.
-- =========================================================

alter table profiles
  add column if not exists cargos_extras text[] not null default '{}';

comment on column profiles.cargos_extras is
  'Cargos adicionais (alem do cargo principal). Ex: alguem com cargo=social_media e cargos_extras={designer} aparece nos dropdowns das duas areas.';

-- Index pra acelerar buscas tipo "quem tem cargo X" (cobrindo extras)
create index if not exists idx_profiles_cargos_extras
  on profiles using gin (cargos_extras);

-- Confirmação
select
  count(*) filter (where cargos_extras = '{}') as sem_extras,
  count(*) filter (where cargos_extras <> '{}') as com_extras,
  count(*) as total
from profiles;
