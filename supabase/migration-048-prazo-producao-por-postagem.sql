-- =========================================================
-- Migration 048 — prazo_producao prioriza data de POSTAGEM
-- =========================================================
-- Bug: a função recalcular_prazos_producao (definida nas migrations 016
-- e 017) ordenava os items por `ordem ASC, created_at ASC` pra atribuir
-- os lotes de 3 posts × 3 dias úteis. Mas `ordem` reflete a sequência
-- em que o social media digitou os posts no planejamento (geralmente
-- agrupados por formato — primeiro carrosséis, depois estáticos, depois
-- reels), não a ordem cronológica de POSTAGEM.
--
-- Resultado: o `prazo_producao` saía agrupado por formato. Items que
-- deveriam ir pro ar mais cedo ficavam no fim da fila de produção.
--
-- Fix: trocar o critério principal de ordenação pra `prazo ASC NULLS LAST`,
-- mantendo `ordem` e `created_at` apenas como desempate.
--
-- Idempotente. Inclui backfill em todos os planejamentos existentes.
-- =========================================================
begin;

-- 1) Reescreve a função: ordena por prazo (data de postagem) ASC
create or replace function recalcular_prazos_producao(p_producao_id uuid)
returns void
language plpgsql
as $$
declare
  v_ref_date date;
begin
  -- Pega aprovado_em (preferência) ou created_at (fallback) — mantém
  -- o fix da migration 017.
  select coalesce(aprovado_em::date, created_at::date)
    into v_ref_date
   from producoes_social_media
  where id = p_producao_id;

  if v_ref_date is null then
    return;
  end if;

  -- ⭐ AGORA ORDENA POR DATA DE POSTAGEM (prazo).
  -- Posts sem prazo definido vão pro fim da fila (NULLS LAST) e usam
  -- o `ordem` como desempate (mantém uma sequência estável).
  --
  -- Lote = ceil(posicao / 3); cada lote ganha +3 dias úteis em cima do
  -- lote anterior (3 posts produzidos por bloco de 3 dias úteis).
  with itens_ordenados as (
    select id,
           row_number() over (
             order by prazo asc nulls last,
                      ordem asc,
                      created_at asc
           ) as posicao
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

-- 2) Estende o trigger de mudança de item: recalcula também quando o
--    `prazo` (data de postagem) muda. Antes só observava `ordem` —
--    agora que a ordenação é por `prazo`, precisa reagir a mudanças nele.
create or replace function trg_recalc_prazos_on_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform recalcular_prazos_producao(new.producao_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.ordem is distinct from old.ordem
       or new.prazo is distinct from old.prazo
       or new.producao_id is distinct from old.producao_id then
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

-- 3) Backfill: recalcula prazo_producao de TODOS os planejamentos
--    com a nova regra. Sem isso os planejamentos antigos continuariam
--    com prazos calculados pela regra errada.
do $$
declare
  r record;
begin
  for r in select id from producoes_social_media loop
    perform recalcular_prazos_producao(r.id);
  end loop;
end$$;

commit;

-- 4) Confirmação visual: amostra dos prazos por planejamento
select
  p.id            as planejamento_id,
  p.titulo,
  count(i.id)     as total_items,
  min(i.prazo)    as primeira_postagem,
  max(i.prazo)    as ultima_postagem,
  min(i.prazo_producao) as primeiro_prazo_producao,
  max(i.prazo_producao) as ultimo_prazo_producao
from producoes_social_media p
join producoes_social_media_items i on i.producao_id = p.id
group by p.id, p.titulo
order by p.created_at desc
limit 10;
