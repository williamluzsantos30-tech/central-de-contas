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
