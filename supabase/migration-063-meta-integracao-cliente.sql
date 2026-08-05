-- =========================================================
-- Migration 063 — Meta Instagram integration per cliente
-- =========================================================
-- Armazena o vinculo OAuth entre cada cliente e a conta Instagram
-- Business dele. Uma linha por cliente que autorizou a MovMed a ler
-- as metricas do IG dele.
--
-- Token de acesso e' LONG-LIVED (60 dias, renovavel). Guardado como
-- bytea encriptado — a chave de encripitacao mora no env da Edge
-- Function (SUPABASE_ENCRYPTION_KEY). Frontend NUNCA le esse campo,
-- so as Edge Functions descriptam.
--
-- RLS: so `service_role` le/escreve. Users comuns nao acessam. Isso
-- protege os tokens mesmo se alguem conseguir o anon key.
--
-- Idempotente.
-- =========================================================
begin;

create table if not exists meta_integracao_cliente (
  cliente_id           uuid primary key references clientes(id) on delete cascade,

  -- IDs da Meta Graph API
  ig_user_id           text not null,             -- Instagram User ID (numerico)
  ig_username          text,                      -- @handle (pra display)
  page_id              text,                      -- Facebook Page ID conectada
  page_name            text,                      -- Nome da Page (pra display)

  -- Token OAuth long-lived (60 dias). Bytea = encriptado pela Edge Function.
  -- Nunca gravar plain text aqui.
  access_token_encrypted bytea not null,
  token_expires_at     timestamptz not null,      -- quando o token expira

  -- Rastreio de sync
  ultima_sync          timestamptz,               -- ultima vez que buscamos insights
  ultima_sync_status   text,                      -- 'ok' | 'error: xxx'
  ultima_sync_erro     text,                      -- mensagem de erro do ultimo fail

  autorizado_em        timestamptz default now(),
  autorizado_por_email text,                      -- email do user que fez a autorizacao (do medico ou do time)

  updated_at           timestamptz default now(),

  constraint token_nao_expirado_no_insert check (token_expires_at > autorizado_em)
);

comment on table meta_integracao_cliente is
  'Vinculo OAuth entre cliente e conta Instagram Business dele. Token long-lived (60d) encriptado. RLS restringe a service_role. Edge Functions gerenciam.';

create index if not exists idx_meta_integracao_expires
  on meta_integracao_cliente(token_expires_at)
  where token_expires_at is not null;

create index if not exists idx_meta_integracao_ultima_sync
  on meta_integracao_cliente(ultima_sync);

-- Trigger updated_at
create or replace function trg_meta_integracao_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists meta_integracao_updated_at on meta_integracao_cliente;
create trigger meta_integracao_updated_at
  before update on meta_integracao_cliente
  for each row execute function trg_meta_integracao_updated_at();

-- RLS: bloqueado por padrao, so service_role acessa
alter table meta_integracao_cliente enable row level security;

drop policy if exists "service_role manages meta_integracao" on meta_integracao_cliente;
create policy "service_role manages meta_integracao"
  on meta_integracao_cliente
  for all
  using (auth.role() = 'service_role');

-- Anon e authenticated podem ler APENAS metadata (nunca o token)
-- via view separada, exposta abaixo.
drop view if exists meta_integracao_cliente_public;
create view meta_integracao_cliente_public
with (security_invoker = true)
as
select
  cliente_id,
  ig_username,
  page_name,
  ultima_sync,
  ultima_sync_status,
  autorizado_em,
  case
    when token_expires_at < now()                     then 'expirado'
    when token_expires_at < now() + interval '7 days' then 'expira_em_breve'
    else 'ok'
  end as token_status
from meta_integracao_cliente;

comment on view meta_integracao_cliente_public is
  'Versao "safe" da tabela — nao expoe access_token nem ig_user_id. Frontend pode ler pra mostrar status da integracao.';

grant select on meta_integracao_cliente_public to authenticated;

commit;

-- =========================================================
-- Proximos passos (nao aqui — nas migrations 064, 065 e Edge Functions):
--
-- 064: estende metricas_social_mensal com sync_source e sincronizado_em
-- 065: helpers de encripitacao (se usar pgsodium) OR feito em JS na Edge
--
-- Edge Functions:
--   - meta-oauth-callback  : recebe code do OAuth, troca por token,
--                            encripta e salva
--   - meta-sync-insights   : busca insights de todos os clientes
--                            autorizados no dia
--   - meta-refresh-tokens  : renova tokens que expiram em <15 dias
-- =========================================================
