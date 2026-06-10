-- =============================================================
-- Migration 045 — Call de alinhamento mensal
-- =============================================================
-- Adiciona rastreio da call de alinhamento mensal de cada cliente:
--   - proxima_call_alinhamento (date) — próxima data agendada
--   - ultima_call_alinhamento (date) — última call realizada
--
-- A "call" cobre o cliente todo (Tráfego + Social Media). É 1 só por
-- cliente, não 1 por módulo, pra não duplicar agendamento.
--
-- Fluxo no front:
--   - Edita data → UPDATE direto (RLS de clientes já existente)
--   - "Marcar realizada" → RPC marcar_call_alinhamento_realizada
--     (faz check de cargo + seta ultima=today e proxima=today+30d
--     em uma transação)
-- =============================================================
begin;

alter table clientes
  add column if not exists proxima_call_alinhamento date,
  add column if not exists ultima_call_alinhamento date;

create index if not exists idx_clientes_proxima_call
  on clientes(proxima_call_alinhamento)
  where proxima_call_alinhamento is not null;

-- ---------------------------------------------------------
-- Função: pode editar call?
-- ---------------------------------------------------------
create or replace function pode_editar_call_alinhamento()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.aprovado
      and p.ativo
      and (
        p.role::text = 'admin'
        or p.cargo::text in ('head','diretoria','account_manager')
        or p.cargos_extras && array['head','diretoria','account_manager']
      )
  );
$$;

-- ---------------------------------------------------------
-- RPC: marcar call como realizada (atômico)
-- Seta ultima_call = hoje e proxima_call = hoje + 30 dias.
-- ---------------------------------------------------------
create or replace function marcar_call_alinhamento_realizada(p_cliente_id uuid)
returns table (ultima date, proxima date)
language plpgsql security definer as $$
declare
  v_hoje date := current_date;
  v_proxima date := current_date + interval '30 days';
begin
  if not pode_editar_call_alinhamento() then
    raise exception 'sem permissao pra marcar call de alinhamento';
  end if;

  update clientes
     set ultima_call_alinhamento = v_hoje,
         proxima_call_alinhamento = v_proxima
   where id = p_cliente_id;

  return query select v_hoje, v_proxima::date;
end$$;

-- Permite invocar pela anon key (a função faz security definer + check próprio)
grant execute on function marcar_call_alinhamento_realizada(uuid) to authenticated;

commit;

-- =============================================================
-- Como rodar:
--   1. SQL Editor do Supabase
--   2. Cola o arquivo inteiro
--   3. Run
--   4. Confere que clientes ganhou as 2 colunas e que as 2 functions
--      (pode_editar_call_alinhamento, marcar_call_alinhamento_realizada)
--      foram criadas em Database → Functions
-- =============================================================
