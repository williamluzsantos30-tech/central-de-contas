-- =========================================================
-- Migration 083: Papéis Operacionais + vínculo membro→papel
-- =========================================================
-- Cria a fonte da verdade das PERMISSÕES: cada papel tem uma lista de
-- permissões, e cada pessoa (profiles) é vinculada a um papel. O papel do
-- usuário logado é que define o que ele pode fazer.
--
-- Squads e o vínculo pessoa→squad JÁ existem (migration 002: tabela squads
-- + profiles.squad_id). Esta migration só acrescenta a camada de papéis.
--
-- COMO RODAR:
-- 1. Painel do Supabase → SQL Editor → New query
-- 2. Cole tudo abaixo e clique em "Run"
-- =========================================================

-- 1. Tabela de papéis operacionais
create table if not exists papeis_operacionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'operacional' check (tipo in ('operacional', 'estrategico')),
  escopo text not null default 'Squad' check (escopo in ('Squad', 'Global')),
  -- Permissões livres (text[]). Valores conhecidos hoje:
  --   'Visualizar clientes', 'Editar status', 'Registrar NPS',
  --   'Registrar expansão', 'Registrar churn', 'Apenas leitura'
  permissoes text[] not null default '{}',
  jd_preenchida boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Vínculo membro → papel (profiles.papel_id)
alter table profiles add column if not exists papel_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_papel_fk') then
    alter table profiles add constraint profiles_papel_fk
      foreign key (papel_id) references papeis_operacionais(id) on delete set null;
  end if;
end$$;

-- 3. RLS (mesma política das outras tabelas: qualquer autenticado lê/escreve).
--    A trava fina por permissão vem depois (fase RLS), quando estiver validada.
alter table papeis_operacionais enable row level security;
drop policy if exists "auth read papeis" on papeis_operacionais;
drop policy if exists "auth write papeis" on papeis_operacionais;
create policy "auth read papeis" on papeis_operacionais
  for select using (auth.role() = 'authenticated');
create policy "auth write papeis" on papeis_operacionais
  for all using (auth.role() = 'authenticated');

-- 4. Trigger de updated_at (set_updated_at já existe desde a migration 002)
drop trigger if exists trg_papeis_updated on papeis_operacionais;
create trigger trg_papeis_updated before update on papeis_operacionais
  for each row execute function set_updated_at();

-- 5. Seed dos papéis (idempotente por nome). Reflete a lista atual da tela.
insert into papeis_operacionais (nome, tipo, escopo, permissoes, jd_preenchida, ativo) values
  ('Account Manager',          'operacional', 'Squad',  array['Visualizar clientes','Apenas leitura','Editar status','Registrar NPS'], false, true),
  ('Comercial',                'operacional', 'Global', array[]::text[], false, true),
  ('Concierge',                'operacional', 'Squad',  array['Visualizar clientes','Apenas leitura'], true, true),
  ('Consultoria',              'operacional', 'Squad',  array[]::text[], false, true),
  ('Coordenador de Qualidade', 'estrategico', 'Global', array['Visualizar clientes','Editar status','Registrar NPS'], true, true),
  ('Coordenador Geral',        'estrategico', 'Global', array['Visualizar clientes','Registrar churn','Registrar NPS','Registrar expansão','Editar status'], true, true),
  ('Designer',                 'operacional', 'Squad',  array['Visualizar clientes','Apenas leitura'], false, true),
  ('Diretor',                  'estrategico', 'Global', array['Visualizar clientes','Editar status','Registrar NPS','Registrar expansão','Registrar churn','Apenas leitura'], false, true),
  ('Editor de Vídeo',          'operacional', 'Global', array['Visualizar clientes','Apenas leitura'], false, true),
  ('Experiência do Cliente',   'operacional', 'Squad',  array['Visualizar clientes','Editar status','Registrar NPS','Apenas leitura'], false, true),
  ('Gerente Operacional',      'estrategico', 'Global', array['Visualizar clientes','Editar status','Registrar NPS','Registrar expansão','Registrar churn'], true, true),
  ('Gestor de Tráfego',        'operacional', 'Squad',  array['Visualizar clientes','Apenas leitura'], false, true),
  ('Head de Conteúdo',         'estrategico', 'Global', array['Apenas leitura','Editar status','Registrar NPS'], false, true),
  ('Head de Tráfego',          'estrategico', 'Global', array['Visualizar clientes','Editar status','Registrar NPS'], true, true),
  -- Papéis referenciados por membros existentes (não estavam na lista da tela,
  -- mas precisam existir pra o vínculo membro→papel bater).
  ('Social Media',             'operacional', 'Squad',  array['Visualizar clientes','Apenas leitura'], false, true),
  ('SDR',                      'operacional', 'Global', array['Visualizar clientes','Apenas leitura'], false, true)
on conflict (nome) do nothing;

-- 6. Backfill: vincula cada profile a um papel a partir do cargo atual
--    (best-effort — quem não casar fica sem papel e é atribuído na tela).
update profiles p set papel_id = r.id
from papeis_operacionais r
where p.papel_id is null and (
     (p.cargo = 'account_manager' and r.nome = 'Account Manager')
  or (p.cargo = 'gestor_trafego'  and r.nome = 'Gestor de Tráfego')
  or (p.cargo = 'designer'        and r.nome = 'Designer')
  or (p.cargo = 'social_media'    and r.nome = 'Social Media')
  or (p.cargo = 'diretoria'       and r.nome = 'Diretor')
  or (p.cargo = 'head'            and r.nome = 'Head de Tráfego')
);

-- 7. Index
create index if not exists idx_profiles_papel on profiles(papel_id);

-- =========================================================
-- Pronto. Depois de rodar:
-- - Existe a tabela papeis_operacionais com os papéis e suas permissões
-- - Cada usuário (profiles) tem papel_id (backfill pelo cargo)
-- - A tela de Configurações e a resolução de permissões passam a ler daqui
-- =========================================================
