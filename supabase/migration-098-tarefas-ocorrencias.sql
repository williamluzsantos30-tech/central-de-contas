-- =========================================================
-- Migration 098 — Tarefas recorrentes por OCORRÊNCIA
-- =========================================================
-- Antes: a tarefa recorrente era uma linha só, cujo vencimento andava pra
-- frente ao concluir — se ninguém marcava, acumulava "Atrasada 14d".
--
-- Agora: a linha de `tarefas` é o MODELO (a regra) e cada vez que ela
-- precisa ser feita é uma OCORRÊNCIA (diária = dia útil, semanal = semana,
-- mensal = mês). Não concluída até o fim do período = "perdida" (calculada
-- no app a partir do calendário). Aqui só grava o que ACONTECEU: feita
-- (quem/quando) e observação.
--
--   1. tarefas.dia_referencia   — semanal: dia da semana (1–5); mensal: dia
--                                 do mês. Null = do template / do vencimento.
--   2. tarefas.ocorrencias_desde — início da contagem. Tarefas existentes
--                                 começam HOJE (o passado não vira "perdida").
--   3. tarefa_ocorrencias        — uma linha por ocorrência registrada.
--
-- Idempotente. Rodar no Supabase do domus.
-- =========================================================
begin;

-- 1) e 2) colunas no modelo
alter table tarefas add column if not exists dia_referencia smallint;
alter table tarefas drop constraint if exists tarefas_dia_referencia_check;
alter table tarefas add constraint tarefas_dia_referencia_check
  check (dia_referencia is null or dia_referencia between 1 and 31);

alter table tarefas add column if not exists ocorrencias_desde date;

update tarefas
   set ocorrencias_desde = (now() at time zone 'America/Sao_Paulo')::date
 where ocorrencias_desde is null;

-- Semanais/mensais já concluídas no período atual (pelo modelo antigo)
-- começam no próximo período — senão a ocorrência desta semana/mês
-- apareceria em aberto de novo. Só mexe nas que acabaram de ganhar a data.
update tarefas
   set ocorrencias_desde = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date + 7
 where frequencia = 'semanal'
   and ocorrencias_desde = (now() at time zone 'America/Sao_Paulo')::date
   and data_conclusao is not null
   and (data_conclusao at time zone 'America/Sao_Paulo')::date
       >= date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;

update tarefas
   set ocorrencias_desde = (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')::date
 where frequencia = 'mensal'
   and ocorrencias_desde = (now() at time zone 'America/Sao_Paulo')::date
   and data_conclusao is not null
   and (data_conclusao at time zone 'America/Sao_Paulo')::date
       >= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;

alter table tarefas
  alter column ocorrencias_desde set default ((now() at time zone 'America/Sao_Paulo')::date);

comment on column tarefas.dia_referencia is
  'Semanal: dia da semana (1=seg … 5=sex). Mensal: dia do mês. Null = usa o template (dias_semana/dia_mes) ou o vencimento.';
comment on column tarefas.ocorrencias_desde is
  'Início da contagem de ocorrências — antes disso nada conta como perdida.';

-- 3) ocorrências registradas
create table if not exists tarefa_ocorrencias (
  id             uuid primary key default gen_random_uuid(),
  tarefa_id      uuid not null references tarefas(id) on delete cascade,
  data_prevista  date not null,
  status         text not null default 'feita'
                 check (status in ('pendente', 'feita', 'perdida')),
  concluida_em   timestamptz,
  concluida_por  uuid references profiles(id) on delete set null,
  observacao     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tarefa_id, data_prevista)
);

comment on table tarefa_ocorrencias is
  'Ocorrências registradas de tarefas (feita: quem/quando; observação). Pendente/perdida são calculadas pelo app a partir do calendário.';

create index if not exists idx_tarefa_ocorrencias_data on tarefa_ocorrencias(data_prevista);

drop trigger if exists trg_tarefa_ocorrencias_updated on tarefa_ocorrencias;
create trigger trg_tarefa_ocorrencias_updated
  before update on tarefa_ocorrencias
  for each row execute function set_updated_at();

alter table tarefa_ocorrencias enable row level security;
drop policy if exists "auth read tarefa_ocorrencias" on tarefa_ocorrencias;
drop policy if exists "auth write tarefa_ocorrencias" on tarefa_ocorrencias;
create policy "auth read tarefa_ocorrencias"
  on tarefa_ocorrencias for select
  using (auth.role() = 'authenticated');
create policy "auth write tarefa_ocorrencias"
  on tarefa_ocorrencias for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Diárias já concluídas HOJE pelo modelo antigo viram a ocorrência feita de hoje.
insert into tarefa_ocorrencias (tarefa_id, data_prevista, status, concluida_em)
select t.id,
       (now() at time zone 'America/Sao_Paulo')::date,
       'feita',
       t.data_conclusao
  from tarefas t
 where t.frequencia = 'diaria'
   and t.status in ('pendente', 'em_andamento')
   and t.data_conclusao is not null
   and (t.data_conclusao at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
on conflict (tarefa_id, data_prevista) do nothing;

commit;

-- Conferência (só leitura):
select count(*) filter (where ocorrencias_desde is not null) as tarefas_com_inicio,
       (select count(*) from tarefa_ocorrencias) as ocorrencias_registradas
  from tarefas;
