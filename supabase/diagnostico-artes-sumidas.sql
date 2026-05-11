-- =========================================================
-- DIAGNÓSTICO: por que os artes/items sumiram da Produção SM?
-- =========================================================
-- Roda no Supabase SQL Editor e me manda os 4 resultados.
-- Em 2 min a gente identifica se os dados foram apagados, se
-- estão lá mas com filtro errado, ou se nunca existiram.
-- =========================================================

-- 1) Quantos planejamentos existem e quantos items cada um tem?
select
  p.id,
  p.titulo,
  p.mes_referencia,
  p.created_at,
  count(i.id) as total_items
from producoes_social_media p
left join producoes_social_media_items i on i.producao_id = p.id
group by p.id, p.titulo, p.mes_referencia, p.created_at
order by p.created_at desc;

-- 2) Total absoluto de items na tabela (independente de FK)
select count(*) as total_items_no_banco from producoes_social_media_items;

-- 3) Items "órfãos" (que apontam pra planejamento que não existe mais)
select i.id, i.titulo, i.producao_id, i.created_at
from producoes_social_media_items i
left join producoes_social_media p on p.id = i.producao_id
where p.id is null
order by i.created_at desc;

-- 4) Logs recentes de deletes — Supabase mantém histórico se Backups está ativo.
--    Olhe em: Dashboard → Database → Backups (ou Database → Logs)
--    Procure entradas DELETE em "producoes_social_media_items"
--    nas últimas horas/dias.
