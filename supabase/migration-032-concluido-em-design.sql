-- =========================================================
-- Migration 032 — Coluna concluido_em em items de design
-- =========================================================
-- Pra calcular pontualidade do designer (entregou antes ou depois
-- do prazo), precisamos saber EXATAMENTE quando o item virou
-- 'conclusao'. updated_at era proxy ruim porque qualquer edição
-- posterior (mudar observação, adicionar arte etc) atualiza.
--
-- Esta migration adiciona concluido_em em:
--   • projetos_webdesign
--   • criativos_webdesign
--   • edicoes_video
--   • producoes_social_media_items
--
-- Trigger BEFORE UPDATE: status → conclusao seta concluido_em = now().
-- Saída de conclusao limpa o campo.
--
-- Backfill: items que já estão com status='conclusao' ganham
-- concluido_em = updated_at (proxy razoável retroativo).
--
-- Idempotente.
-- =========================================================

-- 1) Colunas
alter table projetos_webdesign       add column if not exists concluido_em timestamptz;
alter table criativos_webdesign      add column if not exists concluido_em timestamptz;
alter table edicoes_video            add column if not exists concluido_em timestamptz;
alter table producoes_social_media_items add column if not exists concluido_em timestamptz;

comment on column projetos_webdesign.concluido_em is
  'Quando o projeto virou status=conclusao (auto via trigger). Usado pra calcular pontualidade no Performance.';
comment on column criativos_webdesign.concluido_em is
  'Quando o criativo virou status=conclusao (auto via trigger).';
comment on column edicoes_video.concluido_em is
  'Quando a edição virou status=conclusao (auto via trigger).';
comment on column producoes_social_media_items.concluido_em is
  'Quando o item virou status=conclusao (auto via trigger).';

-- 2) Backfill
update projetos_webdesign
   set concluido_em = updated_at
 where status = 'conclusao' and concluido_em is null;
update criativos_webdesign
   set concluido_em = updated_at
 where status = 'conclusao' and concluido_em is null;
update edicoes_video
   set concluido_em = updated_at
 where status = 'conclusao' and concluido_em is null;
update producoes_social_media_items
   set concluido_em = updated_at
 where status = 'conclusao' and concluido_em is null;

-- 3) Função genérica do trigger
create or replace function trg_sync_concluido_em()
returns trigger
language plpgsql
as $$
begin
  -- Entrou em conclusao → marca agora (preserva valor manual se vier setado)
  if new.status = 'conclusao' and (old.status is null or old.status <> 'conclusao') then
    new.concluido_em := coalesce(new.concluido_em, now());
  -- Saiu de conclusao → limpa
  elsif new.status <> 'conclusao' and old.status = 'conclusao' then
    new.concluido_em := null;
  end if;
  return new;
end;
$$;

-- 4) Triggers por tabela
drop trigger if exists sync_concluido_em on projetos_webdesign;
create trigger sync_concluido_em
  before update of status on projetos_webdesign
  for each row execute function trg_sync_concluido_em();

drop trigger if exists sync_concluido_em on criativos_webdesign;
create trigger sync_concluido_em
  before update of status on criativos_webdesign
  for each row execute function trg_sync_concluido_em();

drop trigger if exists sync_concluido_em on edicoes_video;
create trigger sync_concluido_em
  before update of status on edicoes_video
  for each row execute function trg_sync_concluido_em();

drop trigger if exists sync_concluido_em on producoes_social_media_items;
create trigger sync_concluido_em
  before update of status on producoes_social_media_items
  for each row execute function trg_sync_concluido_em();

-- 5) Trigger no INSERT (cobre o caso de criar já com status=conclusao)
create or replace function trg_set_concluido_em_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'conclusao' and new.concluido_em is null then
    new.concluido_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_concluido_em_insert on projetos_webdesign;
create trigger set_concluido_em_insert
  before insert on projetos_webdesign
  for each row execute function trg_set_concluido_em_insert();

drop trigger if exists set_concluido_em_insert on criativos_webdesign;
create trigger set_concluido_em_insert
  before insert on criativos_webdesign
  for each row execute function trg_set_concluido_em_insert();

drop trigger if exists set_concluido_em_insert on edicoes_video;
create trigger set_concluido_em_insert
  before insert on edicoes_video
  for each row execute function trg_set_concluido_em_insert();

drop trigger if exists set_concluido_em_insert on producoes_social_media_items;
create trigger set_concluido_em_insert
  before insert on producoes_social_media_items
  for each row execute function trg_set_concluido_em_insert();

-- 6) Confirmação
select
  (select count(*) from projetos_webdesign where concluido_em is not null) as projetos_concluidos,
  (select count(*) from criativos_webdesign where concluido_em is not null) as criativos_concluidos,
  (select count(*) from edicoes_video where concluido_em is not null) as edicoes_concluidas,
  (select count(*) from producoes_social_media_items where concluido_em is not null) as items_concluidos;
