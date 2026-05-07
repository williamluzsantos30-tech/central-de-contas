-- =========================================================
-- DIAGNÓSTICO: quantas URLs `blob:` ainda existem no banco?
-- =========================================================
-- Roda este SQL no Supabase pra ver, por tabela e coluna,
-- quantos registros ainda têm URLs mortas tipo
-- `blob:https://shimmering-hamster-bc5f2e.netlify.app/...`.
--
-- Se a migration 007 já foi rodada (que faz limpeza one-shot
-- + bloqueia gravação futura), todas as contagens devem ser
-- ZERO. Se aparecer algo > 0, alguém com cache antigo gravou
-- depois da migration, ou a migration ainda não rodou.
--
-- Nota: as colunas `fotos`, `referencias` e `artes_prontas`
-- são `jsonb` no Supabase (não text[]). Por isso usamos
-- jsonb_array_elements_text() em vez de unnest().
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- =========================================================

select 'projetos.briefing_pdf'      as origem, count(*) as registros from projetos_webdesign      where briefing_pdf_url     like 'blob:%'
union all select 'projetos.identidade',         count(*) from projetos_webdesign      where identidade_visual_url like 'blob:%'
union all select 'projetos.copy',               count(*) from projetos_webdesign      where copy_arquivo_url     like 'blob:%'
union all select 'projetos.url_producao',       count(*) from projetos_webdesign      where url_producao         like 'blob:%'
union all select 'projetos.fotos[]',            count(*) from projetos_webdesign,      lateral jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%'

union all select 'criativos.url_criativo',      count(*) from criativos_webdesign     where url_criativo         like 'blob:%'
union all select 'criativos.identidade',        count(*) from criativos_webdesign     where identidade_visual_url like 'blob:%'
union all select 'criativos.copy',              count(*) from criativos_webdesign     where copy_arquivo_url     like 'blob:%'
union all select 'criativos.fotos[]',           count(*) from criativos_webdesign,     lateral jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%'

union all select 'sm.briefing',                 count(*) from producoes_social_media  where briefing_pdf_url     like 'blob:%'
union all select 'sm.referencias[]',            count(*) from producoes_social_media,  lateral jsonb_array_elements_text(coalesce(referencias, '[]'::jsonb)) x where x like 'blob:%'

union all select 'sm_item.copy',                count(*) from producoes_social_media_items where copy_arquivo_url like 'blob:%'
union all select 'sm_item.artes[]',             count(*) from producoes_social_media_items, lateral jsonb_array_elements_text(coalesce(artes_prontas, '[]'::jsonb)) x where x like 'blob:%'

union all select 'criacoes.anexos[]',           count(*) from criacoes,                lateral jsonb_array_elements(coalesce(anexos, '[]'::jsonb)) a where (a->>'url') like 'blob:%'
order by registros desc, origem;
