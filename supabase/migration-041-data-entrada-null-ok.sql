-- =========================================================
-- Migration 041 — data_entrada aceita NULL + UPDATE atualiza data
-- =========================================================
-- Bug observado: planilha da Dra. Nina Pimenta tem 230 leads, todos
-- com data_entrada = hoje (2026-05-22). Investigando, descobriu-se:
--
--   1. O Code do n8n nao conseguiu parsear a coluna DATA dessa planilha
--      (formato/header desconhecido) → enviou p_data_entrada=null
--   2. A RPC tinha `coalesce(p_data_entrada, now())` → virou data de hoje
--   3. Resultado: visualmente parece que "todos os leads sao de hoje",
--      enganoso. Pior: na proxima rodada do n8n, mesmo se a data vier
--      correta da planilha, o UPDATE NAO atualiza data_entrada
--      (a query so atualiza nome/telefone/email/etc).
--
-- Fix:
--   A. INSERT: sem `now()` fallback. Se p_data_entrada=null, fica null.
--      UI mostra "—" → fica obvio quais leads precisam de revisao.
--   B. UPDATE: agora atualiza data_entrada se vier valor novo (preserva
--      antigo se p_data_entrada=null).
--
-- Tambem: limpa os 234 leads "fantasma" (hoje) — reseta pra null pra que
-- a proxima rodada do n8n preencha corretamente quando o parsing
-- estiver ok.
--
-- Idempotente.
-- =========================================================

-- 1) Reset dos leads erroneamente datados de hoje (origem google_sheets)
--    Pega os clientes especificos pra evitar afetar leads novos legitimos
update leads
   set data_entrada = null
 where origem = 'google_sheets'
   and data_entrada::date = current_date
   and cliente_id in (
     select id from clientes
      where nome ilike '%nina pimenta%'
         or nome ilike '%francileia%'
   );

-- 2) RPC atualizada — sem now() fallback + UPDATE com data_entrada
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
      -- UPDATE — agora inclui data_entrada (preserva antiga se p_ vier null)
      update leads set
        nome = coalesce(nullif(trim(p_nome), ''), nome),
        telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
        email = coalesce(nullif(trim(p_email), ''), email),
        etapa = coalesce(nullif(trim(p_etapa), ''), etapa),
        valor = coalesce(p_valor, valor),
        observacoes = coalesce(nullif(trim(p_observacoes), ''), observacoes),
        external_ref = coalesce(p_external_ref, external_ref),
        data_entrada = coalesce(p_data_entrada, data_entrada),  -- ← novo
        dados_extras = coalesce(dados_extras, '{}'::jsonb) || coalesce(p_dados_extras, '{}'::jsonb),
        updated_at = now()
      where id = v_lead_id;
      v_acao := 'update';
    else
      -- INSERT — sem now() fallback. Se data vier null, fica null.
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
        p_data_entrada,  -- ← null fica null (era coalesce com now())
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

grant execute on function intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text, text, text, jsonb
) to anon, authenticated;

-- 3) Confirmação: quantos leads ficaram sem data agora?
select
  c.nome as cliente,
  count(*) filter (where l.data_entrada is null) as sem_data,
  count(*) as total
from leads l
join clientes c on c.id = l.cliente_id
where l.origem = 'google_sheets'
group by c.nome
order by sem_data desc;
