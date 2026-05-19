-- =========================================================
-- Migration 034 — Sincronizar tarefas faltantes (template → cliente)
-- =========================================================
-- Cenário: alguém deletou tarefa(s) de algum cliente, ou um template
-- novo foi criado depois da onda inicial. Pra cada cliente ativo, gera
-- as tarefas que faltam baseadas nos templates ativos.
--
-- Idempotente: só cria onde NÃO existe tarefa pendente/em_andamento
-- (não duplica trabalho ativo). Se existe só tarefa concluída pra esse
-- template+cliente, cria uma nova pendente (assume que a próxima
-- ocorrência deveria ter sido gerada e não foi).
--
-- Considera "ativo" = clientes com status='ativo' OU status='atencao'
-- (pausados e churn ficam de fora). Também ignora clientes arquivados.
--
-- Estrutura:
--   1) Função sync_tarefas_faltantes() retorna n_criadas (pra UI mostrar)
--   2) GRANT EXECUTE pra authenticated (botão da UI)
--   3) Execução imediata pra resolver o caso da Clínica Cactus + outros
--
-- Datas iniciais respeitam o trigger tarefas_skip_weekend (migration 033):
-- se cair em fds, é empurrada pra segunda automaticamente.
-- =========================================================

create or replace function sync_tarefas_faltantes()
returns table (
  cliente_id uuid,
  cliente_nome text,
  template_id uuid,
  template_nome text,
  frequencia frequencia_tarefa,
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
  join clientes c       on c.id  = cr.cliente_id
  join task_templates tt on tt.id = cr.template_id
  order by c.nome, tt.nome;
end;
$$;

grant execute on function sync_tarefas_faltantes() to authenticated;

comment on function sync_tarefas_faltantes() is
  'Cria tarefas faltantes (com template_id) pra clientes ativos quando o template existe mas nenhuma tarefa pendente/em_andamento corresponde. Idempotente. Use pra restaurar tarefas deletadas ou propagar templates novos. data_vencimento inicial respeita o trigger skip_weekend.';

-- Execução imediata pra resolver o backlog atual
select * from sync_tarefas_faltantes();
