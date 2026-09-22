-- =========================================================
-- Migration 088: Setor Comercial (persistência) — leads, investimentos,
-- metas comerciais e config
-- =========================================================
-- Tira o módulo Comercial do mock em memória e leva pro banco.
--
-- Decisões:
--  - `leads`: 1 tabela com a coluna `data` JSONB guardando o Lead inteiro
--    (muitos campos + aninhados: bant, reuniao, tentativas, dadosOriginaisCRM,
--    histórico). O app lê todos e filtra em JS — não precisa de colunas
--    relacionais aqui. `id` é text (ids gerados pelo app: 'lead-1', 'lead-crm-…').
--  - `investimentos_marketing` e `metas_comerciais`: colunas reais (flat,
--    inspecionáveis/consultáveis).
--  - `comercial_config`: 1 linha (id='default') com as configs em JSONB
--    (SLA Comercial, Metas de Marketing, Integração de CRM).
--
-- RLS: mesma política das outras tabelas (qualquer autenticado lê/escreve).
-- O app tem fallback: se estas tabelas NÃO existirem, o Comercial roda no
-- mock em memória (não quebra); ao rodar esta migration, passa a persistir.
-- Na 1ª carga com o banco vazio, o app faz bootstrap inserindo o mock.
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

-- 1. Leads do Comercial (Lead inteiro em JSONB)
-- OBS: NÃO reusar a tabela `leads` já existente (CRM Kommo/Sheets — schema
-- relacional totalmente diferente, migrations 025–041). Por isso o nome
-- dedicado `comercial_leads`.
create table if not exists comercial_leads (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Índices úteis pra relatórios futuros (etapa e datas ficam dentro do JSONB).
create index if not exists idx_comercial_leads_etapa on comercial_leads ((data->>'etapaFunil'));
create index if not exists idx_comercial_leads_data_entrada on comercial_leads ((data->>'dataEntrada'));

alter table comercial_leads enable row level security;
drop policy if exists "auth read comercial_leads" on comercial_leads;
drop policy if exists "auth write comercial_leads" on comercial_leads;
create policy "auth read comercial_leads" on comercial_leads for select using (auth.role() = 'authenticated');
create policy "auth write comercial_leads" on comercial_leads for all using (auth.role() = 'authenticated');

drop trigger if exists trg_comercial_leads_updated on comercial_leads;
create trigger trg_comercial_leads_updated before update on comercial_leads
  for each row execute function set_updated_at();

-- 2. Investimento de mídia por período/canal
create table if not exists investimentos_marketing (
  id text primary key,
  periodo text not null,           -- "YYYY-MM"
  canal text not null,
  valor numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_invest_periodo on investimentos_marketing (periodo);

alter table investimentos_marketing enable row level security;
drop policy if exists "auth read invest" on investimentos_marketing;
drop policy if exists "auth write invest" on investimentos_marketing;
create policy "auth read invest" on investimentos_marketing for select using (auth.role() = 'authenticated');
create policy "auth write invest" on investimentos_marketing for all using (auth.role() = 'authenticated');

drop trigger if exists trg_invest_updated on investimentos_marketing;
create trigger trg_invest_updated before update on investimentos_marketing
  for each row execute function set_updated_at();

-- 3. Metas comerciais (mensais/semanais por métrica de INPUT)
create table if not exists metas_comerciais (
  id text primary key,
  periodicidade text not null check (periodicidade in ('mensal', 'semanal')),
  metrica text not null,
  canal text,
  responsavel_id text,
  valor_meta numeric not null default 0,
  periodo_referencia text not null, -- "YYYY-MM" (mensal) ou data da 2ª-feira (semanal)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_metas_periodo on metas_comerciais (periodicidade, periodo_referencia);

alter table metas_comerciais enable row level security;
drop policy if exists "auth read metas" on metas_comerciais;
drop policy if exists "auth write metas" on metas_comerciais;
create policy "auth read metas" on metas_comerciais for select using (auth.role() = 'authenticated');
create policy "auth write metas" on metas_comerciais for all using (auth.role() = 'authenticated');

drop trigger if exists trg_metas_com_updated on metas_comerciais;
create trigger trg_metas_com_updated before update on metas_comerciais
  for each row execute function set_updated_at();

-- 4. Config do Comercial (linha única) — SLA, Metas de Marketing, Integração CRM
create table if not exists comercial_config (
  id text primary key default 'default',
  sla jsonb,
  metas_marketing jsonb,
  integracao_crm jsonb,
  updated_at timestamptz default now()
);

alter table comercial_config enable row level security;
drop policy if exists "auth read cfg" on comercial_config;
drop policy if exists "auth write cfg" on comercial_config;
create policy "auth read cfg" on comercial_config for select using (auth.role() = 'authenticated');
create policy "auth write cfg" on comercial_config for all using (auth.role() = 'authenticated');

drop trigger if exists trg_cfg_updated on comercial_config;
create trigger trg_cfg_updated before update on comercial_config
  for each row execute function set_updated_at();

-- Sem seed aqui: o app faz bootstrap do mock na 1ª carga (quando a linha
-- comercial_config ainda não existe), gravando leads/investimentos/metas +
-- config. Assim a demo continua e já nasce persistida.
