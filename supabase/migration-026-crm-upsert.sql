-- =========================================================
-- Migration 026 — RPC do CRM Sheets agora faz UPSERT por telefone
-- =========================================================
-- Antes: cada chamada inseria um lead novo. Resultado: trigger onEdit
-- na planilha disparando 5x pra mesma linha = 5 leads duplicados.
--
-- Agora: a RPC procura lead com mesmo cliente_id + telefone (só
-- dígitos). Se achou, UPDATE (preserva campos antigos não enviados).
-- Se não achou, INSERT novo.
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
  v_tel_clean text;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Token inválido ou ausente' using errcode = '28000';
  end if;

  select id into v_cliente_id from clientes where crm_sheets_token = p_token;
  if v_cliente_id is null then
    raise exception 'Cliente não encontrado para o token informado' using errcode = '28000';
  end if;

  -- Normaliza telefone: só dígitos
  v_tel_clean := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');

  -- Procura lead existente por telefone + cliente (chave natural de dedup)
  if length(v_tel_clean) >= 6 then
    select id into v_lead_id
      from leads
     where cliente_id = v_cliente_id
       and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel_clean
     order by created_at desc
     limit 1;
  end if;

  if v_lead_id is not null then
    -- UPDATE — só sobrescreve campos não vazios, preserva o resto
    update leads set
      nome = coalesce(nullif(trim(p_nome), ''), nome),
      email = coalesce(nullif(trim(p_email), ''), email),
      etapa = coalesce(nullif(trim(p_etapa), ''), etapa),
      valor = coalesce(p_valor, valor),
      observacoes = coalesce(nullif(trim(p_observacoes), ''), observacoes),
      updated_at = now()
    where id = v_lead_id;
  else
    -- INSERT novo
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
  end if;

  return v_lead_id;
end;
$$;

-- Re-grant (idempotente)
grant execute on function intake_lead_from_sheets(
  text, text, text, text, text, numeric, timestamptz, text
) to anon, authenticated;
