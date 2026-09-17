-- =========================================================
-- Migration 085: dobra os acessos operacionais nos papéis
-- =========================================================
-- Acrescenta os acessos de área operacional (antes "módulos" por cargo) como
-- permissões dentro dos papéis. Espelha o quadro "Cargos e permissões" pros
-- papéis Social Media e Designer: ambos passam a ter Operacional Webdesign +
-- Operacional Social Media (sem Tráfego, sem Admin).
--
-- Labels batem com moduloLabel (@/lib/cargos):
--   'Operacional Tráfego' | 'Operacional Webdesign' | 'Operacional Social Media'
--
-- A sidebar já foi ajustada: se o papel do usuário carrega algum desses
-- acessos, ele define a visibilidade de Webdesign/Social; senão, mantém o
-- modelo antigo por cargo.
--
-- COMO RODAR: Supabase → SQL Editor → cole e Run.
-- =========================================================

update papeis_operacionais
set permissoes = (
  select array(
    select distinct unnest(
      permissoes || array['Operacional Webdesign', 'Operacional Social Media']
    )
  )
)
where nome in ('Social Media', 'Designer');

-- Conferência (opcional): ver como ficaram
-- select nome, permissoes from papeis_operacionais where nome in ('Social Media','Designer');

-- =========================================================
-- ROLLBACK (remove só os 2 acessos que esta migration adicionou):
-- ---------------------------------------------------------
-- update papeis_operacionais
-- set permissoes = (
--   select array(
--     select unnest(permissoes)
--     except
--     select unnest(array['Operacional Webdesign','Operacional Social Media'])
--   )
-- )
-- where nome in ('Social Media', 'Designer');
-- =========================================================
