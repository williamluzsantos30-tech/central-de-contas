-- =============================================================
-- Migration 044 — Escalonamento (Fase 2C)
-- =============================================================
-- Infraestrutura pra notificar a diretoria quando uma conta fica crítica
-- por 2+ semanas (ou instável por 3+ semanas).
--
--   1. escalonamento_destinatarios — lista configurável de quem recebe email
--      (gerenciada na aba "Escalonamento" do Admin)
--   2. escalonamento_notificacoes — log do que JÁ foi notificado (evita
--      spam; re-notifica só a cada 7 dias)
--
-- ⚠️ O ENVIO DE EMAIL em si (edge function + cron) fica pra próxima fase,
-- quando o provedor (Resend) estiver configurado. Por ora essas tabelas
-- guardam a config + histórico.
-- =============================================================
begin;

-- ----------------------------------------------------------------
-- 1. Destinatários do email de escalonamento
-- ----------------------------------------------------------------
create table if not exists escalonamento_destinatarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_esc_dest_email
  on escalonamento_destinatarios(lower(email));

drop trigger if exists trg_esc_dest_updated_at on escalonamento_destinatarios;
create trigger trg_esc_dest_updated_at
  before update on escalonamento_destinatarios
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- 2. Log de notificações enviadas (rastreio anti-spam)
-- ----------------------------------------------------------------
create table if not exists escalonamento_notificacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null,
  destinatarios jsonb not null default '[]'::jsonb,
  enviado_em timestamptz not null default now(),
  constraint esc_notif_tipo_chk check (
    tipo in ('diretoria','reclassificar')
  )
);

create index if not exists idx_esc_notif_cliente
  on escalonamento_notificacoes(cliente_id, enviado_em desc);

-- ----------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------
alter table escalonamento_destinatarios enable row level security;
alter table escalonamento_notificacoes enable row level security;

-- Destinatários: só admin gerencia; leitura pra head/diretoria/admin
drop policy if exists esc_dest_select on escalonamento_destinatarios;
create policy esc_dest_select on escalonamento_destinatarios
  for select to authenticated using (eh_head_ou_diretoria());

drop policy if exists esc_dest_write on escalonamento_destinatarios;
create policy esc_dest_write on escalonamento_destinatarios
  for all to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.aprovado and p.ativo and p.role::text = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.aprovado and p.ativo and p.role::text = 'admin'
    )
  );

-- Notificações: leitura pra head/diretoria/admin; insert pela service role
-- (edge function) — sem policy de insert pra authenticated por enquanto
drop policy if exists esc_notif_select on escalonamento_notificacoes;
create policy esc_notif_select on escalonamento_notificacoes
  for select to authenticated using (eh_head_ou_diretoria());

commit;

-- =============================================================
-- Como rodar:
--   1. Rode a migration 043 ANTES (cria a função eh_head_ou_diretoria
--      e o trigger set_updated_at usados aqui).
--   2. Cole este arquivo no SQL Editor e Run.
--   3. Confere as tabelas escalonamento_destinatarios e
--      escalonamento_notificacoes no Table Editor.
-- =============================================================
