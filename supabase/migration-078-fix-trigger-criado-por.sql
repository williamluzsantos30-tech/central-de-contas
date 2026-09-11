-- =========================================================
-- Migration 078 — Fix criado_por no trigger de cliente_eventos
-- =========================================================
-- Bug: o trigger trg_cliente_log_alteracoes (migration 077) setava
-- criado_por = auth.uid() diretamente. Mas auth.uid() retorna o ID de
-- auth.users.id, enquanto cliente_eventos.criado_por REFERENCIA
-- profiles.id — que e um UUID interno diferente, ligado a
-- auth.users via profiles.auth_user_id.
--
-- Resultado: qualquer update em clientes por um usuario logado
-- disparava insert em cliente_eventos com criado_por = <uid errado>,
-- violando a FK cliente_eventos_criado_por_fkey.
--
-- Fix: dentro do trigger, resolver o profile.id pelo auth.uid().
-- Se nao achar (usuario sem profile ainda, ou trigger interno), fica
-- null (a coluna aceita null).
--
-- Idempotente — DROP + CREATE FUNCTION.
-- =========================================================
begin;

create or replace function trg_cliente_log_alteracoes()
returns trigger
language plpgsql
as $$
declare
  v_titulo text;
  v_descricao text;
  v_ator uuid;
  v_uid uuid;
begin
  -- Resolve profiles.id a partir do auth.uid(). Se null (trigger interno
  -- sem sessao) ou usuario nao tem profile, fica null — a coluna e
  -- nullable.
  v_uid := auth.uid();
  if v_uid is not null then
    select id into v_ator from profiles where auth_user_id = v_uid limit 1;
  end if;

  -- 1) Status / semaforo
  if new.status is distinct from old.status then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'risco',
      case
        when new.status = 'atencao' then 'Cliente marcado em Atenção'
        when new.status = 'churn' then 'Cliente virou Churn'
        when new.status = 'pausado' then 'Cliente Pausado'
        when new.status = 'ativo' then 'Cliente reativado'
        else 'Status alterado'
      end,
      format('De "%s" para "%s"', coalesce(old.status::text, '—'), new.status::text),
      jsonb_build_object('de', old.status, 'para', new.status),
      v_ator
    );
  end if;

  -- 2) Jornada trafego
  if new.jornada is distinct from old.jornada then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'jornada',
      'Jornada alterada',
      format('De "%s" para "%s"',
        coalesce(old.jornada::text, '—'),
        coalesce(new.jornada::text, '—')),
      jsonb_build_object('campo', 'jornada', 'de', old.jornada, 'para', new.jornada),
      v_ator
    );
  end if;

  -- 3) Jornada social
  if new.jornada_social is distinct from old.jornada_social then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'jornada',
      'Jornada Social alterada',
      format('De "%s" para "%s"',
        coalesce(old.jornada_social::text, '—'),
        coalesce(new.jornada_social::text, '—')),
      jsonb_build_object('campo', 'jornada_social', 'de', old.jornada_social, 'para', new.jornada_social),
      v_ator
    );
  end if;

  -- 4) Servicos contratados
  if new.servicos_contratados is distinct from old.servicos_contratados then
    v_titulo := 'Serviços atualizados';
    v_descricao := format(
      'De [%s] para [%s]',
      array_to_string(coalesce(old.servicos_contratados, array[]::text[]), ', '),
      array_to_string(coalesce(new.servicos_contratados, array[]::text[]), ', ')
    );
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'servico', v_titulo, v_descricao,
      jsonb_build_object(
        'de', to_jsonb(old.servicos_contratados),
        'para', to_jsonb(new.servicos_contratados)
      ),
      v_ator
    );
  end if;

  -- 5) MRR (verba_mensal)
  if new.verba_mensal is distinct from old.verba_mensal then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'mrr',
      case
        when coalesce(new.verba_mensal, 0) > coalesce(old.verba_mensal, 0) then 'Expansão de MRR'
        when coalesce(new.verba_mensal, 0) < coalesce(old.verba_mensal, 0) then 'Redução de MRR'
        else 'MRR atualizado'
      end,
      format('R$ %s → R$ %s',
        coalesce(old.verba_mensal::text, '0'),
        coalesce(new.verba_mensal::text, '0')),
      jsonb_build_object('de', old.verba_mensal, 'para', new.verba_mensal),
      v_ator
    );
  end if;

  -- 6) NPS
  if new.nps is distinct from old.nps then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'nps',
      'NPS atualizado',
      format('NPS %s/10', coalesce(new.nps::text, '—')),
      jsonb_build_object('de', old.nps, 'para', new.nps),
      v_ator
    );
  end if;

  -- 7) Responsaveis (gestor, AM, social media)
  if new.gestor_id is distinct from old.gestor_id then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'responsavel', 'Gestor de Tráfego alterado',
      null,
      jsonb_build_object('campo', 'gestor_id', 'de', old.gestor_id, 'para', new.gestor_id),
      v_ator
    );
  end if;
  if new.account_manager_id is distinct from old.account_manager_id then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'responsavel', 'Account Manager alterado',
      null,
      jsonb_build_object('campo', 'account_manager_id', 'de', old.account_manager_id, 'para', new.account_manager_id),
      v_ator
    );
  end if;
  if new.social_media_id is distinct from old.social_media_id then
    insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta, criado_por)
    values (
      new.id, 'responsavel', 'Social Media alterado',
      null,
      jsonb_build_object('campo', 'social_media_id', 'de', old.social_media_id, 'para', new.social_media_id),
      v_ator
    );
  end if;

  return new;
end;
$$;

-- Trigger nao muda (mesma funcao, mesma tabela). Nem precisa DROP/CREATE
-- de novo — CREATE OR REPLACE FUNCTION acima ja atualizou o codigo que
-- o trigger executa.

commit;
