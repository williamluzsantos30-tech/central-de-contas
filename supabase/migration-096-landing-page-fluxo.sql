-- =========================================================
-- Migration 096 — Fluxo da esteira de Landing Page
-- =========================================================
-- ⚠ Rode no projeto do DOMUS (painel supabase.com/dashboard/project/ikekfj…),
--   não no "central contas".
--
-- Guarda, por projeto de Webdesign › Landing Page, o que não cabe nas
-- colunas de projetos_webdesign:
--   • responsável e datas (início/conclusão) de cada etapa da esteira
--   • aprovações/reprovações de Copy e Design (quem, quando, motivo)
--   • pausas com motivo (e histórico), escalação pro Head, avisos
--   • status da URL de produção e o vínculo da LP com o Marketing
--
-- Um JSON por projeto (o formato vive no front: fluxoLP.ts). A etapa atual
-- continua em projetos_webdesign.status.
--
-- Sem esta tabela a tela funciona, mas salva só no navegador de quem usa.
-- Idempotente.
-- =========================================================
begin;

create table if not exists projetos_webdesign_fluxo (
  projeto_id uuid primary key references projetos_webdesign(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table projetos_webdesign_fluxo is
  'Fluxo da esteira de Landing Page (responsável/datas por etapa, aprovações, pausas, escalação, status da URL, vínculo com Marketing). JSON por projeto.';

alter table projetos_webdesign_fluxo enable row level security;
drop policy if exists "auth read lp fluxo" on projetos_webdesign_fluxo;
drop policy if exists "auth write lp fluxo" on projetos_webdesign_fluxo;
create policy "auth read lp fluxo" on projetos_webdesign_fluxo for select using (auth.role() = 'authenticated');
create policy "auth write lp fluxo" on projetos_webdesign_fluxo for all using (auth.role() = 'authenticated');

commit;
