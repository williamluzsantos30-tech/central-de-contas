-- =========================================================
-- Migration 064 — Prazo do planejamento SM usa prazo_PRODUCAO, nao prazo
-- =========================================================
-- Correcao da migration 063 — eu usei o campo errado.
--
-- Os items tem 2 datas:
--   `prazo`          = quando o post vai pro Instagram (data de postagem)
--   `prazo_producao` = deadline interno pro designer entregar a arte
--                      (auto-calculado pela migration 016/048 em lotes)
--
-- Pro setor de PRODUCAO SM, o que importa eh `prazo_producao` — a data
-- em que a ultima arte precisa estar entregue. `prazo` (postagem) eh
-- alguns dias depois de `prazo_producao`.
--
-- Fix:
--   1) Funcao recalcular_prazo_planejamento_sm() -> usa prazo_producao
--   2) Trigger -> detecta mudanca em prazo_producao (nao em prazo)
--   3) Backfill pra alinhar todos os planejamentos existentes
--
-- Idempotente.
-- =========================================================
begin;

-- 1) Funcao corrigida
create or replace function recalcular_prazo_planejamento_sm(p_planejamento_id uuid)
returns void
language plpgsql
as $$
begin
  update producoes_social_media
     set prazo = (
       select max(i.prazo_producao)
         from producoes_social_media_items i
        where i.producao_id = p_planejamento_id
     )
   where id = p_planejamento_id;
end;
$$;

-- 2) Trigger corrigido — reage a mudancas em prazo_producao (o prazo de
--    postagem `prazo` pode mudar sem afetar a entrega da producao).
create or replace function trg_recalc_prazo_planejamento_sm()
returns trigger
language plpgsql
as $$
declare
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := old.producao_id;
  else
    target_id := new.producao_id;
  end if;

  -- Skip se prazo_producao nao mudou (e producao_id nao mudou)
  if tg_op = 'UPDATE'
     and new.prazo_producao is not distinct from old.prazo_producao
     and new.producao_id is not distinct from old.producao_id then
    return null;
  end if;

  perform recalcular_prazo_planejamento_sm(target_id);

  -- Se moveu item de um planejamento pra outro, recalcula o antigo tambem
  if tg_op = 'UPDATE' and new.producao_id is distinct from old.producao_id then
    perform recalcular_prazo_planejamento_sm(old.producao_id);
  end if;

  return null;
end;
$$;

-- Trigger ja existe (migration 063) com esse nome, so re-registrando por
-- seguranca. Sem AFTER, a re-attach nao muda nada — mas garante que o
-- novo corpo esta em vigor.
drop trigger if exists recalc_prazo_planejamento_sm on producoes_social_media_items;
create trigger recalc_prazo_planejamento_sm
  after insert or update or delete on producoes_social_media_items
  for each row
  execute function trg_recalc_prazo_planejamento_sm();

-- 3) Backfill: aplica em todos os planejamentos existentes
update producoes_social_media p
   set prazo = sub.max_pp
  from (
    select producao_id, max(prazo_producao) as max_pp
      from producoes_social_media_items
     where prazo_producao is not null
     group by producao_id
  ) sub
 where p.id = sub.producao_id
   and (p.prazo is distinct from sub.max_pp);

-- Planejamentos sem items com prazo_producao -> prazo = NULL
update producoes_social_media p
   set prazo = null
 where p.prazo is not null
   and not exists (
     select 1
       from producoes_social_media_items i
      where i.producao_id = p.id
        and i.prazo_producao is not null
   );

commit;

-- =========================================================
-- Conferencia:
--   select p.id, p.titulo, p.prazo,
--          (select max(i.prazo_producao) from producoes_social_media_items i where i.producao_id = p.id) as max_prazo_producao
--     from producoes_social_media p
--    where p.prazo is distinct from
--          (select max(i.prazo_producao) from producoes_social_media_items i where i.producao_id = p.id);
--   -- Deve retornar ZERO rows.
-- =========================================================
