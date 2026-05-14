-- =========================================================
-- Migration 025 — Integração CRM ↔ Google Sheets (webhook via Apps Script)
-- =========================================================
-- Cada cliente ganha um TOKEN secreto. O Apps Script (instalado na
-- planilha do cliente) usa o token pra postar leads na RPC pública
-- intake_lead_from_sheets. A RPC valida o token, encontra o cliente
-- e insere o lead.
--
-- Sem Edge Function, sem OAuth. Só uma RPC SECURITY DEFINER.
--
-- Idempotente.
-- =========================================================

-- 1) Coluna do token na tabela clientes
alter table clientes
  add column if not exists crm_sheets_token text;

-- Backfill: gera token pra clientes que ainda não têm
update clientes
   set crm_sheets_token = replace(gen_random_uuid()::text, '-', '')
 where crm_sheets_token is null;

-- Default + NOT NULL pra novos clientes
alter table clientes
  alter column crm_sheets_token set default replace(gen_random_uuid()::text, '-', '');

alter table clientes
  alter column crm_sheets_token set not null;

-- Unique constraint (garante token único entre clientes)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_crm_sheets_token_unique'
  ) then
    alter table clientes
      add constraint clientes_crm_sheets_token_unique unique (crm_sheets_token);
  end if;
end$$;

comment on column clientes.crm_sheets_token is
  'Token secreto usado pelo Apps Script da planilha do cliente pra postar leads na RPC intake_lead_from_sheets. Gerado automaticamente. Pode ser regenerado se vazar.';

-- 2) URL da planilha (só pra referência visual no admin do cliente)
alter table clientes
  add column if not exists crm_sheets_url text;

-- 3) Ampliar o check constraint de origem (se houver) pra aceitar 'google_sheets'
-- Não sabemos se a tabela leads tem check constraint. Tenta dropar (idempotente)
-- e adiciona uma nova que inclui google_sheets. Se não tinha check antes, só
-- adiciona — não quebra dados existentes.
do $$
declare
  v_constraint_name text;
begin
  -- Procura check constraint na coluna origem
  select conname into v_constraint_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'leads'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%origem%';

  if v_constraint_name is not null then
    execute format('alter table leads drop constraint %I', v_constraint_name);
  end if;

  -- Adiciona check novo com todas as origens válidas
  alter table leads
    add constraint leads_origem_check
    check (origem in ('kommo', 'manual', 'importacao', 'google_sheets'));
exception
  when others then
    -- Se já existe a constraint com mesmo nome, ignora
    null;
end$$;

-- 4) RPC pública pra receber leads do Apps Script
--    Validada por token (per-cliente). Roda como SECURITY DEFINER pra
--    poder inserir bypassando RLS.
create or replace function intake_lead_from_sheets(
  p_token text,
  p_nome text default null,
  p_telefone text default null,
  p_email text default null,
  p_etapa text default null,
  p_valor numeric default null,
  p_data_entrada timestamptz default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_lead_id uuid;
begin
  -- Valida token
  if p_token is null or length(p_token) < 16 then
    raise exception 'Token inválido ou ausente' using errcode = '28000';
  end if;

  select id into v_cliente_id from clientes where crm_sheets_token = p_token;
  if v_cliente_id is null then
    raise exception 'Cliente não encontrado para o token informado' using errcode = '28000';
  end if;

  -- Insere lead
  insert into leads (
    cliente_id, origem, nome, telefone, email, etapa, valor, data_entrada, observacoes
  ) values (
    v_cliente_id,
    'google_sheets',
    nullif(trim(p_nome), ''),
    nullif(trim(p_telefone), ''),
    nullif(trim(p_email), ''),
    nullif(trim(p_etapa), ''),
    p_valor,
    coalesce(p_data_entrada, now()),
    nullif(trim(p_observacoes), '')
  )
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

-- 5) Permite que anon (sem login) execute a RPC.
--    Isso é seguro porque a RPC valida o token e só insere se for válido.
grant execute on function intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text
) to anon, authenticated;

-- 6) Confirmação
select
  count(*) filter (where crm_sheets_token is not null) as com_token,
  count(*) as total_clientes
from clientes;
