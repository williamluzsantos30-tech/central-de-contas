-- =========================================================
-- Limpeza: remove URLs `blob:` mortas do banco (jsonb-correct)
-- =========================================================
-- Antes do fix de Storage (migration 006), o frontend salvava
-- arquivos como `blob:https://...` no banco. Essas URLs eram
-- apontadores de memória da aba do navegador — quando a aba
-- fechou, o arquivo morreu mas a URL ficou no Postgres.
--
-- Este script zera essas URLs mortas pra que a UI pare de
-- exibir arquivos quebrados. Os arquivos em si NÃO são
-- recuperáveis — você precisa fazer upload de novo.
--
-- Nota: a migration 007 já faz essa limpeza E impede gravação
-- futura. Este script é redundante se a 007 foi aplicada,
-- mas é seguro rodar de novo.
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- =========================================================

-- Helper: dado um jsonb array de strings, devolve o mesmo array
-- sem os elementos que começam com 'blob:'.
create or replace function public.jsonb_strip_blob(arr jsonb)
returns jsonb as $$
  select coalesce(
    (select jsonb_agg(x) from jsonb_array_elements_text(arr) x where x not like 'blob:%'),
    '[]'::jsonb
  )
$$ language sql immutable;

begin;

-- 1) projetos_webdesign — escalares + jsonb fotos
update projetos_webdesign
   set briefing_pdf_url      = case when briefing_pdf_url      like 'blob:%' then null else briefing_pdf_url end,
       identidade_visual_url = case when identidade_visual_url like 'blob:%' then null else identidade_visual_url end,
       copy_arquivo_url      = case when copy_arquivo_url      like 'blob:%' then null else copy_arquivo_url end,
       url_producao          = case when url_producao          like 'blob:%' then null else url_producao end,
       fotos                 = case when fotos is null then null
                                    else public.jsonb_strip_blob(fotos)
                               end
 where briefing_pdf_url      like 'blob:%'
    or identidade_visual_url like 'blob:%'
    or copy_arquivo_url      like 'blob:%'
    or url_producao          like 'blob:%'
    or exists(select 1 from jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%');

-- 2) criativos_webdesign — escalares + jsonb fotos
update criativos_webdesign
   set url_criativo          = case when url_criativo          like 'blob:%' then null else url_criativo end,
       identidade_visual_url = case when identidade_visual_url like 'blob:%' then null else identidade_visual_url end,
       copy_arquivo_url      = case when copy_arquivo_url      like 'blob:%' then null else copy_arquivo_url end,
       fotos                 = case when fotos is null then null
                                    else public.jsonb_strip_blob(fotos)
                               end
 where url_criativo          like 'blob:%'
    or identidade_visual_url like 'blob:%'
    or copy_arquivo_url      like 'blob:%'
    or exists(select 1 from jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%');

-- 3) producoes_social_media — escalar + jsonb referencias
update producoes_social_media
   set briefing_pdf_url = case when briefing_pdf_url like 'blob:%' then null else briefing_pdf_url end,
       referencias      = case when referencias is null then null
                               else public.jsonb_strip_blob(referencias)
                          end
 where briefing_pdf_url like 'blob:%'
    or exists(select 1 from jsonb_array_elements_text(coalesce(referencias, '[]'::jsonb)) x where x like 'blob:%');

-- 4) producoes_social_media_items — escalar + jsonb artes_prontas
update producoes_social_media_items
   set copy_arquivo_url = case when copy_arquivo_url like 'blob:%' then null else copy_arquivo_url end,
       artes_prontas    = case when artes_prontas is null then null
                               else public.jsonb_strip_blob(artes_prontas)
                          end
 where copy_arquivo_url like 'blob:%'
    or exists(select 1 from jsonb_array_elements_text(coalesce(artes_prontas, '[]'::jsonb)) x where x like 'blob:%');

-- 5) criacoes — anexos é jsonb com objetos {url, nome, tipo, tamanho}
update criacoes
   set anexos = (
     select coalesce(jsonb_agg(a), '[]'::jsonb)
       from jsonb_array_elements(anexos) a
      where (a->>'url') is null
         or (a->>'url') not like 'blob:%'
   )
 where anexos is not null
   and exists (select 1 from jsonb_array_elements(anexos) a where (a->>'url') like 'blob:%');

commit;

-- 6) Confirmação: deve retornar 0 em todas as linhas
select 'projetos.briefing_pdf'      as origem, count(*) as registros from projetos_webdesign      where briefing_pdf_url     like 'blob:%'
union all select 'projetos.identidade',         count(*) from projetos_webdesign      where identidade_visual_url like 'blob:%'
union all select 'projetos.copy',               count(*) from projetos_webdesign      where copy_arquivo_url     like 'blob:%'
union all select 'projetos.url_producao',       count(*) from projetos_webdesign      where url_producao         like 'blob:%'
union all select 'projetos.fotos[]',            count(*) from projetos_webdesign,      lateral jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%'
union all select 'criativos.identidade',        count(*) from criativos_webdesign     where identidade_visual_url like 'blob:%'
union all select 'criativos.copy',              count(*) from criativos_webdesign     where copy_arquivo_url     like 'blob:%'
union all select 'criativos.url_criativo',      count(*) from criativos_webdesign     where url_criativo         like 'blob:%'
union all select 'criativos.fotos[]',           count(*) from criativos_webdesign,     lateral jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%'
union all select 'sm.briefing',                 count(*) from producoes_social_media  where briefing_pdf_url     like 'blob:%'
union all select 'sm.referencias[]',            count(*) from producoes_social_media,  lateral jsonb_array_elements_text(coalesce(referencias, '[]'::jsonb)) x where x like 'blob:%'
union all select 'sm_item.copy',                count(*) from producoes_social_media_items where copy_arquivo_url like 'blob:%'
union all select 'sm_item.artes[]',             count(*) from producoes_social_media_items, lateral jsonb_array_elements_text(coalesce(artes_prontas, '[]'::jsonb)) x where x like 'blob:%'
order by registros desc, origem;
