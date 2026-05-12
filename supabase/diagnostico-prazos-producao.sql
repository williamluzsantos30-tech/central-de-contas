-- =========================================================
-- Diagnóstico — prazo_producao está sendo calculado certo?
-- =========================================================
-- Rode DEPOIS da migration-016 pra confirmar.
-- =========================================================

-- 1) Tem a coluna nova?
select column_name, data_type
from information_schema.columns
where table_name = 'producoes_social_media_items'
  and column_name in ('prazo', 'prazo_producao');

-- 2) Triggers criados?
select tgname, tgrelid::regclass as tabela
from pg_trigger
where tgname in ('recalc_prazos_on_aprovacao', 'recalc_prazos_on_item_change');

-- 3) Para cada planejamento aprovado, confere se os items estão com prazo certo
--    (ordem, prazo de postagem, prazo de produção)
select
  p.id              as planejamento_id,
  p.titulo          as planejamento,
  p.aprovado_em::date as aprovado_em,
  i.ordem,
  i.titulo          as post,
  i.prazo           as data_postagem,
  i.prazo_producao  as prazo_arte,
  -- Lote esperado (1, 2, 3, ...): ceil(posicao / 3)
  ceil(row_number() over (partition by i.producao_id order by i.ordem asc)::numeric / 3)::int as lote
from producoes_social_media p
join producoes_social_media_items i on i.producao_id = p.id
where p.aprovado_em is not null
order by p.id, i.ordem
limit 50;
