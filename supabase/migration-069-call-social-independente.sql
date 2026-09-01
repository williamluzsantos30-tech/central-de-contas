-- =========================================================
-- Migration 069 — Call de alinhamento SOCIAL independente
-- =========================================================
-- User pediu que a call do time de Social Media seja SEPARADA da call
-- do time de Trafego. Ate agora as colunas `proxima_call_alinhamento`
-- e `ultima_call_alinhamento` eram unicas e compartilhadas — os dois
-- times viam a mesma data.
--
-- Agora:
--   trafego  -> proxima_call_alinhamento / ultima_call_alinhamento
--              (permanecem intactas, backward compat total)
--   social   -> proxima_call_social / ultima_call_social (novas)
--
-- Cada time agenda sua propria reuniao mensal com o cliente, sem
-- interferir na do outro.
--
-- Idempotente.
-- =========================================================
begin;

alter table clientes
  add column if not exists proxima_call_social date,
  add column if not exists ultima_call_social date,
  add column if not exists gcal_event_id_social text;

comment on column clientes.proxima_call_social is
  'Proxima call de alinhamento do TIME SOCIAL MEDIA (independente da call de trafego).';

comment on column clientes.ultima_call_social is
  'Ultima call de alinhamento do TIME SOCIAL MEDIA realizada.';

comment on column clientes.gcal_event_id_social is
  'ID do evento no Google Calendar da call social (integracao n8n).';

create index if not exists idx_clientes_proxima_call_social
  on clientes(proxima_call_social)
  where proxima_call_social is not null;

-- RPC pra marcar call social como realizada (espelho de
-- marcar_call_alinhamento_realizada, mas mexe nas colunas novas).
create or replace function marcar_call_social_realizada(p_cliente_id uuid)
returns table (ultima date, proxima date)
language plpgsql security definer as $$
declare
  v_hoje date := current_date;
  v_proxima date := current_date + interval '30 days';
begin
  if not pode_editar_call_alinhamento() then
    raise exception 'sem permissao pra marcar call de alinhamento social';
  end if;

  update clientes
     set ultima_call_social = v_hoje,
         proxima_call_social = v_proxima
   where id = p_cliente_id;

  return query select v_hoje, v_proxima::date;
end$$;

grant execute on function marcar_call_social_realizada(uuid) to authenticated;

commit;
