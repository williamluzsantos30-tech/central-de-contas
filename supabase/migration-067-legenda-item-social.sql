-- =========================================================
-- Migration 067 — Legenda do post em items de social media
-- =========================================================
-- Adiciona coluna `legenda` em producoes_social_media_items pra guardar
-- o texto que vai como caption do post no Instagram (o texto que
-- aparece abaixo da arte quando publicado).
--
-- Diferente de `copy_texto`, que ja existia e serve pra copy INTERNA
-- do design (roteiro dos slides do carrossel, script do reel, etc).
--
-- copy_texto  = o que vai DENTRO da arte
-- legenda     = o que vai FORA da arte (caption do post)
--
-- Tambem atualiza a RPC get_calendario_publico pra retornar a legenda
-- junto — o cliente ve a legenda no link publico do calendario.
--
-- Idempotente.
-- =========================================================
begin;

alter table producoes_social_media_items
  add column if not exists legenda text;

comment on column producoes_social_media_items.legenda is
  'Caption do post no Instagram (texto que aparece abaixo da arte quando publicado). Diferente de copy_texto (que e o texto DENTRO da arte).';

-- Recria RPC pra incluir `legenda` no retorno. DROP + CREATE porque
-- adicionar coluna no RETURNS TABLE muda a assinatura.
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
  artes_prontas       jsonb
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
    -- Legenda so aparece quando o item ja passou pra em_aprovacao ou
    -- alem — antes disso ainda esta sendo escrita, nao expor.
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
    end                   as artes_prontas
    from clientes c
    join producoes_social_media p on p.cliente_id = c.id
    join producoes_social_media_items i on i.producao_id = p.id
   where c.calendario_publico_token = p_token
     and c.calendario_publico_token is not null
     and c.arquivado_em is null
     and p.aprovado_em is not null
     and i.prazo is not null
   order by i.prazo asc, i.ordem asc;
$$;

grant execute on function get_calendario_publico(text) to anon, authenticated;

commit;
