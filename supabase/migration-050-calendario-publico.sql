-- =========================================================
-- Migration 050 — Calendário público do cliente (link compartilhável)
-- =========================================================
-- Objetivo: permitir gerar um link que o CLIENTE (fora do sistema) pode
-- acessar pra acompanhar as postagens dele no calendário — só leitura,
-- sem precisar de login.
--
-- Modelo:
--   1. Coluna `calendario_publico_token` em `clientes` (uuid gerado sob
--      demanda). Só quem tem o token consegue ver o calendário do cliente.
--   2. RPC pública `get_calendario_publico(token)` que retorna os items
--      social_media do cliente, marcando cada um como "publicado" ou
--      "programado". Usa SECURITY DEFINER pra ignorar RLS — mas filtra
--      pelo token, então só quem tem o link certo vê os dados.
--   3. Grant pra `anon` role — permite chamada sem autenticação.
--
-- Segurança:
--   - Token é UUID (versão 4, 122 bits de entropia) — não dá pra chutar
--   - Se o cliente quiser revogar o link, basta gerar um novo token
--     (invalida o anterior automaticamente)
--   - Retorna SOMENTE dados de calendário do cliente daquele token —
--     não vaza nada de outros clientes
-- =========================================================
begin;

-- 1) Coluna do token
alter table clientes
  add column if not exists calendario_publico_token text;

create unique index if not exists idx_clientes_calendario_publico_token
  on clientes(calendario_publico_token)
  where calendario_publico_token is not null;

-- 2) RPC pra gerar/regenerar o token (chamada pelo painel interno).
--    Retorna o token novo — reset invalida qualquer link anterior.
create or replace function gerar_token_calendario_publico(p_cliente_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_novo text;
begin
  v_novo := gen_random_uuid()::text;
  update clientes
     set calendario_publico_token = v_novo
   where id = p_cliente_id;
  return v_novo;
end;
$$;

grant execute on function gerar_token_calendario_publico(uuid) to authenticated;

-- 3) RPC pública pra ler o calendário — recebe o token, retorna os items.
--    SECURITY DEFINER = bypassa RLS (senão anon não veria nada).
--    O filtro por token garante que só quem tem o link certo pega os dados.
create or replace function get_calendario_publico(p_token text)
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
  publicado_url       text
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
    i.publicado_url       as publicado_url
    from clientes c
    join producoes_social_media p on p.cliente_id = c.id
    join producoes_social_media_items i on i.producao_id = p.id
   where c.calendario_publico_token = p_token
     and c.calendario_publico_token is not null
     and c.arquivado_em is null       -- cliente ativo
     and p.aprovado_em is not null    -- só planejamentos aprovados pelo cliente
     and i.prazo is not null          -- só posts com data
   order by i.prazo asc, i.ordem asc;
$$;

grant execute on function get_calendario_publico(text) to anon, authenticated;

commit;
