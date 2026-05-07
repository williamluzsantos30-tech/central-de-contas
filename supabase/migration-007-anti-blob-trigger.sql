-- =========================================================
-- Migration 007 — Triggers anti-blob no banco (jsonb-correct)
-- =========================================================
-- Por que: clientes com cache antigo do JS (que ainda usa
-- `URL.createObjectURL`) podem continuar gravando URLs `blob:%`
-- nas colunas de arquivos. Esses URLs morrem ao fechar a aba
-- e geram bug visual pra outros usuários.
--
-- Solução: triggers BEFORE INSERT/UPDATE que silenciosamente
-- substituem qualquer `blob:%` por NULL (campos escalares) ou
-- removem do array (campos jsonb).
--
-- Tabelas e colunas cobertas:
--   • criativos_webdesign: url_criativo, identidade_visual_url,
--                          copy_arquivo_url, fotos (jsonb)
--   • projetos_webdesign:  briefing_pdf_url, identidade_visual_url,
--                          copy_arquivo_url, url_producao,
--                          fotos (jsonb)
--   • producoes_social_media: briefing_pdf_url, referencias (jsonb)
--   • producoes_social_media_items: copy_arquivo_url,
--                                   artes_prontas (jsonb)
--   • criacoes: anexos (jsonb com objetos {url, ...})
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- (Idempotente.)
-- =========================================================

-- Helper genérico: dado um jsonb array de strings, devolve o mesmo
-- array sem os elementos que começam com 'blob:'.
create or replace function public.jsonb_strip_blob(arr jsonb)
returns jsonb as $$
  select coalesce(
    (select jsonb_agg(x) from jsonb_array_elements_text(arr) x where x not like 'blob:%'),
    '[]'::jsonb
  )
$$ language sql immutable;


-- 1) criativos_webdesign
create or replace function public.strip_blob_urls_criativos()
returns trigger as $$
begin
  if new.url_criativo          like 'blob:%' then new.url_criativo          := null; end if;
  if new.identidade_visual_url like 'blob:%' then new.identidade_visual_url := null; end if;
  if new.copy_arquivo_url      like 'blob:%' then new.copy_arquivo_url      := null; end if;
  if new.fotos is not null then
    new.fotos := public.jsonb_strip_blob(new.fotos);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_strip_blob_criativos on criativos_webdesign;
create trigger trg_strip_blob_criativos
  before insert or update on criativos_webdesign
  for each row execute function public.strip_blob_urls_criativos();


-- 2) projetos_webdesign
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
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_strip_blob_projetos on projetos_webdesign;
create trigger trg_strip_blob_projetos
  before insert or update on projetos_webdesign
  for each row execute function public.strip_blob_urls_projetos();


-- 3) producoes_social_media
create or replace function public.strip_blob_urls_sm()
returns trigger as $$
begin
  if new.briefing_pdf_url like 'blob:%' then new.briefing_pdf_url := null; end if;
  if new.referencias is not null then
    new.referencias := public.jsonb_strip_blob(new.referencias);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_strip_blob_sm on producoes_social_media;
create trigger trg_strip_blob_sm
  before insert or update on producoes_social_media
  for each row execute function public.strip_blob_urls_sm();


-- 4) producoes_social_media_items
create or replace function public.strip_blob_urls_sm_items()
returns trigger as $$
begin
  if new.copy_arquivo_url like 'blob:%' then new.copy_arquivo_url := null; end if;
  if new.artes_prontas is not null then
    new.artes_prontas := public.jsonb_strip_blob(new.artes_prontas);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_strip_blob_sm_items on producoes_social_media_items;
create trigger trg_strip_blob_sm_items
  before insert or update on producoes_social_media_items
  for each row execute function public.strip_blob_urls_sm_items();


