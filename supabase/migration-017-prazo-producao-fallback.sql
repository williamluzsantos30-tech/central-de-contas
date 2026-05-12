-- =========================================================
-- Migration 017 — prazo_producao funciona SEM aprovação explícita
-- =========================================================
-- Problema: o trigger da 016 só calculava prazo_producao quando
-- producoes_social_media.aprovado_em era setado. Mas a equipe trabalha
-- direto na tela de Produção, sem passar pelo Planejamento Mensal pra
-- "marcar como aprovado". Resultado: prazo_producao ficava sempre NULL
-- e o front mostrava a data de postagem como deadline.
--
-- Fix: usar COALESCE(aprovado_em, created_at) como ponto de partida.
-- Se o planejamento JÁ foi aprovado, conta a partir da aprovação (regra
-- original). Senão, conta a partir de quando o planejamento foi criado.
--
-- Quando a aprovação acontecer DEPOIS, o trigger original (016)
-- recalcula tudo a partir da nova data — sem perda.
--
-- Idempotente.
-- =========================================================

-- 1) Reescreve a função: COALESCE(aprovado_em, created_at)
create or replace function recalcular_prazos_producao(p_producao_id uuid)
returns void
language plpgsql
as $$
declare
  v_ref_date date;
begin
  -- Pega aprovado_em (preferência) ou created_at (fallback)
  select coalesce(aprovado_em::date, created_at::date)
    into v_ref_date
   from producoes_social_media
  where id = p_producao_id;

  if v_ref_date is null then
    -- planejamento não existe mais — nada a fazer
    return;
  end if;

  -- Atualiza cada item: lote = ceil(posicao/3), prazo = ref + 3*lote dias úteis
  with itens_ordenados as (
    select id,
           row_number() over (order by ordem asc, created_at asc) as posicao
      from producoes_social_media_items
     where producao_id = p_producao_id
  )
  update producoes_social_media_items i
     set prazo_producao = add_business_days(
           v_ref_date,
           ceil(io.posicao::numeric / 3)::int * 3
         )
    from itens_ordenados io
   where i.id = io.id;
end;
$$;

-- 2) Novo trigger: quando um planejamento é CRIADO, já calcula os prazos
--    (antes só recalculava quando aprovado_em mudava)
create or replace function trg_recalc_prazos_on_planejamento_insert()
returns trigger
language plpgsql
as $$
begin
  perform recalcular_prazos_producao(new.id);
  return new;
end;
$$;

drop trigger if exists recalc_prazos_on_planejamento_insert on producoes_social_media;
create trigger recalc_prazos_on_planejamento_insert
  after insert on producoes_social_media
  for each row
  execute function trg_recalc_prazos_on_planejamento_insert();

-- 3) Backfill: recalcula TODOS os planejamentos existentes
--    (agora que a função usa created_at como fallback, planejamentos
--    não aprovados também vão ganhar prazo_producao)
do $$
declare
  r record;
begin
  for r in select id from producoes_social_media loop
    perform recalcular_prazos_producao(r.id);
  end loop;
end$$;

-- 4) Confirmação
select
  count(*) filter (where prazo_producao is not null) as com_prazo_producao,
  count(*) filter (where prazo_producao is null)     as sem_prazo_producao,
  count(*) as total
from producoes_social_media_items;
