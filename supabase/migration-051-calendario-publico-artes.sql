-- =========================================================
-- Migration 051 — Anexa as artes prontas no calendário público
-- =========================================================
-- Quando um item de social media chega ao status 'conclusao' (arte
-- pronta) ou já foi publicado, o link público do calendário passa a
-- expor tambem `artes_prontas` (array de URLs das imagens/videos).
-- Assim o cliente consegue ver a arte final direto no calendário
-- compartilhado, sem precisar de outro canal.
--
-- Segurança:
--   - Items em rascunho (pendente/design/em_aprovacao/alteracao) NÃO
--     expõem `artes_prontas` — retorna array vazio. Só o texto/data.
--   - Cliente arquivado, planejamento não-aprovado, item sem prazo
--     continuam bloqueados (regra da migration 050).
--
-- Idempotente — só reescreve a função. Cliente/tabela intactos.
-- =========================================================
begin;

-- Precisa dropar antes: adicionar coluna no RETURNS TABLE muda a assinatura
-- e o Postgres não deixa CREATE OR REPLACE alterar retorno de função existente.
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
    -- Expor artes SOMENTE quando concluído ou publicado. Rascunho fica
    -- vazio pra não vazar arte incompleta antes da aprovação interna.
    case
      when i.status::text = 'conclusao' or i.publicado_em is not null
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