-- 5) criacoes (anexos é jsonb com [{url, nome, tipo, tamanho}])
create or replace function public.strip_blob_urls_criacoes()
returns trigger as $$
begin
  if new.anexos is not null then
    new.anexos := (
      select coalesce(jsonb_agg(a), '[]'::jsonb)
        from jsonb_array_elements(new.anexos) a
       where (a->>'url') is null
          or (a->>'url') not like 'blob:%'
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_strip_blob_criacoes on criacoes;
create trigger trg_strip_blob_criacoes
  before insert or update on criacoes
  for each row execute function public.strip_blob_urls_criacoes();


-- 6) Limpa o que JÁ está no banco (one-shot)

-- criativos_webdesign
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

-- projetos_webdesign
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

-- producoes_social_media
update producoes_social_media
   set briefing_pdf_url = case when briefing_pdf_url like 'blob:%' then null else briefing_pdf_url end,
       referencias      = case when referencias is null then null
                               else public.jsonb_strip_blob(referencias)
                          end
 where briefing_pdf_url like 'blob:%'
    or exists(select 1 from jsonb_array_elements_text(coalesce(referencias, '[]'::jsonb)) x where x like 'blob:%');

-- producoes_social_media_items
update producoes_social_media_items
   set copy_arquivo_url = case when copy_arquivo_url like 'blob:%' then null else copy_arquivo_url end,
       artes_prontas    = case when artes_prontas is null then null
                               else public.jsonb_strip_blob(artes_prontas)
                          end
 where copy_arquivo_url like 'blob:%'
    or exists(select 1 from jsonb_array_elements_text(coalesce(artes_prontas, '[]'::jsonb)) x where x like 'blob:%');

-- criacoes
update criacoes
   set anexos = (
     select coalesce(jsonb_agg(a), '[]'::jsonb)
       from jsonb_array_elements(anexos) a
      where (a->>'url') is null
         or (a->>'url') not like 'blob:%'
   )
 where anexos is not null
   and exists (select 1 from jsonb_array_elements(anexos) a where (a->>'url') like 'blob:%');


-- 7) Confirmação — todos devem ser ZERO
select 'criativos.url_criativo'      as origem, count(*) as registros from criativos_webdesign     where url_criativo         like 'blob:%'
union all select 'criativos.identidade',         count(*) from criativos_webdesign     where identidade_visual_url like 'blob:%'
union all select 'criativos.copy',               count(*) from criativos_webdesign     where copy_arquivo_url     like 'blob:%'
union all select 'criativos.fotos[]',            count(*) from criativos_webdesign,     lateral jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%'
union all select 'projetos.briefing_pdf',        count(*) from projetos_webdesign      where briefing_pdf_url     like 'blob:%'
union all select 'projetos.identidade',          count(*) from projetos_webdesign      where identidade_visual_url like 'blob:%'
union all select 'projetos.copy',                count(*) from projetos_webdesign      where copy_arquivo_url     like 'blob:%'
union all select 'projetos.url_producao',        count(*) from projetos_webdesign      where url_producao         like 'blob:%'
union all select 'projetos.fotos[]',             count(*) from projetos_webdesign,      lateral jsonb_array_elements_text(coalesce(fotos, '[]'::jsonb)) x where x like 'blob:%'
union all select 'sm.briefing',                  count(*) from producoes_social_media  where briefing_pdf_url     like 'blob:%'
union all select 'sm.referencias[]',             count(*) from producoes_social_media,  lateral jsonb_array_elements_text(coalesce(referencias, '[]'::jsonb)) x where x like 'blob:%'
union all select 'sm_item.copy',                 count(*) from producoes_social_media_items where copy_arquivo_url like 'blob:%'
union all select 'sm_item.artes[]',              count(*) from producoes_social_media_items, lateral jsonb_array_elements_text(coalesce(artes_prontas, '[]'::jsonb)) x where x like 'blob:%'
union all select 'criacoes.anexos[]',            count(*) from criacoes,                lateral jsonb_array_elements(coalesce(anexos, '[]'::jsonb)) a where (a->>'url') like 'blob:%'
order by registros desc, origem;
