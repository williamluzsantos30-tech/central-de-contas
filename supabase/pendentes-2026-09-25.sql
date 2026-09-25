-- =====================================================================
-- MIGRATIONS PENDENTES — auditoria de 25/09/2026
-- =====================================================================
-- ⚠⚠ RODE NO PROJETO DO DOMUS — o endereço do painel
--    (supabase.com/dashboard/project/<ref>) começa com "ikekfj".
--    NÃO é o projeto "central contas" (produção do Central): são bancos
--    DIFERENTES (confirmado em 25/09 — lá a 064 já existia, aqui não).
--
-- Auditoria feita só por leitura: existência de tabelas/colunas.
-- Já aplicadas aqui: 001–060 (exceto 031 e 047), 062, 065–075, 083 — e a
-- 076 do CENTRAL (concluido_em), que foi rodada aqui por engano (inofensiva:
-- só uma coluna a mais que o domus não usa).
--
-- COMO RODAR
--   1. Supabase → SQL Editor → New query → cole este arquivo INTEIRO → Run.
--      Só a PARTE 1 está ativa; as Partes 2 e 3 estão comentadas.
--   2. A Parte 1 é idempotente (IF NOT EXISTS / DROP IF EXISTS / CREATE OR
--      REPLACE): se der erro no meio, me mande a mensagem, corrija e rode
--      de novo sem medo.
--   3. Depois me peça pra re-auditar que eu confiro o que entrou.
--
-- FICOU DE FORA DE PROPÓSITO
--   - Migrations antigas que só criam FUNÇÕES (004, 005, 007, 017, 026, 033,
--     034, 039, 041, 046, 048, 051, 052, 054–058, 063/064 de planejamento,
--     071, 074): não dá pra verificar funções sem executá-las, as vizinhas
--     estão aplicadas, e rodar uma versão antiga por cima SOBRESCREVERIA a
--     versão mais nova da função (ex.: 017 desfaria a 048).
--   - SQL de "reset"/limpeza que já te mandei no chat (apagar produções,
--     verificações de conta etc.): destrutivo, não se repete.
-- =====================================================================


-- #####################################################################
-- PARTE 1 — SEGURA (idempotente) — RODE INTEIRA
-- #####################################################################


-- ─────────────────────────────────────────────────────────────────────
-- [031] Log de exclusão de tarefas (aba Auditoria do Admin, domus e Central)
-- (migration-031-tarefas-log.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 031 — Log de exclusões de tarefas (auditoria)
-- =========================================================
-- Quando alguém deleta uma tarefa, o sistema registra:
--   • Qual era a tarefa (snapshot completo dos dados)
--   • Quem deletou (auth.uid() + nome + email do profile)
--   • Quando
--   • Qual cliente
--
-- Acessível em /admin → aba "Auditoria".
--
-- Idempotente.
-- =========================================================

-- 1) Tabela de log
create table if not exists tarefas_log (
  id uuid primary key default gen_random_uuid(),
  acao text not null,
  tarefa_id uuid not null,
  tarefa_data jsonb not null,
  ator_user_id uuid,
  ator_nome text,
  ator_email text,
  cliente_id uuid,
  created_at timestamptz default now()
);

comment on table tarefas_log is
  'Log de açoes em tarefas (exclusao por enquanto). Snapshot dos dados antes + quem fez.';

create index if not exists idx_tarefas_log_created_at
  on tarefas_log(created_at desc);
create index if not exists idx_tarefas_log_ator
  on tarefas_log(ator_user_id);

-- 2) Trigger: AFTER DELETE em tarefas
create or replace function trg_log_tarefa_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_nome text;
  v_email text;
begin
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if v_user_id is not null then
    select nome, email into v_nome, v_email
    from profiles
    where id = v_user_id;
  end if;

  insert into tarefas_log (
    acao, tarefa_id, tarefa_data, ator_user_id, ator_nome, ator_email, cliente_id
  ) values (
    'delete',
    old.id,
    to_jsonb(old),
    v_user_id,
    v_nome,
    v_email,
    old.cliente_id
  );

  return old;
end;
$$;

drop trigger if exists log_tarefa_delete on tarefas;
create trigger log_tarefa_delete
  after delete on tarefas
  for each row
  execute function trg_log_tarefa_delete();

-- 3) RLS — qualquer auth pode ler (a UI restringe acesso ao Admin)
alter table tarefas_log enable row level security;

drop policy if exists "auth read tarefas_log" on tarefas_log;
drop policy if exists "auth write tarefas_log" on tarefas_log;

create policy "auth read tarefas_log"
  on tarefas_log
  for select
  using (auth.role() = 'authenticated');

-- Escrita só via trigger (SECURITY DEFINER), não permite INSERT direto

-- 4) Confirmação
select count(*) as total_logs from tarefas_log;


-- ─────────────────────────────────────────────────────────────────────
-- [047] clientes.gcal_event_id (vínculo com evento do Google Calendar da call)
-- (migration-047-gcal-event-id.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================
-- Migration 047 — Persiste o ID do evento no Google Calendar
-- =============================================================
-- Guarda o gcal_event_id (retornado pelo n8n após criar o evento)
-- pra permitir que futuros marcar-realizada / editar-data ATUALIZEM
-- o evento existente em vez de criar duplicatas.
-- =============================================================
begin;

alter table clientes
  add column if not exists gcal_event_id text;

commit;


-- ─────────────────────────────────────────────────────────────────────
-- [061] Prazo de 1 dia útil na alteração de vídeo (versão mais recente da função)
-- (migration-061-alteracao-prazo-1-dia-video.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 061 — Alteracao redefine prazo do video em 1 dia util
-- =========================================================
-- Regra: sempre que um video vai pra status='em_alteracao', o `prazo`
-- eh redefinido pra HOJE + 1 dia util. Ideia: cliente pediu alteracao
-- AGORA, editor tem 1 dia util pra devolver.
--
-- Assim, mesmo se o video tinha prazo antigo (calculado pela fila do
-- cliente na migration 023), o SLA da alteracao eh CURTO — nao herda
-- o prazo original de producao.
--
-- Ao voltar de em_alteracao pra outro status (em_edicao / em_aprovacao
-- / etc), o item volta pra fila normal e o prazo eh recalculado pelo
-- trigger existente (recalcular_prazos_edicao_video).
--
-- Se o cliente pedir alteracao 3 vezes seguidas (em_alteracao ->
-- em_aprovacao -> em_alteracao ...), cada entrada em em_alteracao
-- RESETA o prazo pra +1 dia util a partir daquele momento. Justo com
-- o editor — cada volta reseta.
--
-- Dois ajustes:
--
--   1) Novo trigger BEFORE UPDATE que seta new.prazo quando status
--      transita PARA em_alteracao.
--
--   2) recalcular_prazos_edicao_video() (migration 023) passa a
--      EXCLUIR items em em_alteracao — eles tem prazo proprio curto,
--      nao deveriam ser sobrescritos pelo recalculo geral do grupo.
--
-- Idempotente.
-- =========================================================
begin;

-- 1) Trigger que seta prazo=hoje+1 dia util na entrada em em_alteracao
create or replace function trg_edicao_video_prazo_alteracao()
returns trigger
language plpgsql
as $$
begin
  -- Dispara so na TRANSICAO pra em_alteracao (nao em cada UPDATE do row).
  -- old.status = null cobre INSERT (nao deveria acontecer pra em_alteracao
  -- mas por seguranca).
  if new.status = 'em_alteracao'
     and (old.status is null or old.status <> 'em_alteracao') then
    new.prazo := add_business_days(current_date, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists edicao_video_prazo_alteracao on edicoes_video;
create trigger edicao_video_prazo_alteracao
  before insert or update of status on edicoes_video
  for each row
  execute function trg_edicao_video_prazo_alteracao();

-- 2) Recalculo geral (migration 023) passa a ignorar items em em_alteracao.
--    Eles tem prazo proprio (curto) setado pelo trigger acima; o
--    recalculo por fila de producao nao se aplica a eles enquanto o
--    cliente esta pedindo alteracoes.
create or replace function recalcular_prazos_edicao_video(p_cliente_id uuid)
returns void
language plpgsql
as $$
begin
  with items_ordenados as (
    select id,
           row_number() over (order by ordem asc, created_at asc) as posicao,
           coalesce(aprovado_em::date, created_at::date) as ref_date
    from edicoes_video
    where cliente_id = p_cliente_id
      -- Exclui concluidos (nao tem prazo relevante) e em_alteracao
      -- (tem prazo proprio de 1 dia util setado pelo trigger).
      and status not in ('conclusao', 'em_alteracao')
  )
  update edicoes_video e
     set prazo = add_business_days(
           io.ref_date,
           ceil(io.posicao::numeric / 2)::int * 3
         )
    from items_ordenados io
   where e.id = io.id;
end;
$$;

commit;

