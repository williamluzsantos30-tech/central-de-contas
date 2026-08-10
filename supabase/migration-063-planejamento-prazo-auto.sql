-- =========================================================
-- Migration 063 — Prazo do planejamento SM automatizado
-- =========================================================
-- Regra: `producoes_social_media.prazo` = MAX(items.prazo) do planejamento.
-- Ideia: o prazo do planejamento eh a data em que o ULTIMO post daquele
-- planejamento vai ao ar. Antes precisava setar manualmente pelo botao
-- "Definir prazo"; agora recalcula sozinho a cada alteracao nos items.
--
-- Detalhes:
--   - Trigger AFTER INSERT/UPDATE/DELETE em producoes_social_media_items.
--   - Trigger SO recalcula se o campo `prazo` do item mudou (skip em
--     UPDATE de status/copy/arte etc — economiza calls).
--   - Se planejamento fica sem items (deletou todos), prazo vira NULL.
--   - Manual override: se alguem quiser um prazo diferente, pode dar UPDATE
--     direto — mas na proxima mudanca em item o auto-calc reescreve.
--     UI vai remover o botao pra evitar confusao.
--
-- Idempotente. Inclui backfill dos planejamentos existentes.
-- =========================================================
begin;

-- 1) Funcao que recalcula prazo pra 1 planejamento
create or replace function recalcular_prazo_planejamento_sm(p_planejamento_id uuid)
returns void
language plpgsql
as $$
begin
  update producoes_social_media
     set prazo = (
       select max(i.prazo)
         from producoes_social_media_items i
        where i.producao_id = p_planejamento_id
     )
   where id = p_planejamento_id;
end;
$$;

-- 2) Trigger que dispara em cada mudanca de item
create or replace function trg_recalc_prazo_planejamento_sm()
returns trigger
language plpgsql
as $$
declare
  target_id uuid;
begin
  -- Detecta qual planejamento eh afetado
  if tg_op = 'DELETE' then
    target_id := old.producao_id;
  else
    target_id := new.producao_id;
  end if;

  -- Skip se prazo do item nao mudou (evita recalculo em UPDATE de status,
  -- copy, arte etc que nao afetam a data do planejamento).
  if tg_op = 'UPDATE'
     and new.prazo is not distinct from old.prazo
     and new.producao_id is not distinct from old.producao_id then
    return null;
  end if;

  perform recalcular_prazo_planejamento_sm(target_id);

  -- Se moveu item de um planejamento pra outro, recalcula os DOIS
  if tg_op = 'UPDATE' and new.producao_id is distinct from old.producao_id then
    perform recalcular_prazo_planejamento_sm(old.producao_id);
  end if;

  return null;
end;
$$;

drop trigger if exists recalc_prazo_planejamento_sm on producoes_social_media_items;
create trigger recalc_prazo_planejamento_sm
  after insert or update or delete on producoes_social_media_items
  for each row
  execute function trg_recalc_prazo_planejamento_sm();

-- 3) Backfill: aplica em todos os planejamentos existentes agora
update producoes_social_media p
   set prazo = sub.max_prazo
  from (
    select producao_id, max(prazo) as max_prazo
      from producoes_social_media_items
     where prazo is not null
     group by producao_id
  ) sub
 where p.id = sub.producao_id
   and (p.prazo is distinct from sub.max_prazo);

-- Planejamentos que nao tem NENHUM item com prazo -> prazo = NULL
update producoes_social_media p
   set prazo = null
 where p.prazo is not null
   and not exists (
     select 1
       from producoes_social_media_items i
      where i.producao_id = p.id
        and i.prazo is not null
   );

commit;

-- =========================================================
-- Conferencia:
--   select p.id, p.titulo, p.prazo,
--          (select max(i.prazo) from producoes_social_media_items i where i.producao_id = p.id) as max_item_prazo
--     from producoes_social_media p
--    where p.prazo is distinct from
--          (select max(i.prazo) from producoes_social_media_items i where i.producao_id = p.id);
--   -- Deve retornar ZERO rows.
-- =========================================================
