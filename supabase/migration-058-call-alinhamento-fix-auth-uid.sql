-- =========================================================
-- Migration 058 — Fix: pode_editar_call_alinhamento usa auth_user_id
-- =========================================================
-- Bug: as migrations 045 e 057 checam `p.id = auth.uid()` na funcao
-- `pode_editar_call_alinhamento()`. Isso so funcionava pra usuarios
-- LEGADOS onde profiles.id foi criado igual ao auth.users.id.
--
-- Desde a migration 001, o profile tem ID proprio auto-gerado e o
-- vinculo com auth eh via `profiles.auth_user_id`. Usuarios cadastrados
-- pela UI do admin (que sao a maioria) tem `p.id != auth.uid()`, entao
-- a funcao retorna false pra eles e a RPC nega "sem permissao".
--
-- Fix: usa `p.auth_user_id = auth.uid()`. Fallback pra `p.id = auth.uid()`
-- pra nao quebrar usuarios legados (belt-and-suspenders).
--
-- Idempotente.
-- =========================================================
begin;

create or replace function pode_editar_call_alinhamento()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from profiles p
    where (p.auth_user_id = auth.uid() or p.id = auth.uid())
      and p.aprovado
      and p.ativo
  );
$$;

commit;

-- =========================================================
-- Debug util (rodar como admin no SQL Editor pra ver o que a funcao ve):
--   select
--     auth.uid()                                        as auth_uid_atual,
--     p.id,
--     p.auth_user_id,
--     p.nome,
--     p.aprovado,
--     p.ativo
--   from profiles p
--   where p.auth_user_id = auth.uid() or p.id = auth.uid();
-- =========================================================
