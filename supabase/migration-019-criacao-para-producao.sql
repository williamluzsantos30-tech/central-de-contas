-- =========================================================
-- Migration 019 — Criações aprovadas viram produção
-- =========================================================
-- Quando uma copy_lp/copy_criativos é APROVADA, ela deve gerar
-- automaticamente um projeto (landing page) ou criativo no webdesign.
-- Pra não duplicar (se o status oscilar), guardamos a referência.
--
-- 1) criacoes.enviado_para_producao_em — quando saiu da copy pro design
-- 2) projetos_webdesign.criacao_origem_id — qual criação gerou esse projeto
-- 3) criativos_webdesign.criacao_origem_id — qual criação gerou esse criativo
-- 4) projetos_webdesign.copy_texto — pra receber a copy gerada (criativos já tem)
--
-- Idempotente.
-- =========================================================

-- 1) Marca de "ja enviado" na criação (evita criar projeto duplicado)
alter table criacoes
  add column if not exists enviado_para_producao_em timestamptz;

comment on column criacoes.enviado_para_producao_em is
  'Timestamp de quando essa criacao gerou um projeto/criativo via aprovacao. Null = ainda nao foi pra producao.';

-- 2) FK retroativa: projeto sabe de qual copy ele veio
alter table projetos_webdesign
  add column if not exists criacao_origem_id uuid references criacoes(id) on delete set null;

create index if not exists idx_projetos_webdesign_criacao_origem
  on projetos_webdesign(criacao_origem_id)
  where criacao_origem_id is not null;

-- 3) FK retroativa: criativo sabe de qual copy ele veio
alter table criativos_webdesign
  add column if not exists criacao_origem_id uuid references criacoes(id) on delete set null;

create index if not exists idx_criativos_webdesign_criacao_origem
  on criativos_webdesign(criacao_origem_id)
  where criacao_origem_id is not null;

-- 4) Coluna pra receber o texto da copy no projeto (criativos já tem copy_texto)
alter table projetos_webdesign
  add column if not exists copy_texto text;

comment on column projetos_webdesign.copy_texto is
  'Texto da copy da landing page. Preenchido automaticamente quando uma criacao tipo copy_lp e aprovada (vinculada via criacao_origem_id).';

-- Confirmação
select
  (select count(*) from criacoes where enviado_para_producao_em is not null) as criacoes_enviadas,
  (select count(*) from projetos_webdesign where criacao_origem_id is not null) as projetos_de_copy,
  (select count(*) from criativos_webdesign where criacao_origem_id is not null) as criativos_de_copy;