-- =========================================================
-- Testes uteis (rodar manualmente pra validar):
--
-- -- 1) Ver o prazo antes de mudar pra alteracao
-- select id, titulo, status, prazo from edicoes_video where id = '<uuid>';
--
-- -- 2) Muda pra em_alteracao
-- update edicoes_video set status = 'em_alteracao' where id = '<uuid>';
--
-- -- 3) Confere que prazo virou hoje + 1 dia util (segunda se hoje for sexta)
-- select id, titulo, status, prazo, current_date as hoje,
--        add_business_days(current_date, 1) as esperado
--   from edicoes_video where id = '<uuid>';
--
-- -- 4) Muda de volta pra em_edicao — prazo eh recalculado pela fila
-- update edicoes_video set status = 'em_edicao' where id = '<uuid>';
-- select prazo from edicoes_video where id = '<uuid>';
-- =========================================================


-- ─────────────────────────────────────────────────────────────────────
-- [063] Tabela meta_integracao_cliente + view pública
-- (migration-063-meta-integracao-cliente.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 063 — Meta Instagram integration per cliente
-- =========================================================
-- Armazena o vinculo OAuth entre cada cliente e a conta Instagram
-- Business dele. Uma linha por cliente que autorizou a MovMed a ler
-- as metricas do IG dele.
--
-- Token de acesso e' LONG-LIVED (60 dias, renovavel). Guardado como
-- bytea encriptado — a chave de encripitacao mora no env da Edge
-- Function (SUPABASE_ENCRYPTION_KEY). Frontend NUNCA le esse campo,
-- so as Edge Functions descriptam.
--
-- RLS: so `service_role` le/escreve. Users comuns nao acessam. Isso
-- protege os tokens mesmo se alguem conseguir o anon key.
--
-- Idempotente.
-- =========================================================
begin;

create table if not exists meta_integracao_cliente (
  cliente_id           uuid primary key references clientes(id) on delete cascade,

  -- IDs da Meta Graph API
  ig_user_id           text not null,             -- Instagram User ID (numerico)
  ig_username          text,                      -- @handle (pra display)
  page_id              text,                      -- Facebook Page ID conectada
  page_name            text,                      -- Nome da Page (pra display)

  -- Token OAuth long-lived (60 dias). Bytea = encriptado pela Edge Function.
  -- Nunca gravar plain text aqui.
  access_token_encrypted bytea not null,
  token_expires_at     timestamptz not null,      -- quando o token expira

  -- Rastreio de sync
  ultima_sync          timestamptz,               -- ultima vez que buscamos insights
  ultima_sync_status   text,                      -- 'ok' | 'error: xxx'
  ultima_sync_erro     text,                      -- mensagem de erro do ultimo fail

  autorizado_em        timestamptz default now(),
  autorizado_por_email text,                      -- email do user que fez a autorizacao (do medico ou do time)

  updated_at           timestamptz default now(),

  constraint token_nao_expirado_no_insert check (token_expires_at > autorizado_em)
);

comment on table meta_integracao_cliente is
  'Vinculo OAuth entre cliente e conta Instagram Business dele. Token long-lived (60d) encriptado. RLS restringe a service_role. Edge Functions gerenciam.';

create index if not exists idx_meta_integracao_expires
  on meta_integracao_cliente(token_expires_at)
  where token_expires_at is not null;

create index if not exists idx_meta_integracao_ultima_sync
  on meta_integracao_cliente(ultima_sync);

-- Trigger updated_at
create or replace function trg_meta_integracao_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists meta_integracao_updated_at on meta_integracao_cliente;
create trigger meta_integracao_updated_at
  before update on meta_integracao_cliente
  for each row execute function trg_meta_integracao_updated_at();

-- RLS: bloqueado por padrao, so service_role acessa
alter table meta_integracao_cliente enable row level security;

drop policy if exists "service_role manages meta_integracao" on meta_integracao_cliente;
create policy "service_role manages meta_integracao"
  on meta_integracao_cliente
  for all
  using (auth.role() = 'service_role');

-- Anon e authenticated podem ler APENAS metadata (nunca o token)
-- via view separada, exposta abaixo.
drop view if exists meta_integracao_cliente_public;
create view meta_integracao_cliente_public
with (security_invoker = true)
as
select
  cliente_id,
  ig_username,
  page_name,
  ultima_sync,
  ultima_sync_status,
  autorizado_em,
  case
    when token_expires_at < now()                     then 'expirado'
    when token_expires_at < now() + interval '7 days' then 'expira_em_breve'
    else 'ok'
  end as token_status
from meta_integracao_cliente;

comment on view meta_integracao_cliente_public is
  'Versao "safe" da tabela — nao expoe access_token nem ig_user_id. Frontend pode ler pra mostrar status da integracao.';

grant select on meta_integracao_cliente_public to authenticated;

commit;

-- =========================================================
-- Proximos passos (nao aqui — nas migrations 064, 065 e Edge Functions):
--
-- 064: estende metricas_social_mensal com sync_source e sincronizado_em
-- 065: helpers de encripitacao (se usar pgsodium) OR feito em JS na Edge
--
-- Edge Functions:
--   - meta-oauth-callback  : recebe code do OAuth, troca por token,
--                            encripta e salva
--   - meta-sync-insights   : busca insights de todos os clientes
--                            autorizados no dia
--   - meta-refresh-tokens  : renova tokens que expiram em <15 dias
-- =========================================================


-- ─────────────────────────────────────────────────────────────────────
-- [064] cliente_metricas_social.sync_source / sincronizado_em
-- (migration-064-metricas-social-sync-source.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 064 — Rastreio de origem das metricas social
-- =========================================================
-- Adiciona 2 campos em cliente_metricas_social pra saber se cada
-- registro veio da integracao com Meta ou foi preenchido a mao:
--
--   sync_source        text  — 'manual' (default) | 'meta_api'
--   sincronizado_em    timestamptz — ultima sync bem sucedida
--
-- Usos:
--   1. UI mostra "⟳ Sincronizado ha X" ou "✎ Preenchido manualmente"
--   2. Sync do Meta so sobrescreve registros source=manual se o user
--      pedir explicitamente ("re-sincronizar este mes") — respeita
--      overrides manuais.
--   3. Auditoria: saber quando foi a ultima vez que dados vieram da API.
--
-- Idempotente.
-- =========================================================
begin;

alter table cliente_metricas_social
  add column if not exists sync_source     text not null default 'manual',
  add column if not exists sincronizado_em timestamptz;

comment on column cliente_metricas_social.sync_source is
  'Origem dos dados: manual (preenchido pela pessoa) ou meta_api (buscado da Meta Graph API automaticamente).';

comment on column cliente_metricas_social.sincronizado_em is
  'Timestamp da ultima sincronizacao bem-sucedida com Meta API. Null pra registros preenchidos manualmente.';

-- idempotente: permite rodar de novo sem "constraint already exists"
alter table cliente_metricas_social
  drop constraint if exists sync_source_valido;
alter table cliente_metricas_social
  add constraint sync_source_valido
    check (sync_source in ('manual', 'meta_api'));

commit;


-- ─────────────────────────────────────────────────────────────────────
-- [076] clientes.servicos_contratados (serviços marcados na Ficha)
-- (migration-076-servicos-contratados.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 076 — Servicos Contratados por cliente
-- =========================================================
-- Ate agora "servicos contratados" era derivado de clientes.modulos
-- (trafego + social_media), mas isso mistura 2 conceitos:
--   modulos           = ROUTING operacional (quais esteiras esse
--                        cliente participa: trafego, social_media)
--   servicos_contratados = REALIDADE COMERCIAL (o que ele contratou:
--                        trafego pago, landing page, CRM, id.
--                        visual, salvia, etc)
--
-- Os dois nao sao 1:1. Um cliente pode ter contratado "Landing Page"
-- (servico) mas nao esta em nenhuma esteira operacional de landing
-- (ele so contratou pra ter o pacote). O contrario tambem existe.
--
-- Solucao: array text[] separado. Sem enum — os servicos vao mudando
-- com o tempo (novos produtos entram, outros saem), text[] deixa
-- flexivel sem migration cada vez.
--
-- Backfill: clientes com modulo 'trafego' ja tinham vendido trafego,
-- entao ganham 'trafego_pago' automatico. Idem 'social_media'.
--
-- Idempotente — add column IF NOT EXISTS + WHERE null-safe no
-- backfill.
-- =========================================================
begin;

alter table clientes
  add column if not exists servicos_contratados text[] not null default array[]::text[];

comment on column clientes.servicos_contratados is
  'Servicos comerciais contratados pelo cliente: trafego_pago, social_media, landing_page, comercial_crm, identidade_visual, salvia, etc. Separado de modulos (que e routing operacional).';

-- Backfill baseado nos modulos existentes
update clientes
   set servicos_contratados = array_append(servicos_contratados, 'trafego_pago')
 where 'trafego' = any(modulos)
   and not ('trafego_pago' = any(servicos_contratados));

update clientes
   set servicos_contratados = array_append(servicos_contratados, 'social_media')
 where 'social_media' = any(modulos)
   and not ('social_media' = any(servicos_contratados));

-- Confirma o backfill
select
  count(*) filter (where 'trafego_pago' = any(servicos_contratados)) as com_trafego,
  count(*) filter (where 'social_media' = any(servicos_contratados)) as com_social,
  count(*) as total_clientes
from clientes;

commit;


-- ─────────────────────────────────────────────────────────────────────
-- [077] Linha do tempo do cliente (cliente_eventos + trigger de alterações)
-- (migration-077-cliente-eventos-timeline.sql)
-- ─────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────
-- [078] Correção do trigger da 077 (autor do evento)
-- (migration-078-fix-trigger-criado-por.sql)
-- ─────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────
-- [079] Pesquisas de NPS (nps_surveys + funções públicas)
-- (migration-079-nps-surveys.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 079 — NPS Surveys (Onboarding + Operacao) via link publico
-- =========================================================
-- 2 formularios diferentes por natureza do momento do cliente:
--   ONBOARDING — Primeiro ciclo (30 dias). Avalia clareza da entrada,
--                comunicacao, prazos, planejamento, atendimento.
--   OPERACAO   — Cliente ativo, campanhas rodando. Avalia resultados
--                percebidos, comunicacao continua, expectativa x
--                realidade, continuidade.
--
-- Fluxo:
--   1. Admin clica "Enviar NPS" na Ficha do cliente + escolhe tipo
--   2. INSERT em nps_surveys gera token unico
--   3. Link publico `/publico/nps/<token>` — cliente responde sem login
--   4. Ao responder, respondido_em vira not null, nps_score preenchido
--      (extraido da pergunta principal 0-10 do formulario)
--   5. Trigger dispara evento em cliente_eventos tipo='nps' + atualiza
--      cliente.nps com o score
--
-- Respostas ficam num jsonb no proprio row do survey (nao precisa
-- tabela filha pra v1 — perguntas nao mudam entre respostas).
-- =========================================================
begin;

create table if not exists nps_surveys (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null check (tipo in ('onboarding', 'operacao')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  criado_por uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  respondido_em timestamptz,
  nps_score integer check (nps_score is null or (nps_score >= 0 and nps_score <= 10)),
  respostas jsonb default '{}'::jsonb
);

comment on table nps_surveys is
  'NPS surveys enviadas via link publico. Um survey = um link enviado ao cliente pra responder uma vez.';

create index if not exists idx_nps_surveys_cliente
  on nps_surveys (cliente_id, criado_em desc);
create index if not exists idx_nps_surveys_token on nps_surveys (token);

-- RLS
alter table nps_surveys enable row level security;

-- Authenticated ve/cria/deleta pros seus clientes (v1 simples — dps
-- pode escopar por AM)
drop policy if exists "authenticated all nps_surveys" on nps_surveys;
create policy "authenticated all nps_surveys" on nps_surveys
  for all using (auth.role() = 'authenticated');

-- Anon pode LER survey pelo token (pra carregar o formulario publico)
drop policy if exists "anon read nps_surveys via token" on nps_surveys;
create policy "anon read nps_surveys via token" on nps_surveys
  for select using (true);

-- Anon pode ATUALIZAR (respostas + score + respondido_em) — mas so
-- se ainda nao respondeu. Uso RPC pra controle fino em vez de policy
-- de update aberta.
grant select, insert, update, delete on nps_surveys to authenticated;
grant select on nps_surveys to anon;

-- ==========================================================
-- RPC publica: cliente responde survey pelo token
-- ==========================================================

create or replace function responder_nps_publico(
  p_token text,
  p_respostas jsonb,
  p_nps_score integer
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_survey nps_surveys%rowtype;
begin
  -- Valida token
  select * into v_survey from nps_surveys where token = p_token;
  if v_survey.id is null then
    raise exception 'Link invalido';
  end if;
  if v_survey.respondido_em is not null then
    raise exception 'Este link ja foi respondido';
  end if;
  if p_nps_score is null or p_nps_score < 0 or p_nps_score > 10 then
    raise exception 'Score NPS deve ser entre 0 e 10';
  end if;

  -- Marca resposta
  update nps_surveys
     set respostas = p_respostas,
         nps_score = p_nps_score,
         respondido_em = now()
   where id = v_survey.id;

  -- Atualiza cliente.nps (o trigger auto-log ja cria evento em
  -- cliente_eventos tipo='nps' com o diff)
  update clientes
     set nps = p_nps_score
   where id = v_survey.cliente_id;

  -- Insere evento explicito com metadata rico pra timeline mostrar
  -- que foi via link publico + o tipo do survey
  insert into cliente_eventos (cliente_id, tipo, titulo, descricao, meta)
  values (
    v_survey.cliente_id,
    'nps',
    'NPS Registrado',
    format('NPS %s/10 registrado via link publico (%s)',
      p_nps_score,
      case v_survey.tipo
        when 'onboarding' then 'Onboarding'
        when 'operacao' then 'Operacao'
        else v_survey.tipo
      end),
    jsonb_build_object(
      'para', p_nps_score,
      'tipo_survey', v_survey.tipo,
      'via', 'link_publico',
      'survey_id', v_survey.id
    )
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function responder_nps_publico(text, jsonb, integer)
  to anon, authenticated;

-- Consulta publica: carrega o survey pra o formulario renderizar
create or replace function get_nps_survey_publico(p_token text)
returns table (
  survey_id uuid,
  cliente_nome text,
  cliente_instagram text,
  tipo text,
  ja_respondido boolean,
  tem_social_media boolean
)
language sql
security definer
stable
as $$
  select
    s.id,
    c.nome,
    c.instagram_handle,
    s.tipo,
    s.respondido_em is not null,
    'social_media' = any(c.modulos)
  from nps_surveys s
  join clientes c on c.id = s.cliente_id
  where s.token = p_token;
$$;

grant execute on function get_nps_survey_publico(text) to anon, authenticated;

commit;


-- ─────────────────────────────────────────────────────────────────────
-- [080] Contrato do cliente (tipo, início, fim, status, responsável)
-- (migration-080-contrato.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 080 — Contrato do cliente
-- =========================================================
-- Contrato e' informacao comercial estruturada — tipo, datas de
-- inicio/fim, responsavel pela renovacao. Alem de ficar visivel na
-- Ficha, essa data vai alimentar automaticamente o modulo Financeiro
-- (v2): quando o contrato estiver perto do fim, dispara alertas de
-- renovacao; quando estiver ativo, entra nas projeccoes de MRR do
-- proximo periodo.
--
-- Colunas em clientes:
--   contrato_tipo             text ('mensal', '3_meses', '6_meses',
--                                    '12_meses', 'anual', 'indefinido')
--   contrato_inicio           date
--   contrato_fim              date
--   contrato_status           text ('ativo', 'renovado', 'encerrado',
--                                    'pausado')
--   contrato_responsavel_id   uuid → profiles(id) — responsavel pela
--                             renovacao
--
-- Sem enum — mantem flexivel pra novos tipos entrarem sem migration
-- (mesmo padrao de servicos_contratados).
--
-- O trigger auto-log ja captura mudancas em varios campos de clientes;
-- vou adicionar as colunas de contrato a esse trigger na proxima
-- migration (nao aqui — separado pra manter contexto pequeno).
--
-- Idempotente — todos os add column IF NOT EXISTS.
-- =========================================================
begin;

alter table clientes
  add column if not exists contrato_tipo text,
  add column if not exists contrato_inicio date,
  add column if not exists contrato_fim date,
  add column if not exists contrato_status text,
  add column if not exists contrato_responsavel_id uuid references profiles(id) on delete set null;

comment on column clientes.contrato_tipo is 'Tipo do contrato: mensal | 3_meses | 6_meses | 12_meses | anual | indefinido';
comment on column clientes.contrato_inicio is 'Data de inicio do contrato atual (renovacoes atualizam esse campo)';
comment on column clientes.contrato_fim is 'Data de fim do contrato. Usado pra calcular dias restantes e alertar renovacao';
comment on column clientes.contrato_status is 'Status: ativo | renovado | encerrado | pausado';
comment on column clientes.contrato_responsavel_id is 'Profile responsavel pela renovacao do contrato — pode ser diferente do AM';

create index if not exists idx_clientes_contrato_fim
  on clientes (contrato_fim)
  where contrato_fim is not null;

commit;


-- ─────────────────────────────────────────────────────────────────────
-- [081] Portal do cliente (token, etapas de onboarding, config da agência)
-- (migration-081-portal-cliente.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 081 — Portal do Cliente (link publico read-only)
-- =========================================================
-- Pagina publica /publico/portal/<token> onde o cliente da agencia
-- acompanha: contrato, investimento mensal, fase da jornada,
-- progresso do onboarding, metricas mensais (CPL/CAC/faturamento/
-- ROAS/vendas) e os logins que a agencia liberou pra ele ver.
--
-- 3 mudancas de schema + 2 RPCs:
--
--   clientes.portal_token          — token por cliente (padrao 050,
--                                    default gen_random_bytes como 079)
--   clientes.onboarding_etapas     — jsonb {etapa_key: {concluido_em}}
--                                    template das etapas fica no front
--                                    (src/lib/onboardingTemplate.ts)
--   logins_acessos.visivel_portal  — opt-in: so logins marcados
--                                    aparecem pro cliente. Default false
--                                    (seguro por padrao)
--
--   gerar_portal_token(cliente_id) — authenticated. Gera/regenera.
--   get_portal_publico(token)      — anon. Devolve tudo num jsonb.
--
-- Metricas vem da tabela `metas` (resultado_data jsonb). CPL/CAC/
-- ROAS/faturamento sao derivados no front (mesma formula do
-- MetasPanel.computeCalculos) — nao persistidos.
--
-- Idempotente.
-- =========================================================
begin;

alter table clientes
  add column if not exists portal_token text,
  add column if not exists onboarding_etapas jsonb not null default '{}'::jsonb;

create unique index if not exists idx_clientes_portal_token
  on clientes (portal_token)
  where portal_token is not null;

comment on column clientes.portal_token is
  'Token do link publico do Portal do Cliente (/publico/portal/<token>). Regerar invalida o anterior.';
comment on column clientes.onboarding_etapas is
  'Progresso do onboarding: {etapa_key: {concluido_em: timestamptz|null}}. Template das etapas em src/lib/onboardingTemplate.ts.';

alter table logins_acessos
  add column if not exists visivel_portal boolean not null default false;

comment on column logins_acessos.visivel_portal is
  'Se true, o login aparece no Portal do Cliente. Default false — a agencia escolhe o que expor.';

-- ---------------------------------------------------------
-- Cobranca — por cliente
-- ---------------------------------------------------------
-- Semente do modulo Financeiro. Por enquanto so o que o Portal
-- precisa mostrar pro cliente executar o pagamento.
alter table clientes
  add column if not exists dia_vencimento smallint
    check (dia_vencimento is null or (dia_vencimento >= 1 and dia_vencimento <= 31)),
  add column if not exists forma_pagamento text;

comment on column clientes.dia_vencimento is 'Dia do mes em que o pagamento vence (1-31). Null = nao definido.';
comment on column clientes.forma_pagamento is 'pix | boleto | cartao | transferencia | outro';

-- ---------------------------------------------------------
-- Cobranca — da agencia (config global, 1 linha)
-- ---------------------------------------------------------
-- Tabela key/value de configuracoes da agencia. Comeca com dados de
-- cobranca (PIX, razao social, CNPJ) mas vai crescer com o Financeiro
-- (regime tributario, conta bancaria, etc). Uma linha por chave.
create table if not exists configuracoes_agencia (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references profiles(id) on delete set null
);

comment on table configuracoes_agencia is
  'Configuracoes globais da agencia (key/value jsonb). Ex: chave=cobranca -> {pix_chave, pix_tipo, pix_nome, razao_social, cnpj, instrucoes}.';

alter table configuracoes_agencia enable row level security;

drop policy if exists "authenticated read config" on configuracoes_agencia;
create policy "authenticated read config" on configuracoes_agencia
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated write config" on configuracoes_agencia;
create policy "authenticated write config" on configuracoes_agencia
  for all using (auth.role() = 'authenticated');

grant select, insert, update on configuracoes_agencia to authenticated;

-- Seed vazio da chave 'cobranca' pra o admin so precisar editar
insert into configuracoes_agencia (chave, valor)
values ('cobranca', '{}'::jsonb)
on conflict (chave) do nothing;

-- ---------------------------------------------------------
-- RPC: gerar/regenerar token (authenticated)
-- ---------------------------------------------------------
create or replace function gerar_portal_token(p_cliente_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_token text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'nao autorizado';
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  update clientes set portal_token = v_token where id = p_cliente_id;
  if not found then
    raise exception 'cliente nao encontrado';
  end if;
  return v_token;
end;
$$;

grant execute on function gerar_portal_token(uuid) to authenticated;

-- ---------------------------------------------------------
-- RPC: dados do portal (anon, via token)
-- ---------------------------------------------------------
-- Retorna um unico jsonb. Nao expoe id do cliente nem campos internos
-- (status de risco, semaforo, observacoes, verba de anuncio detalhada).
-- Logins: SO os com visivel_portal=true.
-- Metricas: ultimos 12 meses de `metas`, ordenados desc.
create or replace function get_portal_publico(p_token text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_c clientes%rowtype;
  v_am text;
  v_gestor text;
  v_social text;
  v_logins jsonb;
  v_metas jsonb;
  v_cobranca jsonb;
begin
  select * into v_c
    from clientes
   where portal_token = p_token
     and portal_token is not null
     and arquivado_em is null;

  if v_c.id is null then
    return null;
  end if;

  select nome into v_am from profiles where id = v_c.account_manager_id;
  select nome into v_gestor from profiles where id = v_c.gestor_id;
  select nome into v_social from profiles where id = v_c.social_media_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'plataforma', l.plataforma,
           'login', l.login,
           'senha', l.senha,
           'url', l.url
         ) order by l.plataforma), '[]'::jsonb)
    into v_logins
    from logins_acessos l
   where l.cliente_id = v_c.id
     and l.visivel_portal = true;

  select coalesce(jsonb_agg(jsonb_build_object(
           'mes_ano', m.mes_ano,
           'resultado_data', m.resultado_data,
           'meta_leads', m.meta_leads,
           'meta_cpl', m.meta_cpl,
           'meta_vendas', m.meta_vendas
         ) order by m.mes_ano desc), '[]'::jsonb)
    into v_metas
    from (
      select * from metas
       where cliente_id = v_c.id
       order by mes_ano desc
       limit 12
    ) m;

  -- Dados de cobranca da agencia (PIX, razao social, CNPJ, instrucoes)
  select coalesce(valor, '{}'::jsonb) into v_cobranca
    from configuracoes_agencia where chave = 'cobranca';

  return jsonb_build_object(
    'cliente', jsonb_build_object(
      'nome', v_c.nome,
      'nicho', v_c.nicho,
      'instagram_handle', v_c.instagram_handle,
      'data_inicio', v_c.data_inicio,
      'jornada', v_c.jornada,
      'jornada_social', v_c.jornada_social,
      'modulos', to_jsonb(v_c.modulos),
      'servicos_contratados', to_jsonb(v_c.servicos_contratados)
    ),
    'equipe', jsonb_build_object(
      'account_manager', v_am,
      'gestor_trafego', v_gestor,
      'social_media', v_social
    ),
    'contrato', jsonb_build_object(
      'tipo', v_c.contrato_tipo,
      'inicio', v_c.contrato_inicio,
      'fim', v_c.contrato_fim,
      'status', v_c.contrato_status
    ),
    'investimento', jsonb_build_object(
      'ticket_mensal', v_c.verba_mensal,
      'verba_google', v_c.verba_google,
      'verba_meta', v_c.verba_meta
    ),
    'pagamento', jsonb_build_object(
      'dia_vencimento', v_c.dia_vencimento,
      'forma_pagamento', v_c.forma_pagamento,
      'valor', v_c.verba_mensal,
      'agencia', coalesce(v_cobranca, '{}'::jsonb)
    ),
    'onboarding_etapas', coalesce(v_c.onboarding_etapas, '{}'::jsonb),
    'logins', v_logins,
    'metricas', v_metas
  );
end;
$$;

grant execute on function get_portal_publico(text) to anon, authenticated;

commit;


-- ─────────────────────────────────────────────────────────────────────
-- [094] Jornada aceita "escala" e "churn" (enum) — PRECISA vir antes da 082
-- (migration-094-jornada-enum-escala-churn.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 094: jornada do cliente aceita 'escala' e 'churn'
-- =========================================================
-- A coluna clientes.jornada é do tipo ENUM jornada_cliente (schema.sql),
-- com os valores antigos: onboarding | otimizacao | expansao | retencao.
-- O domus passou a usar onboarding | otimizacao | escala | churn (082), mas
-- o enum nunca ganhou os valores novos — então escolher "Escala" ou "Churn"
-- na Ficha era recusado pelo banco (22P02 invalid input value for enum).
-- (A 082 dizia que jornada era texto livre; não é.)
--
-- ⚠ RODE ANTES DA 082: ela converte expansao/retencao → escala, e o valor
-- novo só pode ser usado depois que ESTA migration for commitada.
--
-- Os valores antigos (expansao/retencao) continuam no enum — Postgres não
-- remove valor de enum sem recriar o tipo, e não há necessidade.
--
-- Idempotente (IF NOT EXISTS). COMO RODAR: SQL Editor do projeto do DOMUS.
-- =========================================================

begin;
alter type jornada_cliente add value if not exists 'escala';
alter type jornada_cliente add value if not exists 'churn';
commit;


-- ─────────────────────────────────────────────────────────────────────
-- [082] Converte jornadas antigas expansao/retencao → escala (depende da 094)
-- (migration-082-jornada-etapas.sql)
-- ─────────────────────────────────────────────────────────────────────
-- Migration 082 — Jornada do cliente: etapas onboarding/otimizacao/escala/churn
--
-- A jornada de Trafego (coluna `clientes.jornada`, texto livre) passa a ter
-- apenas 4 etapas oficiais:
--   onboarding -> otimizacao -> escala -> churn
--
-- Antes existiam 'expansao' e 'retencao'. Remapeamos os dados existentes:
--   expansao  -> escala   (escalar o que funciona)
--   retencao  -> escala   (sustentacao vira parte da fase de escala)
--
-- ⚠ CORREÇÃO (25/09): `jornada` é o ENUM jornada_cliente, que não tinha
-- 'escala' — rode a migration 094 ANTES desta (ela adiciona escala/churn).
-- Idempotente.

begin;
update clientes
   set jornada = 'escala'
 where jornada in ('expansao', 'retencao');
commit;

-- Relatorio pos-migration
select jornada, count(*)
  from clientes
 group by jornada
 order by count(*) desc;


-- ─────────────────────────────────────────────────────────────────────
-- [085] Acessos operacionais dos papéis Social Media/Designer (só ADICIONA)
-- (migration-085-papeis-acessos-operacionais.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 085: dobra os acessos operacionais nos papéis
-- =========================================================
-- Acrescenta os acessos de área operacional (antes "módulos" por cargo) como
-- permissões dentro dos papéis. Espelha o quadro "Cargos e permissões" pros
-- papéis Social Media e Designer: ambos passam a ter Operacional Webdesign +
-- Operacional Social Media (sem Tráfego, sem Admin).
--
-- Labels batem com moduloLabel (@/lib/cargos):
--   'Operacional Tráfego' | 'Operacional Webdesign' | 'Operacional Social Media'
--
-- A sidebar já foi ajustada: se o papel do usuário carrega algum desses
-- acessos, ele define a visibilidade de Webdesign/Social; senão, mantém o
-- modelo antigo por cargo.
--
-- COMO RODAR: Supabase → SQL Editor → cole e Run.
-- =========================================================

update papeis_operacionais
set permissoes = (
  select array(
    select distinct unnest(
      permissoes || array['Operacional Webdesign', 'Operacional Social Media']
    )
  )
)
where nome in ('Social Media', 'Designer');

-- Conferência (opcional): ver como ficaram
-- select nome, permissoes from papeis_operacionais where nome in ('Social Media','Designer');

-- =========================================================
-- ROLLBACK (remove só os 2 acessos que esta migration adicionou):
-- ---------------------------------------------------------
-- update papeis_operacionais
-- set permissoes = (
--   select array(
--     select unnest(permissoes)
--     except
--     select unnest(array['Operacional Webdesign','Operacional Social Media'])
--   )
-- )
-- where nome in ('Social Media', 'Designer');
-- =========================================================


-- ─────────────────────────────────────────────────────────────────────
-- [087] Metas por squad (NRR, churn, indicações, nova receita)
-- (migration-087-squad-metas.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 087: metas de squad no banco
-- =========================================================
-- A tabela squads (migration 002) só tinha nome/descricao/lider/ativo. As
-- metas de squad viviam em mock (mockSettings.ts). Esta migration dá casa no
-- banco pras metas, pra a tabela de Squads em Configurações virar a fonte
-- única (criar/editar squad + metas propaga pra todo o sistema).
--
-- clientes/MRR e o "atual" de churn/NRR NÃO viram coluna — continuam
-- calculados em tempo real a partir dos clientes vinculados (cliente.squad).
-- Aqui ficam só os alvos (metas) e os "atuais" que são entrada manual
-- (indicações e nova receita manual).
--
-- COMO RODAR: Supabase → SQL Editor → cole e Run.
-- =========================================================

alter table squads add column if not exists meta_indicacoes integer not null default 0;
alter table squads add column if not exists meta_nova_receita numeric(12,2) not null default 0;
alter table squads add column if not exists meta_nrr numeric(5,2) not null default 95;
alter table squads add column if not exists meta_logo_churn integer not null default 0;
alter table squads add column if not exists meta_rev_churn numeric(12,2) not null default 0;

-- "Atuais" que são entrada manual (o resto é calculado dos clientes)
alter table squads add column if not exists atual_indicacoes integer not null default 0;
alter table squads add column if not exists atual_nova_receita numeric(12,2) not null default 0;
alter table squads add column if not exists atual_nova_receita_desc text;

-- =========================================================
-- ROLLBACK:
-- alter table squads
--   drop column if exists meta_indicacoes,
--   drop column if exists meta_nova_receita,
--   drop column if exists meta_nrr,
--   drop column if exists meta_logo_churn,
--   drop column if exists meta_rev_churn,
--   drop column if exists atual_indicacoes,
--   drop column if exists atual_nova_receita,
--   drop column if exists atual_nova_receita_desc;
-- =========================================================


-- ─────────────────────────────────────────────────────────────────────
-- [088] Comercial: leads, investimentos, metas, config
-- (migration-088-comercial.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 088: Setor Comercial (persistência) — leads, investimentos,
-- metas comerciais e config
-- =========================================================
-- Tira o módulo Comercial do mock em memória e leva pro banco.
--
-- Decisões:
--  - `leads`: 1 tabela com a coluna `data` JSONB guardando o Lead inteiro
--    (muitos campos + aninhados: bant, reuniao, tentativas, dadosOriginaisCRM,
--    histórico). O app lê todos e filtra em JS — não precisa de colunas
--    relacionais aqui. `id` é text (ids gerados pelo app: 'lead-1', 'lead-crm-…').
--  - `investimentos_marketing` e `metas_comerciais`: colunas reais (flat,
--    inspecionáveis/consultáveis).
--  - `comercial_config`: 1 linha (id='default') com as configs em JSONB
--    (SLA Comercial, Metas de Marketing, Integração de CRM).
--
-- RLS: mesma política das outras tabelas (qualquer autenticado lê/escreve).
-- O app tem fallback: se estas tabelas NÃO existirem, o Comercial roda no
-- mock em memória (não quebra); ao rodar esta migration, passa a persistir.
-- Na 1ª carga com o banco vazio, o app faz bootstrap inserindo o mock.
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

-- 1. Leads do Comercial (Lead inteiro em JSONB)
-- OBS: NÃO reusar a tabela `leads` já existente (CRM Kommo/Sheets — schema
-- relacional totalmente diferente, migrations 025–041). Por isso o nome
-- dedicado `comercial_leads`.
create table if not exists comercial_leads (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Índices úteis pra relatórios futuros (etapa e datas ficam dentro do JSONB).
create index if not exists idx_comercial_leads_etapa on comercial_leads ((data->>'etapaFunil'));
create index if not exists idx_comercial_leads_data_entrada on comercial_leads ((data->>'dataEntrada'));

alter table comercial_leads enable row level security;
drop policy if exists "auth read comercial_leads" on comercial_leads;
drop policy if exists "auth write comercial_leads" on comercial_leads;
create policy "auth read comercial_leads" on comercial_leads for select using (auth.role() = 'authenticated');
create policy "auth write comercial_leads" on comercial_leads for all using (auth.role() = 'authenticated');

drop trigger if exists trg_comercial_leads_updated on comercial_leads;
create trigger trg_comercial_leads_updated before update on comercial_leads
  for each row execute function set_updated_at();

-- 2. Investimento de mídia por período/canal
create table if not exists investimentos_marketing (
  id text primary key,
  periodo text not null,           -- "YYYY-MM"
  canal text not null,
  valor numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_invest_periodo on investimentos_marketing (periodo);

alter table investimentos_marketing enable row level security;
drop policy if exists "auth read invest" on investimentos_marketing;
drop policy if exists "auth write invest" on investimentos_marketing;
create policy "auth read invest" on investimentos_marketing for select using (auth.role() = 'authenticated');
create policy "auth write invest" on investimentos_marketing for all using (auth.role() = 'authenticated');

drop trigger if exists trg_invest_updated on investimentos_marketing;
create trigger trg_invest_updated before update on investimentos_marketing
  for each row execute function set_updated_at();

-- 3. Metas comerciais (mensais/semanais por métrica de INPUT)
create table if not exists metas_comerciais (
  id text primary key,
  periodicidade text not null check (periodicidade in ('mensal', 'semanal')),
  metrica text not null,
  canal text,
  responsavel_id text,
  valor_meta numeric not null default 0,
  periodo_referencia text not null, -- "YYYY-MM" (mensal) ou data da 2ª-feira (semanal)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_metas_periodo on metas_comerciais (periodicidade, periodo_referencia);

alter table metas_comerciais enable row level security;
drop policy if exists "auth read metas" on metas_comerciais;
drop policy if exists "auth write metas" on metas_comerciais;
create policy "auth read metas" on metas_comerciais for select using (auth.role() = 'authenticated');
create policy "auth write metas" on metas_comerciais for all using (auth.role() = 'authenticated');

drop trigger if exists trg_metas_com_updated on metas_comerciais;
create trigger trg_metas_com_updated before update on metas_comerciais
  for each row execute function set_updated_at();

-- 4. Config do Comercial (linha única) — SLA, Metas de Marketing, Integração CRM
create table if not exists comercial_config (
  id text primary key default 'default',
  sla jsonb,
  metas_marketing jsonb,
  integracao_crm jsonb,
  updated_at timestamptz default now()
);

alter table comercial_config enable row level security;
drop policy if exists "auth read cfg" on comercial_config;
drop policy if exists "auth write cfg" on comercial_config;
create policy "auth read cfg" on comercial_config for select using (auth.role() = 'authenticated');
create policy "auth write cfg" on comercial_config for all using (auth.role() = 'authenticated');

drop trigger if exists trg_cfg_updated on comercial_config;
create trigger trg_cfg_updated before update on comercial_config
  for each row execute function set_updated_at();

-- Sem seed aqui: o app faz bootstrap do mock na 1ª carga (quando a linha
-- comercial_config ainda não existe), gravando leads/investimentos/metas +
-- config. Assim a demo continua e já nasce persistida.


-- ─────────────────────────────────────────────────────────────────────
-- [089] Financeiro: despesas, config, comissão
-- (migration-089-financeiro.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 089: Financeiro (persistência) — despesas + config
-- =========================================================
-- Tira o módulo Financeiro do mock em memória e leva pro banco.
--
-- Só há dado PRÓPRIO em dois lugares (o resto — DRE, DRE por Setor, Fluxo de
-- Caixa — é 100% derivado e não persiste nada):
--   1. despesas_financeiras: os lançamentos de despesa (colunas flat,
--      consultáveis por categoria/setor/competência; `origem_detalhe` da
--      integração externa fica em JSONB).
--   2. financeiro_config: 1 linha (id='default') com as metas financeiras
--      (margem bruta/líquida alvo) em JSONB.
--
-- Nome dedicado `despesas_financeiras` (não `despesas`) por segurança, no
-- mesmo espírito de `comercial_leads` da 088.
--
-- RLS: mesma política das demais (qualquer autenticado lê/escreve).
-- Fallback do app: se estas tabelas NÃO existirem, o Financeiro roda no mock
-- em memória (não quebra); ao rodar esta migration passa a persistir. Na 1ª
-- carga com o banco vazio, o app faz bootstrap inserindo o mock.
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

-- 1. Despesas
create table if not exists despesas_financeiras (
  id text primary key,
  descricao text not null,
  categoria text not null,
  setor text,
  valor numeric not null default 0,
  tipo_recorrencia text not null default 'unica',
  data_competencia text not null,          -- "YYYY-MM"
  data_pagamento text,                     -- "YYYY-MM-DD" (regime de caixa)
  status text not null default 'pendente',
  fornecedor text,
  observacao text,
  origem text not null default 'manual',   -- 'manual' | 'integracao_externa'
  origem_detalhe jsonb,                     -- { provedor, idExterno, sincronizadoEm }
  repetir_ate text,                        -- "YYYY-MM" ou null = indeterminado
  recorrencia_modelo_id text,              -- instância materializada → id do modelo
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_despesas_competencia on despesas_financeiras (data_competencia);
create index if not exists idx_despesas_setor on despesas_financeiras (setor);
create index if not exists idx_despesas_categoria on despesas_financeiras (categoria);

alter table despesas_financeiras enable row level security;
drop policy if exists "auth read despesas" on despesas_financeiras;
drop policy if exists "auth write despesas" on despesas_financeiras;
create policy "auth read despesas" on despesas_financeiras for select using (auth.role() = 'authenticated');
create policy "auth write despesas" on despesas_financeiras for all using (auth.role() = 'authenticated');

drop trigger if exists trg_despesas_updated on despesas_financeiras;
create trigger trg_despesas_updated before update on despesas_financeiras
  for each row execute function set_updated_at();

-- 2. Config do Financeiro (linha única) — metas financeiras
create table if not exists financeiro_config (
  id text primary key default 'default',
  metas jsonb,                             -- { margemBrutaAlvo, margemLiquidaAlvo, ltvCacAlvo, paybackAlvoMeses }
  comissao jsonb,                          -- { base, pctCloser, pctSdr, pctSocial }
  updated_at timestamptz default now()
);
-- (idempotente, caso a tabela já exista de uma execução anterior)
alter table financeiro_config add column if not exists comissao jsonb;

alter table financeiro_config enable row level security;
drop policy if exists "auth read fin cfg" on financeiro_config;
drop policy if exists "auth write fin cfg" on financeiro_config;
create policy "auth read fin cfg" on financeiro_config for select using (auth.role() = 'authenticated');
create policy "auth write fin cfg" on financeiro_config for all using (auth.role() = 'authenticated');

drop trigger if exists trg_fin_cfg_updated on financeiro_config;
create trigger trg_fin_cfg_updated before update on financeiro_config
  for each row execute function set_updated_at();

-- Sem seed: o app faz bootstrap do mock na 1ª carga (quando a linha
-- financeiro_config ainda não existe), gravando despesas + config.


-- ─────────────────────────────────────────────────────────────────────
-- [090] Resumo Geral: arquivar mês
-- (migration-090-resumo-arquivado.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 090: Resumo Geral — arquivamento de período (histórico congelado)
-- =========================================================
-- A Visão Executiva (Resumo Geral) reconstrói as métricas de eventos em tempo
-- real — então meses passados MUDAM conforme os clientes mudam. Pra não perder
-- o histórico, ao "finalizar o mês" o usuário ARQUIVA o período: grava um
-- snapshot congelado das métricas daquele mês, que passa a ser exibido no lugar
-- do cálculo em tempo real.
--
-- 1 linha por mês arquivado. `snapshot` guarda o objeto de KPIs inteiro (JSONB).
--
-- Fallback do app: se a tabela não existir, o botão de arquivar avisa que a
-- migration não foi rodada; o resto da tela funciona normalmente (tempo real).
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

create table if not exists resumo_periodos_arquivados (
  mes text primary key,               -- "YYYY-MM"
  snapshot jsonb not null,            -- objeto de KPIs congelado
  arquivado_em timestamptz default now(),
  arquivado_por text
);

alter table resumo_periodos_arquivados enable row level security;
drop policy if exists "auth read resumo arq" on resumo_periodos_arquivados;
drop policy if exists "auth write resumo arq" on resumo_periodos_arquivados;
create policy "auth read resumo arq" on resumo_periodos_arquivados for select using (auth.role() = 'authenticated');
create policy "auth write resumo arq" on resumo_periodos_arquivados for all using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────
-- [091] Código de Cultura por pessoa
-- (migration-091-codigo-cultura.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 091: Código de Cultura — cópia editável POR PESSOA
-- =========================================================
-- O "Código de Cultura MovMed" tem um manual base (no app), e CADA PESSOA
-- pode personalizar a PRÓPRIA cópia (editar o texto livremente) sem afetar a
-- dos outros. 1 linha por usuário (a cópia dele).
--
-- RLS por dono: cada usuário só enxerga/edita a própria linha (auth.uid()).
--
-- Fallback do app: se a tabela não existir, o modal usa o manual base +
-- localStorage do navegador (não quebra); ao rodar esta migration passa a
-- persistir a cópia de cada pessoa no banco.
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

create table if not exists codigo_cultura (
  user_id uuid primary key references auth.users(id) on delete cascade,
  conteudo text not null,
  updated_at timestamptz default now()
);

alter table codigo_cultura enable row level security;
drop policy if exists "own codigo cultura" on codigo_cultura;
create policy "own codigo cultura" on codigo_cultura
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists trg_codigo_cultura_updated on codigo_cultura;
create trigger trg_codigo_cultura_updated before update on codigo_cultura
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- [092] Integração Instagram (conexão, config, métricas)
-- (migration-092-instagram.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 092: Integração Instagram (Meta API) — persistência real
-- =========================================================
-- Tira o estado de conexão do Instagram do localStorage e leva pro banco:
--   1. cliente_instagram: estado de conexão por cliente (1:1) — modo (direta/
--      agência), handle, token, últimas datas.
--   2. instagram_config: conexão a nível de agência (Business Manager), 1 linha.
--   3. instagram_metricas: histórico mês a mês das métricas puxadas (por ora
--      snapshots do mock; quando o App Meta for aprovado, alimentado pela API).
--
-- A conexão REAL com a Meta ainda não existe (depende da aprovação do App);
-- o app continua simulando os dados, mas agora o ESTADO de conexão persiste.
--
-- Fallback: se estas tabelas não existirem, o app cai no localStorage (não
-- quebra). RLS: qualquer autenticado lê/escreve (o time de Social monitora
-- todas as contas).
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

-- 1. Conexão por cliente (1:1)
create table if not exists cliente_instagram (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  handle text not null default '',
  modo_conexao text not null default 'nao_conectado', -- direta | agencia | nao_conectado
  conta_conectada_em timestamptz,
  ultima_sincronizacao timestamptz,
  token_status text,                                    -- valido | expirado | revogado
  updated_at timestamptz default now()
);
alter table cliente_instagram enable row level security;
drop policy if exists "auth read ig conn" on cliente_instagram;
drop policy if exists "auth write ig conn" on cliente_instagram;
create policy "auth read ig conn" on cliente_instagram for select using (auth.role() = 'authenticated');
create policy "auth write ig conn" on cliente_instagram for all using (auth.role() = 'authenticated');
drop trigger if exists trg_ig_conn_updated on cliente_instagram;
create trigger trg_ig_conn_updated before update on cliente_instagram
  for each row execute function set_updated_at();

-- 2. Config de agência (linha única)
create table if not exists instagram_config (
  id text primary key default 'default',
  conectado boolean not null default false,
  business_manager text,
  conectado_em timestamptz,
  updated_at timestamptz default now()
);
alter table instagram_config enable row level security;
drop policy if exists "auth read ig cfg" on instagram_config;
drop policy if exists "auth write ig cfg" on instagram_config;
create policy "auth read ig cfg" on instagram_config for select using (auth.role() = 'authenticated');
create policy "auth write ig cfg" on instagram_config for all using (auth.role() = 'authenticated');
drop trigger if exists trg_ig_cfg_updated on instagram_config;
create trigger trg_ig_cfg_updated before update on instagram_config
  for each row execute function set_updated_at();

-- 3. Métricas mês a mês
create table if not exists instagram_metricas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  periodo text not null,                    -- "YYYY-MM"
  posts_publicados int,
  alcance_medio int,
  seguidores int,
  seguidores_variacao int,
  engajamento_medio numeric,
  fonte_dado text default 'api_instagram',
  sincronizado_em timestamptz,
  updated_at timestamptz default now(),
  unique (cliente_id, periodo)
);
create index if not exists idx_ig_metricas_cliente on instagram_metricas (cliente_id);
alter table instagram_metricas enable row level security;
drop policy if exists "auth read ig met" on instagram_metricas;
drop policy if exists "auth write ig met" on instagram_metricas;
create policy "auth read ig met" on instagram_metricas for select using (auth.role() = 'authenticated');
create policy "auth write ig met" on instagram_metricas for all using (auth.role() = 'authenticated');
drop trigger if exists trg_ig_met_updated on instagram_metricas;
create trigger trg_ig_met_updated before update on instagram_metricas
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- [093] Log da sincronização bidirecional com CRM
-- (migration-093-crm-sync-logs.sql)
-- ─────────────────────────────────────────────────────────────────────
-- =========================================================
-- Migration 093: Sincronização bidirecional com CRM — log de envios
-- =========================================================
-- A integração com CRM passa a ESCREVER no CRM externo (Sistema → CRM):
--   - Social Selling cria o lead no CRM (criação)
--   - Closer atualiza o status do negócio no CRM (atualização)
--
-- Esta tabela guarda cada tentativa de envio (sucesso ou erro), alimentando o
-- painel "Status de Sincronização Bidirecional" em Configurações › Integrações
-- (KPIs do mês + últimas sincronizações com retry).
--
-- O que NÃO precisa de migration (já é JSONB):
--   - os campos novos do Lead (crmExternoId, sincronizacaoCRM, ...) vivem em
--     comercial_leads.data;
--   - a config do CRM (provedor, escrita ativa, mapeamento de status de
--     saída) vai na coluna comercial_config.integracao_crm (criada na 088).
--
-- A chamada real à API de cada CRM ainda não existe (depende das credenciais
-- de cada tenant); o app simula o envio, mas o LOG já é real.
--
-- Fallback: se esta tabela não existir, o app guarda o log no localStorage
-- (não quebra). RLS: qualquer autenticado lê/escreve (o time comercial audita).
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

create table if not exists crm_sync_logs (
  id text primary key,
  lead_id text not null,
  lead_nome text not null default '',
  tipo text not null check (tipo in ('criacao', 'atualizacao')),
  status text not null check (status in ('sucesso', 'erro')),
  provider text not null,
  payload_enviado jsonb not null default '{}'::jsonb,
  resposta_erro text,
  created_at timestamptz not null default now()
);

create index if not exists crm_sync_logs_created_idx on crm_sync_logs (created_at desc);
create index if not exists crm_sync_logs_lead_idx on crm_sync_logs (lead_id);

alter table crm_sync_logs enable row level security;
drop policy if exists "auth read crm sync" on crm_sync_logs;
drop policy if exists "auth write crm sync" on crm_sync_logs;
create policy "auth read crm sync" on crm_sync_logs for select using (auth.role() = 'authenticated');
create policy "auth write crm sync" on crm_sync_logs for all using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────
-- [SEGURANÇA] A função que apaga clientes em churn não pode ser chamada
-- pela chave pública do app (anon). Ela roda pelo agendamento diário
-- (pg_cron, como postgres) — isso continua funcionando.
-- ─────────────────────────────────────────────────────────────────────
revoke execute on function public.purge_clientes_churn_expirados() from public, anon, authenticated;



-- #####################################################################
-- PARTE 2 — CONFIRME ANTES (COMENTADA). Pra rodar um bloco: selecione as
-- linhas dele, descomente (Ctrl + /) e rode SÓ a seleção.
-- #####################################################################


-- ─────────────────────────────────────────────────────────────────────
-- [084] ⚠ RLS por papel em clientes/cliente_eventos. Quem TEM papel precisa ter "Visualizar clientes" pra ver clientes no domus. Admin e quem não tem papel seguem liberados. Confira os papéis antes. Rollback no fim do bloco.
-- (migration-084-rls-permissoes.sql)
-- ─────────────────────────────────────────────────────────────────────
-- -- =========================================================
-- -- Migration 084: RLS por permissão de papel (Fase 3 — segurança real)
-- -- =========================================================
-- -- Transforma as permissões dos Papéis Operacionais (migration 083) em trava
-- -- de VERDADE no servidor. Até aqui era só interface (UX).
-- --
-- -- ⚠️ LEIA ANTES DE RODAR:
-- --  - Rode no SQL Editor do Supabase.
-- --  - Bypass: admin (profiles.role='admin') e quem NÃO tem papel atribuído
-- --    continuam liberados (fail-open de rollout). Então SEU login (admin)
-- --    não muda.
-- --  - Depois de rodar, teste com um usuário de papel restrito.
-- --  - Se algo travar indevidamente, o ROLLBACK está no fim do arquivo
-- --    (comentado) — cola e roda pra voltar ao estado anterior.
-- -- =========================================================
--
-- -- ---------------------------------------------------------
-- -- 1. Helper: o usuário logado tem a permissão X?
-- --    SECURITY DEFINER pra ler profiles/papeis sem depender da RLS do caller.
-- --    Fail-open: admin, sem papel, ou perfil não encontrado → true.
-- -- ---------------------------------------------------------
-- create or replace function public.tem_permissao(p_perm text)
-- returns boolean
-- language sql
-- stable
-- security definer
-- set search_path = public
-- as $$
--   select coalesce(
--     bool_or(
--       pr.role = 'admin'
--       or pr.papel_id is null
--       or (po.permissoes @> array[p_perm])
--     ),
--     true  -- nenhum profile casou com auth.uid() → não trava (fail-open)
--   )
--   from profiles pr
--   left join papeis_operacionais po on po.id = pr.papel_id
--   where pr.auth_user_id = auth.uid() or pr.id = auth.uid();
-- $$;
--
-- grant execute on function public.tem_permissao(text) to authenticated;
--
-- -- ---------------------------------------------------------
-- -- 2. cliente_eventos: INSERT dos tipos MANUAIS por permissão.
-- --    Eventos automáticos (triggers de mudança em clientes: mrr, risco,
-- --    jornada, responsavel, contato, nps, servico...) continuam liberados,
-- --    senão um update de cliente quebraria. Só expansao/perda/churn (as
-- --    Ações Rápidas) exigem a permissão correspondente.
-- -- ---------------------------------------------------------
-- drop policy if exists "authenticated insert cliente_eventos" on cliente_eventos;
-- drop policy if exists "insert cliente_eventos por permissao" on cliente_eventos; -- idempotente
-- create policy "insert cliente_eventos por permissao" on cliente_eventos
--   for insert with check (
--     auth.role() = 'authenticated'
--     and (
--       tipo not in ('expansao', 'perda', 'churn')
--       or (tipo = 'expansao' and tem_permissao('Registrar expansão'))
--       or (tipo in ('perda', 'churn') and tem_permissao('Registrar churn'))
--     )
--   );
--
-- -- ---------------------------------------------------------
-- -- 3. clientes: SELECT exige "Visualizar clientes".
-- --    ⚠️ MAIOR ALCANCE: vale pra TODA leitura de clientes no app (lista,
-- --    ficha, Dashboard, Visão Executiva). Papéis sem essa permissão
-- --    (ex.: Comercial, Consultoria) deixam de ver dados de cliente em
-- --    qualquer tela. Admin e sem-papel continuam vendo.
-- --
-- --    Precisa TROCAR a policy "auth write clientes" (que era FOR ALL e por
-- --    isso também liberava SELECT) por policies separadas de escrita, senão
-- --    o SELECT continuaria passando por ela.
-- -- ---------------------------------------------------------
-- drop policy if exists "auth read clientes" on clientes;
-- drop policy if exists "auth write clientes" on clientes;
-- -- idempotente: permite rodar de novo sem "policy already exists"
-- drop policy if exists "clientes select por permissao" on clientes;
-- drop policy if exists "clientes insert auth" on clientes;
-- drop policy if exists "clientes update auth" on clientes;
-- drop policy if exists "clientes delete auth" on clientes;
--
-- create policy "clientes select por permissao" on clientes
--   for select using (
--     auth.role() = 'authenticated' and tem_permissao('Visualizar clientes')
--   );
-- -- Escrita segue liberada pra authenticated (a trava fina por campo — ex.:
-- -- "Editar status" só na coluna status — precisa de trigger; fica pra depois).
-- create policy "clientes insert auth" on clientes
--   for insert with check (auth.role() = 'authenticated');
-- create policy "clientes update auth" on clientes
--   for update using (auth.role() = 'authenticated');
-- create policy "clientes delete auth" on clientes
--   for delete using (auth.role() = 'authenticated');
--
-- -- =========================================================
-- -- Ainda NÃO coberto (fica pra próximas iterações):
-- --  - "Editar status": trava por COLUNA (só status) precisa de trigger
-- --    BEFORE UPDATE — RLS não faz nível de coluna. Hoje segue só na UX.
-- --  - "Registrar NPS": não gateei nps_surveys aqui pra não arriscar o fluxo
-- --    público de resposta (anon). Segue só na UX.
-- -- =========================================================
--
-- -- =========================================================
-- -- ROLLBACK (cola e roda pra voltar ao estado anterior):
-- -- ---------------------------------------------------------
-- -- drop policy if exists "insert cliente_eventos por permissao" on cliente_eventos;
-- -- create policy "authenticated insert cliente_eventos" on cliente_eventos
-- --   for insert with check (auth.role() = 'authenticated');
-- --
-- -- drop policy if exists "clientes select por permissao" on clientes;
-- -- drop policy if exists "clientes insert auth" on clientes;
-- -- drop policy if exists "clientes update auth" on clientes;
-- -- drop policy if exists "clientes delete auth" on clientes;
-- -- create policy "auth read clientes" on clientes for select using (auth.role() = 'authenticated');
-- -- create policy "auth write clientes" on clientes for all using (auth.role() = 'authenticated');
-- --
-- -- drop function if exists public.tem_permissao(text);
-- -- =========================================================


-- ─────────────────────────────────────────────────────────────────────
-- [086] ⚠ Redefine os 3 acessos "Operacional *" dos papéis (Designer, Editor de Vídeo, Social Media, Gestor...). Se alguém já ajustou esses acessos pela tela, rodar de novo DESFAZ o ajuste. Só rode se os papéis estão sem acesso operacional.
-- (migration-086-papeis-setor-operacional.sql)
-- ─────────────────────────────────────────────────────────────────────
-- -- =========================================================
-- -- Migration 086: acessos de SETOR operacional por papel
-- -- =========================================================
-- -- Define, por papel, quais acessos operacionais ele carrega. Esses acessos
-- -- controlam DUAS coisas:
-- --   (a) sidebar: visibilidade das pastas Tráfego/Webdesign/Social (papel-first)
-- --   (b) ficha do cliente: quais abas operacionais aparecem
-- --       ("Operacional Tráfego" precisa de 'Operacional Tráfego';
-- --        "Operacional Social Media" precisa de 'Operacional Social Media').
-- --
-- -- Regra do Design: setor de Design (Designer, Editor de Vídeo) tem SÓ
-- -- 'Operacional Webdesign' — nunca recebe aba operacional na ficha (não tem
-- -- carteira de clientes). Por isso removemos Tráfego/Social desses papéis.
-- --
-- -- Cada update é AUTORITATIVO pros 3 acessos operacionais (remove os 3 e recoloca
-- -- o conjunto do grupo), preservando as demais permissões (Visualizar clientes,
-- -- Editar status, etc.). Idempotente.
-- --
-- -- ⚠️ Revise o mapeamento abaixo antes de rodar — reflete o quadro antigo de
-- -- Cargos × módulos, com o ajuste do Design. Papéis não listados (Coordenador
-- -- de Qualidade, Experiência do Cliente, Concierge, Comercial, Consultoria,
-- -- SDR) ficam SEM acesso de setor → caem no fallback (sidebar por cargo; ficha
-- -- mostra abas pelos serviços do cliente). Ajuste depois no editor de papel.
-- --
-- -- COMO RODAR: Supabase → SQL Editor → cole e Run.
-- -- =========================================================
--
-- -- Helper conceitual (inline em cada update):
-- --   novas = (permissoes atuais SEM os 3 acessos operacionais) + (acessos do grupo)
--
-- -- 1) DESIGN → Webdesign apenas (nunca aba operacional na ficha)
-- update papeis_operacionais set permissoes = (
--   select coalesce(array_agg(p), array[]::text[]) from (
--     select p from unnest(permissoes) as p
--       where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
--     union
--     select unnest(array['Operacional Webdesign'])
--   ) x(p)
-- ) where nome in ('Designer', 'Editor de Vídeo');
--
-- -- 2) TRÁFEGO → Tráfego + Webdesign
-- update papeis_operacionais set permissoes = (
--   select coalesce(array_agg(p), array[]::text[]) from (
--     select p from unnest(permissoes) as p
--       where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
--     union
--     select unnest(array['Operacional Tráfego', 'Operacional Webdesign'])
--   ) x(p)
-- ) where nome in ('Gestor de Tráfego', 'Head de Tráfego');
--
-- -- 3) SOCIAL → Social + Webdesign
-- update papeis_operacionais set permissoes = (
--   select coalesce(array_agg(p), array[]::text[]) from (
--     select p from unnest(permissoes) as p
--       where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
--     union
--     select unnest(array['Operacional Social Media', 'Operacional Webdesign'])
--   ) x(p)
-- ) where nome in ('Social Media', 'Head de Conteúdo');
--
-- -- 4) MULTI (atende/oversee todos os setores) → Tráfego + Webdesign + Social
-- update papeis_operacionais set permissoes = (
--   select coalesce(array_agg(p), array[]::text[]) from (
--     select p from unnest(permissoes) as p
--       where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
--     union
--     select unnest(array['Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media'])
--   ) x(p)
-- ) where nome in ('Account Manager', 'Diretor', 'Coordenador Geral', 'Gerente Operacional');
--
-- -- Conferência (opcional):
-- -- select nome, permissoes from papeis_operacionais order by nome;
-- -- =========================================================



-- #####################################################################
-- PARTE 3 — LIMPEZA DE DUPLICADOS (não é migration; COMENTADA)
-- #####################################################################
-- Te mandei no chat um DELETE que remove itens duplicados do calendário
-- (mesmo planejamento + formato + data + título). Não dá pra saber daqui
-- se ainda há duplicados. PRIMEIRO rode só a conferência:
--
-- select producao_id, formato, prazo, lower(trim(titulo)) as titulo, count(*) as copias
--   from producoes_social_media_items
--  group by 1, 2, 3, 4
-- having count(*) > 1
--  order by copias desc;
--
-- Se voltar vazio: não precisa de nada. Se voltar linhas, a limpeza abaixo
-- mantém a cópia mais antiga de cada e apaga as demais (irreversível):
--
-- delete from producoes_social_media_items t
-- where t.id in (
--   select id from (
--     select id, row_number() over (
--       partition by producao_id, formato, coalesce(prazo::text, ''), lower(trim(titulo))
--       order by created_at, id
--     ) rn
--     from producoes_social_media_items
--   ) x where x.rn > 1
-- );
