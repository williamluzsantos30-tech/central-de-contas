-- =========================================================
-- Migration 072 — Link do Drive com arquivo do video pra Reels
-- =========================================================
-- Reels/videos hoje sao entregues via artes_prontas (URLs de video
-- hospedadas no Storage). O cliente ve inline no link publico do
-- calendario.
--
-- Problema: o cliente quer poder BAIXAR o arquivo pra revisar em
-- outra plataforma, ou compartilhar internamente. O video inline
-- do <video> tag nao expoe download facil (right-click "Save as"
-- funciona mas nem todo cliente sabe), e alem disso o time ja
-- costuma manter o arquivo master no Drive.
--
-- Solucao: nova coluna `link_drive_video` em items — string opcional,
-- so relevante pra formato='reel'. Preenchido pela equipe no admin,
-- exposto no link publico como botao "Abrir arquivo no Drive".
--
-- A RPC get_calendario_publico e' atualizada pra devolver o campo
-- na mesma regra ja existente: so quando status esta em em_aprovacao
-- ou conclusao (ou ja publicado). Antes disso o link nao aparece
-- pro cliente.
--
-- Idempotente — add column IF NOT EXISTS + drop/create RPC.
-- =========================================================
begin;

alter table producoes_social_media_items
  add column if not exists link_drive_video text;

comment on column producoes_social_media_items.link_drive_video is
  'URL do arquivo do video no Drive (Google Drive, Dropbox, etc). So faz sentido pra formato=reel — usado pelo cliente pra baixar o master do video pelo link publico do calendario. Preenchido pela equipe no admin.';

-- Atualiza RPC pra expor link_drive_video. Aplica a mesma regra de
-- exposicao das outras infos sensíveis: so vaza quando o item ja esta
-- em_aprovacao/conclusao/publicado (antes disso, arte ainda ta em
-- producao).
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
    -- Link do Drive so faz sentido pra reel E so quando o item ta em
    -- exibicao pro cliente (mesma regra da legenda/artes_prontas).
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
   order by i.prazo asc, i.ordem asc;
$$;

grant execute on function get_calendario_publico(text) to anon, authenticated;

commit;
