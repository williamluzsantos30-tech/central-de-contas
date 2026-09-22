-- =========================================================
-- Migration 090: Resumo Geral — arquivamento de período (histórico congelado)
-- =========================================================
-- A Visão Executiva (Resumo Geral) reconstrói as métricas de eventos em tempo
-- real — então meses passados MUDAM conforme os clientes mudam. Pra não perder
-- o histórico, ao "finalizar o mês" o usuário ARQUIVA o período: grava um
-- snapshot congelado das métricas daquele mês, que passa a ser exibido no lugar
-- do cálculo em tempo real.
--
-- 1 linha por mês arquivado. `snapshot` guarda o objeto de KPIs inteiro (JSONB).
--
-- Fallback do app: se a tabela não existir, o botão de arquivar avisa que a
-- migration não foi rodada; o resto da tela funciona normalmente (tempo real).
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

create table if not exists resumo_periodos_arquivados (
  mes text primary key,               -- "YYYY-MM"
  snapshot jsonb not null,            -- objeto de KPIs congelado
  arquivado_em timestamptz default now(),
  arquivado_por text
);

alter table resumo_periodos_arquivados enable row level security;
drop policy if exists "auth read resumo arq" on resumo_periodos_arquivados;
drop policy if exists "auth write resumo arq" on resumo_periodos_arquivados;
create policy "auth read resumo arq" on resumo_periodos_arquivados for select using (auth.role() = 'authenticated');
create policy "auth write resumo arq" on resumo_periodos_arquivados for all using (auth.role() = 'authenticated');
