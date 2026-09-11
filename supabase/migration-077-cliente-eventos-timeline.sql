-- =========================================================
-- Migration 077 — Timeline de alteracoes do cliente
-- =========================================================
-- Toda mudanca importante no cliente vira uma linha em
-- cliente_eventos. Duas fontes:
--
--   1) MANUAL — usuario registra na UI (ex: "Registrar Contato" na
--      Ficha, "Registrar Expansao", "Marcar Risco explicito"). O
--      tipo carrega meta especifica no jsonb.
--
--   2) AUTOMATICO — trigger em clientes UPDATE dispara insert quando
--      colunas de interesse mudam:
--        - status, semaforo         -> tipo='risco'
--        - jornada, jornada_social  -> tipo='jornada'
--        - servicos_contratados     -> tipo='servico'
--        - verba_mensal             -> tipo='mrr'
--        - nps                      -> tipo='nps'
--        - gestor_id, account_manager_id, social_media_id
--                                    -> tipo='responsavel'
--      Outras colunas (nome, nicho, updated_at, etc) NAO logam.
--      A intencao e' capturar movimentos que impactam a saude
--      comercial, nao editorial pura.
--
-- Feed lido na Ficha do Cliente (bloco Timeline de Alteracoes) em
-- ordem decrescente por criado_em.
--
-- RLS: aplicavel a authenticated users com acesso ao cliente.
-- Simples pra v1 — qualquer authenticated SELECT/INSERT, sem escopo
-- por role. Se precisar restringir depois, adiciona policy.
--
-- Idempotente — create table IF NOT EXISTS + drop/create trigger +
-- function.
-- =========================================================
begin;

create table if not exists cliente_eventos (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descricao text,
  meta jsonb default '{}'::jsonb,
  arquivos text[] default array[]::text[],
  criado_por uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

comment on table cliente_eventos is
  'Timeline de alteracoes do cliente. Fonte manual (registros na Ficha) e automatica (triggers de mudanca em clientes). Lido no bloco Timeline da Ficha.';

comment on column cliente_eventos.tipo is
  'Categoria do evento: contato, nps, risco, jornada, servico, mrr, responsavel, expansao, perda, etc.';

create index if not exists idx_cliente_eventos_cliente_data
  on cliente_eventos (cliente_id, criado_em desc);

-- RLS aberto pra authenticated (v1 simples). Ajustar dps se precisar
-- escopar por role/cargo.
alter table cliente_eventos enable row level security;

drop policy if exists "authenticated select cliente_eventos" on cliente_eventos;
create policy "authenticated select cliente_eventos" on cliente_eventos
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated insert cliente_eventos" on cliente_eventos;
create policy "authenticated insert cliente_eventos" on cliente_eventos
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "authenticated delete cliente_eventos" on cliente_eventos;
create policy "authenticated delete cliente_eventos" on cliente_eventos
  for delete using (auth.role() = 'authenticated');

grant select, insert, delete on cliente_eventos to authenticated;

-- =====================================================
-- Trigger auto-log em clientes UPDATE
-- =====================================================
-- Detecta mudanca em colunas de interesse e insere um evento no
-- feed. Usa arrays pra comparacao segura de servicos_contratados.

create or replace function trg_cliente_log_alteracoes()
returns trigger
language plpgsql
as $$
declare
  v_titulo text;
  v_descricao text;
  v_meta jsonb;
  v_ator uuid;
begin
  -- Ator: quem esta autenticado no request. Se e trigger interno
  -- (sem sessao), fica null.
  v_ator := auth.uid();

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

drop trigger if exists cliente_log_alteracoes on clientes;
create trigger cliente_log_alteracoes
  after update on clientes
  for each row
  execute function trg_cliente_log_alteracoes();

commit;
