-- =========================================================
-- Migration 057 — Call de alinhamento: qualquer usuario aprovado edita
-- =========================================================
-- Antes: `pode_editar_call_alinhamento()` (migration 045) restringia a
-- admin, head, diretoria e account_manager. Gestor de trafego e social
-- media nao conseguiam mexer na data nem marcar como realizada — o
-- popover ate abria (dependia do frontend) mas a RPC recusava.
--
-- Agora: qualquer usuario aprovado + ativo pode editar. A ideia eh que
-- o time todo tenha autonomia pra reagendar a call e marcar quando
-- efetivamente aconteceu (o gestor que faz a call sabe melhor do que
-- ninguem quando foi).
--
-- Nao mexe na RLS de clientes (ja eh `auth.role() = 'authenticated'`
-- pra tudo, entao o UPDATE direto de `proxima_call_alinhamento` que
-- o front faz nunca esteve bloqueado — so a RPC estava).
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
    where p.id = auth.uid()
      and p.aprovado
      and p.ativo
  );
$$;

commit;
