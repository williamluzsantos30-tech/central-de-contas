-- =========================================================
-- Migration 061 — Alteracao redefine prazo do video em 1 dia util
-- =========================================================
-- Regra: sempre que um video vai pra status='em_alteracao', o `prazo`
-- eh redefinido pra HOJE + 1 dia util. Ideia: cliente pediu alteracao
-- AGORA, editor tem 1 dia util pra devolver.
--
-- Assim, mesmo se o video tinha prazo antigo (calculado pela fila do
-- cliente na migration 023), o SLA da alteracao eh CURTO — nao herda
-- o prazo original de producao.
--
-- Ao voltar de em_alteracao pra outro status (em_edicao / em_aprovacao
-- / etc), o item volta pra fila normal e o prazo eh recalculado pelo
-- trigger existente (recalcular_prazos_edicao_video).
--
-- Se o cliente pedir alteracao 3 vezes seguidas (em_alteracao ->
-- em_aprovacao -> em_alteracao ...), cada entrada em em_alteracao
-- RESETA o prazo pra +1 dia util a partir daquele momento. Justo com
-- o editor — cada volta reseta.
--
-- Dois ajustes:
--
--   1) Novo trigger BEFORE UPDATE que seta new.prazo quando status
--      transita PARA em_alteracao.
--
--   2) recalcular_prazos_edicao_video() (migration 023) passa a
--      EXCLUIR items em em_alteracao — eles tem prazo proprio curto,
--      nao deveriam ser sobrescritos pelo recalculo geral do grupo.
--
-- Idempotente.
-- =========================================================
begin;

-- 1) Trigger que seta prazo=hoje+1 dia util na entrada em em_alteracao
create or replace function trg_edicao_video_prazo_alteracao()
returns trigger
language plpgsql
as $$
begin
  -- Dispara so na TRANSICAO pra em_alteracao (nao em cada UPDATE do row).
  -- old.status = null cobre INSERT (nao deveria acontecer pra em_alteracao
  -- mas por seguranca).
  if new.status = 'em_alteracao'
     and (old.status is null or old.status <> 'em_alteracao') then
    new.prazo := add_business_days(current_date, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists edicao_video_prazo_alteracao on edicoes_video;
create trigger edicao_video_prazo_alteracao
  before insert or update of status on edicoes_video
  for each row
  execute function trg_edicao_video_prazo_alteracao();

-- 2) Recalculo geral (migration 023) passa a ignorar items em em_alteracao.
--    Eles tem prazo proprio (curto) setado pelo trigger acima; o
--    recalculo por fila de producao nao se aplica a eles enquanto o
--    cliente esta pedindo alteracoes.
create or replace function recalcular_prazos_edicao_video(p_cliente_id uuid)
returns void
language plpgsql
as $$
begin
  with items_ordenados as (
    select id,
           row_number() over (order by ordem asc, created_at asc) as posicao,
           coalesce(aprovado_em::date, created_at::date) as ref_date
    from edicoes_video
    where cliente_id = p_cliente_id
      -- Exclui concluidos (nao tem prazo relevante) e em_alteracao
      -- (tem prazo proprio de 1 dia util setado pelo trigger).
      and status not in ('conclusao', 'em_alteracao')
  )
  update edicoes_video e
     set prazo = add_business_days(
           io.ref_date,
           ceil(io.posicao::numeric / 2)::int * 3
         )
    from items_ordenados io
   where e.id = io.id;
end;
$$;

commit;

-- =========================================================
-- Testes uteis (rodar manualmente pra validar):
--
-- -- 1) Ver o prazo antes de mudar pra alteracao
-- select id, titulo, status, prazo from edicoes_video where id = '<uuid>';
--
-- -- 2) Muda pra em_alteracao
-- update edicoes_video set status = 'em_alteracao' where id = '<uuid>';
--
-- -- 3) Confere que prazo virou hoje + 1 dia util (segunda se hoje for sexta)
-- select id, titulo, status, prazo, current_date as hoje,
--        add_business_days(current_date, 1) as esperado
--   from edicoes_video where id = '<uuid>';
--
-- -- 4) Muda de volta pra em_edicao — prazo eh recalculado pela fila
-- update edicoes_video set status = 'em_edicao' where id = '<uuid>';
-- select prazo from edicoes_video where id = '<uuid>';
-- =========================================================
