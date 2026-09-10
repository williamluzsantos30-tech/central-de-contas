-- =========================================================
-- Migration 075 — Categoria Backlog no planejamento social
-- =========================================================
-- Backlog = conteudos estaticos organizados como reserva pra publicar
-- caso o cliente nao grave os videos alinhados. Fica na aba de
-- Planejamento junto das seções Carrosséis / Estáticos / Reels, mas
-- separado — nao entra na esteira de producao ate ser "ativado"
-- (flag removido + prazo definido).
--
-- Regras:
--   - is_backlog default false — o comportamento de tudo que ja existe
--     nao muda
--   - Item de backlog NAO aparece no link publico do calendario
--     (filtro na RPC), mesmo que tenha prazo. Backlog e' operacao
--     interna do time, cliente nunca ve
--   - Item de backlog CONTINUA na tabela producoes_social_media_items,
--     mantendo mesma estrutura de status/copy/legenda/artes. Assim
--     quando ativa (is_backlog=false + prazo definido), vira post
--     normal na hora, sem precisar mover/copiar
--
-- Idempotente — add column IF NOT EXISTS + drop/create RPC.
-- =========================================================
begin;

alter table producoes_social_media_items
  add column if not exists is_backlog boolean not null default false;

comment on column producoes_social_media_items.is_backlog is
  'Item de backlog — conteudo estatico organizado como reserva pra publicar caso o cliente nao grave os videos alinhados. Nao aparece no calendario nem no link publico. Vira post normal quando o time desativa o flag e define prazo.';

-- Index parcial pra a query "todos backlog do planejamento" ser rapida.
-- Nao vale index full porque a maioria dos items e is_backlog=false.
create index if not exists idx_producoes_social_media_items_backlog
  on producoes_social_media_items (producao_id)
  where is_backlog = true;

-- Atualiza a RPC publica pra filtrar backlog. Reescreve mantendo
-- todos os campos das versoes anteriores (072 = link_drive_video).
drop function if exists get_calendario_publico(text);

create function get_calendario_publico(p_token text)
returns table (
  cliente_nome        text,
  cliente_id          uuid,
  cliente_instagram   text,
  item_id             uuid,
  formato             text,
  titulo              text,
  ideia_conteudo      text,
  legenda             text,
  status              text,
  prazo               date,
  publicado_em        timestamptz,
  publicado_url       text,
  artes_prontas       jsonb,
  link_drive_video    text
)
language sql
security definer
stable
as $$
  select
    c.nome                as cliente_nome,
    c.id                  as cliente_id,
    c.instagram_handle    as cliente_instagram,
    i.id                  as item_id,
    i.formato::text       as formato,
    i.titulo              as titulo,
    i.ideia_conteudo      as ideia_conteudo,
    case
      when i.status::text in ('em_aprovacao', 'conclusao') or i.publicado_em is not null
        then i.legenda
      else null
    end                   as legenda,
    i.status::text        as status,
    i.prazo               as prazo,
    i.publicado_em        as publicado_em,
    i.publicado_url       as publicado_url,
    case
      when i.status::text in ('em_aprovacao', 'conclusao') or i.publicado_em is not null
        then coalesce(i.artes_prontas, '[]'::jsonb)
      else '[]'::jsonb
    end                   as artes_prontas,
    case
      when i.formato::text = 'reel'
       and (i.status::text in ('em_aprovacao', 'conclusao') or i.publicado_em is not null)
        then i.link_drive_video
      else null
    end                   as link_drive_video
    from clientes c
    join producoes_social_media p on p.cliente_id = c.id
    join producoes_social_media_items i on i.producao_id = p.id
   where c.calendario_publico_token = p_token
     and c.calendario_publico_token is not null
     and c.arquivado_em is null
     and p.aprovado_em is not null
     and i.prazo is not null
     and coalesce(i.is_backlog, false) = false  -- <- filtro backlog
   order by i.prazo asc, i.ordem asc;
$$;

grant execute on function get_calendario_publico(text) to anon, authenticated;

commit;
