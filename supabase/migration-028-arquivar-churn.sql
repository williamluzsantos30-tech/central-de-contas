-- =========================================================
-- Migration 028 — Arquivar cliente automaticamente quando vira churn
-- =========================================================
-- Quando um cliente é marcado como `churn`, ele é arquivado: some das
-- listas e dropdowns padrão. Ainda existe no banco (histórico
-- preservado), mas só admin/diretoria consegue ver (toggle na tela).
--
-- arquivado_em sincroniza automaticamente com status via trigger:
--   - status: ativo/atencao/pausado → churn  ⇒ arquivado_em = now()
--   - status: churn → outro                    ⇒ arquivado_em = null
--
-- Idempotente.
-- =========================================================

-- 1) Coluna
alter table clientes
  add column if not exists arquivado_em timestamptz;

comment on column clientes.arquivado_em is
  'Timestamp de quando o cliente foi arquivado (=virou churn). Null = ativo nas listas. Não-null = some por padrão, só visível com toggle "Ver arquivados" (admin).';

-- 2) Index pra filtros rápidos `is null`
create index if not exists idx_clientes_arquivado_em
  on clientes(arquivado_em)
  where arquivado_em is null;

-- 3) Backfill: clientes que já estão como churn ganham timestamp
update clientes
   set arquivado_em = coalesce(arquivado_em, updated_at, created_at, now())
 where status = 'churn'
   and arquivado_em is null;

-- 4) Trigger: sincroniza arquivado_em com mudanças de status
create or replace function trg_sync_arquivado_em()
returns trigger
language plpgsql
as $$
begin
  -- status virou churn → arquiva
  if new.status = 'churn' and (old.status is null or old.status <> 'churn') then
    new.arquivado_em := coalesce(new.arquivado_em, now());
  -- status saiu de churn → desarquiva
  elsif new.status <> 'churn' and old.status = 'churn' then
    new.arquivado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_arquivado_em on clientes;
create trigger sync_arquivado_em
  before update of status on clientes
  for each row
  execute function trg_sync_arquivado_em();

-- 5) Trigger no INSERT também (cobre o caso de criar cliente já como churn)
create or replace function trg_set_arquivado_em_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'churn' and new.arquivado_em is null then
    new.arquivado_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_arquivado_em_insert on clientes;
create trigger set_arquivado_em_insert
  before insert on clientes
  for each row
  execute function trg_set_arquivado_em_insert();

-- 6) Confirmação
select
  count(*) filter (where status = 'churn') as churn,
  count(*) filter (where arquivado_em is not null) as arquivados,
  count(*) as total
from clientes;
