-- =========================================================
-- Migration 049 — Alteração estende prazo_producao em 1 dia útil
-- =========================================================
-- Quando o status de um item muda PARA 'alteracao', o designer precisa
-- de tempo extra pra fazer as alterações solicitadas. Regra:
--
--   prazo_producao := hoje + 1 dia útil (segunda-sexta)
--
-- Implementado com um trigger BEFORE UPDATE OF status que só dispara na
-- TRANSIÇÃO pra 'alteracao' (status anterior diferente). Sem o filtro
-- da transição, qualquer update do item já em alteração ficaria empurrando
-- o prazo dia após dia.
--
-- Reaproveita o helper add_business_days() criado na migration 016.
--
-- Coexistência com outros triggers:
--   - trg_recalc_prazos_on_item_change (016/048) é AFTER UPDATE e só
--     dispara quando ordem/prazo/producao_id mudam — não em status.
--     Então a mudança de prazo_producao feita aqui NÃO é sobrescrita.
--
-- Idempotente.
-- =========================================================
begin;

create or replace function trg_alteracao_estende_prazo()
returns trigger
language plpgsql
as $$
begin
  -- Só estende quando status FAZ TRANSIÇÃO pra 'alteracao'
  -- (de qualquer outro valor anterior). Se já estava em 'alteracao' e
  -- só está fazendo UPDATE de outro campo, não mexe no prazo de novo.
  if new.status::text = 'alteracao'
     and (old.status is null or old.status::text <> 'alteracao') then
    new.prazo_producao := add_business_days(current_date, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists alteracao_estende_prazo on producoes_social_media_items;
create trigger alteracao_estende_prazo
  before update of status on producoes_social_media_items
  for each row
  execute function trg_alteracao_estende_prazo();

commit;

-- Confirmação: lista items em alteração atual com seu prazo_producao
select id, titulo, status, prazo_producao
  from producoes_social_media_items
 where status::text = 'alteracao'
 order by prazo_producao desc nulls last
 limit 10;
