-- =========================================================
-- Migration 073 — Auto-provisionar edicoes_video ao aprovar planejamento
-- =========================================================
-- Quando um planejamento social e aprovado (producoes_social_media.
-- aprovado_em vai de NULL pra timestamp), todos os items de formato
-- 'reel' desse planejamento agora criam AUTOMATICAMENTE uma entrada
-- correspondente em edicoes_video — a esteira do editor.
--
-- Motivacao: hoje o time faz isso na mao. Toda vez que aprova o
-- planejamento, alguem precisa abrir a esteira de video e cadastrar
-- cada reel um por um. Como o titulo, a data de postagem e a ideia
-- ja existem no item, faz sentido derivar automatico.
--
-- Fluxo depois desta migration:
--   1. Cliente aprova planejamento (marca aprovado_em)
--   2. Trigger dispara pra cada reel do planejamento
--   3. edicoes_video ganha as entradas com:
--        - titulo   = titulo do item
--        - briefing = "Reel N/Total · Postagem: DD/MM/YYYY" + ideia
--        - cliente_id = do planejamento
--        - social_media_item_id = FK pro item (novo campo)
--        - status = 'pendente' (o editor pega dai)
--        - responsavel_id = NULL (o head atribui)
--   4. Social media responsavel sobe o arquivo bruto na coluna
--      arquivos[] da edicao (isso e' UI existente — nao muda nada)
--
-- Idempotencia:
--   - Nova coluna social_media_item_id + UNIQUE INDEX parcial garante
--     que aprovar o mesmo planejamento 2x nao cria duplicata
--   - Re-aprovacao (aprovado_em passa por NULL e volta) tambem nao
--     duplica (ON CONFLICT DO NOTHING no INSERT)
--
-- Reversao segura: apagar o item de social media so seta a FK pra
-- NULL na edicao (ON DELETE SET NULL) — nao apaga o trabalho do
-- editor que ja possa estar em andamento.
-- =========================================================
begin;

-- 1) Nova coluna FK — rastreia qual reel originou a edicao
alter table edicoes_video
  add column if not exists social_media_item_id uuid
    references producoes_social_media_items(id) on delete set null;

comment on column edicoes_video.social_media_item_id is
  'FK opcional pro item de producao_social_media que originou esta edicao (formato=reel). Criado automaticamente ao aprovar o planejamento. NULL pra edicoes avulsas cadastradas na mao.';

-- Index unico parcial — impede duplicata pra o mesmo item, mas
-- permite varias edicoes com social_media_item_id = NULL (as avulsas).
create unique index if not exists uniq_edicoes_video_social_item
  on edicoes_video(social_media_item_id)
  where social_media_item_id is not null;

-- 2) Funcao que provisiona edicoes pra todos os reels de um planejamento.
--    Chamada pelo trigger de aprovacao — poderia tambem ser chamada
--    manualmente via RPC se precisar "reprocessar" um planejamento
--    antigo (idempotente via ON CONFLICT).
create or replace function provisionar_edicoes_video_do_planejamento(
  p_producao_id uuid
) returns int
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_total_reels int;
  v_inserted int := 0;
  v_rec record;
  v_contador int := 0;
begin
  -- Cliente da producao (pra vincular a edicao)
  select cliente_id into v_cliente_id
    from producoes_social_media
   where id = p_producao_id;
  if v_cliente_id is null then
    return 0;
  end if;

  -- Total de reels desse planejamento — vai no titulo do briefing
  -- ("Reel 2/4")
  select count(*) into v_total_reels
    from producoes_social_media_items
   where producao_id = p_producao_id
     and formato = 'reel';
  if v_total_reels = 0 then
    return 0;
  end if;

  -- Itera os reels em ordem estavel — pra o "N/Total" bater com a
  -- ordem visivel do planejamento no admin
  for v_rec in
    select id, titulo, ideia_conteudo, prazo
      from producoes_social_media_items
     where producao_id = p_producao_id
       and formato = 'reel'
     order by ordem asc, created_at asc
  loop
    v_contador := v_contador + 1;

    insert into edicoes_video (
      cliente_id,
      titulo,
      status,
      briefing,
      social_media_item_id
    ) values (
      v_cliente_id,
      coalesce(nullif(trim(v_rec.titulo), ''), 'Reel sem título'),
      'pendente',
      format(
        E'Reel %s/%s%s%s',
        v_contador,
        v_total_reels,
        case when v_rec.prazo is not null
             then E' · Postagem prevista: ' || to_char(v_rec.prazo, 'DD/MM/YYYY')
             else ''
        end,
        case when v_rec.ideia_conteudo is not null and trim(v_rec.ideia_conteudo) <> ''
             then E'\n\n' || v_rec.ideia_conteudo
             else ''
        end
      ),
      v_rec.id
    )
    on conflict (social_media_item_id) where social_media_item_id is not null
      do nothing;

    -- Ganha 1 inserido se de fato criou linha
    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

comment on function provisionar_edicoes_video_do_planejamento(uuid) is
  'Cria uma edicao_video pra cada reel de um planejamento aprovado. Idempotente — rodar 2x nao duplica.';

-- 3) Trigger de aprovacao — dispara quando aprovado_em muda de NULL
--    pra qualquer coisa nao-NULL. Reversao pra NULL (desaprovar) nao
--    faz nada, e re-aprovacao subsequente tambem nao duplica.
create or replace function trg_producao_aprovada_provisiona_edicoes()
returns trigger
language plpgsql
as $$
begin
  if new.aprovado_em is not null
     and (old.aprovado_em is null or old.aprovado_em is distinct from new.aprovado_em)
  then
    perform provisionar_edicoes_video_do_planejamento(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists producao_aprovada_provisiona_edicoes on producoes_social_media;
create trigger producao_aprovada_provisiona_edicoes
  after update of aprovado_em on producoes_social_media
  for each row
  execute function trg_producao_aprovada_provisiona_edicoes();

commit;
