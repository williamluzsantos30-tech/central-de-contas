-- =========================================================
-- Migration 006 — Buckets do Storage para anexos persistentes
-- =========================================================
-- Cria os buckets onde os arquivos enviados pela UI ficam
-- guardados de forma persistente. Antes desta migration, os
-- arquivos viviam só na memória da aba (`blob:` URL) ou eram
-- gravados como base64 no banco — os dois modos têm problema:
--   • blob:  some na hora que fecha a aba
--   • base64: explode o tamanho da linha no Postgres
--
-- O Storage do Supabase é S3 nativo do projeto, com URL pública
-- estável. Usamos UM bucket público por categoria.
--
-- Buckets criados:
--   • webdesign-assets  → briefings, fotos, identidade, copy de
--                          projetos/criativos/social media
--   • criacoes-anexos    → anexos (PDF/imagem) das criações de IA
--
-- COMO RODAR:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Cole tudo abaixo
-- 3. Run
-- (Idempotente.)
-- =========================================================

-- 1) Cria o bucket webdesign-assets (público pra leitura)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'webdesign-assets',
  'webdesign-assets',
  true,
  52428800,  -- 50 MB por arquivo
  null       -- sem restrição de mime (PDF, imagens, etc.)
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- 2) Cria o bucket criacoes-anexos (também público — anexos de IA)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'criacoes-anexos',
  'criacoes-anexos',
  true,
  20971520,  -- 20 MB por arquivo
  null
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- 3) Policies — usuários autenticados sobem; qualquer um lê (bucket é público)

-- webdesign-assets
drop policy if exists "auth upload webdesign-assets"   on storage.objects;
drop policy if exists "auth update webdesign-assets"   on storage.objects;
drop policy if exists "auth delete webdesign-assets"   on storage.objects;
drop policy if exists "public read webdesign-assets"   on storage.objects;

create policy "auth upload webdesign-assets" on storage.objects
  for insert
  with check (bucket_id = 'webdesign-assets' and auth.role() = 'authenticated');

create policy "auth update webdesign-assets" on storage.objects
  for update
  using (bucket_id = 'webdesign-assets' and auth.role() = 'authenticated');

create policy "auth delete webdesign-assets" on storage.objects
  for delete
  using (bucket_id = 'webdesign-assets' and auth.role() = 'authenticated');

create policy "public read webdesign-assets" on storage.objects
  for select
  using (bucket_id = 'webdesign-assets');

-- criacoes-anexos
drop policy if exists "auth upload criacoes-anexos"   on storage.objects;
drop policy if exists "auth update criacoes-anexos"   on storage.objects;
drop policy if exists "auth delete criacoes-anexos"   on storage.objects;
drop policy if exists "public read criacoes-anexos"   on storage.objects;

create policy "auth upload criacoes-anexos" on storage.objects
  for insert
  with check (bucket_id = 'criacoes-anexos' and auth.role() = 'authenticated');

create policy "auth update criacoes-anexos" on storage.objects
  for update
  using (bucket_id = 'criacoes-anexos' and auth.role() = 'authenticated');

create policy "auth delete criacoes-anexos" on storage.objects
  for delete
  using (bucket_id = 'criacoes-anexos' and auth.role() = 'authenticated');

create policy "public read criacoes-anexos" on storage.objects
  for select
  using (bucket_id = 'criacoes-anexos');

-- 4) Confirmação
select id, name, public, file_size_limit
  from storage.buckets
 where id in ('webdesign-assets', 'criacoes-anexos');
