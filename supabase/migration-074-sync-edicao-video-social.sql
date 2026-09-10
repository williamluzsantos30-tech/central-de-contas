-- =========================================================
-- Migration 074 — Sync bidirecional edicoes_video <-> item social
-- =========================================================
-- Complementa a migration 073. Com 073, cada reel aprovado ja criou
-- uma edicao_video linkada via social_media_item_id.
--
-- Agora: quando o editor coloca a edicao em 'em_aprovacao' (ou muda
-- pra qualquer status "espelhavel"), o item de social media linkado
-- espelha esse status automaticamente — E o video_final_url da
-- edicao vira o artes_prontas do item social. Resultado: o cliente
-- ve o video no link publico do calendario e pode aprovar/reprovar
-- ali mesmo, sem que ninguem precise mexer no lado do social.
--
-- Fluxo:
--   1. Editor termina o corte, sobe em video_final_url e muda status
--      pra 'em_aprovacao'
--   2. Trigger espelha:
--        - producoes_social_media_items.status = 'em_aprovacao'
--        - producoes_social_media_items.artes_prontas = [video_final_url]
--   3. Cliente abre o link publico do calendario, ve o reel na aba
--      do dia da postagem, clica em Aprovar ou Pedir alteracao
--   4. RPC aprovar_ou_alterar_item_publico atualiza o SMI. TRIGGER
--      REVERSO (SMI -> EV) espelha status + descricao_alteracao de
--      volta pra edicao — o editor ve na esteira dele o que o cliente
--      pediu
--
-- Mapeamento de status:
--   EV 'em_aprovacao' <-> SMI 'em_aprovacao'
--   EV 'em_alteracao' <-> SMI 'alteracao'
--   EV 'conclusao'    <-> SMI 'conclusao'
--
--   EV 'pendente'/'em_edicao' NAO tem status equivalente no lado social
--   (a esteira do social nao expoe design em curso). Nao mexem no SMI.
--
-- Anti-loop:
--   Cada trigger le o status atual do OUTRO lado antes de escrever.
--   Se ja esta sincronizado, no-op — o trigger recursivo nao dispara
--   update, entao a cadeia para na primeira iteracao. Simples e
--   idempotente.
--
-- Idempotente — DROP + CREATE.
-- =========================================================
begin;

-- 1) Trigger: edicoes_video -> producoes_social_media_items
create or replace function trg_edicao_video_espelha_no_social()
returns trigger
language plpgsql
as $$
declare
  v_target_sm_status text;
  v_sm_status_atual text;
  v_sm_artes jsonb;
begin
  -- So espelha edicoes que tem item social linkado
  if new.social_media_item_id is null then
    return new;
  end if;

  -- So dispara em mudanca real de status (evita self-loop no UPDATE
  -- de outras colunas, tipo arquivos[])
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Mapa EV -> SMI. Nulo = status sem equivalente (pendente/em_edicao)
  v_target_sm_status := case new.status
    when 'em_aprovacao' then 'em_aprovacao'
    when 'em_alteracao' then 'alteracao'
    when 'conclusao'    then 'conclusao'
    else null
  end;

  if v_target_sm_status is null then
    return new;
  end if;

  -- Le o SMI. Se ja esta no status alvo, no-op (anti-loop)
  select status::text, artes_prontas
    into v_sm_status_atual, v_sm_artes
    from producoes_social_media_items
   where id = new.social_media_item_id;

  if v_sm_status_atual = v_target_sm_status then
    return new;
  end if;

  update producoes_social_media_items
     set status = v_target_sm_status::status_social_media,
         -- Quando entra em em_aprovacao, sobe o video final pro
         -- artes_prontas do SMI (que e' o que o link publico do
         -- calendario expoe pro cliente). Sobrescreve o array
         -- inteiro — o video final e' O que o cliente aprova, nao
         -- artes intermediarias.
         artes_prontas = case
           when v_target_sm_status = 'em_aprovacao'
            and new.video_final_url is not null
             then jsonb_build_array(new.video_final_url)
           else artes_prontas
         end,
         -- Quando volta pra alteracao, propaga tambem a descricao
         -- (caso o editor tenha preenchido). Se veio do cliente pelo
         -- link, ja vai chegar aqui via o outro trigger.
         descricao_alteracao = case
           when v_target_sm_status = 'alteracao'
             then coalesce(new.descricao_alteracao, descricao_alteracao)
           else descricao_alteracao
         end
   where id = new.social_media_item_id;

  return new;
end;
$$;

drop trigger if exists edicao_video_espelha_no_social on edicoes_video;
create trigger edicao_video_espelha_no_social
  after update on edicoes_video
  for each row
  execute function trg_edicao_video_espelha_no_social();


-- 2) Trigger reverso: producoes_social_media_items -> edicoes_video
create or replace function trg_social_espelha_na_edicao_video()
returns trigger
language plpgsql
as $$
declare
  v_target_ev_status text;
  v_ev_status_atual text;
begin
  -- So dispara em mudanca real de status
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Mapa SMI -> EV
  v_target_ev_status := case new.status::text
    when 'em_aprovacao' then 'em_aprovacao'
    when 'alteracao'    then 'em_alteracao'
    when 'conclusao'    then 'conclusao'
    else null
  end;

  if v_target_ev_status is null then
    return new;
  end if;

  -- Le a edicao vinculada. Se nao existe (item avulso), sai
  select status into v_ev_status_atual
    from edicoes_video
   where social_media_item_id = new.id
   limit 1;

  if v_ev_status_atual is null then
    return new;
  end if;

  -- Se ja ta sincronizado, no-op (anti-loop)
  if v_ev_status_atual = v_target_ev_status then
    return new;
  end if;

  update edicoes_video
     set status = v_target_ev_status,
         descricao_alteracao = case
           when v_target_ev_status = 'em_alteracao'
             then coalesce(new.descricao_alteracao, descricao_alteracao)
           else descricao_alteracao
         end
   where social_media_item_id = new.id;

  return new;
end;
$$;

drop trigger if exists social_espelha_na_edicao_video on producoes_social_media_items;
create trigger social_espelha_na_edicao_video
  after update on producoes_social_media_items
  for each row
  execute function trg_social_espelha_na_edicao_video();

commit;
