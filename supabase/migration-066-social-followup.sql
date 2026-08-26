-- =========================================================
-- Migration 066 — social_followup: acompanhamento de cobranca
-- =========================================================
-- Nova tabela pra dar estado de FOLLOW-UP a cada pendencia que o head
-- de social media precisa acompanhar. Antes o painel so listava
-- passivamente (aguardando aprovacao, prontas, calls); agora cada
-- pendencia vira uma tarefa com estado, tentativas, agendamento de
-- retorno, canal usado e observacao.
--
-- Uso:
--   1 linha por (cliente_id, tipo, ref_id). Se o mesmo cliente tem
--   3 items em aprovacao, sao 3 linhas — cada uma com estado proprio.
--
-- tipo:
--   'aprovacao'  — item de social media em em_aprovacao (ref_id = item_id)
--   'publicacao' — item pronto pra publicar (ref_id = item_id)
--   'call'       — call de alinhamento vencida (ref_id = null)
--   'setup'      — setup do perfil incompleto (ref_id = null)
--   'geral'      — livre pra head criar acompanhamento avulso
--
-- status:
--   'nao_cobrado'  — pendencia detectada, ainda nao acionei o cliente
--   'aguardando'   — cobrei, aguardando resposta
--   'agendado'     — cliente marcou/prometi retorno pra data X
--   'escalado'     — cliente sumiu, precisa acao especial (diretoria/AM)
--   'resolvido'    — pendencia sanada (aprovou/publicou/atendeu call/etc)
--
-- Idempotente.
-- =========================================================
begin;

create table if not exists social_followup (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null check (
    tipo in ('aprovacao', 'publicacao', 'call', 'setup', 'geral')
  ),
  ref_id uuid,
  status text not null default 'nao_cobrado' check (
    status in ('nao_cobrado', 'aguardando', 'agendado', 'escalado', 'resolvido')
  ),
  ultima_cobranca_em timestamptz,
  proximo_followup date,
  tentativas int not null default 0,
  canal text check (canal in ('whatsapp', 'email', 'call', 'presencial') or canal is null),
  observacao text,
  autor_ultima_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table social_followup is
  'Acompanhamento (cobranca) do head de social media pras pendencias dos clientes. Uma linha por pendencia (cliente + tipo + ref_id). Estados: nao_cobrado, aguardando, agendado, escalado, resolvido.';

-- Uma entrada unica por (cliente, tipo, ref). Postgres trata NULL != NULL
-- em unique — precisa index parcial pra cobrir os casos com ref_id nulo.
create unique index if not exists uk_social_followup_com_ref
  on social_followup(cliente_id, tipo, ref_id)
  where ref_id is not null;
create unique index if not exists uk_social_followup_sem_ref
  on social_followup(cliente_id, tipo)
  where ref_id is null;

create index if not exists idx_social_followup_cliente on social_followup(cliente_id);
create index if not exists idx_social_followup_status on social_followup(status);
create index if not exists idx_social_followup_proximo on social_followup(proximo_followup) where proximo_followup is not null;

-- Trigger updated_at
create or replace function trg_social_followup_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists social_followup_updated_at on social_followup;
create trigger social_followup_updated_at
  before update on social_followup
  for each row
  execute function trg_social_followup_updated_at();

-- RLS: qualquer usuario autenticado le e escreve (usado pelo head de SM
-- + diretoria; se precisar restringir depois, ajusta aqui)
alter table social_followup enable row level security;

drop policy if exists "auth read social_followup" on social_followup;
create policy "auth read social_followup"
  on social_followup for select
  using (auth.role() = 'authenticated');

drop policy if exists "auth write social_followup" on social_followup;
create policy "auth write social_followup"
  on social_followup for all
  using (auth.role() = 'authenticated');

commit;
