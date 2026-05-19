-- =========================================================
-- Migration 035 — CRM Google Sheets v2: log de ingest + status
-- =========================================================
-- Problema: quando o Apps Script de um cliente "para de funcionar",
-- não temos como saber pelo lado da plataforma. Não há registro de
-- "RPC foi chamada mas falhou" nem "última vez que chegou um lead".
--
-- Esta migration adiciona:
--   1) Tabela crm_sheets_ingest_log: registra TODA chamada à RPC
--      (sucesso e falha), com payload recebido, status e erro
--   2) RPC intake_lead_from_sheets atualizada: faz INSERT no log
--      mesmo quando falha (exception capturada)
--   3) View crm_sheets_status: por cliente, devolve last_event_at,
--      last_status, last_error, eventos_24h, eventos_7d — pro
--      painel de status na UI
--   4) RLS no log: time interno (authenticated com user.role admin)
--      pode SELECT. Anon não vê.
--
-- Idempotente.
-- =========================================================

-- 1) Tabela de log
create table if not exists crm_sheets_ingest_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  cliente_id uuid references clientes(id) on delete cascade,
  http_status int,  -- 200 ok, 400 bad payload, 401 token invalido, 500 erro interno
  ok boolean not null default false,
  lead_id uuid references leads(id) on delete set null,
  acao text,         -- 'insert', 'update', 'error'
  erro text,         -- mensagem do exception
  payload jsonb,     -- o que o Apps Script enviou (sem o token)
  fonte text default 'sheets'  -- 'sheets', 'forms', 'test'
);

create index if not exists idx_crm_ingest_log_cliente_ts
  on crm_sheets_ingest_log(cliente_id, ts desc);

create index if not exists idx_crm_ingest_log_ts
  on crm_sheets_ingest_log(ts desc);

comment on table crm_sheets_ingest_log is
  'Cada chamada à RPC intake_lead_from_sheets (sucesso ou erro) deixa um registro aqui. Usado pra debug e painel de status no Admin.';

-- 2) RLS — só authenticated (interno) lê
alter table crm_sheets_ingest_log enable row level security;

drop policy if exists "log_select_authenticated" on crm_sheets_ingest_log;
create policy "log_select_authenticated"
  on crm_sheets_ingest_log
  for select
  to authenticated
  using (true);

-- (não tem policy de INSERT — só a RPC SECURITY DEFINER escreve)

-- 3) RPC atualizada: agora loga tudo (success + error)
create or replace function intake_lead_from_sheets(
  p_token text,
  p_nome text default null,
  p_telefone text default null,
  p_email text default null,
  p_etapa text default null,
  p_valor numeric default null,
  p_data_entrada timestamptz default null,
  p_observacoes text default null,
  p_fonte text default 'sheets'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_lead_id uuid;
  v_tel_clean text;
  v_acao text;
  v_payload jsonb;
begin
  -- Payload pra log (sem token)
  v_payload := jsonb_build_object(
    'nome', p_nome,
    'telefone', p_telefone,
    'email', p_email,
    'etapa', p_etapa,
    'valor', p_valor,
    'data_entrada', p_data_entrada,
    'observacoes', p_observacoes,
    'fonte', p_fonte
  );

  -- Valida token
  if p_token is null or length(p_token) < 16 then
    insert into crm_sheets_ingest_log (cliente_id, http_status, ok, acao, erro, payload, fonte)
    values (null, 401, false, 'error', 'Token inválido ou ausente', v_payload, coalesce(p_fonte, 'sheets'));
    raise exception 'Token inválido ou ausente' using errcode = '28000';
  end if;

  select id into v_cliente_id from clientes where crm_sheets_token = p_token;
  if v_cliente_id is null then
    insert into crm_sheets_ingest_log (cliente_id, http_status, ok, acao, erro, payload, fonte)
    values (null, 401, false, 'error', 'Cliente não encontrado para o token', v_payload, coalesce(p_fonte, 'sheets'));
    raise exception 'Cliente não encontrado para o token informado' using errcode = '28000';
  end if;

  begin
    -- Normaliza telefone: só dígitos
    v_tel_clean := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');

    if length(v_tel_clean) >= 6 then
      select id into v_lead_id
        from leads
       where cliente_id = v_cliente_id
         and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel_clean
       order by created_at desc
       limit 1;
    end if;

    if v_lead_id is not null then
      update leads set
        nome = coalesce(nullif(trim(p_nome), ''), nome),
        email = coalesce(nullif(trim(p_email), ''), email),
        etapa = coalesce(nullif(trim(p_etapa), ''), etapa),
        valor = coalesce(p_valor, valor),
        observacoes = coalesce(nullif(trim(p_observacoes), ''), observacoes),
        updated_at = now()
      where id = v_lead_id;
      v_acao := 'update';
    else
      insert into leads (
        cliente_id, origem, nome, telefone, email, etapa, valor,
        data_entrada, observacoes
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
      v_acao := 'insert';
    end if;

    -- Log de sucesso
    insert into crm_sheets_ingest_log
      (cliente_id, http_status, ok, lead_id, acao, payload, fonte)
    values
      (v_cliente_id, 200, true, v_lead_id, v_acao, v_payload, coalesce(p_fonte, 'sheets'));

    return v_lead_id;
  exception when others then
    -- Log de erro interno
    insert into crm_sheets_ingest_log
      (cliente_id, http_status, ok, acao, erro, payload, fonte)
    values
      (v_cliente_id, 500, false, 'error', SQLERRM, v_payload, coalesce(p_fonte, 'sheets'));
    raise;
  end;
end;
$$;

-- 4) Regrant (assinatura mudou — agora tem p_fonte)
grant execute on function intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text, text
) to anon, authenticated;

-- 5) View de status por cliente
create or replace view crm_sheets_status as
select
  c.id as cliente_id,
  c.nome as cliente_nome,
  c.crm_sheets_token is not null as has_token,
  c.crm_sheets_url,
  -- último evento (sucesso ou falha)
  (select max(ts) from crm_sheets_ingest_log l where l.cliente_id = c.id)
    as last_event_at,
  -- último sucesso
  (select max(ts) from crm_sheets_ingest_log l where l.cliente_id = c.id and l.ok)
    as last_success_at,
  -- último erro
  (select max(ts) from crm_sheets_ingest_log l where l.cliente_id = c.id and not l.ok)
    as last_error_at,
  (select erro from crm_sheets_ingest_log l
    where l.cliente_id = c.id and not l.ok
    order by ts desc limit 1)
    as last_error_msg,
  -- contadores
  (select count(*) from crm_sheets_ingest_log l
    where l.cliente_id = c.id and l.ts > now() - interval '24 hours')::int
    as eventos_24h,
  (select count(*) from crm_sheets_ingest_log l
    where l.cliente_id = c.id and l.ts > now() - interval '7 days')::int
    as eventos_7d,
  (select count(*) from crm_sheets_ingest_log l
    where l.cliente_id = c.id and l.ok and l.ts > now() - interval '24 hours')::int
    as sucesso_24h
from clientes c;

grant select on crm_sheets_status to authenticated;

comment on view crm_sheets_status is
  'Resumo por cliente do estado da integração CRM Google Sheets. Use no painel admin pra ver quem tá funcionando e quem parou.';

-- 6) Confirmação
select
  (select count(*) from crm_sheets_ingest_log) as total_logs,
  (select count(*) from crm_sheets_status where has_token) as clientes_com_token;
