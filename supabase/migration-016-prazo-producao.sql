-- =========================================================
-- Migration 016 — Separar "data de postagem" de "prazo de produção"
-- =========================================================
-- Hoje cada item de produção tem 1 campo só: `prazo` (= data de postagem).
-- Mas a equipe de produção precisa ver o prazo DELES (até quando entregar
-- a arte pro cliente aprovar), não a data em que o post vai pro Instagram.
--
-- Regra do prazo de produção:
--   • Conta a partir de `producoes_social_media.aprovado_em`
--   • 3 dias úteis para cada lote de 3 posts (ordem ASC)
--   • Posts 1-3  → aprovado_em + 3 dias úteis
--   • Posts 4-6  → aprovado_em + 6 dias úteis
--   • Posts 7-9  → aprovado_em + 9 dias úteis
--   • ...e assim por diante
--
-- Idempotente — pode rodar quantas vezes quiser.
-- =========================================================

-- 1) Coluna nova
alter table producoes_social_media_items
  add column if not exists prazo_producao date;

comment on column producoes_social_media_items.prazo_producao is
  'Deadline da arte (designer). Auto-calculado a partir de aprovado_em do planejamento usando lotes de 3 posts × 3 dias úteis. Diferente de `prazo`, que é a data de postagem no Instagram.';

-- 2) Helper: soma N dias úteis (pula sábado/domingo) a uma data
create or replace function add_business_days(start_date date, n int)
returns date
language plpgsql
immutable
as $$
declare
  d date := start_date;
  added int := 0;
begin
  if start_date is null or n is null then
    return null;
  end if;
  while added < n loop
    d := d + 1;
    -- extract(dow) → 0=domingo, 6=sábado
    if extract(dow from d) not in (0, 6) then
      added := added + 1;
    end if;
  end loop;
  return d;
end;
$$;

-- 3) Função: recalcula prazo_producao de TODOS os items de um planejamento
create or replace function recalcular_prazos_producao(p_producao_id uuid)
returns void
language plpgsql
as $$
declare
  v_aprovado_em timestamptz;
begin
  -- Pega a data de aprovação do planejamento
  select aprovado_em into v_aprovado_em
  from producoes_social_media
  where id = p_producao_id;

  if v_aprovado_em is null then
    -- Não aprovado ainda → limpa qualquer prazo_producao existente
    update producoes_social_media_items
       set prazo_producao = null
     where producao_id = p_producao_id;
    return;
  end if;

  -- Atualiza cada item: lote = ceil(posicao/3), prazo = aprovado + 3*lote dias úteis
  with itens_ordenados as (
    select id,
           row_number() over (order by ordem asc, created_at asc) as posicao
      from producoes_social_media_items
     where producao_id = p_producao_id
  )
  update producoes_social_media_items i
     set prazo_producao = add_business_days(
           v_aprovado_em::date,
           ceil(io.posicao::numeric / 3)::int * 3
         )
    from itens_ordenados io
   where i.id = io.id;
end;
$$;

-- 4) Trigger no planejamento: se aprovado_em mudou, recalcula tudo
create or replace function trg_recalc_prazos_on_aprovacao()
returns trigger
language plpgsql
as $$
begin
  if new.aprovado_em is distinct from old.aprovado_em then
    perform recalcular_prazos_producao(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists recalc_prazos_on_aprovacao on producoes_social_media;
create trigger recalc_prazos_on_aprovacao
  after update of aprovado_em on producoes_social_media
  for each row
  execute function trg_recalc_prazos_on_aprovacao();

-- 5) Trigger nos items: se a ordem mudou ou foi inserido novo item,
--    recalcula o planejamento inteiro (afeta posição dos demais)
create or replace function trg_recalc_prazos_on_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform recalcular_prazos_producao(new.producao_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.ordem is distinct from old.ordem or new.producao_id is distinct from old.producao_id then
      perform recalcular_prazos_producao(new.producao_id);
      if new.producao_id is distinct from old.producao_id then
        perform recalcular_prazos_producao(old.producao_id);
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform recalcular_prazos_producao(old.producao_id);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists recalc_prazos_on_item_change on producoes_social_media_items;
create trigger recalc_prazos_on_item_change
  after insert or update or delete on producoes_social_media_items
  for each row
  execute function trg_recalc_prazos_on_item_change();

-- 6) Backfill: recalcula tudo agora pra planejamentos já aprovados
do $$
declare
  r record;
begin
  for r in select id from producoes_social_media where aprovado_em is not null loop
    perform recalcular_prazos_producao(r.id);
  end loop;
end$$;

-- 7) Confirmação
select
  count(*) filter (where prazo_producao is not null) as com_prazo_producao,
  count(*) filter (where prazo_producao is null)     as sem_prazo_producao,
  count(*) as total
from producoes_social_media_items;
