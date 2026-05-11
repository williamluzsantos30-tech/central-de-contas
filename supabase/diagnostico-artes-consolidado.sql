-- =========================================================
-- Diagnóstico consolidado dos 28 items
-- Quero entender pra qual planejamento cada um aponta
-- =========================================================

-- 1) Items agrupados por producao_id (planejamento)
--    Se aparecer "ÓRFÃO" no titulo do plan = aponta pra planejamento
--    que não existe mais
select
  i.producao_id,
  coalesce(p.titulo, '🔴 ÓRFÃO — planejamento deletado') as planejamento,
  p.cliente_id,
  count(*) as qtd_items,
  min(i.created_at) as criado_em
from producoes_social_media_items i
left join producoes_social_media p on p.id = i.producao_id
group by i.producao_id, p.titulo, p.cliente_id
order by qtd_items desc;

-- 2) Lista os 4 planejamentos visíveis na tela e quantos items "deveriam" ter
select
  p.id,
  p.titulo,
  p.cliente_id,
  p.created_at,
  (select count(*) from producoes_social_media_items i where i.producao_id = p.id) as items_atuais
from producoes_social_media p
order by p.created_at desc;
