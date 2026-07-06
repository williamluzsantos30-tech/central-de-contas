-- =========================================================
-- Migration 055 — Restaurar tarefas ja com responsavel setado
-- =========================================================
-- Bug: o `sync_tarefas_faltantes()` (migrations 034 e 054) criava as
-- tarefas SEM `responsavel_id` — a pessoa precisava atribuir manualmente
-- depois. O trigger de bootstrap (migration 004, `apply_client_bootstrap`)
-- fazia isso corretamente, mas ele so roda no INSERT do cliente.
--
-- Fix: ao restaurar tarefas, herdar o responsavel do cliente:
--   coalesce(gestor_id, account_manager_id)
--
-- Mesma prioridade usada pelo bootstrap original (004) e pelo backfill
-- automatico quando o gestor muda.
--
-- Idempotente. DROP + CREATE porque o corpo mudou (mantem assinatura).
-- =========================================================
begin;

drop function if exists sync_tarefas_faltantes(uuid);

create function sync_tarefas_faltantes(p_cliente_id uuid default null)
returns table (
  cliente_id     uuid,
  cliente_nome   text,
  template_id    uuid,
  template_nome  text,
  frequencia     frequencia_tarefa,
  data_vencimento date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
begin
  return query
  with criar as (
    insert into tarefas (
      cliente_id, template_id, nome, descricao,
      frequencia, prioridade, data_vencimento,
      responsavel_id
    )
    select
      c.id,
      tt.id,
      tt.nome,
      tt.descricao,
      tt.frequencia,
      tt.prioridade,
      case tt.frequencia
        when 'diaria'  then v_today
        when 'semanal' then v_today + 7
        when 'mensal'  then v_today + 30
        else null
      end,
      -- herda responsavel do cliente: gestor de trafego > AM
      coalesce(c.gestor_id, c.account_manager_id)
    from clientes c
    cross join task_templates tt
    where c.status in ('ativo', 'atencao')
      and c.arquivado_em is null
      and tt.ativo = true
      and tt.frequencia in ('diaria', 'semanal', 'mensal')
      and (p_cliente_id is null or c.id = p_cliente_id)
      and not exists (
        select 1 from tarefas t
        where t.cliente_id = c.id
          and t.template_id = tt.id
          and t.status in ('pendente', 'em_andamento')
      )
    returning
      tarefas.cliente_id,
      tarefas.template_id,
      tarefas.frequencia,
      tarefas.data_vencimento
  )
  select
    cr.cliente_id,
    c.nome           as cliente_nome,
    cr.template_id,
    tt.nome          as template_nome,
    cr.frequencia,
    cr.data_vencimento
  from criar cr
  join clientes c        on c.id  = cr.cliente_id
  join task_templates tt on tt.id = cr.template_id
  order by c.nome, tt.nome;
end;
$$;

grant execute on function sync_tarefas_faltantes(uuid) to authenticated;

comment on function sync_tarefas_faltantes(uuid) is
  'Cria tarefas faltantes baseadas em task_templates ativos, ja herdando responsavel do cliente (gestor > AM). Sem argumento = todos os clientes ativo/atencao. Com p_cliente_id = so esse cliente. Idempotente. Datas respeitam trigger skip_weekend.';

-- Backfill: pega as tarefas SEM responsavel que ja foram restauradas
-- na leva anterior (pelo botao rodado antes dessa migration) e vincula.
-- Igual ao backfill da migration 004.
update tarefas t
   set responsavel_id = coalesce(c.gestor_id, c.account_manager_id),
       updated_at = now()
  from clientes c
 where t.cliente_id = c.id
   and t.responsavel_id is null
   and t.status <> 'concluida'
   and coalesce(c.gestor_id, c.account_manager_id) is not null;

commit;
