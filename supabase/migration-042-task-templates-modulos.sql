-- =========================================================
-- Migration 042 — task_templates ganham modulos + cleanup
-- =========================================================
-- Bug: cliente cadastrado em Social Media estava recebendo tarefas
-- que são exclusivamente de Tráfego (Análise diária do gerenciador,
-- Revisão semanal de orçamento, etc) porque apply_client_bootstrap
-- criava TODAS as task_templates ativas, sem checar modulo do cliente.
--
-- Fix:
--   1. task_templates ganha coluna modulos (text[]) — padrão {trafego}
--   2. apply_client_bootstrap só cria tarefa se há intersecção entre
--      template.modulos e cliente.modulos
--   3. DELETE retroativo: remove tarefas atualmente em clientes que
--      NÃO têm o módulo do template (cleanup do backlog)
--   4. UI dos Templates ganha edição desse array
--
-- Idempotente.
-- =========================================================

-- 1) Coluna modulos em task_templates
alter table task_templates
  add column if not exists modulos text[] not null default '{trafego}'::text[];

comment on column task_templates.modulos is
  'Array de modulos onde esse template se aplica. Cliente precisa ter pelo menos 1 modulo em comum pra receber a tarefa. Default: {trafego} (tarefas legacy).';

-- 2) Backfill: garante que templates pré-existentes tem modulos
update task_templates
   set modulos = '{trafego}'::text[]
 where modulos is null or array_length(modulos, 1) is null;

-- Index GIN pra filtros && rápidos
create index if not exists idx_task_templates_modulos
  on task_templates using gin (modulos);

-- 3) Trigger apply_client_bootstrap atualizada
create or replace function public.apply_client_bootstrap()
returns trigger as $$
declare
  t record;
  due date;
begin
  for t in
    select * from task_templates
     where ativo = true
       and modulos && new.modulos -- intersecção: template e cliente compartilham ao menos 1 modulo
  loop
    due := case t.frequencia
      when 'diaria' then current_date
      when 'semanal' then current_date + 7
      when 'mensal' then current_date + 30
      else null
    end;
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

-- 4) CLEANUP RETROATIVO — apaga tarefas que existem em clientes
--    onde nao deveriam estar (template modulos não match com cliente modulos)
--    Só apaga tarefas com template_id (não toca em tarefas esporádicas/manuais)
delete from tarefas t
 using task_templates tt, clientes c
 where tt.id = t.template_id
   and c.id  = t.cliente_id
   and not (tt.modulos && c.modulos)
   and t.status <> 'concluida'; -- preserva históricoconcluido

-- 5) Atualiza sync_tarefas_faltantes (migration 034) pra também filtrar por modulo
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
      and tt.modulos && c.modulos -- só sincroniza se módulos batem
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

-- 6) Confirmação
select
  (select count(*) from task_templates where modulos && '{trafego}'::text[]) as templates_trafego,
  (select count(*) from task_templates where modulos && '{social_media}'::text[]) as templates_social,
  (select count(*) from task_templates where modulos && '{trafego, social_media}'::text[]) as templates_ambos,
  (select count(*) from tarefas where status <> 'concluida') as tarefas_pendentes;
