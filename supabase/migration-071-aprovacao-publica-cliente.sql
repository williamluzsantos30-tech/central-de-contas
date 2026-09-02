-- =========================================================
-- Migration 071 — Aprovacao/rejeicao pelo cliente via link publico
-- =========================================================
-- Ate agora o cliente so olhava o calendario publico
-- (/publico/calendario/:token) — nao tinha como agir. Pra aprovar
-- ou pedir alteracao ele mandava mensagem no WhatsApp e alguem da
-- equipe atualizava o status no admin.
--
-- Esta migration expoe uma RPC unica que aceita as 2 acoes usando
-- o mesmo token do calendario publico (nao exige login):
--
--   acao = 'aprovar'  -> status vira 'conclusao'
--   acao = 'alterar'  -> status vira 'alteracao' + descricao_alteracao
--                        preenchida com a explicacao do cliente
--
-- Validacoes:
--   - Token tem que existir e cliente nao arquivado
--   - Item tem que pertencer ao cliente do token
--   - Producao tem que estar aprovada (aprovado_em nao null)
--   - Item tem que estar EM 'em_aprovacao' (evita acao duplicada
--     ou fora de contexto)
--   - Se acao='alterar', descricao tem que ter >= 3 chars
--
-- Idempotente — DROP + CREATE.
-- =========================================================
begin;

drop function if exists aprovar_ou_alterar_item_publico(text, uuid, text, text);

create function aprovar_ou_alterar_item_publico(
  p_token text,
  p_item_id uuid,
  p_acao text,
  p_descricao text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_cliente_id uuid;
  v_status_atual text;
begin
  -- 1) Valida token
  select id into v_cliente_id
    from clientes
   where calendario_publico_token = p_token
     and calendario_publico_token is not null
     and arquivado_em is null;

  if v_cliente_id is null then
    raise exception 'Link invalido ou expirado';
  end if;

  -- 2) Valida item pertence ao cliente e producao aprovada
  select i.status::text into v_status_atual
    from producoes_social_media_items i
    join producoes_social_media p on p.id = i.producao_id
   where i.id = p_item_id
     and p.cliente_id = v_cliente_id
     and p.aprovado_em is not null;

  if v_status_atual is null then
    raise exception 'Item nao encontrado';
  end if;

  if v_status_atual <> 'em_aprovacao' then
    raise exception 'Item ja foi processado (status atual: %)', v_status_atual;
  end if;

  -- 3) Aplica acao
  if p_acao = 'aprovar' then
    update producoes_social_media_items
       set status = 'conclusao'
     where id = p_item_id;
    return jsonb_build_object('ok', true, 'novo_status', 'conclusao');

  elsif p_acao = 'alterar' then
    if p_descricao is null or length(trim(p_descricao)) < 3 then
      raise exception 'Descreva o que precisa mudar (minimo 3 caracteres)';
    end if;
    update producoes_social_media_items
       set status = 'alteracao',
           descricao_alteracao = trim(p_descricao)
     where id = p_item_id;
    return jsonb_build_object('ok', true, 'novo_status', 'alteracao');

  else
    raise exception 'Acao invalida (use "aprovar" ou "alterar")';
  end if;
end;
$$;

grant execute on function aprovar_ou_alterar_item_publico(text, uuid, text, text)
  to anon, authenticated;

commit;
