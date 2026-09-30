-- =========================================================
-- Migration 097 — Fluxo da esteira de Criativos
-- =========================================================
-- ⚠ Rode no projeto do DOMUS (painel supabase.com/dashboard/project/ikekfj…),
--   não no "central contas".
--
-- Guarda, por criativo de Webdesign › Criativos, o histórico de etapas e
-- as decisões da Aprovação do Design (aprovado/reprovado, quem registrou,
-- quando e o motivo da reprovação). Um JSON por criativo — o formato vive
-- no front (fluxoCriativo.ts). A etapa atual continua em
-- criativos_webdesign.status.
--
-- Sem esta tabela a tela funciona, mas salva só no navegador de quem usa.
-- Idempotente.
-- =========================================================
begin;

create table if not exists criativos_webdesign_fluxo (
  criativo_id uuid primary key references criativos_webdesign(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table criativos_webdesign_fluxo is
  'Fluxo da esteira de Criativos (histórico de etapas + decisões da Aprovação do Design com motivo). JSON por criativo.';

alter table criativos_webdesign_fluxo enable row level security;
drop policy if exists "auth read criativo fluxo" on criativos_webdesign_fluxo;
drop policy if exists "auth write criativo fluxo" on criativos_webdesign_fluxo;
create policy "auth read criativo fluxo" on criativos_webdesign_fluxo for select using (auth.role() = 'authenticated');
create policy "auth write criativo fluxo" on criativos_webdesign_fluxo for all using (auth.role() = 'authenticated');

commit;
