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
