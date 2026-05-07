-- =========================================================
-- Migration 004 — tarefas auto-vinculadas ao gestor do cliente
-- =========================================================
-- Resolve: tarefas criadas automaticamente (a partir de templates,
-- quando o cliente é cadastrado) ficavam com responsável "—".
-- Agora elas são vinculadas ao gestor de tráfego do cliente
-- (ou ao account manager se não houver gestor).
--
-- Também:
--   • Faz BACKFILL nas tarefas já existentes que estão sem responsável.
--   • Quando o gestor do cliente mudar, as tarefas pendentes que
--     estavam atribuídas ao gestor antigo (ou sem ninguém) passam
--     pro novo gestor automaticamente. Tarefas que foram atribuídas
--     manualmente a outra pessoa NÃO são mexidas.
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- (Idempotente — pode rodar mais de uma vez sem efeito colateral.)
-- =========================================================

-- 1) Atualiza o trigger de bootstrap pra setar responsavel_id
create or replace function public.apply_client_bootstrap()
returns trigger as $$
declare
  t record;
  due date;
  resp uuid;
begin
  -- Prioridade pra responsável: gestor de tráfego > account manager
  resp := coalesce(new.gestor_id, new.account_manager_id);

  for t in select * from task_templates where ativo = true loop
    due := case t.frequencia
      when 'diaria' then current_date
      when 'semanal' then current_date + 7
      when 'mensal' then current_date + 30
      else null
    end;
    insert into tarefas(
      cliente_id, template_id, nome, descricao, frequencia,
      prioridade, data_vencimento, responsavel_id
    )
    values (new.id, t.id, t.nome, t.descricao, t.frequencia,
            t.prioridade, due, resp);
  end loop;

  -- Ativos só são criados na primeira vez (when called from INSERT)
  if (tg_op = 'INSERT') then
    insert into ativos(cliente_id, tipo, status) values
      (new.id, 'meta_pixel', 'pendente'),
      (new.id, 'ga4', 'pendente'),
      (new.id, 'google_meu_negocio', 'pendente'),
      (new.id, 'bio_estruturada', 'pendente'),
      (new.id, 'publicos_meta_ads', 'pendente')
    on conflict do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 2) Trigger novo: quando o gestor (ou AM) do cliente mudar,
--    realoca as tarefas pendentes do gestor antigo pro novo
create or replace function public.update_tarefas_responsavel_on_cliente_change()
returns trigger as $$
declare
  resp_antigo uuid;
  resp_novo uuid;
begin
  resp_antigo := coalesce(old.gestor_id, old.account_manager_id);
  resp_novo   := coalesce(new.gestor_id, new.account_manager_id);

  if (resp_antigo is distinct from resp_novo) then
    update tarefas
       set responsavel_id = resp_novo,
           updated_at = now()
     where cliente_id = new.id
       and status <> 'concluida'
       and (responsavel_id is null or responsavel_id = resp_antigo);
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cliente_gestor_update on clientes;
create trigger trg_cliente_gestor_update
  after update on clientes
  for each row execute function public.update_tarefas_responsavel_on_cliente_change();

-- 3) BACKFILL: tarefas existentes sem responsável ganham o gestor do cliente
update tarefas t
   set responsavel_id = coalesce(c.gestor_id, c.account_manager_id),
       updated_at = now()
  from clientes c
 where t.cliente_id = c.id
   and t.responsavel_id is null
   and t.status <> 'concluida'
   and coalesce(c.gestor_id, c.account_manager_id) is not null;

-- 4) Confirmação
select
  count(*) filter (where responsavel_id is not null) as tarefas_com_responsavel,
  count(*) filter (where responsavel_id is null and status <> 'concluida') as pendentes_sem_responsavel,
  count(*) as total
from tarefas;
