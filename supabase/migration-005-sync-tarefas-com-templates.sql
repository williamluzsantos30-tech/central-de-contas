-- =========================================================
-- Migration 005 — sincroniza TODAS as tarefas com os templates
-- =========================================================
-- O que faz:
-- Para toda tarefa que tem template_id (foi gerada a partir de um
-- template), substitui nome / descrição / prioridade / frequência
-- pelo valor ATUAL do template correspondente.
--
-- Use isto sempre que tiver editado vários templates e quiser que
-- as tarefas em aberto reflitam as edições.
--
-- IMPORTANTE — o que NÃO é tocado:
--   • data_vencimento de cada ocorrência (cada tarefa tem sua própria data)
--   • responsavel_id (preservado — quem foi atribuído manualmente continua)
--   • status (uma tarefa concluída segue concluída)
--
-- COMO RODAR:
-- 1. Supabase → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- (Idempotente — pode rodar quantas vezes precisar.)
-- =========================================================

-- 1) Pré-visualização: quantas tarefas serão atualizadas?
select
  count(*) filter (where t.status = 'pendente')      as pendentes,
  count(*) filter (where t.status = 'em_andamento')  as em_andamento,
  count(*) filter (where t.status = 'concluida')     as concluidas,
  count(*) filter (where t.status = 'cancelada')     as canceladas,
  count(*)                                            as total_com_template
from tarefas t
where t.template_id is not null;

-- 2) Atualização propriamente dita: TODAS as tarefas com template,
--    independentemente do status.
--    (Se quiser preservar o histórico das CONCLUÍDAS, descomente o
--    `and t.status <> 'concluida'` no fim da query.)
update tarefas t
   set nome       = tt.nome,
       descricao  = tt.descricao,
       prioridade = tt.prioridade,
       frequencia = tt.frequencia,
       updated_at = now()
  from task_templates tt
 where t.template_id = tt.id
   -- and t.status <> 'concluida'  -- ← descomente esta linha pra preservar concluídas
;

-- 3) Confirmação: amostra das tarefas atualizadas pra você conferir
select
  c.nome      as cliente,
  t.nome      as tarefa,
  t.frequencia,
  t.prioridade,
  t.status,
  tt.nome     as template_origem,
  t.updated_at
from tarefas t
join task_templates tt on tt.id = t.template_id
join clientes c on c.id = t.cliente_id
order by t.updated_at desc
limit 20;
