-- =========================================================
-- Migration 039 — Fix de dedup: external_ref tem prioridade absoluta
-- =========================================================
-- Problema observado: planilhas de teste/CRM podem ter MULTIPLOS leads
-- compartilhando o mesmo telefone (mesmo paciente que retornou, dados
-- de teste preenchidos rapido, etc).
--
-- A RPC atual (migration 036) faz:
--   1) Procura por external_ref  → UPDATE
--   2) Fallback: procura por telefone → UPDATE
--
-- O passo 2 esta causando overwrite indevido: linhas com external_ref
-- novo mas telefone repetido caem no fallback e sobrescrevem leads
-- anteriores. Resultado: planilha com 8 linhas vira 1 lead so no banco.
--
-- Fix: quando external_ref vem preenchido, usar SOMENTE ele. Sem
-- fallback. Cada linha distinta da planilha = 1 lead distinto.
--
-- Fallback por telefone fica apenas pra chamadas LEGACY (sem
-- external_ref) — caso o Apps Script antigo ainda esteja rodando.
--
-- Idempotente.
-- =========================================================

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
  p_external_ref text default null
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
    'external_ref', p_external_ref
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
    -- DEDUP PRINCIPAL: external_ref é o identificador autoritativo por linha.
    -- Se vier preenchido, NÃO faz fallback por telefone (cada linha = 1 lead).
    if p_external_ref is not null and length(p_external_ref) > 0 then
      select id into v_lead_id
        from leads
       where cliente_id = v_cliente_id
         and external_ref = p_external_ref
       limit 1;
    else
      -- Sem external_ref (chamadas legacy do Apps Script v1/v2) — dedup por telefone
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
      -- UPDATE — preserva campos antigos não enviados
      update leads set
        nome = coalesce(nullif(trim(p_nome), ''), nome),
        telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
        email = coalesce(nullif(trim(p_email), ''), email),
        etapa = coalesce(nullif(trim(p_etapa), ''), etapa),
        valor = coalesce(p_valor, valor),
        observacoes = coalesce(nullif(trim(p_observacoes), ''), observacoes),
        external_ref = coalesce(p_external_ref, external_ref),
        updated_at = now()
      where id = v_lead_id;
      v_acao := 'update';
    else
      insert into leads (
        cliente_id, origem, nome, telefone, email, etapa, valor,
        data_entrada, observacoes, external_ref
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
        p_external_ref
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

-- Regrant (signature inalterada, mas garante permissão)
grant execute on function intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text, text, text
) to anon, authenticated;

-- Confirmação: lista versões da função (deve continuar sendo só 1 — a de 10 args)
select
  proname as funcao,
  pg_get_function_identity_arguments(oid) as assinatura
from pg_proc
where proname = 'intake_lead_from_sheets'
  and pronamespace = 'public'::regnamespace;
