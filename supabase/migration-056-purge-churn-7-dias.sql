-- =========================================================
-- Migration 056 — Purga automatica de clientes churn apos 7 dias
-- =========================================================
-- Regra: cliente com status='churn' arquivado ha mais de 7 dias eh
-- APAGADO DEFINITIVAMENTE do banco. Todas as tabelas relacionadas
-- (tarefas, otimizacoes, planejamentos social media, artes, metas,
-- criacoes, ativos, etc) tambem somem — todas as FKs pra clientes
-- ja sao `on delete cascade`, entao um DELETE unico limpa tudo.
--
-- Roda automaticamente todo dia as 03:00 UTC (= 00:00 Brasil-3) via
-- pg_cron. Se um cliente churnar hoje, ele tem ate o 7o dia pra ser
-- revertido; a partir do 8o, some.
--
-- IMPORTANTE — irreversivel:
--   Um cliente purgado NAO PODE ser recuperado. Historico de
--   otimizacoes, artes social media, tarefas concluidas, PDFs, logs
--   de CRM, tudo vai junto. Se o time achar que o cliente pode voltar,
--   precisa REVERTER o churn antes do 7o dia (mudar status pra ativo,
--   pausado ou atencao).
--
-- Idempotente. DROP + CREATE da funcao. Reagenda o cron.
--
-- PRE-REQUISITO no Supabase:
--   O projeto precisa ter a extensao `pg_cron` habilitada:
--     Dashboard -> Database -> Extensions -> pg_cron -> Enable
--   Se ja tiver, essa migration nao muda nada nesse aspecto.
-- =========================================================
begin;

-- 1) Garante que pg_cron esta disponivel. Ja vem instalado no Supabase
--    mas precisa estar enabled no dashboard. Esse create eh no-op se ja
--    estiver ativo.
create extension if not exists pg_cron;

-- 2) Funcao que faz a purga. Retorna o que foi deletado (util pro log
--    do cron ver o que rodou).
drop function if exists purge_clientes_churn_expirados();

create function purge_clientes_churn_expirados()
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

comment on function purge_clientes_churn_expirados() is
  'Purga (DELETE definitivo) clientes com status=churn arquivados ha mais de 7 dias. Cascada apaga tarefas, otimizacoes, social media, metas, artes, etc. Retorna o que foi apagado. Rodado diariamente por pg_cron (job purge_clientes_churn_expirados_daily). Sem recuperacao possivel.';

grant execute on function purge_clientes_churn_expirados() to postgres, service_role;

-- 3) Agenda o cron. Roda todo dia as 03:00 UTC (= 00:00 America/Sao_Paulo).
--    Idempotente: se ja tem job com esse nome, desagenda antes de
--    reagendar (cron.schedule levanta erro se ja existe).
do $$
begin
  perform cron.unschedule('purge_clientes_churn_expirados_daily');
exception when others then
  -- ignora se job nao existe
  null;
end $$;

select cron.schedule(
  'purge_clientes_churn_expirados_daily',
  '0 3 * * *',
  $cron$ select purge_clientes_churn_expirados(); $cron$
);

commit;

-- =========================================================
-- Consultas uteis (rodar manualmente quando precisar):
--
-- 1) Ver o que SERIA purgado agora (dry-run, nao deleta):
--    select id, nome, arquivado_em,
--           extract(day from (now() - arquivado_em))::int as dias
--      from clientes
--     where status = 'churn'
--       and arquivado_em is not null
--       and arquivado_em < now() - interval '7 days';
--
-- 2) Rodar a purga manualmente agora (sem esperar o cron):
--    select * from purge_clientes_churn_expirados();
--
-- 3) Ver o historico de execucoes do cron:
--    select jobid, jobname, status, return_message, start_time, end_time
--      from cron.job_run_details
--     where jobname = 'purge_clientes_churn_expirados_daily'
--     order by start_time desc
--     limit 20;
--
-- 4) Cancelar o cron (se decidir desativar):
--    select cron.unschedule('purge_clientes_churn_expirados_daily');
-- =========================================================
