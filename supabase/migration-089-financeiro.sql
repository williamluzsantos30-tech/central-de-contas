-- =========================================================
-- Migration 089: Financeiro (persistência) — despesas + config
-- =========================================================
-- Tira o módulo Financeiro do mock em memória e leva pro banco.
--
-- Só há dado PRÓPRIO em dois lugares (o resto — DRE, DRE por Setor, Fluxo de
-- Caixa — é 100% derivado e não persiste nada):
--   1. despesas_financeiras: os lançamentos de despesa (colunas flat,
--      consultáveis por categoria/setor/competência; `origem_detalhe` da
--      integração externa fica em JSONB).
--   2. financeiro_config: 1 linha (id='default') com as metas financeiras
--      (margem bruta/líquida alvo) em JSONB.
--
-- Nome dedicado `despesas_financeiras` (não `despesas`) por segurança, no
-- mesmo espírito de `comercial_leads` da 088.
--
-- RLS: mesma política das demais (qualquer autenticado lê/escreve).
-- Fallback do app: se estas tabelas NÃO existirem, o Financeiro roda no mock
-- em memória (não quebra); ao rodar esta migration passa a persistir. Na 1ª
-- carga com o banco vazio, o app faz bootstrap inserindo o mock.
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

-- 1. Despesas
create table if not exists despesas_financeiras (
  id text primary key,
  descricao text not null,
  categoria text not null,
  setor text,
  valor numeric not null default 0,
  tipo_recorrencia text not null default 'unica',
  data_competencia text not null,          -- "YYYY-MM"
  data_pagamento text,                     -- "YYYY-MM-DD" (regime de caixa)
  status text not null default 'pendente',
  fornecedor text,
  observacao text,
  origem text not null default 'manual',   -- 'manual' | 'integracao_externa'
  origem_detalhe jsonb,                     -- { provedor, idExterno, sincronizadoEm }
  repetir_ate text,                        -- "YYYY-MM" ou null = indeterminado
  recorrencia_modelo_id text,              -- instância materializada → id do modelo
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_despesas_competencia on despesas_financeiras (data_competencia);
create index if not exists idx_despesas_setor on despesas_financeiras (setor);
create index if not exists idx_despesas_categoria on despesas_financeiras (categoria);

alter table despesas_financeiras enable row level security;
drop policy if exists "auth read despesas" on despesas_financeiras;
drop policy if exists "auth write despesas" on despesas_financeiras;
create policy "auth read despesas" on despesas_financeiras for select using (auth.role() = 'authenticated');
create policy "auth write despesas" on despesas_financeiras for all using (auth.role() = 'authenticated');

drop trigger if exists trg_despesas_updated on despesas_financeiras;
create trigger trg_despesas_updated before update on despesas_financeiras
  for each row execute function set_updated_at();

-- 2. Config do Financeiro (linha única) — metas financeiras
create table if not exists financeiro_config (
  id text primary key default 'default',
  metas jsonb,                             -- { margemBrutaAlvo, margemLiquidaAlvo, ltvCacAlvo, paybackAlvoMeses }
  comissao jsonb,                          -- { base, pctCloser, pctSdr, pctSocial }
  updated_at timestamptz default now()
);
-- (idempotente, caso a tabela já exista de uma execução anterior)
alter table financeiro_config add column if not exists comissao jsonb;

alter table financeiro_config enable row level security;
drop policy if exists "auth read fin cfg" on financeiro_config;
drop policy if exists "auth write fin cfg" on financeiro_config;
create policy "auth read fin cfg" on financeiro_config for select using (auth.role() = 'authenticated');
create policy "auth write fin cfg" on financeiro_config for all using (auth.role() = 'authenticated');

drop trigger if exists trg_fin_cfg_updated on financeiro_config;
create trigger trg_fin_cfg_updated before update on financeiro_config
  for each row execute function set_updated_at();

-- Sem seed: o app faz bootstrap do mock na 1ª carga (quando a linha
-- financeiro_config ainda não existe), gravando despesas + config.
