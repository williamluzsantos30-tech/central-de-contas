-- =========================================================
-- Migration 062 — Fix purge_clientes_churn_expirados (ambiguous column)
-- =========================================================
-- Bug na migration 056: dentro da funcao purge_clientes_churn_expirados(),
-- a coluna `arquivado_em` esta declarada em 2 lugares:
--   1. Como coluna da tabela `clientes` (usada no DELETE ... RETURNING)
--   2. Como variavel OUT no `RETURNS TABLE (..., arquivado_em timestamptz, ...)`
--
-- PL/pgSQL nao sabe qual usar e joga erro 42702:
--   "column reference 'arquivado_em' is ambiguous"
--
-- Efeito: pg_cron rodou a funcao todo dia as 03:00 desde que foi criada,
-- e todas as execucoes falharam. 43 clientes churn ha 70-80 dias
-- continuaram no banco em vez de serem purgados.
--
-- Fix: adiciona a diretiva `#variable_conflict use_column` no inicio
-- do corpo da funcao. Isso instrui o PL/pgSQL a preferir o nome de
-- COLUNA (da tabela) sempre que houver conflito com nome de variavel.
--
-- Idempotente. CREATE OR REPLACE.
-- =========================================================
begin;

create or replace function purge_clientes_churn_expirados()
returns table (
  cliente_id    uuid,
  cliente_nome  text,
  arquivado_em  timestamptz,
  dias_churn    int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with deletados as (
    delete from clientes
     where status = 'churn'
       and arquivado_em is not null
       and arquivado_em < now() - interval '7 days'
    returning id, nome, arquivado_em
  )
  select
    d.id                                              as cliente_id,
    d.nome                                            as cliente_nome,
    d.arquivado_em                                    as arquivado_em,
    extract(day from (now() - d.arquivado_em))::int   as dias_churn
  from deletados d
  order by d.arquivado_em asc;
end;
$$;

commit;

-- =========================================================
-- Roda a purga imediatamente pra limpar o backlog dos 43 churns
-- que estavam presos ha semanas por causa do bug:
--
--   select * from purge_clientes_churn_expirados();
--
-- Vai retornar as linhas de tudo que foi apagado (cliente_id, nome,
-- arquivado_em, dias_churn). A partir do proximo dia as 03:00 UTC,
-- o cron vai continuar rodando normalmente pra novos churns.
-- =========================================================
