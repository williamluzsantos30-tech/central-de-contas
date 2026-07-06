-- =========================================================
-- Migration 052 — Calendário público: mostra arte já em aprovação
-- =========================================================
-- Ajuste na regra da 051. Agora `artes_prontas` também aparece quando
-- o item está em status 'em_aprovacao' — não só 'conclusao'. Faz
-- sentido porque é justamente na fase de aprovação que o cliente
-- precisa VER a arte pra decidir se aprova ou pede alteração.
--
-- Lista final de estados que expõem as artes:
--   - em_aprovacao  (aguardando o cliente aprovar)
--   - conclusao     (aprovada / arte pronta)
--   - qualquer item já publicado (publicado_em setado)
--
-- Continuam bloqueados: pendente, design, design_finalizado, alteracao.
-- (Alteracao é bloqueado propositalmente — a arte antiga foi rejeitada
-- e a nova ainda está sendo feita; expor a antiga confundiria o cliente.)
--
-- Idempotente — DROP + CREATE dentro de transação.
-- =========================================================
begin;

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
