-- =========================================================
-- Migration 031 — Log de exclusões de tarefas (auditoria)
-- =========================================================
-- Quando alguém deleta uma tarefa, o sistema registra:
--   • Qual era a tarefa (snapshot completo dos dados)
--   • Quem deletou (auth.uid() + nome + email do profile)
--   • Quando
--   • Qual cliente
--
-- Acessível em /admin → aba "Auditoria".
--
-- Idempotente.
-- =========================================================

-- 1) Tabela de log
create table if not exists tarefas_log (
  id uuid primary key default gen_random_uuid(),
  acao text not null,
  tarefa_id uuid not null,
  tarefa_data jsonb not null,
  ator_user_id uuid,
  ator_nome text,
  ator_email text,
  cliente_id uuid,
  created_at timestamptz default now()
);

comment on table tarefas_log is
  'Log de açoes em tarefas (exclusao por enquanto). Snapshot dos dados antes + quem fez.';

create index if not exists idx_tarefas_log_created_at
  on tarefas_log(created_at desc);
create index if not exists idx_tarefas_log_ator
  on tarefas_log(ator_user_id);

-- 2) Trigger: AFTER DELETE em tarefas
create or replace function trg_log_tarefa_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_nome text;
  v_email text;
begin
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if v_user_id is not null then
    select nome, email into v_nome, v_email
    from profiles
    where id = v_user_id;
  end if;

  insert into tarefas_log (
    acao, tarefa_id, tarefa_data, ator_user_id, ator_nome, ator_email, cliente_id
  ) values (
    'delete',
    old.id,
    to_jsonb(old),
    v_user_id,
    v_nome,
    v_email,
    old.cliente_id
  );

  return old;
end;
$$;

drop trigger if exists log_tarefa_delete on tarefas;
create trigger log_tarefa_delete
  after delete on tarefas
  for each row
  execute function trg_log_tarefa_delete();

-- 3) RLS — qualquer auth pode ler (a UI restringe acesso ao Admin)
alter table tarefas_log enable row level security;

drop policy if exists "auth read tarefas_log" on tarefas_log;
drop policy if exists "auth write tarefas_log" on tarefas_log;

create policy "auth read tarefas_log"
  on tarefas_log
  for select
  using (auth.role() = 'authenticated');

-- Escrita só via trigger (SECURITY DEFINER), não permite INSERT direto

-- 4) Confirmação
select count(*) as total_logs from tarefas_log;
