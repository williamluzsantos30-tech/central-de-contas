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
