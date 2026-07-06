-- =========================================================
-- Migration 054 — Restaurar tarefas por cliente
-- =========================================================
-- Estende `sync_tarefas_faltantes()` (migration 034) pra aceitar
-- opcionalmente um `p_cliente_id`. Quando passado, restaura só as
-- tarefas faltantes desse cliente específico. Quando NULL (default),
-- roda globalmente igual antes.
--
-- Isso permite botão "Restaurar padrões" na aba Tarefas do cliente,
-- sem afetar o botão global de "Sincronizar templates" no /admin/templates.
--
-- Chamadas suportadas:
--   -- global (mantém comportamento antigo)
--   select * from sync_tarefas_faltantes();
--
--   -- por cliente
--   select * from sync_tarefas_faltantes('11111111-1111-1111-1111-111111111111'::uuid);
--
-- Regras mantidas:
--   - Só cria onde NÃO existe tarefa pendente/em_andamento pro mesmo
--     template+cliente (idempotente)
--   - Só considera clientes ativo/atencao e não-arquivados (churn/pausado
--     ignorados)
--   - Só templates ativo=true com frequencia diaria/semanal/mensal
--   - Datas iniciais respeitam trigger skip_weekend (migration 033)
--
-- Idempotente. DROP + CREATE porque muda assinatura.
-- =========================================================
begin;

drop function if exists sync_tarefas_faltantes();
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
      frequencia, prioridade, data_vencimento
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
      end
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
  'Cria tarefas faltantes baseadas em task_templates ativos. Sem argumento = todos os clientes ativo/atencao. Com p_cliente_id = só esse cliente. Idempotente. Datas respeitam trigger skip_weekend.';

commit;
