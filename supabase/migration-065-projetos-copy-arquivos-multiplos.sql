-- =========================================================
-- Migration 065 — projetos_webdesign: multiplos arquivos de copy
-- =========================================================
-- Antes: 1 unico arquivo de copy por projeto (coluna copy_arquivo_url text).
-- Agora: array de arquivos (coluna copy_arquivos jsonb array de strings),
-- pra permitir mais de 1 PDF/DOC quando o cliente entrega em partes.
--
-- Estrategia:
--   - Adiciona copy_arquivos jsonb default '[]'
--   - Backfill: cada projeto com copy_arquivo_url nao-null vira array com 1 item
--   - Anti-blob trigger (migration 007) extendido pra tambem filtrar
--     blob: URLs de copy_arquivos
--   - copy_arquivo_url NAO eh removido (backward compat pro caso de codigo
--     legacy ainda referenciar; frontend usa so copy_arquivos daqui pra
--     frente)
--
-- Idempotente.
-- =========================================================
begin;

-- 1) Nova coluna array
alter table projetos_webdesign
  add column if not exists copy_arquivos jsonb not null default '[]'::jsonb;

comment on column projetos_webdesign.copy_arquivos is
  'Array de URLs de arquivos de copy (PDFs/DOCs). Substitui copy_arquivo_url no frontend a partir da migration 065. Copy_arquivo_url mantido pra backward compat.';

-- 2) Backfill: converte copy_arquivo_url unico em array com 1 item
update projetos_webdesign
   set copy_arquivos = jsonb_build_array(copy_arquivo_url)
 where copy_arquivo_url is not null
   and copy_arquivo_url <> ''
   and not copy_arquivo_url like 'blob:%'
   and (copy_arquivos is null or copy_arquivos = '[]'::jsonb);

-- 3) Extende anti-blob trigger pra tambem cobrir copy_arquivos.
--    Reescreve a funcao mantendo o comportamento antigo pros outros campos.
create or replace function public.strip_blob_urls_projetos()
returns trigger as $$
begin
  if new.briefing_pdf_url      like 'blob:%' then new.briefing_pdf_url      := null; end if;
  if new.identidade_visual_url like 'blob:%' then new.identidade_visual_url := null; end if;
  if new.copy_arquivo_url      like 'blob:%' then new.copy_arquivo_url      := null; end if;
  if new.url_producao          like 'blob:%' then new.url_producao          := null; end if;
  if new.fotos is not null then
    new.fotos := public.jsonb_strip_blob(new.fotos);
  end if;
  -- Novo: copy_arquivos (array de URLs)
  if new.copy_arquivos is not null then
    new.copy_arquivos := public.jsonb_strip_blob(new.copy_arquivos);
  end if;
  return new;
end;
$$ language plpgsql;

-- Trigger ja existe (migration 007), so garantindo que o corpo novo esta em vigor.
-- create or replace atualiza a funcao; trigger nao precisa ser recriado.

-- 4) Limpa blob URLs de copy_arquivos que ja possam ter escapado
update projetos_webdesign
   set copy_arquivos = public.jsonb_strip_blob(copy_arquivos)
 where copy_arquivos is not null
   and exists (
     select 1 from jsonb_array_elements_text(copy_arquivos) x where x like 'blob:%'
   );

commit;

-- =========================================================
-- Conferencia:
--   select id, titulo, copy_arquivo_url, copy_arquivos
--     from projetos_webdesign
--    where copy_arquivo_url is not null
--    limit 20;
--   -- copy_arquivos deve ter 1 item batendo com copy_arquivo_url
-- =========================================================
