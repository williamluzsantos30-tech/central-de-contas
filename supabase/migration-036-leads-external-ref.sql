-- =========================================================
-- Migration 036 — Dedup de leads por external_ref (sheet+row)
-- =========================================================
-- Problema: Apps Script onEdit dispara a CADA célula editada. Usuário
-- preenche nome → cria lead. Depois preenche telefone → cria OUTRO
-- lead (porque a dedup por telefone falhou: o primeiro não tinha).
--
-- Solução: identifier estável por linha da planilha. Apps Script
-- envia "sheet:NOME-ABA:row12" como external_ref. RPC dedupa por
-- (cliente_id + external_ref) PRIMEIRO, depois por telefone como
-- fallback. Cada linha da planilha vira no máximo 1 lead.
--
-- Idempotente.
-- =========================================================

-- 1) Coluna external_ref + unique index parcial
alter table leads add column if not exists external_ref text;

create unique index if not exists idx_leads_external_ref_unique
  on leads (cliente_id, external_ref)
  where external_ref is not null;

comment on column leads.external_ref is
  'Identifier externo opcional (ex: "sheet:LEADS-JUNHO:row12"). Usado pra dedup quando a fonte tem identificador estavel (linha de planilha, ID de form, etc). Sobreposto a dedup por telefone.';

-- 2) RPC atualizada: aceita p_external_ref + dedup prioritaria
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
    -- DEDUP 1: por external_ref (mais confiavel)
    if p_external_ref is not null and length(p_external_ref) > 0 then
      select id into v_lead_id
        from leads
       where cliente_id = v_cliente_id
         and external_ref = p_external_ref
       limit 1;
    end if;

    -- DEDUP 2 (fallback): por telefone se >= 6 digitos
    if v_lead_id is null then
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

-- Regrant (assinatura mudou)
grant execute on function intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text, text, text
) to anon, authenticated;

-- Confirmacao
select
  count(*) filter (where external_ref is not null) as com_external_ref,
  count(*) as total_leads
from leads;
