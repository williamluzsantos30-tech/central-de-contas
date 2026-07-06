-- =========================================================
-- Migration 053 — Churn limpa `jornada` e `jornada_social`
-- =========================================================
-- Contexto: hoje quando um cliente vira `status = 'churn'`, o trigger
-- da migration 028 arquiva (seta `arquivado_em`), mas os campos
-- `jornada` (Tráfego) e `jornada_social` (Social Media) ficam com o
-- valor antigo — "Otimização", "Expansão", "Onboarding" — dando a
-- impressão de que o cliente ainda está numa fase ativa.
--
-- Regra: quando `status` vira `churn`, zerar `jornada` e `jornada_social`.
-- Quando sai de `churn` (retomou), zerar também — a equipe vai reatribuir
-- a fase apropriada manualmente.
--
-- Também roda backfill nos churn atuais.
--
-- Idempotente.
-- =========================================================
begin;

-- 1) Estende o trigger existente `trg_sync_arquivado_em` (migration 028)
--    pra também limpar jornada quando muda pra/de churn. Reescrevo a
--    função inteira mantendo o comportamento antigo de arquivado_em.
create or replace function trg_sync_arquivado_em()
returns trigger
language plpgsql
as $$
begin
  -- status virou churn → arquiva + limpa jornadas (não ativo em fase nenhuma)
  if new.status = 'churn' and (old.status is null or old.status <> 'churn') then
    new.arquivado_em    := coalesce(new.arquivado_em, now());
    new.jornada         := null;
    new.jornada_social  := null;
  -- status saiu de churn → desarquiva + limpa jornadas (equipe reatribui)
  elsif new.status <> 'churn' and old.status = 'churn' then
    new.arquivado_em    := null;
    new.jornada         := null;
    new.jornada_social  := null;
  end if;
  return new;
end;
$$;

-- 2) Estende o trigger de INSERT também — cliente criado já como churn
--    não devia entrar no banco com jornada preenchida
create or replace function trg_set_arquivado_em_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'churn' then
    if new.arquivado_em is null then
      new.arquivado_em := now();
    end if;
    new.jornada         := null;
    new.jornada_social  := null;
  end if;
  return new;
end;
$$;

-- 3) Backfill: limpa jornadas de todos os churn/arquivados atuais
update clientes
   set jornada = null,
       jornada_social = null
 where (status = 'churn' or arquivado_em is not null)
   and (jornada is not null or jornada_social is not null);

commit;

-- 4) Confirmação
select
  count(*) filter (where status = 'churn')                    as churn,
  count(*) filter (where status = 'churn' and jornada is not null)         as churn_com_jornada,
  count(*) filter (where status = 'churn' and jornada_social is not null)  as churn_com_jornada_social,
  count(*) as total
from clientes;
