-- =========================================================
-- Migration 033 — Tarefas recorrentes pulam fim de semana
-- =========================================================
-- Antes: tarefa diária concluída na sexta agendava pra sábado. Ninguém
-- mexia, e na segunda já aparecia "Atrasada 2d". Mesma coisa pra
-- semanal/mensal quando o dia escolhido caía em fds.
--
-- Agora: trigger BEFORE INSERT/UPDATE on tarefas empurra data_vencimento
-- pra próxima segunda quando cair em sábado (dow=6) ou domingo (dow=0).
-- Aplica só pra frequência recorrente (diária/semanal/mensal). Esporádica
-- mantém a data que o usuário escolheu (pode ser uma tarefa de fim de
-- semana proposital).
--
-- Também:
--   1) Ajusta a função apply_client_bootstrap pra usar a mesma lógica
--   2) Backfill: pega tarefas pendentes atualmente com vencimento em fds
--      e empurra pra segunda
--
-- Idempotente.
-- =========================================================

-- 1) Helper SQL: avança pra próxima segunda se for fds
create or replace function next_weekday(d date)
returns date
language sql
immutable
as $$
  select case
    when extract(dow from d) = 6 then d + 2  -- sábado → segunda
    when extract(dow from d) = 0 then d + 1  -- domingo → segunda
    else d
  end;
$$;

-- 2) Trigger BEFORE INSERT/UPDATE em tarefas — só pra recorrentes
create or replace function trg_tarefas_skip_weekend()
returns trigger
language plpgsql
as $$
begin
  if new.data_vencimento is not null
     and new.frequencia in ('diaria', 'semanal', 'mensal') then
    new.data_vencimento := next_weekday(new.data_vencimento);
  end if;
  return new;
end;
$$;

drop trigger if exists tarefas_skip_weekend on tarefas;
create trigger tarefas_skip_weekend
  before insert or update of data_vencimento, frequencia on tarefas
  for each row execute function trg_tarefas_skip_weekend();

-- 3) Ajusta o bootstrap (apply_client_bootstrap) pra usar next_weekday
create or replace function public.apply_client_bootstrap()
returns trigger as $$
declare
  t record;
  due date;
begin
  for t in select * from task_templates where ativo = true loop
    due := case t.frequencia
      when 'diaria' then current_date
      when 'semanal' then current_date + 7
      when 'mensal' then current_date + 30
      else null
    end;
    -- Pula fds pra tarefas recorrentes
    if due is not null and t.frequencia in ('diaria', 'semanal', 'mensal') then
      due := next_weekday(due);
    end if;
    insert into tarefas(cliente_id, template_id, nome, descricao, frequencia, prioridade, data_vencimento)
    values (new.id, t.id, t.nome, t.descricao, t.frequencia, t.prioridade, due);
  end loop;

  insert into ativos(cliente_id, tipo, status) values
    (new.id, 'meta_pixel', 'pendente'),
    (new.id, 'ga4', 'pendente'),
    (new.id, 'google_meu_negocio', 'pendente'),
    (new.id, 'bio_estruturada', 'pendente'),
    (new.id, 'publicos_meta_ads', 'pendente');
  return new;
end;
$$ language plpgsql security definer;

-- 4) Backfill: tarefas pendentes (não concluídas) recorrentes com
--    data_vencimento em fds → empurra pra segunda
update tarefas
   set data_vencimento = next_weekday(data_vencimento)
 where status <> 'concluida'
   and frequencia in ('diaria', 'semanal', 'mensal')
   and data_vencimento is not null
   and extract(dow from data_vencimento) in (0, 6);

-- 5) Confirmação
select
  (select count(*) from tarefas
    where status <> 'concluida'
      and frequencia in ('diaria', 'semanal', 'mensal')
      and data_vencimento is not null
      and extract(dow from data_vencimento) in (0, 6)
  ) as pendentes_em_fds_apos_backfill, -- esperado: 0
  (select count(*) from tarefas
    where status <> 'concluida'
      and frequencia in ('diaria', 'semanal', 'mensal')
  ) as total_recorrentes_pendentes;
