-- =============================================================
-- Migration 046 — Call de alinhamento só em dia útil
-- =============================================================
-- A call de alinhamento NUNCA pode cair em sábado ou domingo.
-- Quando o auto-avanço (Marcar realizada) ou edição manual coloca
-- a data num fim de semana, ela é automaticamente movida pra
-- segunda-feira seguinte:
--
--   sábado  → +2 dias = segunda
--   domingo → +1 dia  = segunda
--
-- Implementado em 2 camadas (cinto + suspensório):
--   1. Função helper proximo_dia_util(date)
--   2. Trigger BEFORE INSERT OR UPDATE em clientes que aplica o helper
--      em proxima_call_alinhamento (pega tanto a RPC quanto qualquer
--      UPDATE direto)
--   3. RPC marcar_call_alinhamento_realizada atualizada pra usar o
--      helper (redundante com o trigger, mas mais explícito)
-- =============================================================
begin;

-- Helper: dado uma data, retorna a próxima data em dia útil (seg-sex)
create or replace function proximo_dia_util(d date)
returns date language sql immutable as $$
  select case extract(dow from d)::int
    when 0 then d + 1   -- domingo → segunda
    when 6 then d + 2   -- sábado → segunda
    else d
  end;
$$;

-- Trigger que ajusta proxima_call_alinhamento pra dia útil
create or replace function ajustar_call_para_dia_util()
returns trigger language plpgsql as $$
begin
  if new.proxima_call_alinhamento is not null then
    new.proxima_call_alinhamento := proximo_dia_util(new.proxima_call_alinhamento);
  end if;
  return new;
end$$;

drop trigger if exists trg_call_dia_util on clientes;
create trigger trg_call_dia_util
  before insert or update of proxima_call_alinhamento on clientes
  for each row execute function ajustar_call_para_dia_util();

-- Atualiza a RPC pra usar o helper (redundante com o trigger mas explícito)
create or replace function marcar_call_alinhamento_realizada(p_cliente_id uuid)
returns table (ultima date, proxima date)
language plpgsql security definer as $$
declare
  v_hoje date := current_date;
  v_proxima date := proximo_dia_util((current_date + interval '30 days')::date);
begin
  if not pode_editar_call_alinhamento() then
    raise exception 'sem permissao pra marcar call de alinhamento';
  end if;

  update clientes
     set ultima_call_alinhamento = v_hoje,
         proxima_call_alinhamento = v_proxima
   where id = p_cliente_id;

  return query select v_hoje, v_proxima;
end$$;

-- Normaliza dados ja existentes que possam estar em fim de semana
update clientes
   set proxima_call_alinhamento = proximo_dia_util(proxima_call_alinhamento)
 where proxima_call_alinhamento is not null
   and extract(dow from proxima_call_alinhamento) in (0, 6);

commit;
