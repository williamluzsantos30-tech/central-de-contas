-- =========================================================
-- Migration 040 — Coluna dados_extras jsonb em leads
-- =========================================================
-- Planilhas dos clientes tem colunas alem dos basicos (nome/telefone/
-- email): canal de origem (Meta/Google Ads), motivo de perda, status
-- de agendamento, etc.
--
-- Em vez de adicionar uma coluna no banco pra cada campo (rigido,
-- precisa migration pra cada novo), usa jsonb pra guardar TUDO
-- flexivel. RPC e Edge Function repassam.
--
-- Estrutura esperada (mas livre):
-- {
--   "canal": "META ADS" | "GOOGLE ADS" | "...",
--   "motivo_perdido": "...",
--   "agendou_consulta": true | false,
--   "consulta_realizada": true | false,
--   "tratamento_fechado": true | false,
--   "mensagem_confirmacao": "..."
-- }
--
-- Pra queries: PostgreSQL aceita `dados_extras->>'canal' = 'META ADS'`
-- com performance decente sem indices. Pra filtros pesados, criar
-- index GIN: `create index on leads using gin (dados_extras);`
--
-- Idempotente.
-- =========================================================

-- 1) Coluna
alter table leads
  add column if not exists dados_extras jsonb;

comment on column leads.dados_extras is
  'Campos adicionais flexiveis do CRM: canal, motivo_perdido, agendou_consulta, consulta_realizada, tratamento_fechado, mensagem_confirmacao, etc. Cada cliente pode ter colunas diferentes na planilha — guardamos tudo aqui.';

-- 2) Index GIN pra filtros (opcional mas barato)
create index if not exists idx_leads_dados_extras_gin
  on leads using gin (dados_extras);

-- 3) RPC atualizada — aceita p_dados_extras
create or replace function intake_lead_from_sheets(
  p_token text,
  p_nome text default null,
  p_telefone text default null,
  p_email text default null,
  p_etapa text default null,
  p_valor numeric default null,
  p_data_entrada timestamptz default null,
  p_observacoes text default null,
  p_fonte text default 'sheets',
  p_external_ref text default null,
  p_dados_extras jsonb default null
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
  v_payload := jsonb_build_object(
    'nome', p_nome,
    'telefone', p_telefone,
    'email', p_email,
    'etapa', p_etapa,
    'valor', p_valor,
    'data_entrada', p_data_entrada,
    'observacoes', p_observacoes,
    'fonte', p_fonte,
    'external_ref', p_external_ref,
    'dados_extras', p_dados_extras
  );

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
    -- Dedup por external_ref (sem fallback se preenchido)
    if p_external_ref is not null and length(p_external_ref) > 0 then
      select id into v_lead_id
        from leads
       where cliente_id = v_cliente_id
         and external_ref = p_external_ref
       limit 1;
    else
      v_tel_clean := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
      if length(v_tel_clean) >= 6 then
        select id into v_lead_id
          from leads
         where cliente_id = v_cliente_id
           and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel_clean
         order by created_at desc
         limit 1;
      end if;
    end if;

    if v_lead_id is not null then
      update leads set
        nome = coalesce(nullif(trim(p_nome), ''), nome),
        telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
        email = coalesce(nullif(trim(p_email), ''), email),
        etapa = coalesce(nullif(trim(p_etapa), ''), etapa),
        valor = coalesce(p_valor, valor),
        observacoes = coalesce(nullif(trim(p_observacoes), ''), observacoes),
        external_ref = coalesce(p_external_ref, external_ref),
        -- Merge dados_extras: novos campos sobrescrevem, antigos preservados
        dados_extras = coalesce(dados_extras, '{}'::jsonb) || coalesce(p_dados_extras, '{}'::jsonb),
        updated_at = now()
      where id = v_lead_id;
      v_acao := 'update';
    else
      insert into leads (
        cliente_id, origem, nome, telefone, email, etapa, valor,
        data_entrada, observacoes, external_ref, dados_extras
      ) values (
        v_cliente_id,
        'google_sheets',
        nullif(trim(p_nome), ''),
        nullif(trim(p_telefone), ''),
        nullif(trim(p_email), ''),
        nullif(trim(p_etapa), ''),
        p_valor,
        coalesce(p_data_entrada, now()),
        nullif(trim(p_observacoes), ''),
        p_external_ref,
        p_dados_extras
      )
      returning id into v_lead_id;
      v_acao := 'insert';
    end if;

    insert into crm_sheets_ingest_log
      (cliente_id, http_status, ok, lead_id, acao, payload, fonte)
    values
      (v_cliente_id, 200, true, v_lead_id, v_acao, v_payload, coalesce(p_fonte, 'sheets'));

    return v_lead_id;
  exception when others then
    insert into crm_sheets_ingest_log
      (cliente_id, http_status, ok, acao, erro, payload, fonte)
    values
      (v_cliente_id, 500, false, 'error', SQLERRM, v_payload, coalesce(p_fonte, 'sheets'));
    raise;
  end;
end;
$$;

-- 4) Drop versão antiga (10 args, sem p_dados_extras) pra evitar
--    ambiguidade na sobrecarga (mesmo problema da migration 038)
drop function if exists intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text, text, text
);

grant execute on function intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text, text, text, jsonb
) to anon, authenticated;

-- Confirmação
select
  proname as funcao,
  pg_get_function_identity_arguments(oid) as assinatura
from pg_proc
where proname = 'intake_lead_from_sheets'
  and pronamespace = 'public'::regnamespace;
